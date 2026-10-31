import * as store from '../store.js';
import { money, esc, fmtDate, icon, today } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';

export const title = 'Customers';

const SPEC = [
  { name: 'name', label: 'Name / company', required: true, full: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'address', label: 'Billing address', type: 'textarea', full: true },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
];

export function openCustomerForm(existing, onSaved) {
  openModal({
    title: existing ? 'Edit customer' : 'New customer',
    body: `<form>${fields(SPEC, existing || {})}
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const saved = store.upsert('customers', { ...(existing || {}), ...readForm(e.target) });
      closeModal();
      toast('Customer saved');
      onSaved?.(saved);
    }),
  });
}

export function render(params) {
  if (params.id) return renderDetail(params.id);
  const s = store.get();
  const cur = s.company.currency;
  const rows = [...s.customers].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="toolbar">${searchBox('Search customers')}<button class="btn primary" data-new>${icon('plus')} New customer</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Name</th><th class="hide-sm">Email</th><th class="hide-sm">Phone</th><th class="num">Open balance</th></tr></thead>
      <tbody data-rows>${rows.map((c) => `
        <tr data-href="#/customers/${c.id}">
          <td><strong>${esc(c.name)}</strong></td><td class="hide-sm">${esc(c.email)}</td><td class="hide-sm">${esc(c.phone)}</td>
          <td class="num">${money(store.customerBalance(c.id), cur)}</td>
        </tr>`).join('')}</tbody></table></div>`
      : emptyState('No customers yet. Add your first customer to start invoicing.')}`;
}

function renderDetail(id) {
  const c = store.find('customers', id);
  if (!c) return emptyState('Customer not found.');
  const cur = store.get().company.currency;
  const invoices = store.get().invoices.filter((i) => i.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <a class="back" href="#/customers">← Customers</a>
    <div class="card detail-head">
      <div><h2>${esc(c.name)}</h2>
        <p class="muted">${[c.email, c.phone].filter(Boolean).map(esc).join(' · ')}</p>
        <p class="pre">${esc(c.address)}</p></div>
      <div class="right"><span class="muted">Open balance</span><strong class="big">${money(store.customerBalance(id), cur)}</strong>
        <div class="actions"><button class="btn" data-edit>Edit</button><button class="btn danger" data-delete>${icon('trash', 16)}</button><a class="btn" href="#/statement/${c.id}">Statement</a><button class="btn" data-credit>Credit note</button><button class="btn" data-estimate>New estimate</button><button class="btn" data-receive>Receive payment</button><button class="btn primary" data-invoice>New invoice</button></div></div>
    </div>
    <div class="card table-card"><table class="table">
      <thead><tr><th>No.</th><th>Date</th><th class="hide-sm">Due</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>${invoices.map((i) => `<tr data-href="#/invoices/${i.id}"><td>#${esc(i.number)}</td><td>${fmtDate(i.date)}</td>
        <td class="hide-sm">${fmtDate(i.dueDate)}</td><td>${badge(store.invoiceStatus(i))}</td><td class="num">${money(store.invoiceTotals(i).total, cur)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="muted">No invoices for this customer.</td></tr>'}</tbody></table></div>`;
}

export function mount(root, params, app) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openCustomerForm());
  if (!params.id) return;
  const c = store.find('customers', params.id);
  root.querySelector('[data-edit]')?.addEventListener('click', () => openCustomerForm(c));
  root.querySelector('[data-credit]')?.addEventListener('click', () => app.quickCreate('credit', { customerId: c.id }));
  root.querySelector('[data-receive]')?.addEventListener('click', () => {
    openModal({
      title: `Receive payment from ${c.name}`,
      body: `<form>${fields([
        { name: 'date', label: 'Date', type: 'date', value: today(), required: true },
        { name: 'amount', label: 'Amount received', type: 'number', step: '0.01', value: Math.max(0, store.customerBalance(c.id)), required: true },
        { name: 'accountId', label: 'Deposit to', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
        { name: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Card', 'Cash', 'Cheque'] },
      ])}<p class="muted small">Applied to the oldest open invoices first. Anything left over is kept as a payment on account (deposit).</p>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
      onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(e.target);
        if (!(d.amount > 0)) return toast('Enter an amount');
        const left = store.receiveCustomerPayment(c.id, d);
        closeModal(); toast(left > 0 ? `Saved · ${left.toFixed(2)} kept as credit on account` : 'Payment saved');
      }),
    });
  });
  root.querySelector('[data-estimate]')?.addEventListener('click', () => app.quickCreate('estimate', { customerId: c.id }));
  root.querySelector('[data-invoice]')?.addEventListener('click', () => app.quickCreate('invoice', { customerId: c.id }));
  root.querySelector('[data-delete]')?.addEventListener('click', () => {
    if (store.get().invoices.some((i) => i.customerId === c.id)) return toast('Cannot delete: customer has invoices');
    if (confirmDialog(`Delete ${c.name}?`)) { store.remove('customers', c.id); location.hash = '#/customers'; }
  });
}
