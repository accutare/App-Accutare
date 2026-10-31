import * as store from '../store.js';
import * as L from '../ledger.js';
import { money, esc, fmtDate, today, icon, round2, addDays } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';

export const title = 'Chart of accounts';

let tab = 'accounts';
let range = [`${new Date().getFullYear()}-01-01`, today()];

const sourceLink = (src) => ({
  invoice: `#/invoices/${src.id}`, bill: `#/bills/${src.id}`, journal: `#/accounts/journal/${src.id}`, payrun: `#/payroll`, trip: '#/mileage',
  expense: '#/expenses', income: '#/banking', bank: '#/banking', account: `#/accounts/${src.id}`,
}[src.type] || '#/accounts');

export function openAccountForm(existing, isNew = false) {
  const preset = isNew ? existing : null;
  if (isNew) existing = null;
  const types = Object.entries(L.ACCOUNT_TYPES).map(([k, v]) => [k, v.label]);
  openModal({
    title: existing ? 'Edit account' : 'New account',
    body: `<form>${fields([
      { name: 'name', label: 'Account name', required: true, full: true },
      { name: 'code', label: 'Code', placeholder: 'e.g. 6300' },
      { name: 'type', label: 'Type', type: 'select', options: types, value: 'expense' },
      { name: 'openingBalance', label: 'Opening balance (bank/card only)', type: 'number', step: '0.01' },
      { name: 'openingDate', label: 'Opening balance date', type: 'date' },
      { name: 'description', label: 'Description', full: true },
    ], existing || preset || {})}
    <footer class="modal-foot">
      ${existing && !existing.system ? `<button type="button" class="btn danger" data-delete>${existing.inactive ? 'Reactivate' : 'Make inactive'}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      if (existing?.system) form.elements.type.disabled = true;
      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        store.upsert('accounts', { ...existing, inactive: !existing.inactive }); closeModal();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        if (existing?.system) d.type = existing.type;
        if (!existing && store.get().accounts.some((a) => a.name.toLowerCase() === d.name.toLowerCase())) return toast('An account with that name already exists');
        store.upsert('accounts', { ...(existing || {}), ...d });
        closeModal(); toast('Account saved');
      });
    },
  });
}

export function openJournalForm(existing) {
  const s = store.get();
  const accts = [...s.accounts].filter((a) => !a.inactive).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const opt = (sel) => accts.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.code)} ${esc(a.name)}</option>`).join('');
  const row = (l = {}) => `<tr class="line"><td><select data-k="accountId"><option value="">Choose account…</option>${opt(l.accountId)}</select></td>
    <td><input data-k="debit" type="number" step="0.01" value="${l.debit || ''}"></td><td><input data-k="credit" type="number" step="0.01" value="${l.credit || ''}"></td>
    <td><input data-k="memo" value="${esc(l.memo || '')}"></td><td><button type="button" class="icon-btn" data-remove>${icon('trash', 16)}</button></td></tr>`;
  const j = existing || { date: today(), number: String(s.company.nextJournalNumber), memo: '', lines: [{}, {}] };
  openModal({
    title: existing ? `Journal ${existing.number}` : 'New journal entry', wide: true,
    body: `<form>${fields([{ name: 'date', label: 'Date', type: 'date', required: true }, { name: 'number', label: 'Journal no.' }, { name: 'memo', label: 'Memo', full: true }], j)}
      <div class="table-scroll"><table class="table lines"><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Line memo</th><th></th></tr></thead>
      <tbody>${j.lines.map(row).join('')}</tbody><tfoot><tr><td>Totals</td><td data-dr></td><td data-cr></td><td colspan="2" data-diff></td></tr></tfoot></table></div>
      <button type="button" class="btn ghost" data-add-line>${icon('plus', 16)} Add line</button>
      <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save journal</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form'), tbody = form.querySelector('tbody');
      const read = () => [...tbody.querySelectorAll('tr')].map((tr) => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.type === 'number' ? Number(el.value || 0) : el.value])));
      const calc = () => {
        const ls = read(), dr = round2(ls.reduce((a, l) => a + l.debit, 0)), cr = round2(ls.reduce((a, l) => a + l.credit, 0));
        form.querySelector('[data-dr]').textContent = money(dr); form.querySelector('[data-cr]').textContent = money(cr);
        form.querySelector('[data-diff]').innerHTML = dr === cr ? '<span class="pos">Balanced</span>' : `<span class="neg">Out by ${money(Math.abs(dr - cr))}</span>`;
        return dr === cr && dr > 0;
      };
      tbody.addEventListener('input', calc);
      tbody.addEventListener('click', (e) => { if (e.target.closest('[data-remove]') && tbody.children.length > 2) { e.target.closest('tr').remove(); calc(); } });
      form.querySelector('[data-add-line]').addEventListener('click', () => tbody.insertAdjacentHTML('beforeend', row()));
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete this journal?')) { store.remove('journals', existing.id); closeModal(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!calc()) return toast('Debits must equal credits');
        const lines = read().filter((l) => l.accountId && (l.debit || l.credit));
        const saved = store.upsert('journals', { ...(existing || {}), ...readForm(form), lines });
        if (!existing) store.updateCompany({ nextJournalNumber: Number(s.company.nextJournalNumber) + 1 });
        closeModal(); toast(`Journal ${saved.number} saved`);
      });
      calc();
    },
  });
}

export function render(params) {
  if (params.id === 'journal' || tab === 'journals' && !params.id) return renderJournals();
  if (params.id) return renderRegister(params.id);
  const s = store.get();
  const t = L.totals(store.journal(), '0000', today());
  const groups = ['asset', 'liability', 'equity', 'income', 'expense'];
  const label = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' };
  const accts = [...s.accounts].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  return `${tabs()}
    <div class="toolbar">${searchBox('Search accounts')}<button class="btn primary" data-new>${icon('plus')} New account</button></div>
    <div class="card table-card"><table class="table"><thead><tr><th>Code</th><th>Name</th><th class="hide-sm">Type</th><th class="num">Balance</th></tr></thead>
    <tbody data-rows>${groups.map((g) => `<tr class="group-row"><td colspan="4">${label[g]}</td></tr>` + accts.filter((a) => L.groupOf(a) === g).map((a) => `
      <tr data-href="#/accounts/${a.id}" class="${a.inactive ? 'muted' : ''}"><td>${esc(a.code)}</td><td><strong>${esc(a.name)}</strong>${a.inactive ? ' (inactive)' : ''}</td>
      <td class="hide-sm">${L.ACCOUNT_TYPES[a.type].label}</td><td class="num">${money(L.balanceOf(s.accounts, t, a.id), s.company.currency)}</td></tr>`).join('')).join('')}</tbody></table></div>`;
}

const tabs = () => `<div class="tabs"><button class="tab ${tab === 'accounts' ? 'active' : ''}" data-tab="accounts">Chart of accounts</button>
  <button class="tab ${tab === 'journals' ? 'active' : ''}" data-tab="journals">Journal entries</button></div>`;

function renderJournals() {
  const s = store.get();
  const rows = [...s.journals].sort((a, b) => b.date.localeCompare(a.date));
  return `${tabs()}<div class="toolbar"><span class="muted">Manual double-entry adjustments (depreciation, accruals, loans, owner's money…)</span>
    <button class="btn primary" data-new-journal>${icon('plus')} New journal</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Date</th><th>No.</th><th>Memo</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows.map((j) => `<tr data-journal="${j.id}"><td>${fmtDate(j.date)}</td><td>${esc(j.number)}</td><td>${esc(j.memo)}</td>
    <td class="num">${money(j.lines.reduce((a, l) => a + Number(l.debit || 0), 0), s.company.currency)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No journal entries yet.')}`;
}

function renderRegister(id) {
  const s = store.get();
  const acc = store.find('accounts', id);
  if (!acc) return emptyState('Account not found.');
  const gl = L.generalLedger(s.accounts, store.journal(), id, range[0], range[1]);
  const cur = s.company.currency;
  return `<a class="back" href="#/accounts">← Chart of accounts</a>
    <div class="card detail-head"><div><span class="muted">${esc(acc.code)} · ${L.ACCOUNT_TYPES[acc.type].label}</span><h2>${esc(acc.name)}</h2></div>
      <div class="right"><span class="muted">Balance at ${fmtDate(range[1])}</span><strong class="big">${money(gl.closing, cur)}</strong><button class="btn" data-edit>Edit account</button></div></div>
    <div class="toolbar"><div class="period"><input type="date" data-from value="${range[0]}"> <span>to</span> <input type="date" data-to value="${range[1]}"></div>
      <button class="btn" data-csv>Export CSV</button></div>
    <div class="card table-card"><table class="table report-table"><thead><tr><th>Date</th><th>Transaction</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody><tr class="muted"><td>${fmtDate(range[0])}</td><td>Opening balance</td><td></td><td></td><td class="num">${money(gl.opening, cur)}</td></tr>
    ${gl.rows.map((r) => `<tr data-href="${sourceLink(r.source)}"><td>${fmtDate(r.date)}</td><td>${esc(r.memo)}</td><td class="num">${r.debit ? money(r.debit, cur) : ''}</td>
      <td class="num">${r.credit ? money(r.credit, cur) : ''}</td><td class="num">${money(r.balance, cur)}</td></tr>`).join('')}</tbody></table></div>`;
}

export function mount(root, params, app) {
  bindFilter(root);
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; location.hash = '#/accounts'; app.rerender(); }));
  root.querySelector('[data-new]')?.addEventListener('click', () => openAccountForm());
  root.querySelector('[data-new-journal]')?.addEventListener('click', () => openJournalForm());
  root.querySelectorAll('[data-journal]').forEach((tr) => tr.addEventListener('click', () => openJournalForm(store.find('journals', tr.dataset.journal))));
  root.querySelector('[data-edit]')?.addEventListener('click', () => openAccountForm(store.find('accounts', params.id)));
  const f = root.querySelector('[data-from]'), t = root.querySelector('[data-to]');
  const upd = () => { range = [f.value, t.value]; app.rerender(); };
  f?.addEventListener('change', upd); t?.addEventListener('change', upd);
  root.querySelector('[data-csv]')?.addEventListener('click', () => app.exportTables(`ledger-${store.find('accounts', params.id)?.name}`));
}
