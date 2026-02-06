/*==========================================================================
  PERFORMANCE INTERPRETING PWA - SERVICE WORKER
  Handles offline functionality and caching
  ==========================================================================*/

const CACHE_VERSION = 'pi-events-v1.9.6-backend-hardening'; // INCREMENT THIS FOR EACH UPDATE
const CACHE_NAME = `${CACHE_VERSION}-static`;
const DATA_CACHE_NAME = `${CACHE_VERSION}-data`;

// Critical files to cache for offline use (must succeed during installation)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css?v=1.9.6',
    '/app.js?v=1.9.6',
    '/manifest.json'
];

// Additional files to cache on-demand (won't block installation)
const CACHE_ON_DEMAND = [
    '/booking-guide.html'
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
                        if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
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
                        // Clone and cache the response
                        const responseClone = response.clone();
                        caches.open(DATA_CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                        return response;
                    }),
                // Timeout - fall back to cache after 3 seconds
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
    
    // Handle external resources (images, fonts, etc.)
    if (requestUrl.origin !== location.origin) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(event.request)
                        .then((response) => {
                            // Cache external resources for offline use
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                            return response;
                        });
                })
        );
        return;
    }
    
    // Handle local static assets (cache first, network fallback)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Serve from cache
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request, {
                    redirect: 'follow'  // Follow redirects automatically
                })
                    .then((response) => {
                        // Check if response is valid
                        if (!response || !response.ok) {
                            console.warn('[Service Worker] Invalid response:', response);
                            return response;
                        }

                        // Only cache successful, non-redirect, same-origin responses
                        if (response.status === 200 &&
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
                        console.error('[Service Worker] Fetch failed:', error, event.request.url);

                        // Only fall back to index.html for the root path
                        if (event.request.mode === 'navigate' &&
                            (event.request.url.endsWith('/') || event.request.url.endsWith('/index.html'))) {
                            return caches.match('/index.html');
                        }

                        // For other navigation failures, throw error to let browser handle
                        throw error;
                    });
            })
    );
});

// Handle background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-events') {
        event.waitUntil(
            // Sync logic can be added here if needed
            Promise.resolve()
        );
    }
});

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');

    let notificationData = {
        title: 'New BSL/ISL Event Available!',
        body: 'Check out the latest interpreted events',
        icon: 'PI Favicon.png',
        badge: 'PI Favicon.png',
        tag: 'pi-event-notification',
        requireInteraction: false,
        vibrate: [200, 100, 200, 100, 200]
    };

    // Parse notification data if provided
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                title: data.title || notificationData.title,
                body: data.body || notificationData.body,
                icon: data.icon || notificationData.icon,
                badge: data.badge || notificationData.badge,
                tag: data.tag || notificationData.tag,
                data: data.url ? { url: data.url } : { url: '/' },
                vibrate: [200, 100, 200, 100, 200]
            };
        } catch (err) {
            console.error('[Service Worker] Failed to parse push data:', err);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            data: notificationData.data,
            vibrate: notificationData.vibrate,
            requireInteraction: notificationData.requireInteraction
        })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked');
    event.notification.close();

    // Get the URL from notification data, default to root
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
