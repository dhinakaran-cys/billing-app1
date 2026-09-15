/* Talks to the Express/SQLite backend. Mirrors the old DB.* interface but async. */
const API = (() => {
  const BASE = '/api';

  async function req(path, options = {}) {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
    return data;
  }

  // ---- Products ----
  const getProducts = (search = '') => req('/products' + (search ? `?search=${encodeURIComponent(search)}` : ''));
  const findProduct = (barcode) => req(`/products/${encodeURIComponent(barcode)}`).catch(() => null);
  const saveProduct = (product) => req('/products', { method: 'POST', body: JSON.stringify(product) });
  const deleteProduct = (barcode) => req(`/products/${encodeURIComponent(barcode)}`, { method: 'DELETE' });

  // ---- Sales ----
  const getSales = (limit = 100) => req(`/sales?limit=${limit}`);
  const createSale = (sale) => req('/sales', { method: 'POST', body: JSON.stringify(sale) });

  // ---- Settings ----
  const getShop = () => req('/settings/shop');
  const saveShop = (shop) => req('/settings/shop', { method: 'POST', body: JSON.stringify(shop) });
  const getPrinterConfig = () => req('/settings/printer');
  const savePrinterConfig = (cfg) => req('/settings/printer', { method: 'POST', body: JSON.stringify(cfg) });

  // ---- Dashboard ----
  const getDashboardSummary = () => req('/dashboard/summary');

  return {
    getProducts, findProduct, saveProduct, deleteProduct,
    getSales, createSale,
    getShop, saveShop, getPrinterConfig, savePrinterConfig,
    getDashboardSummary
  };
})();
