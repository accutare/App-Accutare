import * as store from '../store.js';
import { calcPay } from '../payroll.js';
import { money, esc, fmtDate, today, icon, round2 } from '../utils.js';
import { openModal, closeModal, fields, readForm, toast, confirmDialog, emptyState } from '../ui.js';

export const title = 'Payroll';

function openEmployeeForm(existing) {
  openModal({
    title: existing ? 'Edit employee' : 'Add employee',
    body: `<form>${fields([
      { name: 'name', label: 'Full name', required: true, full: true },
      { name: 'email', label: 'Email', type: 'email' }, { name: 'niNumber', label: 'NI number' },
      { name: 'taxCode', label: 'Tax code', value: '1257L' }, { name: 'salary', label: 'Annual salary', type: 'number', step: '0.01', required: true },
      { name: 'pensionEe', label: 'Employee pension %', type: 'number', step: 'any', value: 5 },
      { name: 'pensionEr', label: 'Employer pension %', type: 'number', step: 'any', value: 3 },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'active', label: 'Status', type: 'select', options: [['1', 'Active'], ['', 'Left']] },
    ], { ...(existing || {}), active: existing && !existing.active ? '' : '1' })}
    <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></footer></form>`,
    onMount: (m) => m.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = readForm(e.target);
      store.upsert('employees', { ...(existing || {}), ...d, active: d.active === '1' });
      closeModal(); toast('Employee saved');
    }),
  });
}

function openRun() {
  const s = store.get();
  const emps = s.employees.filter((e) => e.active);
  if (!emps.length) return toast('Add an employee first');
  const d = new Date();
  const period = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  openModal({
    title: 'Run payroll', wide: true,
    body: `<form>${fields([
      { name: 'period', label: 'Pay period', value: period, required: true },
      { name: 'date', label: 'Pay date', type: 'date', value: lastDay, required: true },
      { name: 'accountId', label: 'Pay from', type: 'select', options: store.bankAccounts().map((a) => [a.id, a.name]) },
    ])}
    <div class="table-scroll"><table class="table lines"><thead><tr><th>Employee</th><th>Salary</th><th>Extra (bonus/overtime)</th><th class="num">PAYE</th><th class="num">Emp. NI</th><th class="num">Pension</th><th class="num">Net pay</th><th class="num">Employer NI</th></tr></thead>
    <tbody>${emps.map((e) => `<tr data-emp="${e.id}"><td><strong>${esc(e.name)}</strong><small class="muted">${esc(e.taxCode)}</small></td>
      <td><input type="number" step="0.01" data-k="basic" value="${round2(e.salary / 12)}"></td><td><input type="number" step="0.01" data-k="extra" value="0"></td>
      <td class="num" data-o="tax"></td><td class="num" data-o="eeNI"></td><td class="num" data-o="eePension"></td><td class="num" data-o="net"></td><td class="num" data-o="erNI"></td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="6"><strong>Total cost to business</strong></td><td colspan="2" class="num"><strong data-total></strong></td></tr></tfoot></table></div>
    <p class="muted small">Estimates using 2026/27 rates (month 1 basis). Submit the FPS to HMRC through RTI-recognised payroll software.</p>
    <footer class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Approve & record</button></footer></form>`,
    onMount(m) {
      const form = m.querySelector('form');
      const lines = () => [...form.querySelectorAll('[data-emp]')].map((tr) => {
        const e = store.find('employees', tr.dataset.emp);
        const gross = Number(tr.querySelector('[data-k=basic]').value || 0) + Number(tr.querySelector('[data-k=extra]').value || 0);
        return { tr, line: { employeeId: e.id, ...calcPay(e, gross) } };
      });
      const calc = () => {
        let total = 0;
        for (const { tr, line } of lines()) {
          for (const k of ['tax', 'eeNI', 'eePension', 'net', 'erNI']) tr.querySelector(`[data-o=${k}]`).textContent = money(line[k]);
          total += line.gross + line.erNI + line.erPension;
        }
        form.querySelector('[data-total]').textContent = money(total);
      };
      form.addEventListener('input', calc);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        store.upsert('payRuns', { ...readForm(form), lines: lines().map((x) => x.line) });
        closeModal(); toast('Pay run recorded');
      });
      calc();
    },
  });
}

function payslip(run, line) {
  const e = store.find('employees', line.employeeId) || {};
  const co = store.get().company;
  openModal({
    title: `Payslip · ${e.name}`,
    body: `<div class="payslip"><header><strong>${esc(co.name)}</strong><span>${esc(run.period)} · paid ${fmtDate(run.date)}</span></header>
      <p>${esc(e.name)} · NI ${esc(e.niNumber || '—')} · Tax code ${esc(e.taxCode)}</p>
      <table class="table"><tbody><tr><td>Gross pay</td><td class="num">${money(line.gross)}</td></tr>
      <tr><td>Income tax (PAYE)</td><td class="num">−${money(line.tax)}</td></tr><tr><td>National Insurance</td><td class="num">−${money(line.eeNI)}</td></tr>
      <tr><td>Pension</td><td class="num">−${money(line.eePension)}</td></tr><tr class="grand"><td>Net pay</td><td class="num">${money(line.net)}</td></tr>
      <tr class="muted"><td>Employer pension contribution</td><td class="num">${money(line.erPension)}</td></tr></tbody></table></div>
      <footer class="modal-foot no-print"><button class="btn" onclick="window.print()">${icon('print', 16)} Print</button></footer>`,
  });
}

export function render() {
  const s = store.get();
  const cur = s.company.currency;
  const runs = [...s.payRuns].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="toolbar"><h3 style="margin:0">Employees</h3><div class="actions"><button class="btn" data-new-emp>${icon('plus')} Add employee</button><button class="btn primary" data-run>Run payroll</button></div></div>
    ${s.employees.length ? `<div class="card table-card"><table class="table"><thead><tr><th>Name</th><th class="hide-sm">Tax code</th><th class="hide-sm">NI number</th><th class="num">Salary</th><th>Status</th></tr></thead>
    <tbody>${s.employees.map((e) => `<tr data-emp="${e.id}"><td><strong>${esc(e.name)}</strong></td><td class="hide-sm">${esc(e.taxCode)}</td><td class="hide-sm">${esc(e.niNumber)}</td>
      <td class="num">${money(e.salary, cur)}</td><td>${e.active ? '<span class="badge badge-paid">Active</span>' : '<span class="badge badge-draft">Left</span>'}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No employees yet.')}
    <h3>Pay runs</h3>
    ${runs.length ? runs.map((r) => `<div class="card"><div class="card-head"><h3>${esc(r.period)} <small class="muted">· paid ${fmtDate(r.date)}</small></h3>
      <button class="icon-btn" data-del-run="${r.id}" aria-label="Delete pay run">${icon('trash', 16)}</button></div>
      <ul class="list">${r.lines.map((l, i) => `<li><div><strong>${esc(store.find('employees', l.employeeId)?.name || '?')}</strong><small>Gross ${money(l.gross, cur)} · PAYE ${money(l.tax, cur)} · NI ${money(l.eeNI, cur)}</small></div>
        <div class="actions"><strong>${money(l.net, cur)}</strong><button class="btn sm" data-slip="${r.id}:${i}">Payslip</button></div></li>`).join('')}</ul></div>`).join('')
      : '<p class="muted">No pay runs yet.</p>'}`;
}

export function mount(root) {
  root.querySelector('[data-new-emp]').addEventListener('click', () => openEmployeeForm());
  root.querySelector('[data-run]').addEventListener('click', openRun);
  root.querySelectorAll('tr[data-emp]').forEach((tr) => tr.addEventListener('click', () => openEmployeeForm(store.find('employees', tr.dataset.emp))));
  root.querySelectorAll('[data-slip]').forEach((b) => b.addEventListener('click', () => {
    const [rid, i] = b.dataset.slip.split(':'); const r = store.find('payRuns', rid); payslip(r, r.lines[Number(i)]);
  }));
  root.querySelectorAll('[data-del-run]').forEach((b) => b.addEventListener('click', () => { if (confirmDialog('Delete this pay run?')) store.remove('payRuns', b.dataset.delRun); }));
}
