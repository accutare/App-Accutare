import * as store from '../store.js';
import { money, esc, icon } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState, searchBox, bindFilter } from '../ui.js';

export const title = 'Products & services';

function openProductForm(existing) {
  const co = store.get().company;
  const spec = [
    { name: 'name', label: 'Name', required: true, full: true },
    { name: 'price', label: 'Sales price / rate', type: 'number', step: '0.01', required: true },
    { name: 'vatRate', label: 'VAT %', type: 'number', step: 'any', value: co.vatRate },
    { name: 'description', label: 'Description (shown on invoices)', type: 'textarea', full: true, rows: 2 },
  ];
  openModal({
    title: existing ? 'Edit product / service' : 'New product / service',
    body: `<form>${fields(spec, existing || {})}<footer class="modal-foot">
      ${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (confirmDialog(`Delete ${existing.name}?`)) { store.remove('products', existing.id); closeModal(); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        store.upsert('products', { ...(existing || {}), ...readForm(form) });
        closeModal();
        toast('Saved');
      });
    },
  });
}

export function render() {
  const s = store.get();
  const rows = [...s.products].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="toolbar">${searchBox('Search products')}<button class="btn primary" data-new>${icon('plus')} New</button></div>
    ${rows.length ? `<div class="card table-card"><table class="table">
      <thead><tr><th>Name</th><th class="hide-sm">Description</th><th class="num">VAT</th><th class="num">Price</th></tr></thead>
      <tbody data-rows>${rows.map((p) => `<tr data-id="${p.id}"><td><strong>${esc(p.name)}</strong></td>
        <td class="hide-sm muted">${esc(p.description)}</td><td class="num">${p.vatRate}%</td><td class="num">${money(p.price, s.company.currency)}</td></tr>`).join('')}</tbody>
      </table></div>` : emptyState('No products or services yet.')}`;
}

export function mount(root) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openProductForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) =>
    tr.addEventListener('click', () => openProductForm(store.find('products', tr.dataset.id))));
}
