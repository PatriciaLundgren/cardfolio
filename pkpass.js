/* Apple Wallet: signing setup and .pkpass builder.
   Everything happens on your phone. Your signing key is stored only in this
   browser and is never uploaded anywhere. */
(() => {
  "use strict";
  const { Store, Color, Img, Barcode, loadScript } = window.W;

  const FORGE = "https://cdn.jsdelivr.net/npm/node-forge@1.3.1/dist/forge.min.js";
  const JSZIP = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  const KEY = "signing";
  const UID_OID = "0.9.2342.19200300.100.1.1";

  const bytesToBinary = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; };
  const binaryToBytes = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };

  async function forgeReady() { await loadScript(FORGE); return window.forge; }

  function parseCert(forge, buf) {
    const bin = bytesToBinary(new Uint8Array(buf));
    if (bin.includes("-----BEGIN")) return forge.pki.certificateFromPem(bin);
    return forge.pki.certificateFromAsn1(forge.asn1.fromDer(bin));
  }

  function readIds(cert) {
    const uid = cert.subject.getField({ type: UID_OID });
    const ou = cert.subject.getField("OU");
    return { passTypeId: uid?.value || "", teamId: ou?.value || "" };
  }

  const Signer = {
    async state() { return (await Store.get(KEY, null)) || {}; },
    async save(patch) { const s = { ...(await Signer.state()), ...patch }; await Store.set(KEY, s); return s; },

    async status() {
      const s = await Signer.state();
      return {
        hasKey: !!s.keyPem, hasCert: !!s.certPem, hasWWDR: !!s.wwdrPem,
        ready: !!(s.keyPem && s.certPem && s.wwdrPem && s.passTypeId && s.teamId),
        passTypeId: s.passTypeId, teamId: s.teamId, expires: s.certExpires,
      };
    },

    // Step 1: make a private key and a certificate signing request (CSR)
    async createRequest(email) {
      const forge = await forgeReady();
      const keys = await new Promise((res, rej) =>
        forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 }, (err, k) => (err ? rej(err) : res(k))));
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = keys.publicKey;
      const subject = [{ name: "commonName", value: "Wallet pass signing" }];
      if (email) subject.push({ name: "emailAddress", value: email });
      csr.setSubject(subject);
      csr.sign(keys.privateKey, forge.md.sha256.create());
      const csrPem = forge.pki.certificationRequestToPem(csr);
      await Signer.save({ keyPem: forge.pki.privateKeyToPem(keys.privateKey), certPem: null, passTypeId: null, teamId: null });
      return new Blob([csrPem], { type: "application/pkcs10" });
    },

    // Step 3: import the pass.cer you downloaded from Apple
    async importCert(buf) {
      const forge = await forgeReady();
      const s = await Signer.state();
      if (!s.keyPem) throw new Error("Create a signing request first, on this device.");
      const cert = parseCert(forge, buf);
      const key = forge.pki.privateKeyFromPem(s.keyPem);
      if (!cert.publicKey.n.equals(key.n)) throw new Error("This certificate was made from a different signing request.");
      const ids = readIds(cert);
      if (!ids.passTypeId.startsWith("pass.")) throw new Error("This isn’t a Pass Type ID certificate.");
      return Signer.save({ certPem: forge.pki.certificateToPem(cert), certExpires: cert.validity.notAfter.toISOString(), ...ids });
    },

    // Step 4: Apple's intermediate certificate (WWDR G4)
    async importWWDR(buf) {
      const forge = await forgeReady();
      const cert = parseCert(forge, buf);
      const cn = cert.subject.getField("CN")?.value || "";
      if (!/Worldwide Developer Relations/i.test(cn)) throw new Error("This doesn’t look like Apple’s WWDR certificate.");
      return Signer.save({ wwdrPem: forge.pki.certificateToPem(cert) });
    },

    // Alternative: import a .p12 that already has the key and certificate
    async importP12(buf, password) {
      const forge = await forgeReady();
      const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bytesToBinary(new Uint8Array(buf))), password || "");
      const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0]
        || (p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])[0];
      const certs = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
      const passCert = certs.map((b) => b.cert).find((c) => readIds(c).passTypeId.startsWith("pass."));
      if (!keyBag || !passCert) throw new Error("This .p12 doesn’t contain a pass certificate and its key.");
      return Signer.save({
        keyPem: forge.pki.privateKeyToPem(keyBag.key),
        certPem: forge.pki.certificateToPem(passCert),
        certExpires: passCert.validity.notAfter.toISOString(),
        ...readIds(passCert),
      });
    },

    // Back up key + certificate as a password-protected .p12
    async exportP12(password) {
      const forge = await forgeReady();
      const s = await Signer.state();
      if (!s.keyPem || !s.certPem) throw new Error("Nothing to back up yet.");
      const asn1 = forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(s.keyPem), [forge.pki.certificateFromPem(s.certPem)], password, { algorithm: "3des" });
      return new Blob([binaryToBytes(forge.asn1.toDer(asn1).getBytes())], { type: "application/x-pkcs12" });
    },

    async reset() { await Store.set(KEY, {}); },
  };

  // ---------- Pass images ----------
  const toPNG = (c) => new Promise((r) => c.toBlob(async (b) => r(new Uint8Array(await b.arrayBuffer())), "image/png"));

  async function logoCanvas(p, scale) {
    // Wallet logo area: up to 160 x 50 points, drawn left-aligned
    const maxW = 160 * scale, maxH = 50 * scale;
    if (!p.logo) return null;
    const img = await Img.loadURL(p.logo);
    const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const c = Img.canvasOf(img.naturalWidth * s, img.naturalHeight * s);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  async function stripCanvas(p, scale) {
    if (!p.banner) return null;
    const W = 375 * scale, H = 123 * scale;
    const img = await Img.loadURL(p.banner);
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const c = Img.canvasOf(W, H);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    return c;
  }

  async function iconCanvas(p, scale) {
    const S = 29 * scale;
    const c = Img.canvasOf(S, S);
    const ctx = c.getContext("2d");
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, S, S);
    if (p.logo) {
      const img = await Img.loadURL(p.logo);
      const s = Math.min((S * 0.8) / img.naturalWidth, (S * 0.8) / img.naturalHeight);
      ctx.drawImage(img, (S - img.naturalWidth * s) / 2, (S - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    } else {
      ctx.fillStyle = p.fg;
      ctx.font = `600 ${S * 0.5}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((p.name || "?").slice(0, 1).toUpperCase(), S / 2, S / 2 + S * 0.03);
    }
    return c;
  }

  const rgb = (hex) => { const [r, g, b] = Color.hexToRgb(hex); return `rgb(${r}, ${g}, ${b})`; };

  function passJSON(p, s) {
    const fields = [];
    if (p.memberName) fields.push({ key: "name", label: "Name", value: p.memberName });
    if (p.number) fields.push({ key: "number", label: p.numberLabel || "Member number", value: p.number });
    const json = {
      formatVersion: 1,
      passTypeIdentifier: s.passTypeId,
      teamIdentifier: s.teamId,
      serialNumber: p.id,
      organizationName: p.name || "Wallet",
      description: `${p.name || "Member"} card`,
      backgroundColor: rgb(p.bg),
      foregroundColor: rgb(p.fg),
      labelColor: rgb(Color.mix(p.fg, p.bg, 0.35)),
      sharingProhibited: true,
      storeCard: {
        headerFields: p.headerValue ? [{ key: "header", label: p.headerLabel || "", value: p.headerValue }] : [],
        primaryFields: [],
        secondaryFields: fields,
        backFields: [
          ...(p.notes ? [{ key: "notes", label: "Notes", value: p.notes }] : []),
          ...(p.number ? [{ key: "number-back", label: p.numberLabel || "Member number", value: p.number }] : []),
        ],
      },
    };
    if (p.showName && p.name) json.logoText = p.name;
    if (p.code && p.format !== "none") {
      json.barcodes = [{
        format: Barcode.FORMATS[p.format]?.wallet || "PKBarcodeFormatCode128",
        message: p.code,
        messageEncoding: "iso-8859-1",
        ...(p.showCode ? { altText: p.code } : {}),
      }];
      json.barcode = json.barcodes[0]; // older iOS versions
    }
    if (p.expires) json.expirationDate = new Date(p.expires + "T23:59:59").toISOString();
    return json;
  }

  async function build(p) {
    const s = await Signer.state();
    if (!(s.keyPem && s.certPem && s.wwdrPem)) throw new Error("Set up Apple Wallet signing in Settings first.");
    const forge = await forgeReady();
    await loadScript(JSZIP);

    const files = {};
    files["pass.json"] = new TextEncoder().encode(JSON.stringify(passJSON(p, s), null, 2));
    for (const [name, make] of [["icon", iconCanvas], ["logo", logoCanvas], ["strip", stripCanvas]]) {
      for (const scale of [1, 2, 3]) {
        const c = await make(p, scale);
        if (c) files[`${name}${scale === 1 ? "" : "@" + scale + "x"}.png`] = await toPNG(c);
      }
    }

    const manifest = {};
    for (const [name, bytes] of Object.entries(files)) {
      const md = forge.md.sha1.create();
      md.update(bytesToBinary(bytes));
      manifest[name] = md.digest().toHex();
    }
    const manifestStr = JSON.stringify(manifest);
    files["manifest.json"] = new TextEncoder().encode(manifestStr);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestStr, "utf8");
    const cert = forge.pki.certificateFromPem(s.certPem);
    p7.addCertificate(cert);
    p7.addCertificate(forge.pki.certificateFromPem(s.wwdrPem));
    p7.addSigner({
      key: forge.pki.privateKeyFromPem(s.keyPem),
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date() },
      ],
    });
    p7.sign({ detached: true });
    files["signature"] = binaryToBytes(forge.asn1.toDer(p7.toAsn1()).getBytes());

    const zip = new JSZip();
    for (const [name, bytes] of Object.entries(files)) zip.file(name, bytes);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.apple.pkpass", compression: "DEFLATE" });
  }

  window.W.Wallet = { Signer, build, passJSON };
})();
