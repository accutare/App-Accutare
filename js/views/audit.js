import * as store from '../store.js';
import { esc } from '../utils.js';
import { emptyState, searchBox, bindFilter } from '../ui.js';

export const title = 'Audit log';
const NAMES = { invoices: 'Invoice', estimates: 'Estimate', bills: 'Bill', expenses: 'Expense', customers: 'Customer', vendors: 'Supplier', products: 'Product', journals: 'Journal',
  bankTransactions: 'Bank line', payRuns: 'Pay run', employees: 'Employee', creditNotes: 'Credit note', salesReceipts: 'Sales receipt', vendorCredits: 'Supplier credit',
  purchaseOrders: 'Purchase order', accounts: 'Account', settings: 'Settings', assets: 'Fixed asset', budgets: 'Budget', bankRules: 'Bank rule', trips: 'Trip', timeEntries: 'Time',
  projects: 'Project', recurring: 'Recurring template', otherIncome: 'Income', stockAdjustments: 'Stock adjustment', vatReturns: 'VAT return' };

export function render() {
  const rows = [...store.get().auditLog].reverse().slice(0, 1000);
  return `<div class="toolbar">${searchBox('Filter by user, type or name')}<span class="muted">Latest ${rows.length} changes</span></div>
    ${rows.length ? `<div class="card table-card"><table class="table"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th></tr></thead>
    <tbody data-rows>${rows.map((r) => `<tr><td>${new Date(r.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(r.user)}</td>
      <td><span class="badge badge-${r.action === 'deleted' ? 'overdue' : r.action === 'created' ? 'paid' : 'open'}">${r.action}</span></td>
      <td>${esc(NAMES[r.coll] || r.coll)} ${esc(r.label)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No changes recorded yet.')}`;
}
export function mount(root) { bindFilter(root); }
