/* Wraps html5-qrcode to scan barcodes (and QR) using device camera */
const BarcodeScanner = (() => {
  let scanner = null;
  let activeBoxId = null;

  const formats = [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.QR_CODE
  ];

  async function start(boxId, onResult, onError) {
    await stop(); // stop any previous session
    const box = document.getElementById(boxId);
    box.classList.remove('hidden');
    box.innerHTML = '';
    activeBoxId = boxId;

    scanner = new Html5Qrcode(boxId, { formatsToSupport: formats, verbose: false });

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          onResult(decodedText);
        },
        () => { /* per-frame scan failure, ignore */ }
      );
    } catch (err) {
      if (onError) onError(err);
      box.classList.add('hidden');
    }
  }

  async function stop() {
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (e) { /* ignore */ }
      scanner = null;
    }
    if (activeBoxId) {
      const box = document.getElementById(activeBoxId);
      if (box) box.classList.add('hidden');
      activeBoxId = null;
    }
  }

  return { start, stop };
})();
