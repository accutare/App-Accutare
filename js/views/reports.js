import * as store from '../store.js';
import { money, today, esc, icon } from '../utils.js';

export const title = 'Reports';

const year = () => new Date().getFullYear();
const PERIODS = {
  'this-month': () => { const d = today(); return [d.slice(0, 8) + '01', d]; },
  'this-quarter': () => { const n = new Date(); const m = Math.floor(n.getMonth() / 3) * 3 + 1; return [`${year()}-${String(m).padStart(2, '0')}-01`, today()]; },
  'this-year': () => [`${year()}-01-01`, today()],
  'last-year': () => [`${year() - 1}-01-01`, `${year() - 1}-12-31`],
  // UK tax year: 6 April – 5 April
  'tax-year': () => { const t = today(); const y = t >= `${year()}-04-06` ? year() : year() - 1; return [`${y}-04-06`, `${y + 1}-04-05`]; },
};
let period = 'this-year';
let range = PERIODS[period]();

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const [from, to] = range;
  const pl = store.profitAndLoss(from, to);
  const cats = Object.entries(pl.byCategory).sort((a, b) => b[1] - a[1]);
  const vatDue = pl.outputVat - pl.inputVat;
  const aging = { current: 0, '1-30': 0, '31-60': 0, '61+': 0 };
  for (const inv of s.invoices.filter((i) => !i.draft)) {
    const bal = store.invoiceTotals(inv).balance;
    if (bal <= 0) continue;
    const days = Math.floor((Date.now() - new Date(inv.dueDate + 'T00:00:00')) / 86400000);
    aging[days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : '61+'] += bal;
  }

  return `
    <div class="toolbar no-print">
      <div class="period">
        <select data-period>${[['this-month', 'This month'], ['this-quarter', 'This quarter'], ['this-year', 'This year'], ['tax-year', 'UK tax year'], ['last-year', 'Last year'], ['custom', 'Custom']]
          .map(([k, l]) => `<option value="${k}" ${k === period ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input type="date" data-from value="${from}"> <span>to</span> <input type="date" data-to value="${to}">
      </div>
      <button class="btn" onclick="window.print()">${icon('print', 16)} Print</button>
    </div>

    <section class="grid-2">
      <div class="card report">
        <h3>Profit and loss</h3>
        <table class="table">
          <tbody>
            <tr class="section"><td>Income</td><td></td></tr>
            <tr><td class="indent">Sales</td><td class="num">${money(pl.income, cur)}</td></tr>
            <tr class="subtotal"><td>Total income</td><td class="num">${money(pl.income, cur)}</td></tr>
            <tr class="section"><td>Expenses</td><td></td></tr>
            ${cats.map(([c, v]) => `<tr><td class="indent">${esc(c)}</td><td class="num">${money(v, cur)}</td></tr>`).join('') || '<tr><td class="indent muted">None</td><td></td></tr>'}
            <tr class="subtotal"><td>Total expenses</td><td class="num">${money(pl.totalExpenses, cur)}</td></tr>
            <tr class="grand"><td>Net profit</td><td class="num ${pl.net < 0 ? 'neg' : ''}">${money(pl.net, cur)}</td></tr>
          </tbody>
        </table>
        <p class="muted small">Accrual basis, amounts exclude VAT. Drafts excluded.</p>
      </div>

      <div>
        <div class="card report">
          <h3>VAT summary</h3>
          <table class="table"><tbody>
            <tr><td>VAT on sales (output)</td><td class="num">${money(pl.outputVat, cur)}</td></tr>
            <tr><td>VAT on purchases (input)</td><td class="num">${money(pl.inputVat, cur)}</td></tr>
            <tr class="grand"><td>${vatDue >= 0 ? 'VAT to pay' : 'VAT to reclaim'}</td><td class="num">${money(Math.abs(vatDue), cur)}</td></tr>
          </tbody></table>
          <p class="muted small">Indicative only — check with your accountant before submitting a VAT return.</p>
        </div>
        <div class="card report">
          <h3>Accounts receivable ageing (today)</h3>
          <table class="table"><tbody>
            <tr><td>Current</td><td class="num">${money(aging.current, cur)}</td></tr>
            <tr><td>1–30 days overdue</td><td class="num">${money(aging['1-30'], cur)}</td></tr>
            <tr><td>31–60 days overdue</td><td class="num">${money(aging['31-60'], cur)}</td></tr>
            <tr><td>61+ days overdue</td><td class="num">${money(aging['61+'], cur)}</td></tr>
          </tbody></table>
        </div>
      </div>
    </section>`;
}

export function mount(root, _p, app) {
  const sel = root.querySelector('[data-period]');
  const from = root.querySelector('[data-from]');
  const to = root.querySelector('[data-to]');
  sel.addEventListener('change', () => {
    period = sel.value;
    if (PERIODS[period]) range = PERIODS[period]();
    app.rerender();
  });
  const custom = () => { period = 'custom'; range = [from.value, to.value]; app.rerender(); };
  from.addEventListener('change', custom);
  to.addEventListener('change', custom);
}
