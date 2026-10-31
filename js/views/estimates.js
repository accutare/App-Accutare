import * as store from '../store.js';
import { money, esc, fmtDate, icon, round2 } from '../utils.js';
import { toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';
import { openInvoiceForm } from './invoices.js';

export const title = 'Estimates';

export const openEstimateForm = (existing, preset) => openInvoiceForm(existing, preset, 'estimate');

export function render(params) {
  if (params.id) return renderDetail(params.id);
  const s = store.get();
  const cur = s.company.currency;
  const rows = [...s.estimates].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="toolbar">${searchBox('Search estimates')}<button class="btn primary" data-new>${icon('plus')} New estimate</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>No.</th><th>Customer</th><th class="hide-sm">Date</th><th class="hide-sm">Expires</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody data-rows>${rows.map((e) => `<tr data-href="#/estimates/${e.id}"><td>E-${esc(e.number)}</td><td>${esc(store.customerName(e.customerId))}</td>
        <td class="hide-sm">${fmtDate(e.date)}</td><td class="hide-sm">${fmtDate(e.dueDate)}</td><td>${badge(store.estimateStatus(e))}</td>
        <td class="num">${money(store.invoiceTotals(e).total, cur)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No estimates yet. Send a quote and turn it into an invoice in one click.')}`;
}

function renderDetail(id) {
  const est = store.find('estimates', id);
  if (!est) return emptyState('Estimate not found.');
  const co = store.get().company, cur = co.currency;
  const c = store.find('customers', est.customerId) || {};
  const t = store.invoiceTotals(est);
  const st = store.estimateStatus(est);
  return `
    <a class="back no-print" href="#/estimates">← Estimates</a>
    <div class="toolbar no-print">
      <div>${badge(st)}</div>
      <div class="actions wrap">
        <button class="btn danger" data-delete>${icon('trash', 16)}</button>
        <button class="btn" data-edit>Edit</button>
        <button class="btn" data-print>${icon('print', 16)} Print / PDF</button>
        ${st === 'converted' ? `<a class="btn" href="#/invoices/${est.invoiceId}">View invoice</a>` : `
          ${st !== 'declined' ? '<button class="btn" data-decline>Mark declined</button>' : ''}
          <button class="btn primary" data-convert>Convert to invoice</button>`}
      </div>
    </div>
    <article class="card invoice-doc">
      <header class="doc-head">
        <div><h2>${esc(co.name)}</h2><p class="pre muted">${esc(co.address)}</p>
          <p class="muted">${[co.email, co.phone].filter(Boolean).map(esc).join(' · ')}</p></div>
        <div class="right"><h1>ESTIMATE</h1><p>E-${esc(est.number)}</p></div>
      </header>
      <section class="doc-meta">
        <div><span class="muted">Prepared for</span><strong>${esc(c.name || '—')}</strong><p class="pre">${esc(c.address || '')}</p></div>
        <dl><dt>Date</dt><dd>${fmtDate(est.date)}</dd><dt>Valid until</dt><dd>${fmtDate(est.dueDate)}</dd></dl>
      </section>
      <table class="table">
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">VAT</th><th class="num">Amount</th></tr></thead>
        <tbody>${est.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${l.qty}</td><td class="num">${money(l.price, cur)}</td>
          <td class="num">${l.vatRate}%</td><td class="num">${money(round2(l.qty * l.price), cur)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="doc-foot"><p class="pre">${esc(est.notes)}</p>
        <dl class="totals"><dt>Subtotal</dt><dd>${money(t.subtotal, cur)}</dd><dt>VAT</dt><dd>${money(t.vat, cur)}</dd>
        <dt class="grand">Total</dt><dd class="grand">${money(t.total, cur)}</dd></dl></div>
    </article>`;
}

export function mount(root, params) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openEstimateForm());
  if (!params.id) return;
  const est = store.find('estimates', params.id);
  if (!est) return;
  root.querySelector('[data-edit]').addEventListener('click', () => openEstimateForm(est));
  root.querySelector('[data-print]').addEventListener('click', () => window.print());
  root.querySelector('[data-decline]')?.addEventListener('click', () => store.upsert('estimates', { ...est, status: 'declined' }));
  root.querySelector('[data-convert]')?.addEventListener('click', () => {
    const inv = store.convertEstimate(est);
    toast(`Invoice #${inv.number} created`);
    location.hash = `#/invoices/${inv.id}`;
  });
  root.querySelector('[data-delete]').addEventListener('click', () => {
    if (confirmDialog(`Delete estimate E-${est.number}?`)) { store.remove('estimates', est.id); location.hash = '#/estimates'; }
  });
}
