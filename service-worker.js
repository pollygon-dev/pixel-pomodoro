const CACHE_NAME = 'pixel-pomodoro-v1';
const assetsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/assets/music/popstep.mp3',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(assetsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});