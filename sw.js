// LinkChat Service Worker for PWA Support
const CACHE_NAME = 'linkchat-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './chat.html',
  './style.css',
  './firebase.js',
  './script.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event - Caching App Shell Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell Assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Cleaning Up Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting Old Cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Serving Cached Assets when Network is Unavailable
self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS requests (bypass Firebase Realtime DB & Storage WebSocket connections)
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
