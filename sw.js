/* Service worker «Копейки»: офлайн-оболочка и кэш всех файлов приложения. */
const VERSION = 'kopeyka-v1.0.0';
const CACHE = `kopeyka-cache-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/utils.js',
  './js/calc.js',
  './js/achievements.js',
  './js/data/course.js',
  './js/data/module-01.js',
  './js/data/module-02.js',
  './js/data/module-03.js',
  './js/data/tips.js',
  './js/data/glossary.js',
  './js/data/achievements.js',
  './js/ui/icons.js',
  './js/ui/components.js',
  './js/ui/home.js',
  './js/ui/course.js',
  './js/ui/shopping.js',
  './js/ui/budget.js',
  './js/ui/forms.js',
  './js/ui/calculators.js',
  './js/ui/profile.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return (await caches.match('./index.html')) || (await caches.match('./offline.html')) || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});
