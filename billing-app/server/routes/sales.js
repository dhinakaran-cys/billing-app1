const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/sales  (most recent first)
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const sales = db.prepare(`SELECT * FROM sales ORDER BY id DESC LIMIT ?`).all(limit);
  const itemsStmt = db.prepare(`SELECT barcode, name, price, qty, total FROM sale_items WHERE sale_id = ?`);
  for (const sale of sales) {
    sale.items = itemsStmt.all(sale.id);
  }
  res.json(sales);
});

// GET /api/sales/:invoiceNo
router.get('/:invoiceNo', (req, res) => {
  const sale = db.prepare(`SELECT * FROM sales WHERE invoice_no = ?`).get(req.params.invoiceNo);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  sale.items = db.prepare(`SELECT barcode, name, price, qty, total FROM sale_items WHERE sale_id = ?`).all(sale.id);
  res.json(sale);
});

// POST /api/sales  (checkout: create sale, insert items, deduct stock — all in one transaction)
router.post('/', (req, res) => {
  const { customerName, customerPhone, items, subtotal, taxPercent, taxAmount, discount, grandTotal } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart items are required' });
  }

  const checkout = db.transaction(() => {
    // validate stock first
    for (const item of items) {
      const product = db.prepare(`SELECT * FROM products WHERE barcode = ?`).get(item.barcode);
      if (!product) throw new Error(`Product not found: ${item.barcode}`);
      if (product.stock < item.qty) throw new Error(`Insufficient stock for "${product.name}"`);
    }

    // get next invoice number
    db.prepare(`UPDATE invoice_counter SET value = value + 1 WHERE id = 1`).run();
    const invoiceNo = db.prepare(`SELECT value FROM invoice_counter WHERE id = 1`).get().value;

    const saleInfo = db.prepare(`
      INSERT INTO sales (invoice_no, customer_name, customer_phone, subtotal, tax_percent, tax_amount, discount, grand_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNo, customerName || '', customerPhone || '', subtotal, taxPercent || 0, taxAmount || 0, discount || 0, grandTotal);

    const saleId = saleInfo.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, barcode, name, price, qty, total) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const deductStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE barcode = ?`);

    for (const item of items) {
      insertItem.run(saleId, item.barcode, item.name, item.price, item.qty, item.price * item.qty);
      deductStock.run(item.qty, item.barcode);
    }

    return db.prepare(`SELECT * FROM sales WHERE id = ?`).get(saleId);
  });

  try {
    const sale = checkout();
    sale.items = db.prepare(`SELECT barcode, name, price, qty, total FROM sale_items WHERE sale_id = ?`).all(sale.id);
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
