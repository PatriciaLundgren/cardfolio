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
    palette(c, n = 6, { bits = 4, minDist = 48 } = {}) {
      const s = Math.min(1, 160 / Math.max(c.width, c.height));
      const t = canvasOf(c.width * s, c.height * s);
      t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
      const d = t.getContext("2d").getImageData(0, 0, t.width, t.height).data;
      const buckets = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const sh = 8 - bits;
        const k = (d[i] >> sh) << (2 * bits) | (d[i + 1] >> sh) << bits | (d[i + 2] >> sh);
        const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
        buckets.set(k, b);
      }
      const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
      const out = [];
      for (const c of sorted) {
        if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > minDist)) out.push(c);
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
      // Clean the edge: peel off the soft halo of background-tinted pixels,
      // then un-mix the background color from what's left so no pale rim remains.
      const touches = (p) => {
        const x = p % w, y = (p / w) | 0;
        return (x > 0 && seen[p - 1] === 1) || (x < w - 1 && seen[p + 1] === 1) || (y > 0 && seen[p - w] === 1) || (y < h - 1 && seen[p + w] === 1);
      };
      const soft = thr * 3.5;
      for (let ring = 0; ring < 4; ring++) {
        const edge = [];
        for (let p = 0; p < w * h; p++) if (!seen[p] && touches(p)) edge.push(p);
        let peeled = 0;
        for (const p of edge) {
          const i = p * 4;
          const a = Math.min(1, Math.max(0, (dist(i) - thr) / (soft - thr)));
          if (a < 0.15) { seen[p] = 1; peeled++; continue; }
          if (a < 1) {
            d[i] = Math.max(0, Math.min(255, (d[i] - (1 - a) * br) / a));
            d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] - (1 - a) * bg) / a));
            d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] - (1 - a) * bb) / a));
            d[i + 3] = Math.round(d[i + 3] * a);
          }
          seen[p] = 2; // edge pixel, done
        }
        if (!peeled) break;
      }
      for (let p = 0; p < w * h; p++) if (seen[p] === 1) d[p * 4 + 3] = 0;
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
    // Find the card, its logo and an optional banner in a screenshot.
    // Returns rects in the screenshot's own pixels, or nulls when unsure.
    analyzeCard(src) {
      const S = Math.min(1, 360 / src.width);
      const t = canvasOf(src.width * S, src.height * S);
      const tctx = t.getContext("2d", { willReadFrequently: true });
      tctx.drawImage(src, 0, 0, t.width, t.height);
      const { width: w, height: h } = t;
      const d = tctx.getImageData(0, 0, w, h).data;
      const px = (x, y) => (y * w + x) * 4;
      const near = (i, c, tol) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < tol;
      const page = hexToRgb(Img.borderColor(t));
      const up = (r) => r && { x: r.x / S, y: r.y / S, w: r.w / S, h: r.h / S };

      // 1. The card: the largest solid-colored region that isn't the page background
      const seen = new Uint8Array(w * h);
      let best = null;
      for (const hex of Img.palette(t, 10, { bits: 5, minDist: 14 })) {
        const c = hexToRgb(hex);
        const fromPage = Math.abs(c[0] - page[0]) + Math.abs(c[1] - page[1]) + Math.abs(c[2] - page[2]);
        if (fromPage < 20) continue;
        const tol = Math.min(54, fromPage * 0.6);
        seen.fill(0);
        const parts = [];
        for (let y0 = 0; y0 < h; y0 += 3) for (let x0 = 0; x0 < w; x0 += 3) {
          const p0 = y0 * w + x0;
          if (seen[p0] || !near(p0 * 4, c, tol)) continue;
          let n = 0, x1 = w, y1 = h, x2 = 0, y2 = 0;
          const st = [p0]; seen[p0] = 1;
          while (st.length) {
            const p = st.pop(); n++;
            const x = p % w, y = (p / w) | 0;
            if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
            for (const q of [p - 1, p + 1, p - w, p + w]) {
              if (q < 0 || q >= w * h || seen[q] || Math.abs((q % w) - x) > 1) continue;
              if (near(q * 4, c, tol)) { seen[q] = 1; st.push(q); }
            }
          }
          if (n > 40) parts.push({ n, x1, y1, x2, y2 });
        }
        // A banner or barcode can split the card into pieces of the same color:
        // join the pieces that line up with the biggest one.
        parts.sort((a, b) => b.n - a.n);
        const m = parts[0];
        if (!m) continue;
        let n = m.n, x1 = m.x1, y1 = m.y1, x2 = m.x2, y2 = m.y2;
        for (const q of parts.slice(1)) {
          const overlap = Math.min(x2, q.x2) - Math.max(x1, q.x1);
          if (overlap > (x2 - x1) * 0.85 && Math.abs((q.x2 - q.x1) - (x2 - x1)) < (x2 - x1) * 0.1) {
            n += q.n; x1 = Math.min(x1, q.x1); y1 = Math.min(y1, q.y1); x2 = Math.max(x2, q.x2); y2 = Math.max(y2, q.y2);
          }
        }
        const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
        if (bw < w * 0.4 || bh < h * 0.08 || bw > w * 0.99 || n / (bw * bh) < 0.35) continue;
        if (!best || n > best.n) best = { n, c, r: { x: x1, y: y1, w: bw, h: bh } };
      }
      if (!best) return { card: null, color: null, logo: null, banner: null };
      const card = best.r, cc = best.c;

      // 2. Content inside the card: anything clearly not card colored
      const ix = Math.round(card.x + card.w * 0.03), iw = Math.round(card.w * 0.94);
      const iy = Math.round(card.y + card.h * 0.03), ih = Math.round(card.h * 0.94);
      const rowFrac = [], rowColors = [];
      for (let y = iy; y < iy + ih; y++) {
        let n = 0; const cols = new Set();
        for (let x = ix; x < ix + iw; x++) {
          const i = px(x, y);
          if (!near(i, cc, 90)) n++;
          cols.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
        }
        rowFrac.push(n / iw); rowColors.push(cols.size);
      }

      // 3. Banner: a tall, colorful band that spans almost the full card width
      let banner = null;
      for (let y = 0; y < ih; y++) {
        if (rowFrac[y] < 0.75) continue;
        let e = y; while (e + 1 < ih && rowFrac[e + 1] >= 0.75) e++;
        const bandH = e - y + 1;
        const colorful = rowColors.slice(y, e + 1).reduce((a, b) => a + b, 0) / bandH;
        if (bandH >= card.h * 0.12 && bandH <= card.h * 0.6 && colorful >= 18) {
          banner = { x: card.x, y: iy + y, w: card.w, h: bandH, rows: [y, e] };
          break;
        }
        y = e;
      }

      // 4. Logo: the first cluster of content from the top, skipping the banner
      let logo = null;
      const gap = Math.max(2, Math.round(card.h * 0.025));
      for (let y = 0; y < ih; y++) {
        if (banner && y >= banner.rows[0] && y <= banner.rows[1]) continue;
        if (rowFrac[y] < 0.01) continue;
        let e = y, quiet = 0;
        for (let k = y + 1; k < ih; k++) {
          if (banner && k >= banner.rows[0]) break;
          if (rowFrac[k] < 0.01) { if (++quiet > gap) break; } else { quiet = 0; e = k; }
        }
        if (e - y + 1 > card.h * 0.45) break; // too tall to be a logo
        let x1 = ix + iw, x2 = ix;
        for (let yy = y; yy <= e; yy++) for (let x = ix; x < ix + iw; x++) {
          if (!near(px(x, iy + yy), cc, 90)) { if (x < x1) x1 = x; if (x > x2) x2 = x; }
        }
        if (x2 - x1 < 4) { y = e; continue; }
        const pad = Math.max(3, Math.round((e - y + 1) * 0.25));
        logo = {
          x: Math.max(card.x, x1 - pad), y: Math.max(card.y, iy + y - pad),
          w: Math.min(card.x + card.w, x2 + pad) - Math.max(card.x, x1 - pad),
          h: Math.min(card.y + card.h, iy + e + pad) - Math.max(card.y, iy + y - pad),
        };
        break;
      }
      return { card: up(card), color: rgbToHex(cc), logo: up(logo), banner: banner && up(banner) };
    },
    canvasOf,
  };

  // ---------- Barcodes ----------
  const FORMATS = {
    qr: { label: "QR code", bcid: "qrcode", square: true },
    code128: { label: "Code 128", bcid: "code128" },
    ean13: { label: "EAN-13", bcid: "ean13" },
    ean8: { label: "EAN-8", bcid: "ean8" },
    upca: { label: "UPC-A", bcid: "upca" },
    code39: { label: "Code 39", bcid: "code39" },
    pdf417: { label: "PDF417", bcid: "pdf417" },
    aztec: { label: "Aztec", bcid: "azteccode", square: true },
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
  const ZXING_SRC = "https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.5/dist/iife/reader/index.js";
  const ZX_MAP = { qrcode: "qr", microqrcode: "qr", ean13: "ean13", ean8: "ean8", upca: "upca", code128: "code128", code39: "code39", pdf417: "pdf417", aztec: "aztec" };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

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
    // Find a barcode in an image. Uses ZXing (WebAssembly), which reads QR codes and
    // shop barcodes reliably even when they're small in a full-phone screenshot.
    // Tries a few sizes, then the browser's own detector, then the older scanner.
    async fromCanvas(c) {
      const sized = (max) => {
        const s = Math.min(1, max / Math.max(c.width, c.height));
        if (s === 1) return c;
        const t = canvasOf(c.width * s, c.height * s);
        t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
        return t;
      };
      try {
        await loadScript(ZXING_SRC);
        for (const cv of [c, sized(1400), sized(800)]) {
          const img = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height);
          const res = await withTimeout(ZXingWASM.readBarcodes(img, { tryHarder: true, maxNumberOfSymbols: 1 }), 9000).catch(() => []);
          const hit = res.find((r) => r.isValid && r.text);
          if (hit) return { text: hit.text, format: ZX_MAP[hit.format.toLowerCase().replace(/[^a-z0-9]/g, "")] || "code128" };
        }
      } catch { /* fall through */ }
      if ("BarcodeDetector" in window) {
        try {
          const found = await new BarcodeDetector().detect(c);
          if (found[0]) return { text: found[0].rawValue, format: SCAN_MAP[found[0].format] || "code128" };
        } catch { /* fall through */ }
      }
      try {
        await loadScript(SCANNER_SRC);
        const holder = document.getElementById("scan-file");
        const scanner = new Html5Qrcode("scan-file", { verbose: false });
        const blob = await new Promise((r) => sized(1400).toBlob(r, "image/png"));
        try {
          const r = await withTimeout(scanner.scanFileV2(new File([blob], "shot.png", { type: "image/png" }), false), 8000);
          return { text: r.decodedText, format: SCAN_MAP[r.result?.format?.formatName] || "code128" };
        } finally { try { scanner.clear(); } catch {} holder.innerHTML = ""; }
      } catch { return null; }
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

  window.W = { Store, Color, Img, Barcode, loadScript, withTimeout };
})();
