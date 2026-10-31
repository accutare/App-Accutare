// App shell: hash router + navigation.
import * as store from './store.js';
import { icon } from './utils.js';
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

const ROUTES = { dashboard, banking, invoices, estimates, customers, bills, vendors, expenses, products, reports, settings };
const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['banking', 'Banking', 'bank'],
  ['', 'Sales', null],
  ['invoices', 'Invoices', 'invoice'],
  ['estimates', 'Estimates', 'estimate'],
  ['customers', 'Customers', 'customers'],
  ['', 'Purchases', null],
  ['bills', 'Bills', 'bill'],
  ['expenses', 'Expenses', 'expenses'],
  ['vendors', 'Suppliers', 'vendors'],
  ['', 'Business', null],
  ['products', 'Products', 'products'],
  ['reports', 'Reports', 'reports'],
  ['settings', 'Settings', 'settings'],
];
const MOBILE_NAV = ['dashboard', 'banking', 'invoices', 'bills'];

const app = {
  rerender: () => route(),
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

function init() {
  store.load();
  renderNav();
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
