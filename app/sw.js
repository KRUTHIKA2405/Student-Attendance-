const CACHE_NAME = 'attendance-cache-v1';
const ASSETS = ['/', '/app/index.html', '/app/styles.css', '/app/app.js', '/app/db.js', '/app/mock-data.json', '/app/risk-data.json', 'https://cdn.jsdelivr.net/npm/chart.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
    const clone = resp.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    return resp;
  })).catch(() => caches.match('/app/index.html')));
});

self.addEventListener('sync', event => {
  if (event.tag === 'attendance-sync') {
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
    }));
  }
});