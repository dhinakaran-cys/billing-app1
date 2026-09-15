/* App bootstrap: tabs, theme, toast, printer setup wiring */
const Toast = (() => {
  let timer = null;
  function show(msg, duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.add('hidden'), duration);
  }
  return { show };
})();

const ThemeManager = (() => {
  const STORAGE_KEY = 'bb_theme';
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(STORAGE_KEY, theme);
    if (typeof Dashboard !== 'undefined') Dashboard.refreshIfActive();
  }
  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    apply(saved);
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      apply(current === 'dark' ? 'light' : 'dark');
    });
  }
  return { init };
})();

function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      await BarcodeScanner.stop();
      buttons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      document.getElementById('pageTitle').textContent = btn.dataset.title || btn.textContent.trim();

      if (btn.dataset.tab === 'history') History.render();
      if (btn.dataset.tab === 'dashboard') Dashboard.render();
    });
  });
}

function initPrinterSetup() {
  const statusEl = document.getElementById('printerStatus');

  async function loadConfig() {
    const cfg = await API.getPrinterConfig();
    document.getElementById('serviceUuid').value = cfg.service_uuid;
    document.getElementById('charUuid').value = cfg.char_uuid;
    document.getElementById('paperWidth').value = cfg.paper_width;
  }
  loadConfig();

  function updateStatus(connected, name) {
    if (connected) {
      statusEl.textContent = '🔵 Connected: ' + (name || 'Printer');
      statusEl.className = 'status connected';
    } else {
      statusEl.textContent = 'Not connected';
      statusEl.className = 'status disconnected';
    }
  }

  document.getElementById('connectPrinterBtn').addEventListener('click', async () => {
    await API.savePrinterConfig({
      service_uuid: document.getElementById('serviceUuid').value.trim(),
      char_uuid: document.getElementById('charUuid').value.trim(),
      paper_width: parseInt(document.getElementById('paperWidth').value, 10)
    });
    try {
      const name = await BtPrinter.connect();
      updateStatus(true, name);
      Toast.show('Printer connected: ' + name);
    } catch (err) {
      Toast.show('Connection failed: ' + err.message);
      updateStatus(false);
    }
  });

  document.getElementById('disconnectPrinterBtn').addEventListener('click', async () => {
    await BtPrinter.disconnect();
    updateStatus(false);
  });

  document.getElementById('testPrintBtn').addEventListener('click', async () => {
    if (!BtPrinter.isConnected()) {
      Toast.show('Connect the printer first');
      return;
    }
    try {
      await BtPrinter.testPrint();
      Toast.show('Test print sent');
    } catch (err) {
      Toast.show('Print failed: ' + err.message);
    }
  });

  window.addEventListener('printer-disconnected', () => updateStatus(false));

  // Shop details form
  (async () => {
    const shop = await API.getShop();
    document.getElementById('shopName').value = shop.name || '';
    document.getElementById('shopAddress').value = shop.address || '';
    document.getElementById('shopPhone').value = shop.phone || '';
    document.getElementById('shopGst').value = shop.gst || '';
    document.getElementById('shopFooter').value = shop.footer || '';
    document.getElementById('sidebarShopName').textContent = shop.name || 'My Shop';
  })();

  document.getElementById('shopForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shop = {
      name: document.getElementById('shopName').value.trim(),
      address: document.getElementById('shopAddress').value.trim(),
      phone: document.getElementById('shopPhone').value.trim(),
      gst: document.getElementById('shopGst').value.trim(),
      footer: document.getElementById('shopFooter').value.trim()
    };
    await API.saveShop(shop);
    document.getElementById('sidebarShopName').textContent = shop.name || 'My Shop';
    const msg = document.getElementById('shopMsg');
    msg.textContent = 'Shop details saved!';
    setTimeout(() => msg.textContent = '', 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  initTabs();
  initPrinterSetup();
  Products.init();
  Billing.init();
  Dashboard.render();

  if (!navigator.bluetooth) {
    Toast.show('⚠ Web Bluetooth not supported in this browser. Use Chrome/Edge desktop or Android.', 6000);
  }
});
