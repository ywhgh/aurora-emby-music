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
const path = require("node:path");
const url = require("node:url");

const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, ".."));
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

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

const server = http.createServer((request, response) => {
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
