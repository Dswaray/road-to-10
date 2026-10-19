/* Road to 10% offline cache. Bump VERSION whenever any app file changes. */
const VERSION = "road-to-10-v8";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-512.png"];

/* Ask the server for the newest copy (skipping the browser's own short-term cache) and save it. */
async function refresh(url){
  const res = await fetch(url, { cache: "no-cache", credentials: "same-origin" });
  if (res && res.ok && !res.redirected){ const cache = await caches.open(VERSION); await cache.put(url, res.clone()); }
  return res;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const network = refresh(req.url).catch(() => null);
  event.waitUntil(network);

  /* The app page: newest version first, so an upload shows up the next time you open the app.
     Offline, or no answer within 3 seconds: use the saved copy. */
  if (req.mode === "navigate"){
    event.respondWith((async () => {
      const res = await Promise.race([network, new Promise(r => setTimeout(() => r(null), 3000))]);
      if (res && res.ok && !res.redirected) return res;
      const cache = await caches.open(VERSION);
      const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html")) || (await cache.match("./"));
      return hit || (await network) || Response.error();
    })());
    return;
  }

  /* Icons and the manifest: saved copy straight away, refreshed in the background. */
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return (await network) || Response.error();
  })());
});
