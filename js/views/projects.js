import * as store from '../store.js';
import { money, esc, fmtDate, icon } from '../utils.js';
import { attachmentsBox, mountAttachments } from '../files.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, badge } from '../ui.js';

export const title = 'Projects';

function openProjectForm(existing) {
  const s = store.get();
  openModal({
    title: existing ? 'Edit project' : 'New project',
    body: `<form>${fields([
      { name: 'name', label: 'Project name', required: true, full: true },
      { name: 'customerId', label: 'Customer', type: 'select', options: s.customers.map((c) => [c.id, c.name]) },
      { name: 'status', label: 'Status', type: 'select', options: [['active', 'In progress'], ['on-hold', 'On hold'], ['closed', 'Completed']] },
      { name: 'budget', label: 'Budget (income)', type: 'number', step: '0.01' },
      { name: 'startDate', label: 'Start date', type: 'date' }, { name: 'endDate', label: 'End date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
    ], existing || { status: 'active' })}
    <footer class="modal-foot">${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (confirmDialog('Delete project? Linked transactions are kept but unlinked.')) { store.remove('projects', existing.id); closeModal(); location.hash = '#/projects'; }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const p = store.upsert('projects', { ...(existing || {}), ...readForm(form) });
        closeModal(); toast('Project saved'); location.hash = `#/projects/${p.id}`;
      });
    },
  });
}

const STATUS = { active: ['open', 'In progress'], 'on-hold': ['partial', 'On hold'], closed: ['paid', 'Completed'] };
const pbadge = (s) => `<span class="badge badge-${STATUS[s]?.[0] || 'draft'}">${STATUS[s]?.[1] || s}</span>`;

export function render(params) {
  const s = store.get();
  const cur = s.company.currency;
  if (params.id) {
    const p = store.find('projects', params.id);
    if (!p) return emptyState('Project not found.');
    const x = store.projectSummary(p.id);
    const inv = s.invoices.filter((i) => i.projectId === p.id);
    const costs = [...s.expenses.filter((e) => e.projectId === p.id).map((e) => ({ date: e.date, label: `Expense · ${e.payee}`, amount: store.expenseNet(e), href: '#/expenses' })),
      ...s.bills.filter((b) => b.projectId === p.id).map((b) => ({ date: b.date, label: `Bill · ${store.vendorName(b.vendorId)}`, amount: store.billTotals(b).subtotal, href: `#/bills/${b.id}` }))]
      .sort((a, b) => b.date.localeCompare(a.date));
    const time = s.timeEntries.filter((t) => t.projectId === p.id);
    const pct = p.budget ? Math.min(100, Math.round((x.income / p.budget) * 100)) : null;
    return `<a class="back" href="#/projects">← Projects</a>
      <div class="card detail-head"><div><h2>${esc(p.name)}</h2><p class="muted">${esc(store.customerName(p.customerId))}</p>${pbadge(p.status)}</div>
        <div class="right"><div class="actions"><button class="btn" data-edit>Edit</button><button class="btn primary" data-invoice>New invoice</button></div></div></div>
      <section class="kpis">
        <div class="card kpi"><span>Income</span><strong>${money(x.income, cur)}</strong>${pct !== null ? `<div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${pct}% of ${money(p.budget, cur)} budget</small>` : ''}</div>
        <div class="card kpi"><span>Costs (incl. labour)</span><strong>${money(x.costs, cur)}</strong></div>
        <div class="card kpi"><span>Profit</span><strong class="${x.profit < 0 ? 'neg' : 'pos'}">${money(x.profit, cur)}</strong></div>
        <div class="card kpi"><span>Hours · unbilled</span><strong>${x.hours}h</strong><small class="muted">${money(x.unbilled, cur)} unbilled</small></div>
      </section>
      <div class="grid-2">
        <div class="card"><h3>Invoices</h3><ul class="list">${inv.map((i) => `<li><a href="#/invoices/${i.id}"><div><strong>#${esc(i.number)}</strong><small>${fmtDate(i.date)}</small></div>
          <div class="right"><strong>${money(store.invoiceTotals(i).total, store.invoiceCurrency(i))}</strong>${badge(store.invoiceStatus(i))}</div></a></li>`).join('') || '<li class="muted">None yet</li>'}</ul></div>
        <div class="card"><h3>Costs</h3><ul class="list">${costs.map((c) => `<li><a href="${c.href}"><div><strong>${esc(c.label)}</strong><small>${fmtDate(c.date)}</small></div><strong>${money(c.amount, cur)}</strong></a></li>`).join('')
          || '<li class="muted">None yet</li>'}${time.length ? `<li><a href="#/time"><div><strong>Labour</strong><small>${x.hours} hours</small></div><strong>${money(x.labour, cur)}</strong></a></li>` : ''}</ul></div>
      </div>${attachmentsBox(p)}`;
  }
  const rows = s.projects;
  return `<div class="toolbar"><span class="muted">Track income, costs and time per job.</span><button class="btn primary" data-new>${icon('plus')} New project</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Project</th><th class="hide-sm">Customer</th><th>Status</th><th class="num">Income</th><th class="num hide-sm">Costs</th><th class="num">Profit</th></tr></thead>
    <tbody>${rows.map((p) => { const x = store.projectSummary(p.id); return `<tr data-href="#/projects/${p.id}"><td><strong>${esc(p.name)}</strong></td><td class="hide-sm">${esc(store.customerName(p.customerId))}</td>
      <td>${pbadge(p.status)}</td><td class="num">${money(x.income, cur)}</td><td class="num hide-sm">${money(x.costs, cur)}</td><td class="num ${x.profit < 0 ? 'neg' : ''}">${money(x.profit, cur)}</td></tr>`; }).join('')}</tbody></table></div>`
      : emptyState('No projects yet.')}`;
}

export function mount(root, params, app) {
  root.querySelector('[data-new]')?.addEventListener('click', () => openProjectForm());
  if (!params.id) return;
  const p = store.find('projects', params.id);
  root.querySelector('[data-edit]')?.addEventListener('click', () => openProjectForm(p));
  mountAttachments(root, 'projects', p.id);
  root.querySelector('[data-invoice]')?.addEventListener('click', () => app.quickCreate('invoice', { customerId: p.customerId, projectId: p.id }));
}
