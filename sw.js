/* Road to 10% offline cache. Bump VERSION whenever any app file changes. */
const VERSION = "road-to-10-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Serve from the cache straight away (works offline), then refresh the cache in the
   background so the next launch picks up any new version you upload. */
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const network = fetch(req).then(async res => {
    if (res && res.ok){ const cache = await caches.open(VERSION); await cache.put(req, res.clone()); }
    return res;
  }).catch(() => null);
  event.waitUntil(network);
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await network;
    if (res) return res;
    if (req.mode === "navigate") return (await cache.match("./index.html")) || (await cache.match("./"));
    return Response.error();
  })());
});
