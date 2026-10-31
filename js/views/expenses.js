import * as store from '../store.js';
import { money, esc, fmtDate, today, icon, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';
import { compressImage, scanReceipt } from '../receipts.js';

export const title = 'Expenses';

export function openExpenseForm(existing) {
  const s = store.get();
  const co = s.company;
  let receipt = existing?.receipt || '';
  const spec = [
    { name: 'date', label: 'Date', type: 'date', required: true, value: today() },
    { name: 'payee', label: 'Payee / supplier', required: true },
    { name: 'category', label: 'Category', type: 'select', options: store.expenseCategories() },
    { name: 'method', label: 'Payment method', type: 'select', options: ['Card', 'Bank transfer', 'Cash', 'Direct debit', 'Cheque', 'Personal funds'] },
    { name: 'accountId', label: 'Paid from', type: 'select', options: [['', 'Default / by method'], ...store.bankAccounts().map((a) => [a.id, a.name])] },
    { name: 'projectId', label: 'Project', type: 'select', options: [['', '— None —'], ...s.projects.map((p) => [p.id, p.name])] },
    { name: 'amount', label: 'Total amount (incl. VAT)', type: 'number', step: '0.01', required: true },
    { name: 'vat', label: 'VAT included', type: 'number', step: '0.01' },
    { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
  ];
  openModal({
    title: existing ? 'Edit expense' : 'New expense',
    body: `<div class="receipt-box" data-receipt>
        <div data-receipt-preview></div>
        <div class="actions wrap"><label class="btn">${icon('camera', 16)} ${existing?.receipt ? 'Replace' : 'Add'} receipt photo<input type="file" accept="image/*" capture="environment" data-receipt-file hidden></label>
        <button type="button" class="btn" data-scan ${receipt ? '' : 'hidden'}>Read receipt automatically</button><span class="muted small" data-scan-status></span></div>
      </div>
      <form>${fields(spec, existing || {})}
      <button type="button" class="link-btn" data-calc-vat>Calculate VAT at ${co.vatRate}%</button>
      <footer class="modal-foot">
        ${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const preview = () => {
        m.querySelector('[data-receipt-preview]').innerHTML = receipt ? `<a href="${receipt}" target="_blank"><img src="${receipt}" alt="Receipt"></a><button type="button" class="link-btn" data-rm-receipt>Remove</button>` : '';
        m.querySelector('[data-scan]').hidden = !receipt;
        m.querySelector('[data-rm-receipt]')?.addEventListener('click', () => { receipt = ''; preview(); });
      };
      preview();
      m.querySelector('[data-receipt-file]').addEventListener('change', async (e) => {
        try { receipt = await compressImage(e.target.files[0]); preview(); m.querySelector('[data-scan]').click(); } catch (err) { toast(err.message); }
      });
      m.querySelector('[data-scan]').addEventListener('click', async () => {
        const st = m.querySelector('[data-scan-status]');
        st.textContent = 'Reading receipt…';
        try {
          const r = await scanReceipt(receipt, (p) => { st.textContent = `Reading receipt… ${p}%`; });
          if (r.payee && !form.elements.payee.value) form.elements.payee.value = r.payee;
          if (r.date) form.elements.date.value = r.date;
          if (r.total) form.elements.amount.value = r.total.toFixed(2);
          if (r.vat) form.elements.vat.value = r.vat.toFixed(2);
          st.textContent = r.total ? 'Filled in from receipt — please check.' : 'Could not find a total, please type it in.';
        } catch (err) { st.textContent = err.message; }
      });
      form.querySelector('[data-calc-vat]').addEventListener('click', () => {
        const gross = Number(form.elements.amount.value || 0);
        form.elements.vat.value = round2(gross - gross / (1 + co.vatRate / 100)).toFixed(2);
      });
      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (existing.bankTxnId) return toast('This came from the bank feed — undo it in Banking');
        if (confirmDialog('Delete this expense?')) { store.remove('expenses', existing.id); closeModal(); toast('Expense deleted'); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = readForm(form);
        if (data.vat > data.amount) return toast('VAT cannot exceed the total');
        store.upsert('expenses', { ...(existing || {}), ...data, receipt });
        closeModal();
        toast('Expense saved');
      });
    },
  });
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const rows = [...s.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((a, e) => a + Number(e.amount || 0), 0);
  return `
    <div class="toolbar">${searchBox('Search expenses')}<button class="btn primary" data-new>${icon('plus')} New expense</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Date</th><th>Payee</th><th class="hide-sm">Category</th><th class="num hide-sm">VAT</th><th class="num">Total</th></tr></thead>
      <tbody data-rows>${rows.map((e) => `
        <tr data-id="${e.id}"><td>${fmtDate(e.date)}</td><td><strong>${esc(e.payee)}</strong><small class="show-sm">${esc(e.category)}</small></td>
        <td class="hide-sm">${esc(e.category)}</td><td class="num hide-sm">${money(e.vat, cur)}</td><td class="num">${money(e.amount, cur)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="hide-sm"></td><td class="hide-sm"></td><td class="num"><strong>${money(round2(total), cur)}</strong></td></tr></tfoot>
      </table></div>`
      : emptyState('No expenses recorded yet.')}`;
}

export function mount(root) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openExpenseForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) =>
    tr.addEventListener('click', () => openExpenseForm(store.find('expenses', tr.dataset.id))));
}
