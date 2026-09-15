/* SQLite database connection + schema setup (better-sqlite3 = synchronous, file-based, zero config) */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'billing.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  barcode     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  category    TEXT DEFAULT '',
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no    INTEGER UNIQUE NOT NULL,
  sale_date     TEXT NOT NULL DEFAULT (datetime('now')),
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  subtotal      REAL NOT NULL DEFAULT 0,
  tax_percent   REAL NOT NULL DEFAULT 0,
  tax_amount    REAL NOT NULL DEFAULT 0,
  discount      REAL NOT NULL DEFAULT 0,
  grand_total   REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  barcode     TEXT NOT NULL,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  qty         INTEGER NOT NULL,
  total       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_settings (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  name     TEXT DEFAULT 'My Shop',
  address  TEXT DEFAULT '',
  phone    TEXT DEFAULT '',
  gst      TEXT DEFAULT '',
  footer   TEXT DEFAULT 'Thank you, visit again!'
);

CREATE TABLE IF NOT EXISTS printer_settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  service_uuid  TEXT DEFAULT '000018f0-0000-1000-8000-00805f9b34fb',
  char_uuid     TEXT DEFAULT '00002af1-0000-1000-8000-00805f9b34fb',
  paper_width   INTEGER DEFAULT 48
);

CREATE TABLE IF NOT EXISTS invoice_counter (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  value   INTEGER NOT NULL DEFAULT 1000
);
`);

// Seed singleton rows if empty
db.prepare(`INSERT OR IGNORE INTO shop_settings (id) VALUES (1)`).run();
db.prepare(`INSERT OR IGNORE INTO printer_settings (id) VALUES (1)`).run();
db.prepare(`INSERT OR IGNORE INTO invoice_counter (id, value) VALUES (1, 1000)`).run();

module.exports = db;
