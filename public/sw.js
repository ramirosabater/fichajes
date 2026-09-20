// Service worker mínimo: red primero, con caché de respaldo para arranque rápido.
const CACHE = "fichaje-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // no interferir con Supabase
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const net = await fetch(e.request);
        cache.put(e.request, net.clone());
        return net;
      } catch {
        const cached = await cache.match(e.request);
        return cached || Response.error();
      }
    })
  );
});
