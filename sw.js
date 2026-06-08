const CACHE_NAME = "emby-music-web-v0.93.142";
const ASSET_VERSION = "0.93.142";
const versioned = (path) => `${path}?v=${ASSET_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  versioned("./styles.css"),
  versioned("./src/config.js"),
  versioned("./src/format.js"),
  versioned("./src/lyrics.js"),
  versioned("./src/emby-api.js"),
  versioned("./src/external-source-api.js"),
  versioned("./src/storage.js"),
  versioned("./app.js"),
  versioned("./manifest.webmanifest"),
  versioned("./icon.svg"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
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

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (isAppShellRequest(url)) {
    event.respondWith(networkFirst(request, request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function isAppShellRequest(url) {
  return APP_SHELL.some((path) => new URL(path, self.location.href).href === url.href);
}
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return caches.match(request).then((cached) => cached || caches.match(fallbackUrl));
  }
}

