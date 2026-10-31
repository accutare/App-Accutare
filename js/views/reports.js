import * as store from '../store.js';
import * as L from '../ledger.js';
import { money, today, esc, icon, fmtDate, round2, addDays, lineNet } from '../utils.js';

export const title = 'Reports';

const year = () => new Date().getFullYear();
const fyStart = () => {
  const co = store.get().company;
  const m = String(co.fyStartMonth || 1).padStart(2, '0'), d = String(co.fyStartDay || 1).padStart(2, '0');
  const thisYear = `${year()}-${m}-${d}`;
  return today() >= thisYear ? thisYear : `${year() - 1}-${m}-${d}`;
};
const PERIODS = {
  'this-month': () => [today().slice(0, 8) + '01', today()],
  'last-month': () => { const d = new Date(); d.setDate(0); const e = d.toISOString().slice(0, 10); return [e.slice(0, 8) + '01', e]; },
  'this-quarter': () => { const n = new Date(); const m = Math.floor(n.getMonth() / 3) * 3 + 1; return [`${year()}-${String(m).padStart(2, '0')}-01`, today()]; },
  'this-year': () => [`${year()}-01-01`, today()],
  'financial-year': () => [fyStart(), today()],
  'last-year': () => [`${year() - 1}-01-01`, `${year() - 1}-12-31`],
  'tax-year': () => { const t = today(); const y = t >= `${year()}-04-06` ? year() : year() - 1; return [`${y}-04-06`, `${y + 1}-04-05`]; },
};
let period = 'this-year';
let range = PERIODS[period]();

const CATALOG = [
  ['Business overview', [['pl', 'Profit and loss'], ['bs', 'Balance sheet'], ['cf', 'Statement of cash flows'], ['pl-month', 'Profit and loss by month'], ['projects', 'Project profitability']]],
  ['Who owes you', [['ar', 'Accounts receivable ageing'], ['open-invoices', 'Open invoices'], ['customer-balances', 'Customer balances']]],
  ['Sales', [['sales-customer', 'Sales by customer'], ['sales-product', 'Sales by product/service'], ['time', 'Time by customer']]],
  ['What you owe', [['ap', 'Accounts payable ageing'], ['unpaid-bills', 'Unpaid bills']]],
  ['Expenses', [['exp-category', 'Expenses by category'], ['exp-supplier', 'Expenses by supplier'], ['mileage', 'Mileage log']]],
  ['Tax & accountant', [['vat', 'VAT summary (9 boxes)'], ['tb', 'Trial balance'], ['gl', 'General ledger'], ['journal', 'Journal'], ['payroll', 'Payroll summary']]],
  ['Stock', [['stock', 'Stock valuation']]],
];
const NAMES = Object.fromEntries(CATALOG.flatMap(([, r]) => r));

const cur = () => store.get().company.currency;
const m = (n) => money(n, cur());
const tr = (label, amount, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="num">${amount === '' ? '' : m(amount)}</td></tr>`;
const table = (head, rows, foot = '') => `<table class="table report-table"><thead><tr>${head.map((h, i) => `<th class="${i ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">No data for this period.</td></tr>`}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table>`;
const row = (cells, href) => `<tr ${href ? `data-href="${href}"` : ''}>${cells.map((c, i) => `<td class="${i ? 'num' : ''}">${c}</td>`).join('')}</tr>`;

function ageing(items) {
  const b = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0 };
  for (const { due, bal } of items) {
    const days = Math.floor((Date.now() - new Date(due + 'T00:00:00')) / 86400000);
    b[days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '91+'] += bal;
  }
  return b;
}

const REPORTS = {
  pl() {
    const p = store.profitAndLoss(range[0], range[1]);
    const sect = (title, rows) => rows.length ? `<tr class="section"><td>${title}</td><td></td></tr>${rows.map((r) => `<tr data-href="#/accounts/${r.account.id}"><td class="indent">${esc(r.account.name)}</td><td class="num">${m(r.amount)}</td></tr>`).join('')}` : '';
    const s = (rows) => round2(rows.reduce((a, r) => a + r.amount, 0));
    return `<table class="table report-table"><tbody>
      ${sect('Income', p.income)}${tr('Total income', s(p.income), 'subtotal')}
      ${sect('Cost of sales', p.cos)}${p.cos.length ? tr('Total cost of sales', s(p.cos), 'subtotal') : ''}
      ${tr('Gross profit', p.grossProfit, 'grand')}
      ${sect('Expenses', p.expenses)}${tr('Total expenses', s(p.expenses), 'subtotal')}
      ${sect('Other income', p.otherIncome)}
      ${tr('Net profit', p.net, 'grand')}</tbody></table><p class="muted small">Accrual basis, excluding VAT.</p>`;
  },
  'pl-month'() {
    const months = [];
    let d = range[0].slice(0, 7);
    while (d <= range[1].slice(0, 7) && months.length < 24) { months.push(d); const x = new Date(d + '-01T00:00:00'); x.setMonth(x.getMonth() + 1); d = x.toISOString().slice(0, 7); }
    const data = months.map((mo) => { const end = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5)), 0); return store.profitAndLoss(mo + '-01', `${mo}-${String(end.getDate()).padStart(2, '0')}`); });
    const lab = (mo) => new Date(mo + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    return `<div class="table-scroll">${table(['', ...months.map(lab)], [
      row(['Income', ...data.map((p) => m(p.totalIncome))]), row(['Expenses', ...data.map((p) => m(p.totalExpenses))]),
      `<tr class="grand"><td>Net profit</td>${data.map((p) => `<td class="num">${m(p.net)}</td>`).join('')}</tr>`])}</div>`;
  },
  bs() {
    const s = store.get();
    const b = L.balanceSheet(s.accounts, store.journal(), range[1], fyStart());
    const lines = (rows) => rows.map((r) => `<tr data-href="#/accounts/${r.account.id}"><td class="indent">${esc(r.account.name)}</td><td class="num">${m(r.amount)}</td></tr>`).join('');
    return `<p class="muted">As of ${fmtDate(range[1])}</p><table class="table report-table"><tbody>
      <tr class="section"><td>Assets</td><td></td></tr>${lines(b.assets)}${tr('Total assets', b.totalAssets, 'grand')}
      <tr class="section"><td>Liabilities</td><td></td></tr>${lines(b.liabilities)}${tr('Total liabilities', b.totalLiabilities, 'subtotal')}
      <tr class="section"><td>Equity</td><td></td></tr>${lines(b.equity)}
      ${tr('<span class="indent-in">Retained earnings</span>', b.priorEarnings)}${tr('<span class="indent-in">Profit for the year</span>', b.currentEarnings)}
      ${tr('Total equity', b.totalEquity, 'subtotal')}
      ${tr('Total liabilities and equity', round2(b.totalLiabilities + b.totalEquity), 'grand')}
    </tbody></table>${b.balanced ? '' : '<p class="neg">Warning: balance sheet does not balance.</p>'}`;
  },
  cf() {
    const s = store.get();
    const c = L.cashFlow(s.accounts, store.journal(), range[0], range[1]);
    const ls = (arr) => arr.map((x) => tr(`<span class="indent-in">${esc(x.label)}</span>`, x.amount)).join('');
    return `<table class="table report-table"><tbody>
      <tr class="section"><td>Operating activities</td><td></td></tr>${tr('<span class="indent-in">Net profit</span>', c.net)}${ls(c.lines.operating)}
      ${tr('Net cash from operating activities', c.operating, 'subtotal')}
      <tr class="section"><td>Investing activities</td><td></td></tr>${ls(c.lines.investing)}${tr('Net cash from investing activities', c.investing, 'subtotal')}
      <tr class="section"><td>Financing activities</td><td></td></tr>${ls(c.lines.financing)}${tr('Net cash from financing activities', c.financing, 'subtotal')}
      ${tr('Net change in cash', c.change, 'grand')}${tr('Cash at start of period', c.openCash)}${tr('Cash at end of period', c.closeCash, 'grand')}
    </tbody></table>`;
  },
  ar() {
    const s = store.get();
    const open = s.invoices.filter((i) => !i.draft && store.invoiceTotals(i).balance > 0);
    const byCust = {};
    for (const i of open) { const c = (byCust[i.customerId] ||= []); c.push({ due: i.dueDate, bal: store.invoiceTotalsHome(i).balance }); }
    const cols = ['current', '1-30', '31-60', '61-90', '91+'];
    const rows = Object.entries(byCust).map(([id, items]) => { const a = ageing(items); return row([esc(store.customerName(id)), ...cols.map((k) => m(a[k])), m(items.reduce((x, i) => x + i.bal, 0))], `#/customers/${id}`); });
    const t = ageing(open.map((i) => ({ due: i.dueDate, bal: store.invoiceTotalsHome(i).balance })));
    return `<p class="muted">As of today</p>${table(['Customer', 'Current', '1–30', '31–60', '61–90', '91+', 'Total'], rows,
      `<tr><td><strong>Total</strong></td>${cols.map((k) => `<td class="num"><strong>${m(t[k])}</strong></td>`).join('')}<td class="num"><strong>${m(Object.values(t).reduce((a, b) => a + b, 0))}</strong></td></tr>`)}`;
  },
  ap() {
    const s = store.get();
    const open = s.bills.filter((b) => store.billTotals(b).balance > 0);
    const byV = {};
    for (const b of open) (byV[b.vendorId] ||= []).push({ due: b.dueDate, bal: store.billTotals(b).balance });
    const cols = ['current', '1-30', '31-60', '61-90', '91+'];
    const rows = Object.entries(byV).map(([id, items]) => { const a = ageing(items); return row([esc(store.vendorName(id)), ...cols.map((k) => m(a[k])), m(items.reduce((x, i) => x + i.bal, 0))], `#/vendors/${id}`); });
    return `<p class="muted">As of today</p>${table(['Supplier', 'Current', '1–30', '31–60', '61–90', '91+', 'Total'], rows)}`;
  },
  'open-invoices'() {
    const s = store.get();
    return table(['Invoice', 'Customer', 'Date', 'Due', 'Balance'], s.invoices.filter((i) => !i.draft && store.invoiceTotals(i).balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((i) => row([`#${esc(i.number)}`, esc(store.customerName(i.customerId)), fmtDate(i.date), fmtDate(i.dueDate), money(store.invoiceTotals(i).balance, store.invoiceCurrency(i))], `#/invoices/${i.id}`)));
  },
  'customer-balances'() {
    const s = store.get();
    return table(['Customer', 'Open balance'], s.customers.map((c) => [c, store.customerBalance(c.id)]).filter(([, b]) => b).map(([c, b]) => row([esc(c.name), m(b)], `#/customers/${c.id}`)));
  },
  'unpaid-bills'() {
    const s = store.get();
    return table(['Supplier', 'Ref', 'Due', 'Balance'], s.bills.filter((b) => store.billTotals(b).balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((b) => row([esc(store.vendorName(b.vendorId)), esc(b.number), fmtDate(b.dueDate), m(store.billTotals(b).balance)], `#/bills/${b.id}`)));
  },
  'sales-customer'() {
    const s = store.get(); const by = {};
    for (const i of s.invoices.filter((x) => !x.draft && x.date >= range[0] && x.date <= range[1])) by[i.customerId] = (by[i.customerId] || 0) + store.invoiceTotalsHome(i).subtotal;
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    return table(['Customer', 'Sales (ex VAT)'], rows.map(([id, v]) => row([esc(store.customerName(id)), m(v)], `#/customers/${id}`)),
      row(['<strong>Total</strong>', `<strong>${m(rows.reduce((a, r) => a + r[1], 0))}</strong>`]));
  },
  'sales-product'() {
    const s = store.get(); const by = {};
    for (const i of s.invoices.filter((x) => !x.draft && x.date >= range[0] && x.date <= range[1])) for (const l of i.lines) {
      const k = store.find('products', l.productId)?.name || l.description || 'Other';
      const r = (by[k] ||= { qty: 0, amt: 0 }); r.qty += Number(l.qty); r.amt += round2(lineNet(l) * store.rateOf(i));
    }
    return table(['Product / service', 'Qty', 'Amount'], Object.entries(by).sort((a, b) => b[1].amt - a[1].amt).map(([k, v]) => row([esc(k), round2(v.qty), m(v.amt)])));
  },
  time() {
    const s = store.get(); const by = {};
    for (const t of s.timeEntries.filter((x) => x.date >= range[0] && x.date <= range[1])) { const r = (by[t.customerId] ||= { h: 0, b: 0, v: 0 }); r.h += Number(t.hours); if (t.billable) { r.b += Number(t.hours); r.v += t.hours * t.rate; } }
    return table(['Customer', 'Hours', 'Billable hours', 'Billable value'], Object.entries(by).map(([id, r]) => row([esc(store.customerName(id)), round2(r.h), round2(r.b), m(r.v)])));
  },
  'exp-category'() {
    const p = store.profitAndLoss(range[0], range[1]);
    const rows = [...p.cos, ...p.expenses].sort((a, b) => b.amount - a.amount);
    return table(['Category', 'Amount (ex VAT)'], rows.map((r) => row([esc(r.account.name), m(r.amount)], `#/accounts/${r.account.id}`)), row(['<strong>Total</strong>', `<strong>${m(p.totalExpenses)}</strong>`]));
  },
  'exp-supplier'() {
    const s = store.get(); const by = {};
    const inR = (d) => d >= range[0] && d <= range[1];
    for (const b of s.bills.filter((x) => inR(x.date))) { const k = store.vendorName(b.vendorId); by[k] = (by[k] || 0) + store.billTotals(b).subtotal; }
    for (const e of s.expenses.filter((x) => inR(x.date))) by[e.payee] = (by[e.payee] || 0) + store.expenseNet(e);
    return table(['Supplier / payee', 'Amount (ex VAT)'], Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => row([esc(k), m(v)])));
  },
  mileage() {
    const s = store.get();
    const trips = s.trips.filter((t) => t.date >= range[0] && t.date <= range[1]).sort((a, b) => a.date.localeCompare(b.date));
    return table(['Date', 'Journey', 'Purpose', 'Miles', 'Claim'], trips.map((t) => row([fmtDate(t.date), `${esc(t.from)} → ${esc(t.to)}${t.returnTrip ? ' (return)' : ''}`, esc(t.purpose), t.totalMiles, m(t.claim)])),
      row(['<strong>Total</strong>', '', '', `<strong>${round2(trips.reduce((a, t) => a + (t.totalMiles || 0), 0))}</strong>`, `<strong>${m(trips.reduce((a, t) => a + (t.claim || 0), 0))}</strong>`]));
  },
  vat() {
    const v = store.vatReturn(range[0], range[1]);
    const B = [['1', 'VAT due on sales and other outputs', v.box1], ['2', 'VAT due on acquisitions from EU (NI only)', v.box2], ['3', 'Total VAT due (1 + 2)', v.box3],
      ['4', 'VAT reclaimed on purchases and other inputs', v.box4], ['5', 'Net VAT to pay to HMRC or reclaim', v.box5], ['6', 'Total value of sales, ex VAT', v.box6],
      ['7', 'Total value of purchases, ex VAT', v.box7], ['8', 'Supplies of goods to EU (NI only)', v.box8], ['9', 'Acquisitions of goods from EU (NI only)', v.box9]];
    return `${table(['Box', 'Description', 'Amount'], B.map(([b, d, a]) => `<tr class="${b === '5' ? 'grand' : ''}"><td>${b}</td><td>${d}</td><td class="num">${m(a)}</td></tr>`))}
      <p class="muted small">Go to <a href="#/vat">VAT returns</a> to file a period.</p>`;
  },
  tb() {
    const s = store.get();
    const t = L.trialBalance(s.accounts, store.journal(), range[1]);
    return `<p class="muted">As of ${fmtDate(range[1])}</p>${table(['Account', 'Debit', 'Credit'], t.rows.map((r) => row([`${esc(r.account.code)} ${esc(r.account.name)}`, r.debit ? m(r.debit) : '', r.credit ? m(r.credit) : ''], `#/accounts/${r.account.id}`)),
      row(['<strong>Total</strong>', `<strong>${m(t.debit)}</strong>`, `<strong>${m(t.credit)}</strong>`]))}`;
  },
  gl() {
    const s = store.get();
    return s.accounts.map((a) => {
      const g = L.generalLedger(s.accounts, store.journal(), a.id, range[0], range[1]);
      if (!g.rows.length) return '';
      return `<h4>${esc(a.code)} ${esc(a.name)}</h4>${table(['Date', 'Transaction', 'Debit', 'Credit', 'Balance'], [
        row([fmtDate(range[0]), 'Opening balance', '', '', m(g.opening)]),
        ...g.rows.map((r) => row([fmtDate(r.date), esc(r.memo), r.debit ? m(r.debit) : '', r.credit ? m(r.credit) : '', m(r.balance)]))])}`;
    }).join('') || '<p class="muted">No transactions.</p>';
  },
  journal() {
    const s = store.get();
    const name = (id) => { const a = store.find('accounts', id); return a ? `${a.code} ${a.name}` : '?'; };
    const es = store.journal().filter((e) => e.date >= range[0] && e.date <= range[1]);
    return table(['Date / account', 'Debit', 'Credit'], es.flatMap((e) => [`<tr class="section"><td>${fmtDate(e.date)} · ${esc(e.memo)}</td><td></td><td></td></tr>`,
      ...e.lines.map((l) => row([`<span class="indent-in">${esc(name(l.accountId))}</span>`, l.debit ? m(l.debit) : '', l.credit ? m(l.credit) : '']))]));
  },
  payroll() {
    const s = store.get();
    const runs = s.payRuns.filter((r) => r.date >= range[0] && r.date <= range[1]);
    const by = {};
    for (const r of runs) for (const l of r.lines) { const x = (by[l.employeeId] ||= { gross: 0, tax: 0, eeNI: 0, erNI: 0, pen: 0, net: 0 }); x.gross += l.gross; x.tax += l.tax; x.eeNI += l.eeNI; x.erNI += l.erNI; x.pen += l.eePension + l.erPension; x.net += l.net; }
    return table(['Employee', 'Gross', 'PAYE', 'Employee NI', 'Employer NI', 'Pension', 'Net pay'], Object.entries(by).map(([id, x]) =>
      row([esc(store.find('employees', id)?.name || '?'), m(x.gross), m(x.tax), m(x.eeNI), m(x.erNI), m(x.pen), m(x.net)])));
  },
  projects() {
    const s = store.get();
    return table(['Project', 'Income', 'Costs', 'Profit', 'Margin'], s.projects.map((p) => { const x = store.projectSummary(p.id);
      return row([esc(p.name), m(x.income), m(x.costs), m(x.profit), x.income ? Math.round((x.profit / x.income) * 100) + '%' : '—'], `#/projects/${p.id}`); }));
  },
  stock() {
    const s = store.get();
    const ps = s.products.filter((p) => p.trackStock);
    const rows = ps.map((p) => { const q = store.stockOnHand(p.id); return row([esc(p.name), q, m(p.cost || 0), m(q * (p.cost || 0)), q <= (p.reorderPoint || 0) ? '<span class="neg">Reorder</span>' : 'OK']); });
    return table(['Product', 'Qty on hand', 'Unit cost', 'Value', 'Status'], rows, row(['<strong>Total</strong>', '', '', `<strong>${m(ps.reduce((a, p) => a + store.stockOnHand(p.id) * (p.cost || 0), 0))}</strong>`, '']));
  },
};

export function render(params) {
  if (!params.id) {
    return `<div class="report-catalog">${CATALOG.map(([g, items]) => `<div class="card"><h3>${g}</h3><ul class="link-list">
      ${items.map(([k, l]) => `<li><a href="#/reports/${k}">${l}</a></li>`).join('')}</ul></div>`).join('')}</div>`;
  }
  const fn = REPORTS[params.id];
  if (!fn) return '<p>Unknown report.</p>';
  const co = store.get().company;
  return `<a class="back no-print" href="#/reports">← All reports</a>
    <div class="toolbar no-print">
      <div class="period">
        <select data-period>${[['this-month', 'This month'], ['last-month', 'Last month'], ['this-quarter', 'This quarter'], ['this-year', 'This calendar year'], ['financial-year', 'This financial year'], ['tax-year', 'UK tax year'], ['last-year', 'Last year'], ['custom', 'Custom']]
          .map(([k, l]) => `<option value="${k}" ${k === period ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="date" data-from value="${range[0]}"> <span>to</span> <input type="date" data-to value="${range[1]}">
      </div>
      <div class="actions"><button class="btn" data-csv>Export CSV</button><button class="btn" onclick="window.print()">${icon('print', 16)} Print</button></div>
    </div>
    <div class="card report"><header class="report-head"><strong>${esc(co.name)}</strong><h2>${NAMES[params.id]}</h2>
      <span class="muted">${fmtDate(range[0])} – ${fmtDate(range[1])}</span></header>${fn()}</div>`;
}

export function mount(root, params, app) {
  const sel = root.querySelector('[data-period]');
  if (!sel) return;
  const from = root.querySelector('[data-from]'), to = root.querySelector('[data-to]');
  sel.addEventListener('change', () => { period = sel.value; if (PERIODS[period]) range = PERIODS[period](); app.rerender(); });
  const custom = () => { period = 'custom'; range = [from.value, to.value]; app.rerender(); };
  from.addEventListener('change', custom); to.addEventListener('change', custom);
  root.querySelector('[data-csv]').addEventListener('click', () => app.exportTables(NAMES[params.id]));
}
