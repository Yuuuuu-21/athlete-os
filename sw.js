/* ==========================================================
   sw.js — offline shell for Athlete OS

   Network-first for same-origin GETs, falling back to the cache
   when offline. Cache-first would be marginally faster, but it
   also means an edited file keeps serving the old version until
   the cache name is bumped — a trap when you tweak the app on
   your own machine. Data never touches this cache: it all lives
   in IndexedDB.
   ========================================================== */

const CACHE = 'athlete-os-v2';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/core/dom.js',
  './js/core/dates.js',
  './js/core/db.js',
  './js/core/store.js',
  './js/core/sheet.js',
  './js/core/router.js',
  './js/domain/condition.js',
  './js/domain/workouts.js',
  './js/domain/plan.js',
  './js/domain/nutrition.js',
  './js/domain/sessions.js',
  './js/domain/stats.js',
  './js/ui/icons.js',
  './js/ui/widgets.js',
  './js/ui/chart.js',
  './js/screens/home.js',
  './js/screens/training.js',
  './js/screens/body.js',
  './js/screens/food.js',
  './js/screens/review.js',
  './js/screens/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
