import * as store from '../store.js';
import { money, esc, fmtDate, today, addDays } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';

export const title = 'VAT returns';

/** Quarterly periods (calendar-quarter stagger) for the last 2 years. */
function periods() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - i * 3, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 3, 0);
    const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const to = iso(end);
    const due = new Date(end); due.setMonth(due.getMonth() + 1); due.setDate(due.getDate() + 7);
    out.push({ from: iso(d), to, due: iso(due) });
  }
  return out;
}

const BOXES = [['box1', 'VAT due on sales'], ['box2', 'VAT due on EU acquisitions'], ['box3', 'Total VAT due'], ['box4', 'VAT reclaimed on purchases'],
  ['box5', 'Net VAT payable / (repayable)'], ['box6', 'Total sales ex VAT'], ['box7', 'Total purchases ex VAT'], ['box8', 'Goods supplied to EU'], ['box9', 'Goods acquired from EU']];

let selected = null;

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const ps = periods();
  selected ||= ps.find((p) => p.to < today()) || ps[0];
  const filed = s.vatReturns.find((r) => r.from === selected.from && r.to === selected.to);
  const v = filed?.boxes || store.vatReturn(selected.from, selected.to);
  return `
    <div class="grid-2">
      <div class="card">
        <h3>Return for ${fmtDate(selected.from)} – ${fmtDate(selected.to)}</h3>
        <p class="muted">Due ${fmtDate(selected.due)} ${filed ? `· <span class="badge badge-paid">Filed ${fmtDate(filed.filedOn)}</span>` : selected.to >= today() ? '· <span class="badge badge-open">Period open</span>' : '· <span class="badge badge-overdue">Not filed</span>'}</p>
        <table class="table report-table"><tbody>${BOXES.map(([k, l], i) => `<tr class="${k === 'box5' ? 'grand' : ''}"><td>Box ${i + 1}</td><td>${l}</td><td class="num">${money(v[k], cur)}</td></tr>`).join('')}</tbody></table>
        <div class="actions wrap" style="margin-top:16px">
          ${filed ? '<button class="btn" data-unfile>Reopen period</button>' : '<button class="btn primary" data-file>Mark as filed</button>'}
          <button class="btn" data-submit>Submit to HMRC (MTD)</button>
        </div>
        <p class="muted small">Standard accrual scheme. Filing here locks the figures in the app. Direct submission to HMRC needs the app to be registered with HMRC's Making Tax Digital API and connected to your Government Gateway — see README.</p>
      </div>
      <div class="card">
        <h3>Periods</h3>
        <ul class="list">${ps.map((p) => { const f = s.vatReturns.find((r) => r.from === p.from); return `<li><a href="#" data-period="${p.from}">
          <div><strong>${fmtDate(p.from)} – ${fmtDate(p.to)}</strong><small>Due ${fmtDate(p.due)}</small></div>
          <div class="right">${f ? `<span class="badge badge-paid">Filed</span><small>${money(f.boxes.box5, cur)}</small>` : p.to >= today() ? '<span class="badge badge-open">Open</span>' : '<span class="badge badge-overdue">To file</span>'}</div></a></li>`; }).join('')}</ul>
      </div>
    </div>`;
}

export function mount(root, _p, app) {
  root.querySelectorAll('[data-period]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); selected = periods().find((p) => p.from === a.dataset.period); app.rerender(); }));
  root.querySelector('[data-file]')?.addEventListener('click', () => {
    if (selected.to >= today() && !confirmDialog('This period has not ended yet. File anyway?')) return;
    store.upsert('vatReturns', { from: selected.from, to: selected.to, boxes: store.vatReturn(selected.from, selected.to), filedOn: today() });
    toast('VAT return marked as filed');
  });
  root.querySelector('[data-unfile]')?.addEventListener('click', () => {
    const f = store.get().vatReturns.find((r) => r.from === selected.from);
    if (f && confirmDialog('Reopen this VAT period?')) store.remove('vatReturns', f.id);
  });
  root.querySelector('[data-submit]').addEventListener('click', () => toast('HMRC MTD connection not configured yet — see README'));
}
