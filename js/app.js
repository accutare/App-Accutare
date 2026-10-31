// App shell: hash router + navigation.
import * as store from './store.js';
import * as sync from './sync.js';
import { icon } from './utils.js';
import { toast } from './ui.js';
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

const ROUTES = { dashboard, banking, invoices, estimates, recurring, customers, bills, vendors, expenses, products, reports, settings, accounts, vat, time, mileage, projects, payroll, credits, receipts, statement, purchaseorders, vendorcredits, paybills };
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
  const links = NAV.map(([k, label, ic]) => (k
    ? `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${label}</span></a>`
    : `<div class="nav-group">${label}</div>`)).join('');
  document.getElementById('sidenav').innerHTML = links;
  document.getElementById('bottomnav').innerHTML = NAV.filter(([k]) => MOBILE_NAV.includes(k))
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
  main.innerHTML = view.render({ id });
  // clickable table rows
  main.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => { location.hash = el.dataset.href; }));
  view.mount?.(main, { id }, app);
}

async function init() {
  const mode = await sync.start();
  if (mode === 'online') { await sync.loadIntoStore(); sync.attach(); } else store.load();
  renderNav();
  const who = document.getElementById('who');
  if (sync.isOnline()) {
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
  store.subscribe(route);
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
