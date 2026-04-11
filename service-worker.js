/*==========================================================================
  PERFORMANCE INTERPRETING PWA - SERVICE WORKER
  Handles offline functionality and caching
  ==========================================================================*/

// Single source of truth for app version — update index.html ?v= params to match
const PI_VERSION = '2.1.8';
const CACHE_VERSION = `pi-events-v${PI_VERSION}-network-first`;
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE_NAME = `${CACHE_VERSION}-data`;
const EXTERNAL_CACHE_NAME = `${CACHE_VERSION}-external`;
const MAX_EXTERNAL_CACHE_ITEMS = 150; // Cap external resource cache (images, fonts, etc.)

// Critical files to cache for offline use (must succeed during installation)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    `/styles.css?v=${PI_VERSION}`,
    `/app.js?v=${PI_VERSION}`,
    '/manifest.json'
];

// Additional files to cache on-demand (won't block installation)
const CACHE_ON_DEMAND = [
    '/booking-guide-venues.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing version:', CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                // Cache critical assets - if this fails, installation fails
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Critical assets cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
                // Installation will fail, preventing broken service worker from activating
                throw error;
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating version:', CACHE_VERSION);

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches
                        if (cacheName !== CACHE_NAME &&
                            cacheName !== DATA_CACHE_NAME &&
                            cacheName !== EXTERNAL_CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete - version:', CACHE_VERSION);
                // Notify all clients that update is complete
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'SW_UPDATED',
                            version: CACHE_VERSION
                        });
                    });
                });
            })
            .then(() => {
                return self.clients.claim(); // Take control immediately
            })
    );
});

/**
 * Evict oldest entries from a cache when it exceeds maxItems.
 * Uses cache key ordering (oldest first) as a simple LRU proxy.
 */
async function evictOldestFromCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        const toDelete = keys.length - maxItems;
        for (let i = 0; i < toDelete; i++) {
            await cache.delete(keys[i]);
        }
    }
}

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Handle HTML pages with network-first strategy (always get fresh content)
    if (event.request.mode === 'navigate' ||
        requestUrl.pathname.endsWith('.html') ||
        requestUrl.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the successful response
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If offline, try to serve from cache
                    return caches.match(event.request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Last resort: serve index.html for app-like navigation
                            return caches.match('/index.html');
                        });
                })
        );
        return;
    }

    // Handle Google Sheets CSV requests with timeout for better offline UX
    // Try network first, but fall back to cache after 8 seconds (increased for slow connections)
    if (requestUrl.hostname === 'docs.google.com' && requestUrl.pathname.includes('/pub')) {
        const NETWORK_TIMEOUT = 8000; // 8 seconds

        event.respondWith(
            Promise.race([
                // Network fetch
                fetch(event.request)
                    .then((response) => {
                        // Only cache successful responses (not redirects or errors)
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(DATA_CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    }),
                // Timeout - fall back to cache after 8 seconds
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        caches.match(event.request)
                            .then((cachedResponse) => {
                                if (cachedResponse) {
                                    resolve(cachedResponse);
                                } else {
                                    reject(new Error('No cached response'));
                                }
                            });
                    }, NETWORK_TIMEOUT);
                })
            ]).catch(() => {
                // If both network and timeout fail, try cache one more time
                return caches.match(event.request);
            })
        );
        return;
    }

    // Handle external resources (images, fonts, etc.) with bounded cache
    if (requestUrl.origin !== location.origin) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(event.request)
                        .then((response) => {
                            // Cache external resources for offline use (with eviction)
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(EXTERNAL_CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseClone);
                                    // Evict oldest items if cache is too large
                                    evictOldestFromCache(EXTERNAL_CACHE_NAME, MAX_EXTERNAL_CACHE_ITEMS);
                                });
                            }
                            return response;
                        });
                })
        );
        return;
    }

    // Handle local static assets (network first, cache fallback for offline)
    event.respondWith(
        fetch(event.request, { redirect: 'follow' })
            .then((response) => {
                // Cache successful responses for offline use
                if (response && response.ok && response.status === 200 &&
                    !response.redirected &&
                    response.type !== 'opaqueredirect' &&
                    response.type !== 'opaque') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch((error) => {
                console.log('[Service Worker] Network failed, trying cache:', event.request.url);
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        // Last resort for navigation: serve index.html
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        throw error;
                    });
            })
    );
});

// ==================== PUSH NOTIFICATIONS ====================

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'PI Events';
    const options = {
        body: data.body || 'New interpreted events available!',
        icon: '/PI Favicon.png',
        badge: '/PI Favicon.png',
        tag: data.tag || 'pi-event-notification',
        data: data.url || '/',
        actions: [
            { action: 'open', title: 'View Events' }
        ],
        vibrate: [200, 100, 200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (navigator.clearAppBadge) navigator.clearAppBadge();
    let url = event.notification.data || '/';
    // Validate URL — only allow our own domains or relative paths
    try {
        const parsed = new URL(url, self.location.origin);
        if (!parsed.hostname.endsWith('performanceinterpreting.co.uk') && parsed.hostname !== self.location.hostname) {
            url = '/';
        }
    } catch { url = '/'; }
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes('performanceinterpreting') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

