import * as store from '../store.js';
import { money, esc, fmtDate, today, addDays, icon, round2 } from '../utils.js';
import { emptyState } from '../ui.js';
import { docHeader } from './invoices.js';

export const title = 'Customer statement';
let from = addDays(today(), -90);

/** Running-balance statement: invoices increase, payments/credits decrease. */
export function statementRows(customerId) {
  const s = store.get();
  const ev = [];
  for (const i of s.invoices.filter((x) => x.customerId === customerId && !x.draft)) {
    ev.push({ date: i.date, text: `Invoice #${i.number} (due ${fmtDate(i.dueDate)})`, amount: store.invoiceTotalsHome(i).total });
    for (const p of i.payments || []) if (!p.creditId) ev.push({ date: p.date, text: `Payment – thank you (inv #${i.number})`, amount: -round2(p.amount * store.rateOf(i)) });
  }
  for (const c of s.creditNotes.filter((x) => x.customerId === customerId)) {
    const t = store.creditTotals(c);
    ev.push({ date: c.date, text: c.type === 'deposit' ? 'Payment on account' : `Credit note ${c.number}`, amount: -t.total });
    for (const r of c.refunds || []) ev.push({ date: r.date, text: 'Refund paid', amount: r.amount });
  }
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}

export function render(params) {
  const s = store.get(), co = s.company, cur = co.currency;
  const c = store.find('customers', params.id);
  if (!c) return emptyState('Customer not found.');
  const rows = statementRows(c.id);
  let bal = round2(rows.filter((r) => r.date < from).reduce((a, r) => a + r.amount, 0));
  const opening = bal;
  const body = rows.filter((r) => r.date >= from).map((r) => { bal = round2(bal + r.amount); return `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.text)}</td>
    <td class="num">${r.amount > 0 ? money(r.amount, cur) : ''}</td><td class="num">${r.amount < 0 ? money(-r.amount, cur) : ''}</td><td class="num">${money(bal, cur)}</td></tr>`; }).join('');
  const overdue = s.invoices.filter((i) => i.customerId === c.id && store.invoiceStatus(i) === 'overdue').reduce((a, i) => a + store.invoiceTotalsHome(i).balance, 0);
  const mail = `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(`Statement of account – ${co.name}`)}&body=${encodeURIComponent(`Dear ${c.name},\n\nYour balance with us is ${money(bal, cur)}${overdue ? `, of which ${money(overdue, cur)} is overdue` : ''}.\n\n${co.paymentDetails || ''}\n\nKind regards,\n${co.name}`)}`;
  return `<a class="back no-print" href="#/customers/${c.id}">← ${esc(c.name)}</a>
    <div class="toolbar no-print"><div class="period"><span>From</span><input type="date" data-from value="${from}"></div>
      <div class="actions"><a class="btn" href="${mail}">Send by email</a><button class="btn" onclick="window.print()">${icon('print', 16)} Print / PDF</button></div></div>
    <article class="card invoice-doc">${docHeader(co, 'STATEMENT', fmtDate(today()))}
      <section class="doc-meta"><div><span class="muted">Account</span><strong>${esc(c.name)}</strong><p class="pre">${esc(c.address || '')}</p></div>
      <dl><dt>Period</dt><dd>${fmtDate(from)} – ${fmtDate(today())}</dd>${bal < 0 ? `<dt>In credit</dt><dd><strong>${money(-bal, cur)}</strong></dd>` : `<dt>Amount due</dt><dd><strong>${money(bal, cur)}</strong></dd>`}${overdue ? `<dt>Overdue</dt><dd class="neg">${money(overdue, cur)}</dd>` : ''}</dl></section>
      <table class="table"><thead><tr><th>Date</th><th>Details</th><th class="num">Charges</th><th class="num">Payments</th><th class="num">Balance</th></tr></thead>
      <tbody><tr class="muted"><td>${fmtDate(from)}</td><td>Balance brought forward</td><td></td><td></td><td class="num">${money(opening, cur)}</td></tr>${body}</tbody></table>
      ${co.paymentDetails ? `<div class="pay-box"><strong>How to pay</strong><p class="pre">${esc(co.paymentDetails)}</p></div>` : ''}
    </article>`;
}

export function mount(root, _p, app) {
  root.querySelector('[data-from]')?.addEventListener('change', (e) => { from = e.target.value; app.rerender(); });
}
