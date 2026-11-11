'use strict';

// tools/prepare_web.py replaces these tokens with a content hash and the exact
// exported file list. Cache the whole build atomically before claiming clients.
const BUILD_VERSION = '02fcb25c2b51e504f9c3';
const FILES = ["GODOT_COPYRIGHT.txt", "GODOT_LICENSE.txt", "README.md", "index.144x144.png", "index.180x180.png", "index.192x192.png", "index.512x512.png", "index.apple-touch-icon.png", "index.audio.position.worklet.js", "index.audio.worklet.js", "index.html", "index.icon.png", "index.js", "index.manifest.json", "index.offline.html", "index.pck", "index.png", "index.wasm", "install.html", "install.js"];
const CACHE_PREFIX = `lesorub:${new URL(self.registration.scope).pathname}:`;
const CACHE_NAME = CACHE_PREFIX + BUILD_VERSION;
const absolute = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(FILES.map((path) => new Request(absolute(path), { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Do not replace a running game automatically. The page offers an update.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (event.request.mode === 'navigate') {
      // Preserve cached documents such as install.html instead of turning every
      // navigation in this scope into the game. The directory URL maps to index.
      const document = await cache.match(event.request, { ignoreSearch: true });
      if (document) return document;
      const page = await cache.match(absolute('index.html'));
      if (page) return page;
      try {
        return await fetch(event.request);
      } catch (error) {
        return await cache.match(absolute('index.offline.html')) || Response.error();
      }
    }
    const cached = await cache.match(event.request, { ignoreSearch: true });
    return cached || fetch(event.request);
  })());
});

self.addEventListener('message', (event) => {
  if (!event.source || event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  } else if (event.data && event.data.type === 'CHECK_OFFLINE') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const responses = await Promise.all(FILES.map((path) => cache.match(absolute(path))));
      if (responses.every(Boolean) && event.ports[0]) {
        event.ports[0].postMessage({ type: 'OFFLINE_READY', version: BUILD_VERSION });
      }
    })());
  }
});
