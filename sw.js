const CACHE_NAME = "couple-site-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./menu.html",
  "./photos.html",
  "./calendar.html",
  "./about.html",
  "./blog.html",
  "./projects.html",
  "./contact.html",
  "./settings.html",
  "./css/style.css",
  "./js/backup.js",
  "./js/main.js",
  "./js/mobile-boot.js",
  "./js/mobile.js",
  "./js/menu.js",
  "./js/photos.js",
  "./js/calendar.js",
  "./manifest.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
