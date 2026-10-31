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
    { name: 'trackStock', label: 'Track stock?', type: 'select', options: [['', 'No – service / non-stock'], ['1', 'Yes – track quantity']] },
    { name: 'cost', label: 'Purchase cost (per unit)', type: 'number', step: '0.01' },
    { name: 'openingQty', label: 'Opening quantity', type: 'number', step: 'any' },
    { name: 'reorderPoint', label: 'Reorder when at or below', type: 'number', step: 'any' },
  ];
  openModal({
    title: existing ? 'Edit product / service' : 'New product / service',
    body: `<form>${fields(spec, { ...(existing || {}), trackStock: existing?.trackStock ? '1' : '' })}
      ${existing?.trackStock ? `<p><strong>On hand: ${store.stockOnHand(existing.id)}</strong> <button type="button" class="link-btn" data-adjust>Adjust stock</button></p>` : ''}
      <footer class="modal-foot">
      ${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 16)}</button>` : ''}
      <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      form.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (confirmDialog(`Delete ${existing.name}?`)) { store.remove('products', existing.id); closeModal(); }
      });
      form.querySelector('[data-adjust]')?.addEventListener('click', () => {
        const q = Number(prompt('Quantity to add (use a negative number to remove, e.g. damaged stock):', '0'));
        if (!q) return;
        const reason = prompt('Reason (e.g. delivery received, stock count):', q > 0 ? 'Delivery received' : 'Stock count') || '';
        store.upsert('stockAdjustments', { productId: existing.id, qty: q, reason, date: new Date().toISOString().slice(0, 10) });
        closeModal(); openProductForm(store.find('products', existing.id));
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = readForm(form);
        store.upsert('products', { ...(existing || {}), ...d, trackStock: d.trackStock === '1' });
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
      <thead><tr><th>Name</th><th class="hide-sm">Description</th><th class="num">On hand</th><th class="num hide-sm">VAT</th><th class="num">Price</th></tr></thead>
      <tbody data-rows>${rows.map((p) => `<tr data-id="${p.id}"><td><strong>${esc(p.name)}</strong></td>
        <td class="hide-sm muted">${esc(p.description)}</td><td class="num">${p.trackStock ? (store.stockOnHand(p.id) <= (p.reorderPoint || 0) ? `<span class="neg">${store.stockOnHand(p.id)} ⚠</span>` : store.stockOnHand(p.id)) : '—'}</td><td class="num hide-sm">${p.vatRate}%</td><td class="num">${money(p.price, s.company.currency)}</td></tr>`).join('')}</tbody>
      </table></div>` : emptyState('No products or services yet.')}`;
}

export function mount(root) {
  bindFilter(root);
  root.querySelector('[data-new]')?.addEventListener('click', () => openProductForm());
  root.querySelectorAll('tr[data-id]').forEach((tr) =>
    tr.addEventListener('click', () => openProductForm(store.find('products', tr.dataset.id))));
}
