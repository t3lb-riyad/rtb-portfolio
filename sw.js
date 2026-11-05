/* =========================================================================
   sw.js
   Offline shell.

   Bump CACHE_VERSION after editing any shell file so the new copy is used.
   Strategy:
   - navigations: network first, cache fallback (so edits show up right away)
   - css / js / manifest / icons: cache first
   - images: stale while revalidate
   - anything cross-origin (Supabase): never cached
   ========================================================================= */

var CACHE_VERSION = 'riyad-portfolio-v25';
var SHELL_CACHE = CACHE_VERSION + '-shell';
var IMAGE_CACHE = CACHE_VERSION + '-images';

var SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/icons.js',
  './js/strings.js',
  './js/data.js',
  './js/supabase.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/profile.jpg',
  './images/anilogo.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .catch(function () { /* keep going even if one file is missing */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== IMAGE_CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (/\.(css|js|json)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(SHELL_CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (hit) {
      return hit || caches.match('./index.html');
    });
  });
}

function cacheFirst(request, cacheName) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;

    return fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    });
  });
}

function staleWhileRevalidate(request, cacheName) {
  return caches.match(request).then(function (hit) {
    var network = fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return hit; });

    return hit || network;
  });
}
