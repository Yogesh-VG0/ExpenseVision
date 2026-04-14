const CACHE_NAME = "expensevision-runtime-v3";

const PRECACHE_URLS = [
  "/minimal_optimized_for_favicon.png",
  "/og_image.png",
];

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ── Activate ─────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (cache-first for static, network-first for navigation) ────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }
});

// ── Background Sync (progressive enhancement) ───────────────────────
// The sync event fires when connectivity is restored after the client
// registered a sync tag via `registration.sync.register(...)`.
// The actual queue processing is delegated back to a client page via
// postMessage so that the IndexedDB queue logic stays in one place.
self.addEventListener("sync", (event) => {
  if (event.tag === "pending-expense-upload") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "PROCESS_OFFLINE_QUEUE" });
        }
      })
    );
  }
});

// ── Push Notifications ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "ExpenseVision", body: event.data.text() };
  }

  const title = payload.title || "ExpenseVision";
  const options = {
    body: payload.body || "",
    icon: "/minimal_optimized_for_favicon.png",
    badge: "/minimal_optimized_for_favicon.png",
    data: payload.data || {},
    tag: payload.tag || "expensevision-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
