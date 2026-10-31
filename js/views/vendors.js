import * as store from '../store.js';
import { money, esc, fmtDate, icon } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter, badge } from '../ui.js';

export const title = 'Suppliers';

const SPEC = [
  { name: 'name', label: 'Supplier name', required: true, full: true },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'address', label: 'Address', type: 'textarea', full: true },
  { name: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
];

export function openVendorForm(existing, onSaved) {
  openModal({
    title: existing ? 'Edit supplier' : 'New supplier',
    body: `<form>${fields(SPEC, existing || {})}
      <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const saved = store.upsert('vendors', { ...(existing || {}), ...readForm(e.target) });
      closeModal();
      toast('Supplier saved');
      onSaved?.(saved);
    }),
  });
}

export function render(params) {
  if (params.id) return renderDetail(params.id);
  const s = store.get();
  const rows = [...s.vendors].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="toolbar">${searchBox('Search suppliers')}<button class="btn primary" data-new>${icon('plus')} New supplier</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Name</th><th class="hide-sm">Email</th><th class="hide-sm">Phone</th><th class="num">Open balance</th></tr></thead>
      <tbody data-rows>${rows.map((v) => `<tr data-href="#/vendors/${v.id}"><td><strong>${esc(v.name)}</strong></td>
        <td class="hide-sm">${esc(v.email)}</td><td class="hide-sm">${esc(v.phone)}</td>
        <td class="num">${money(store.vendorBalance(v.id), s.company.currency)}</td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No suppliers yet.')}`;
}

function renderDetail(id) {
  const v = store.find('vendors', id);
  if (!v) return emptyState('Supplier not found.');
  const cur = store.get().company.currency;
  const bills = store.get().bills.filter((b) => b.vendorId === id).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <a class="back" href="#/vendors">← Suppliers</a>
    <div class="card detail-head">
      <div><h2>${esc(v.name)}</h2><p class="muted">${[v.email, v.phone].filter(Boolean).map(esc).join(' · ')}</p><p class="pre">${esc(v.address)}</p></div>
      <div class="right"><span class="muted">You owe</span><strong class="big">${money(store.vendorBalance(id), cur)}</strong>
        <div class="actions"><button class="btn" data-edit>Edit</button><button class="btn danger" data-delete>${icon('trash', 16)}</button><button class="btn primary" data-bill>New bill</button></div></div>
    </div>
    <div class="card table-card"><table class="table">
      <thead><tr><th>Ref</th><th>Date</th><th class="hide-sm">Due</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>${bills.map((b) => `<tr data-href="#/bills/${b.id}"><td>${esc(b.number)}</td><td>${fmtDate(b.date)}</td><td class="hide-sm">${fmtDate(b.dueDate)}</td>
        <td>${badge(store.billStatus(b))}</td><td class="num">${money(store.billTotals(b).total, cur)}</td></tr>`).join('')
        || '<tr><td colspan="5" class="muted">No bills from this supplier.</td></tr>'}</tbody></table></div>`;
}

export function mount(root, params, app) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openVendorForm());
  if (!params.id) return;
  const v = store.find('vendors', params.id);
  if (!v) return;
  root.querySelector('[data-edit]').addEventListener('click', () => openVendorForm(v));
  root.querySelector('[data-bill]').addEventListener('click', () => app.quickCreate('bill', { vendorId: v.id }));
  root.querySelector('[data-delete]').addEventListener('click', () => {
    if (store.get().bills.some((b) => b.vendorId === v.id)) return toast('Cannot delete: supplier has bills');
    if (confirmDialog(`Delete ${v.name}?`)) { store.remove('vendors', v.id); location.hash = '#/vendors'; }
  });
}
