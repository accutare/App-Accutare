// App shell: hash router + navigation.
import * as store from './store.js';
import * as sync from './sync.js';
import { icon } from './utils.js';
import { toast } from './ui.js';
import { mountSearch } from './search.js';
import { startI18n } from './i18n.js';

/** Which screens each role can open (null = everything). */
const ACCESS = {
  sales: ['dashboard', 'invoices', 'estimates', 'receipts', 'credits', 'recurring', 'customers', 'products', 'statement', 'time', 'projects', 'settings'],
  purchases: ['dashboard', 'bills', 'purchaseorders', 'vendorcredits', 'paybills', 'expenses', 'vendors', 'products', 'mileage', 'settings'],
  standard: Object.keys({ dashboard: 1, banking: 1, invoices: 1, estimates: 1, receipts: 1, credits: 1, recurring: 1, customers: 1, products: 1, statement: 1, bills: 1, purchaseorders: 1,
    vendorcredits: 1, paybills: 1, expenses: 1, vendors: 1, projects: 1, time: 1, mileage: 1, reports: 1, vat: 1, accounts: 1, assets: 1, budgets: 1, settings: 1 }),
};
const CREATE_ROUTE = { invoice: 'invoices', estimate: 'estimates', receipt: 'receipts', credit: 'credits', customer: 'customers', bill: 'bills', expense: 'expenses',
  vendor: 'vendors', po: 'purchaseorders', vendorCredit: 'vendorcredits', time: 'time', trip: 'mileage', journal: 'accounts' };
const allowed = (route) => { const role = sync.user()?.role; const list = role && ACCESS[role]; return !list || list.includes(route); };
import * as dashboard from './views/dashboard.js';
import * as invoices from './views/invoices.js';
import * as customers from './views/customers.js';
import * as expenses from './views/expenses.js';
import * as products from './views/products.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';
import * as banking from './views/banking.js';
import * as estimates from './views/estimates.js';
import * as bills from './views/bills.js';
import * as vendors from './views/vendors.js';
import * as accounts from './views/accounts.js';
import * as vat from './views/vat.js';
import * as recurring from './views/recurring.js';
import * as time from './views/time.js';
import * as mileage from './views/mileage.js';
import * as projects from './views/projects.js';
import * as payroll from './views/payroll.js';
import * as credits from './views/credits.js';
import * as receipts from './views/receipts.js';
import * as statement from './views/statement.js';
import { purchaseorders, vendorcredits, paybills, openPOForm } from './views/purchasing.js';
import * as assets from './views/assets.js';
import * as budgets from './views/budgets.js';
import * as audit from './views/audit.js';
import { sha256 } from './views/settings.js';

const ROUTES = { dashboard, banking, invoices, estimates, recurring, customers, bills, vendors, expenses, products, reports, settings, accounts, vat, time, mileage, projects, payroll, credits, receipts, statement, purchaseorders, vendorcredits, paybills, assets, budgets, audit };
const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['banking', 'Banking', 'bank'],
  ['', 'Sales', null],
  ['invoices', 'Invoices', 'invoice'],
  ['estimates', 'Estimates', 'estimate'],
  ['receipts', 'Sales receipts', 'invoice'],
  ['credits', 'Credit notes', 'invoice'],
  ['recurring', 'Recurring', 'repeat'],
  ['customers', 'Customers', 'customers'],
  ['products', 'Products & stock', 'products'],
  ['', 'Purchases', null],
  ['bills', 'Bills', 'bill'],
  ['purchaseorders', 'Purchase orders', 'bill'],
  ['expenses', 'Expenses', 'expenses'],
  ['vendors', 'Suppliers', 'vendors'],
  ['', 'Work', null],
  ['projects', 'Projects', 'folder'],
  ['time', 'Time', 'clock'],
  ['mileage', 'Mileage', 'car'],
  ['payroll', 'Payroll', 'payroll'],
  ['', 'Accounting', null],
  ['reports', 'Reports', 'reports'],
  ['vat', 'VAT returns', 'vat'],
  ['accounts', 'Chart of accounts', 'book'],
  ['assets', 'Fixed assets', 'products'],
  ['budgets', 'Budgets', 'reports'],
  ['settings', 'Settings', 'settings'],
];
const MOBILE_NAV = ['dashboard', 'banking', 'invoices', 'bills'];

const app = {
  rerender: () => route(),
  /** Download every table on the current page as one CSV file. */
  exportTables(name = 'report') {
    const cell = (td) => {
      const t = td.innerText.replace(/\s+/g, ' ').trim();
      const n = t.replace(/[£$€,]/g, '');
      return /^-?\d+(\.\d+)?$/.test(n) && /\d/.test(t) ? n : `"${t.replace(/"/g, '""')}"`;
    };
    const csv = [...document.querySelectorAll('#main table')].map((tb) => [...tb.rows].map((r) => [...r.cells].map(cell).join(',')).join('\n')).join('\n\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })), download: `${name.replace(/[^\w-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  quickCreate(kind, preset) {
    if (kind === 'invoice') {
      if (!store.get().customers.length) return customers.openCustomerForm(null, () => invoices.openInvoiceForm());
      invoices.openInvoiceForm(null, preset);
    }
    if (kind === 'expense') expenses.openExpenseForm();
    if (kind === 'customer') customers.openCustomerForm();
    if (kind === 'estimate') {
      if (!store.get().customers.length) return customers.openCustomerForm(null, () => estimates.openEstimateForm());
      estimates.openEstimateForm(null, preset);
    }
    if (kind === 'bill') bills.openBillForm(null, preset);
    if (kind === 'vendor') vendors.openVendorForm();
    if (kind === 'time') time.openTimeForm(null, preset);
    if (kind === 'trip') mileage.openTripForm();
    if (kind === 'journal') accounts.openJournalForm();
    if (kind === 'recurring') recurring.openRecurringForm();
    if (kind === 'credit') credits.openCreditForm(null, preset);
    if (kind === 'receipt') receipts.openReceiptForm(null, preset);
    if (kind === 'po') { if (!store.get().vendors.length) return toast('Add a supplier first'); openPOForm(); }
    if (kind === 'vendorCredit') bills.openBillForm(null, preset, 'vendorCredit');
  },
};

function parseHash() {
  const [, name = 'dashboard', id] = location.hash.replace(/^#/, '').split('/');
  return { name: ROUTES[name] ? name : 'dashboard', id };
}

function renderNav() {
  const items = NAV.filter(([k]) => !k || allowed(k));
  const visible = items.filter(([k], i) => k || (items[i + 1] && items[i + 1][0])); // drop empty group headings
  const links = visible.map(([k, label, ic]) => (k
    ? `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${label}</span></a>`
    : `<div class="nav-group">${label}</div>`)).join('');
  document.getElementById('sidenav').innerHTML = links;
  document.querySelectorAll('[data-create]').forEach((b) => { b.hidden = !allowed(CREATE_ROUTE[b.dataset.create]); });
  document.getElementById('bottomnav').innerHTML = NAV.filter(([k]) => MOBILE_NAV.includes(k) && allowed(k))
    .map(([k, label, ic]) => `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${label}</span></a>`).join('')
    + `<button type="button" data-more>${icon('menu')}<span>More</span></button>`;
  document.querySelector('[data-more]').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  document.getElementById('company-name').textContent = store.get().company.name;
}

function route() {
  const { name, id } = parseHash();
  const view = ROUTES[name];
  const main = document.getElementById('main');
  document.getElementById('page-title').textContent = view.title;
  document.title = `${view.title} · Accutare`;
  document.getElementById('company-name').textContent = store.get().company.name;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  document.body.classList.remove('nav-open');
  if (!allowed(name)) { main.innerHTML = '<div class="empty"><p>Your role does not have access to this area. Ask the company owner or an admin.</p></div>'; return; }
  main.innerHTML = view.render({ id });
  // clickable table rows
  main.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => { location.hash = el.dataset.href; }));
  view.mount?.(main, { id }, app);
}

async function init() {
  startI18n();
  const mode = await sync.start();
  let localCompanies = [];
  if (mode === 'online') { await sync.loadIntoStore(); sync.attach(); } else {
    try { localCompanies = JSON.parse(localStorage.getItem('accutare:companies') || '[]'); } catch { /* ignore */ }
    let cur = '';
    try { cur = localStorage.getItem('accutare:company-local') || ''; } catch { /* ignore */ }
    store.useLocalCompany(cur);
    store.load();
    if (!localCompanies.length) localCompanies = [{ id: '', name: store.get().company.name }];
    const me = localCompanies.find((c) => c.id === cur); if (me) me.name = store.get().company.name;
    try { localStorage.setItem('accutare:companies', JSON.stringify(localCompanies)); } catch { /* ignore */ }
  }
  mountSearch(document.getElementById('search'));
  // company switcher
  const cn = document.getElementById('company-name');
  cn.classList.add('company-switch');
  cn.addEventListener('click', (e) => {
    e.stopPropagation();
    const list = mode === 'online' ? sync.companies().map((c) => ({ id: c.id, name: c.name })) : localCompanies;
    const curId = mode === 'online' ? sync.company().id : (localStorage.getItem('accutare:company-local') || '');
    const menu = document.getElementById('company-menu');
    menu.innerHTML = `<small>Switch company</small>${list.map((c) => `<button data-co="${c.id}" class="${c.id === curId ? 'current' : ''}">${c.name || 'Company'}</button>`).join('')}<button data-co-new>+ Add a company</button>`;
    menu.hidden = !menu.hidden;
    menu.querySelectorAll('[data-co]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.co === curId) return;
      if (mode === 'online') sync.switchCompany(b.dataset.co);
      else { localStorage.setItem('accutare:company-local', b.dataset.co); location.reload(); }
    }));
    menu.querySelector('[data-co-new]').addEventListener('click', () => {
      const name = prompt('New company name'); if (!name) return;
      if (mode === 'online') return sync.createCompany(name);
      const id = Math.random().toString(36).slice(2, 10);
      localCompanies.push({ id, name });
      localStorage.setItem('accutare:companies', JSON.stringify(localCompanies));
      localStorage.setItem('accutare:company-local', id);
      store.useLocalCompany(id); store.reset(false); store.updateCompany({ name });
      location.reload();
    });
  });
  document.addEventListener('click', () => { document.getElementById('company-menu').hidden = true; });
  renderNav();
  const who = document.getElementById('who');
  if (sync.isOnline()) {
    store.setActor(sync.user().name || sync.user().email);
    who.innerHTML = `<span>${sync.user().name || sync.user().email}</span><small>${sync.user().role}${sync.canWrite() ? '' : ' · read-only'}</small>`;
    if (!sync.canWrite()) document.body.classList.add('read-only');
  } else who.innerHTML = '<small>Local mode · data stays in this browser</small>';
  document.getElementById('new-btn').innerHTML = `${icon('plus')}<span>New</span>`;
  const menu = document.getElementById('new-menu');
  document.getElementById('new-btn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-create]');
    if (b) app.quickCreate(b.dataset.create);
  });
  window.addEventListener('hashchange', route);
  // Closed-period guard: ask for the closing-date password, then let the user retry.
  const onLocked = async (err) => {
    if (err?.name !== 'PeriodLockedError') return false;
    const co = store.get().company;
    if (co.closingHash) {
      const pw = prompt(`${err.message}. Enter the closing date password to make changes:`);
      if (!pw) return true;
      if ((await sha256(pw)) !== co.closingHash) { toast('Wrong password'); return true; }
    } else if (!confirm(`${err.message}. Change it anyway?`)) return true;
    store.unlockPeriod(); toast('Closed period unlocked for this session — please repeat the change');
    return true;
  };
  window.addEventListener('error', (e) => { if (e.error?.name === 'PeriodLockedError') { e.preventDefault(); onLocked(e.error); } });
  window.addEventListener('unhandledrejection', (e) => { if (e.reason?.name === 'PeriodLockedError') { e.preventDefault(); onLocked(e.reason); } });
  store.subscribe(route);
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
