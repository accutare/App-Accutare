// Data layer. Everything lives in localStorage so the app works offline with no backend.
// Swap these functions for API calls later if you add a server.
import { uid, today, addDays, round2 } from './utils.js';

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
      bankName: 'Business current account',
      openingBalance: 0,
    },
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

export const EXPENSE_CATEGORIES = [
  'Advertising', 'Bank charges', 'Equipment', 'Insurance', 'Materials',
  'Office supplies', 'Professional fees', 'Rent', 'Software', 'Travel',
  'Utilities', 'Vehicle', 'Wages', 'Other',
];

export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state) { state = defaults(); seedDemo(state); persist(); }
  else state = migrate(state);
  return state;
}

// Fill in collections/settings added in newer versions.
function migrate(old) {
  const d = defaults();
  return { ...d, ...old, company: { ...d.company, ...old.company } };
}

export const get = () => state;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ } };

export function save() { persist(); listeners.forEach((fn) => fn()); }
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
    const net = round2((Number(l.qty) || 0) * (Number(l.price) || 0));
    subtotal += net;
    vat += round2(net * (Number(l.vatRate) || 0) / 100);
  }
  subtotal = round2(subtotal); vat = round2(vat);
  const total = round2(subtotal + vat);
  const paid = round2((inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0));
  return { subtotal, vat, total, paid, balance: round2(total - paid) };
}

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
  return round2(state.invoices
    .filter((i) => i.customerId === id && !i.draft)
    .reduce((s, i) => s + invoiceTotals(i).balance, 0));
}

export function expenseNet(e) { return round2(Number(e.amount || 0) - Number(e.vat || 0)); }

/** Profit & loss between two ISO dates (inclusive), accrual basis. */
export function profitAndLoss(from, to) {
  const inRange = (d) => d >= from && d <= to;
  const invoices = state.invoices.filter((i) => !i.draft && inRange(i.date));
  const incomeByCategory = { Sales: round2(invoices.reduce((s, i) => s + invoiceTotals(i).subtotal, 0)) };
  let outputVat = round2(invoices.reduce((s, i) => s + invoiceTotals(i).vat, 0));
  for (const r of state.otherIncome.filter((x) => inRange(x.date))) {
    const net = round2(Number(r.amount) - Number(r.vat || 0));
    incomeByCategory[r.category] = round2((incomeByCategory[r.category] || 0) + net);
    outputVat = round2(outputVat + Number(r.vat || 0));
  }
  const income = round2(Object.values(incomeByCategory).reduce((a, b) => a + b, 0));
  const costs = costEntries().filter((e) => inRange(e.date));
  const byCategory = {};
  for (const e of costs) byCategory[e.category] = round2((byCategory[e.category] || 0) + e.net);
  const totalExpenses = round2(Object.values(byCategory).reduce((a, b) => a + b, 0));
  const inputVat = round2(costs.reduce((s, e) => s + e.vat, 0));
  return { income, incomeByCategory, byCategory, totalExpenses, net: round2(income - totalExpenses), outputVat, inputVat };
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
  return round2(state.bills.filter((b) => b.vendorId === id).reduce((s, b) => s + billTotals(b).balance, 0));
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
    notes: est.notes, payments: [], draft: false, estimateId: est.id,
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

export function bankBalance() {
  return round2(Number(state.company.openingBalance || 0) + state.bankTransactions.reduce((s, t) => s + Number(t.amount), 0));
}

export function reconciledBalance() {
  return round2(Number(state.company.openingBalance || 0) +
    state.bankTransactions.filter((t) => t.reconciled).reduce((s, t) => s + Number(t.amount), 0));
}

export const INCOME_CATEGORIES = ['Sales', 'Interest', 'Refunds', 'Other income'];

/** Turn a bank line into a book entry. kind: 'categorise' | 'invoice' | 'bill' | 'exclude' */
export function postBankTransaction(txn, kind, opts = {}) {
  const amt = Math.abs(Number(txn.amount));
  let link = null;
  if (kind === 'categorise' && txn.amount < 0) {
    const e = upsert('expenses', { date: txn.date, payee: opts.payee || txn.description, category: opts.category,
      amount: amt, vat: Number(opts.vat || 0), method: 'Bank', notes: 'From bank feed', bankTxnId: txn.id });
    link = { type: 'expense', id: e.id };
  } else if (kind === 'categorise') {
    const r = upsert('otherIncome', { date: txn.date, description: txn.description, category: opts.category,
      amount: amt, vat: Number(opts.vat || 0), bankTxnId: txn.id });
    link = { type: 'otherIncome', id: r.id };
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

export function importBankTransactions(list) {
  const seen = new Set(state.bankTransactions.map((t) => `${t.date}|${t.amount}|${t.description}`));
  let added = 0;
  for (const t of list) {
    const key = `${t.date}|${t.amount}|${t.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    state.bankTransactions.push({ id: uid(), ...t, status: 'new', reconciled: false, link: null });
    added++;
  }
  save();
  return added;
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
  s.company.openingBalance = 5000;
  const t = (daysAgo, description, amount) => ({ id: uid(), date: addDays(base, -daysAgo), description, amount, status: 'new', reconciled: false, link: null });
  const inv1004 = s.invoices[3];
  s.bankTransactions = [
    t(9, 'FPS NORTHBRIDGE LETTINGS INV ' + inv1004.number, invoiceTotals(inv1004).total),
    t(7, 'CARD PAYMENT SHELL M4 SERVICES', -62.4),
    t(6, 'DD BRITISH GAS BUSINESS', -220.5),
    t(4, 'CARD PAYMENT AMAZON MARKETPLACE', -38.99),
    t(2, 'INTEREST PAID', 1.84),
  ];
}
