# Accutare

Simple accounting app for small businesses: invoices, expenses, customers, products/services and reports (profit & loss, VAT summary, receivables ageing).

- No build step, no backend — plain HTML/CSS/JavaScript (ES modules).
- Data is stored in the browser (`localStorage`). Use **Settings → Export backup** to save it.
- Installable on phones as an app (PWA): open it in Safari/Chrome and choose "Add to Home Screen".
- Comes with demo data on first run (Settings → Erase all data to start clean).

## Run locally

ES modules need an HTTP server (opening `index.html` directly will not work):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Structure

```
index.html            app shell (sidebar, top bar, mobile bottom nav)
css/styles.css        all styles (brand colours are CSS variables at the top)
js/app.js             router and navigation
js/store.js           data layer + business logic (totals, VAT, P&L)
js/ui.js              modal, toast, form helpers
js/utils.js           formatting helpers and icons
js/views/*.js         one file per screen
icons/                app icon
```

## Where to customise

- **Colours / branding:** `--brand` variables in `css/styles.css`, logo in `icons/icon.svg`.
- **Expense categories:** `EXPENSE_CATEGORIES` in `js/store.js`.
- **Add a backend:** replace `load`/`save` in `js/store.js` with API calls.
