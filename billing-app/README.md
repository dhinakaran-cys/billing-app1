# 🧾 BillEasy — Barcode Billing App (v2)

A full billing application with:
- **SQLite database** backend (Node.js + Express + better-sqlite3) — products, sales, invoice line items, and settings are stored properly in `data/billing.db`, not just the browser.
- **Attractive dashboard** — today's revenue & orders, all-time revenue, product count, low-stock alerts, a 7-day revenue trend chart, top-selling products chart, low-stock list, and recent sales — all live from the database.
- **Light/dark theme** toggle (🌙/☀️ button, top right) — remembers your choice, and also respects your OS preference on first load.
- Barcode scanning (camera) to **add products** and **bill sales**.
- Checkout **prints an invoice to a Bluetooth (BLE) thermal receipt printer** via the Web Bluetooth API + ESC/POS commands.
- Clean sidebar navigation: Dashboard · Billing · Products · Sales History · Printer Setup.

## 📁 Project Structure
```
billing-app/
├── package.json
├── data/                    # SQLite database file lives here (auto-created)
├── server/                  # Backend (Node + Express + SQLite)
│   ├── index.js              # Express app entrypoint
│   ├── db.js                  # DB connection + schema
│   └── routes/
│       ├── products.js
│       ├── sales.js
│       ├── settings.js
│       └── dashboard.js
└── public/                  # Frontend (static, served by Express)
    ├── index.html
    ├── css/style.css          # Theme (CSS variables, light/dark)
    └── js/
        ├── api.js              # REST client for the backend
        ├── barcode.js           # Camera barcode scanning (html5-qrcode)
        ├── printer.js            # Web Bluetooth + ESC/POS printer driver
        ├── dashboard.js           # Dashboard charts (Chart.js)
        ├── products.js            # Add/edit/list products
        ├── billing.js              # Cart, checkout, sales history
        └── app.js                   # Tabs, theme toggle, bootstrap
```

## ▶️ Running it

Requires **Node.js 18+**.

```bash
cd billing-app
npm install
npm start
```

Then open **http://localhost:3000** in Chrome or Edge.

(`npm run dev` uses `node --watch` to auto-restart the server on file changes, useful while customizing.)

> **Why a real server now?** Web Bluetooth + camera access both require a secure context — `localhost` counts. The Express server serves the frontend AND the API from one place, so you only need one command (`npm start`) to run everything: UI, database, and API.

To use it on your **phone** at a shop counter: host it over HTTPS (Render, Railway, a VPS with a reverse proxy, etc.), or run it on a laptop and open `http://<laptop-ip>:3000` from Chrome on Android (for LAN-only testing without HTTPS, you may need `chrome://flags/#unsafely-treat-insecure-origin-as-secure` on the phone, adding your laptop's `http://<ip>:3000`).

> **iOS note:** Apple does not support Web Bluetooth in any iOS browser (including Chrome for iOS, which uses Safari's engine). For iPhone counters, use a printer with AirPrint/network printing instead of BLE.

## 🗄 Database

Uses **SQLite** via `better-sqlite3` — a single file (`data/billing.db`), no separate database server to install or manage. Tables:
- `products` — barcode (PK), name, price, stock, low_stock_threshold
- `sales` — invoice_no, date, customer info, totals
- `sale_items` — line items per sale (linked to `sales`)
- `shop_settings` / `printer_settings` — single-row config tables

Checkout is wrapped in a **database transaction**: stock validation, sale insert, line-item inserts, and stock deduction either all succeed or all roll back — so a failed print or a crash mid-checkout can't leave half-finished data.

To back up your data, just copy `data/billing.db` somewhere safe. To reset everything, stop the server and delete `data/billing.db` (it will be recreated empty on next start).

## 📊 Dashboard

The Dashboard tab (now the default landing page) shows:
- **KPI cards**: today's revenue, today's order count, all-time revenue, total products, low-stock count
- **Revenue trend** (line chart, last 7 days)
- **Top-selling products** (bar chart, by units sold, all-time)
- **Low stock list** — any product at/below its stock threshold (default: 5 units, editable per-product via the API if you extend the UI)
- **Recent sales** — last 5 invoices

It refreshes automatically after every checkout, product save, or theme change.

## 🎨 Theme

Click the 🌙/☀️ icon (top right) to switch between light and dark mode. The whole UI — sidebar, cards, charts, forms — re-themes via CSS variables in `public/css/style.css` (`:root` = light, `[data-theme="dark"]` = dark overrides). Your choice is saved in the browser and restored next visit; first-time visitors get whichever mode matches their OS setting.

To customize colors, edit the CSS variables at the top of `style.css` (`--primary`, `--bg`, `--surface`, etc.) — everything else references them.

## 🖨 Connecting your Bluetooth printer

1. Pair your BLE thermal printer (58mm or 80mm) with your device via OS Bluetooth settings first (if it needs a PIN).
2. Go to **Printer Setup**, fill in Shop Name/Address/Phone/GST/footer → **Save Shop Details**.
3. Click **Connect Printer** and pick your printer from the browser's device picker.
4. Click **Test Print** to confirm.

### If your printer isn't detected
Cheap BLE thermal printers vary by manufacturer. Defaults used:
- Service UUID: `000018f0-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `00002af1-0000-1000-8000-00805f9b34fb`

If connecting fails, find your printer's actual BLE service/characteristic UUIDs (check the manufacturer's SDK docs, or inspect the printer with a BLE scanner app like "nRF Connect") and enter them under **Advanced** in Printer Setup, then reconnect. Also set the correct **Paper width** (58mm = 32 chars, 80mm = 48 chars).

## 🧑‍💻 How to use

### Add a product
**Products** tab → 📷 Scan (or type barcode) → fill name/price/stock → **Save Product**. Scanning an existing barcode auto-fills the form for editing (e.g. restocking).

### Bill a sale
**Billing** tab → scan each item (or type barcode + Enter) → adjust qty/tax/discount → optional customer info → **Checkout & Print**. This saves the sale to SQLite, deducts stock, and auto-prints if a printer is connected.

### Reprint a past invoice
**Sales History** tab → **🖨 Reprint** next to any past sale.

## 🔧 Customizing the receipt
Edit `public/js/printer.js` → `buildInvoice()` to change the receipt layout — it builds raw ESC/POS byte commands, so you have full control (fonts, alignment, a logo via raster bitmap commands, a QR code on the receipt, etc.).

## ⚠️ Known limitations
- Single-till, local-network app by design — no multi-user login. Add auth if you need multiple counters syncing to one shared database over a network.
- iOS is not supported for Bluetooth printing (Apple platform restriction).
- BLE printer protocols aren't fully standardized — some printers need custom UUIDs/commands.
