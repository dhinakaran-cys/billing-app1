const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const todayStats = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS revenue
    FROM sales WHERE date(sale_date) = date('now', 'localtime')
  `).get();

  const allTimeStats = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS revenue FROM sales
  `).get();

  const productStats = db.prepare(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) AS lowStock
    FROM products
  `).get();

  const lowStockList = db.prepare(`
    SELECT barcode, name, stock, low_stock_threshold FROM products
    WHERE stock <= low_stock_threshold ORDER BY stock ASC LIMIT 10
  `).all();

  // Sales trend: last 7 days (including today), oldest first
  const trend = db.prepare(`
    SELECT date(sale_date) AS day, COALESCE(SUM(grand_total), 0) AS revenue, COUNT(*) AS orders
    FROM sales
    WHERE date(sale_date) >= date('now', 'localtime', '-6 days')
    GROUP BY date(sale_date)
    ORDER BY day ASC
  `).all();
  // Fill in missing days with 0
  const trendMap = Object.fromEntries(trend.map(t => [t.day, t]));
  const filledTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    filledTrend.push(trendMap[key] || { day: key, revenue: 0, orders: 0 });
  }

  // Top selling products (by qty) - all time
  const topProducts = db.prepare(`
    SELECT name, SUM(qty) AS totalQty, SUM(total) AS totalRevenue
    FROM sale_items
    GROUP BY barcode, name
    ORDER BY totalQty DESC
    LIMIT 5
  `).all();

  // Recent sales
  const recentSales = db.prepare(`
    SELECT invoice_no, sale_date, customer_name, grand_total FROM sales
    ORDER BY id DESC LIMIT 5
  `).all();

  res.json({
    today: { count: todayStats.count, revenue: todayStats.revenue },
    allTime: { count: allTimeStats.count, revenue: allTimeStats.revenue },
    products: { total: productStats.total || 0, lowStock: productStats.lowStock || 0 },
    lowStockList,
    trend: filledTrend,
    topProducts,
    recentSales
  });
});

module.exports = router;
