import * as store from '../store.js';
import { money, esc, fmtDate, today, icon, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';

export const title = 'Mileage';

export function openTripForm(existing) {
  const s = store.get();
  const base = existing || { date: today(), vehicle: s.company.mileageVehicle || 'car', returnTrip: false };
  openModal({
    title: existing ? 'Edit trip' : 'Log a business trip',
    body: `<form>${fields([
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'vehicle', label: 'Vehicle', type: 'select', options: [['car', 'Car'], ['van', 'Van'], ['motorcycle', 'Motorcycle'], ['bicycle', 'Bicycle']] },
      { name: 'from', label: 'From', required: true }, { name: 'to', label: 'To', required: true },
      { name: 'miles', label: 'Miles (one way)', type: 'number', step: '0.1', required: true },
      { name: 'returnTrip', label: 'Return journey?', type: 'select', options: [['', 'No'], ['1', 'Yes – double the miles']] },
      { name: 'purpose', label: 'Business purpose', full: true, required: true },
      { name: 'projectId', label: 'Project', type: 'select', options: [['', '— None —'], ...s.projects.map((p) => [p.id, p.name])] },
    ], { ...base, returnTrip: base.returnTrip ? '1' : '' })}
    <p class="muted small">Claim uses HMRC approved rates: cars & vans 45p/mile for the first 10,000 business miles in the tax year, then 25p; motorcycles 24p; bicycles 20p. Claims are owed to you via the Director's loan account.</p>
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete this trip?')) { store.remove('trips', existing.id); store.recalcMileage(); store.save(); closeModal(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        store.upsert('trips', { ...base, ...d, returnTrip: d.returnTrip === '1' });
        store.recalcMileage(); store.save();
        closeModal(); toast('Trip saved');
      });
    },
  });
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const rows = [...s.trips].sort((a, b) => b.date.localeCompare(a.date));
  const ty = store.taxYearOf(today());
  const thisYear = rows.filter((t) => store.taxYearOf(t.date) === ty);
  return `
    <section class="kpis">
      <div class="card kpi"><span>Business miles · tax year ${ty}/${String(ty + 1).slice(2)}</span><strong>${round2(thisYear.reduce((a, t) => a + (t.totalMiles || 0), 0))}</strong></div>
      <div class="card kpi"><span>Claimable this tax year</span><strong>${money(thisYear.reduce((a, t) => a + (t.claim || 0), 0), cur)}</strong></div>
    </section>
    <div class="toolbar">${searchBox('Search trips')}<button class="btn primary" data-new>${icon('plus')} Log trip</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Date</th><th>Journey</th><th class="hide-sm">Purpose</th><th class="num">Miles</th><th class="num">Claim</th></tr></thead>
    <tbody data-rows>${rows.map((t) => `<tr data-id="${t.id}"><td>${fmtDate(t.date)}</td><td>${esc(t.from)} → ${esc(t.to)}${t.returnTrip ? ' ⇄' : ''}<small class="show-sm">${esc(t.purpose)}</small></td>
      <td class="hide-sm">${esc(t.purpose)}</td><td class="num">${t.totalMiles}</td><td class="num">${money(t.claim, cur)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No trips logged yet.')}`;
}

export function mount(root) {
  bindFilter(root);
  root.querySelector('[data-new]').addEventListener('click', () => openTripForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openTripForm(store.find('trips', tr.dataset.id))));
}
