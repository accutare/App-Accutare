import * as store from '../store.js';
import { fields, readForm, toast, confirmDialog } from '../ui.js';

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
      ], co)}
      <footer class="modal-foot"><button class="btn primary">Save settings</button></footer>
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
