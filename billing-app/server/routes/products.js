const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/products?search=xyz
router.get('/', (req, res) => {
  const search = (req.query.search || '').trim();
  let rows;
  if (search) {
    rows = db.prepare(
      `SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? ORDER BY name`
    ).all(`%${search}%`, `%${search}%`);
  } else {
    rows = db.prepare(`SELECT * FROM products ORDER BY name`).all();
  }
  res.json(rows);
});

// GET /api/products/:barcode
router.get('/:barcode', (req, res) => {
  const row = db.prepare(`SELECT * FROM products WHERE barcode = ?`).get(req.params.barcode);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
});

// POST /api/products  (create or update - upsert by barcode)
router.post('/', (req, res) => {
  const { barcode, name, price, stock, category, low_stock_threshold } = req.body;
  if (!barcode || !name || price === undefined) {
    return res.status(400).json({ error: 'barcode, name, and price are required' });
  }
  const existing = db.prepare(`SELECT barcode FROM products WHERE barcode = ?`).get(barcode);
  if (existing) {
    db.prepare(`
      UPDATE products
      SET name = ?, price = ?, stock = ?, category = ?, low_stock_threshold = ?, updated_at = datetime('now')
      WHERE barcode = ?
    `).run(name, price, stock ?? 0, category || '', low_stock_threshold ?? 5, barcode);
  } else {
    db.prepare(`
      INSERT INTO products (barcode, name, price, stock, category, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(barcode, name, price, stock ?? 0, category || '', low_stock_threshold ?? 5);
  }
  const row = db.prepare(`SELECT * FROM products WHERE barcode = ?`).get(barcode);
  res.json({ updated: !!existing, product: row });
});

// DELETE /api/products/:barcode
router.delete('/:barcode', (req, res) => {
  const result = db.prepare(`DELETE FROM products WHERE barcode = ?`).run(req.params.barcode);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ deleted: true });
});

module.exports = router;
