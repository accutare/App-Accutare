// Purchase orders, supplier credits and "pay bills" — three small screens.
import * as store from '../store.js';
import { money, esc, fmtDate, today, addDays, icon, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';
import { openBillForm } from './bills.js';

const vendorOpts = () => [['', 'Select a supplier…'], ...store.get().vendors.map((v) => [v.id, v.name])];

// ---------- Purchase orders ----------
function poLine(l, s) {
  return `<tr class="line"><td><select data-k="productId"><option value="">— Custom —</option>${s.products.map((p) => `<option value="${p.id}" ${p.id === l.productId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
    <input data-k="description" value="${esc(l.description)}" placeholder="Description"></td>
    <td><select data-k="category">${store.expenseCategories().map((c) => `<option ${c === l.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
    <td><input data-k="qty" type="number" step="any" value="${l.qty}"></td><td><input data-k="price" type="number" step="0.01" value="${l.price}"></td>
    <td><input data-k="vatRate" type="number" step="any" value="${l.vatRate}"></td><td><button type="button" class="icon-btn" data-remove>${icon('trash', 16)}</button></td></tr>`;
}

export function openPOForm(existing) {
  const s = store.get(), co = s.company;
  const po = existing ? structuredClone(existing) : { number: String(co.nextPONumber), date: today(), expectedDate: addDays(today(), 14), status: 'open', notes: '',
    lines: [{ productId: '', description: '', category: 'Materials', qty: 1, price: 0, vatRate: co.vatRate }] };
  openModal({
    title: existing ? `Purchase order ${po.number}` : 'New purchase order', wide: true,
    body: `<form>${fields([
      { name: 'vendorId', label: 'Supplier', type: 'select', required: true, options: vendorOpts() }, { name: 'number', label: 'PO no.' },
      { name: 'date', label: 'Date', type: 'date' }, { name: 'expectedDate', label: 'Expected delivery', type: 'date' },
      { name: 'projectId', label: 'Project', type: 'select', options: [['', '— None —'], ...s.projects.map((p) => [p.id, p.name])] },
    ], po)}
    <div class="table-scroll"><table class="table lines"><thead><tr><th>Product / description</th><th>Category</th><th>Qty</th><th>Unit cost</th><th>VAT %</th><th></th></tr></thead>
    <tbody>${po.lines.map((l) => poLine(l, s)).join('')}</tbody></table></div>
    <button type="button" class="btn ghost" data-add-line>${icon('plus', 16)} Add line</button>
    ${fields([{ name: 'notes', label: 'Message to supplier', type: 'textarea', full: true, rows: 2 }], po)}
    <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form'), tbody = form.querySelector('tbody');
      const read = () => [...tbody.querySelectorAll('tr')].map((tr) => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.type === 'number' ? Number(el.value || 0) : el.value])));
      tbody.addEventListener('change', (e) => {
        if (e.target.dataset.k !== 'productId') return;
        const p = store.find('products', e.target.value); if (!p) return;
        const tr = e.target.closest('tr'); tr.querySelector('[data-k=description]').value = p.name; tr.querySelector('[data-k=price]').value = p.cost || 0;
      });
      tbody.addEventListener('click', (e) => { if (e.target.closest('[data-remove]') && tbody.children.length > 1) e.target.closest('tr').remove(); });
      form.querySelector('[data-add-line]').addEventListener('click', () => tbody.insertAdjacentHTML('beforeend', poLine({ productId: '', description: '', category: 'Materials', qty: 1, price: 0, vatRate: co.vatRate }, s)));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const lines = read().filter((l) => l.description && l.qty);
        if (!lines.length) return toast('Add at least one line');
        store.upsert('purchaseOrders', { ...po, ...readForm(form), lines });
        if (!existing) store.updateCompany({ nextPONumber: Number(co.nextPONumber) + 1 });
        closeModal(); toast('Purchase order saved');
      });
    },
  });
}

function poMail(po) {
  const co = store.get().company, v = store.find('vendors', po.vendorId) || {};
  const body = [`Hello ${v.name || ''},`, '', `Please supply the following (PO ${po.number}), delivery by ${fmtDate(po.expectedDate)}:`, '',
    ...po.lines.map((l) => `- ${l.qty} × ${l.description} @ ${money(l.price)}`), '', `Total: ${money(store.poTotals(po).total)} incl. VAT`, '', po.notes || '', 'Thank you,', co.name].join('\n');
  return `mailto:${encodeURIComponent(v.email || '')}?subject=${encodeURIComponent(`Purchase order ${po.number} – ${co.name}`)}&body=${encodeURIComponent(body)}`;
}

export const purchaseorders = {
  title: 'Purchase orders',
  render() {
    const s = store.get();
    const rows = [...s.purchaseOrders].sort((a, b) => b.date.localeCompare(a.date));
    return `<a class="back" href="#/bills">← Bills</a><div class="toolbar">${searchBox('Search purchase orders')}<button class="btn primary" data-new>${icon('plus')} New purchase order</button></div>
      ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>PO</th><th>Supplier</th><th class="hide-sm">Expected</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
      <tbody data-rows>${rows.map((po) => `<tr><td data-open="${po.id}"><a href="#">${esc(po.number)}</a></td><td>${esc(store.vendorName(po.vendorId))}</td><td class="hide-sm">${fmtDate(po.expectedDate)}</td>
        <td>${po.status === 'closed' ? `<a class="badge badge-paid" href="#/bills/${po.billId}">Billed</a>` : '<span class="badge badge-open">Open</span>'}</td>
        <td class="num">${money(store.poTotals(po).total)}</td><td class="num">${po.status === 'open' ? `<a class="btn sm" href="${poMail(po)}">Email</a> <button class="btn primary sm" data-convert="${po.id}">Receive & bill</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState('No purchase orders yet.')}`;
  },
  mount(root) {
    bindFilter(root);
    root.querySelector('[data-new]').addEventListener('click', () => { if (!store.get().vendors.length) return toast('Add a supplier first'); openPOForm(); });
    root.querySelectorAll('[data-open]').forEach((td) => td.addEventListener('click', (e) => { e.preventDefault(); openPOForm(store.find('purchaseOrders', td.dataset.open)); }));
    root.querySelectorAll('[data-convert]').forEach((b) => b.addEventListener('click', () => {
      const bill = store.convertPO(store.find('purchaseOrders', b.dataset.convert));
      toast('Bill created — stock updated'); location.hash = `#/bills/${bill.id}`;
    }));
  },
};

// ---------- Supplier credits ----------
export const vendorcredits = {
  title: 'Supplier credits',
  render() {
    const s = store.get();
    const rows = [...s.vendorCredits].sort((a, b) => b.date.localeCompare(a.date));
    return `<a class="back" href="#/bills">← Bills</a><div class="toolbar"><span class="muted">Credit notes you received from suppliers (returns, refunds, discounts).</span>
      <button class="btn primary" data-new>${icon('plus')} New supplier credit</button></div>
      ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Supplier</th><th>Ref</th><th>Date</th><th class="num">Total</th><th class="num">Available</th></tr></thead>
      <tbody>${rows.map((vc) => { const t = store.vendorCreditTotals(vc); return `<tr data-id="${vc.id}"><td>${esc(store.vendorName(vc.vendorId))}</td><td>${esc(vc.number)}</td><td>${fmtDate(vc.date)}</td>
        <td class="num">${money(t.total)}</td><td class="num">${money(t.available)}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('No supplier credits.')}`;
  },
  mount(root) {
    root.querySelector('[data-new]').addEventListener('click', () => openBillForm(null, {}, 'vendorCredit'));
    root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openBillForm(store.find('vendorCredits', tr.dataset.id), {}, 'vendorCredit')));
  },
};

// ---------- Pay bills ----------
export const paybills = {
  title: 'Pay bills',
  render() {
    const s = store.get();
    const open = s.bills.filter((b) => store.billTotals(b).balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (!open.length) return '<a class="back" href="#/bills">← Bills</a>' + emptyState('No unpaid bills. 🎉');
    return `<a class="back" href="#/bills">← Bills</a><form class="card" data-pay>
      ${fields([{ name: 'date', label: 'Payment date', type: 'date', value: today() }, { name: 'accountId', label: 'Pay from', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
        { name: 'method', label: 'Method', type: 'select', options: ['Bank transfer', 'Card', 'Direct debit', 'Cheque'] }])}
      <div class="table-scroll"><table class="table"><thead><tr><th><input type="checkbox" data-all></th><th>Supplier</th><th>Ref</th><th>Due</th><th class="num">Open</th><th class="num">Payment</th></tr></thead>
      <tbody>${open.map((b) => { const bal = store.billTotals(b).balance; return `<tr class="${b.dueDate < today() ? 'overdue-row' : ''}"><td><input type="checkbox" data-bill="${b.id}"></td>
        <td>${esc(store.vendorName(b.vendorId))}</td><td>${esc(b.number)}</td><td>${fmtDate(b.dueDate)}</td><td class="num">${money(bal)}</td>
        <td class="num"><input type="number" step="0.01" data-amt="${b.id}" value="${bal}" style="max-width:120px"></td></tr>`; }).join('')}</tbody></table></div>
      <footer class="modal-foot"><strong data-total>Total: ${money(0)}</strong><button class="btn primary">Pay selected</button></footer></form>`;
  },
  mount(root) {
    const form = root.querySelector('[data-pay]'); if (!form) return;
    const sum = () => { let t = 0; form.querySelectorAll('[data-bill]:checked').forEach((cb) => { t += Number(form.querySelector(`[data-amt="${cb.dataset.bill}"]`).value || 0); }); form.querySelector('[data-total]').textContent = `Total: ${money(round2(t))}`; };
    form.querySelector('[data-all]').addEventListener('change', (e) => { form.querySelectorAll('[data-bill]').forEach((cb) => { cb.checked = e.target.checked; }); sum(); });
    form.addEventListener('input', sum);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const list = [...form.querySelectorAll('[data-bill]:checked')].map((cb) => ({ id: cb.dataset.bill, amount: Number(form.querySelector(`[data-amt="${cb.dataset.bill}"]`).value || 0) }));
      if (!list.length) return toast('Tick the bills to pay');
      store.payBills(list, readForm(form));
      toast(`${list.length} bill(s) paid`);
    });
  },
};
