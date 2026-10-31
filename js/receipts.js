// Receipt capture: shrink photos so they fit in local storage, and read them with OCR (Tesseract.js, loaded on demand).

export function compressImage(file, max = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') return reject(new Error('Please upload a photo (JPG/PNG) of the receipt'));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // JPEG has no transparency
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

let loading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { loading = null; reject(new Error('Could not load the OCR engine (are you online?)')); };
    document.head.appendChild(s);
  });
  return loading;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Pull payee, date, total and VAT out of OCR text. Exported for testing. */
export function parseReceiptText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const amounts = (l) => [...l.matchAll(/(?:£|\$|€)?\s?(\d{1,6}[.,]\d{2})(?!\d)/g)].map((m) => Number(m[1].replace(',', '.')));
  let total = null, vat = null, date = null;
  for (const l of lines) {
    const a = amounts(l);
    if (!a.length) continue;
    if (/(grand\s*)?total|amount\s*due|balance\s*due|to\s*pay|card\s*payment|paid/i.test(l) && !/sub\s*-?total/i.test(l)) total = a[a.length - 1];
    if (/\bvat\b|\btax\b/i.test(l) && !/(reg|no\.?|number)\b/i.test(l)) vat = a[a.length - 1];
  }
  if (total === null) { const all = lines.flatMap(amounts); if (all.length) total = Math.max(...all); }
  for (const l of lines) {
    let m = l.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; break; }
    m = l.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{2,4})\b/i);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; date = `${y}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`; break; }
  }
  const payee = lines.find((l) => /[a-z]{3,}/i.test(l) && !/receipt|invoice|tax|vat|tel|www|http|@/i.test(l)) || '';
  if (vat !== null && total !== null && vat >= total) vat = null;
  return { payee: payee.slice(0, 60), date, total, vat };
}

export async function scanReceipt(dataUrl, onProgress) {
  const T = await loadTesseract();
  const { data } = await T.recognize(dataUrl, 'eng', { logger: (m) => m.status === 'recognizing text' && onProgress?.(Math.round(m.progress * 100)) });
  return parseReceiptText(data.text || '');
}
