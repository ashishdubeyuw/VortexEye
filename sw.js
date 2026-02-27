/**
 * VortexEye Service Worker
 * Enables offline support and PWA installability on Android and iOS
 */

const CACHE_NAME = 'vortexeye-v1';

// Assets to cache on install (app shell)
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
    '/js/logger.js',
    '/js/location-service.js',
    '/js/navigation.js',
    '/js/indoor-vision.js',
    '/js/voice-interface.js',
    '/js/step-counter.js',
    '/js/building-configs.js',
    '/js/indoor-positioning.js',
    '/js/bluetooth-service.js',
    '/js/debug-panel.js',
    '/js/app.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests; skip cross-origin API calls
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Pass through external tile/routing API requests to the network directly
    if (url.hostname !== self.location.hostname) {
        event.respondWith(
            fetch(event.request).catch(() => new Response(
                JSON.stringify({ error: 'Service unavailable - network offline' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
            ))
        );
        return;
    }

    // Cache-first strategy for same-origin assets
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                // Only cache valid responses
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(() => {
                // Offline fallback for HTML navigation requests
                if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
