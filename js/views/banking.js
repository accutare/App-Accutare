import * as store from '../store.js';
import { money, esc, fmtDate, today, icon, round2, uid } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState } from '../ui.js';

export const title = 'Banking';

let tab = 'review';

function linkLabel(t) {
  const l = t.link;
  if (t.status === 'excluded') return '<span class="muted">Excluded</span>';
  if (!l) return '';
  if (l.type === 'expense') { const e = store.find('expenses', l.id); return `Expense · ${esc(e?.category || '')}`; }
  if (l.type === 'otherIncome') { const r = store.find('otherIncome', l.id); return `Income · ${esc(r?.category || '')}`; }
  if (l.type === 'invoices') { const i = store.find('invoices', l.id); return `<a href="#/invoices/${l.id}">Payment · invoice #${esc(i?.number)}</a>`; }
  if (l.type === 'bills') return `<a href="#/bills/${l.id}">Bill payment · ${esc(store.vendorName(store.find('bills', l.id)?.vendorId))}</a>`;
  return '';
}

/** Open invoices/bills whose balance equals this amount come first: that's the suggested match. */
function candidates(t) {
  const s = store.get();
  const amt = Math.abs(t.amount);
  const list = t.amount > 0
    ? s.invoices.filter((i) => !i.draft && store.invoiceTotals(i).balance > 0)
      .map((i) => ({ kind: 'invoice', id: i.id, label: `Invoice #${i.number} · ${store.customerName(i.customerId)}`, balance: store.invoiceTotals(i).balance }))
    : s.bills.filter((b) => store.billTotals(b).balance > 0)
      .map((b) => ({ kind: 'bill', id: b.id, label: `Bill ${b.number} · ${store.vendorName(b.vendorId)}`, balance: store.billTotals(b).balance }));
  return list.sort((a, b) => Math.abs(a.balance - amt) - Math.abs(b.balance - amt));
}

function guessCategory(t) {
  const d = t.description.toLowerCase();
  const rules = [[/shell|bp |esso|fuel|parking|dvla/, 'Vehicle'], [/gas|electric|water|edf|octopus|bt /, 'Utilities'], [/amazon|staples|viking/, 'Office supplies'],
    [/microsoft|google|adobe|xero|apple/, 'Software'], [/rent/, 'Rent'], [/insur/, 'Insurance'], [/fee|charge/, 'Bank charges'],
    [/screwfix|toolstation|wickes|b&q/, 'Materials'], [/train|uber|hotel|airline|tfl/, 'Travel']];
  if (t.amount > 0) return /interest/.test(d) ? 'Interest' : /refund/.test(d) ? 'Refunds' : 'Other income';
  return rules.find(([re]) => re.test(d))?.[1] || 'Other';
}

function openPost(t) {
  const co = store.get().company;
  const isIn = t.amount > 0;
  const cands = candidates(t);
  const exact = cands.find((c) => Math.abs(c.balance - Math.abs(t.amount)) < 0.005);
  const cats = isIn ? store.INCOME_CATEGORIES : store.EXPENSE_CATEGORIES;
  openModal({
    title: `${isIn ? 'Money in' : 'Money out'} · ${money(Math.abs(t.amount), co.currency)}`,
    body: `
      <p><strong>${esc(t.description)}</strong><br><span class="muted">${fmtDate(t.date)}</span></p>
      <div class="tabs"><button class="tab ${exact ? '' : 'active'}" data-mode="categorise">Categorise</button>
        <button class="tab ${exact ? 'active' : ''}" data-mode="match" ${cands.length ? '' : 'disabled'}>Match ${isIn ? 'invoice' : 'bill'} (${cands.length})</button></div>
      <form data-form="categorise" ${exact ? 'hidden' : ''}>
        ${fields([
          ...(isIn ? [] : [{ name: 'payee', label: 'Payee', value: t.description }]),
          { name: 'category', label: 'Category', type: 'select', options: cats, value: guessCategory(t) },
          { name: 'vat', label: 'VAT included', type: 'number', step: '0.01', value: 0 },
        ])}
        <button type="button" class="link-btn" data-calc-vat>Calculate VAT at ${co.vatRate}%</button>
        <footer class="modal-foot"><button type="button" class="btn ghost" data-exclude>Exclude</button><button class="btn primary">Add</button></footer>
      </form>
      <form data-form="match" ${exact ? '' : 'hidden'}>
        <div class="choice-list">${cands.map((c, i) => `<label class="choice"><input type="radio" name="id" value="${c.id}" ${(exact ? c === exact : i === 0) ? 'checked' : ''}>
          <span>${esc(c.label)}</span><strong>${money(c.balance, co.currency)}</strong></label>`).join('')}</div>
        <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Match</button></footer>
      </form>`,
    onMount(m) {
      m.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        m.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
        m.querySelector('[data-form=categorise]').hidden = b.dataset.mode !== 'categorise';
        m.querySelector('[data-form=match]').hidden = b.dataset.mode !== 'match';
      }));
      const cf = m.querySelector('[data-form=categorise]');
      cf.querySelector('[data-calc-vat]').addEventListener('click', () => {
        const g = Math.abs(t.amount);
        cf.elements.vat.value = round2(g - g / (1 + co.vatRate / 100)).toFixed(2);
      });
      cf.querySelector('[data-exclude]').addEventListener('click', () => { store.postBankTransaction(t, 'exclude'); closeModal(); });
      cf.addEventListener('submit', (e) => {
        e.preventDefault();
        store.postBankTransaction(t, 'categorise', readForm(cf));
        closeModal(); toast('Added to your books');
      });
      m.querySelector('[data-form=match]').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = new FormData(e.target).get('id');
        if (!id) return;
        store.postBankTransaction(t, isIn ? 'invoice' : 'bill', { id });
        closeModal(); toast('Matched');
      });
    },
  });
}

function openImport() {
  openModal({
    title: 'Import bank statement',
    body: `<p class="muted">Upload a CSV exported from your online banking. Columns needed: date, description and either <em>amount</em> or <em>paid in / paid out</em>. Duplicates are skipped.</p>
      <label class="btn">Choose CSV file<input type="file" accept=".csv,text/csv" data-file hidden></label>
      <p class="muted small">Or add one transaction by hand:</p>
      <form>${fields([
        { name: 'date', label: 'Date', type: 'date', value: today(), required: true },
        { name: 'amount', label: 'Amount (negative = money out)', type: 'number', step: '0.01', required: true },
        { name: 'description', label: 'Description', required: true, full: true },
      ])}<footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Add transaction</button></footer></form>`,
    onMount(m) {
      m.querySelector('[data-file]').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const list = store.parseBankCsv(await f.text());
        if (!list.length) return toast('No transactions found in that file');
        const n = store.importBankTransactions(list);
        closeModal(); toast(`${n} transaction${n === 1 ? '' : 's'} imported`);
      });
      m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(e.target);
        if (!d.amount) return toast('Enter an amount');
        store.importBankTransactions([{ ...d, amount: round2(d.amount) }]);
        closeModal();
      });
    },
  });
}

function openReconcile() {
  const s = store.get();
  const cur = s.company.currency;
  const begin = store.reconciledBalance();
  openModal({
    title: 'Reconcile account', wide: true,
    body: `<form>
      ${fields([
        { name: 'endDate', label: 'Statement end date', type: 'date', value: today(), required: true },
        { name: 'endBalance', label: 'Statement ending balance', type: 'number', step: '0.01', value: store.bankBalance(), required: true },
      ])}
      <div class="recon-summary" data-summary></div>
      <div class="table-scroll"><table class="table"><thead><tr><th></th><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody data-list></tbody></table></div>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" data-finish disabled>Finish reconciling</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const list = m.querySelector('[data-list]');
      const draw = () => {
        const end = form.elements.endDate.value;
        const rows = s.bankTransactions.filter((t) => !t.reconciled && t.date <= end).sort((a, b) => a.date.localeCompare(b.date));
        list.innerHTML = rows.map((t) => `<tr><td><input type="checkbox" data-tid="${t.id}" checked></td><td>${fmtDate(t.date)}</td>
          <td>${esc(t.description)}</td><td class="num">${money(t.amount, cur)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Nothing to reconcile.</td></tr>';
        sum();
      };
      const sum = () => {
        const cleared = round2(begin + [...list.querySelectorAll('[data-tid]:checked')].reduce((a, cb) => a + store.find('bankTransactions', cb.dataset.tid).amount, 0));
        const diff = round2(Number(form.elements.endBalance.value || 0) - cleared);
        m.querySelector('[data-summary]').innerHTML = `<div><span>Beginning balance</span><strong>${money(begin, cur)}</strong></div>
          <div><span>Cleared balance</span><strong>${money(cleared, cur)}</strong></div>
          <div class="${diff === 0 ? 'ok' : 'bad'}"><span>Difference</span><strong>${money(diff, cur)}</strong></div>`;
        m.querySelector('[data-finish]').disabled = diff !== 0;
      };
      form.elements.endDate.addEventListener('change', draw);
      form.elements.endBalance.addEventListener('input', sum);
      list.addEventListener('change', sum);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const ids = new Set([...list.querySelectorAll('[data-tid]:checked')].map((cb) => cb.dataset.tid));
        const recId = uid();
        s.bankTransactions.forEach((t) => { if (ids.has(t.id)) { t.reconciled = true; t.reconciliationId = recId; } });
        store.save();
        closeModal(); toast(`${ids.size} transactions reconciled`);
      });
      draw();
    },
  });
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const all = [...s.bankTransactions].sort((a, b) => b.date.localeCompare(a.date));
  const review = all.filter((t) => t.status === 'new');
  const rows = tab === 'review' ? review : all.filter((t) => t.status !== 'new');
  return `
    <section class="kpis">
      <div class="card kpi"><span>${esc(s.company.bankName)} · bank balance</span><strong>${money(store.bankBalance(), cur)}</strong></div>
      <div class="card kpi"><span>Reconciled balance</span><strong>${money(store.reconciledBalance(), cur)}</strong></div>
      <div class="card kpi ${review.length ? 'warn' : ''}"><span>To review</span><strong>${review.length}</strong></div>
    </section>
    <div class="toolbar">
      <div class="tabs" style="margin:0"><button class="tab ${tab === 'review' ? 'active' : ''}" data-tab="review">For review (${review.length})</button>
        <button class="tab ${tab === 'posted' ? 'active' : ''}" data-tab="posted">Categorised</button></div>
      <div class="actions wrap"><button class="btn" data-reconcile>Reconcile</button><button class="btn primary" data-import>${icon('plus')} Import / add</button></div>
    </div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Date</th><th>Description</th><th class="hide-sm">${tab === 'review' ? 'Suggestion' : 'Added as'}</th><th class="num">Spent</th><th class="num">Received</th><th></th></tr></thead>
      <tbody>${rows.map((t) => {
        const sug = tab === 'review' ? (() => { const c = candidates(t)[0]; return c && Math.abs(c.balance - Math.abs(t.amount)) < 0.005 ? `Match: ${esc(c.label)}` : `Categorise: ${guessCategory(t)}`; })() : linkLabel(t);
        return `<tr><td>${fmtDate(t.date)}</td><td><strong>${esc(t.description)}</strong>${t.reconciled ? ' <span class="badge badge-paid">R</span>' : ''}<small class="show-sm">${sug}</small></td>
        <td class="hide-sm">${sug}</td>
        <td class="num">${t.amount < 0 ? money(-t.amount, cur) : ''}</td><td class="num">${t.amount > 0 ? money(t.amount, cur) : ''}</td>
        <td class="num">${tab === 'review' ? `<button class="btn primary sm" data-post="${t.id}">Review</button>`
          : t.reconciled ? '' : `<button class="btn sm" data-undo="${t.id}">Undo</button>`}</td></tr>`; }).join('')}</tbody></table></div>`
      : emptyState(tab === 'review' ? 'All caught up — nothing to review.' : 'Nothing categorised yet.')}`;
}

export function mount(root, _p, app) {
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; app.rerender(); }));
  root.querySelector('[data-import]').addEventListener('click', openImport);
  root.querySelector('[data-reconcile]').addEventListener('click', openReconcile);
  root.querySelectorAll('[data-post]').forEach((b) => b.addEventListener('click', () => openPost(store.find('bankTransactions', b.dataset.post))));
  root.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', () => {
    if (confirmDialog('Undo this transaction? The linked entry will be removed.')) store.undoBankTransaction(store.find('bankTransactions', b.dataset.undo));
  }));
}
