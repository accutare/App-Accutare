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
    },
    customers: [],
    products: [],
    invoices: [],
    expenses: [],
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
  return state;
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
  state = { ...defaults(), ...data };
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
  const income = round2(invoices.reduce((s, i) => s + invoiceTotals(i).subtotal, 0));
  const outputVat = round2(invoices.reduce((s, i) => s + invoiceTotals(i).vat, 0));
  const expenses = state.expenses.filter((e) => inRange(e.date));
  const byCategory = {};
  for (const e of expenses) byCategory[e.category] = round2((byCategory[e.category] || 0) + expenseNet(e));
  const totalExpenses = round2(Object.values(byCategory).reduce((a, b) => a + b, 0));
  const inputVat = round2(expenses.reduce((s, e) => s + Number(e.vat || 0), 0));
  return { income, byCategory, totalExpenses, net: round2(income - totalExpenses), outputVat, inputVat };
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
}
