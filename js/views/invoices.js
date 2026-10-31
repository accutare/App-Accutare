import * as store from '../store.js';
import { lineNet } from '../utils.js';
import { money, esc, fmtDate, today, addDays, icon, uid, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';
import { openCustomerForm } from './customers.js';
import { openRecurringForm } from './recurring.js';

export const CURRENCIES = ['GBP', 'EUR', 'USD', 'BRL', 'CAD', 'AUD', 'CHF', 'PLN'];

/** Branded header shared by invoices and estimates. */
export function docLines(lines, cur) {
  const disc = lines.some((l) => Number(l.discount));
  return `<table class="table">
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th>${disc ? '<th class="num">Disc</th>' : ''}<th class="num">VAT</th><th class="num">Amount</th></tr></thead>
    <tbody>${lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${l.qty}</td><td class="num">${money(l.price, cur)}</td>
      ${disc ? `<td class="num">${Number(l.discount) ? l.discount + '%' : ''}</td>` : ''}<td class="num">${l.vatRate}%</td><td class="num">${money(lineNet(l), cur)}</td></tr>`).join('')}</tbody></table>`;
}

export function docHeader(co, label, number) {
  return `<header class="doc-head" style="--accent:${esc(co.accentColor || '#0f766e')}">
    <div>${co.logo ? `<img class="doc-logo" src="${co.logo}" alt="">` : ''}<h2>${esc(co.name)}</h2><p class="pre muted">${esc(co.address)}</p>
      <p class="muted">${[co.email, co.phone].filter(Boolean).map(esc).join(' · ')}</p>
      ${co.vatNumber ? `<p class="muted">VAT no. ${esc(co.vatNumber)}</p>` : ''}</div>
    <div class="right"><h1>${label}</h1><p>${esc(number)}</p></div>
  </header>`;
}

function mailto(inv, reminder) {
  const co = store.get().company;
  const c = store.find('customers', inv.customerId) || {};
  const t = store.invoiceTotals(inv), cur = store.invoiceCurrency(inv);
  const subject = reminder ? `Reminder: invoice #${inv.number} is overdue` : `Invoice #${inv.number} from ${co.name}`;
  const body = [`Dear ${c.name || 'customer'},`, '',
    reminder ? `Our records show that invoice #${inv.number}, due on ${fmtDate(inv.dueDate)}, still has ${money(t.balance, cur)} outstanding. We would be grateful if you could arrange payment.`
      : `Please find below invoice #${inv.number} for ${money(t.total, cur)}, due on ${fmtDate(inv.dueDate)}.`, '',
    ...inv.lines.map((l) => `- ${l.description}: ${l.qty} x ${money(l.price, cur)}`), '',
    `Total: ${money(t.total, cur)}`, t.paid ? `Balance due: ${money(t.balance, cur)}` : '',
    co.paymentDetails ? `\nHow to pay:\n${co.paymentDetails}` : '', inv.paymentLink || co.paymentLink ? `Pay online: ${inv.paymentLink || co.paymentLink}` : '',
    '', 'Kind regards,', co.name].filter((x) => x !== '').join('\n');
  return `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const title = 'Invoices';

const FILTERS = [['all', 'All'], ['draft', 'Draft'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid']];
let currentFilter = 'all';

// ---------------- Invoice form ----------------

function lineRow(l, products) {
  return `<tr class="line">
    <td><select data-k="productId"><option value="">— Custom —</option>${products.map((p) =>
      `<option value="${p.id}" ${p.id === l.productId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <input data-k="description" value="${esc(l.description)}" placeholder="Description"></td>
    <td><input data-k="qty" type="number" step="any" min="0" value="${l.qty}"></td>
    <td><input data-k="price" type="number" step="0.01" value="${l.price}"></td>
    <td><input data-k="discount" type="number" step="any" min="0" max="100" value="${l.discount || 0}"></td>
    <td><input data-k="vatRate" type="number" step="any" min="0" value="${l.vatRate}"></td>
    <td class="num" data-amount></td>
    <td><button type="button" class="icon-btn" data-remove aria-label="Remove line">${icon('trash', 16)}</button></td>
  </tr>`;
}

const KINDS = {
  invoice: { coll: 'invoices', counter: 'nextInvoiceNumber', label: 'Invoice', due: 'Due date' },
  estimate: { coll: 'estimates', counter: 'nextEstimateNumber', label: 'Estimate', due: 'Expiry date' },
  credit: { coll: 'creditNotes', route: 'credits', counter: 'nextCreditNumber', label: 'Credit note', noDue: true },
  receipt: { coll: 'salesReceipts', route: 'receipts', counter: 'nextReceiptNumber', label: 'Sales receipt', noDue: true, cashSale: true },
};

export function openInvoiceForm(existing, preset = {}, kind = 'invoice') {
  const K = KINDS[kind];
  const s = store.get();
  const co = s.company;
  const inv = existing ? structuredClone(existing) : {
    number: String(co[K.counter]), customerId: preset.customerId || s.customers[0]?.id || '', projectId: preset.projectId || '',
    date: today(), dueDate: addDays(today(), co.paymentTerms), notes: 'Thank you for your business.',
    lines: [{ productId: '', description: '', qty: 1, price: 0, vatRate: co.vatRate }], payments: [], draft: false,
  };
  const customers = [...s.customers].sort((a, b) => a.name.localeCompare(b.name));

  const body = `<form class="invoice-form">
    ${fields([
      { name: 'customerId', label: 'Customer', type: 'select', required: !K.cashSale, options: [['', K.cashSale ? 'Cash sale (no customer)' : 'Select a customer…'], ...customers.map((c) => [c.id, c.name])] },
      { name: 'number', label: `${K.label} no.`, required: true },
      { name: 'date', label: `${K.label} date`, type: 'date', required: true },
      ...(K.noDue ? [] : [{ name: 'dueDate', label: K.due, type: 'date', required: true }]),
      ...(K.cashSale ? [{ name: 'accountId', label: 'Deposit to', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
        { name: 'method', label: 'Payment method', type: 'select', options: ['Card', 'Cash', 'Bank transfer', 'Cheque'] }] : []),
      { name: 'projectId', label: 'Project', type: 'select', options: [['', '— None —'], ...s.projects.filter((p) => p.status !== 'closed' || p.id === inv.projectId).map((p) => [p.id, p.name])] },
      { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES.includes(co.currency) ? CURRENCIES : [co.currency, ...CURRENCIES] },
      { name: 'rate', label: `Exchange rate (1 unit = ? ${co.currency})`, type: 'number', step: 'any' },
    ], { currency: co.currency, rate: 1, ...preset, ...inv })}
    <button type="button" class="link-btn" data-add-customer>+ Add new customer</button>
    <div class="table-scroll"><table class="table lines">
      <thead><tr><th>Product / service</th><th>Qty</th><th>Rate</th><th>Disc %</th><th>VAT %</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>${inv.lines.map((l) => lineRow(l, s.products)).join('')}</tbody>
    </table></div>
    <button type="button" class="btn ghost" data-add-line>${icon('plus', 16)} Add line</button>
    <div class="form-bottom">
      ${fields([{ name: 'notes', label: 'Message on invoice', type: 'textarea', full: true }], inv)}
      <dl class="totals" data-totals></dl>
    </div>
    <footer class="modal-foot">
      <button type="button" class="btn ghost" data-close>Cancel</button>
      ${kind === 'invoice' ? '<button type="submit" class="btn" name="mode" value="draft">Save as draft</button>' : ''}
      <button type="submit" class="btn primary" name="mode" value="final">Save ${K.label.toLowerCase()}</button>
    </footer></form>`;

  openModal({
    title: existing ? `Edit ${K.label.toLowerCase()} #${existing.number}` : `New ${K.label.toLowerCase()}`, body, wide: true,
    onMount(m) {
      const form = m.querySelector('form');
      const tbody = form.querySelector('.lines tbody');
      const readLines = () => [...tbody.querySelectorAll('tr.line')].map((tr) => {
        const o = {};
        tr.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = el.type === 'number' ? Number(el.value || 0) : el.value; });
        return o;
      });
      const rateField = form.elements.rate.closest('.field');
      const recalc = () => {
        const cur = form.elements.currency.value;
        rateField.hidden = cur === co.currency;
        if (cur === co.currency) form.elements.rate.value = 1;
        tbody.querySelectorAll('tr.line').forEach((tr, idx) => {
          const l = readLines()[idx];
          tr.querySelector('[data-amount]').textContent = money(lineNet(l), cur);
        });
        const t = store.invoiceTotals({ lines: readLines(), payments: inv.payments });
        form.querySelector('[data-totals]').innerHTML = `
          <dt>Subtotal</dt><dd>${money(t.subtotal, cur)}</dd>
          <dt>VAT</dt><dd>${money(t.vat, cur)}</dd>
          <dt class="grand">Total</dt><dd class="grand">${money(t.total, cur)}</dd>
          ${cur !== co.currency ? `<dt>In ${co.currency}</dt><dd>${money(t.total * Number(form.elements.rate.value || 1), co.currency)}</dd>` : ''}`;
      };
      form.elements.currency.addEventListener('change', recalc);
      form.elements.rate.addEventListener('input', recalc);
      tbody.addEventListener('input', recalc);
      tbody.addEventListener('change', (e) => {
        if (e.target.dataset.k !== 'productId') return;
        const p = store.find('products', e.target.value);
        if (!p) return;
        const tr = e.target.closest('tr');
        tr.querySelector('[data-k=description]').value = p.description || p.name;
        tr.querySelector('[data-k=price]').value = p.price;
        tr.querySelector('[data-k=vatRate]').value = p.vatRate;
        recalc();
      });
      tbody.addEventListener('click', (e) => {
        if (!e.target.closest('[data-remove]')) return;
        if (tbody.children.length > 1) e.target.closest('tr').remove();
        recalc();
      });
      form.querySelector('[data-add-line]').addEventListener('click', () => {
        tbody.insertAdjacentHTML('beforeend', lineRow({ productId: '', description: '', qty: 1, price: 0, vatRate: co.vatRate }, s.products));
        recalc();
      });
      form.querySelector('[data-add-customer]').addEventListener('click', () => {
        const draft = { ...inv, ...readForm(form), lines: readLines() };
        openCustomerForm(null, (c) => openInvoiceForm(existing ? { ...existing, ...draft, customerId: c.id } : null, { ...draft, customerId: c.id }, kind));
      });
      // restore a draft passed through preset (after adding a customer)
      if (!existing && preset.lines) {
        tbody.innerHTML = preset.lines.map((l) => lineRow(l, s.products)).join('');
        for (const k of ['number', 'date', 'dueDate', 'notes']) if (preset[k] != null) form.elements[k].value = preset[k];
        form.elements.customerId.value = preset.customerId;
      }
      form.elements.date.addEventListener('change', () => {
        if (form.elements.dueDate) form.elements.dueDate.value = addDays(form.elements.date.value, co.paymentTerms);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = readForm(form);
        delete data.mode;
        const lines = readLines().filter((l) => l.description || l.price);
        if (!lines.length) return toast('Add at least one line');
        const isNew = !existing;
        if ((kind === 'invoice' || kind === 'receipt') && e.submitter?.value !== 'draft') {
          const short = lines.filter((l) => { const q = store.stockOnHand(l.productId); return q !== null && l.qty > q + (existing && !existing.draft ? (existing.lines.find((x) => x.productId === l.productId)?.qty || 0) : 0); });
          if (short.length && !confirmDialog(`Not enough stock for: ${short.map((l) => l.description).join(', ')}. Save anyway?`)) return;
        }
        const saved = store.upsert(K.coll, {
          ...inv, ...data, lines, draft: e.submitter?.value === 'draft',
        });
        if (isNew && Number(saved.number) >= co[K.counter]) store.updateCompany({ [K.counter]: Number(saved.number) + 1 });
        closeModal();
        toast(`${K.label} saved`);
        location.hash = `#/${K.route || K.coll}/${saved.id}`;
      });
      recalc();
    },
  });
}

function openPaymentForm(inv) {
  const t = store.invoiceTotals(inv);
  openModal({
    title: `Receive payment — #${inv.number} (${store.invoiceCurrency(inv)})`,
    body: `<form>${fields([
      { name: 'date', label: 'Payment date', type: 'date', value: today(), required: true },
      { name: 'amount', label: 'Amount received', type: 'number', step: '0.01', value: t.balance, required: true },
      { name: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Card', 'Cash', 'Cheque', 'Other'] },
      { name: 'accountId', label: 'Deposit to', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
    ])}<p class="muted small">Tip: payments that arrive in your bank feed can be matched in Banking instead.</p>
    <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save payment</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = readForm(e.target);
      if (!(p.amount > 0)) return toast('Enter an amount');
      store.upsert('invoices', { ...inv, draft: false, payments: [...(inv.payments || []), { id: uid(), ...p }] });
      closeModal();
      toast('Payment recorded');
    }),
  });
}

// ---------------- Views ----------------

function matchesFilter(inv) {
  const st = store.invoiceStatus(inv);
  if (currentFilter === 'all') return true;
  if (currentFilter === 'unpaid') return ['open', 'partial', 'overdue'].includes(st);
  return st === currentFilter;
}

export function render(params) {
  if (params.id) return renderDetail(params.id);
  const s = store.get();
  const cur = s.company.currency;
  const rows = s.invoices.filter(matchesFilter).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  return `
    <div class="toolbar">${searchBox('Search invoices')}<button class="btn primary" data-new>${icon('plus')} New invoice</button></div>
    <div class="tabs">${FILTERS.map(([k, l]) => `<button class="tab ${k === currentFilter ? 'active' : ''}" data-filter-status="${k}">${l}</button>`).join('')}</div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>No.</th><th>Customer</th><th class="hide-sm">Date</th><th class="hide-sm">Due</th><th>Status</th><th class="num">Balance</th><th class="num hide-sm">Total</th></tr></thead>
      <tbody data-rows>${rows.map((i) => { const t = store.invoiceTotals(i); return `
        <tr data-href="#/invoices/${i.id}"><td>#${esc(i.number)}</td><td>${esc(store.customerName(i.customerId))}</td>
        <td class="hide-sm">${fmtDate(i.date)}</td><td class="hide-sm">${fmtDate(i.dueDate)}</td><td>${badge(store.invoiceStatus(i))}</td>
        <td class="num">${money(t.balance, store.invoiceCurrency(i))}</td><td class="num hide-sm">${money(t.total, store.invoiceCurrency(i))}</td></tr>`; }).join('')}</tbody></table></div>`
      : emptyState('No invoices here.')}`;
}

function renderDetail(id) {
  const inv = store.find('invoices', id);
  if (!inv) return emptyState('Invoice not found.');
  const s = store.get(), co = s.company, cur = store.invoiceCurrency(inv);
  const c = store.find('customers', inv.customerId) || {};
  const t = store.invoiceTotals(inv);
  const st = store.invoiceStatus(inv);
  const link = inv.paymentLink || co.paymentLink;
  const proj = inv.projectId && store.find('projects', inv.projectId);
  return `
    <a class="back no-print" href="#/invoices">← Invoices</a>
    <div class="toolbar no-print">
      <div>${badge(st)} ${inv.sentAt ? `<small class="muted">Sent ${fmtDate(inv.sentAt)}</small>` : ''} ${inv.lastReminder ? `<small class="muted">· reminded ${fmtDate(inv.lastReminder)}</small>` : ''}
        ${proj ? `<small>· <a href="#/projects/${proj.id}">${esc(proj.name)}</a></small>` : ''} ${inv.recurringId ? '<small class="muted">· from recurring template</small>' : ''}</div>
      <div class="actions wrap">
        <button class="btn danger" data-delete>${icon('trash', 16)}</button>
        <button class="btn" data-edit>Edit</button>
        <button class="btn" data-recurring>Make recurring</button>
        <button class="btn" data-print>${icon('print', 16)} Print / PDF</button>
        ${st === 'overdue' ? `<a class="btn" data-remind href="${mailto(inv, true)}">Send reminder</a>` : ''}
        <a class="btn" data-send href="${mailto(inv, false)}">${inv.sentAt ? 'Resend' : 'Send'} by email</a>
        ${t.balance > 0 && s.creditNotes.some((x) => x.customerId === inv.customerId && store.creditTotals(x).available > 0) ? '<button class="btn" data-apply-credit>Apply credit</button>' : ''}
        ${t.balance > 0 ? '<button class="btn primary" data-pay>Receive payment</button>' : ''}
      </div>
    </div>
    <article class="card invoice-doc">
      ${docHeader(co, 'INVOICE', '#' + inv.number)}
      <section class="doc-meta">
        <div><span class="muted">Bill to</span><strong>${esc(c.name || '—')}</strong><p class="pre">${esc(c.address || '')}</p></div>
        <dl><dt>Invoice date</dt><dd>${fmtDate(inv.date)}</dd><dt>Due date</dt><dd>${fmtDate(inv.dueDate)}</dd><dt>Balance due</dt><dd><strong>${money(t.balance, cur)}</strong></dd></dl>
      </section>
      ${docLines(inv.lines, cur)}
      <div class="doc-foot">
        <div><p class="pre">${esc(inv.notes)}</p>
          ${co.paymentDetails ? `<div class="pay-box"><strong>How to pay</strong><p class="pre">${esc(co.paymentDetails)}</p></div>` : ''}
          ${link && t.balance > 0 ? `<p><a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener">Pay online</a></p>` : ''}</div>
        <dl class="totals">
          <dt>Subtotal</dt><dd>${money(t.subtotal, cur)}</dd><dt>VAT</dt><dd>${money(t.vat, cur)}</dd>
          <dt class="grand">Total</dt><dd class="grand">${money(t.total, cur)}</dd>
          ${t.paid ? `<dt>Paid</dt><dd>−${money(t.paid, cur)}</dd><dt class="grand">Balance due</dt><dd class="grand">${money(t.balance, cur)}</dd>` : ''}
          ${cur !== co.currency ? `<dt class="muted">Rate</dt><dd class="muted">1 ${cur} = ${inv.rate} ${co.currency}</dd>` : ''}
        </dl>
      </div>
    </article>
    ${(inv.payments || []).length ? `<div class="card no-print"><h3>Payments</h3><ul class="list">${inv.payments.map((p) => `
      <li><div><strong>${money(p.amount, cur)}</strong><small>${fmtDate(p.date)} · ${esc(p.method)}</small></div>
      ${p.creditId ? `<button class="icon-btn" data-del-payment="${p.id}" aria-label="Remove credit">${icon('trash', 16)}</button>` : p.bankTxnId ? '<small class="muted">From bank</small>' : `<button class="icon-btn" data-del-payment="${p.id}" aria-label="Delete payment">${icon('trash', 16)}</button>`}</li>`).join('')}</ul></div>` : ''}`;
}

export function mount(root, params) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openInvoiceForm());
  root.querySelectorAll('[data-filter-status]').forEach((b) => b.addEventListener('click', () => {
    currentFilter = b.dataset.filterStatus;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
  if (!params.id) return;
  const inv = store.find('invoices', params.id);
  if (!inv) return;
  root.querySelector('[data-edit]').addEventListener('click', () => openInvoiceForm(inv));
  root.querySelector('[data-print]').addEventListener('click', () => window.print());
  root.querySelector('[data-apply-credit]')?.addEventListener('click', () => {
    let left = store.invoiceTotals(inv).balance, used = 0;
    for (const cn of store.get().creditNotes.filter((x) => x.customerId === inv.customerId)) {
      if (left <= 0) break;
      const a = store.applyCredit(cn, inv.id, left); left -= a; used += a;
    }
    toast(`${money(used, store.invoiceCurrency(inv))} of credit applied`);
  });
  root.querySelector('[data-recurring]').addEventListener('click', () => openRecurringForm(null, inv));
  root.querySelector('[data-send]').addEventListener('click', () => setTimeout(() => store.upsert('invoices', { ...inv, sentAt: today(), draft: false }), 300));
  root.querySelector('[data-remind]')?.addEventListener('click', () => setTimeout(() => store.upsert('invoices', { ...inv, lastReminder: today() }), 300));
  root.querySelector('[data-pay]')?.addEventListener('click', () => openPaymentForm(inv));
  root.querySelector('[data-delete]').addEventListener('click', () => {
    if ((inv.payments || []).some((p) => p.bankTxnId)) return toast('Undo the bank match first (Banking → Categorised)');
    if (confirmDialog(`Delete invoice #${inv.number}?`)) { store.remove('invoices', inv.id); location.hash = '#/invoices'; }
  });
  root.querySelectorAll('[data-del-payment]').forEach((b) => b.addEventListener('click', () => {
    if (confirmDialog('Delete this payment?')) store.upsert('invoices', { ...inv, payments: inv.payments.filter((p) => p.id !== b.dataset.delPayment) });
  }));
}
