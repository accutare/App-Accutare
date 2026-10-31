import * as store from '../store.js';
import { money, esc, fmtDate, icon } from '../utils.js';
import { confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';
import { openInvoiceForm, docHeader, docLines } from './invoices.js';

export const title = 'Sales receipts';
export const openReceiptForm = (existing, preset) => openInvoiceForm(existing, preset, 'receipt');

export function render(params) {
  const s = store.get(), cur = s.company.currency;
  if (params.id) {
    const r = store.find('salesReceipts', params.id);
    if (!r) return emptyState('Not found.');
    const t = store.invoiceTotals({ lines: r.lines, payments: [] });
    const c = store.find('customers', r.customerId) || {};
    return `<a class="back no-print" href="#/receipts">← Sales receipts</a>
      <div class="toolbar no-print"><span class="badge badge-paid">Paid</span><div class="actions"><button class="btn danger" data-delete>${icon('trash', 16)}</button>
        <button class="btn" data-edit>Edit</button><button class="btn" data-print>${icon('print', 16)} Print / PDF</button></div></div>
      <article class="card invoice-doc">${docHeader(s.company, 'SALES RECEIPT', r.number)}
        <section class="doc-meta"><div><span class="muted">Customer</span><strong>${esc(c.name || 'Cash sale')}</strong><p class="pre">${esc(c.address || '')}</p></div>
        <dl><dt>Date</dt><dd>${fmtDate(r.date)}</dd><dt>Paid by</dt><dd>${esc(r.method || '')}</dd></dl></section>
        ${docLines(r.lines, cur)}
        <div class="doc-foot"><p class="pre">${esc(r.notes)}</p><dl class="totals"><dt>Subtotal</dt><dd>${money(t.subtotal, cur)}</dd><dt>VAT</dt><dd>${money(t.vat, cur)}</dd>
        <dt class="grand">Total paid</dt><dd class="grand">${money(t.total, cur)}</dd></dl></div></article>`;
  }
  const rows = [...s.salesReceipts].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar">${searchBox('Search receipts')}<button class="btn primary" data-new>${icon('plus')} New sales receipt</button></div>
    <p class="muted">For sales paid on the spot (card, cash) — no invoice needed.</p>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>No.</th><th>Customer</th><th>Date</th><th class="num">Total</th></tr></thead>
    <tbody data-rows>${rows.map((r) => `<tr data-href="#/receipts/${r.id}"><td>${esc(r.number)}</td><td>${esc(r.customerId ? store.customerName(r.customerId) : 'Cash sale')}</td><td>${fmtDate(r.date)}</td>
      <td class="num">${money(store.invoiceTotals({ lines: r.lines, payments: [] }).total, cur)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No sales receipts yet.')}`;
}

export function mount(root, params) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openReceiptForm());
  if (!params.id) return;
  const r = store.find('salesReceipts', params.id);
  if (!r) return;
  root.querySelector('[data-edit]').addEventListener('click', () => openReceiptForm(r));
  root.querySelector('[data-print]').addEventListener('click', () => window.print());
  root.querySelector('[data-delete]').addEventListener('click', () => { if (confirmDialog('Delete this sales receipt?')) { store.remove('salesReceipts', r.id); location.hash = '#/receipts'; } });
}
