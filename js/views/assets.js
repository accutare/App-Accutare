import * as store from '../store.js';
import { depreciationSchedule } from '../ledger.js';
import { money, esc, fmtDate, today, icon } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState } from '../ui.js';

export const title = 'Fixed assets';

function openAssetForm(existing) {
  const s = store.get();
  openModal({
    title: existing ? 'Edit asset' : 'New fixed asset',
    body: `<form>${fields([
      { name: 'name', label: 'Asset', required: true, full: true, placeholder: 'e.g. Ford Transit van, Laptop' },
      { name: 'accountId', label: 'Asset account', type: 'select', options: s.accounts.filter((a) => a.type === 'fixed_asset' && a.system !== 'accum_dep').map((a) => [a.id, a.name]) },
      { name: 'purchaseDate', label: 'Purchase date', type: 'date', required: true, value: today() },
      { name: 'cost', label: 'Cost (ex VAT)', type: 'number', step: '0.01', required: true },
      { name: 'paidFrom', label: 'Record the purchase now?', type: 'select', options: [['', 'No – already in the books (bill/expense coded to the asset account)'], ...store.bankAccounts().map((a) => [a.id, `Yes – paid from ${a.name}`]), [s.accounts.find((a) => a.system === 'dla')?.id, "Yes – paid personally (Director's loan)"]] },
      { name: 'method', label: 'Depreciation method', type: 'select', options: [['straight', 'Straight line'], ['reducing', 'Reducing balance']] },
      { name: 'lifeYears', label: 'Useful life (years) – straight line', type: 'number', step: 'any', value: 4 },
      { name: 'rate', label: 'Rate % per year – reducing balance', type: 'number', step: 'any', value: 25 },
      { name: 'residual', label: 'Residual value', type: 'number', step: '0.01', value: 0 },
      { name: 'disposedDate', label: 'Disposed / sold on (optional)', type: 'date' },
    ], existing || {})}
    <p class="muted small">Depreciation is posted automatically at each month end (Dr Depreciation, Cr Accumulated depreciation).</p>
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}<button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const sync = () => { const r = form.elements.method.value === 'reducing'; form.elements.rate.closest('.field').hidden = !r; form.elements.lifeYears.closest('.field').hidden = r; };
      form.elements.method.addEventListener('change', sync); sync();
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete asset and its depreciation?')) { store.remove('assets', existing.id); closeModal(); } });
      form.addEventListener('submit', (e) => { e.preventDefault(); store.upsert('assets', { ...(existing || {}), ...readForm(form) }); closeModal(); toast('Asset saved'); });
    },
  });
}

export function render() {
  const s = store.get(), cur = s.company.currency;
  const rows = s.assets.map((a) => { const sch = depreciationSchedule(a); const dep = sch.reduce((x, d) => x + d.amount, 0); return { a, dep, nbv: Number(a.cost) - dep, ytd: sch.filter((d) => d.date.slice(0, 4) === today().slice(0, 4)).reduce((x, d) => x + d.amount, 0) }; });
  return `<div class="toolbar"><span class="muted">Vans, tools, computers… anything kept for more than a year.</span><button class="btn primary" data-new>${icon('plus')} New asset</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Asset</th><th class="hide-sm">Bought</th><th class="num">Cost</th><th class="num hide-sm">Depreciation this year</th><th class="num">Accum. depreciation</th><th class="num">Book value</th></tr></thead>
    <tbody>${rows.map(({ a, dep, nbv, ytd }) => `<tr data-id="${a.id}"><td><strong>${esc(a.name)}</strong><small class="muted">${a.method === 'reducing' ? `${a.rate}% reducing` : `${a.lifeYears} yrs straight line`}${a.disposedDate ? ' · disposed' : ''}</small></td>
      <td class="hide-sm">${fmtDate(a.purchaseDate)}</td><td class="num">${money(a.cost, cur)}</td><td class="num hide-sm">${money(ytd, cur)}</td><td class="num">${money(dep, cur)}</td><td class="num"><strong>${money(nbv, cur)}</strong></td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="2"><strong>Total</strong></td><td class="num">${money(rows.reduce((x, r) => x + Number(r.a.cost), 0), cur)}</td><td class="hide-sm"></td><td class="num">${money(rows.reduce((x, r) => x + r.dep, 0), cur)}</td><td class="num"><strong>${money(rows.reduce((x, r) => x + r.nbv, 0), cur)}</strong></td></tr></tfoot></table></div>`
      : emptyState('No fixed assets yet.')}`;
}

export function mount(root) {
  root.querySelector('[data-new]').addEventListener('click', () => openAssetForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openAssetForm(store.find('assets', tr.dataset.id))));
}
