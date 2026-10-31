// Cloud mode. When the app is served by server/server.js it signs users in and keeps the books on the server.
// When opened from plain static hosting it falls back to local (browser-only) mode.
import * as store from './store.js';
import { esc } from './utils.js';
import { toast } from './ui.js';

const TOKEN = 'accutare:token';
let token = null;
try { token = localStorage.getItem(TOKEN); } catch { /* ignore */ }
let me = null;
let version = 0;
let timer = null, inflight = null, dirty = false, pollId = null;

export const user = () => me?.user || null;
export const company = () => me?.company || null;
export const isOnline = () => !!me;
export const canWrite = () => me && me.user.role !== 'viewer';

export async function api(method, url, data) {
  let company = '';
  try { company = localStorage.getItem('accutare:company') || ''; } catch { /* ignore */ }
  const r = await fetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Company': company, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith('login')) { setToken(null); location.reload(); }
  return { status: r.status, ...j };
}

function setToken(t) { token = t; try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch { /* ignore */ } }

async function detect() {
  if (!location.protocol.startsWith('http')) return false;
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch('api/health', { cache: 'no-store', signal: ctrl.signal });
    return r.ok && (await r.json()).app === 'accutare';
  } catch { return false; }
}

/** Resolves to 'local' or 'online' (after the user has signed in). */
export async function start() {
  if (!(await detect())) return 'local';
  if (token) { const r = await api('GET', 'api/me'); if (r.status === 200) { me = r; return 'online'; } }
  await loginScreen();
  return 'online';
}

function loginScreen() {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'auth';
    let mode = 'login';
    let values = {};
    const draw = (err = '') => {
      el.innerHTML = `<form class="auth-card">
        <div class="brand"><img src="icons/icon.svg" alt="" width="40" height="40"><span>Accutare</span></div>
        <h2>${mode === 'login' ? 'Sign in' : 'Create your company account'}</h2>
        ${mode === 'signup' ? `<label class="field"><span>Your name</span><input name="name" required></label>
          <label class="field"><span>Company name</span><input name="company" required></label>` : ''}
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" required></label>
        ${err ? `<p class="neg">${esc(err)}</p>` : ''}
        <button class="btn primary">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" class="link-btn" data-switch>${mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
      </form>`;
      el.querySelector('[data-switch]').onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; draw(); };
      el.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        values = d;
        const btn = e.target.querySelector('.btn'); btn.disabled = true;
        const r = await api('POST', mode === 'login' ? 'api/login' : 'api/signup', d);
        btn.disabled = false;
        if (!r.token) return draw(r.error || 'Something went wrong');
        setToken(r.token);
        me = await api('GET', 'api/me');
        me.isNew = mode === 'signup';
        me.signupCompany = d.company;
        el.remove();
        resolve();
      };
      for (const [k, v] of Object.entries(values)) { const i = el.querySelector(`[name=${k}]`); if (i && k !== 'password') i.value = v; }
      (el.querySelector('[name=password]') && values.email ? el.querySelector('[name=password]') : el.querySelector('input'))?.focus();
    };
    draw();
    document.body.appendChild(el);
  });
}

/** Load the company books from the server into the store. */
export async function loadIntoStore() {
  const r = await api('GET', 'api/data');
  version = r.version;
  if (r.data) { store.replaceState(r.data); return; }
  // brand-new company on the server
  let hadLocal = false;
  try { hadLocal = !!localStorage.getItem('accutare:v1'); } catch { /* ignore */ }
  if (hadLocal && confirm('Upload the data already in this browser to your new company account?')) store.load();
  else { store.reset(false); store.updateCompany({ name: me.company.name || me.signupCompany || 'My company', email: me.user.email }); }
  await push(true);
}

export function attach() {
  store.setRemote(() => { dirty = true; clearTimeout(timer); timer = setTimeout(push, 700); });
  pollId = setInterval(poll, 20000);
  window.addEventListener('beforeunload', (e) => { if (dirty || inflight) { e.preventDefault(); e.returnValue = ''; } });
}

async function push(force) {
  if (!force && !dirty) return;
  if (inflight) { await inflight; return push(); }
  dirty = false;
  inflight = (async () => {
    const r = await api('PUT', 'api/data', { version, data: store.get() });
    if (r.status === 200) version = r.version;
    else if (r.status === 409) {
      version = r.version; store.replaceState(r.data);
      toast(`${r.updatedBy || 'Someone'} changed the books at the same time — your last change was not saved, please redo it.`);
    } else if (r.status === 403) toast('Read-only access: changes are not saved');
    else { dirty = true; toast(r.error || 'Could not save — will retry'); setTimeout(push, 5000); }
  })();
  await inflight; inflight = null;
}

async function poll() {
  if (dirty || inflight || document.hidden) return;
  const r = await api('GET', `api/data?since=${version}`);
  if (r.status === 200 && !r.unchanged && r.data) { version = r.version; store.replaceState(r.data); }
}

export const companies = () => me?.companies || [];
export function switchCompany(id) { try { localStorage.setItem('accutare:company', id); localStorage.removeItem('accutare:v1'); } catch { /* ignore */ } location.reload(); }
export async function createCompany(name) {
  const r = await api('POST', 'api/companies', { name });
  if (r.id) { me.signupCompany = name; switchCompany(r.id); } else toast(r.error || 'Could not create company');
}

export async function signOut() {
  await push();
  await api('POST', 'api/logout');
  setToken(null);
  try { localStorage.removeItem('accutare:v1'); localStorage.removeItem('accutare:company'); } catch { /* ignore */ }
  location.reload();
}
