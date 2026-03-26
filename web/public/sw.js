/**
 * Service Worker Kill Switch
 * Clears old legacy caches and unregisters itself.
 * This ensures mobile users get the new React frontend instead of the cached old HTML.
 */

self.addEventListener('install', (e) => {
    // Force immediate takeover
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    // Delete all old caches immediately
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => caches.delete(key)));
        }).then(() => {
            self.clients.claim();
            // Unregister the service worker permanently
            self.registration.unregister().then(() => {
                console.log('Old Service Worker successfully unregistered and caches cleared.');
            });
        })
    );
});

// Pass through all fetch requests completely untouched
self.addEventListener('fetch', (e) => {
    // Do nothing, let the browser handle it
});
