// Accutare server: serves the app, user accounts and cloud data. No dependencies — Node 18+.
//   node server/server.js            (PORT=8080 DATA_DIR=./server/data by default)
// Data is stored as JSON files; put DATA_DIR on a backed-up disk in production and run behind HTTPS.
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'server', 'data'));
const SESSION_DAYS = 30;
const ROLES = ['owner', 'admin', 'standard', 'accountant', 'sales', 'purchases', 'viewer'];
const CAN_WRITE = new Set(['owner', 'admin', 'standard', 'accountant', 'sales', 'purchases']);
const CAN_MANAGE_USERS = new Set(['owner', 'admin']);

mkdirSync(path.join(DATA, 'companies'), { recursive: true });
mkdirSync(path.join(DATA, 'files'), { recursive: true });

// ---------- tiny JSON "database" with a write queue so concurrent requests don't clobber files ----------
const queues = new Map();
async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, value) {
  const prev = queues.get(file) || Promise.resolve();
  const next = prev.then(async () => {
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value));
    await fs.rename(tmp, file);
  });
  queues.set(file, next.catch(() => {}));
  return next;
}
const USERS = path.join(DATA, 'users.json');
const SESSIONS = path.join(DATA, 'sessions.json');
const companyFile = (id) => path.join(DATA, 'companies', `${id.replace(/[^\w-]/g, '')}.json`);

// ---------- auth helpers ----------
const hash = (password, salt) => new Promise((res, rej) =>
  crypto.scrypt(password, salt, 64, (err, key) => (err ? rej(err) : res(key.toString('hex')))));
async function verify(password, user) {
  const h = await hash(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(user.hash, 'hex'));
}
/** A user can belong to several companies, each with its own role. */
const memberships = (u) => u.companies || [{ companyId: u.companyId, role: u.role }];
const roleIn = (u, companyId) => memberships(u).find((m) => m.companyId === companyId)?.role;
const publicUser = (u, companyId = memberships(u)[0].companyId) => ({ id: u.id, email: u.email, name: u.name, role: roleIn(u, companyId), companyId });
const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const attempts = new Map(); // ip -> [timestamps]  (basic brute-force protection)
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60000);
  attempts.set(ip, list);
  return list.length >= 10;
}

async function newSession(user) {
  const sessions = await readJSON(SESSIONS, {});
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  for (const [k, s] of Object.entries(sessions)) if (s.expires < now) delete sessions[k];
  sessions[token] = { userId: user.id, expires: now + SESSION_DAYS * 86400000 };
  await writeJSON(SESSIONS, sessions);
  return token;
}

async function auth(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const s = (await readJSON(SESSIONS, {}))[token];
  if (!s || s.expires < Date.now()) return null;
  const user = (await readJSON(USERS, [])).find((u) => u.id === s.userId && !u.disabled);
  if (!user) return null;
  const wanted = req.headers['x-company'];
  const m = memberships(user).find((x) => x.companyId === wanted && !x.disabled) || memberships(user).find((x) => !x.disabled);
  return m ? { user, token, companyId: m.companyId, role: m.role } : null;
}

// ---------- HTTP plumbing ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string';
  res.writeHead(status, { 'Content-Type': json ? 'application/json' : 'text/plain', 'Cache-Control': 'no-store', ...headers });
  res.end(json ? JSON.stringify(body) : body);
}

async function body(req, limit = 15 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.resolve(ROOT, '.' + p);
  if (!file.startsWith(ROOT + path.sep) || file.startsWith(path.join(ROOT, 'server')) || p.includes('/.')) return send(res, 404, 'Not found');
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    res.end(data);
  } catch { send(res, 404, 'Not found'); }
}

// ---------- API ----------
const routes = {
  'GET /api/health': async () => [200, { ok: true, app: 'accutare' }],

  'POST /api/signup': async (req) => {
    const { email, password, name, company } = await body(req);
    if (!validEmail(email)) return [400, { error: 'Enter a valid email' }];
    if (!password || password.length < 8) return [400, { error: 'Password must be at least 8 characters' }];
    const users = await readJSON(USERS, []);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return [409, { error: 'An account with this email already exists' }];
    const salt = crypto.randomBytes(16).toString('hex');
    const companyId = crypto.randomUUID();
    const user = { id: crypto.randomUUID(), email: email.trim(), name: (name || '').trim(), role: 'owner', companyId, companies: [{ companyId, role: 'owner' }], salt, hash: await hash(password, salt), createdAt: new Date().toISOString() };
    users.push(user);
    await writeJSON(USERS, users);
    await writeJSON(companyFile(companyId), { version: 0, name: company || 'My company', data: null, updatedAt: null });
    return [201, { token: await newSession(user), user: publicUser(user) }];
  },

  'POST /api/login': async (req) => {
    const ip = req.socket.remoteAddress;
    if (tooMany(ip)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
    const { email, password } = await body(req);
    const user = (await readJSON(USERS, [])).find((u) => u.email.toLowerCase() === String(email || '').toLowerCase() && !u.disabled);
    if (!user || !(await verify(String(password || ''), user))) { attempts.get(ip).push(Date.now()); return [401, { error: 'Wrong email or password' }]; }
    return [200, { token: await newSession(user), user: publicUser(user) }];
  },

  'POST /api/logout': async (req, a) => {
    const sessions = await readJSON(SESSIONS, {});
    delete sessions[a.token];
    await writeJSON(SESSIONS, sessions);
    return [200, { ok: true }];
  },

  'GET /api/me': async (req, a) => {
    const c = await readJSON(companyFile(a.companyId), {});
    const companies = await Promise.all(memberships(a.user).filter((m) => !m.disabled).map(async (m) => ({ id: m.companyId, role: m.role, name: (await readJSON(companyFile(m.companyId), {})).name })));
    return [200, { user: publicUser(a.user, a.companyId), company: { id: a.companyId, name: c.name, version: c.version }, companies }];
  },

  'POST /api/password': async (req, a) => {
    const { current, password } = await body(req);
    if (!password || password.length < 8) return [400, { error: 'Password must be at least 8 characters' }];
    const users = await readJSON(USERS, []);
    const u = users.find((x) => x.id === a.user.id);
    if (!(await verify(String(current || ''), u))) return [401, { error: 'Current password is wrong' }];
    u.salt = crypto.randomBytes(16).toString('hex'); u.hash = await hash(password, u.salt);
    await writeJSON(USERS, users);
    return [200, { ok: true }];
  },

  // Company books. Optimistic concurrency: the client sends the version it edited.
  'GET /api/data': async (req, a) => {
    const c = await readJSON(companyFile(a.companyId), null);
    if (!c) return [404, { error: 'Company not found' }];
    const since = Number(new URL(req.url, 'http://x').searchParams.get('since'));
    if (since && since === c.version) return [200, { version: c.version, unchanged: true }];
    return [200, { version: c.version, data: c.data, updatedAt: c.updatedAt, updatedBy: c.updatedBy }];
  },

  'PUT /api/data': async (req, a) => {
    if (!CAN_WRITE.has(a.role)) return [403, { error: 'Your role is read-only' }];
    const { version, data } = await body(req);
    if (!data || typeof data !== 'object' || !data.company) return [400, { error: 'Invalid data' }];
    const file = companyFile(a.companyId);
    const c = await readJSON(file, null);
    if (!c) return [404, { error: 'Company not found' }];
    if (Number(version) !== c.version) return [409, { error: 'Changed by someone else', version: c.version, data: c.data, updatedBy: c.updatedBy }];
    const next = { ...c, version: c.version + 1, data, name: data.company.name || c.name, updatedAt: new Date().toISOString(), updatedBy: a.user.name || a.user.email };
    await writeJSON(file, next);
    // keep a rolling daily backup
    const day = next.updatedAt.slice(0, 10);
    const bdir = path.join(DATA, 'backups', a.companyId);
    if (!existsSync(path.join(bdir, `${day}.json`))) { mkdirSync(bdir, { recursive: true }); await writeJSON(path.join(bdir, `${day}.json`), next); }
    return [200, { version: next.version }];
  },

  'POST /api/companies': async (req, a) => {
    const { name } = await body(req);
    if (!name) return [400, { error: 'Company name is required' }];
    const users = await readJSON(USERS, []);
    const u = users.find((x) => x.id === a.user.id);
    const companyId = crypto.randomUUID();
    await writeJSON(companyFile(companyId), { version: 0, name, data: null, updatedAt: null });
    u.companies = [...memberships(u), { companyId, role: 'owner' }];
    await writeJSON(USERS, users);
    return [201, { id: companyId, name }];
  },

  'POST /api/files': async (req, a) => {
    if (!CAN_WRITE.has(a.role)) return [403, { error: 'Your role is read-only' }];
    const { name, type, data } = await body(req, 12 * 1024 * 1024);
    const buf = Buffer.from(String(data || ''), 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) return [400, { error: 'File must be between 1 byte and 8 MB' }];
    const id = crypto.randomUUID();
    const dir = path.join(DATA, 'files', a.companyId);
    mkdirSync(dir, { recursive: true });
    await fs.writeFile(path.join(dir, id), buf);
    await writeJSON(path.join(dir, `${id}.json`), { name: String(name || 'file').slice(0, 200), type: String(type || 'application/octet-stream').slice(0, 100), size: buf.length });
    return [201, { id }];
  },

  'GET /api/users': async (req, a) => {
    const users = (await readJSON(USERS, [])).filter((u) => roleIn(u, a.companyId));
    return [200, { users: users.map((u) => ({ ...publicUser(u, a.companyId), disabled: !!memberships(u).find((m) => m.companyId === a.companyId)?.disabled })), canManage: CAN_MANAGE_USERS.has(a.role) }];
  },

  'POST /api/users': async (req, a) => {
    if (!CAN_MANAGE_USERS.has(a.role)) return [403, { error: 'Only owners and admins can add users' }];
    const { email, name, password, role } = await body(req);
    if (!validEmail(email)) return [400, { error: 'Enter a valid email' }];
    if (!ROLES.includes(role) || role === 'owner') return [400, { error: 'Invalid role' }];
    const users = await readJSON(USERS, []);
    const ex = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (ex) {
      if (roleIn(ex, a.companyId)) return [409, { error: 'That person is already in this company' }];
      ex.companies = [...memberships(ex), { companyId: a.companyId, role }];
      await writeJSON(USERS, users);
      return [201, { user: publicUser(ex, a.companyId), existing: true }];
    }
    if (!password || password.length < 8) return [400, { error: 'Temporary password must be at least 8 characters' }];
    const salt = crypto.randomBytes(16).toString('hex');
    const u = { id: crypto.randomUUID(), email, name: name || '', role, companyId: a.companyId, companies: [{ companyId: a.companyId, role }], salt, hash: await hash(password, salt), createdAt: new Date().toISOString() };
    users.push(u);
    await writeJSON(USERS, users);
    return [201, { user: publicUser(u) }];
  },

  'PATCH /api/users': async (req, a) => {
    if (!CAN_MANAGE_USERS.has(a.role)) return [403, { error: 'Not allowed' }];
    const { id, role, disabled } = await body(req);
    const users = await readJSON(USERS, []);
    const u = users.find((x) => x.id === id && roleIn(x, a.companyId));
    if (!u) return [404, { error: 'User not found' }];
    u.companies = memberships(u);
    const m = u.companies.find((x) => x.companyId === a.companyId);
    if (m.role === 'owner') return [400, { error: "The owner can't be changed" }];
    if (role !== undefined) { if (!ROLES.includes(role) || role === 'owner') return [400, { error: 'Invalid role' }]; m.role = role; }
    if (disabled !== undefined) m.disabled = !!disabled;
    await writeJSON(USERS, users);
    return [200, { user: publicUser(u, a.companyId) }];
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
  const fileMatch = req.method === 'GET' && url.pathname.match(/^\/api\/files\/([0-9a-f-]{36})$/);
  if (fileMatch) {
    const a = await auth(req);
    if (!a) return send(res, 401, { error: 'Please sign in' });
    const dir = path.join(DATA, 'files', a.companyId);
    const meta = await readJSON(path.join(dir, `${fileMatch[1]}.json`), null);
    if (!meta) return send(res, 404, { error: 'Not found' });
    const safeType = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(meta.type) ? meta.type : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': safeType, 'Content-Disposition': `${safeType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(meta.name)}"`,
      'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" });
    return res.end(await fs.readFile(path.join(dir, fileMatch[1])));
  }
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: 'Not found' });
  try {
    const open = ['/api/health', '/api/signup', '/api/login'].includes(url.pathname);
    const a = open ? null : await auth(req);
    if (!open && !a) return send(res, 401, { error: 'Please sign in' });
    const [status, payload] = await handler(req, a);
    send(res, status, payload);
  } catch (err) {
    send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    if (!err.status) console.error(err);
  }
});

server.listen(PORT, () => console.log(`Accutare running on http://localhost:${PORT}  (data: ${DATA})`));
