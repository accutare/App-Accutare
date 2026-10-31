// Global search box in the top bar.
import * as store from './store.js';
import { esc, money, fmtDate } from './utils.js';

function results(q) {
  const s = store.get();
  q = q.toLowerCase().trim();
  if (q.length < 2) return [];
  const has = (...v) => v.some((x) => String(x ?? '').toLowerCase().includes(q));
  const out = [];
  const push = (type, label, sub, href) => out.length < 40 && out.push({ type, label, sub, href });
  for (const c of s.customers) if (has(c.name, c.email, c.phone)) push('Customer', c.name, c.email, `#/customers/${c.id}`);
  for (const v of s.vendors) if (has(v.name, v.email)) push('Supplier', v.name, v.email, `#/vendors/${v.id}`);
  for (const i of s.invoices) if (has(i.number, store.customerName(i.customerId), ...i.lines.map((l) => l.description))) push('Invoice', `#${i.number} · ${store.customerName(i.customerId)}`, `${fmtDate(i.date)} · ${money(store.invoiceTotals(i).total, store.invoiceCurrency(i))}`, `#/invoices/${i.id}`);
  for (const e of s.estimates) if (has(e.number, store.customerName(e.customerId))) push('Estimate', `E-${e.number} · ${store.customerName(e.customerId)}`, fmtDate(e.date), `#/estimates/${e.id}`);
  for (const b of s.bills) if (has(b.number, store.vendorName(b.vendorId), ...b.lines.map((l) => l.description))) push('Bill', `${store.vendorName(b.vendorId)} ${b.number}`, `${fmtDate(b.date)} · ${money(store.billTotals(b).total)}`, `#/bills/${b.id}`);
  for (const e of s.expenses) if (has(e.payee, e.category, e.notes, e.amount)) push('Expense', e.payee, `${fmtDate(e.date)} · ${e.category} · ${money(e.amount)}`, '#/expenses');
  for (const p of s.products) if (has(p.name, p.description)) push('Product', p.name, money(p.price), '#/products');
  for (const p of s.projects) if (has(p.name)) push('Project', p.name, store.customerName(p.customerId), `#/projects/${p.id}`);
  for (const t of s.bankTransactions) if (has(t.description, t.amount)) push('Bank', t.description, `${fmtDate(t.date)} · ${money(t.amount)}`, '#/banking');
  for (const c of s.creditNotes) if (has(c.number, store.customerName(c.customerId))) push('Credit', `${c.number} · ${store.customerName(c.customerId)}`, fmtDate(c.date), `#/credits/${c.id}`);
  for (const a of s.accounts) if (has(a.name, a.code)) push('Account', `${a.code} ${a.name}`, '', `#/accounts/${a.id}`);
  return out;
}

export function mountSearch(el) {
  el.innerHTML = `<input type="search" placeholder="Search everything…" aria-label="Search"><div class="search-results" hidden></div>`;
  const input = el.querySelector('input'), box = el.querySelector('.search-results');
  let idx = -1;
  const draw = () => {
    const r = results(input.value);
    idx = -1;
    box.hidden = !input.value.trim();
    box.innerHTML = r.length ? r.map((x) => `<a href="${x.href}"><span class="tag">${x.type}</span><span><strong>${esc(x.label)}</strong><small>${esc(x.sub || '')}</small></span></a>`).join('') : '<p class="muted">No matches</p>';
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    const links = [...box.querySelectorAll('a')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, Math.min(links.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1))); links.forEach((a, i) => a.classList.toggle('sel', i === idx)); }
    if (e.key === 'Enter' && links.length) { location.hash = (links[idx] || links[0]).getAttribute('href'); close(); }
    if (e.key === 'Escape') close();
  });
  const close = () => { box.hidden = true; input.value = ''; input.blur(); };
  box.addEventListener('click', (e) => { if (e.target.closest('a')) setTimeout(close, 0); });
  document.addEventListener('click', (e) => { if (!el.contains(e.target)) box.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
}
