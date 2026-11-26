/* Core helpers: storage (IndexedDB), image tools, barcodes. */
(() => {
  "use strict";

  // ---------- Storage: one small IndexedDB key-value store ----------
  const DB_NAME = "wallet";
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const Store = {
    async get(key, fallback) {
      try {
        const d = await db();
        return await new Promise((res, rej) => {
          const r = d.transaction("kv").objectStore("kv").get(key);
          r.onsuccess = () => res(r.result === undefined ? fallback : r.result);
          r.onerror = () => rej(r.error);
        });
      } catch { return fallback; }
    },
    async set(key, value) {
      const d = await db();
      return new Promise((res, rej) => {
        const tx = d.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
    },
  };

  // ---------- Color ----------
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const autoInk = (bg) => (luminance(bg) > 0.42 ? "#111111" : "#FFFFFF");
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const Color = { hexToRgb, rgbToHex, luminance, autoInk, mix };

  // ---------- Images ----------
  const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  const Img = {
    loadURL(url) {
      return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    },
    async fromFile(file, max = 2200) {
      const url = URL.createObjectURL(file);
      try {
        const img = await Img.loadURL(url);
        const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = canvasOf(img.naturalWidth * s, img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        return c;
      } finally { URL.revokeObjectURL(url); }
    },
    async fromDataURL(url) {
      const img = await Img.loadURL(url);
      const c = canvasOf(img.naturalWidth, img.naturalHeight);
      c.getContext("2d").drawImage(img, 0, 0);
      return c;
    },
    crop(src, r, maxW = 1200) {
      const s = Math.min(1, maxW / r.w);
      const c = canvasOf(r.w * s, r.h * s);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      return c;
    },
    // Median color of the outer ring of pixels, i.e. the background behind a logo
    borderColor(c) {
      const { width: w, height: h } = c;
      const d = c.getContext("2d").getImageData(0, 0, w, h).data;
      const rs = [], gs = [], bs = [];
      const push = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] > 200) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); } };
      for (let x = 0; x < w; x += 2) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y += 2) { push(0, y); push(w - 1, y); }
      const med = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)] || 0; };
      return rgbToHex([med(rs), med(gs), med(bs)]);
    },
    // A few dominant colors, most common first
    palette(c, n = 6) {
      const s = Math.min(1, 160 / Math.max(c.width, c.height));
      const t = canvasOf(c.width * s, c.height * s);
      t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
      const d = t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
      const buckets = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
        const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
        buckets.set(k, b);
      }
      const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
      const out = [];
      for (const c of sorted) {
        if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 48)) out.push(c);
        if (out.length >= n) break;
      }
      return out.map(rgbToHex);
    },
    // Flood-fill the background from the edges and make it transparent
    removeBackground(src, tolerance = 20) {
      const c = canvasOf(src.width, src.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(src, 0, 0);
      const { width: w, height: h } = c;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const [br, bg, bb] = hexToRgb(Img.borderColor(src));
      const thr = tolerance * 3;
      const dist = (i) => Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb);
      const seen = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
      while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue;
        if (dist(p * 4) > thr) continue;
        seen[p] = 1;
        const x = p % w, y = (p / w) | 0;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
      for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        if (seen[p]) { d[i + 3] = 0; continue; }
        // Soften edge pixels that touch the removed area
        const x = p % w, y = (p / w) | 0;
        const edge = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w]);
        if (edge) {
          const k = Math.min(1, Math.max(0, (dist(i) - thr) / (thr + 1)));
          d[i + 3] = Math.round(d[i + 3] * (0.35 + 0.65 * k));
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
    },
    tint(src, hex) {
      const c = canvasOf(src.width, src.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, c.width, c.height);
      return c;
    },
    trim(src, pad = 2) {
      const { width: w, height: h } = src;
      const d = src.getContext("2d").getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return src;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
      x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
      return Img.crop(src, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, 4000);
    },
    // Logo pipeline: original crop -> optional background removal -> optional tint -> trim
    async processLogo(srcURL, { removeBg, tolerance, tint }) {
      let c = await Img.fromDataURL(srcURL);
      if (removeBg) c = Img.removeBackground(c, tolerance);
      if (tint === "white") c = Img.tint(c, "#FFFFFF");
      if (tint === "black") c = Img.tint(c, "#111111");
      if (removeBg) c = Img.trim(c);
      return c.toDataURL("image/png");
    },
    canvasOf,
  };

  // ---------- Barcodes ----------
  const FORMATS = {
    qr: { label: "QR code", bcid: "qrcode", wallet: "PKBarcodeFormatQR", square: true },
    code128: { label: "Code 128", bcid: "code128", wallet: "PKBarcodeFormatCode128" },
    ean13: { label: "EAN-13", bcid: "ean13", wallet: "PKBarcodeFormatCode128", walletNote: true },
    ean8: { label: "EAN-8", bcid: "ean8", wallet: "PKBarcodeFormatCode128", walletNote: true },
    upca: { label: "UPC-A", bcid: "upca", wallet: "PKBarcodeFormatCode128", walletNote: true },
    code39: { label: "Code 39", bcid: "code39", wallet: "PKBarcodeFormatCode128", walletNote: true },
    pdf417: { label: "PDF417", bcid: "pdf417", wallet: "PKBarcodeFormatPDF417" },
    aztec: { label: "Aztec", bcid: "azteccode", wallet: "PKBarcodeFormatAztec", square: true },
  };
  const SCAN_MAP = {
    QR_CODE: "qr", CODE_128: "code128", EAN_13: "ean13", EAN_8: "ean8", UPC_A: "upca",
    CODE_39: "code39", PDF_417: "pdf417", AZTEC: "aztec",
    qr_code: "qr", code_128: "code128", ean_13: "ean13", ean_8: "ean8", upc_a: "upca",
    code_39: "code39", pdf417: "pdf417", aztec: "aztec",
  };

  const loaded = new Map();
  const loadScript = (src) => loaded.get(src) || loaded.set(src, new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => { loaded.delete(src); rej(new Error("Couldn’t load " + src)); };
    document.head.append(s);
  })).get(src);

  const SCANNER_SRC = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

  const Barcode = {
    FORMATS,
    svg(format, text) {
      const f = FORMATS[format];
      if (!f || !text || typeof bwipjs === "undefined") return null;
      try {
        const opts = { bcid: f.bcid, text, includetext: false, scale: 3 };
        if (!f.square) opts.height = format === "pdf417" ? 10 : 18;
        return bwipjs.toSVG(opts);
      } catch { return null; }
    },
    async canvas(format, text, scale = 4) {
      const f = FORMATS[format];
      const c = document.createElement("canvas");
      const opts = { bcid: f.bcid, text, scale, includetext: false };
      if (!f.square) opts.height = format === "pdf417" ? 10 : 18;
      bwipjs.toCanvas(c, opts);
      return c;
    },
    // Find a barcode in an image. Tries the browser's own detector first.
    async fromCanvas(c) {
      if ("BarcodeDetector" in window) {
        try {
          const found = await new BarcodeDetector().detect(c);
          if (found[0]) return { text: found[0].rawValue, format: SCAN_MAP[found[0].format] || "code128" };
        } catch { /* fall through */ }
      }
      await loadScript(SCANNER_SRC);
      const holder = document.getElementById("scan-file");
      const scanner = new Html5Qrcode("scan-file", { verbose: false });
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const file = new File([blob], "shot.png", { type: "image/png" });
      try {
        const r = await scanner.scanFileV2(file, false);
        return { text: r.decodedText, format: SCAN_MAP[r.result?.format?.formatName] || "code128" };
      } catch { return null; }
      finally { try { scanner.clear(); } catch {} holder.innerHTML = ""; }
    },
    async startCamera(elementId, onFound) {
      await loadScript(SCANNER_SRC);
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      await scanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: (w, h) => ({ width: Math.floor(Math.min(w, h) * 0.85), height: Math.floor(Math.min(w, h) * 0.55) }) },
        (text, res) => onFound({ text, format: SCAN_MAP[res?.result?.format?.formatName] || "code128" })
      );
      return async () => { try { await scanner.stop(); scanner.clear(); } catch {} };
    },
  };

  window.W = { Store, Color, Img, Barcode, loadScript };
})();
