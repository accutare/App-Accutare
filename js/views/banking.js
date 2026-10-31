import * as store from '../store.js';
import { money, esc, fmtDate, today, icon, round2, uid } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState } from '../ui.js';
import { openAccountForm } from './accounts.js';

export const title = 'Banking';

let tab = 'review';
let acctId = null;
const currentAccount = () => { const list = store.bankAccounts(); if (!list.find((a) => a.id === acctId)) acctId = list[0]?.id; return store.find('accounts', acctId); };

function linkLabel(t) {
  const l = t.link;
  if (t.status === 'excluded') return '<span class="muted">Excluded</span>';
  if (!l) return '';
  if (l.type === 'expense') { const e = store.find('expenses', l.id); return `Expense · ${esc(e?.category || '')}`; }
  if (l.type === 'otherIncome') { const r = store.find('otherIncome', l.id); return `Income · ${esc(r?.category || '')}`; }
  if (l.type === 'invoices') { const i = store.find('invoices', l.id); return `<a href="#/invoices/${l.id}">Payment · invoice #${esc(i?.number)}</a>`; }
  if (l.type === 'split') return `Split · ${l.items.length} lines`;
  if (l.type === 'account') return `Transfer / journal · ${esc(store.find('accounts', l.id)?.name || '')}`;
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
  const rule = store.matchRule(t);
  if (rule?.action === 'categorise') return rule.category;
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
  const cats = isIn ? store.incomeCategories() : store.expenseCategories();
  openModal({
    title: `${isIn ? 'Money in' : 'Money out'} · ${money(Math.abs(t.amount), co.currency)}`,
    body: `
      <p><strong>${esc(t.description)}</strong><br><span class="muted">${fmtDate(t.date)}</span></p>
      <div class="tabs"><button class="tab ${exact ? '' : 'active'}" data-mode="categorise">Categorise</button>
        <button class="tab ${exact ? 'active' : ''}" data-mode="match" ${cands.length ? '' : 'disabled'}>Match ${isIn ? 'invoice' : 'bill'} (${cands.length})</button>
        <button class="tab" data-mode="transfer">Transfer / other</button></div>
      <form data-form="categorise" ${exact ? 'hidden' : ''}>
        ${fields([
          ...(isIn ? [] : [{ name: 'payee', label: 'Payee', value: t.description }]),
          { name: 'category', label: 'Category', type: 'select', options: cats, value: guessCategory(t) },
          { name: 'vat', label: 'VAT included', type: 'number', step: '0.01', value: 0 },
        ])}
        <button type="button" class="link-btn" data-calc-vat>Calculate VAT at ${co.vatRate}%</button> · <button type="button" class="link-btn" data-split>Split into several categories</button>
        <div data-split-box hidden><table class="table lines"><thead><tr><th>Category</th><th>Amount (incl. VAT)</th><th>VAT</th><th>Memo</th><th></th></tr></thead><tbody data-splits></tbody></table>
          <button type="button" class="btn ghost sm" data-add-split>${icon('plus', 16)} Add split</button> <span class="muted small" data-split-left></span></div>
        <footer class="modal-foot"><button type="button" class="btn ghost" data-make-rule>Create rule</button><button type="button" class="btn ghost" data-exclude>Exclude</button><button class="btn primary">Add</button></footer>
      </form>
      <form data-form="match" ${exact ? '' : 'hidden'}>
        <div class="choice-list">${cands.map((c, i) => `<label class="choice"><input type="radio" name="id" value="${c.id}" ${(exact ? c === exact : i === 0) ? 'checked' : ''}>
          <span>${esc(c.label)}</span><strong>${money(c.balance, co.currency)}</strong></label>`).join('')}</div>
        <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Match</button></footer>
      </form>
      <form data-form="transfer" hidden>
        <p class="muted small">Use for transfers between your own accounts, credit card repayments, loans, VAT/PAYE payments to HMRC, money you put in or take out.</p>
        ${fields([{ name: 'accountId', label: isIn ? 'Money came from' : 'Money went to', type: 'select',
          options: store.get().accounts.filter((a) => a.id !== t.accountId && !['income', 'other_income', 'expense', 'cost_of_sales', 'ar', 'ap'].includes(a.type) && !a.inactive).map((a) => [a.id, `${a.code} ${a.name}`]) }])}
        <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Record</button></footer>
      </form>`,
    onMount(m) {
      m.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        m.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === b));
        m.querySelector('[data-form=categorise]').hidden = b.dataset.mode !== 'categorise';
        m.querySelector('[data-form=match]').hidden = b.dataset.mode !== 'match';
        m.querySelector('[data-form=transfer]').hidden = b.dataset.mode !== 'transfer';
      }));
      const cf = m.querySelector('[data-form=categorise]');
      cf.querySelector('[data-calc-vat]').addEventListener('click', () => {
        const g = Math.abs(t.amount);
        cf.elements.vat.value = round2(g - g / (1 + co.vatRate / 100)).toFixed(2);
      });
      cf.querySelector('[data-exclude]').addEventListener('click', () => { store.postBankTransaction(t, 'exclude'); closeModal(); });
      cf.querySelector('[data-make-rule]').addEventListener('click', () => {
        const d = readForm(cf);
        closeModal();
        openRuleForm(null, { name: t.description.slice(0, 30), text: t.description.split(/\s+/).slice(0, 2).join(' '), direction: t.amount < 0 ? 'out' : 'in', action: 'categorise', category: d.category, payee: d.payee });
      });
      const sbox = cf.querySelector('[data-split-box]'), sbody = cf.querySelector('[data-splits]');
      const splitRow = (amt = '') => `<tr><td><select data-k="category">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></td>
        <td><input data-k="amount" type="number" step="0.01" value="${amt}"></td><td><input data-k="vat" type="number" step="0.01" value="0"></td><td><input data-k="memo"></td>
        <td><button type="button" class="icon-btn" data-rm-split>${icon('trash', 16)}</button></td></tr>`;
      const readSplits = () => [...sbody.querySelectorAll('tr')].map((tr) => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.type === 'number' ? Number(el.value || 0) : el.value])));
      const leftover = () => round2(Math.abs(t.amount) - readSplits().reduce((a, x) => a + x.amount, 0));
      const showLeft = () => { cf.querySelector('[data-split-left]').textContent = leftover() ? `${money(leftover(), co.currency)} left to assign` : 'Fully assigned ✓'; };
      cf.querySelector('[data-split]').addEventListener('click', () => {
        sbox.hidden = !sbox.hidden;
        if (!sbox.hidden && !sbody.children.length) sbody.innerHTML = splitRow(Math.abs(t.amount)) + splitRow(0);
        cf.elements.category.closest('.field').hidden = !sbox.hidden;
        cf.elements.vat.closest('.field').hidden = !sbox.hidden;
        showLeft();
      });
      cf.querySelector('[data-add-split]').addEventListener('click', () => { sbody.insertAdjacentHTML('beforeend', splitRow(leftover())); showLeft(); });
      sbody.addEventListener('input', showLeft);
      sbody.addEventListener('click', (e) => { if (e.target.closest('[data-rm-split]')) { e.target.closest('tr').remove(); showLeft(); } });
      cf.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!sbox.hidden) {
          const splits = readSplits().filter((x) => x.amount);
          if (leftover()) return toast('The split amounts must add up to the transaction');
          store.postBankTransaction(t, 'categorise', { ...readForm(cf), splits });
          closeModal(); toast('Split added to your books'); return;
        }
        store.postBankTransaction(t, 'categorise', readForm(cf));
        closeModal(); toast('Added to your books');
      });
      m.querySelector('[data-form=transfer]').addEventListener('submit', (e) => {
        e.preventDefault();
        store.postBankTransaction(t, 'account', readForm(e.target));
        closeModal(); toast('Recorded');
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
    title: `Import into ${currentAccount()?.name}`,
    body: `<p class="muted">Upload a CSV exported from your online banking. Columns needed: date, description and either <em>amount</em> or <em>paid in / paid out</em>. Duplicates are skipped.</p>
      <label class="btn">Choose CSV / OFX / QFX file<input type="file" accept=".csv,.ofx,.qfx,text/csv" data-file hidden></label>
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
        const text = await f.text();
        const list = /<OFX>|<STMTTRN>/i.test(text) ? store.parseOFX(text) : store.parseBankCsv(text);
        if (!list.length) return toast('No transactions found in that file');
        const n = store.importBankTransactions(list, acctId);
        closeModal(); toast(`${n} transaction${n === 1 ? '' : 's'} imported`);
      });
      m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(e.target);
        if (!d.amount) return toast('Enter an amount');
        store.importBankTransactions([{ ...d, amount: round2(d.amount) }], acctId);
        closeModal();
      });
    },
  });
}

function openReconcile() {
  const s = store.get();
  const cur = s.company.currency;
  const begin = store.reconciledBalance(acctId);
  openModal({
    title: `Reconcile ${currentAccount()?.name}`, wide: true,
    body: `<form>
      ${fields([
        { name: 'endDate', label: 'Statement end date', type: 'date', value: today(), required: true },
        { name: 'endBalance', label: 'Statement ending balance', type: 'number', step: '0.01', value: store.bankBalance(acctId), required: true },
      ])}
      <div class="recon-summary" data-summary></div>
      <div class="table-scroll"><table class="table"><thead><tr><th></th><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody data-list></tbody></table></div>
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" data-finish disabled>Finish reconciling</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const list = m.querySelector('[data-list]');
      const draw = () => {
        const end = form.elements.endDate.value;
        const rows = s.bankTransactions.filter((t) => t.accountId === acctId && !t.reconciled && t.date <= end).sort((a, b) => a.date.localeCompare(b.date));
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

function bookBalance(id) {
  const g = store.journal();
  let b = 0;
  for (const e of g) for (const l of e.lines) if (l.accountId === id) b += l.debit - l.credit;
  return store.find('accounts', id)?.type === 'credit_card' ? round2(b) : round2(b);
}

function bankHeaderHtml(s, acc, cur) {
  return `    <section class="bank-cards">${store.bankAccounts().map((a) => { const n = s.bankTransactions.filter((t) => t.accountId === a.id && t.status === 'new').length; return `
      <button class="card bank-card ${a.id === acc.id ? 'active' : ''}" data-acct="${a.id}"><span>${a.type === 'credit_card' ? 'Credit card' : 'Bank'}</span><strong>${esc(a.name)}</strong>
        <em>${money(store.bankBalance(a.id), cur)}</em>${n ? `<small class="badge badge-overdue">${n} to review</small>` : '<small class="muted">Up to date</small>'}</button>`; }).join('')}
      <button class="card bank-card add" data-add-acct>${icon('plus')}<span>Add account</span></button></section>
    <section class="kpis">
      <div class="card kpi"><span>Bank balance (statement)</span><strong>${money(store.bankBalance(acc.id), cur)}</strong></div>
      <div class="card kpi"><span>In your books</span><strong>${money(bookBalance(acc.id), cur)}</strong></div>
      <div class="card kpi"><span>Reconciled balance</span><strong>${money(store.reconciledBalance(acc.id), cur)}</strong></div>
    </section>
    `;
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const acc = currentAccount();
  if (!acc) return emptyState('No bank accounts. Add one to start.') + '<p style="text-align:center"><button class="btn primary" data-add-acct>Add bank account</button></p>';
  const bankHeader = () => bankHeaderHtml(s, acc, cur);
  const all = s.bankTransactions.filter((t) => t.accountId === acc.id).sort((a, b) => b.date.localeCompare(a.date));
  const review = all.filter((t) => t.status === 'new');
  const rows = tab === 'review' ? review : all.filter((t) => t.status !== 'new');
  const rulesHtml = () => `<div class="toolbar"><span class="muted">Rules categorise matching bank lines for you. Turn on “add automatically” to skip the review.</span>
    <div class="actions"><button class="btn" data-run-rules>Apply rules to “For review”</button><button class="btn primary" data-new-rule>${icon('plus')} New rule</button></div></div>
    ${s.bankRules.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Rule</th><th>When description contains</th><th>Then</th><th>Auto-add</th></tr></thead>
    <tbody>${s.bankRules.map((r) => `<tr data-rule="${r.id}"><td><strong>${esc(r.name)}</strong>${r.active === false ? ' <span class="muted">(off)</span>' : ''}</td><td>${esc(r.text)} · ${r.direction === 'in' ? 'money in' : r.direction === 'out' ? 'money out' : 'any'}</td>
      <td>${r.action === 'transfer' ? `Transfer to ${esc(store.find('accounts', r.targetAccountId)?.name || '')}` : r.action === 'exclude' ? 'Exclude' : `Categorise as ${esc(r.category)}${r.vatRate ? ` (VAT ${r.vatRate}%)` : ''}`}</td>
      <td>${r.autoAdd ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No rules yet. Tip: when reviewing a transaction, click “Create rule”.')}`;
  const tabsBar = `<div class="toolbar"><div class="tabs" style="margin:0"><button class="tab" data-tab="review">For review (${review.length})</button><button class="tab" data-tab="posted">Categorised</button><button class="tab active" data-tab="rules">Rules (${s.bankRules.length})</button></div></div>`;
  if (tab === 'rules') return bankHeader() + tabsBar + rulesHtml();
  return bankHeader() + `
    <div class="toolbar">
      <div class="tabs" style="margin:0"><button class="tab ${tab === 'review' ? 'active' : ''}" data-tab="review">For review (${review.length})</button>
        <button class="tab ${tab === 'posted' ? 'active' : ''}" data-tab="posted">Categorised</button>
        <button class="tab ${tab === 'rules' ? 'active' : ''}" data-tab="rules">Rules (${s.bankRules.length})</button></div>
      <div class="actions wrap"><button class="btn" data-reconcile>Reconcile</button><button class="btn primary" data-import>${icon('plus')} Import / add</button></div>
    </div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Date</th><th>Description</th><th class="hide-sm">${tab === 'review' ? 'Suggestion' : 'Added as'}</th><th class="num">Spent</th><th class="num">Received</th><th></th></tr></thead>
      <tbody>${rows.map((t) => {
        const sug = tab === 'review' ? (() => { const c = candidates(t)[0]; const r = store.matchRule(t); if (r) return `Rule “${esc(r.name)}”: ${r.action === 'transfer' ? 'transfer' : r.action === 'exclude' ? 'exclude' : esc(r.category)}`; return c && Math.abs(c.balance - Math.abs(t.amount)) < 0.005 ? `Match: ${esc(c.label)}` : `Categorise: ${guessCategory(t)}`; })() : linkLabel(t);
        return `<tr><td>${fmtDate(t.date)}</td><td><strong>${esc(t.description)}</strong>${t.reconciled ? ' <span class="badge badge-paid">R</span>' : ''}<small class="show-sm">${sug}</small></td>
        <td class="hide-sm">${sug}</td>
        <td class="num">${t.amount < 0 ? money(-t.amount, cur) : ''}</td><td class="num">${t.amount > 0 ? money(t.amount, cur) : ''}</td>
        <td class="num">${tab === 'review' ? `<button class="btn primary sm" data-post="${t.id}">Review</button>`
          : t.reconciled ? '' : `<button class="btn sm" data-undo="${t.id}">Undo</button>`}</td></tr>`; }).join('')}</tbody></table></div>`
      : emptyState(tab === 'review' ? 'All caught up — nothing to review.' : 'Nothing categorised yet.')}`;
}

export function openRuleForm(existing, preset = {}) {
  const s = store.get();
  const r = existing || { direction: 'out', action: 'categorise', autoAdd: false, active: true, vatRate: 0, ...preset };
  openModal({
    title: existing ? 'Edit rule' : 'New bank rule',
    body: `<form>${fields([
      { name: 'name', label: 'Rule name', required: true, full: true },
      { name: 'text', label: 'Description contains (use | for “or”)', required: true, placeholder: 'e.g. shell | bp | esso' },
      { name: 'direction', label: 'Applies to', type: 'select', options: [['out', 'Money out'], ['in', 'Money in'], ['any', 'Both']] },
      { name: 'minAmount', label: 'Min amount (optional)', type: 'number', step: '0.01' }, { name: 'maxAmount', label: 'Max amount (optional)', type: 'number', step: '0.01' },
      { name: 'accountId', label: 'Only for account', type: 'select', options: [['', 'All bank accounts'], ...store.bankAccounts().map((a) => [a.id, a.name])] },
      { name: 'action', label: 'Then', type: 'select', options: [['categorise', 'Categorise'], ['transfer', 'Record as transfer / other account'], ['exclude', 'Exclude']] },
      { name: 'category', label: 'Category', type: 'select', options: [...store.expenseCategories(), ...store.incomeCategories()] },
      { name: 'vatRate', label: 'VAT % included', type: 'number', step: 'any' },
      { name: 'payee', label: 'Payee name (optional)' },
      { name: 'targetAccountId', label: 'Transfer account', type: 'select', options: s.accounts.filter((a) => ['bank', 'credit_card', 'current_liability', 'long_term_liability', 'equity', 'current_asset'].includes(a.type)).map((a) => [a.id, `${a.code} ${a.name}`]) },
      { name: 'autoAdd', label: 'Add automatically (skip review)', type: 'select', options: [['', 'No – suggest only'], ['1', 'Yes']] },
      { name: 'active', label: 'Status', type: 'select', options: [['1', 'On'], ['', 'Off']] },
    ], { ...r, autoAdd: r.autoAdd ? '1' : '', active: r.active === false ? '' : '1' })}
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}<button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save rule</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const sync = () => { const a = form.elements.action.value;
        ['category', 'vatRate', 'payee'].forEach((n) => { form.elements[n].closest('.field').hidden = a !== 'categorise'; });
        form.elements.targetAccountId.closest('.field').hidden = a !== 'transfer'; };
      form.elements.action.addEventListener('change', sync); sync();
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete rule?')) { store.remove('bankRules', existing.id); closeModal(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        store.upsert('bankRules', { ...(existing || {}), ...d, autoAdd: d.autoAdd === '1', active: d.active === '1' });
        closeModal(); toast('Rule saved');
      });
    },
  });
}

export function mount(root, _p, app) {
  root.querySelector('[data-new-rule]')?.addEventListener('click', () => openRuleForm());
  root.querySelectorAll('[data-rule]').forEach((tr) => tr.addEventListener('click', () => openRuleForm(store.find('bankRules', tr.dataset.rule))));
  root.querySelector('[data-run-rules]')?.addEventListener('click', () => {
    let n = 0;
    for (const t of store.get().bankTransactions.filter((x) => x.status === 'new' && x.accountId === acctId)) { const r = store.matchRule(t); if (r) { store.applyRule(t, r); n++; } }
    toast(`${n} transaction(s) added by rules`);
  });
  root.querySelectorAll('[data-acct]').forEach((b) => b.addEventListener('click', () => { acctId = b.dataset.acct; app.rerender(); }));
  root.querySelectorAll('[data-add-acct]').forEach((b) => b.addEventListener('click', () => openAccountForm({ name: '', type: 'bank', code: '' }, true)));
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; app.rerender(); }));
  if (!root.querySelector('[data-import]')) return;
  root.querySelector('[data-import]').addEventListener('click', openImport);
  root.querySelector('[data-reconcile]').addEventListener('click', openReconcile);
  root.querySelectorAll('[data-post]').forEach((b) => b.addEventListener('click', () => openPost(store.find('bankTransactions', b.dataset.post))));
  root.querySelectorAll('[data-undo]').forEach((b) => b.addEventListener('click', () => {
    if (confirmDialog('Undo this transaction? The linked entry will be removed.')) store.undoBankTransaction(store.find('bankTransactions', b.dataset.undo));
  }));
}
