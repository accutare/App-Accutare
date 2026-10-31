// Data layer. Everything lives in localStorage so the app works offline with no backend.
// Swap these functions for API calls later if you add a server.
import { uid, today, addDays, round2, lineNet } from './utils.js';
import * as L from './ledger.js';
import { runRecurring } from './recurring.js';

const KEY = 'accutare:v1';
let state = null;
const listeners = new Set();

function defaults() {
  return {
    company: {
      name: 'Accurate ACS',
      email: 'support@accurateacs.co.uk',
      phone: '',
      address: '',
      vatNumber: '',
      currency: 'GBP',
      vatRate: 20,
      paymentTerms: 30,
      nextInvoiceNumber: 1001,
      nextEstimateNumber: 1,
      logo: '',
      accentColor: '#0f766e',
      paymentDetails: '',
      paymentLink: '',
      reminderDays: 7,
      fyStartMonth: 4,
      fyStartDay: 6,
      vatScheme: 'standard',
      mileageVehicle: 'car',
      nextJournalNumber: 1,
      nextCreditNumber: 1,
      nextReceiptNumber: 1,
      nextPONumber: 1,
    },
    accounts: [...L.defaultAccounts(), bankAccountDefaults()],
    journals: [],
    recurring: [],
    timeEntries: [],
    trips: [],
    projects: [],
    employees: [],
    payRuns: [],
    stockAdjustments: [],
    creditNotes: [],
    salesReceipts: [],
    vendorCredits: [],
    purchaseOrders: [],
    bankRules: [],
    vatReturns: [],
    users: [],
    customers: [],
    vendors: [],
    products: [],
    invoices: [],
    estimates: [],
    bills: [],
    expenses: [],
    otherIncome: [],
    bankTransactions: [],
  };
}

// Legacy list (categories now come from the chart of accounts).
const OLD_EXPENSE_CATEGORIES = [
  'Advertising', 'Bank charges', 'Equipment', 'Insurance', 'Materials',
  'Office supplies', 'Professional fees', 'Rent', 'Software', 'Travel',
  'Utilities', 'Vehicle', 'Wages', 'Other',
];

export const expenseCategories = () => state.accounts.filter((a) => ['expense', 'cost_of_sales'].includes(a.type) && !a.inactive).map((a) => a.name);
export const incomeCategories = () => state.accounts.filter((a) => ['income', 'other_income'].includes(a.type) && !a.inactive).map((a) => a.name);
export const bankAccounts = () => state.accounts.filter((a) => (a.type === 'bank' || a.type === 'credit_card') && !a.inactive);

export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state) { state = defaults(); seedDemo(state); persist(); }
  else state = migrate(state);
  if (runRecurring(state)) persist();
  return state;
}

// Fill in collections/settings added in newer versions.
function bankAccountDefaults(name = 'Business current account', openingBalance = 0) {
  return { id: 'acc-1200', code: '1200', name, type: 'bank', openingBalance, openingDate: '' };
}

function migrate(old) {
  const d = defaults();
  const s = { ...d, ...old, company: { ...d.company, ...old.company } };
  if (!old.accounts) {
    // v1/v2 data: single bank kept in company settings
    s.accounts = [...L.defaultAccounts(), bankAccountDefaults(old.company?.bankName || 'Business current account', Number(old.company?.openingBalance || 0))];
  }
  const firstBank = s.accounts.find((a) => a.type === 'bank')?.id;
  s.bankTransactions.forEach((t) => { t.accountId ||= firstBank; });
  return s;
}

export const get = () => state;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ } };

let version = 0;
let remote = null;
export function setRemote(fn) { remote = fn; }
export function save() { version++; persist(); remote?.(state); listeners.forEach((fn) => fn()); }
/** Replace everything with data from the server (does not push back). */
export function replaceState(data) {
  state = migrate(data);
  const created = runRecurring(state);
  version++; persist();
  if (created) remote?.(state);
  listeners.forEach((fn) => fn());
}
export const journal = () => L.journal(state, version);
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function find(coll, id) { return state[coll].find((x) => x.id === id); }

export function upsert(coll, item) {
  if (item.id && find(coll, item.id)) {
    const i = state[coll].findIndex((x) => x.id === item.id);
    state[coll][i] = { ...state[coll][i], ...item, updatedAt: new Date().toISOString() };
    save();
    return state[coll][i];
  }
  const created = { ...item, id: item.id || uid(), createdAt: new Date().toISOString() };
  state[coll].push(created);
  save();
  return created;
}

export function remove(coll, id) {
  state[coll] = state[coll].filter((x) => x.id !== id);
  save();
}

export function updateCompany(patch) { state.company = { ...state.company, ...patch }; save(); }

export function nextInvoiceNumber() {
  const n = state.company.nextInvoiceNumber;
  state.company.nextInvoiceNumber = n + 1;
  return String(n);
}

export function exportJSON() { return JSON.stringify(state, null, 2); }
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data.company || !Array.isArray(data.invoices)) throw new Error('Invalid backup file');
  state = migrate(data);
  save();
}
export function reset(withDemo) {
  state = defaults();
  if (withDemo) seedDemo(state);
  save();
}

// ---------- Business logic ----------

export function invoiceTotals(inv) {
  let subtotal = 0, vat = 0;
  for (const l of inv.lines || []) {
    const net = lineNet(l);
    subtotal += net;
    vat += round2(net * (Number(l.vatRate) || 0) / 100);
  }
  subtotal = round2(subtotal); vat = round2(vat);
  const total = round2(subtotal + vat);
  const paid = round2((inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
  return { subtotal, vat, total, paid, balance: round2(total - paid) };
}

export const rateOf = (inv) => Number(inv.rate || 1);
/** Invoice totals converted to the company's home currency. */
export function invoiceTotalsHome(inv) {
  const t = invoiceTotals(inv), r = rateOf(inv);
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, round2(v * r)]));
}
export const invoiceCurrency = (inv) => inv.currency || state.company.currency;

// draft | open | partial | overdue | paid
export function invoiceStatus(inv) {
  if (inv.draft) return 'draft';
  const t = invoiceTotals(inv);
  if (t.total > 0 && t.balance <= 0) return 'paid';
  if (inv.dueDate && inv.dueDate < today()) return 'overdue';
  if (t.paid > 0) return 'partial';
  return 'open';
}

export function customerName(id) { return find('customers', id)?.name || '—'; }

export function customerBalance(id) {
  const credits = state.creditNotes.filter((c) => c.customerId === id).reduce((s, c) => s + creditTotals(c).available, 0);
  return round2(state.invoices
    .filter((i) => i.customerId === id && !i.draft)
    .reduce((s, i) => s + invoiceTotalsHome(i).balance, 0) - credits);
}

// ---------- Credit notes & customer deposits ----------

/** total, applied to invoices, refunded and still available. */
export function creditTotals(cn) {
  const total = cn.type === 'deposit' ? round2(cn.amount) : invoiceTotals({ lines: cn.lines, payments: [] }).total;
  const applied = round2(state.invoices.flatMap((i) => i.payments || []).filter((p) => p.creditId === cn.id).reduce((s, p) => s + Number(p.amount), 0));
  const refunded = round2((cn.refunds || []).reduce((s, r) => s + Number(r.amount), 0));
  return { total, applied, refunded, available: round2(total - applied - refunded) };
}

export function applyCredit(cn, invoiceId, amount) {
  const inv = find('invoices', invoiceId);
  const amt = round2(Math.min(amount, creditTotals(cn).available, invoiceTotals(inv).balance));
  if (amt <= 0) return 0;
  upsert('invoices', { ...inv, draft: false, payments: [...(inv.payments || []), { id: uid(), date: today(), amount: amt, method: cn.type === 'deposit' ? 'Payment on account' : `Credit note ${cn.number}`, creditId: cn.id }] });
  return amt;
}

/** Receive one payment from a customer and spread it over their oldest invoices. Any excess is kept as a credit on account. */
export function receiveCustomerPayment(customerId, { date, amount, accountId, method }, invoiceIds) {
  let left = round2(amount);
  const open = state.invoices.filter((i) => i.customerId === customerId && !i.draft && invoiceTotals(i).balance > 0 && (!invoiceIds || invoiceIds.includes(i.id)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const inv of open) {
    if (left <= 0) break;
    const amt = round2(Math.min(left, invoiceTotals(inv).balance));
    upsert('invoices', { ...inv, payments: [...(inv.payments || []), { id: uid(), date, amount: amt, method, accountId }] });
    left = round2(left - amt);
  }
  if (left > 0) {
    upsert('creditNotes', { type: 'deposit', customerId, date, amount: left, accountId, method, number: `D-${state.company.nextCreditNumber}`, refunds: [] });
    state.company.nextCreditNumber += 1; save();
  }
  return left;
}

export function expenseNet(e) { return round2(Number(e.amount || 0) - Number(e.vat || 0)); }

/** Profit & loss between two ISO dates (inclusive) from the general ledger, plus VAT figures. */
export function profitAndLoss(from, to) {
  const pl = L.profitAndLoss(state.accounts, journal(), from, to);
  const incomeByCategory = {}, byCategory = {};
  for (const r of [...pl.income, ...pl.otherIncome]) incomeByCategory[r.account.name] = r.amount;
  for (const r of [...pl.cos, ...pl.expenses]) byCategory[r.account.name] = r.amount;
  const v = vatReturn(from, to);
  return { ...pl, incomeByCategory, byCategory, outputVat: v.box1, inputVat: v.box4 };
}

/** The nine boxes of a UK VAT return (standard / accrual scheme) for a period. */
export function vatReturn(from, to) {
  const inRange = (d) => d >= from && d <= to;
  let box1 = 0, box4 = 0, box6 = 0, box7 = 0;
  for (const i of state.invoices.filter((x) => !x.draft && inRange(x.date))) {
    const t = invoiceTotalsHome(i); box1 += t.vat; box6 += t.subtotal;
  }
  for (const sr of state.salesReceipts.filter((x) => inRange(x.date))) {
    const t = invoiceTotals({ lines: sr.lines, payments: [] }); box1 += t.vat; box6 += t.subtotal;
  }
  for (const cn of state.creditNotes.filter((x) => x.type !== 'deposit' && inRange(x.date))) {
    const t = invoiceTotals({ lines: cn.lines, payments: [] }); box1 -= t.vat; box6 -= t.subtotal;
  }
  for (const r of state.otherIncome.filter((x) => inRange(x.date))) {
    box1 += Number(r.vat || 0);
    if (r.category === 'Sales' || Number(r.vat)) box6 += Number(r.amount) - Number(r.vat || 0);
  }
  for (const c of costEntries().filter((x) => inRange(x.date))) { box4 += c.vat; box7 += c.net; }
  for (const vc of state.vendorCredits.filter((x) => inRange(x.date))) { const t = billTotals({ lines: vc.lines, payments: [] }); box4 -= t.vat; box7 -= t.subtotal; }
  box1 = round2(box1); box4 = round2(box4);
  const box2 = 0, box3 = round2(box1 + box2), box5 = round2(box3 - box4);
  return { box1, box2, box3, box4, box5, box6: Math.floor(box6), box7: Math.floor(box7), box8: 0, box9: 0 };
}

// ---------- Bills (accounts payable) ----------

export const billLinesAsInvoice = (bill) =>
  (bill.lines || []).map((l) => ({ qty: 1, price: Number(l.amount || 0), vatRate: Number(l.vatRate || 0) }));

export function billTotals(bill) { return invoiceTotals({ lines: billLinesAsInvoice(bill), payments: bill.payments }); }

export function billStatus(bill) {
  const t = billTotals(bill);
  if (t.total > 0 && t.balance <= 0) return 'paid';
  if (bill.dueDate && bill.dueDate < today()) return 'overdue';
  if (t.paid > 0) return 'partial';
  return 'open';
}

export function vendorName(id) { return find('vendors', id)?.name || '—'; }

export function vendorBalance(id) {
  const credits = state.vendorCredits.filter((c) => c.vendorId === id).reduce((s, c) => s + vendorCreditTotals(c).available, 0);
  return round2(state.bills.filter((b) => b.vendorId === id).reduce((s, b) => s + billTotals(b).balance, 0) - credits);
}

export function vendorCreditTotals(vc) {
  const total = billTotals({ lines: vc.lines, payments: [] }).total;
  const applied = round2(state.bills.flatMap((b) => b.payments || []).filter((p) => p.vendorCreditId === vc.id).reduce((s, p) => s + Number(p.amount), 0));
  return { total, applied, available: round2(total - applied) };
}

export function applyVendorCredit(vc, billId, amount) {
  const b = find('bills', billId);
  const amt = round2(Math.min(amount, vendorCreditTotals(vc).available, billTotals(b).balance));
  if (amt <= 0) return 0;
  upsert('bills', { ...b, payments: [...(b.payments || []), { id: uid(), date: today(), amount: amt, method: `Supplier credit ${vc.number || ''}`, vendorCreditId: vc.id }] });
  return amt;
}

/** Pay several bills in one go. */
export function payBills(list, { date, accountId, method }) {
  for (const { id, amount } of list) {
    const b = find('bills', id);
    if (b && amount > 0) state.bills[state.bills.indexOf(b)] = { ...b, payments: [...(b.payments || []), { id: uid(), date, amount: round2(amount), method, accountId }] };
  }
  save();
}

export function poTotals(po) {
  return billTotals({ lines: po.lines.map((l) => ({ amount: round2(Number(l.qty || 0) * Number(l.price || 0)), vatRate: l.vatRate })), payments: [] });
}

/** Turn a purchase order into a bill; tracked products are added to stock. */
export function convertPO(po) {
  const bill = upsert('bills', {
    vendorId: po.vendorId, number: `PO ${po.number}`, date: today(), dueDate: addDays(today(), 30), projectId: po.projectId || '', notes: po.notes || '', payments: [],
    lines: po.lines.map((l) => ({ category: l.category, description: `${l.description}${Number(l.qty) !== 1 ? ` (${l.qty} × ${l.price})` : ''}`, amount: round2(Number(l.qty) * Number(l.price)), vatRate: l.vatRate })),
    poId: po.id,
  });
  for (const l of po.lines) if (l.productId && find('products', l.productId)?.trackStock) {
    state.stockAdjustments.push({ id: uid(), productId: l.productId, qty: Number(l.qty), reason: `Received on PO ${po.number}`, date: today() });
  }
  upsert('purchaseOrders', { ...po, status: 'closed', billId: bill.id });
  return bill;
}

// ---------- Estimates ----------

// pending | accepted | declined | converted | expired
export function estimateStatus(est) {
  if (est.invoiceId) return 'converted';
  if (est.status === 'accepted' || est.status === 'declined') return est.status;
  if (est.dueDate && est.dueDate < today()) return 'expired';
  return 'pending';
}

export function convertEstimate(est) {
  const co = state.company;
  const inv = upsert('invoices', {
    number: String(co.nextInvoiceNumber), customerId: est.customerId, date: today(),
    dueDate: addDays(today(), co.paymentTerms), lines: structuredClone(est.lines),
    notes: est.notes, payments: [], draft: false, estimateId: est.id, currency: est.currency, rate: est.rate, projectId: est.projectId || '',
  });
  state.company.nextInvoiceNumber += 1;
  upsert('estimates', { ...est, invoiceId: inv.id, status: 'accepted' });
  return inv;
}

// ---------- Unified expense lines (expenses + bills) ----------

/** Every cost in the books as { date, category, net, vat }. */
export function costEntries() {
  const out = state.expenses.map((e) => ({ date: e.date, category: e.category, net: expenseNet(e), vat: Number(e.vat || 0) }));
  for (const b of state.bills) {
    for (const l of b.lines || []) {
      const net = round2(Number(l.amount || 0));
      out.push({ date: b.date, category: l.category || 'Other', net, vat: round2(net * Number(l.vatRate || 0) / 100) });
    }
  }
  return out;
}

// ---------- Banking ----------

export function bankBalance(accountId) {
  const accts = accountId ? [find('accounts', accountId)] : bankAccounts().filter((a) => a.type === 'bank');
  return round2(accts.reduce((sum, acc) => sum + Number(acc?.openingBalance || 0) * (acc?.type === 'credit_card' ? -1 : 1) +
    state.bankTransactions.filter((t) => t.accountId === acc?.id).reduce((x, t) => x + Number(t.amount), 0), 0));
}

export function reconciledBalance(accountId) {
  const acc = find('accounts', accountId);
  return round2(Number(acc?.openingBalance || 0) * (acc?.type === 'credit_card' ? -1 : 1) +
    state.bankTransactions.filter((t) => t.reconciled && t.accountId === accountId).reduce((s, t) => s + Number(t.amount), 0));
}


/** Turn a bank line into a book entry. kind: 'categorise' | 'invoice' | 'bill' | 'exclude' */
export function postBankTransaction(txn, kind, opts = {}) {
  const amt = Math.abs(Number(txn.amount));
  let link = null;
  if (kind === 'categorise' && opts.splits?.length) {
    const items = opts.splits.map((sp) => {
      const rec = txn.amount < 0
        ? upsert('expenses', { date: txn.date, payee: opts.payee || txn.description, category: sp.category, amount: Math.abs(sp.amount), vat: Number(sp.vat || 0), method: 'Bank', notes: `Split · ${sp.memo || ''}`, bankTxnId: txn.id })
        : upsert('otherIncome', { date: txn.date, description: `${txn.description} · ${sp.memo || ''}`, category: sp.category, amount: Math.abs(sp.amount), vat: Number(sp.vat || 0), bankTxnId: txn.id });
      return { type: txn.amount < 0 ? 'expense' : 'otherIncome', id: rec.id };
    });
    link = { type: 'split', items };
  } else if (kind === 'categorise' && txn.amount < 0) {
    const e = upsert('expenses', { date: txn.date, payee: opts.payee || txn.description, category: opts.category,
      amount: amt, vat: Number(opts.vat || 0), method: 'Bank', notes: 'From bank feed', bankTxnId: txn.id });
    link = { type: 'expense', id: e.id };
  } else if (kind === 'categorise') {
    const r = upsert('otherIncome', { date: txn.date, description: txn.description, category: opts.category,
      amount: amt, vat: Number(opts.vat || 0), bankTxnId: txn.id });
    link = { type: 'otherIncome', id: r.id };
  } else if (kind === 'account') {
    link = { type: 'account', id: opts.accountId };
  } else if (kind === 'invoice' || kind === 'bill') {
    const coll = kind === 'invoice' ? 'invoices' : 'bills';
    const doc = find(coll, opts.id);
    const pid = uid();
    upsert(coll, { ...doc, draft: false, payments: [...(doc.payments || []), { id: pid, date: txn.date, amount: amt, method: 'Bank', bankTxnId: txn.id }] });
    link = { type: coll, id: doc.id, paymentId: pid };
  }
  upsert('bankTransactions', { ...txn, status: kind === 'exclude' ? 'excluded' : 'posted', link });
}

export function undoBankTransaction(txn) {
  const l = txn.link;
  if (l?.type === 'split') for (const it of l.items) remove(it.type === 'expense' ? 'expenses' : 'otherIncome', it.id);
  if (l?.type === 'expense') remove('expenses', l.id);
  if (l?.type === 'otherIncome') remove('otherIncome', l.id);
  if (l?.type === 'invoices' || l?.type === 'bills') {
    const doc = find(l.type, l.id);
    if (doc) upsert(l.type, { ...doc, payments: doc.payments.filter((p) => p.id !== l.paymentId) });
  }
  upsert('bankTransactions', { ...txn, status: 'new', link: null });
}

/** Parse a bank CSV export. Handles "Amount" or "Paid in"/"Paid out" columns and UK or ISO dates. */
export function parseBankCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(parseCsvLine).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const hasHeader = head.some((h) => /date/.test(h));
  const col = (re) => head.findIndex((h) => re.test(h));
  const iDate = hasHeader ? col(/date/) : 0;
  const iDesc = hasHeader ? col(/desc|detail|narrative|memo|reference|payee|name/) : 1;
  const iAmt = hasHeader ? col(/^amount|value/) : 2;
  const iIn = hasHeader ? col(/paid in|credit|money in|deposit/) : -1;
  const iOut = hasHeader ? col(/paid out|debit|money out|withdraw/) : -1;
  const num = (v) => Number(String(v ?? '').replace(/[£$€,\s]/g, '')) || 0;
  const date = (v) => {
    v = String(v).trim();
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  };
  return rows.slice(hasHeader ? 1 : 0).map((r) => {
    const amount = iAmt >= 0 ? num(r[iAmt]) : round2(num(r[iIn]) - Math.abs(num(r[iOut])));
    return { date: date(r[iDate]), description: (r[iDesc] ?? '').trim(), amount: round2(amount) };
  }).filter((t) => t.date && t.amount);
}

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** First bank rule that matches a bank line, or null. */
export function matchRule(t) {
  const d = String(t.description || '').toLowerCase();
  return state.bankRules.filter((r) => r.active !== false).find((r) => {
    if (r.direction === 'in' && t.amount < 0) return false;
    if (r.direction === 'out' && t.amount > 0) return false;
    if (r.accountId && r.accountId !== t.accountId) return false;
    const words = String(r.text || '').toLowerCase().split('|').map((w) => w.trim()).filter(Boolean);
    if (words.length && !words.some((w) => d.includes(w))) return false;
    const amt = Math.abs(t.amount);
    if (r.minAmount && amt < Number(r.minAmount)) return false;
    if (r.maxAmount && amt > Number(r.maxAmount)) return false;
    return true;
  }) || null;
}

/** Apply a rule to a bank line (adds it to the books). */
export function applyRule(t, r) {
  if (r.action === 'transfer') return postBankTransaction(t, 'account', { accountId: r.targetAccountId });
  if (r.action === 'exclude') return postBankTransaction(t, 'exclude');
  const gross = Math.abs(t.amount), rate = Number(r.vatRate || 0);
  postBankTransaction(t, 'categorise', { category: r.category, payee: r.payee || t.description, vat: rate ? round2(gross - gross / (1 + rate / 100)) : 0 });
}

/** Parse an OFX/QFX bank statement. */
export function parseOFX(text) {
  const out = [];
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const tag = (n) => (m[1].match(new RegExp(`<${n}>([^<\r\n]*)`, 'i')) || [])[1]?.trim() || '';
    const dt = tag('DTPOSTED');
    const amount = round2(Number(tag('TRNAMT')));
    if (!dt || !amount) continue;
    out.push({ date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, amount, description: [tag('NAME'), tag('MEMO')].filter(Boolean).join(' ').trim() || tag('FITID'), fitId: tag('FITID') });
  }
  return out;
}

export function importBankTransactions(list, accountId) {
  accountId ||= bankAccounts()[0]?.id;
  const seen = new Set(state.bankTransactions.filter((t) => t.accountId === accountId).map((t) => `${t.date}|${t.amount}|${t.description}`));
  let added = 0;
  for (const t of list) {
    const key = `${t.date}|${t.amount}|${t.description}`;
    if (seen.has(key)) continue;
    t.accountId = accountId;
    seen.add(key);
    state.bankTransactions.push({ id: uid(), ...t, status: 'new', reconciled: false, link: null });
    added++;
  }
  save();
  // auto-add lines that match a rule set to "add automatically"
  for (const t of state.bankTransactions.filter((x) => x.status === 'new' && x.accountId === accountId)) {
    const r = matchRule(t);
    if (r?.autoAdd) applyRule(t, r);
  }
  return added;
}

// ---------- Stock ----------

/** Quantity on hand = opening qty + adjustments − quantity on issued invoices. */
export function stockOnHand(productId) {
  const p = find('products', productId);
  if (!p?.trackStock) return null;
  const sold = [...state.invoices.filter((i) => !i.draft), ...state.salesReceipts].flatMap((i) => i.lines).filter((l) => l.productId === productId)
    .reduce((s, l) => s + Number(l.qty || 0), 0);
  const adj = state.stockAdjustments.filter((a) => a.productId === productId).reduce((s, a) => s + Number(a.qty || 0), 0);
  return round2(Number(p.openingQty || 0) + adj - sold);
}
export const lowStock = () => state.products.filter((p) => p.trackStock && stockOnHand(p.id) <= Number(p.reorderPoint || 0));

// ---------- Mileage (HMRC approved mileage allowance payments) ----------

export const MILEAGE_RATES = { car: [0.45, 0.25], van: [0.45, 0.25], motorcycle: [0.24, 0.24], bicycle: [0.20, 0.20] };

export function taxYearOf(date) {
  const y = Number(date.slice(0, 4));
  return date >= `${y}-04-06` ? y : y - 1; // tax year starting 6 April of returned year
}

/** Recalculate claim on every trip: 45p for the first 10,000 business miles per tax year (cars/vans), 25p after. */
export function recalcMileage() {
  const used = {};
  for (const t of [...state.trips].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''))) {
    const [hi, lo] = MILEAGE_RATES[t.vehicle] || MILEAGE_RATES.car;
    const key = `${taxYearOf(t.date)}|${t.vehicle}`;
    const before = used[key] || 0;
    const miles = Number(t.miles || 0) * (t.returnTrip ? 2 : 1);
    const atHigh = Math.max(0, Math.min(miles, 10000 - before));
    t.totalMiles = miles;
    t.claim = round2(atHigh * hi + (miles - atHigh) * lo);
    used[key] = before + miles;
  }
}

// ---------- Projects ----------

export function projectSummary(projectId) {
  const inv = state.invoices.filter((i) => !i.draft && i.projectId === projectId);
  const income = round2(inv.reduce((s, i) => s + invoiceTotalsHome(i).subtotal, 0));
  const exp = state.expenses.filter((e) => e.projectId === projectId).reduce((s, e) => s + expenseNet(e), 0);
  const bills = state.bills.filter((b) => b.projectId === projectId).reduce((s, b) => s + billTotals(b).subtotal, 0);
  const time = state.timeEntries.filter((t) => t.projectId === projectId);
  const hours = round2(time.reduce((s, t) => s + Number(t.hours || 0), 0));
  const labour = round2(time.reduce((s, t) => s + Number(t.hours || 0) * Number(t.costRate || 0), 0));
  const costs = round2(exp + bills + labour);
  return { income, costs, labour, hours, profit: round2(income - costs), unbilled: round2(time.filter((t) => t.billable && !t.invoiceId).reduce((s, t) => s + t.hours * t.rate, 0)) };
}

// ---------- Time ----------

/** Turn unbilled billable time for a customer into a draft invoice. */
export function invoiceTime(customerId, entryIds) {
  const entries = state.timeEntries.filter((t) => entryIds.includes(t.id));
  if (!entries.length) return null;
  const co = state.company;
  const inv = upsert('invoices', {
    number: String(co.nextInvoiceNumber), customerId, projectId: entries[0].projectId || '', date: today(),
    dueDate: addDays(today(), co.paymentTerms), notes: 'Thank you for your business.', payments: [], draft: true,
    lines: entries.map((t) => ({ productId: '', description: `${t.date} · ${t.description || 'Time'} (${t.hours}h)`, qty: Number(t.hours), price: Number(t.rate), vatRate: co.vatRate })),
  });
  state.company.nextInvoiceNumber += 1;
  entries.forEach((t) => { t.invoiceId = inv.id; });
  save();
  return inv;
}

// ---------- Reminders ----------

export function dueReminders() {
  const days = Number(state.company.reminderDays || 7);
  return state.invoices.filter((i) => invoiceStatus(i) === 'overdue' &&
    (!i.lastReminder || addDays(i.lastReminder, days) <= today()));
}

function seedExtras(s, { customers, products, base }) {
  const proj = { id: uid(), name: 'Northbridge – Block B security upgrade', customerId: customers[0].id, status: 'active', budget: 6000, createdAt: new Date().toISOString() };
  s.projects = [proj];
  s.invoices[3].projectId = proj.id;
  s.bills[2].projectId = proj.id;
  s.timeEntries = [
    { id: uid(), date: addDays(base, -6), customerId: customers[0].id, projectId: proj.id, description: 'Site survey', hours: 3, rate: 65, costRate: 25, billable: true },
    { id: uid(), date: addDays(base, -3), customerId: customers[0].id, projectId: proj.id, description: 'Cable runs, floors 1-2', hours: 7.5, rate: 65, costRate: 25, billable: true },
    { id: uid(), date: addDays(base, -1), customerId: customers[1].id, projectId: '', description: 'Remote support', hours: 1.5, rate: 65, costRate: 25, billable: true },
  ];
  s.trips = [
    { id: uid(), date: addDays(base, -6), from: 'Office', to: 'Northbridge, London N1', purpose: 'Site survey', miles: 18, returnTrip: true, vehicle: 'car', projectId: proj.id },
    { id: uid(), date: addDays(base, -15), from: 'Office', to: 'Harper & Co, Manchester', purpose: 'CCTV service', miles: 42, returnTrip: true, vehicle: 'car' },
  ];
  s.employees = [
    { id: uid(), name: 'Jamie Clarke', email: 'jamie@example.com', niNumber: 'QQ123456C', taxCode: '1257L', salary: 32000, pensionEe: 5, pensionEr: 3, startDate: '2024-04-01', active: true },
  ];
  products[0].trackStock = false;
  s.products.push({ id: uid(), name: 'Door entry keypad', price: 120, vatRate: 20, description: 'Stainless steel keypad', trackStock: true, openingQty: 12, reorderPoint: 5, cost: 55 });
  s.recurring = [{
    id: uid(), name: 'Monthly CCTV monitoring', customerId: customers[2].id, frequency: 'monthly', nextDate: addDays(base, 12), endDate: '', active: true,
    lines: [{ productId: '', description: 'Remote CCTV monitoring – monthly', qty: 1, price: 95, vatRate: 20 }], notes: 'Monthly service charge.', terms: 14,
  }];
  // mileage demo claims are calculated on first load
  const save0 = state; state = s; recalcMileage(); state = save0;
}

// ---------- Demo data ----------

function seedDemo(s) {
  const c = (name, email, phone, address) => ({ id: uid(), name, email, phone, address, createdAt: new Date().toISOString() });
  const customers = [
    c('Northbridge Lettings Ltd', 'accounts@northbridge.example', '020 7946 0011', '12 High Street\nLondon\nN1 4AB'),
    c('Harper & Co Solicitors', 'finance@harperco.example', '0161 496 0322', '5 King Street\nManchester\nM2 6AZ'),
    c('Greenfield Dental', 'office@greenfield.example', '0117 496 0789', '88 Park Row\nBristol\nBS1 5LJ'),
  ];
  const p = (name, price, description) => ({ id: uid(), name, price, vatRate: 20, description });
  const products = [
    p('Access control installation', 850, 'Supply and fit of door access control'),
    p('CCTV maintenance visit', 145, 'Annual service and health check'),
    p('Engineer hour', 65, 'Labour, per hour'),
  ];
  s.customers = customers;
  s.products = products;

  const base = today();
  const mk = (cust, daysAgo, lines, paidFull, draft = false) => {
    const date = addDays(base, -daysAgo);
    const inv = {
      id: uid(), number: String(s.company.nextInvoiceNumber++), customerId: cust.id,
      date, dueDate: addDays(date, 30), lines, notes: 'Thank you for your business.', payments: [], draft,
    };
    if (paidFull) inv.payments.push({ id: uid(), date: addDays(date, 14), amount: invoiceTotals(inv).total, method: 'Bank transfer' });
    return inv;
  };
  const line = (prod, qty) => ({ productId: prod.id, description: prod.name, qty, price: prod.price, vatRate: 20 });
  s.invoices = [
    mk(customers[0], 150, [line(products[0], 1), line(products[2], 4)], true),
    mk(customers[1], 110, [line(products[1], 3)], true),
    mk(customers[2], 75, [line(products[0], 2)], true),
    mk(customers[0], 50, [line(products[2], 10)], false),
    mk(customers[1], 20, [line(products[1], 1), line(products[2], 2)], false),
    mk(customers[2], 2, [line(products[0], 1)], false, true),
  ];

  const ex = (daysAgo, payee, category, amount, vat) => ({
    id: uid(), date: addDays(base, -daysAgo), payee, category, amount, vat, method: 'Card', notes: '',
  });
  s.expenses = [
    ex(140, 'Screwfix', 'Materials', 312.6, 52.1),
    ex(120, 'Office Space Ltd', 'Rent', 900, 0),
    ex(90, 'Office Space Ltd', 'Rent', 900, 0),
    ex(80, 'Shell', 'Vehicle', 84, 14),
    ex(60, 'Office Space Ltd', 'Rent', 900, 0),
    ex(45, 'Microsoft', 'Software', 25.2, 4.2),
    ex(30, 'Office Space Ltd', 'Rent', 900, 0),
    ex(12, 'Toolstation', 'Equipment', 229.99, 38.33),
  ];

  const v = (name, email, phone) => ({ id: uid(), name, email, phone, address: '', createdAt: new Date().toISOString() });
  const vendors = [v('Screwfix Trade', 'trade@screwfix.example', '0330 123 4567'), v('Secure Supplies Ltd', 'sales@securesupplies.example', '0121 496 0555'),
    v('British Gas Business', 'business@bg.example', '0800 048 0202')];
  s.vendors = vendors;
  const bill = (vendor, daysAgo, ref, lines, paid) => {
    const date = addDays(base, -daysAgo);
    const b = { id: uid(), vendorId: vendor.id, number: ref, date, dueDate: addDays(date, 30), lines, payments: [], notes: '' };
    if (paid) b.payments.push({ id: uid(), date: addDays(date, 20), amount: billTotals(b).total, method: 'Bank transfer' });
    return b;
  };
  s.bills = [
    bill(vendors[1], 70, 'SS-4471', [{ description: 'Access control panels x4', category: 'Materials', amount: 640, vatRate: 20 }], true),
    bill(vendors[2], 40, 'BG-889120', [{ description: 'Electricity – quarter', category: 'Utilities', amount: 210, vatRate: 5 }], false),
    bill(vendors[1], 8, 'SS-4630', [{ description: 'CCTV cameras x6', category: 'Materials', amount: 780, vatRate: 20 }, { description: 'Delivery', category: 'Materials', amount: 15, vatRate: 20 }], false),
  ];
  s.estimates = [
    { id: uid(), number: String(s.company.nextEstimateNumber++), customerId: customers[0].id, date: addDays(base, -5), dueDate: addDays(base, 25),
      lines: [line(products[0], 3), line(products[2], 6)], notes: 'Quote valid for 30 days.', payments: [], status: 'pending' },
    { id: uid(), number: String(s.company.nextEstimateNumber++), customerId: customers[2].id, date: addDays(base, -40), dueDate: addDays(base, -10),
      lines: [line(products[1], 2)], notes: '', payments: [], status: 'pending' },
  ];
  s.accounts.find((a) => a.id === 'acc-1200').openingBalance = 5000;
  s.accounts.push({ id: 'acc-1250', code: '1250', name: 'Business credit card', type: 'credit_card', openingBalance: 0 });
  const t = (daysAgo, description, amount, accountId = 'acc-1200') => ({ id: uid(), accountId, date: addDays(base, -daysAgo), description, amount, status: 'new', reconciled: false, link: null });
  const inv1004 = s.invoices[3];
  s.bankTransactions = [
    t(9, 'FPS NORTHBRIDGE LETTINGS INV ' + inv1004.number, invoiceTotals(inv1004).total),
    t(7, 'CARD PAYMENT SHELL M4 SERVICES', -62.4),
    t(6, 'DD BRITISH GAS BUSINESS', -220.5),
    t(4, 'CARD PAYMENT AMAZON MARKETPLACE', -38.99),
    t(2, 'INTEREST PAID', 1.84),
    t(3, 'ADOBE CREATIVE CLOUD', -19.97, 'acc-1250'),
    t(1, 'PREMIER INN BRISTOL', -86, 'acc-1250'),
  ];
  seedExtras(s, { customers, products, base });
}
