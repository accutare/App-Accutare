import * as store from '../store.js';
import { money, esc, fmtDate, today, icon } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, badge } from '../ui.js';
import { FREQUENCIES, runRecurring } from '../recurring.js';

export const title = 'Recurring invoices';

export function openRecurringForm(existing, fromInvoice) {
  const s = store.get();
  const base = existing || {
    name: fromInvoice ? `Recurring – ${store.customerName(fromInvoice.customerId)}` : '', customerId: fromInvoice?.customerId || s.customers[0]?.id,
    frequency: 'monthly', nextDate: today(), endDate: '', active: true, terms: s.company.paymentTerms,
    lines: fromInvoice ? structuredClone(fromInvoice.lines) : [{ productId: '', description: '', qty: 1, price: 0, vatRate: s.company.vatRate }],
    notes: fromInvoice?.notes || '', projectId: fromInvoice?.projectId || '', currency: fromInvoice?.currency, rate: fromInvoice?.rate,
  };
  const line = base.lines[0];
  openModal({
    title: existing ? 'Edit recurring invoice' : 'New recurring invoice',
    body: `<form>${fields([
      { name: 'name', label: 'Template name', required: true, full: true },
      { name: 'customerId', label: 'Customer', type: 'select', options: s.customers.map((c) => [c.id, c.name]) },
      { name: 'frequency', label: 'Repeat', type: 'select', options: FREQUENCIES },
      { name: 'nextDate', label: 'Next invoice date', type: 'date', required: true },
      { name: 'endDate', label: 'End date (optional)', type: 'date' },
      { name: 'terms', label: 'Payment terms (days)', type: 'number' },
      { name: 'asDraft', label: 'Create as', type: 'select', options: [['', 'Ready to send'], ['1', 'Draft (review first)']] },
      ...(fromInvoice || existing?.lines.length > 1 ? [] : [
        { name: 'description', label: 'Description', full: true, value: line.description },
        { name: 'price', label: 'Amount (net)', type: 'number', step: '0.01', value: line.price },
        { name: 'vatRate', label: 'VAT %', type: 'number', step: 'any', value: line.vatRate }]),
      { name: 'notes', label: 'Message on invoice', type: 'textarea', full: true, rows: 2 },
    ], { ...base, asDraft: base.asDraft ? '1' : '' })}
    ${fromInvoice || existing?.lines.length > 1 ? `<p class="muted small">${base.lines.length} line(s) copied from the invoice · ${money(store.invoiceTotals(base).total, store.invoiceCurrency(base))} each time</p>` : ''}
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete this template? Invoices already created stay.')) { store.remove('recurring', existing.id); closeModal(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        const lines = 'description' in d ? [{ productId: '', description: d.description, qty: 1, price: d.price, vatRate: d.vatRate }] : base.lines;
        delete d.description; delete d.price; delete d.vatRate;
        store.upsert('recurring', { ...base, ...d, asDraft: d.asDraft === '1', lines, active: true });
        const n = runRecurring(store.get());
        store.save();
        closeModal(); toast(n ? `Saved · ${n} invoice(s) created now` : 'Recurring invoice saved');
      });
    },
  });
}

export function render() {
  const s = store.get();
  const rows = [...s.recurring].sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
  const freq = Object.fromEntries(FREQUENCIES);
  return `<div class="toolbar"><span class="muted">Invoices are created automatically on their date when the app is opened.</span>
    <button class="btn primary" data-new>${icon('plus')} New template</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Template</th><th class="hide-sm">Customer</th><th>Repeats</th><th>Next</th><th>Status</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows.map((r) => `<tr data-id="${r.id}"><td><strong>${esc(r.name)}</strong></td><td class="hide-sm">${esc(store.customerName(r.customerId))}</td>
      <td>${freq[r.frequency]}</td><td>${r.active ? fmtDate(r.nextDate) : '—'}</td><td>${r.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-draft">Paused</span>'}</td>
      <td class="num">${money(store.invoiceTotals(r).total, store.invoiceCurrency(r))}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No recurring invoices. Open any invoice and choose "Make recurring", or create a template here.')}`;
}

export function mount(root) {
  root.querySelector('[data-new]').addEventListener('click', () => {
    if (!store.get().customers.length) return toast('Add a customer first');
    openRecurringForm();
  });
  root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openRecurringForm(store.find('recurring', tr.dataset.id))));
}
