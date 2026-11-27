// Offline support. Bump the version after you change files.
const CACHE = "cardfolio-v23";
const CORE = ["./", "index.html", "styles.css", "app.js", "core.js", "templates.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "logo.svg", "mark.svg", "brand.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so updates show up; falls back to the cache offline.
// The app's own files always check with GitHub for a newer version, so the
// browser never mixes an old file with a new one after an update.
// Libraries from the CDN and fonts are cached the first time they load.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.url.startsWith("blob:")) return;
  e.respondWith(
    fetch(e.request, new URL(e.request.url).origin === location.origin ? { cache: "no-cache" } : {}).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
