/* Cart, checkout, and invoice generation (backed by REST API) */
const Billing = (() => {
  let cart = []; // { barcode, name, price, qty, stock }

  async function addByBarcode(barcode) {
    const msg = document.getElementById('billScanMsg');
    const product = await API.findProduct(barcode);
    if (!product) {
      msg.textContent = `No product found for barcode "${barcode}". Add it in Products tab.`;
      msg.classList.add('error');
      return;
    }
    if (product.stock <= 0) {
      msg.textContent = `"${product.name}" is out of stock.`;
      msg.classList.add('error');
      return;
    }
    const existing = cart.find(c => c.barcode === barcode);
    if (existing) {
      if (existing.qty + 1 > product.stock) {
        msg.textContent = `Only ${product.stock} in stock for "${product.name}".`;
        msg.classList.add('error');
        return;
      }
      existing.qty += 1;
    } else {
      cart.push({ barcode: product.barcode, name: product.name, price: product.price, qty: 1, stock: product.stock });
    }
    msg.textContent = `Added "${product.name}"`;
    msg.classList.remove('error');
    renderCart();
  }

  function removeItem(barcode) {
    cart = cart.filter(c => c.barcode !== barcode);
    renderCart();
  }

  function setQty(barcode, qty) {
    const item = cart.find(c => c.barcode === barcode);
    if (!item) return;
    qty = Math.max(1, qty);
    if (qty > item.stock) qty = item.stock;
    item.qty = qty;
    renderCart();
  }

  function computeTotals() {
    const subtotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
    const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
    const discount = parseFloat(document.getElementById('discountAmt').value) || 0;
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = Math.max(0, subtotal + taxAmount - discount);
    return { subtotal, taxPercent, taxAmount, discount, grandTotal };
  }

  function renderCart() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    if (cart.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted);">Cart is empty</td></tr>';
    }
    for (const item of cart) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>₹${item.price.toFixed(2)}</td>
        <td><input type="number" class="qty-input" min="1" value="${item.qty}" data-barcode="${item.barcode}"></td>
        <td>₹${(item.price * item.qty).toFixed(2)}</td>
        <td><button class="icon-btn" data-remove="${item.barcode}">🗑</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('.qty-input').forEach(inp => {
      inp.addEventListener('change', (e) => setQty(e.target.dataset.barcode, parseInt(e.target.value, 10)));
    });
    tbody.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => removeItem(e.target.dataset.remove));
    });

    const { subtotal, grandTotal } = computeTotals();
    document.getElementById('cartSubtotal').textContent = '₹' + subtotal.toFixed(2);
    document.getElementById('cartGrandTotal').textContent = '₹' + grandTotal.toFixed(2);
  }

  async function checkout() {
    if (cart.length === 0) {
      Toast.show('Cart is empty');
      return;
    }
    const { subtotal, taxPercent, taxAmount, discount, grandTotal } = computeTotals();

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      customerPhone: document.getElementById('customerPhone').value.trim(),
      items: cart.map(c => ({ barcode: c.barcode, name: c.name, price: c.price, qty: c.qty })),
      subtotal, taxPercent, taxAmount, discount, grandTotal
    };

    let sale;
    try {
      sale = await API.createSale(payload);
    } catch (err) {
      Toast.show('Checkout failed: ' + err.message);
      return;
    }

    if (BtPrinter.isConnected()) {
      try {
        const shop = await API.getShop();
        await BtPrinter.printInvoice(sale, shop);
        Toast.show(`Invoice #${sale.invoice_no} printed!`);
      } catch (err) {
        Toast.show('Print failed: ' + err.message);
      }
    } else {
      Toast.show(`Sale saved (Invoice #${sale.invoice_no}). Connect printer in "Printer Setup" to auto-print.`);
    }

    cart = [];
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('discountAmt').value = 0;
    renderCart();
    Products.renderList(document.getElementById('productSearch').value);
    if (typeof History !== 'undefined') History.render();
    if (typeof Dashboard !== 'undefined') Dashboard.refreshIfActive();
  }

  function init() {
    renderCart();

    document.getElementById('billBarcodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) addByBarcode(val);
        e.target.value = '';
      }
    });

    document.getElementById('billScanBtn').addEventListener('click', async () => {
      const btn = document.getElementById('billScanBtn');
      if (btn.textContent.includes('Stop')) {
        await BarcodeScanner.stop();
        btn.textContent = '📷 Scan';
        return;
      }
      btn.textContent = '⏹ Stop';
      await BarcodeScanner.start('billScanner', async (code) => {
        addByBarcode(code);
      }, (err) => {
        Toast.show('Camera error: ' + err.message);
        btn.textContent = '📷 Scan';
      });
    });

    document.getElementById('taxPercent').addEventListener('input', renderCart);
    document.getElementById('discountAmt').addEventListener('input', renderCart);

    document.getElementById('clearCartBtn').addEventListener('click', () => {
      cart = [];
      renderCart();
    });

    document.getElementById('checkoutBtn').addEventListener('click', checkout);
  }

  return { init, addByBarcode, renderCart };
})();

/* Sales history rendering */
const History = (() => {
  async function render() {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);">Loading...</td></tr>';
    const sales = await API.getSales(200);
    tbody.innerHTML = '';
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--muted);">No sales yet</td></tr>';
      return;
    }
    for (const s of sales) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${s.invoice_no}</td>
        <td>${new Date(s.sale_date).toLocaleString()}</td>
        <td>${s.customer_name || '-'}</td>
        <td>${s.items.length} item(s)</td>
        <td>₹${s.grand_total.toFixed(2)}</td>
        <td><button class="btn" data-reprint="${s.invoice_no}">🖨 Reprint</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-reprint]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const invoiceNo = btn.dataset.reprint;
        const sale = sales.find(s => String(s.invoice_no) === String(invoiceNo));
        if (!sale) return;
        if (!BtPrinter.isConnected()) {
          Toast.show('Connect the printer first (Printer Setup tab)');
          return;
        }
        try {
          const shop = await API.getShop();
          await BtPrinter.printInvoice(sale, shop);
          Toast.show('Reprinted invoice #' + invoiceNo);
        } catch (err) {
          Toast.show('Print failed: ' + err.message);
        }
      });
    });
  }
  return { render };
})();
