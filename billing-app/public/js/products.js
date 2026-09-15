/* Product add/edit/list logic (backed by REST API) */
const Products = (() => {

  async function renderList(filter = '') {
    const tbody = document.getElementById('productListBody');
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);">Loading...</td></tr>';
    let products;
    try {
      products = await API.getProducts(filter);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:var(--danger);">Failed to load: ${err.message}</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);">No products yet</td></tr>';
      return;
    }
    for (const p of products) {
      const tr = document.createElement('tr');
      const lowStock = p.stock <= p.low_stock_threshold;
      tr.innerHTML = `
        <td>${p.barcode}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>₹${Number(p.price).toFixed(2)}</td>
        <td>${lowStock ? `<span class="badge warn">${p.stock} low</span>` : p.stock}</td>
        <td><button class="icon-btn" data-barcode="${p.barcode}" title="Delete">🗑</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('.icon-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this product?')) {
          await API.deleteProduct(btn.dataset.barcode);
          renderList(document.getElementById('productSearch').value);
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function fillFormForEdit(barcode) {
    const p = await API.findProduct(barcode);
    if (!p) return;
    document.getElementById('prodBarcode').value = p.barcode;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
  }

  function init() {
    renderList();

    document.getElementById('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const barcode = document.getElementById('prodBarcode').value.trim();
      const name = document.getElementById('prodName').value.trim();
      const price = parseFloat(document.getElementById('prodPrice').value);
      const stock = parseInt(document.getElementById('prodStock').value, 10);

      if (!barcode || !name || isNaN(price)) return;

      const msg = document.getElementById('prodMsg');
      try {
        const { updated } = await API.saveProduct({ barcode, name, price, stock: isNaN(stock) ? 0 : stock });
        msg.textContent = updated ? `Updated "${name}"` : `Added "${name}"`;
        msg.classList.remove('error');
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('error');
      }
      setTimeout(() => msg.textContent = '', 2500);

      document.getElementById('productForm').reset();
      document.getElementById('prodStock').value = 0;
      renderList(document.getElementById('productSearch').value);
      if (typeof Dashboard !== 'undefined') Dashboard.refreshIfActive();
    });

    document.getElementById('prodScanBtn').addEventListener('click', async () => {
      const btn = document.getElementById('prodScanBtn');
      if (btn.textContent.includes('Stop')) {
        await BarcodeScanner.stop();
        btn.textContent = '📷 Scan';
        return;
      }
      btn.textContent = '⏹ Stop';
      await BarcodeScanner.start('prodScanner', async (code) => {
        document.getElementById('prodBarcode').value = code;
        await BarcodeScanner.stop();
        btn.textContent = '📷 Scan';
        const existing = await API.findProduct(code);
        if (existing) fillFormForEdit(code);
        Toast.show('Barcode captured: ' + code);
      }, (err) => {
        Toast.show('Camera error: ' + err.message);
        btn.textContent = '📷 Scan';
      });
    });

    let searchTimer = null;
    document.getElementById('productSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderList(e.target.value), 250);
    });

    document.getElementById('prodBarcode').addEventListener('change', async (e) => {
      const existing = await API.findProduct(e.target.value.trim());
      if (existing) fillFormForEdit(existing.barcode);
    });
  }

  return { init, renderList };
})();
