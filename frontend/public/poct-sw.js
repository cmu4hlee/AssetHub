/**
 * POCT Service Worker (简化版)
 *
 * 策略:
 *  - 静态资源: cache-first(JS/CSS 改了名,hashed,vite build 自动 cache bust)
 *  - API 请求 /api/poct-quality-control: network-first,失败回退 cache
 *  - 导航请求: network-first,失败回退 /poct-quality-control 缓存
 */
const CACHE_NAME = 'poct-v1';
const PRECACHE_URLS = [
  '/poct-quality-control',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源
  if (url.origin !== self.location.origin) return;

  // API: network-first
  if (url.pathname.startsWith('/api/poct-quality-control')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // 静态资源 / 导航: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
