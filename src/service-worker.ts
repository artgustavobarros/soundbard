/// <reference lib="webworker" />
export {};

declare const self: ServiceWorkerGlobalScope;
declare const PRECACHE: string[];
declare const CACHE_VERSION: string;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("soundbard-") && key !== CACHE_VERSION
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin ||
    new URL(request.url).pathname.startsWith("/api/")
  ) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);
          if (response.ok) {
            return response;
          }
        } catch {
          /* A navegação continua pelo shell que foi preparado para uso offline. */
        }
        return (await cache.match("/index.html")) ?? Response.error();
      }
      return (await cache.match(request)) ?? fetch(request);
    })()
  );
});
