// Recurring invoice templates. Runs on app start: creates every invoice that has fallen due.
import { uid, today, addDays } from './utils.js';

export const FREQUENCIES = [['weekly', 'Weekly'], ['fortnightly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['yearly', 'Yearly']];

export function nextDate(date, freq) {
  if (freq === 'weekly') return addDays(date, 7);
  if (freq === 'fortnightly') return addDays(date, 14);
  const d = new Date(date + 'T00:00:00');
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[freq] || 1;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mutates state; returns number of invoices created. */
export function runRecurring(state) {
  let created = 0;
  const t = today();
  for (const r of state.recurring || []) {
    let guard = 0;
    while (r.active && r.nextDate && r.nextDate <= t && (!r.endDate || r.nextDate <= r.endDate) && guard++ < 60) {
      state.invoices.push({
        id: uid(), number: String(state.company.nextInvoiceNumber++), customerId: r.customerId, projectId: r.projectId || '',
        date: r.nextDate, dueDate: addDays(r.nextDate, Number(r.terms ?? state.company.paymentTerms)),
        lines: structuredClone(r.lines), notes: r.notes, payments: [], draft: !!r.asDraft,
        currency: r.currency, rate: r.rate, recurringId: r.id, createdAt: new Date().toISOString(),
      });
      r.lastRun = r.nextDate;
      r.nextDate = nextDate(r.nextDate, r.frequency);
      created++;
    }
    if (r.endDate && r.nextDate > r.endDate) r.active = false;
  }
  return created;
}
