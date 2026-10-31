# Accutare

Accounting for UK small businesses: sales, purchases, banking, payroll, VAT and full double-entry reports.

## Features

**Sales:** invoices (multi-currency, line discounts, projects, stock check), estimates → invoices, sales receipts (cash/card sales), credit notes, payments on account (deposits/overpayments) applied to invoices, refunds, one payment spread over several invoices, recurring invoices, email sending and overdue reminders, online payment link, branded documents (logo, colour, bank details), customer statements.

**Purchases:** bills, purchase orders (receive stock, convert to bill), supplier credits, pay several bills at once, expenses with receipt photos and automatic receipt reading (OCR), suppliers.

**Banking:** multiple bank and credit-card accounts, CSV and OFX/QFX statement import, review queue with suggested matches, bank rules (auto-categorise / auto-add), split transactions, transfers, undo, reconciliation.

**Work:** projects with profitability, time tracking with timer and "invoice unbilled time", HMRC mileage (45p/25p), stock with reorder alerts.

**Payroll:** employees, monthly pay runs with PAYE, employee/employer NI and pension (2026/27 rates), payslips.

**Accounting:** chart of accounts, double-entry general ledger generated from every transaction, manual journals, account registers, fixed assets with automatic monthly depreciation, closing date with password, annual budgets, audit log of every change.

**Reports (CSV export / print / save):** profit & loss (by month, vs previous period/year, by project), balance sheet (with comparison), cash flow, trial balance, general ledger, journal, AR/AP ageing, open invoices, unpaid bills, sales by customer/product, expenses by category/supplier, time, mileage, payroll, project profitability, stock valuation, budget vs actual, fixed asset register, VAT 9 boxes. VAT returns by quarter with filing lock.

**System:** global search (press `/`), file attachments on invoices, bills, estimates, customers and projects, import customers/suppliers/products from CSV, several companies per login, English and Portuguese interface (documents sent to customers stay in English).

**Cloud & team:** sign-up/sign-in, books stored on the server, team members with roles (owner, admin, standard, accountant, sales only, purchases only, viewer), conflict detection, daily backups. Without the server the app runs in local mode (browser storage).

## Run

Requires Node 18+. No dependencies to install.

```bash
npm start
```

Open http://localhost:8080 and create your company account. Options: `PORT`, `DATA_DIR` (default `server/data`, keep it backed up). In production run behind HTTPS (e.g. Caddy or nginx).

Static only (local mode, no login): serve the folder with any web server, e.g. `python3 -m http.server`.

## Integrations that need third-party accounts

These are not wired up yet because they need credentials only the business can obtain:

| Feature | What's needed |
| --- | --- |
| Automatic bank feeds | Open Banking provider (e.g. TrueLayer, Plaid, GoCardless Bank Account Data) — import into `importBankTransactions()` in `js/store.js` |
| VAT submission (MTD) | Register the software with HMRC Developer Hub, OAuth with Government Gateway; the 9 boxes come from `vatReturn()` |
| Payroll RTI (FPS/EPS) | HMRC RTI-recognised submission or a payroll bureau |
| Card payments on invoices | Stripe / GoCardless account — paste a payment link in Settings today |
| Sending email from the server | SMTP / email API — today invoices open in the user's email app |

Payroll and VAT figures are estimates; check them with your accountant.

Note: in cloud mode the books are saved as one document per company, so per-area roles (sales only / purchases only) limit what people see and do in the app; the server enforces read-only vs write access.

## Code map

```
server/server.js     HTTP server, auth, cloud data, users (no dependencies)
js/app.js            router, navigation, CSV export
js/store.js          data + business logic (invoices, bills, banking, VAT, stock, mileage…)
js/ledger.js         double-entry journal and accounting reports
js/payroll.js        UK PAYE / NI calculations
js/recurring.js      recurring invoice engine
js/receipts.js       receipt photo compression + OCR
js/sync.js           sign-in and server sync
js/views/*.js        one file per screen
css/styles.css       styles (brand colours at the top)
```
