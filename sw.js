const CACHE_NAME = "emby-music-web-v0.93.230";
const ASSET_VERSION = "0.93.230";
const versioned = (path) => `${path}?v=${ASSET_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  versioned("./styles.css"),
  versioned("./src/config.js"),
  versioned("./src/dom-helpers.js"),
  versioned("./src/redact.js"),
  versioned("./src/login-fallback.js"),
  versioned("./src/format.js"),
  versioned("./src/lyrics.js"),
  versioned("./src/emby-api.js"),
  versioned("./src/external-source-api.js"),
  versioned("./src/idb-queue.js"),
  versioned("./src/storage.js"),
  versioned("./src/player.js"),
  versioned("./src/queue.js"),
  versioned("./src/hls-ready.js"),
  versioned("./main.js"),
  versioned("./app.js"),
  versioned("./manifest.webmanifest"),
  versioned("./icon.svg"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith("emby-music-web-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const fallbackUrl = request.mode === "navigate" ? "./index.html" : null;
  event.respondWith(staleWhileRevalidate(request, fallbackUrl, event));
});

async function staleWhileRevalidate(request, fallbackUrl, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const response = await refresh;
  if (response) {
    return response;
  }

  return fallbackUrl
    ? (await caches.match(fallbackUrl)) || Response.error()
    : Response.error();
}
