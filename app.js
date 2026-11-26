/* Cardfolio: personal member card wallet. UI and flows. */
(() => {
  "use strict";
  const { Store, Color, Img, Barcode, Wallet } = window.W;

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
  const saveCards = () => Store.set("cards", cards).catch(() => toast("Couldn’t save. Storage may be full."));
  const saveSettings = () => Store.set("settings", settings);

  const PALETTE = ["#000000", "#1C1C1E", "#3A3A3C", "#8E8E93", "#FFFFFF", "#E4002B", "#F26B1D", "#FFC72C", "#00843D", "#0B3D2E", "#0057B8", "#002F6C", "#6D2077", "#E5007E"];

  const blankCard = (patch = {}) => ({
    id: uid(), name: "", showName: false,
    logo: null, logoSrc: null, logoRemoveBg: true, logoTolerance: 20, logoTint: "original",
    banner: null, bg: "#1C1C1E", fg: "auto", suggested: [],
    headerLabel: "", headerValue: "", memberName: "",
    numberLabel: "Member number", number: "",
    code: "", format: "code128", showCode: true,
    notes: "", expires: "",
    created: Date.now(), updated: Date.now(), used: 0,
    ...patch,
  });
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

    // Header: logo only by default, name as a clean fallback
    const brand = h("div", { class: "pass-brand" });
    if (c.logo) brand.append(h("img", { class: "pass-logo", src: c.logo, alt: c.name || "Logo" }));
    if (!c.logo || c.showName) brand.append(h("span", { class: "pass-logotext" + (!c.name ? " pass-placeholder" : "") }, c.name || (edit ? "Add a logo" : "Card")));
    const head = h("div", { class: "pass-head" },
      h("div", { ...z("logo"), class: ["pass-brand-zone", zone === "logo" && edit ? "is-active" : ""].join(" "), style: "height:100%;display:flex;align-items:center;min-width:0;flex:1;margin-left:-8px;padding-left:8px" }, brand),
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
      codeWrap.append(h("div", { class: "code-box" }, h("div", { class: "code-empty" }, "Add a barcode")));
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
        h("p", { class: "sheet-lede" }, "Open the store’s app, take a screenshot of your member card, then choose it here."),
        option("option--featured", ICONS.photo, "From a screenshot", "Logo, colors and barcode are picked up for you", () => { close("sheet-new"); fromScreenshot(blankCard()); }),
        option("", ICONS.store, "Choose a store", "Swedish stores, with the name filled in", () => { close("sheet-new"); openStores(); }),
        option("", ICONS.scan, "Scan a plastic card", "Use the camera to read the barcode", () => { close("sheet-new"); startFromCamera(); }),
        option("", ICONS.blank, "Start blank", "Design it from scratch", () => { close("sheet-new"); openEditor(blankCard(), { isNew: true, tab: "preview" }); })
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
              h("span", { class: "monogram" }, t.name.slice(0, 1)),
              h("span", { class: "row-main row-title" }, t.name), chevron()))));
      });
    };
    const choose = (t) => {
      close("sheet-stores");
      const card = blankCard({ name: t.name, numberLabel: t.numberLabel || "Member number" });
      askScreenshot(card);
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

  function askScreenshot(card) {
    sheet("sheet-new", {
      left: textBtn("Cancel", () => close("sheet-new")),
      title: card.name,
      body: h("div", { style: "padding-top:24px;text-align:center" },
        h("div", { class: "app-mark app-mark--large" }, h("i"), h("i"), h("i")),
        h("h2", { class: "sheet-h" }, "Add a screenshot of your card"),
        h("p", { class: "sheet-lede" }, `Open the ${card.name} app, show your member card and take a screenshot. You’ll crop the logo next.`)),
      foot: h("div", { class: "tool-stack" },
        h("button", { class: "btn btn--primary btn--block", type: "button", onclick: () => { close("sheet-new"); fromScreenshot(card); } }, "Choose screenshot"),
        h("button", { class: "btn btn--ghost btn--block", type: "button", onclick: () => { close("sheet-new"); openEditor(card, { isNew: true, tab: "preview" }); } }, "Skip and design it myself")),
    });
  }

  // ---------- Screenshot flow ----------
  let shot = null; // { canvas, palette } for the card being edited

  async function loadShot(file) {
    const canvas = await Img.fromFile(file);
    shot = { canvas, palette: Img.palette(canvas, 6) };
    return shot;
  }

  async function fromScreenshot(card) {
    const file = await pickImage();
    if (!file) return;
    await loadShot(file);
    card.suggested = shot.palette;
    const codeP = Barcode.fromCanvas(shot.canvas).catch(() => null);

    const logoRect = await cropFrom("logo", { step: "1 of 2" });
    if (logoRect) await applyLogoCrop(card, logoRect);
    const bannerRect = await cropFrom("banner", { step: "2 of 2", skippable: true });
    if (bannerRect) applyBannerCrop(card, bannerRect);

    const found = await codeP;
    if (found) { card.code = found.text; card.format = found.format; toast("Barcode found"); }
    else toast("No barcode found. Tap the barcode area to add it.", 3200);
    openEditor(card, { isNew: true, tab: "preview" });
  }

  async function applyLogoCrop(card, rect) {
    const c = Img.crop(shot.canvas, rect, 900);
    card.logoSrc = c.toDataURL("image/png");
    card.bg = Img.borderColor(c);
    if (!card.suggested?.includes(card.bg)) card.suggested = [card.bg, ...(card.suggested || [])].slice(0, 6);
    card.logo = await Img.processLogo(card.logoSrc, { removeBg: card.logoRemoveBg, tolerance: card.logoTolerance, tint: card.logoTint });
  }
  function applyBannerCrop(card, rect) {
    card.banner = Img.crop(shot.canvas, rect, 1125).toDataURL("image/jpeg", 0.9);
  }

  // ---------- Crop sheet ----------
  function cropFrom(mode, { step, skippable } = {}) {
    return new Promise((resolve) => {
      const isBanner = mode === "banner";
      const ratio = isBanner ? 375 / 123 : null;
      const img = h("img", { src: shot.canvas.toDataURL("image/jpeg", 0.85), alt: "Your screenshot" });
      const sel = h("div", { class: "crop-sel", hidden: true });
      const stage = h("div", { class: "crop-stage" }, img, sel);
      let r = null; // in displayed pixels
      const useBtn = textBtn("Use", () => done(true), true);
      useBtn.disabled = true;

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
          h("p", { class: "crop-hint" }, isBanner ? "Optional. Drag across an image you’d like as the banner." : "Drag a box tightly around the logo. The background is removed for you."),
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

  function openEditor(card, { isNew = false, tab = "preview", zone = null } = {}) {
    draft = JSON.parse(JSON.stringify(card));
    edState = { isNew, tab, zone, touched: false };
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
      p.addEventListener("click", (e) => {
        const z = e.target.closest("[data-zone]")?.dataset.zone || "bg";
        edState.zone = z;
        paint(); paintTool();
      });
      passHolder.append(p);
    };
    const paintTool = () => {
      toolHolder.innerHTML = "";
      toolHolder.append(edState.zone ? toolFor(edState.zone, paint, paintTool) : h("p", { class: "editor-hint" }, "Tap any part of the card to change it"));
    };
    wrap.append(passHolder, toolHolder);
    paint(); paintTool();
    return wrap;
  }

  const sw = (checked, onchange, label) => h("span", { class: "switch" }, h("input", { type: "checkbox", checked, onchange: (e) => onchange(e.target.checked), "aria-label": label }), h("span"));
  const seg = (options, value, onpick, label) => h("div", { class: "seg seg--full", role: "group", "aria-label": label },
    options.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => onpick(v) }, l)));

  function toolFor(zone, paint, paintTool) {
    const tool = (title, ...content) => h("div", { class: "tool" }, h("div", { class: "tool-title" }, title), ...content);
    const reprocessLogo = async () => {
      if (!draft.logoSrc) return;
      draft.logo = await Img.processLogo(draft.logoSrc, { removeBg: draft.logoRemoveBg, tolerance: draft.logoTolerance, tint: draft.logoTint });
      paint();
    };
    const cropInto = async (kind) => {
      if (!shot) { const f = await pickImage(); if (!f) return; await loadShot(f); draft.suggested = shot.palette; }
      const r = await cropFrom(kind);
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
          shot ? h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => cropInto("logo") }, "Crop from screenshot") : null,
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => newImage("logo") }, draft.logo ? "Choose new image" : "Choose image")),
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
        h("div", { class: "tool-row" }, h("label", {}, "Show store name"), sw(draft.showName, (v) => { draft.showName = v; paint(); }, "Show store name")),
        h("div", { class: "tool-row", style: "display:block" },
          h("div", { class: "swatch-label" }, "Store name"),
          h("input", { class: "input-solo", value: draft.name, placeholder: "e.g. Clas Ohlson", oninput: (e) => { draft.name = e.target.value; paint(); } })),
        draft.logo ? h("button", { class: "btn btn--danger btn--small", type: "button", style: "padding:0", onclick: () => { draft.logo = draft.logoSrc = null; paint(); paintTool(); } }, "Remove logo") : null
      );
    }
    if (zone === "banner") {
      return tool("Banner",
        h("div", { class: "btn-row" },
          shot ? h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => cropInto("banner") }, "Crop from screenshot") : null,
          h("button", { class: "btn btn--secondary btn--small", type: "button", onclick: () => newImage("banner") }, "Choose image")),
        h("p", { class: "note" }, "A wide image under the logo. Leave it empty for a cleaner card."),
        draft.banner ? h("button", { class: "btn btn--danger btn--small", type: "button", style: "padding:0;margin-top:8px", onclick: () => { draft.banner = null; paint(); paintTool(); } }, "Remove banner") : null
      );
    }
    if (zone === "fields") {
      const inp = (key, ph, label) => h("label", { class: "field" }, h("span", { class: "field-label" }, label),
        h("input", { value: draft[key], placeholder: ph, oninput: (e) => { draft[key] = e.target.value; paint(); } }));
      return tool("Text on card",
        h("div", { class: "group", style: "background:var(--surface-2)" },
          inp("memberName", "Your name", "Name"),
          h("div", { class: "field-pair" }, inp("numberLabel", "Member number", "Label"), inp("number", "1234 5678", "Number")),
          h("div", { class: "field-pair" }, inp("headerLabel", "Level", "Top right label"), inp("headerValue", "Gold", "Top right value"))),
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
        f?.walletNote ? h("p", { class: "note" }, `Apple Wallet doesn’t support ${f.label}, so it will show as Code 128 there. Most store scanners read it fine.`) : null
      );
    }
    if (zone === "bg") {
      const swatches = (list, label) => list?.length ? h("div", { style: "margin-bottom:16px" }, h("div", { class: "swatch-label" }, label),
        h("div", { class: "swatches" }, list.map((c) => h("button", { class: "swatch", type: "button", role: "radio", "aria-checked": String(c.toLowerCase() === draft.bg.toLowerCase()), "aria-label": c, style: `background:${c}`,
          onclick: () => { draft.bg = c; paint(); paintTool(); } })))) : null;
      return tool("Background",
        swatches(draft.suggested, "From your screenshot"),
        h("div", { style: "margin-bottom:16px" },
          h("div", { class: "swatch-label" }, "Colors"),
          h("div", { class: "swatches" },
            PALETTE.map((c) => h("button", { class: "swatch", type: "button", role: "radio", "aria-checked": String(c.toLowerCase() === draft.bg.toLowerCase()), "aria-label": c, style: `background:${c}`,
              onclick: () => { draft.bg = c; paint(); paintTool(); } })),
            h("label", { class: "swatch swatch--custom", "aria-label": "Custom color" },
              h("input", { type: "color", value: draft.bg, oninput: (e) => { draft.bg = e.target.value; paint(); } })))),
        h("div", { class: "swatch-label" }, "Text color"),
        seg([["auto", "Automatic"], ["#FFFFFF", "White"], ["#111111", "Black"]], draft.fg, (v) => { draft.fg = v; paint(); paintTool(); }, "Text color")
      );
    }
    return h("div");
  }

  // ----- Details tab: every field as a form -----
  function fieldsView() {
    const inp = (key, label, attrs = {}) => h("label", { class: "field" }, h("span", { class: "field-label" }, label),
      h("input", { value: draft[key] || "", oninput: (e) => { draft[key] = e.target.value; }, ...attrs }));
    const toggleRow = (key, label) => h("div", { class: "row" }, h("span", { class: "row-main row-title" }, label), sw(draft[key], (v) => { draft[key] = v; }, label));
    return h("div", {},
      h("div", { class: "section-label" }, "Card"),
      h("div", { class: "group" }, inp("name", "Store name", { placeholder: "e.g. Clas Ohlson", id: "f-name" }), toggleRow("showName", "Show name next to logo")),
      h("div", { class: "section-label" }, "Barcode"),
      h("div", { class: "group" },
        inp("code", "Barcode number or text", { placeholder: "Scan or type it in Design", inputmode: "text" }),
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Format"),
          h("select", { onchange: (e) => { draft.format = e.target.value; } }, Object.entries(Barcode.FORMATS).map(([k, v]) => h("option", { value: k, selected: k === draft.format }, v.label)))),
        toggleRow("showCode", "Show number under barcode")),
      h("div", { class: "section-label" }, "On the card"),
      h("div", { class: "group" },
        inp("memberName", "Name", { placeholder: "Your name" }),
        h("div", { class: "field-pair" }, inp("numberLabel", "Number label"), inp("number", "Number", { inputmode: "numeric" })),
        h("div", { class: "field-pair" }, inp("headerLabel", "Top right label", { placeholder: "Level" }), inp("headerValue", "Top right value", { placeholder: "Gold" }))),
      h("div", { class: "section-label" }, "On the back"),
      h("div", { class: "group" },
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Notes"),
          h("textarea", { placeholder: "Customer service number, PIN hint, anything useful", oninput: (e) => { draft.notes = e.target.value; } }, draft.notes || "")),
        inp("expires", "Expires", { type: "date" })),
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

    const walletBtn = h("button", { class: "btn btn--primary btn--block", type: "button", onclick: () => addToWallet(c, walletBtn, shareHolder) }, icon(ICONS.wallet), "Add to Apple Wallet");
    const shareHolder = h("div");
    const d = sheet("sheet-detail", {
      left: textBtn("Done", () => close("sheet-detail")),
      title: c.name,
      right: textBtn("Edit", () => openEditor(c, { tab: "preview" }), true),
      body: h("div", {},
        renderPass(c),
        h("p", { class: "detail-hint" }, "Turn up the brightness if the scanner struggles."),
        h("div", { class: "detail-actions" }, walletBtn, shareHolder,
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

  async function addToWallet(c, btn, shareHolder) {
    const st = await Wallet.Signer.status();
    if (!st.ready) { openSigning(true); return; }
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = ""; btn.append(h("span", { class: "spinner" }), "Preparing pass");
    try {
      const blob = await Wallet.build({ ...c, fg: ink(c) });
      const file = new File([blob], `${(c.name || "card").replace(/[^\w-]+/g, "-")}.pkpass`, { type: "application/vnd.apple.pkpass" });
      const url = URL.createObjectURL(file);
      window.location.href = url; // Safari opens the Add to Wallet screen
      shareHolder.innerHTML = "";
      if (navigator.canShare?.({ files: [file] })) {
        shareHolder.append(h("button", { class: "btn btn--secondary btn--block", type: "button", onclick: () => navigator.share({ files: [file] }).catch(() => {}) }, "Nothing happened? Share the pass"));
      } else {
        shareHolder.append(h("button", { class: "btn btn--secondary btn--block", type: "button", onclick: () => download(file, file.name) }, "Nothing happened? Download the pass"));
      }
    } catch (e) {
      toast(e.message || "Couldn’t create the pass", 3500);
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  }

  // =========================================================
  // Settings
  // =========================================================
  async function openSettings() {
    const st = await Wallet.Signer.status();
    const row = (title, sub, onclick, right) => h(onclick ? "button" : "div", { class: "row", type: onclick ? "button" : null, onclick },
      h("span", { class: "row-main" }, h("div", { class: "row-title" }, title), sub ? h("div", { class: "row-sub" }, sub) : null), right || (onclick ? chevron() : null));
    sheet("sheet-settings", {
      left: h("span"),
      title: "Settings",
      right: textBtn("Done", () => close("sheet-settings"), true),
      body: h("div", {},
        h("div", { class: "section-label" }, "Apple Wallet"),
        h("div", { class: "group" }, row("Wallet signing", st.ready ? `Ready. ${st.passTypeId}` : "Not set up yet", () => openSigning(false))),
        h("div", { class: "section-label" }, "Security"),
        h("div", { class: "group" }, row("PIN lock", settings.pinHash ? "Asks for your PIN when the app opens" : "Off", null,
          sw(!!settings.pinHash, async (v) => {
            if (v) { close("sheet-settings"); showLock("set"); }
            else { settings.pinHash = null; await saveSettings(); toast("PIN lock turned off"); openSettings(); }
          }, "PIN lock"))),
        h("div", { class: "section-label" }, "Backup"),
        h("div", { class: "group" },
          row("Export backup", `${cards.length} card${cards.length === 1 ? "" : "s"}, with images`, () => {
            download(new Blob([JSON.stringify({ app: "cards", version: 2, exported: new Date().toISOString(), cards })], { type: "application/json" }), `cards-backup-${new Date().toISOString().slice(0, 10)}.json`);
            toast("Backup exported");
          }),
          row("Import backup", "Adds cards you don’t already have", async () => {
            const f = await pickFile("application/json,.json"); if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              const incoming = data.cards || (data.passes || []).map(fromV1);
              const ids = new Set(cards.map((c) => c.id)); let n = 0;
              incoming.forEach((c) => { if (c && !ids.has(c.id)) { cards.push(blankCard(c)); n++; } });
              await saveCards(); renderHome(); toast(`Imported ${n} card${n === 1 ? "" : "s"}`);
            } catch { toast("That file isn’t a backup from this app"); }
          })),
        h("p", { class: "section-note" }, "Your cards are stored only on this phone, in this browser. Nothing is uploaded to GitHub. Export a backup now and then.")
      ),
    });
  }

  async function openSigning(fromCard) {
    const st = await Wallet.Signer.status();
    const step = (n, done, title, text, action) => h("div", { class: "step" + (done ? " is-done" : "") },
      h("span", { class: "step-dot" }, done ? "✓" : String(n)),
      h("div", { class: "step-body" }, h("div", { class: "row-title", style: "font-weight:600" }, title), h("p", { html: text }), action || null));
    const busy = async (btn, fn) => {
      const t = btn.textContent; btn.disabled = true; btn.textContent = "Working…";
      try { await fn(); } catch (e) { toast(e.message || "Something went wrong", 3500); }
      finally { btn.disabled = false; btn.textContent = t; }
    };
    const actionBtn = (label, fn) => { const b = h("button", { class: "btn btn--secondary btn--small", type: "button" }, label); b.onclick = () => busy(b, fn); return b; };

    sheet("sheet-signing", {
      left: textBtn("Back", () => close("sheet-signing")),
      title: "Wallet signing",
      body: h("div", {},
        h("p", { class: "sheet-lede" }, fromCard && !st.ready
          ? "One-time setup before your first card. Apple only accepts cards signed with a certificate from an Apple Developer account (99 USD a year)."
          : "Apple only accepts cards signed with a certificate from an Apple Developer account (99 USD a year). Everything below happens on this phone."),
        h("div", { class: "group" },
          step(1, st.hasKey, "Create a signing request", "Makes a private key that stays on this phone, and a request file for Apple.",
            actionBtn(st.hasKey ? "Create a new request" : "Create request", async () => {
              if (st.hasCert && !confirm("This replaces your current key and certificate. Continue?")) return;
              download(await Wallet.Signer.createRequest(), "wallet.certSigningRequest");
              toast("Request saved to Files"); openSigning(fromCard);
            })),
          step(2, st.hasCert, "Get a certificate from Apple",
            `In your Apple Developer account, <a href="https://developer.apple.com/account/resources/identifiers/list/passTypeId" target="_blank" rel="noopener">register a Pass Type ID</a>, for example pass.se.yourname.cards. Then <a href="https://developer.apple.com/account/resources/certificates/add" target="_blank" rel="noopener">create a Pass Type ID certificate</a>, upload the request file and download pass.cer.`),
          step(3, st.hasCert, "Import your certificate", st.hasCert ? `Linked to ${st.passTypeId}, team ${st.teamId}.` : "Choose the pass.cer file you downloaded.",
            actionBtn(st.hasCert ? "Replace certificate" : "Import pass.cer", async () => {
              const f = await pickFile(".cer,.pem,.crt"); if (!f) return;
              await Wallet.Signer.importCert(await f.arrayBuffer()); toast("Certificate imported"); openSigning(fromCard);
            })),
          step(4, st.hasWWDR, "Import Apple’s intermediate certificate",
            `Download “Worldwide Developer Relations - G4” from <a href="https://www.apple.com/certificateauthority/" target="_blank" rel="noopener">Apple’s certificate page</a>, then import it here.`,
            actionBtn(st.hasWWDR ? "Replace" : "Import certificate", async () => {
              const f = await pickFile(".cer,.pem,.crt"); if (!f) return;
              await Wallet.Signer.importWWDR(await f.arrayBuffer()); toast("Apple certificate imported"); openSigning(fromCard);
            }))
        ),
        st.ready ? h("p", { class: "section-note" }, "All set. Open a card and tap Add to Apple Wallet.") : null,
        h("div", { class: "section-label" }, "Other options"),
        h("div", { class: "group" },
          h("button", { class: "row", type: "button", onclick: async () => {
            const f = await pickFile(".p12,.pfx"); if (!f) return;
            const pw = prompt("Password for the .p12 file") ?? "";
            try { await Wallet.Signer.importP12(await f.arrayBuffer(), pw); toast("Key and certificate imported"); openSigning(fromCard); }
            catch (e) { toast(e.message.includes("password") ? "Wrong password" : e.message, 3500); }
          } }, h("span", { class: "row-main" }, h("div", { class: "row-title" }, "Import a .p12 instead"), h("div", { class: "row-sub" }, "If you already have the key and certificate")), chevron()),
          st.hasCert ? h("button", { class: "row", type: "button", onclick: async () => {
            const pw = prompt("Choose a password to protect the backup");
            if (!pw) return;
            download(await Wallet.Signer.exportP12(pw), "wallet-signing.p12"); toast("Signing backup saved");
          } }, h("span", { class: "row-main" }, h("div", { class: "row-title" }, "Back up signing key"), h("div", { class: "row-sub" }, "Saves a password-protected .p12 file")), chevron()) : null,
          st.hasKey ? h("button", { class: "row", type: "button", onclick: async () => {
            if (!confirm("Remove your key and certificates from this phone?")) return;
            await Wallet.Signer.reset(); toast("Signing removed"); openSigning(fromCard);
          } }, h("span", { class: "row-main row-title", style: "color:var(--danger)" }, "Remove signing setup")) : null
        )
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
