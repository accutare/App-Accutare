import * as store from '../store.js';
import { money, esc, fmtDate, today, icon } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';
import { openInvoiceForm, docHeader, docLines } from './invoices.js';

export const title = 'Credit notes & payments on account';

export const openCreditForm = (existing, preset) => openInvoiceForm(existing, preset, 'credit');

function openApply(cn) {
  const s = store.get();
  const open = s.invoices.filter((i) => i.customerId === cn.customerId && !i.draft && store.invoiceTotals(i).balance > 0);
  if (!open.length) return toast('This customer has no open invoices');
  const avail = store.creditTotals(cn).available;
  openModal({
    title: `Apply ${money(avail)} to invoices`,
    body: `<form><table class="table"><thead><tr><th>Invoice</th><th>Due</th><th class="num">Balance</th><th class="num">Apply</th></tr></thead><tbody>
      ${open.map((i) => `<tr><td>#${esc(i.number)}</td><td>${fmtDate(i.dueDate)}</td><td class="num">${money(store.invoiceTotals(i).balance)}</td>
      <td class="num"><input type="number" step="0.01" min="0" data-inv="${i.id}" value="0"></td></tr>`).join('')}</tbody></table>
      <button type="button" class="link-btn" data-auto>Apply automatically (oldest first)</button>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Apply</button></footer></form>`,
    onMount(m) {
      m.querySelector('[data-auto]').addEventListener('click', () => {
        let left = avail;
        m.querySelectorAll('[data-inv]').forEach((inp) => { const bal = store.invoiceTotals(store.find('invoices', inp.dataset.inv)).balance; const a = Math.min(bal, left); inp.value = a.toFixed(2); left -= a; });
      });
      m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        let total = 0;
        m.querySelectorAll('[data-inv]').forEach((inp) => { const v = Number(inp.value || 0); if (v > 0) total += store.applyCredit(store.find('creditNotes', cn.id), inp.dataset.inv, v); });
        closeModal(); toast(`${money(total)} applied`);
      });
    },
  });
}

function openRefund(cn) {
  const avail = store.creditTotals(cn).available;
  openModal({
    title: 'Refund to customer',
    body: `<form>${fields([
      { name: 'date', label: 'Date', type: 'date', value: today(), required: true },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', value: avail, required: true },
      { name: 'accountId', label: 'Paid from', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
      { name: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Card', 'Cash', 'Cheque'] },
    ])}<footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Record refund</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = readForm(e.target);
      if (!(r.amount > 0) || r.amount > avail + 0.001) return toast(`Enter up to ${money(avail)}`);
      store.upsert('creditNotes', { ...cn, refunds: [...(cn.refunds || []), { id: store.get().company.nextCreditNumber + '-' + Date.now(), ...r }] });
      closeModal(); toast('Refund recorded');
    }),
  });
}

const status = (cn) => { const t = store.creditTotals(cn); return t.available <= 0 ? '<span class="badge badge-paid">Used</span>' : t.applied || t.refunded ? '<span class="badge badge-partial">Partly used</span>' : '<span class="badge badge-open">Available</span>'; };

export function render(params) {
  const s = store.get(), cur = s.company.currency;
  if (params.id) {
    const cn = store.find('creditNotes', params.id);
    if (!cn) return emptyState('Not found.');
    const t = store.creditTotals(cn);
    const c = store.find('customers', cn.customerId) || {};
    const used = s.invoices.flatMap((i) => (i.payments || []).filter((p) => p.creditId === cn.id).map((p) => ({ ...p, inv: i })));
    return `<a class="back no-print" href="#/credits">← Credit notes</a>
      <div class="toolbar no-print"><div>${status(cn)} <small class="muted">Available ${money(t.available, cur)} of ${money(t.total, cur)}</small></div>
        <div class="actions wrap"><button class="btn danger" data-delete>${icon('trash', 16)}</button>
          ${cn.type !== 'deposit' ? `<button class="btn" data-edit>Edit</button><button class="btn" data-print>${icon('print', 16)} Print / PDF</button>` : ''}
          ${t.available > 0 ? '<button class="btn" data-refund>Refund</button><button class="btn primary" data-apply>Apply to invoice</button>' : ''}</div></div>
      ${cn.type === 'deposit' ? `<div class="card"><h3>Payment on account · ${esc(c.name || '')}</h3><p>Received ${fmtDate(cn.date)} · ${esc(cn.method || '')} · <strong>${money(cn.amount, cur)}</strong></p>
        <p class="muted">Money received that wasn't for a specific invoice (deposit or overpayment). Apply it to an invoice or refund it.</p></div>`
      : `<article class="card invoice-doc">${docHeader(s.company, 'CREDIT NOTE', cn.number)}
        <section class="doc-meta"><div><span class="muted">Credit to</span><strong>${esc(c.name || '—')}</strong><p class="pre">${esc(c.address || '')}</p></div>
        <dl><dt>Date</dt><dd>${fmtDate(cn.date)}</dd><dt>Credit total</dt><dd><strong>${money(t.total, cur)}</strong></dd></dl></section>
        ${docLines(cn.lines, cur)}<div class="doc-foot"><p class="pre">${esc(cn.notes)}</p></div></article>`}
      ${used.length || (cn.refunds || []).length ? `<div class="card no-print"><h3>Used</h3><ul class="list">
        ${used.map((p) => `<li><a href="#/invoices/${p.inv.id}"><span>Applied to invoice #${esc(p.inv.number)} · ${fmtDate(p.date)}</span><strong>${money(p.amount, cur)}</strong></a></li>`).join('')}
        ${(cn.refunds || []).map((r) => `<li><span>Refunded · ${fmtDate(r.date)} · ${esc(r.method)}</span><strong>${money(r.amount, cur)}</strong></li>`).join('')}</ul></div>` : ''}`;
  }
  const rows = [...s.creditNotes].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar">${searchBox('Search')}<button class="btn primary" data-new>${icon('plus')} New credit note</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>No.</th><th>Type</th><th>Customer</th><th class="hide-sm">Date</th><th>Status</th><th class="num">Available</th></tr></thead>
    <tbody data-rows>${rows.map((cn) => `<tr data-href="#/credits/${cn.id}"><td>${esc(cn.number)}</td><td>${cn.type === 'deposit' ? 'Payment on account' : 'Credit note'}</td>
      <td>${esc(store.customerName(cn.customerId))}</td><td class="hide-sm">${fmtDate(cn.date)}</td><td>${status(cn)}</td><td class="num">${money(store.creditTotals(cn).available, cur)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No credit notes. Issue one to reduce what a customer owes, or record a payment on account from the customer page.')}`;
}

export function mount(root, params) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openCreditForm());
  if (!params.id) return;
  const cn = store.find('creditNotes', params.id);
  if (!cn) return;
  root.querySelector('[data-edit]')?.addEventListener('click', () => openCreditForm(cn));
  root.querySelector('[data-print]')?.addEventListener('click', () => window.print());
  root.querySelector('[data-apply]')?.addEventListener('click', () => openApply(cn));
  root.querySelector('[data-refund]')?.addEventListener('click', () => openRefund(cn));
  root.querySelector('[data-delete]').addEventListener('click', () => {
    const t = store.creditTotals(cn);
    if (t.applied || t.refunded) return toast('Remove the applications/refunds first');
    if (confirmDialog('Delete?')) { store.remove('creditNotes', cn.id); location.hash = '#/credits'; }
  });
}

export { openApply };
