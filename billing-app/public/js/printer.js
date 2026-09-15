/* Bluetooth (BLE) thermal printer driver using Web Bluetooth + ESC/POS commands.
   NOTE: Web Bluetooth requires a secure context (https:// or http://localhost)
   and is supported in Chrome / Edge on desktop & Android (not iOS Safari). */
const BtPrinter = (() => {
  let device = null;
  let characteristic = null;

  const ESC = 0x1b, GS = 0x1d;
  const encoder = new TextEncoder();

  function cmd(...bytes) { return new Uint8Array(bytes); }

  function textToBytes(str) {
    // Basic Latin-1 friendly encode; most cheap ESC/POS printers use code page 0
    return encoder.encode(str);
  }

  async function connect() {
    const cfg = await API.getPrinterConfig();
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth not supported in this browser. Use Chrome/Edge on desktop or Android.');
    }
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [cfg.service_uuid] }],
      optionalServices: [cfg.service_uuid]
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(cfg.service_uuid);
    characteristic = await service.getCharacteristic(cfg.char_uuid);
    device.addEventListener('gattserverdisconnected', () => {
      characteristic = null;
      window.dispatchEvent(new CustomEvent('printer-disconnected'));
    });
    return device.name || 'Bluetooth Printer';
  }

  async function disconnect() {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    characteristic = null;
  }

  function isConnected() {
    return !!characteristic && device && device.gatt.connected;
  }

  // BLE characteristic writes must be chunked (typically <= 180-512 bytes)
  async function writeBytes(bytes) {
    if (!characteristic) throw new Error('Printer not connected');
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      await characteristic.writeValue(slice);
      await new Promise(r => setTimeout(r, 20));
    }
  }

  function concatBytes(arrays) {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
  }

  // ---------- ESC/POS building blocks ----------
  const INIT = cmd(ESC, 0x40);
  const ALIGN_LEFT = cmd(ESC, 0x61, 0x00);
  const ALIGN_CENTER = cmd(ESC, 0x61, 0x01);
  const ALIGN_RIGHT = cmd(ESC, 0x61, 0x02);
  const BOLD_ON = cmd(ESC, 0x45, 0x01);
  const BOLD_OFF = cmd(ESC, 0x45, 0x00);
  const DOUBLE_ON = cmd(GS, 0x21, 0x11);
  const DOUBLE_OFF = cmd(GS, 0x21, 0x00);
  const CUT = cmd(GS, 0x56, 0x42, 0x00);
  const NEWLINE = textToBytes('\n');
  const FEED = (n = 3) => cmd(ESC, 0x64, n);

  function line(char, width) {
    return textToBytes(char.repeat(width) + '\n');
  }

  function twoCol(left, right, width) {
    left = String(left); right = String(right);
    const space = Math.max(1, width - left.length - right.length);
    return textToBytes(left + ' '.repeat(space) + right + '\n');
  }

  function wrapText(str, width) {
    const words = String(str).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > width) {
        lines.push(cur.trim());
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /**
   * Build ESC/POS byte stream for an invoice/receipt
   * sale: { invoice_no, sale_date, customer_name, customer_phone, items:[{name,price,qty,total}],
   *         subtotal, tax_percent, tax_amount, discount, grand_total }
   */
  function buildInvoice(sale, shop, width) {
    const parts = [INIT, ALIGN_CENTER];

    parts.push(BOLD_ON, DOUBLE_ON, textToBytes((shop.name || 'My Shop') + '\n'), DOUBLE_OFF, BOLD_OFF);
    if (shop.address) wrapText(shop.address, width).forEach(l => parts.push(textToBytes(l + '\n')));
    if (shop.phone) parts.push(textToBytes('Ph: ' + shop.phone + '\n'));
    if (shop.gst) parts.push(textToBytes('GSTIN: ' + shop.gst + '\n'));
    parts.push(line('-', width));

    parts.push(ALIGN_LEFT);
    parts.push(textToBytes('Invoice #: ' + sale.invoice_no + '\n'));
    parts.push(textToBytes('Date: ' + new Date(sale.sale_date).toLocaleString() + '\n'));
    if (sale.customer_name) parts.push(textToBytes('Customer: ' + sale.customer_name + '\n'));
    if (sale.customer_phone) parts.push(textToBytes('Phone: ' + sale.customer_phone + '\n'));
    parts.push(line('-', width));

    parts.push(BOLD_ON, twoCol('Item', 'Amt', width), BOLD_OFF);
    parts.push(line('-', width));
    for (const item of sale.items) {
      wrapText(item.name, width).forEach((l, idx) => {
        if (idx === 0) return; // name printed with qty line below
      });
      parts.push(textToBytes(item.name.substring(0, width) + '\n'));
      const qtyLine = `${item.qty} x ${item.price.toFixed(2)}`;
      parts.push(twoCol(qtyLine, item.total.toFixed(2), width));
    }
    parts.push(line('-', width));

    parts.push(twoCol('Subtotal', sale.subtotal.toFixed(2), width));
    if (sale.discount) parts.push(twoCol('Discount', '-' + sale.discount.toFixed(2), width));
    if (sale.tax_percent) parts.push(twoCol(`Tax (${sale.tax_percent}%)`, sale.tax_amount.toFixed(2), width));
    parts.push(line('=', width));
    parts.push(BOLD_ON, DOUBLE_ON);
    parts.push(twoCol('TOTAL', sale.grand_total.toFixed(2), Math.floor(width * 0.6)));
    parts.push(DOUBLE_OFF, BOLD_OFF);
    parts.push(line('=', width));

    parts.push(ALIGN_CENTER);
    if (shop.footer) wrapText(shop.footer, width).forEach(l => parts.push(textToBytes(l + '\n')));
    parts.push(FEED(3));
    parts.push(CUT);

    return concatBytes(parts);
  }

  async function printInvoice(sale, shop) {
    const cfg = await API.getPrinterConfig();
    const bytes = buildInvoice(sale, shop, cfg.paper_width || 48);
    await writeBytes(bytes);
  }

  async function testPrint() {
    const cfg = await API.getPrinterConfig();
    const width = cfg.paper_width || 48;
    const parts = [
      INIT, ALIGN_CENTER, BOLD_ON,
      textToBytes('TEST PRINT\n'), BOLD_OFF,
      line('-', width),
      textToBytes('If you can read this,\nyour printer is connected!\n'),
      FEED(3), CUT
    ];
    await writeBytes(concatBytes(parts));
  }

  return { connect, disconnect, isConnected, printInvoice, testPrint };
})();
