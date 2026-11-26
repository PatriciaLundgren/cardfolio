/* Cardfolio: personal member card wallet. UI and flows. */
(() => {
  "use strict";
  const { Store, Color, Img, Barcode } = window.W;

  // ---------- Tiny DOM helper ----------
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "style") n.style.cssText = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k in n && typeof v !== "string") n[k] = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  const icon = (d) => h("span", { html: `<svg viewBox="0 0 24 24">${d}</svg>` }).firstChild;
  const ICONS = {
    photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
    store: '<path d="M4 9h16l-1-4H5zM5 9v10h14V9M9 19v-5h6v5"/>',
    blank: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 9v6M9 12h6"/>',
    scan: '<path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3M7 12h10"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
    chevron: '<path d="m1 1 6 6-6 6"/>',
  };
  const chevron = () => h("span", { html: `<svg class="row-chevron" viewBox="0 0 8 14"><path d="m1 1 6 6-6 6"/></svg>` }).firstChild;

  let toastTimer;
  function toast(msg, ms = 2400) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  // ---------- Data ----------
  let cards = [];
  let settings = { pinHash: null };
  // Logos you add for stores. Kept only on this phone, never in the GitHub repo.
  let storeLogos = {};
  const saveStoreLogos = () => Store.set("storeLogos", storeLogos);

  // Turn any logo image into a clean, trimmed PNG: keep real transparency,
  // otherwise remove the flat background around it.
  async function cleanLogo(file) {
    let c = await Img.fromFile(file, 900);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let transparent = false;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { transparent = true; break; }
    if (!transparent) c = Img.removeBackground(c, 20);
    return Img.trim(c).toDataURL("image/png");
  }
  const saveCards = () => Store.set("cards", cards).catch(() => toast("Couldn’t save. Storage may be full."));
  const saveSettings = () => Store.set("settings", settings);

  const PALETTE = ["#B79DE8", "#621551", "#B3DFBE", "#FECAAC", "#FCF1DC", "#F7907A", "#000000", "#1C1C1E", "#3A3A3C", "#8E8E93", "#FFFFFF", "#E4002B", "#F26B1D", "#FFC72C", "#00843D", "#0B3D2E", "#0057B8", "#002F6C", "#6D2077", "#E5007E"];

  const blankCard = (patch = {}) => ({
    id: uid(), name: "", brandMode: "logo", template: null, bannerStyle: null,
    logo: null, logoSrc: null, logoRemoveBg: true, logoTolerance: 20, logoTint: "original",
    banner: null, bg: "#1C1C1E", fg: "auto", suggested: [],
    headerLabel: "", headerValue: "", memberName: "",
    numberLabel: "Member number", number: "",
    code: "", format: "code128", showCode: true,
    notes: "", expires: "",
    created: Date.now(), updated: Date.now(), used: 0,
    ...patch,
  });
  // logo | logo+name | name. Older cards used showName.
  const brandMode = (c) => c.brandMode || (c.showName ? "logo+name" : "logo");
  const ink = (c) => (c.fg === "auto" || !c.fg ? Color.autoInk(c.bg) : c.fg);

  // ---------- File pickers ----------
  function pick(input, accept) {
    return new Promise((resolve) => {
      if (accept != null) input.accept = accept;
      input.value = "";
      input.onchange = () => resolve(input.files[0] || null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const pickImage = () => pick($("#pick-image"));
  const pickFile = (accept) => pick($("#pick-file"), accept);
  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  // ---------- Sheets ----------
  function sheet(id, { title, left, right, body, foot }) {
    const d = $("#" + id);
    d.innerHTML = "";
    d.append(
      h("header", { class: "sheet-bar" }, left || h("span"), title != null ? (typeof title === "string" ? h("h2", { class: "sheet-title" }, title) : title) : h("span"), right || h("span")),
      h("div", { class: "sheet-body" }, body),
      ...(foot ? [h("footer", { class: "sheet-foot" }, foot)] : [])
    );
    if (!d.open) d.showModal();
    return d;
  }
  const close = (id) => { const d = $("#" + id); if (d.open) d.close(); };
  const textBtn = (label, onclick, strong) => h("button", { class: "text-btn" + (strong ? " text-btn--strong" : ""), type: "button", onclick }, label);

  // =========================================================
  // Pass rendering
  // =========================================================
  function renderPass(c, { edit = false, zone = null, pristine = false } = {}) {
    const fg = ink(c);
    const el = h("div", {
      class: "pass" + (edit ? " pass--edit" : "") + (pristine ? " pass--pristine" : "") + (edit && zone === "bg" ? " is-bg-active" : ""),
      style: `--bg:${c.bg};--fg:${fg};--label:${Color.mix(fg, c.bg, 0.35)}`,
    });
    const z = (name) => (edit ? { "data-zone": name, class: zone === name ? "is-active" : null } : {});

    // Header: logo in the top left. The name shows next to it, or alone, if you choose.
    const mode = brandMode(c);
    const brand = h("div", { class: "pass-brand" });
    const wantsLogo = mode !== "name";
    if (wantsLogo && c.logo) brand.append(h("img", { class: "pass-logo", src: c.logo, alt: c.name || "Logo" }));
    else if (wantsLogo && edit) brand.append(h("span", { class: "logo-placeholder" }, "Logo"));
    const showText = mode !== "logo" || (!c.logo && !edit);
    if (showText) brand.append(h("span", { class: "pass-logotext" + (!c.name ? " pass-placeholder" : "") }, c.name || (edit ? "Store name" : "Card")));
    const head = h("div", { class: "pass-head" },
      h("div", { ...z("logo"), class: ["pass-brand-zone", zone === "logo" && edit ? "is-active" : ""].join(" ") }, brand),
      c.headerValue || (edit && zone === "fields")
        ? h("div", { class: "pass-headfield" }, h("div", { class: "pass-label" }, c.headerLabel || ""), h("div", { class: "pass-value" }, c.headerValue || ""))
        : null
    );
    el.append(head);

    if (c.banner) el.append(h("div", { ...z("banner"), class: "pass-strip" + (zone === "banner" && edit ? " is-active" : ""), style: `background-image:url(${c.banner})` }));
    else if (edit) el.append(h("div", { ...z("banner"), class: "pass-strip" + (zone === "banner" ? " is-active" : "") }, h("div", { class: "strip-empty" }, "Add a banner")));

    const fields = [];
    if (c.memberName) fields.push([ "Name", c.memberName ]);
    if (c.number) fields.push([c.numberLabel || "Member number", c.number]);
    if (fields.length || edit) {
      el.append(h("div", { ...z("fields"), class: "pass-fields" + (zone === "fields" && edit ? " is-active" : ""), style: edit ? "min-height:52px" : null },
        fields.length ? fields.map(([l, v]) => h("div", {}, h("div", { class: "pass-label" }, l), h("div", { class: "pass-value" }, v)))
          : h("div", { class: "pass-label", style: "padding-top:12px" }, "Add name or number")
      ));
    }

    const codeWrap = h("div", { ...z("code"), class: "pass-code" + (zone === "code" && edit ? " is-active" : "") });
    const svg = c.code && c.format !== "none" ? Barcode.svg(c.format, c.code) : null;
    if (svg) {
      codeWrap.append(h("div", { class: "code-box" + (Barcode.FORMATS[c.format]?.square ? " code-box--square" : ""), html: svg },
        c.showCode ? h("div", { class: "code-alt" }, c.code) : null));
    } else if (c.code) {
      codeWrap.append(h("div", { class: "code-box" }, h("div", { class: "code-empty" }, "This number doesn’t fit the format. Try Code 128."), h("div", { class: "code-alt" }, c.code)));
    } else if (edit) {
      codeWrap.append(h("div", { class: "code-box code-box--add" }, h("div", { class: "code-empty" }, "Tap to add the barcode from a screenshot")));
    }
    el.append(codeWrap);
    return el;
  }

  // =========================================================
  // Home
  // =========================================================
  let query = "";
  function renderHome() {
    const list = cards
      .filter((c) => !query || (c.name || "").toLowerCase().includes(query))
      .sort((a, b) => (b.used || b.updated) - (a.used || a.updated));
    $("#search-wrap").hidden = cards.length < 5;
    $("#empty").hidden = cards.length > 0;
    const stack = $("#stack");
    stack.innerHTML = "";
    list.forEach((c) => {
      const p = renderPass(c);
      p.tabIndex = 0;
      p.setAttribute("role", "button");
      p.setAttribute("aria-label", `Open ${c.name || "card"}`);
      p.addEventListener("click", () => openDetail(c.id));
      p.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(c.id); });
      stack.append(p);
    });
  }
  $("#search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); renderHome(); });

  // =========================================================
  // New card
  // =========================================================
  function openNew() {
    const option = (cls, ic, title, sub, onclick) =>
      h("button", { class: "option " + cls, type: "button", onclick },
        h("span", { class: "option-icon" }, icon(ic)),
        h("span", { class: "row-main" }, h("div", { class: "row-title", style: "font-weight:600" }, title), h("div", { class: "row-sub" }, sub)));
    sheet("sheet-new", {
      left: textBtn("Cancel", () => close("sheet-new")),
      title: "Add a card",
      body: h("div", {},
        option("", ICONS.store, "Choose a store", "A ready-made design. Just add your barcode", () => { close("sheet-new"); openStores(); }),
        option("", ICONS.photo, "From a screenshot", "Design taken from the store app’s card", () => { close("sheet-new"); fromScreenshot(blankCard()); }),
        h("div", { class: "divider", role: "separator" }),
        option("option--quiet", ICONS.scan, "Scan a plastic card", "Use the camera to read the barcode", () => { close("sheet-new"); startFromCamera(); }),
        option("option--quiet", ICONS.blank, "Start blank", "Design it from scratch", () => { close("sheet-new"); openEditor(blankCard(), { isNew: true, tab: "preview" }); })
      ),
    });
  }

  function openStores() {
    let q = "";
    const listWrap = h("div");
    const draw = () => {
      listWrap.innerHTML = "";
      const groups = {};
      TEMPLATES.filter((t) => !q || t.name.toLowerCase().includes(q)).forEach((t) => (groups[t.group] ||= []).push(t));
      const names = Object.keys(groups);
      if (!names.length) {
        listWrap.append(h("p", { class: "sheet-lede" }, `No match. Tap “Use ${q}” to create it.`),
          h("button", { class: "btn btn--secondary btn--block", type: "button", onclick: () => choose({ name: q.replace(/\b\w/g, (m) => m.toUpperCase()) }) }, `Use “${q}”`));
        return;
      }
      names.forEach((g) => {
        listWrap.append(h("div", { class: "section-label" }, g),
          h("div", { class: "group" }, groups[g].map((t) =>
            h("button", { class: "row store-row", type: "button", onclick: () => choose(t) },
              storeLogos[t.name] || t.logo
                ? h("span", { class: "monogram", style: `background:${t.bg || "var(--surface-2)"}` }, h("img", { src: storeLogos[t.name] || t.logo, alt: "", class: "monogram-logo", loading: "lazy" }))
                : h("span", { class: "monogram", style: `background:${t.bg || "var(--surface-2)"};color:${t.fg || "var(--text-1)"}` }, t.name.slice(0, 1)),
              h("span", { class: "row-main row-title" }, t.name), chevron()))));
      });
    };
    const choose = async (t) => {
      const card = await templateCard(t);
      close("sheet-stores");
      openEditor(card, { isNew: true, tab: "preview" });
    };
    sheet("sheet-stores", {
      left: textBtn("Back", () => { close("sheet-stores"); openNew(); }),
      title: "Choose a store",
      body: h("div", {},
        h("input", { class: "input-solo", type: "search", placeholder: "Search stores", "aria-label": "Search stores", oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } }),
        listWrap),
    });
    draw();
  }

  // ---------- Templates ----------
  const toDataURL = async (url) => {
    try {
      const blob = await (await fetch(url)).blob();
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch { return null; }
  };
  async function templateLogo(t) {
    if (storeLogos[t.name]) return storeLogos[t.name];
    if (!t.logo) return null;
    const url = await toDataURL(t.logo);
    if (!url) return null;
    let c = await Img.fromDataURL(url).catch(() => null);
    if (!c) return url;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let transparent = false;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { transparent = true; break; }
    if (!transparent) c = Img.removeBackground(c, 20);
    return Img.trim(c).toDataURL("image/png");
  }
  // The full ready-made design for a store
  async function templateDesign(t) {
    const src = await templateLogo(t);
    const tint = storeLogos[t.name] ? "original" : (t.logoTint || "original");
    const logo = src && tint !== "original" ? await Img.processLogo(src, { removeBg: false, tint }) : src;
    const style = t.banner || null;
    return {
      name: t.name, template: t.name, numberLabel: t.numberLabel || "Member number",
      bg: t.bg || "#1C1C1E", fg: t.fg || "auto", accent: t.accent || null,
      logo, logoSrc: src, logoRemoveBg: false, logoTint: tint, brandMode: logo ? "logo" : "name",
      bannerStyle: style, banner: style ? W.Banners.render(style, t.bg || "#1C1C1E", t.accent) : null,
    };
  }
  async function templateCard(t) { return blankCard(await templateDesign(t)); }

  // Does a screenshot look like one of the templates? Compare card color and logo shape.
  const aHash = async (url) => {
    const img = await Img.loadURL(url);
    const c = Img.canvasOf(8, 8), x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 8, 8); x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data, g = [];
    for (let i = 0; i < d.length; i += 4) g.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    const avg = g.reduce((a, b) => a + b, 0) / g.length;
    return g.map((v) => v > avg);
  };
  async function matchTemplate(card) {
    if (!card.bg) return null;
    const [r, g, b] = Color.hexToRgb(card.bg);
    const near = TEMPLATES.filter((t) => t.bg && t.bg !== "#1C1C1E" && t.bg !== "#111111" && t.bg !== "#1A1A1A")
      .map((t) => { const [tr, tg, tb] = Color.hexToRgb(t.bg); return { t, d: Math.hypot(r - tr, g - tg, b - tb) }; })
      .filter((x) => x.d < 70).sort((a, b) => a.d - b.d);
    if (!near.length) return null;
    if (!card.logo) return near.length === 1 ? near[0].t : null;
    const mine = await aHash(card.logo).catch(() => null);
    let best = null;
    for (const { t, d } of near.slice(0, 6)) {
      const logo = storeLogos[t.name] || t.logo;
      if (!logo || !mine) continue;
      const theirs = await aHash(logo).catch(() => null);
      if (!theirs) continue;
      const diff = theirs.reduce((n, v, i) => n + (v !== mine[i]), 0);
      if (diff <= 16 && (!best || diff + d / 10 < best.score)) best = { t, score: diff + d / 10 };
    }
    return best ? best.t : null;
  }

  // ---------- Screenshot flow ----------
  let shot = null; // { canvas, palette } for the card being edited

  async function loadShot(file) {
    const canvas = await Img.fromFile(file);
    shot = { canvas, palette: Img.palette(canvas, 6) };
    return shot;
  }

  // Everything is found automatically: card color, logo, banner and barcode.
  // Manual cropping is only a fallback when the logo can't be found.
  async function fromScreenshot(card) {
    const file = await pickImage();
    if (!file) return;
    toast("Reading your screenshot…", 8000);
    await loadShot(file);
    card.suggested = shot.palette;
    const codeP = Barcode.fromCanvas(shot.canvas).catch(() => null);

    const found = Img.analyzeCard(shot.canvas);
    if (found.color) {
      card.bg = found.color;
      card.suggested = [found.color, ...shot.palette.filter((c) => c !== found.color)].slice(0, 6);
    }
    if (found.logo) await applyLogoCrop(card, found.logo, found.color);
    else {
      const r = await cropFrom("logo", { hint: "We couldn’t spot the logo. Drag a box around it." });
      if (r) await applyLogoCrop(card, r, "auto");
    }
    if (found.banner) applyBannerCrop(card, found.banner);

    const code = await codeP;
    if (code) { card.code = code.text; card.format = code.format; }
    const match = await matchTemplate(card);
    toast(code ? "Card created. Tap any part to fine-tune." : "Card created. No barcode found, so tap the barcode area to add it.", 3600);
    openEditor(card, { isNew: true, tab: "preview", match });
  }

  // setBg: a color to use as the card background, "auto" to take it from
  // around the logo, or nothing to keep the background you already picked.
  async function applyLogoCrop(card, rect, setBg) {
    const c = Img.crop(shot.canvas, rect, 900);
    shot.logoRect = rect;
    card.logoSrc = c.toDataURL("image/png");
    if (setBg) {
      card.bg = setBg === "auto" ? Img.borderColor(c) : setBg;
      if (!card.suggested?.includes(card.bg)) card.suggested = [card.bg, ...(card.suggested || [])].slice(0, 6);
    }
    card.logo = await Img.processLogo(card.logoSrc, { removeBg: card.logoRemoveBg, tolerance: card.logoTolerance, tint: card.logoTint });
  }
  function applyBannerCrop(card, rect) {
    shot.bannerRect = rect;
    card.banner = Img.crop(shot.canvas, rect, 1125).toDataURL("image/jpeg", 0.9);
  }

  // ---------- Crop sheet ----------
  function cropFrom(mode, { step, skippable, hint, initial } = {}) {
    return new Promise((resolve) => {
      const isBanner = mode === "banner";
      const ratio = isBanner ? 375 / 123 : null;
      const img = h("img", { src: shot.canvas.toDataURL("image/jpeg", 0.85), alt: "Your screenshot" });
      const sel = h("div", { class: "crop-sel", hidden: true });
      const stage = h("div", { class: "crop-stage" }, img, sel);
      let r = null; // in displayed pixels
      const useBtn = textBtn("Use", () => done(true), true);
      useBtn.disabled = true;

      if (initial) img.addEventListener("load", () => requestAnimationFrame(() => {
        const k = img.clientWidth / shot.canvas.width;
        r = { x: initial.x * k, y: initial.y * k, w: initial.w * k, h: initial.h * k };
        useBtn.disabled = false; draw();
      }), { once: true });
      const draw = () => {
        if (!r) { sel.hidden = true; return; }
        sel.hidden = false;
        Object.assign(sel.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
      };
      let start = null, mode2 = null, orig = null;
      stage.addEventListener("pointerdown", (e) => {
        stage.setPointerCapture(e.pointerId);
        const b = stage.getBoundingClientRect();
        const x = e.clientX - b.left, y = e.clientY - b.top;
        start = { x, y };
        if (r && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { mode2 = "move"; orig = { ...r }; }
        else { mode2 = "draw"; r = { x, y, w: 0, h: 0 }; }
      });
      stage.addEventListener("pointermove", (e) => {
        if (!start) return;
        const b = stage.getBoundingClientRect();
        const x = Math.max(0, Math.min(b.width, e.clientX - b.left));
        const y = Math.max(0, Math.min(b.height, e.clientY - b.top));
        if (mode2 === "move") {
          r.x = Math.max(0, Math.min(b.width - r.w, orig.x + x - start.x));
          r.y = Math.max(0, Math.min(b.height - r.h, orig.y + y - start.y));
        } else {
          let w = x - start.x, hgt = y - start.y;
          if (ratio) hgt = Math.sign(hgt || 1) * Math.abs(w) / ratio;
          r = { x: w < 0 ? start.x + w : start.x, y: hgt < 0 ? start.y + hgt : start.y, w: Math.abs(w), h: Math.abs(hgt) };
          if (r.y + r.h > b.height) { r.h = b.height - r.y; if (ratio) r.w = r.h * ratio; }
        }
        draw();
      });
      stage.addEventListener("pointerup", () => {
        start = null;
        if (r && (r.w < 8 || r.h < 8)) r = null;
        useBtn.disabled = !r;
        draw();
      });

      const done = (use) => {
        const k = shot.canvas.width / (img.clientWidth || 1);
        close("sheet-crop");
        if (!use || !r) return resolve(null);
        resolve({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
      };

      sheet("sheet-crop", {
        left: textBtn(skippable ? "Skip" : "Cancel", () => done(false)),
        title: h("div", { style: "text-align:center" }, h("h2", { class: "sheet-title" }, isBanner ? "Crop a banner" : "Crop the logo"), step ? h("div", { class: "row-sub" }, step) : null),
        right: useBtn,
        body: h("div", { class: "crop-body", style: "height:100%" },
          h("p", { class: "crop-hint" }, hint || (isBanner ? "Drag across the part you’d like as the banner." : "Drag a box around the logo. The background is removed for you.")),
          h("div", { class: "crop-stage-wrap" }, stage)),
        foot: h("button", { class: "btn btn--secondary btn--block", type: "button", onclick: async () => {
          const f = await pickImage(); if (!f) return;
          await loadShot(f); img.src = shot.canvas.toDataURL("image/jpeg", 0.85); r = null; draw(); useBtn.disabled = true;
        } }, "Use a different image"),
      });
      $("#sheet-crop .sheet-body").style.padding = "0";
      $("#sheet-crop .sheet-body").style.display = "flex";
    });
  }

  // ---------- Camera ----------
  async function scanWithCamera() {
    return new Promise(async (resolve) => {
      let stop = null;
      const finish = async (val) => { if (stop) await stop(); close("sheet-camera"); resolve(val); };
      sheet("sheet-camera", {
        left: textBtn("Cancel", () => finish(null)),
        title: "Scan barcode",
        body: h("div", { class: "camera-view" }, h("div", { id: "camera-feed" }), h("p", { class: "crop-hint", style: "margin-top:16px" }, "Hold the barcode inside the frame")),
      });
      try { stop = await Barcode.startCamera("camera-feed", (r) => finish(r)); }
      catch { toast("Camera is blocked. Allow camera access for this site in Settings."); finish(null); }
    });
  }
  async function startFromCamera() {
    const r = await scanWithCamera();
    if (!r) return;
    const card = blankCard({ code: r.text, format: r.format });
    toast("Barcode added");
    openEditor(card, { isNew: true, tab: "preview", zone: "logo" });
  }

  // =========================================================
  // Editor
  // =========================================================
  let draft = null, edState = null;

  function openEditor(card, { isNew = false, tab = "preview", zone = null, match = null } = {}) {
    draft = JSON.parse(JSON.stringify(card));
    edState = { isNew, tab, zone, touched: false, open: new Set(), focus: null, match };
    if (!isNew) shot = null;
    renderEditor();
  }

  function renderEditor() {
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Editing mode" },
      ["preview", "fields"].map((t) => h("button", { type: "button", "aria-pressed": String(edState.tab === t), onclick: () => { edState.tab = t; renderEditor(); } }, t === "preview" ? "Design" : "Details")));
    const body = edState.tab === "preview" ? designView() : fieldsView();
    sheet("sheet-editor", {
      left: textBtn("Cancel", () => { close("sheet-editor"); shot = null; }),
      title: seg,
      right: textBtn("Save", saveDraft, true),
      body,
    });
  }

  // ----- Design tab: tap the card to edit that part -----
  function designView() {
    const wrap = h("div", { class: "editor-preview" });
    const passHolder = h("div");
    const toolHolder = h("div");
    const paint = () => {
      passHolder.innerHTML = "";
      const p = renderPass(draft, { edit: true, zone: edState.zone });
      p.addEventListener("click", async (e) => {
        const z = e.target.closest("[data-zone]")?.dataset.zone || "bg";
        edState.zone = z;
        paint(); paintTool();
        if (z === "code" && !draft.code) await barcodeFromScreenshot(paint, paintTool);
      });
      passHolder.append(p);
    };
    const paintTool = () => {
      toolHolder.innerHTML = "";
      toolHolder.append(edState.zone ? toolFor(edState.zone, paint, paintTool) : h("p", { class: "editor-hint" }, "Tap any part of the card to change it"));
    };
    const m = edState.match;
    const matchBar = m ? h("div", { class: "match-bar" },
      h("span", {}, "Looks like ", h("strong", {}, m.name), ". Use its ready-made design?"),
      h("div", { class: "btn-row" },
        h("button", { class: "btn btn--primary btn--small", type: "button", onclick: async () => {
          const keep = { code: draft.code, format: draft.format, number: draft.number, memberName: draft.memberName };
          Object.assign(draft, await templateDesign(m), keep);
          edState.match = null; renderEditor(); toast(m.name + " design applied");
        } }, "Use design"),
        h("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => { edState.match = null; matchBar.remove(); } }, "Keep mine"))) : null;
    wrap.append(...(matchBar ? [matchBar] : []), passHolder, toolHolder);
    paint(); paintTool();
    return wrap;
  }

  const sw = (checked, onchange, label) => h("span", { class: "switch" }, h("input", { type: "checkbox", checked, onchange: (e) => onchange(e.target.checked), "aria-label": label }), h("span"));
  const seg = (options, value, onpick, label) => h("div", { class: "seg seg--full", role: "group", "aria-label": label },
    options.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => onpick(v) }, l)));

  // ----- Optional fields: hidden behind "Add …" until you need them -----
  // A field shows when it has a value or you just tapped its Add button.
  const OPTIONAL = [
    { key: "memberName", add: "Add your name", has: () => draft.memberName, clear: () => { draft.memberName = ""; } },
    { key: "number", add: "Add member number", has: () => draft.number, clear: () => { draft.number = ""; draft.numberLabel = "Member number"; } },
    { key: "header", add: "Add top right info", has: () => draft.headerValue || draft.headerLabel, clear: () => { draft.headerLabel = ""; draft.headerValue = ""; } },
    { key: "notes", add: "Add notes", has: () => draft.notes, clear: () => { draft.notes = ""; }, detailsOnly: true },
    { key: "expires", add: "Add expiry date", has: () => draft.expires, clear: () => { draft.expires = ""; }, detailsOnly: true },
  ];
  const isOpen = (o) => !!o.has() || edState.open.has(o.key);
  function optionalFields(render, { detailsOnly = true, onChange } = {}) {
    const list = OPTIONAL.filter((o) => detailsOnly || !o.detailsOnly);
    const shown = list.filter(isOpen), hidden = list.filter((o) => !isOpen(o));
    const removeBtn = (o) => h("button", { class: "field-remove", type: "button", "aria-label": "Remove", onclick: (e) => {
      e.preventDefault(); o.clear(); edState.open.delete(o.key); onChange?.(); renderEditor(); } }, "Remove");
    return [
      shown.length ? h("div", { class: "group" }, shown.map((o) => render(o.key, removeBtn(o)))) : null,
      hidden.length ? h("div", { class: "add-chips" }, hidden.map((o) => h("button", { class: "add-chip", type: "button", onclick: () => {
        edState.open.add(o.key); edState.focus = o.key; renderEditor(); } }, "+ " + o.add.replace(/^Add (\w)/, (m, c) => c.toUpperCase())))) : null,
    ];
  }
  function focusPending() {
    const k = edState.focus; if (!k) return; edState.focus = null;
    setTimeout(() => $(`#sheet-editor [data-opt="${k}"] input, #sheet-editor [data-opt="${k}"] textarea`)?.focus(), 60);
  }

  // A ready-made logo file (e.g. a PNG from the store's site): no cropping needed
  async function logoFile(paint, paintTool) {
    const f = await pickImage(); if (!f) return;
    draft.logo = draft.logoSrc = await cleanLogo(f);
    draft.logoRemoveBg = false; draft.logoTint = "original";
    paint?.(); paintTool?.();
    toast("Logo added");
  }

  async function barcodeFromScreenshot(paint, paintTool) {
    const f = await pickImage(); if (!f) return;
    toast("Reading the barcode…", 6000);
    const c = await Img.fromFile(f);
    const r = await Barcode.fromCanvas(c).catch(() => null);
    if (r) { draft.code = r.text; draft.format = r.format; paint(); paintTool(); toast("Barcode added"); }
    else toast("No barcode found in that image. Try a sharper screenshot, or type the number.", 4200);
  }

  function toolFor(zone, paint, paintTool) {
    const tool = (title, ...content) => h("div", { class: "tool" }, h("div", { class: "tool-title" }, title), ...content);
    const reprocessLogo = async () => {
      if (!draft.logoSrc) return;
      draft.logo = await Img.processLogo(draft.logoSrc, { removeBg: draft.logoRemoveBg, tolerance: draft.logoTolerance, tint: draft.logoTint });
      paint();
    };
    const cropInto = async (kind) => {
      if (!shot) { const f = await pickImage(); if (!f) return; await loadShot(f); draft.suggested = shot.palette; }
      const r = await cropFrom(kind, { initial: kind === "logo" ? shot.logoRect : shot.bannerRect });
      if (!r) return;
      if (kind === "logo") await applyLogoCrop(draft, r); else applyBannerCrop(draft, r);
      paint(); paintTool();
    };
    const newImage = async (kind) => {
      const f = await pickImage(); if (!f) return;
      await loadShot(f); draft.suggested = shot.palette;
      const r = await cropFrom(kind);
      if (!r) return;
      if (kind === "logo") await applyLogoCrop(draft, r); else applyBannerCrop(draft, r);
      paint(); paintTool();
    };

    if (zone === "logo") {
      return tool("Logo",
        h("div", { class: "btn-row" },
          shot ? h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => cropInto("logo") }, shot.logoRect ? "Adjust crop" : "Crop from screenshot") : null,
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => logoFile(paint, paintTool) }, "Logo file (PNG)"),
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => newImage("logo") }, "Crop from image")),
        draft.logoSrc ? [
          h("div", { class: "tool-row" }, h("label", {}, "Remove background"), sw(draft.logoRemoveBg, (v) => { draft.logoRemoveBg = v; reprocessLogo(); paintTool(); }, "Remove background")),
          draft.logoRemoveBg ? h("div", { class: "tool-row", style: "display:block" },
            h("label", { class: "swatch-label", style: "display:block" }, "Strength"),
            h("input", { type: "range", min: 4, max: 60, value: draft.logoTolerance, "aria-label": "Background removal strength",
              onchange: (e) => { draft.logoTolerance = +e.target.value; reprocessLogo(); } })) : null,
          h("div", { class: "tool-row", style: "display:block" },
            h("div", { class: "swatch-label" }, "Logo color"),
            seg([["original", "Original"], ["white", "White"], ["black", "Black"]], draft.logoTint, (v) => { draft.logoTint = v; reprocessLogo(); paintTool(); }, "Logo color")),
        ] : null,
        h("div", { class: "tool-row", style: "display:block" },
          h("div", { class: "swatch-label" }, "Show"),
          seg([["logo", "Logo"], ["logo+name", "Logo and name"], ["name", "Name only"]], brandMode(draft), (v) => { draft.brandMode = v; delete draft.showName; paint(); paintTool(); }, "What to show in the top left")),
        h("div", { class: "tool-row", style: "display:block" },
          h("div", { class: "swatch-label" }, "Store name"),
          h("input", { class: "input-solo", value: draft.name, placeholder: "e.g. Clas Ohlson", oninput: (e) => { draft.name = e.target.value; paint(); } })),
        draft.logo && draft.name.trim() ? h("p", { class: "note" }, `New ${draft.name.trim()} cards will get this logo automatically.`) : null,
        draft.logo ? h("button", { class: "btn btn--danger btn--small", type: "button", style: "padding:0", onclick: () => { draft.logo = draft.logoSrc = null; paint(); paintTool(); } }, "Remove logo") : null
      );
    }
    if (zone === "banner") {
      const accent = draft.accent || TEMPLATES.find((t) => t.name === draft.template)?.accent;
      const pickStyle = (style) => { draft.bannerStyle = style; draft.banner = style ? W.Banners.render(style, draft.bg, accent) : null; paint(); paintTool(); };
      return tool("Banner",
        h("div", { class: "banner-options", role: "radiogroup", "aria-label": "Banner style" },
          h("button", { class: "banner-option banner-option--none", type: "button", role: "radio", "aria-checked": String(!draft.banner), onclick: () => pickStyle(null) }, "None"),
          W.Banners.STYLES.map((st) => h("button", { class: "banner-option", type: "button", role: "radio", "aria-checked": String(draft.bannerStyle === st && !!draft.banner), "aria-label": W.Banners.LABELS[st],
            style: `background-image:url(${W.Banners.render(st, draft.bg, accent)})`, onclick: () => pickStyle(st) }, h("span", {}, W.Banners.LABELS[st])))),
        h("div", { class: "btn-row", style: "margin-top:12px" },
          shot ? h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: async () => { await cropInto("banner"); draft.bannerStyle = null; } }, shot.bannerRect ? "Adjust crop" : "Crop from screenshot") : null,
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: async () => { await newImage("banner"); draft.bannerStyle = null; } }, "Use your own image")),
        h("p", { class: "note" }, "Banners follow your card colors. Pick None for a cleaner card.")
      );
    }
    if (zone === "fields") {
      focusPending();
      return tool("Text on card",
        ...optionalFields((key, remove) => optionalField(key, remove, paint), { detailsOnly: false }),
        h("p", { class: "note" }, "Notes and expiry date are under Details.")
      );
    }
    if (zone === "code") {
      const f = Barcode.FORMATS[draft.format];
      return tool("Barcode",
        h("div", { class: "btn-row" },
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: async () => {
            const r = await scanWithCamera(); if (r) { draft.code = r.text; draft.format = r.format; paint(); paintTool(); toast("Barcode added"); }
          } }, "Scan with camera"),
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: async () => {
            if (!shot) { const fl = await pickImage(); if (!fl) return; await loadShot(fl); }
            const r = await Barcode.fromCanvas(shot.canvas).catch(() => null);
            if (r) { draft.code = r.text; draft.format = r.format; paint(); paintTool(); toast("Barcode found"); }
            else toast("No barcode found in that image");
          } }, shot ? "Read from screenshot" : "Read from image")),
        h("div", { class: "tool-stack", style: "margin-top:12px" },
          h("input", { class: "input-solo", value: draft.code, placeholder: "Barcode number or text", inputmode: "text", "aria-label": "Barcode", oninput: (e) => { draft.code = e.target.value.trim(); paint(); } }),
          h("select", { class: "input-solo", "aria-label": "Barcode format", onchange: (e) => { draft.format = e.target.value; paint(); paintTool(); } },
            Object.entries(Barcode.FORMATS).map(([k, v]) => h("option", { value: k, selected: k === draft.format }, v.label)))),
        h("div", { class: "tool-row", style: "margin-top:8px" }, h("label", {}, "Show number under barcode"), sw(draft.showCode, (v) => { draft.showCode = v; paint(); }, "Show number under barcode")),
        null
      );
    }
    // Changing the card color also recolors a generated banner
    const setBg = (c) => {
      draft.bg = c;
      if (draft.bannerStyle) draft.banner = W.Banners.render(draft.bannerStyle, c, draft.accent || TEMPLATES.find((t) => t.name === draft.template)?.accent);
    };
    if (zone === "bg") {
      const swatches = (list, label) => list?.length ? h("div", { style: "margin-bottom:16px" }, h("div", { class: "swatch-label" }, label),
        h("div", { class: "swatches" }, list.map((c) => h("button", { class: "swatch", type: "button", role: "radio", "aria-checked": String(c.toLowerCase() === draft.bg.toLowerCase()), "aria-label": c, style: `background:${c}`,
          onclick: () => { setBg(c); paint(); paintTool(); } })))) : null;
      return tool("Background",
        swatches(draft.suggested, "From your screenshot"),
        h("div", { style: "margin-bottom:16px" },
          h("div", { class: "swatch-label" }, "Colors"),
          h("div", { class: "swatches" },
            PALETTE.map((c) => h("button", { class: "swatch", type: "button", role: "radio", "aria-checked": String(c.toLowerCase() === draft.bg.toLowerCase()), "aria-label": c, style: `background:${c}`,
              onclick: () => { setBg(c); paint(); paintTool(); } })),
            h("label", { class: "swatch swatch--custom", "aria-label": "Custom color" },
              h("input", { type: "color", value: draft.bg, oninput: (e) => { draft.bg = e.target.value; paint(); }, onchange: (e) => { setBg(e.target.value); paint(); } })))),
        h("div", { class: "swatch-label" }, "Text color"),
        seg([["auto", "Automatic"], ["#FFFFFF", "White"], ["#111111", "Black"]], draft.fg, (v) => { draft.fg = v; paint(); paintTool(); }, "Text color")
      );
    }
    return h("div");
  }

  // One optional field, with its label row and a Remove button
  function optionalField(key, remove, onInput) {
    const inp = (k, label, attrs = {}) => h("label", { class: "field" },
      h("span", { class: "field-label field-label--row" }, h("span", {}, label), k === attrs.removeOn ? remove : null),
      h("input", { value: draft[k] || "", oninput: (e) => { draft[k] = e.target.value; onInput?.(); }, ...attrs, removeOn: null }));
    if (key === "memberName") return h("div", { "data-opt": key }, inp("memberName", "Name on card", { placeholder: "Your name", removeOn: "memberName" }));
    if (key === "number") return h("div", { class: "field-pair field-pair--wide-first", "data-opt": key },
      inp("number", "Number", { inputmode: "numeric", placeholder: "1234 5678" }), inp("numberLabel", "Label", { placeholder: "Member number", removeOn: "numberLabel" }));
    if (key === "header") return h("div", { class: "field-pair", "data-opt": key },
      inp("headerLabel", "Top right label", { placeholder: "Level" }), inp("headerValue", "Value", { placeholder: "Gold", removeOn: "headerValue" }));
    if (key === "notes") return h("label", { class: "field", "data-opt": key },
      h("span", { class: "field-label field-label--row" }, h("span", {}, "Notes on the back"), remove),
      h("textarea", { placeholder: "Customer service number, PIN hint, anything useful", oninput: (e) => { draft.notes = e.target.value; } }, draft.notes || ""));
    if (key === "expires") return h("div", { "data-opt": key }, inp("expires", "Expires", { type: "date", removeOn: "expires" }));
    return null;
  }

  // ----- Details tab: just the essentials, the rest behind "Add …" -----
  function fieldsView() {
    focusPending();
    const inp = (key, label, attrs = {}) => h("label", { class: "field" }, h("span", { class: "field-label" }, label),
      h("input", { value: draft[key] || "", oninput: (e) => { draft[key] = e.target.value; }, ...attrs }));
    return h("div", {},
      h("div", { class: "section-label" }, "Card"),
      h("div", { class: "group" },
        inp("name", "Store name", { placeholder: "e.g. Clas Ohlson", id: "f-name" }),
        inp("code", "Barcode number or text", { placeholder: "Scan or type it in Design", inputmode: "text" }),
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Barcode type"),
          h("select", { onchange: (e) => { draft.format = e.target.value; } }, Object.entries(Barcode.FORMATS).map(([k, v]) => h("option", { value: k, selected: k === draft.format }, v.label))))),
      h("div", { class: "section-label" }, "More details"),
      ...optionalFields((key, remove) => optionalField(key, remove)),
      h("p", { class: "section-note" }, "Colors, logo and banner are under Design.")
    );
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      toast("Add a store name");
      edState.tab = "fields"; renderEditor();
      setTimeout(() => $("#f-name")?.focus(), 50);
      return;
    }
    draft.name = draft.name.trim();
    draft.updated = Date.now();
    if (draft.logo && TEMPLATES.some((t) => t.name === draft.name) && storeLogos[draft.name] !== draft.logo) {
      storeLogos[draft.name] = draft.logo; await saveStoreLogos(); // next card from this store gets it
    }
    const i = cards.findIndex((c) => c.id === draft.id);
    if (i >= 0) cards[i] = draft; else cards.push(draft);
    await saveCards();
    close("sheet-editor");
    shot = null;
    renderHome();
    toast(i >= 0 ? "Card saved" : "Card added");
    if (i < 0) openDetail(draft.id);
    else if ($("#sheet-detail").open) openDetail(draft.id);
  }

  // =========================================================
  // Detail
  // =========================================================
  let wakeLock = null;
  const awake = async (on) => {
    try {
      if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch {}
  };

  function openDetail(id) {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    c.used = Date.now(); saveCards();

    const walletBtn = h("button", { class: "btn btn--primary btn--block", type: "button", onclick: () => relayUrl() ? signAndAdd(c, walletBtn) : openWallet(c) }, icon(ICONS.wallet), "Add to Apple Wallet");
    const d = sheet("sheet-detail", {
      left: textBtn("Done", () => close("sheet-detail")),
      title: c.name,
      right: textBtn("Edit", () => openEditor(c, { tab: "preview" }), true),
      body: h("div", {},
        renderPass(c),
        h("p", { class: "detail-hint" }, "Turn up the brightness if the scanner struggles."),
        relayUrl() && c.banner ? h("p", { class: "detail-hint", style: "margin-top:4px" }, "Wallet passes show the logo and colors, but not the banner.") : null,
        h("div", { class: "detail-actions" }, walletBtn,
          c.code ? h("button", { class: "btn btn--secondary btn--block", type: "button", onclick: async () => {
            try { await navigator.clipboard.writeText(c.number || c.code); toast("Number copied"); } catch { toast("Couldn’t copy on this device"); }
          } }, "Copy number") : null),
        c.notes ? [h("div", { class: "section-label" }, "Notes"), h("div", { class: "group", style: "padding:14px 16px;white-space:pre-wrap" }, c.notes)] : null,
        c.expires ? h("p", { class: "section-note" }, `Expires ${new Date(c.expires + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`) : null,
        h("button", { class: "btn btn--danger btn--block", type: "button", style: "margin-top:24px", onclick: async () => {
          if (!confirm(`Delete ${c.name}? This can’t be undone.`)) return;
          cards = cards.filter((x) => x.id !== c.id); await saveCards();
          close("sheet-detail"); renderHome(); toast("Card deleted");
        } }, "Delete card")
      ),
    });
    awake(true);
    d.addEventListener("close", () => awake(false), { once: true });
  }

  // ---------- Apple Wallet, signed for free ----------
  // Your design goes to a tiny relay (a free Cloudflare Worker, see worker/worker.js),
  // which asks the free walletmcppass.com service to sign it. Safari then opens
  // Apple's own "Add to Apple Wallet" screen. Nothing else to do.
  const SIGNING_RELAY = "https://cardfolio-relay.patricia-lundgren.workers.dev/";
  const relayUrl = () => settings.relayUrl || SIGNING_RELAY;

  const WALLET_FORMAT = { qr: "QR", pdf417: "PDF417", aztec: "Aztec" };
  async function pngB64(c) { return c.toDataURL("image/png").split(",")[1]; }
  async function fitImage(url, maxW, maxH) {
    const img = await Img.loadURL(url);
    const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const cv = Img.canvasOf(img.naturalWidth * s, img.naturalHeight * s);
    const x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  }
  async function passArgs(c) {
    const fg = ink(c);
    const args = {
      style: "storeCard",
      organization_name: c.name || "Card",
      description: (c.name || "Member") + " card",
      background_color: c.bg, foreground_color: fg, label_color: Color.mix(fg, c.bg, 0.35),
      secondary_fields: [
        ...(c.memberName ? [{ key: "name", label: "Name", value: c.memberName }] : []),
        ...(c.number ? [{ key: "number", label: c.numberLabel || "Member number", value: c.number }] : []),
      ],
      header_fields: c.headerValue ? [{ key: "header", label: c.headerLabel || "", value: c.headerValue }] : [],
      back_fields: [
        ...(c.notes ? [{ key: "notes", label: "Notes", value: c.notes }] : []),
        ...(c.number ? [{ key: "number-back", label: c.numberLabel || "Member number", value: c.number }] : []),
      ],
      serial_number: c.id,
    };
    if (brandMode(c) !== "logo" || !c.logo) args.logo_text = c.name || "";
    if (c.code && c.format !== "none") { args.barcode_message = c.code; args.barcode_format = WALLET_FORMAT[c.format] || "Code128"; }
    if (c.expires) args.expiration_date = new Date(c.expires + "T23:59:59").toISOString();
    if (c.logo) {
      args.logo_png_b64 = await pngB64(await fitImage(c.logo, 480, 150));
      const S = 87, ic = Img.canvasOf(S, S), x = ic.getContext("2d");
      x.fillStyle = c.bg; x.fillRect(0, 0, S, S);
      const l = await fitImage(c.logo, S * 0.8, S * 0.8);
      x.drawImage(l, (S - l.width) / 2, (S - l.height) / 2);
      args.icon_png_b64 = await pngB64(ic);
    } else {
      args.icon_color = c.bg; args.icon_text = (c.name || "?").slice(0, 2);
    }
    return args;
  }

  async function signAndAdd(c, btn) {
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = ""; btn.append(h("span", { class: "spinner" }), "Making your pass");
    try {
      const res = await fetch(relayUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await passArgs(c)) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.download_url) throw new Error(data.error || "Couldn’t make the pass right now");
      window.location.href = data.download_url; // Apple's Add to Apple Wallet screen opens
    } catch (e) {
      toast(navigator.onLine === false ? "You’re offline. Try again with internet." : e.message, 4200);
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  }

  // ---------- Apple Wallet, the built-in way (fallback) ----------
  // iOS 27's Wallet can create a pass itself (Wallet > + > Create a Pass).
  // Cardfolio hands it a clean image of the card to scan, plus the details to copy.
  async function cardImage(c) {
    const W = 1080, H = 1380, fg = ink(c);
    const cv = Img.canvasOf(W, H), x = cv.getContext("2d");
    x.fillStyle = c.bg; x.beginPath(); x.roundRect(0, 0, W, H, 64); x.fill();
    if (c.logo) {
      const img = await Img.loadURL(c.logo);
      const s = Math.min(560 / img.naturalWidth, 150 / img.naturalHeight);
      x.drawImage(img, 80, 90, img.naturalWidth * s, img.naturalHeight * s);
    } else {
      x.fillStyle = fg; x.font = "600 72px 'Instrument Sans', system-ui, sans-serif";
      x.fillText(c.name || "Card", 80, 170);
    }
    if (c.banner) {
      const img = await Img.loadURL(c.banner);
      const bh = W * 123 / 375, s = Math.max(W / img.naturalWidth, bh / img.naturalHeight);
      x.save(); x.beginPath(); x.rect(0, 280, W, bh); x.clip();
      x.drawImage(img, (W - img.naturalWidth * s) / 2, 280 + (bh - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      x.restore();
    }
    if (c.code && c.format !== "none") {
      const bc = await Barcode.canvas(c.format, c.code, 6).catch(() => null);
      if (bc) {
        const maxW = W - 240, maxH = Barcode.FORMATS[c.format]?.square ? 480 : 300;
        const s = Math.min(maxW / bc.width, maxH / bc.height);
        const bw = bc.width * s, bhh = bc.height * s, pad = 48;
        const px = (W - bw) / 2 - pad, py = H - bhh - pad * 2 - 150;
        x.fillStyle = "#FFFFFF"; x.beginPath(); x.roundRect(px, py, bw + pad * 2, bhh + pad * 2 + 70, 32); x.fill();
        x.imageSmoothingEnabled = false; x.drawImage(bc, px + pad, py + pad, bw, bhh);
        x.fillStyle = "#111111"; x.font = "500 40px ui-monospace, Menlo, monospace"; x.textAlign = "center";
        x.fillText(c.code, W / 2, py + pad + bhh + 58); x.textAlign = "left";
      }
    }
    return new Promise((r) => cv.toBlob(r, "image/png"));
  }

  async function openWallet(c) {
    const copy = async (v, what) => { try { await navigator.clipboard.writeText(v); toast(what + " copied"); } catch { toast("Couldn’t copy on this device"); } };
    const valueRow = (label, value) => value ? h("button", { class: "row", type: "button", onclick: () => copy(value, label) },
      h("span", { class: "row-main" }, h("div", { class: "row-sub", style: "margin:0" }, label), h("div", { class: "row-title" }, value)),
      h("span", { class: "row-value", style: "color:var(--accent)" }, "Copy")) : null;
    const step = (n, title, text) => h("div", { class: "step" }, h("span", { class: "step-dot" }, String(n)),
      h("div", { class: "step-body" }, h("div", { class: "row-title", style: "font-weight:600" }, title), text ? h("p", {}, text) : null));
    const saveBtn = h("button", { class: "btn btn--primary btn--block", type: "button", onclick: async () => {
      const blob = await cardImage(c);
      const file = new File([blob], `${(c.name || "card").replace(/[^\w-]+/g, "-")}-card.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file] }).catch(() => {});
      else download(file, file.name);
    } }, "Save card image");
    const preview = h("img", { alt: "Card image for Wallet", style: "width:100%;border-radius:16px;display:block" });
    cardImage(c).then((b) => { preview.src = URL.createObjectURL(b); });

    sheet("sheet-wallet", {
      left: textBtn("Back", () => close("sheet-wallet")),
      title: "Add to Apple Wallet",
      body: h("div", {},
        h("p", { class: "sheet-lede" }, "Apple Wallet can make this pass for you, free, on iOS 27. Save the card image, then let Wallet scan it."),
        h("div", { style: "max-width:240px;margin:0 auto 20px" }, preview),
        saveBtn,
        h("p", { class: "section-note", style: "text-align:center" }, "In the share sheet, tap Save Image to put it in Photos."),
        h("div", { class: "section-label" }, "Then in Wallet"),
        h("div", { class: "group" },
          step(1, "Open Wallet and tap +", null),
          step(2, "Tap Create a Pass", null),
          step(3, "Tap the photo icon and choose the card image", "Wallet reads the barcode and name. Check the details, pick a color and save.")),
        h("div", { class: "section-label" }, "Or create it manually"),
        h("p", { class: "section-note", style: "margin-top:4px" }, "If your iPhone doesn’t offer the scan, choose Create Pass Manually and copy these in."),
        h("div", { class: "group", style: "margin-top:8px" },
          valueRow("Name", c.name),
          valueRow("Barcode", c.code),
          valueRow(c.numberLabel || "Member number", c.number),
          valueRow("Background color", c.bg.toUpperCase()),
          c.code ? h("div", { class: "row" }, h("span", { class: "row-main" }, h("div", { class: "row-sub", style: "margin:0" }, "Barcode type"), h("div", { class: "row-title" }, Barcode.FORMATS[c.format]?.label || "Code 128"))) : null)
      ),
    });
  }

  // =========================================================
  // Settings
  // =========================================================
  async function openSettings() {
    const row = (title, sub, onclick, right) => h(onclick ? "button" : "div", { class: "row", type: onclick ? "button" : null, onclick },
      h("span", { class: "row-main" }, h("div", { class: "row-title" }, title), sub ? h("div", { class: "row-sub" }, sub) : null), right || (onclick ? chevron() : null));
    sheet("sheet-settings", {
      left: h("span"),
      title: "Settings",
      right: textBtn("Done", () => close("sheet-settings"), true),
      body: h("div", {},
        h("div", { class: "section-label" }, "Security"),
        h("div", { class: "group" }, row("PIN lock", settings.pinHash ? "Asks for your PIN when the app opens" : "Off", null,
          sw(!!settings.pinHash, async (v) => {
            if (v) { close("sheet-settings"); showLock("set"); }
            else { settings.pinHash = null; await saveSettings(); toast("PIN lock turned off"); openSettings(); }
          }, "PIN lock"))),
        h("div", { class: "section-label" }, "Backup"),
        h("div", { class: "group" },
          row("Export backup", `${cards.length} card${cards.length === 1 ? "" : "s"}, with images`, () => {
            download(new Blob([JSON.stringify({ app: "cards", version: 2, exported: new Date().toISOString(), cards, storeLogos })], { type: "application/json" }), `cards-backup-${new Date().toISOString().slice(0, 10)}.json`);
            toast("Backup exported");
          }),
          row("Import backup", "Adds cards you don’t already have", async () => {
            const f = await pickFile("application/json,.json"); if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              const incoming = data.cards || (data.passes || []).map(fromV1);
              const ids = new Set(cards.map((c) => c.id)); let n = 0;
              incoming.forEach((c) => { if (c && !ids.has(c.id)) { cards.push(blankCard(c)); n++; } });
              if (data.storeLogos) { storeLogos = { ...data.storeLogos, ...storeLogos }; await saveStoreLogos(); }
              await saveCards(); renderHome(); toast(`Imported ${n} card${n === 1 ? "" : "s"}`);
            } catch { toast("That file isn’t a backup from this app"); }
          })),
        h("p", { class: "section-note" }, "Your cards are stored only on this phone, in this browser. Nothing is uploaded to GitHub. Export a backup now and then.")
      ),
    });
  }

  // =========================================================
  // PIN lock
  // =========================================================
  const sha256 = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  let lockMode = "unlock", entry = "", firstPin = "";
  const dots = () => [...$("#pin-dots").children].forEach((d, i) => d.classList.toggle("on", i < entry.length));
  const shake = () => { const d = $("#pin-dots"); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake"); };
  function buildKeypad() {
    const pad = $("#keypad");
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "cancel", "0", "del"].forEach((k) => {
      if (k === "cancel") pad.append(h("button", { type: "button", class: "key-ghost", id: "pin-cancel", onclick: () => { if (lockMode !== "unlock") hideLock(); } }, "Cancel"));
      else if (k === "del") pad.append(h("button", { type: "button", class: "key-ghost", onclick: () => { entry = entry.slice(0, -1); dots(); } }, "Delete"));
      else pad.append(h("button", { type: "button", onclick: () => press(k) }, k));
    });
  }
  async function press(k) {
    if (entry.length >= 4) return;
    entry += k; dots();
    if (entry.length < 4) return;
    const pin = entry;
    await new Promise((r) => setTimeout(r, 120));
    entry = ""; dots();
    if (lockMode === "unlock") {
      if ((await sha256(pin)) === settings.pinHash) hideLock();
      else { $("#lock-msg").textContent = "Wrong PIN. Try again."; shake(); }
    } else if (lockMode === "set") {
      firstPin = pin; lockMode = "confirm"; $("#lock-msg").textContent = "Enter it again to confirm";
    } else if (pin === firstPin) {
      settings.pinHash = await sha256(pin); await saveSettings(); hideLock(); toast("PIN lock is on");
    } else {
      lockMode = "set"; $("#lock-msg").textContent = "Those didn’t match. Choose a PIN."; shake();
    }
  }
  function showLock(mode) {
    lockMode = mode; entry = ""; firstPin = ""; dots();
    $("#lock-msg").textContent = mode === "unlock" ? "Enter your PIN" : "Choose a 4-digit PIN";
    $("#pin-cancel").style.visibility = mode === "unlock" ? "hidden" : "visible";
    $("#lock").hidden = false;
    if (mode === "unlock") $("#home").hidden = true;
  }
  function hideLock() { $("#lock").hidden = true; $("#home").hidden = false; }
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (settings.pinHash && hiddenAt && Date.now() - hiddenAt > 60000) {
      document.querySelectorAll("dialog[open]").forEach((d) => d.close());
      showLock("unlock");
    }
    if ($("#sheet-detail").open) awake(true);
  });

  // =========================================================
  // Start
  // =========================================================
  function fromV1(p) {
    const fmt = { qr: "qr", CODE128: "code128", EAN13: "ean13", EAN8: "ean8", UPC: "upca", CODE39: "code39", none: "none" };
    return blankCard({ id: p.id, name: p.title || "", bg: p.color || "#1C1C1E", code: p.code || "", format: fmt[p.format] || "code128", number: p.number || "", notes: p.notes || "", expires: p.expires || "" });
  }

  async function start() {
    buildKeypad();
    cards = await Store.get("cards", null);
    settings = await Store.get("settings", { pinHash: null });
    storeLogos = await Store.get("storeLogos", {});
    if (!cards) {
      cards = [];
      try {
        const old = JSON.parse(localStorage.getItem("wallet.passes.v1") || "[]");
        cards = old.map(fromV1);
        const oldSettings = JSON.parse(localStorage.getItem("wallet.settings.v1") || "{}");
        if (oldSettings.pinHash) settings.pinHash = oldSettings.pinHash;
      } catch {}
      await saveCards(); await saveSettings();
    }
    $("#open-new").onclick = openNew;
    $("#empty-new").onclick = openNew;
    $("#open-settings").onclick = openSettings;
    document.querySelectorAll("dialog").forEach((d) => d.addEventListener("cancel", (e) => { if (d.id === "sheet-camera" || d.id === "sheet-crop") e.preventDefault(); }));
    renderHome();
    if (settings.pinHash) showLock("unlock"); else $("#home").hidden = false;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  start();

  // Exposed for testing in the browser console
  window.CardsApp = { get cards() { return cards; }, openEditor, renderPass };
})();
