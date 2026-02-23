// KaiGI Service Worker

const CACHE_NAME = "kaigi-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest"
];

// インストール時キャッシュ
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// リクエスト時キャッシュ優先
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
