// File attachments. Local mode: IndexedDB in this browser. Cloud mode: stored on the server.
import * as sync from './sync.js';
import { esc, icon, uid } from './utils.js';
import { toast } from './ui.js';
import * as store from './store.js';

const MAX = 8 * 1024 * 1024;
let dbp;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('accutare-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const idb = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('files', mode); const req = fn(tx.objectStore('files')); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); };

const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

export async function putFile(file) {
  if (file.size > MAX) throw new Error('File is larger than 8 MB');
  const meta = { name: file.name, type: file.type || 'application/octet-stream', size: file.size };
  if (sync.isOnline()) {
    const r = await sync.api('POST', 'api/files', { ...meta, data: await toBase64(file) });
    if (!r.id) throw new Error(r.error || 'Upload failed');
    return { id: r.id, ...meta };
  }
  const id = uid();
  await idb('readwrite', (st) => st.put(file, id));
  return { id, ...meta };
}

export async function openFile(meta) {
  let blob;
  if (sync.isOnline()) {
    const r = await fetch(`api/files/${meta.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('accutare:token')}`, 'X-Company': localStorage.getItem('accutare:company') || '' } });
    if (!r.ok) return toast('File not found');
    blob = await r.blob();
  } else blob = await idb('readonly', (st) => st.get(meta.id));
  if (!blob) return toast('This file is stored on another device/browser');
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' });
  if (!/^image\/|pdf/.test(meta.type)) a.download = meta.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** HTML for an attachments panel; pair with mountAttachments(). */
export function attachmentsBox(rec) {
  const list = rec?.attachments || [];
  return `<div class="card attach no-print" data-attach><div class="card-head"><h3>Attachments (${list.length})</h3>
    <label class="btn sm">${icon('plus', 14)} Attach file<input type="file" multiple hidden data-attach-input></label></div>
    ${list.length ? `<ul class="list">${list.map((f, i) => `<li><a href="#" data-open-file="${i}">📎 ${esc(f.name)} <small class="muted">${Math.ceil(f.size / 1024)} KB</small></a>
      <button class="icon-btn" data-rm-file="${i}" aria-label="Remove">${icon('trash', 14)}</button></li>`).join('')}</ul>` : '<p class="muted small">Contracts, delivery notes, photos, PDFs… (up to 8 MB each)</p>'}</div>`;
}

export function mountAttachments(root, coll, id) {
  const box = root.querySelector('[data-attach]');
  if (!box) return;
  const rec = () => store.find(coll, id);
  box.querySelector('[data-attach-input]').addEventListener('change', async (e) => {
    try {
      const added = [];
      for (const f of e.target.files) added.push(await putFile(f));
      store.upsert(coll, { ...rec(), attachments: [...(rec().attachments || []), ...added] });
      toast(`${added.length} file(s) attached`);
    } catch (err) { toast(err.message); }
  });
  box.querySelectorAll('[data-open-file]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openFile(rec().attachments[Number(a.dataset.openFile)]); }));
  box.querySelectorAll('[data-rm-file]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Remove this attachment?')) return;
    const list = [...(rec().attachments || [])]; list.splice(Number(b.dataset.rmFile), 1);
    store.upsert(coll, { ...rec(), attachments: list });
  }));
}
