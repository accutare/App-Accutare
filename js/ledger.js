// Double-entry general ledger.
// Every source document (invoice, payment, bill, expense, payroll, mileage, manual journal…)
// is turned into balanced journal lines here. All accounting reports read from this.
import { round2, addDays, lineNet } from './utils.js';

export const ACCOUNT_TYPES = {
  bank: { label: 'Bank', group: 'asset' },
  credit_card: { label: 'Credit card', group: 'liability' },
  ar: { label: 'Accounts receivable', group: 'asset' },
  current_asset: { label: 'Current asset', group: 'asset' },
  fixed_asset: { label: 'Fixed asset', group: 'asset' },
  ap: { label: 'Accounts payable', group: 'liability' },
  current_liability: { label: 'Current liability', group: 'liability' },
  long_term_liability: { label: 'Long-term liability', group: 'liability' },
  equity: { label: 'Equity', group: 'equity' },
  income: { label: 'Income', group: 'income' },
  other_income: { label: 'Other income', group: 'income' },
  cost_of_sales: { label: 'Cost of sales', group: 'expense' },
  expense: { label: 'Expense', group: 'expense' },
};

const A = (code, name, type, system) => ({ id: 'acc-' + code, code, name, type, ...(system ? { system } : {}) });

export function defaultAccounts() {
  return [
    A('1100', 'Accounts receivable', 'ar', 'ar'),
    A('1300', 'Stock', 'current_asset'),
    A('1500', 'Equipment & tools', 'fixed_asset'),
    A('2100', 'Accounts payable', 'ap', 'ap'),
    A('2200', 'VAT control', 'current_liability', 'vat'),
    A('2210', 'PAYE & NI payable', 'current_liability', 'paye'),
    A('2220', 'Pension payable', 'current_liability', 'pension'),
    A('2300', "Director's loan account", 'current_liability', 'dla'),
    A('2600', 'Bank loan', 'long_term_liability'),
    A('3000', 'Share capital', 'equity'),
    A('3100', 'Opening balance equity', 'equity', 'obe'),
    A('3200', 'Retained earnings', 'equity', 're'),
    A('4000', 'Sales', 'income', 'sales'),
    A('4900', 'Interest', 'other_income'),
    A('4910', 'Refunds', 'other_income'),
    A('4990', 'Other income', 'other_income', 'other_income'),
    A('5000', 'Materials', 'cost_of_sales'),
    A('5100', 'Subcontractors', 'cost_of_sales'),
    A('6000', 'Advertising', 'expense'),
    A('6010', 'Bank charges', 'expense'),
    A('6020', 'Equipment', 'expense'),
    A('6030', 'Insurance', 'expense'),
    A('6040', 'Office supplies', 'expense'),
    A('6050', 'Professional fees', 'expense'),
    A('6060', 'Rent', 'expense'),
    A('6070', 'Software', 'expense'),
    A('6080', 'Travel', 'expense'),
    A('6090', 'Utilities', 'expense'),
    A('6100', 'Vehicle', 'expense', 'vehicle'),
    A('6200', 'Wages', 'expense', 'wages'),
    A('6210', 'Employer NI', 'expense', 'employer_ni'),
    A('6220', 'Pension contributions', 'expense', 'employer_pension'),
    A('6900', 'Other', 'expense', 'other_expense'),
  ];
}

export const groupOf = (acc) => ACCOUNT_TYPES[acc?.type]?.group;
/** Natural-sign balance: debit-normal for assets/expenses, credit-normal otherwise. */
export const natural = (acc, dr, cr) => (['asset', 'expense'].includes(groupOf(acc)) ? dr - cr : cr - dr);

let cache = { version: -1, entries: [] };

export function journal(s, version) {
  if (cache.version === version) return cache.entries;
  cache = { version, entries: build(s) };
  return cache.entries;
}

function build(s) {
  const bySystem = (k) => s.accounts.find((a) => a.system === k)?.id;
  const byName = (name, fallback) => s.accounts.find((a) => a.name.toLowerCase() === String(name || '').toLowerCase())?.id || bySystem(fallback);
  const banks = s.accounts.filter((a) => a.type === 'bank' || a.type === 'credit_card');
  const defaultBank = banks[0]?.id;
  const txnAccount = (txnId) => s.bankTransactions.find((t) => t.id === txnId)?.accountId;
  const payAccount = (p) => p.accountId || (p.bankTxnId && txnAccount(p.bankTxnId)) || defaultBank;
  const out = [];
  const add = (date, source, memo, lines) => {
    lines = lines.filter((l) => l.accountId && (Math.abs(l.debit || 0) > 0.0001 || Math.abs(l.credit || 0) > 0.0001))
      .map((l) => ({ accountId: l.accountId, debit: round2(l.debit || 0), credit: round2(l.credit || 0), memo: l.memo }));
    if (lines.length) out.push({ date, source, memo, lines });
  };
  const AR = bySystem('ar'), AP = bySystem('ap'), VAT = bySystem('vat');

  // Opening balances of bank / card accounts
  for (const b of banks) {
    const ob = Number(b.openingBalance || 0);
    if (!ob) continue;
    const isCard = b.type === 'credit_card';
    add(b.openingDate || '1900-01-01', { type: 'account', id: b.id }, `Opening balance · ${b.name}`, [
      { accountId: b.id, debit: isCard ? 0 : ob, credit: isCard ? ob : 0 },
      { accountId: bySystem('obe'), debit: isCard ? ob : 0, credit: isCard ? 0 : ob },
    ]);
  }

  for (const inv of s.invoices) {
    if (inv.draft) continue;
    const rate = Number(inv.rate || 1);
    let net = 0, vat = 0;
    for (const l of inv.lines) { const n = lineNet(l); net += n; vat += round2(n * (l.vatRate || 0) / 100); }
    net = round2(net * rate); vat = round2(vat * rate);
    const cust = s.customers.find((c) => c.id === inv.customerId)?.name || '';
    add(inv.date, { type: 'invoice', id: inv.id }, `Invoice #${inv.number} · ${cust}`, [
      { accountId: AR, debit: net + vat },
      { accountId: bySystem('sales'), credit: net },
      { accountId: VAT, credit: vat },
    ]);
    for (const p of inv.payments || []) {
      if (p.creditId) continue; // credit note / deposit applied: AR to AR, nothing to post
      const amt = round2(p.amount * rate);
      add(p.date, { type: 'invoice', id: inv.id }, `Payment · invoice #${inv.number}`, [
        { accountId: payAccount(p), debit: amt }, { accountId: AR, credit: amt }]);
    }
  }

  const linesNetVat = (lines) => {
    let net = 0, vat = 0;
    for (const l of lines || []) { const n = lineNet(l); net += n; vat += round2(n * (l.vatRate || 0) / 100); }
    return [round2(net), round2(vat)];
  };
  for (const cn of s.creditNotes || []) {
    const cust = s.customers.find((c) => c.id === cn.customerId)?.name || '';
    if (cn.type === 'deposit') {
      add(cn.date, { type: 'credit', id: cn.id }, `Payment received · ${cust}`, [
        { accountId: cn.accountId || defaultBank, debit: cn.amount }, { accountId: AR, credit: cn.amount }]);
    } else {
      const [net, vat] = linesNetVat(cn.lines);
      add(cn.date, { type: 'credit', id: cn.id }, `Credit note ${cn.number} · ${cust}`, [
        { accountId: bySystem('sales'), debit: net }, { accountId: VAT, debit: vat }, { accountId: AR, credit: net + vat }]);
    }
    for (const r of cn.refunds || []) {
      add(r.date, { type: 'credit', id: cn.id }, `Refund · ${cust}`, [{ accountId: AR, debit: r.amount }, { accountId: r.accountId || defaultBank, credit: r.amount }]);
    }
  }
  for (const sr of s.salesReceipts || []) {
    const [net, vat] = linesNetVat(sr.lines);
    const cust = s.customers.find((c) => c.id === sr.customerId)?.name || 'Cash sale';
    add(sr.date, { type: 'receipt', id: sr.id, projectId: sr.projectId }, `Sales receipt ${sr.number} · ${cust}`, [
      { accountId: sr.accountId || defaultBank, debit: net + vat }, { accountId: bySystem('sales'), credit: net }, { accountId: VAT, credit: vat }]);
  }

  for (const b of s.bills) {
    const vend = s.vendors.find((v) => v.id === b.vendorId)?.name || '';
    const lines = [];
    let total = 0;
    for (const l of b.lines) {
      const net = round2(l.amount), vat = round2(net * (l.vatRate || 0) / 100);
      total += net + vat;
      lines.push({ accountId: byName(l.category, 'other_expense'), debit: net, memo: l.description }, { accountId: VAT, debit: vat });
    }
    add(b.date, { type: 'bill', id: b.id }, `Bill ${b.number || ''} · ${vend}`, [...lines, { accountId: AP, credit: round2(total) }]);
    for (const p of b.payments || []) {
      if (p.vendorCreditId) continue;
      add(p.date, { type: 'bill', id: b.id }, `Bill payment · ${vend}`, [{ accountId: AP, debit: p.amount }, { accountId: payAccount(p), credit: p.amount }]);
    }
  }

  for (const vc of s.vendorCredits || []) {
    const vend = s.vendors.find((v) => v.id === vc.vendorId)?.name || '';
    const lines = []; let total = 0;
    for (const l of vc.lines) {
      const net = round2(l.amount), vat = round2(net * (l.vatRate || 0) / 100);
      total += net + vat;
      lines.push({ accountId: byName(l.category, 'other_expense'), credit: net, memo: l.description }, { accountId: VAT, credit: vat });
    }
    add(vc.date, { type: 'vendorCredit', id: vc.id }, `Supplier credit ${vc.number || ''} · ${vend}`, [{ accountId: AP, debit: round2(total) }, ...lines]);
  }

  for (const e of s.expenses) {
    const vat = Number(e.vat || 0), net = round2(Number(e.amount) - vat);
    const from = e.accountId || (e.bankTxnId && txnAccount(e.bankTxnId)) || (e.method === 'Personal funds' ? bySystem('dla') : defaultBank);
    add(e.date, { type: 'expense', id: e.id }, `Expense · ${e.payee}`, [
      { accountId: byName(e.category, 'other_expense'), debit: net }, { accountId: VAT, debit: vat }, { accountId: from, credit: Number(e.amount) }]);
  }

  for (const r of s.otherIncome) {
    const vat = Number(r.vat || 0);
    const to = r.accountId || (r.bankTxnId && txnAccount(r.bankTxnId)) || defaultBank;
    add(r.date, { type: 'income', id: r.id }, r.description, [
      { accountId: to, debit: Number(r.amount) }, { accountId: byName(r.category, 'other_income'), credit: round2(r.amount - vat) }, { accountId: VAT, credit: vat }]);
  }

  // Bank lines posted straight to an account ("transfer" / "journal" from banking)
  for (const t of s.bankTransactions) {
    if (t.link?.type !== 'account') continue;
    const amt = Math.abs(t.amount);
    add(t.date, { type: 'bank', id: t.id }, t.description, t.amount > 0
      ? [{ accountId: t.accountId, debit: amt }, { accountId: t.link.id, credit: amt }]
      : [{ accountId: t.link.id, debit: amt }, { accountId: t.accountId, credit: amt }]);
  }

  for (const run of s.payRuns) {
    let gross = 0, tax = 0, eeNI = 0, erNI = 0, eePen = 0, erPen = 0, net = 0;
    for (const l of run.lines) { gross += l.gross; tax += l.tax; eeNI += l.eeNI; erNI += l.erNI; eePen += l.eePension; erPen += l.erPension; net += l.net; }
    add(run.date, { type: 'payrun', id: run.id }, `Payroll · ${run.period}`, [
      { accountId: bySystem('wages'), debit: gross },
      { accountId: bySystem('employer_ni'), debit: erNI },
      { accountId: bySystem('employer_pension'), debit: erPen },
      { accountId: run.accountId || defaultBank, credit: net },
      { accountId: bySystem('paye'), credit: tax + eeNI + erNI },
      { accountId: bySystem('pension'), credit: eePen + erPen },
    ]);
  }

  for (const t of s.trips) {
    if (!t.claim) continue;
    add(t.date, { type: 'trip', id: t.id }, `Mileage · ${t.purpose || ''}`, [
      { accountId: bySystem('vehicle'), debit: t.claim }, { accountId: bySystem('dla'), credit: t.claim }]);
  }

  for (const j of s.journals) {
    add(j.date, { type: 'journal', id: j.id }, j.memo || `Journal ${j.number || ''}`, j.lines.map((l) => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })));
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** { accountId: { debit, credit } } for entries with from <= date <= to */
export function totals(entries, from = '0000', to = '9999') {
  const t = {};
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    for (const l of e.lines) {
      const x = (t[l.accountId] ||= { debit: 0, credit: 0 });
      x.debit += l.debit; x.credit += l.credit;
    }
  }
  return t;
}

export function balanceOf(accounts, t, id) {
  const acc = accounts.find((a) => a.id === id);
  const x = t[id] || { debit: 0, credit: 0 };
  return round2(natural(acc, x.debit, x.credit));
}

export function profitAndLoss(accounts, entries, from, to) {
  const t = totals(entries, from, to);
  const pick = (types) => accounts.filter((a) => types.includes(a.type))
    .map((a) => ({ account: a, amount: balanceOf(accounts, t, a.id) })).filter((r) => r.amount !== 0);
  const income = pick(['income']), otherIncome = pick(['other_income']), cos = pick(['cost_of_sales']), expenses = pick(['expense']);
  const sum = (rows) => round2(rows.reduce((s, r) => s + r.amount, 0));
  const totalIncome = round2(sum(income) + sum(otherIncome));
  const grossProfit = round2(sum(income) - sum(cos));
  const totalExpenses = round2(sum(cos) + sum(expenses));
  return { income, otherIncome, cos, expenses, totalIncome, grossProfit, totalExpenses, net: round2(totalIncome - totalExpenses) };
}

export function balanceSheet(accounts, entries, asOf, fyStart) {
  const t = totals(entries, '0000', asOf);
  const rows = (group) => accounts.filter((a) => groupOf(a) === group)
    .map((a) => ({ account: a, amount: balanceOf(accounts, t, a.id) })).filter((r) => r.amount !== 0);
  const assets = rows('asset'), liabilities = rows('liability'), equity = rows('equity');
  const prior = profitAndLoss(accounts, entries, '0000', addDays(fyStart, -1)).net;
  const current = profitAndLoss(accounts, entries, fyStart, asOf).net;
  const sum = (r) => round2(r.reduce((s, x) => s + x.amount, 0));
  const totalEquity = round2(sum(equity) + prior + current);
  return { assets, liabilities, equity, priorEarnings: prior, currentEarnings: current,
    totalAssets: sum(assets), totalLiabilities: sum(liabilities), totalEquity,
    balanced: Math.abs(sum(assets) - sum(liabilities) - totalEquity) < 0.01 };
}

export function trialBalance(accounts, entries, asOf) {
  const t = totals(entries, '0000', asOf);
  const rows = accounts.map((a) => {
    const x = t[a.id] || { debit: 0, credit: 0 };
    const net = round2(x.debit - x.credit);
    return { account: a, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  }).filter((r) => r.debit || r.credit);
  return { rows, debit: round2(rows.reduce((s, r) => s + r.debit, 0)), credit: round2(rows.reduce((s, r) => s + r.credit, 0)) };
}

export function generalLedger(accounts, entries, accountId, from, to) {
  const acc = accounts.find((a) => a.id === accountId);
  const open = balanceOf(accounts, totals(entries, '0000', addDays(from, -1)), accountId);
  let bal = open;
  const rows = [];
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    for (const l of e.lines) {
      if (l.accountId !== accountId) continue;
      bal = round2(bal + natural(acc, l.debit, l.credit));
      rows.push({ date: e.date, memo: l.memo || e.memo, source: e.source, debit: l.debit, credit: l.credit, balance: bal });
    }
  }
  return { account: acc, opening: open, rows, closing: bal };
}

/** Indirect-method cash flow statement. "Cash" = bank accounts. */
export function cashFlow(accounts, entries, from, to) {
  const before = totals(entries, '0000', addDays(from, -1));
  const after = totals(entries, '0000', to);
  const delta = (a) => round2(balanceOf(accounts, after, a.id) - balanceOf(accounts, before, a.id));
  const net = profitAndLoss(accounts, entries, from, to).net;
  const lines = { operating: [], investing: [], financing: [] };
  for (const a of accounts) {
    const d = delta(a);
    if (!d || a.type === 'bank' || ['income', 'expense'].includes(groupOf(a))) continue;
    if (['ar', 'current_asset'].includes(a.type)) lines.operating.push({ label: a.name, amount: -d });
    else if (['ap', 'current_liability', 'credit_card'].includes(a.type)) lines.operating.push({ label: a.name, amount: d });
    else if (a.type === 'fixed_asset') lines.investing.push({ label: a.name, amount: -d });
    else lines.financing.push({ label: a.name, amount: d });
  }
  const sum = (r) => round2(r.reduce((s, x) => s + x.amount, 0));
  const operating = round2(net + sum(lines.operating));
  const investing = sum(lines.investing), financing = sum(lines.financing);
  const cashAccts = accounts.filter((a) => a.type === 'bank');
  const openCash = round2(cashAccts.reduce((s, a) => s + balanceOf(accounts, before, a.id), 0));
  const closeCash = round2(cashAccts.reduce((s, a) => s + balanceOf(accounts, after, a.id), 0));
  return { net, lines, operating, investing, financing, openCash, closeCash, change: round2(operating + investing + financing) };
}
