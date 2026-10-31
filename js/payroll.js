// UK payroll calculations (England/NI rates, tax year 2026/27, monthly pay, non-cumulative basis).
// These are estimates for planning — a payroll bureau or HMRC-recognised software must make RTI submissions.
import { round2 } from './utils.js';

export const RATES = {
  basicBand: 37700, higherLimit: 125140, basic: 0.2, higher: 0.4, additional: 0.45,
  niPT: 1048, niUEL: 4189, niMain: 0.08, niUpper: 0.02, // employee, per month
  niST: 417, niEr: 0.15, // employer, per month
};

/** Monthly tax-free pay from a tax code, plus flat-rate codes. */
function parseCode(code = '1257L') {
  const c = String(code).toUpperCase().replace(/\s|W1|M1|X/g, '');
  if (c === 'NT') return { nt: true };
  if (c === 'BR') return { flat: 0.2 };
  if (c === 'D0') return { flat: 0.4 };
  if (c === 'D1') return { flat: 0.45 };
  if (c === '0T') return { allowance: 0 };
  const k = c.match(/^K(\d+)/);
  if (k) return { allowance: -(Number(k[1]) * 10 + 9) / 12 };
  const n = c.match(/^(\d+)[LMNT]?$/);
  return { allowance: n ? (Number(n[1]) * 10 + 9) / 12 : 12579 / 12 };
}

export function calcPay(emp, gross) {
  gross = round2(gross);
  const R = RATES;
  const code = parseCode(emp.taxCode);
  const eePension = round2(gross * Number(emp.pensionEe || 0) / 100); // relief at source assumed
  const erPension = round2(gross * Number(emp.pensionEr || 0) / 100);
  let tax = 0;
  if (code.flat) tax = gross * code.flat;
  else if (!code.nt) {
    const taxable = Math.max(0, Math.floor(gross - code.allowance));
    const b = R.basicBand / 12, h = (R.higherLimit - 12570 - R.basicBand) / 12;
    tax = Math.min(taxable, b) * R.basic + Math.min(Math.max(taxable - b, 0), h) * R.higher + Math.max(taxable - b - h, 0) * R.additional;
  }
  tax = round2(Math.floor(tax * 100) / 100);
  const eeNI = round2(Math.max(0, Math.min(gross, R.niUEL) - R.niPT) * R.niMain + Math.max(0, gross - R.niUEL) * R.niUpper);
  const erNI = round2(Math.max(0, gross - R.niST) * R.niEr);
  const net = round2(gross - tax - eeNI - eePension);
  return { gross, tax, eeNI, erNI, eePension, erPension, net };
}
