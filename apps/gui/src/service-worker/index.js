self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return;
    }
    console.log('Service Worker fetch event', event.request.url);
    if (url.pathname.match(/\.(webp|jpg|png|gif|svg|jpeg|well-known)$/)) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        return response;
                    }
                    throw new Error('Fetch failed');
                })
                .catch(() => {
                    const proxyUrl = `https://proxy.nostr.watch/${url.href}`;
                    return fetch(proxyUrl, {
                        mode: 'cors',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                })
        );
    }
});
