// Reusable UI pieces: modal, toast, confirm, form helpers, status badges.
import { esc, icon } from './utils.js';

const modalRoot = () => document.getElementById('modal-root');

export function openModal({ title, body, wide = false, onMount }) {
  modalRoot().innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="modal-head">
          <h2>${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
        </header>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
  const backdrop = modalRoot().firstElementChild;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('button[data-close]')) closeModal();
  });
  document.addEventListener('keydown', escHandler);
  const modal = backdrop.querySelector('.modal');
  onMount?.(modal);
  modal.querySelector('input, select, textarea')?.focus();
  return modal;
}

function escHandler(e) { if (e.key === 'Escape') closeModal(); }

export function closeModal() {
  modalRoot().innerHTML = '';
  document.removeEventListener('keydown', escHandler);
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2400);
}

export const confirmDialog = (msg) => window.confirm(msg);

/**
 * Render form fields from a spec.
 * field: { name, label, type?, options?, required?, step?, full?, rows?, placeholder? }
 */
export function fields(spec, data = {}) {
  return `<div class="form-grid">${spec.map((f) => {
    const v = data[f.name] ?? f.value ?? '';
    const req = f.required ? 'required' : '';
    let input;
    if (f.type === 'select') {
      input = `<select name="${f.name}" ${req}>${f.options.map((o) => {
        const [val, lab] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(v)}</textarea>`;
    } else {
      input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.step ? `step="${f.step}"` : ''} placeholder="${esc(f.placeholder || '')}" ${req}>`;
    }
    return `<label class="field ${f.full ? 'full' : ''}"><span>${esc(f.label)}</span>${input}</label>`;
  }).join('')}</div>`;
}

export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value.trim();
  }
  return out;
}

const STATUS_LABEL = { draft: 'Draft', open: 'Open', partial: 'Partially paid', overdue: 'Overdue', paid: 'Paid' };
export const badge = (status) => `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;

export const emptyState = (text, actionHtml = '') =>
  `<div class="empty"><p>${esc(text)}</p>${actionHtml}</div>`;

export const searchBox = (placeholder) =>
  `<label class="search">${icon('search', 18)}<input type="search" data-filter placeholder="${esc(placeholder)}"></label>`;

/** Wire a [data-filter] input to hide rows in [data-rows] that don't match. */
export function bindFilter(root) {
  const input = root.querySelector('[data-filter]');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    root.querySelectorAll('[data-rows] > *').forEach((row) => {
      row.hidden = q && !row.textContent.toLowerCase().includes(q);
    });
  });
}
