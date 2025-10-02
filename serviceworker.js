// Water Tracker – serviceworker.js (v3)
const CACHE = 'water-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './resources/css/style.css',
  './resources/js/app.js',
  './resources/js/jquery.js',
  './resources/imgs/watertracker.png',
  './resources/imgs/icon-192.png',
  './resources/imgs/icon-512.png',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))));
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  evt.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(()=>{});
      return res;
    }).catch(()=> cached))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    if (allClients && allClients.length) {
      const client = allClients[0];
      client.focus();
    } else {
      clients.openWindow('./');
    }
  })());
});
