// Offline support: app shell + lesson data cached on install, audio cached the first time it plays.
const SHELL = "a1-shell-v80";
const AUDIO = "a1-audio-v1";
const CONTENT = "a1-content-v1"; // reading material, downloaded per skill only when opened (never precached)
const FILES = ["./", "index.html", "styles.css", "js/app.js", "js/store.js", "js/lesson.js", "js/audio.js", "js/hero.js", "js/bugreport.js", "js/lang.js", "js/tour.js", "js/life.js", "js/merge.js", "js/ask.js", "js/translate.js", "data/life.json", "data/se-path.json", "data/math-path.json",
  "data/content.json", "data/fr-a1.json", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-512-maskable.png", "icons/apple-touch-icon.png", "data/courses.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== AUDIO && k !== CONTENT).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/") || url.pathname.includes("/download/") || url.pathname.includes("/.well-known/")) return;
  if (url.pathname.includes("/audio/")) {
    // cache-first, store on first play
    e.respondWith(caches.open(AUDIO).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }));
    return;
  }
  if (url.pathname.includes("/data/se/") || url.pathname.includes("/data/math/")) {
    // downloaded reading: serve the phone's copy instantly (works offline), refresh it quietly in the background
    e.respondWith(caches.open(CONTENT).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) || new Response("offline", { status: 503 });
    }));
    return;
  }
  // app shell: network first (so updates arrive), cache as fallback when offline
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) caches.open(SHELL).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
