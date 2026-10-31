import * as store from '../store.js';
import { fields, readForm, toast, confirmDialog } from '../ui.js';
import { compressImage } from '../receipts.js';

export const title = 'Settings';

export function render() {
  const co = store.get().company;
  return `
    <form class="card" data-company>
      <h3>Company details</h3>
      ${fields([
        { name: 'name', label: 'Company name', required: true, full: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'address', label: 'Address', type: 'textarea', full: true },
        { name: 'vatNumber', label: 'VAT registration no.' },
        { name: 'currency', label: 'Currency', type: 'select', options: ['GBP', 'EUR', 'USD', 'BRL'] },
        { name: 'vatRate', label: 'Default VAT %', type: 'number', step: 'any' },
        { name: 'paymentTerms', label: 'Payment terms (days)', type: 'number' },
        { name: 'nextInvoiceNumber', label: 'Next invoice number', type: 'number' },
        { name: 'nextEstimateNumber', label: 'Next estimate number', type: 'number' },
        { name: 'fyStartMonth', label: 'Financial year starts (month)', type: 'select', options: [...Array(12)].map((_, i) => [i + 1, new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' })]) },
        { name: 'fyStartDay', label: 'Financial year starts (day)', type: 'number' },
        { name: 'hourlyRate', label: 'Default hourly rate', type: 'number', step: '0.01' },
        { name: 'reminderDays', label: 'Days between payment reminders', type: 'number' },
      ], co)}
      <footer class="modal-foot"><button class="btn primary">Save settings</button></footer>
    </form>

    <form class="card" data-brand>
      <h3>Invoice branding & payments</h3>
      <div class="brand-row"><div class="logo-preview" data-logo-preview>${co.logo ? `<img src="${co.logo}" alt="Logo">` : '<span class="muted">No logo</span>'}</div>
        <div class="actions wrap"><label class="btn">Upload logo<input type="file" accept="image/*" data-logo hidden></label>${co.logo ? '<button type="button" class="btn ghost" data-rm-logo>Remove</button>' : ''}</div></div>
      ${fields([
        { name: 'accentColor', label: 'Accent colour', type: 'color' },
        { name: 'paymentLink', label: 'Online payment link (e.g. Stripe / PayPal / GoCardless)', type: 'url', placeholder: 'https://…' },
        { name: 'paymentDetails', label: 'How to pay (printed on invoices)', type: 'textarea', full: true, placeholder: 'Bank: …\nSort code: 00-00-00\nAccount: 12345678\nReference: invoice number' },
      ], co)}
      <footer class="modal-foot"><button class="btn primary">Save branding</button></footer>
    </form>

    <div class="card">
      <h3>Data</h3>
      <p class="muted">Your data is stored in this browser only. Export a backup regularly.</p>
      <div class="actions wrap">
        <button class="btn" data-export>Export backup (JSON)</button>
        <label class="btn">Import backup<input type="file" accept="application/json" data-import hidden></label>
        <button class="btn" data-demo>Load demo data</button>
        <button class="btn danger" data-reset>Erase all data</button>
      </div>
    </div>`;
}

export function mount(root) {
  root.querySelector('[data-company]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.updateCompany(readForm(e.target));
    toast('Settings saved');
  });
  root.querySelector('[data-brand]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.updateCompany(readForm(e.target));
    toast('Branding saved');
  });
  root.querySelector('[data-logo]').addEventListener('change', async (e) => {
    try { store.updateCompany({ logo: await compressImage(e.target.files[0], 400, 0.85) }); toast('Logo saved'); } catch (err) { toast(err.message); }
  });
  root.querySelector('[data-rm-logo]')?.addEventListener('click', () => store.updateCompany({ logo: '' }));
  root.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `accutare-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });
  root.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { store.importJSON(await file.text()); toast('Backup restored'); } catch (err) { toast(err.message); }
  });
  root.querySelector('[data-demo]').addEventListener('click', () => {
    if (confirmDialog('Replace all data with demo data?')) { store.reset(true); toast('Demo data loaded'); }
  });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (confirmDialog('Erase ALL data? This cannot be undone.')) { store.reset(false); toast('All data erased'); }
  });
}
