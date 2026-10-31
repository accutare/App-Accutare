import * as store from '../store.js';
import { money, esc, round2, icon, LOCALE } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';

export const title = 'Budgets';

function fyStartDate(year) {
  const co = store.get().company;
  return `${year}-${String(co.fyStartMonth || 1).padStart(2, '0')}-${String(co.fyStartDay || 1).padStart(2, '0')}`;
}
export function budgetMonths(b) {
  const d = new Date(b.start + 'T00:00:00');
  return [...Array(12)].map((_, i) => { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; });
}

let current = null;

export function render() {
  const s = store.get();
  if (!s.budgets.find((b) => b.id === current)) current = s.budgets[s.budgets.length - 1]?.id;
  const b = store.find('budgets', current);
  const head = `<div class="toolbar"><div class="actions">${s.budgets.length ? `<select data-pick>${s.budgets.map((x) => `<option value="${x.id}" ${x.id === current ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}</div>
    <div class="actions">${b ? `<a class="btn" href="#/reports/budget">Budget vs actual</a><button class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}<button class="btn primary" data-new>${icon('plus')} New budget</button></div></div>`;
  if (!b) return head + emptyState('No budgets yet. Create one for your financial year.');
  const months = budgetMonths(b);
  const accts = s.accounts.filter((a) => ['income', 'other_income', 'cost_of_sales', 'expense'].includes(a.type) && !a.inactive);
  const lab = (m) => new Date(m + '-01T00:00:00').toLocaleDateString(LOCALE, { month: 'short' });
  return head + `<p class="muted">Type an annual figure in “Year” to spread it evenly, or fill each month. Saved automatically.</p>
    <div class="card table-card"><div class="table-scroll" style="margin:0"><table class="table budget-grid"><thead><tr><th>Account</th><th class="num">Year</th>${months.map((m) => `<th class="num">${lab(m)}</th>`).join('')}</tr></thead>
    <tbody>${accts.map((a) => { const v = b.amounts?.[a.id] || Array(12).fill(0); return `<tr data-acc="${a.id}"><td>${esc(a.name)}</td><td><input type="number" step="1" data-year value="${round2(v.reduce((x, y) => x + y, 0)) || ''}"></td>
      ${v.map((n, i) => `<td><input type="number" step="1" data-m="${i}" value="${n || ''}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></div>`;
}

export function mount(root, _p, app) {
  root.querySelector('[data-pick]')?.addEventListener('change', (e) => { current = e.target.value; app.rerender(); });
  root.querySelector('[data-new]').addEventListener('click', () => {
    const y = Number(prompt('Budget for the financial year starting in which year?', String(new Date().getFullYear())));
    if (!y) return;
    const start = fyStartDate(y);
    const b = store.upsert('budgets', { name: `FY ${y}/${String(y + 1).slice(2)}`, start, amounts: {} });
    current = b.id; toast('Budget created');
  });
  root.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete this budget?')) store.remove('budgets', current); });
  const grid = root.querySelector('.budget-grid');
  if (!grid) return;
  let t;
  const saveSoon = () => { clearTimeout(t); t = setTimeout(() => {
    const amounts = {};
    grid.querySelectorAll('tr[data-acc]').forEach((tr) => { const v = [...tr.querySelectorAll('[data-m]')].map((i) => Number(i.value || 0)); if (v.some(Boolean)) amounts[tr.dataset.acc] = v; });
    const b = store.find('budgets', current); b.amounts = amounts; store.save();
  }, 600); };
  grid.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (e.target.matches('[data-year]')) { const per = round2(Number(e.target.value || 0) / 12); tr.querySelectorAll('[data-m]').forEach((i) => { i.value = per || ''; }); }
    else tr.querySelector('[data-year]').value = round2([...tr.querySelectorAll('[data-m]')].reduce((x, i) => x + Number(i.value || 0), 0)) || '';
    saveSoon();
  });
}
