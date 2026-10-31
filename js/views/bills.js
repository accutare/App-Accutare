import * as store from '../store.js';
import { money, esc, fmtDate, today, addDays, icon, uid, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';
import { openVendorForm } from './vendors.js';

export const title = 'Bills';

const FILTERS = [['unpaid', 'To pay'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']];
let currentFilter = 'unpaid';

function lineRow(l) {
  return `<tr class="line">
    <td><select data-k="category">${store.EXPENSE_CATEGORIES.map((c) => `<option ${c === l.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
    <td><input data-k="description" value="${esc(l.description)}" placeholder="Description"></td>
    <td><input data-k="amount" type="number" step="0.01" value="${l.amount}"></td>
    <td><input data-k="vatRate" type="number" step="any" min="0" value="${l.vatRate}"></td>
    <td><button type="button" class="icon-btn" data-remove aria-label="Remove line">${icon('trash', 16)}</button></td>
  </tr>`;
}

export function openBillForm(existing, preset = {}) {
  const s = store.get();
  const co = s.company;
  const bill = existing ? structuredClone(existing) : {
    vendorId: preset.vendorId || '', number: '', date: today(), dueDate: addDays(today(), 30), notes: '',
    lines: [{ category: 'Materials', description: '', amount: 0, vatRate: co.vatRate }], payments: [],
  };
  const vendors = [...s.vendors].sort((a, b) => a.name.localeCompare(b.name));
  openModal({
    title: existing ? 'Edit bill' : 'New bill', wide: true,
    body: `<form>
      ${fields([
        { name: 'vendorId', label: 'Supplier', type: 'select', required: true, options: [['', 'Select a supplier…'], ...vendors.map((v) => [v.id, v.name])] },
        { name: 'number', label: 'Bill no. / reference' },
        { name: 'date', label: 'Bill date', type: 'date', required: true },
        { name: 'dueDate', label: 'Due date', type: 'date', required: true },
      ], bill)}
      <button type="button" class="link-btn" data-add-vendor>+ Add new supplier</button>
      <div class="table-scroll"><table class="table lines">
        <thead><tr><th>Category</th><th>Description</th><th>Amount (net)</th><th>VAT %</th><th></th></tr></thead>
        <tbody>${bill.lines.map(lineRow).join('')}</tbody></table></div>
      <button type="button" class="btn ghost" data-add-line>${icon('plus', 16)} Add line</button>
      <div class="form-bottom">${fields([{ name: 'notes', label: 'Memo', type: 'textarea', full: true, rows: 2 }], bill)}<dl class="totals" data-totals></dl></div>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save bill</button></footer>
    </form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const tbody = form.querySelector('tbody');
      const readLines = () => [...tbody.querySelectorAll('tr.line')].map((tr) => {
        const o = {};
        tr.querySelectorAll('[data-k]').forEach((el) => { o[el.dataset.k] = el.type === 'number' ? Number(el.value || 0) : el.value; });
        return o;
      });
      const recalc = () => {
        const t = store.billTotals({ lines: readLines(), payments: bill.payments });
        form.querySelector('[data-totals]').innerHTML = `<dt>Subtotal</dt><dd>${money(t.subtotal, co.currency)}</dd>
          <dt>VAT</dt><dd>${money(t.vat, co.currency)}</dd><dt class="grand">Total</dt><dd class="grand">${money(t.total, co.currency)}</dd>`;
      };
      tbody.addEventListener('input', recalc);
      tbody.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]') && tbody.children.length > 1) { e.target.closest('tr').remove(); recalc(); }
      });
      form.querySelector('[data-add-line]').addEventListener('click', () => {
        tbody.insertAdjacentHTML('beforeend', lineRow({ category: 'Materials', description: '', amount: 0, vatRate: co.vatRate }));
      });
      form.querySelector('[data-add-vendor]').addEventListener('click', () => {
        const draft = { ...bill, ...readForm(form), lines: readLines() };
        openVendorForm(null, (v) => openBillForm(existing ? { ...existing, ...draft, vendorId: v.id } : null, { vendorId: v.id }));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const lines = readLines().filter((l) => l.amount);
        if (!lines.length) return toast('Add at least one line with an amount');
        const saved = store.upsert('bills', { ...bill, ...readForm(form), lines });
        closeModal();
        toast('Bill saved');
        location.hash = `#/bills/${saved.id}`;
      });
      recalc();
    },
  });
}

function openPayBill(bill) {
  const t = store.billTotals(bill);
  openModal({
    title: `Pay bill — ${store.vendorName(bill.vendorId)}`,
    body: `<form>${fields([
      { name: 'date', label: 'Payment date', type: 'date', value: today(), required: true },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', value: t.balance, required: true },
      { name: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Card', 'Direct debit', 'Cash', 'Cheque'] },
    ])}<footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save payment</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const p = readForm(e.target);
      if (!(p.amount > 0)) return toast('Enter an amount');
      store.upsert('bills', { ...bill, payments: [...(bill.payments || []), { id: uid(), ...p }] });
      closeModal();
      toast('Payment recorded');
    }),
  });
}

function matches(b) {
  const st = store.billStatus(b);
  if (currentFilter === 'all') return true;
  if (currentFilter === 'unpaid') return st !== 'paid';
  return st === currentFilter;
}

export function render(params) {
  if (params.id) return renderDetail(params.id);
  const s = store.get();
  const cur = s.company.currency;
  const rows = s.bills.filter(matches).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const toPay = s.bills.reduce((a, b) => a + store.billTotals(b).balance, 0);
  return `
    <div class="toolbar">${searchBox('Search bills')}<button class="btn primary" data-new>${icon('plus')} New bill</button></div>
    <p class="muted">Total to pay: <strong>${money(round2(toPay), cur)}</strong></p>
    <div class="tabs">${FILTERS.map(([k, l]) => `<button class="tab ${k === currentFilter ? 'active' : ''}" data-filter-status="${k}">${l}</button>`).join('')}</div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Supplier</th><th class="hide-sm">Ref</th><th class="hide-sm">Bill date</th><th>Due</th><th>Status</th><th class="num">Balance</th></tr></thead>
      <tbody data-rows>${rows.map((b) => `<tr data-href="#/bills/${b.id}"><td><strong>${esc(store.vendorName(b.vendorId))}</strong></td>
        <td class="hide-sm">${esc(b.number)}</td><td class="hide-sm">${fmtDate(b.date)}</td><td>${fmtDate(b.dueDate)}</td>
        <td>${badge(store.billStatus(b))}</td><td class="num">${money(store.billTotals(b).balance, cur)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No bills here.')}`;
}

function renderDetail(id) {
  const b = store.find('bills', id);
  if (!b) return emptyState('Bill not found.');
  const cur = store.get().company.currency;
  const t = store.billTotals(b);
  return `
    <a class="back" href="#/bills">← Bills</a>
    <div class="card detail-head">
      <div><span class="muted">Bill ${esc(b.number)}</span><h2><a href="#/vendors/${b.vendorId}">${esc(store.vendorName(b.vendorId))}</a></h2>
        <p class="muted">Dated ${fmtDate(b.date)} · due ${fmtDate(b.dueDate)}</p>${badge(store.billStatus(b))}</div>
      <div class="right"><span class="muted">Balance</span><strong class="big">${money(t.balance, cur)}</strong>
        <div class="actions"><button class="btn danger" data-delete>${icon('trash', 16)}</button><button class="btn" data-edit>Edit</button>
        ${t.balance > 0 ? '<button class="btn primary" data-pay>Pay bill</button>' : ''}</div></div>
    </div>
    <div class="card table-card"><table class="table">
      <thead><tr><th>Category</th><th>Description</th><th class="num">VAT</th><th class="num">Amount</th></tr></thead>
      <tbody>${b.lines.map((l) => `<tr><td>${esc(l.category)}</td><td>${esc(l.description)}</td><td class="num">${l.vatRate}%</td><td class="num">${money(l.amount, cur)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Subtotal</td><td class="num">${money(t.subtotal, cur)}</td></tr><tr><td colspan="3">VAT</td><td class="num">${money(t.vat, cur)}</td></tr>
      <tr><td colspan="3"><strong>Total</strong></td><td class="num"><strong>${money(t.total, cur)}</strong></td></tr></tfoot></table></div>
    ${(b.payments || []).length ? `<div class="card"><h3>Payments</h3><ul class="list">${b.payments.map((p) => `<li><div><strong>${money(p.amount, cur)}</strong>
      <small>${fmtDate(p.date)} · ${esc(p.method)}</small></div>${p.bankTxnId ? '<small class="muted">From bank</small>' : `<button class="icon-btn" data-del-payment="${p.id}" aria-label="Delete payment">${icon('trash', 16)}</button>`}</li>`).join('')}</ul></div>` : ''}`;
}

export function mount(root, params) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openBillForm());
  root.querySelectorAll('[data-filter-status]').forEach((btn) => btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filterStatus;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
  if (!params.id) return;
  const b = store.find('bills', params.id);
  if (!b) return;
  root.querySelector('[data-edit]').addEventListener('click', () => openBillForm(b));
  root.querySelector('[data-pay]')?.addEventListener('click', () => openPayBill(b));
  root.querySelector('[data-delete]').addEventListener('click', () => {
    if ((b.payments || []).some((p) => p.bankTxnId)) return toast('Undo the bank match first');
    if (confirmDialog('Delete this bill?')) { store.remove('bills', b.id); location.hash = '#/bills'; }
  });
  root.querySelectorAll('[data-del-payment]').forEach((btn) => btn.addEventListener('click', () => {
    if (confirmDialog('Delete this payment?')) store.upsert('bills', { ...b, payments: b.payments.filter((p) => p.id !== btn.dataset.delPayment) });
  }));
}
