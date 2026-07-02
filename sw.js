const CACHE_NAME = 'lujain-atlas-v27-ios';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => {
        // iOS Safari sometimes fails on individual resources
        console.log('Cache addAll failed, continuing anyway', err);
        return Promise.resolve();
      })
  );
  // Force activation on iOS Safari to prevent stuck states
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name).catch(() => true))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  // iOS Safari fix: ignore non-GET requests and opaque responses
  if (event.request.method !== 'GET') return;

  // For main HTML page: Network First, then Cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cacheCopy).catch(() => {});
            }).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then(r => r || new Response('Offline', {status: 503}));
        })
    );
    return;
  }

  // For static assets: Cache First with background update
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Update cache in background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse).catch(() => {});
            }).catch(() => {});
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache).catch(() => {});
        }).catch(() => {});
        return networkResponse;
      }).catch(() => {
        return new Response('Offline', {status: 503});
      });
    })
  );
});