import * as store from '../store.js';
import { fields, readForm, toast, confirmDialog } from '../ui.js';
import { compressImage } from '../receipts.js';
import * as sync from '../sync.js';
import { esc } from '../utils.js';

export const title = 'Settings';

export function render() {
  const co = store.get().company;
  return `
    <form class="card" data-company>
      <h3>Company details</h3>
      ${fields([
        { name: 'name', label: 'Company name', required: true, full: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address', type: 'textarea', full: true },
        { name: 'vatNumber', label: 'VAT registration no.' },
        { name: 'currency', label: 'Currency', type: 'select', options: ['GBP', 'EUR', 'USD', 'BRL'] },
        { name: 'vatRate', label: 'Default VAT %', type: 'number', step: 'any' },
        { name: 'paymentTerms', label: 'Payment terms (days)', type: 'number' },
        { name: 'nextInvoiceNumber', label: 'Next invoice number', type: 'number' },
        { name: 'nextEstimateNumber', label: 'Next estimate number', type: 'number' },
        { name: 'fyStartMonth', label: 'Financial year starts (month)', type: 'select', options: [...Array(12)].map((_, i) => [i + 1, new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' })]) },
        { name: 'fyStartDay', label: 'Financial year starts (day)', type: 'number' },
        { name: 'hourlyRate', label: 'Default hourly rate', type: 'number', step: '0.01' },
        { name: 'reminderDays', label: 'Days between payment reminders', type: 'number' },
        { name: 'closingDate', label: 'Close the books up to (closing date)', type: 'date' },
        { name: 'closingPassword', label: 'Closing date password (optional)', type: 'password', placeholder: co.closingHash ? '•••••• (set – type to change)' : '' },
      ], co)}
      <footer class="modal-foot"><button class="btn primary">Save settings</button></footer>
    </form>

    <form class="card" data-brand>
      <h3>Invoice branding & payments</h3>
      <div class="brand-row"><div class="logo-preview" data-logo-preview>${co.logo ? `<img src="${co.logo}" alt="Logo">` : '<span class="muted">No logo</span>'}</div>
        <div class="actions wrap"><label class="btn">Upload logo<input type="file" accept="image/*" data-logo hidden></label>${co.logo ? '<button type="button" class="btn ghost" data-rm-logo>Remove</button>' : ''}</div></div>
      ${fields([
        { name: 'accentColor', label: 'Accent colour', type: 'color' },
        { name: 'paymentLink', label: 'Online payment link (e.g. Stripe / PayPal / GoCardless)', type: 'url', placeholder: 'https://…' },
        { name: 'paymentDetails', label: 'How to pay (printed on invoices)', type: 'textarea', full: true, placeholder: 'Bank: …\nSort code: 00-00-00\nAccount: 12345678\nReference: invoice number' },
      ], co)}
      <footer class="modal-foot"><button class="btn primary">Save branding</button></footer>
    </form>

    ${sync.isOnline() ? `<div class="card" data-team><h3>Team & sign-in</h3>
      <p class="muted">Signed in as <strong>${esc(sync.user().email)}</strong> (${sync.user().role}). Company books are saved to your server and shared with your team.</p>
      <div data-users class="muted">Loading users…</div>
      <div class="actions wrap" style="margin-top:12px"><button class="btn" data-password>Change password</button><button class="btn" data-signout>Sign out</button></div>
    </div>` : `<div class="card"><h3>Team & sign-in</h3><p class="muted">You are in <strong>local mode</strong>: data lives only in this browser. To sign in, share the books with your team and access them from any device, run the Accutare server (see README: <code>npm start</code>).</p></div>`}

    <div class="card">
      <h3>Data</h3>
      <p><a href="#/audit">View audit log</a> · <a href="#/accounts">Chart of accounts</a> · <a href="#/budgets">Budgets</a> · <a href="#/assets">Fixed assets</a></p>
      <p class="muted">${sync.isOnline() ? 'Your books are saved on the server (with a daily backup). You can also download a copy.' : 'Your data is stored in this browser only. Export a backup regularly.'}</p>
      <div class="actions wrap">
        <button class="btn" data-export>Export backup (JSON)</button>
        <label class="btn">Import backup<input type="file" accept="application/json" data-import hidden></label>
        <button class="btn" data-demo>Load demo data</button>
        <label class="btn">Import customers (CSV)<input type="file" accept=".csv" data-import-list="customers" hidden></label>
        <label class="btn">Import suppliers (CSV)<input type="file" accept=".csv" data-import-list="vendors" hidden></label>
        <label class="btn">Import products (CSV)<input type="file" accept=".csv" data-import-list="products" hidden></label>
        <button class="btn danger" data-reset>Erase all data</button>
      </div>
    </div>`;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`accutare:${text}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function mount(root) {
  root.querySelector('[data-company]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = readForm(e.target);
    if (d.closingPassword) d.closingHash = await sha256(d.closingPassword);
    delete d.closingPassword;
    store.updateCompany(d);
    toast('Settings saved');
  });
  root.querySelector('[data-brand]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.updateCompany(readForm(e.target));
    toast('Branding saved');
  });
  root.querySelector('[data-logo]').addEventListener('change', async (e) => {
    try { store.updateCompany({ logo: await compressImage(e.target.files[0], 400, 0.85) }); toast('Logo saved'); } catch (err) { toast(err.message); }
  });
  root.querySelector('[data-rm-logo]')?.addEventListener('click', () => store.updateCompany({ logo: '' }));
  if (sync.isOnline()) mountTeam(root);
  root.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `accutare-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { store.importJSON(await file.text()); toast('Backup restored'); } catch (err) { toast(err.message); }
  });
  root.querySelectorAll('[data-import-list]').forEach((inp) => inp.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const n = store.importList(inp.dataset.importList, await f.text());
    toast(n ? `${n} imported` : 'Nothing new found — the file needs a header row with a "Name" column');
  }));
  root.querySelector('[data-demo]').addEventListener('click', () => {
    if (confirmDialog('Replace all data with demo data?')) { store.reset(true); toast('Demo data loaded'); }
  });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (confirmDialog('Erase ALL data? This cannot be undone.')) { store.reset(false); toast('All data erased'); }
  });
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin (full access + users)', standard: 'Standard (all except payroll)', accountant: 'Accountant (full access)', sales: 'Sales only', purchases: 'Purchases only', viewer: 'Viewer (read-only)' };

async function mountTeam(root) {
  const box = root.querySelector('[data-users]');
  const draw = async () => {
    const r = await sync.api('GET', 'api/users');
    if (r.status !== 200) { box.textContent = r.error || 'Could not load users'; return; }
    box.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${r.users.map((u) => `<tr>
      <td>${esc(u.name || '—')}</td><td>${esc(u.email)}</td>
      <td>${r.canManage && u.role !== 'owner' ? `<select data-role="${u.id}">${Object.entries(ROLE_LABEL).filter(([k]) => k !== 'owner').map(([k, l]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ROLE_LABEL[u.role]}</td>
      <td>${r.canManage && u.role !== 'owner' ? `<button class="btn sm" data-toggle="${u.id}" data-disabled="${u.disabled ? '' : '1'}">${u.disabled ? 'Enable' : 'Disable'}</button>` : ''}</td></tr>`).join('')}</tbody></table>
      ${r.canManage ? `<form class="invite" data-invite>${fields([
        { name: 'name', label: 'Name' }, { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'password', label: 'Temporary password (min 8)', type: 'text', required: true },
        { name: 'role', label: 'Role', type: 'select', options: Object.entries(ROLE_LABEL).filter(([k]) => k !== 'owner') }])}
        <footer class="modal-foot"><button class="btn primary">Add user</button></footer></form>` : ''}`;
    box.querySelectorAll('[data-role]').forEach((sel) => sel.addEventListener('change', async () => {
      const x = await sync.api('PATCH', 'api/users', { id: sel.dataset.role, role: sel.value }); toast(x.error || 'Role updated');
    }));
    box.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const x = await sync.api('PATCH', 'api/users', { id: b.dataset.toggle, disabled: !!b.dataset.disabled }); toast(x.error || 'Updated'); draw();
    }));
    box.querySelector('[data-invite]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const x = await sync.api('POST', 'api/users', readForm(e.target));
      if (x.error) return toast(x.error);
      toast('User added — send them the email and temporary password'); draw();
    });
  };
  draw();
  root.querySelector('[data-signout]').addEventListener('click', () => sync.signOut());
  root.querySelector('[data-password]').addEventListener('click', async () => {
    const current = prompt('Current password'); if (!current) return;
    const password = prompt('New password (min 8 characters)'); if (!password) return;
    const x = await sync.api('POST', 'api/password', { current, password });
    toast(x.error || 'Password changed');
  });
}
