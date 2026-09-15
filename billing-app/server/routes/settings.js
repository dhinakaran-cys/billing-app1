const express = require('express');
const db = require('../db');
const router = express.Router();

// ---- Shop details ----
router.get('/shop', (req, res) => {
  res.json(db.prepare(`SELECT * FROM shop_settings WHERE id = 1`).get());
});

router.post('/shop', (req, res) => {
  const { name, address, phone, gst, footer } = req.body;
  db.prepare(`
    UPDATE shop_settings SET name = ?, address = ?, phone = ?, gst = ?, footer = ? WHERE id = 1
  `).run(name || '', address || '', phone || '', gst || '', footer || '');
  res.json(db.prepare(`SELECT * FROM shop_settings WHERE id = 1`).get());
});

// ---- Printer config ----
router.get('/printer', (req, res) => {
  res.json(db.prepare(`SELECT * FROM printer_settings WHERE id = 1`).get());
});

router.post('/printer', (req, res) => {
  const { service_uuid, char_uuid, paper_width } = req.body;
  db.prepare(`
    UPDATE printer_settings SET service_uuid = ?, char_uuid = ?, paper_width = ? WHERE id = 1
  `).run(service_uuid, char_uuid, paper_width);
  res.json(db.prepare(`SELECT * FROM printer_settings WHERE id = 1`).get());
});

module.exports = router;
