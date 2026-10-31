import * as store from '../store.js';
import { money, esc, fmtDate, today, monthKey, icon } from '../utils.js';
import { badge } from '../ui.js';

export const title = 'Dashboard';

function lastMonths(n) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function chart(months, cur) {
  const s = store.get();
  const data = months.map((m) => {
    const income = s.invoices.filter((i) => !i.draft && monthKey(i.date) === m)
      .reduce((a, i) => a + store.invoiceTotals(i).subtotal, 0);
    const expense = store.costEntries().filter((e) => monthKey(e.date) === m)
      .reduce((a, e) => a + e.net, 0);
    return { m, income, expense };
  });
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const W = 600, H = 220, pad = 28, gw = (W - pad) / data.length, bw = Math.min(26, gw / 3);
  const bars = data.map((d, i) => {
    const x = pad + i * gw + gw / 2;
    const hi = (d.income / max) * (H - 40), he = (d.expense / max) * (H - 40);
    const label = new Date(d.m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short' });
    return `
      <rect class="bar-income" x="${x - bw - 2}" y="${H - 20 - hi}" width="${bw}" height="${hi}" rx="3"><title>Income ${label}: ${money(d.income, cur)}</title></rect>
      <rect class="bar-expense" x="${x + 2}" y="${H - 20 - he}" width="${bw}" height="${he}" rx="3"><title>Expenses ${label}: ${money(d.expense, cur)}</title></rect>
      <text x="${x}" y="${H - 4}" text-anchor="middle">${label}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Income and expenses by month">
    <line x1="${pad}" x2="${W}" y1="${H - 20}" y2="${H - 20}" class="axis"/>${bars}</svg>
    <div class="legend"><span><i class="sw sw-income"></i>Income</span><span><i class="sw sw-expense"></i>Expenses</span></div>`;
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const pl = store.profitAndLoss(yearStart, today());
  const live = s.invoices.filter((i) => !i.draft);
  const open = live.filter((i) => store.invoiceTotals(i).balance > 0);
  const overdue = open.filter((i) => store.invoiceStatus(i) === 'overdue');
  const sum = (list) => list.reduce((a, i) => a + store.invoiceTotals(i).balance, 0);
  const billsDue = s.bills.reduce((a, b) => a + store.billTotals(b).balance, 0);
  const toReview = s.bankTransactions.filter((t) => t.status === 'new').length;
  const recent = [...s.invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return `
    <section class="kpis">
      <a class="card kpi" href="#/banking"><span>Bank balance${toReview ? ` · ${toReview} to review` : ''}</span><strong>${money(store.bankBalance(), cur)}</strong></a>
      <a class="card kpi" href="#/bills"><span>Bills to pay</span><strong>${money(billsDue, cur)}</strong></a>
      <div class="card kpi"><span>Income (YTD)</span><strong>${money(pl.income, cur)}</strong></div>
      <div class="card kpi"><span>Expenses (YTD)</span><strong>${money(pl.totalExpenses, cur)}</strong></div>
      <div class="card kpi"><span>Net profit (YTD)</span><strong class="${pl.net < 0 ? 'neg' : 'pos'}">${money(pl.net, cur)}</strong></div>
      <a class="card kpi" href="#/invoices"><span>Unpaid invoices · ${open.length}</span><strong>${money(sum(open), cur)}</strong></a>
      <a class="card kpi warn" href="#/invoices"><span>Overdue · ${overdue.length}</span><strong>${money(sum(overdue), cur)}</strong></a>
    </section>

    <section class="grid-2">
      <div class="card">
        <h3>Income vs expenses — last 6 months</h3>
        ${chart(lastMonths(6), cur)}
      </div>
      <div class="card">
        <div class="card-head"><h3>Recent invoices</h3><a href="#/invoices">View all</a></div>
        <ul class="list">
          ${recent.map((i) => `
            <li><a href="#/invoices/${i.id}">
              <div><strong>#${esc(i.number)} · ${esc(store.customerName(i.customerId))}</strong><small>${fmtDate(i.date)}</small></div>
              <div class="right"><strong>${money(store.invoiceTotals(i).total, cur)}</strong>${badge(store.invoiceStatus(i))}</div>
            </a></li>`).join('') || '<li class="muted">No invoices yet.</li>'}
        </ul>
      </div>
    </section>

    <section class="quick">
      <button class="btn" data-quick="invoice">${icon('invoice')} New invoice</button>
      <button class="btn" data-quick="expense">${icon('expenses')} New expense</button>
      <button class="btn" data-quick="customer">${icon('customers')} New customer</button>
    </section>`;
}

export function mount(root, _params, app) {
  root.querySelectorAll('[data-quick]').forEach((b) =>
    b.addEventListener('click', () => app.quickCreate(b.dataset.quick)));
}
