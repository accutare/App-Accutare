import * as store from '../store.js';
import { money, esc, fmtDate, today, icon, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';

export const title = 'Time';

let timer = null; // { start, customerId, projectId, description }
try { timer = JSON.parse(localStorage.getItem('accutare:timer')); } catch { /* ignore */ }
const saveTimer = () => { try { localStorage.setItem('accutare:timer', JSON.stringify(timer)); } catch { /* ignore */ } };

const custOpts = () => store.get().customers.map((c) => [c.id, c.name]);
const projOpts = () => [['', '— No project —'], ...store.get().projects.filter((p) => p.status !== 'closed').map((p) => [p.id, p.name])];

export function openTimeForm(existing, preset = {}) {
  const co = store.get().company;
  const base = existing || { date: today(), hours: 1, rate: co.hourlyRate || 65, costRate: co.costRate || 0, billable: true, ...preset };
  openModal({
    title: existing ? 'Edit time' : 'Log time',
    body: `<form>${fields([
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'customerId', label: 'Customer', type: 'select', options: custOpts() },
      { name: 'projectId', label: 'Project', type: 'select', options: projOpts() },
      { name: 'hours', label: 'Hours', type: 'number', step: '0.25', required: true },
      { name: 'description', label: 'Description', full: true },
      { name: 'rate', label: 'Bill rate / hour', type: 'number', step: '0.01' },
      { name: 'costRate', label: 'Cost rate / hour (internal)', type: 'number', step: '0.01' },
      { name: 'billable', label: 'Billable', type: 'select', options: [['1', 'Yes'], ['', 'No']] },
    ], { ...base, billable: base.billable ? '1' : '' })}
    ${existing?.invoiceId ? `<p class="muted small">Already invoiced — <a href="#/invoices/${existing.invoiceId}">view invoice</a></p>` : ''}
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => { if (confirmDialog('Delete this entry?')) { store.remove('timeEntries', existing.id); closeModal(); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        store.upsert('timeEntries', { ...base, ...d, billable: d.billable === '1' });
        closeModal(); toast('Time saved');
      });
    },
  });
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const rows = [...s.timeEntries].sort((a, b) => b.date.localeCompare(a.date));
  const unbilled = rows.filter((t) => t.billable && !t.invoiceId);
  const byCust = {};
  unbilled.forEach((t) => { (byCust[t.customerId] ||= []).push(t); });
  const week = rows.filter((t) => t.date >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)).reduce((a, t) => a + Number(t.hours), 0);
  return `
    <section class="kpis">
      <div class="card kpi"><span>Hours last 7 days</span><strong>${round2(week)}</strong></div>
      <div class="card kpi"><span>Unbilled time</span><strong>${money(unbilled.reduce((a, t) => a + t.hours * t.rate, 0), cur)}</strong></div>
      <div class="card kpi timer-card"><span>Timer</span>${timer
        ? `<strong data-elapsed>0:00:00</strong><small>${esc(store.customerName(timer.customerId))}</small><button class="btn primary sm" data-stop>Stop & save</button>`
        : `<button class="btn primary" data-start>▶ Start timer</button>`}</div>
    </section>
    ${Object.keys(byCust).length ? `<div class="card"><h3>Ready to invoice</h3><ul class="list">${Object.entries(byCust).map(([cid, ts]) => `<li>
      <div><strong>${esc(store.customerName(cid))}</strong><small>${round2(ts.reduce((a, t) => a + Number(t.hours), 0))} hours</small></div>
      <div class="actions"><strong>${money(ts.reduce((a, t) => a + t.hours * t.rate, 0), cur)}</strong><button class="btn sm" data-bill="${cid}">Create invoice</button></div></li>`).join('')}</ul></div>` : ''}
    <div class="toolbar">${searchBox('Search time')}<button class="btn primary" data-new>${icon('plus')} Log time</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Date</th><th>Customer</th><th class="hide-sm">Description</th><th class="num">Hours</th><th class="num hide-sm">Value</th><th>Status</th></tr></thead>
    <tbody data-rows>${rows.map((t) => `<tr data-id="${t.id}"><td>${fmtDate(t.date)}</td><td>${esc(store.customerName(t.customerId))}<small class="show-sm">${esc(t.description)}</small></td>
      <td class="hide-sm">${esc(t.description)}</td><td class="num">${t.hours}</td><td class="num hide-sm">${t.billable ? money(t.hours * t.rate, cur) : '—'}</td>
      <td>${t.invoiceId ? '<span class="badge badge-paid">Invoiced</span>' : t.billable ? '<span class="badge badge-open">Unbilled</span>' : '<span class="badge badge-draft">Non-billable</span>'}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No time logged yet.')}`;
}

let tick;
export function mount(root) {
  bindFilter(root);
  clearInterval(tick);
  root.querySelector('[data-new]').addEventListener('click', () => openTimeForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openTimeForm(store.find('timeEntries', tr.dataset.id))));
  root.querySelectorAll('[data-bill]').forEach((b) => b.addEventListener('click', () => {
    const ids = store.get().timeEntries.filter((t) => t.customerId === b.dataset.bill && t.billable && !t.invoiceId).map((t) => t.id);
    const inv = store.invoiceTime(b.dataset.bill, ids);
    toast('Draft invoice created'); location.hash = `#/invoices/${inv.id}`;
  }));
  root.querySelector('[data-start]')?.addEventListener('click', () => {
    const s = store.get();
    openModal({
      title: 'Start timer',
      body: `<form>${fields([{ name: 'customerId', label: 'Customer', type: 'select', options: custOpts() }, { name: 'projectId', label: 'Project', type: 'select', options: projOpts() },
        { name: 'description', label: 'What are you working on?', full: true }])}<footer class="modal-foot"><button class="btn primary">Start</button></footer></form>`,
      onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault(); timer = { ...readForm(e.target), start: Date.now() }; saveTimer(); closeModal(); store.save();
      }),
    });
  });
  const el = root.querySelector('[data-elapsed]');
  if (el && timer) {
    const upd = () => { const sec = Math.floor((Date.now() - timer.start) / 1000); el.textContent = `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };
    upd(); tick = setInterval(upd, 1000);
  }
  root.querySelector('[data-stop]')?.addEventListener('click', () => {
    const hours = Math.max(0.25, Math.round(((Date.now() - timer.start) / 3600000) * 4) / 4);
    const preset = { customerId: timer.customerId, projectId: timer.projectId, description: timer.description, hours };
    timer = null; saveTimer(); clearInterval(tick);
    openTimeForm(null, preset);
  });
}
