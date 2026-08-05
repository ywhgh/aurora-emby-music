#!/usr/bin/env node
"use strict";

/**
 * Minimal static file server for local development.
 *
 * Replaces the previous `python -m http.server` recipe so `npm run serve`
 * works on machines without Python. Node built-ins only.
 *
 *   npm run serve            # http://localhost:5173/
 *   npm run serve -- 8080    # custom port
 *
 * Env:
 *   PORT   port to listen on (default 5173, overridden by the CLI argument)
 *   HOST   interface to bind (default 127.0.0.1)
 *   ROOT   directory to serve (default the repository root)
 */

const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const url = require("node:url");

const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, ".."));
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const EMBY_PROXY_PREFIX = "/__emby-proxy";
const EMBY_PROXY_TARGET = parseProxyTarget(process.env.EMBY_PROXY_TARGET);

// ESM imports and the service worker are rejected by the browser when the
// Content-Type is wrong, so the JS/JSON/manifest entries are load-bearing
// rather than cosmetic.
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".flac": "audio/flac",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4a": "audio/mp4",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ts": "video/mp2t",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

/**
 * Map a request path to a file inside ROOT, or null when it escapes it.
 * `path.resolve` collapses `..` before the prefix test, so encoded traversal
 * attempts land outside ROOT and are rejected.
 */
function resolveTarget(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const resolved = path.resolve(ROOT, `.${path.posix.normalize(decoded)}`);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

function parseProxyTarget(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  try {
    const target = new URL(trimmed);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
      return null;
    }

    target.pathname = target.pathname.replace(/\/+$/, "");
    return target;
  } catch {
    return null;
  }
}

function isEmbyProxyPath(pathname) {
  return pathname === EMBY_PROXY_PREFIX || pathname.startsWith(`${EMBY_PROXY_PREFIX}/`);
}

function proxyEmbyRequest(request, response, requestUrl) {
  if (!EMBY_PROXY_TARGET) {
    send(response, 503, "Emby proxy is not configured");
    return;
  }

  const suffix = requestUrl.pathname.slice(EMBY_PROXY_PREFIX.length) || "/";
  const basePath = EMBY_PROXY_TARGET.pathname.replace(/\/+$/, "");
  const targetPath = `${basePath}${suffix.startsWith("/") ? suffix : `/${suffix}`}` || "/";
  const targetUrl = new URL(`${EMBY_PROXY_TARGET.origin}${targetPath}${requestUrl.search}`);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const headers = { ...request.headers };
  delete headers.host;
  delete headers.connection;
  headers.host = targetUrl.host;

  const upstream = transport.request(targetUrl, {
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    const responseHeaders = {};
    Object.entries(upstreamResponse.headers).forEach(([key, value]) => {
      if (!["connection", "keep-alive", "transfer-encoding"].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });

  upstream.setTimeout(30_000, () => upstream.destroy(new Error("Emby proxy timeout")));
  upstream.on("error", () => {
    if (!response.headersSent) {
      send(response, 502, "Emby proxy unavailable");
    } else {
      response.destroy();
    }
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (isEmbyProxyPath(requestUrl.pathname)) {
    proxyEmbyRequest(request, response, requestUrl);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
    return;
  }

  const { pathname } = url.parse(request.url || "/");
  const target = resolveTarget(pathname || "/");
  if (!target) {
    send(response, 403, "Forbidden");
    return;
  }

  let filePath = target;
  let stats = null;
  try {
    stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stats = fs.statSync(filePath);
    }
  } catch {
    send(response, 404, "Not Found");
    return;
  }

  const headers = {
    "Content-Length": stats.size,
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    // The service worker only takes an updated scope from the server root.
    ...(path.basename(filePath) === "sw.js" ? { "Service-Worker-Allowed": "/" } : {}),
  };

  if (request.method === "HEAD") {
    response.writeHead(200, { "Cache-Control": "no-store", ...headers });
    response.end();
    return;
  }

  response.writeHead(200, { "Cache-Control": "no-store", ...headers });
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
});

server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `static-server: port ${PORT} is already in use`
      : `static-server: ${error.message}`,
  );
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`static-server: serving ${ROOT} at http://${HOST}:${PORT}/`);
});
