#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BRIDGE_SCRIPT = path.join(ROOT_DIR, "scripts", "source-bridge.js");
const FIXTURE_MEDIA = Buffer.from("ID3\u0003\u0000\u0000\u0000\u0000\u0000\u0000EMBY_MUSIC_BRIDGE_SMOKE");
const HEALTH_TIMEOUT_MS = 20000;

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "emby-music-source-bridge-smoke-"));
  const pluginCachePath = path.join(tempDir, "plugin-cache.json");
  const fixture = await createFixtureServer();
  const bridgePort = await getFreePort();
  let firstBridge = null;
  let secondBridge = null;

  try {
    firstBridge = await startBridge({
      port: bridgePort,
      manifestUrl: fixture.urls.manifest,
      pluginCachePath,
      apiToken: "smoke-config-token",
      trustedKey: fixture.publicKey,
    });

    await checkConfigureAuthentication(firstBridge, fixture.urls.manifest);
    await checkRemoteStreamGuards(bridgePort);
    await checkCorsPolicy(bridgePort);

    const sourcePayload = await fetchJson(`http://127.0.0.1:${bridgePort}/sources`);
    const searchPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/search?q=resume&limit=5`);
    const track = searchPayload.items?.find((item) => item.source === "plugin");

    assert(track, `source bridge search did not return a plugin track: ${JSON.stringify(searchPayload)}; sources=${JSON.stringify(sourcePayload)}; output=${firstBridge.output.join("").trim()}`);
    assert(track.restore?.raw?.id === "resume-song", "plugin search result did not expose a restore snapshot");

    const mediaPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/media?id=${encodeURIComponent(track.id)}&quality=standard`);
    const streamUrl = String(mediaPayload.streamUrl || "");
    const streamSnapshot = new URL(streamUrl).searchParams.get("track");

    assert(streamUrl.includes("/plugin-stream"), `media did not return a stable plugin stream URL: ${streamUrl || "-"}`);
    assert(streamSnapshot && JSON.parse(streamSnapshot).raw?.id === "resume-song", "plugin stream URL did not carry a restore snapshot");

    const firstStream = await fetchHead(streamUrl);
    assert(firstStream.status === 403, `private fixture stream should be blocked, got HTTP ${firstStream.status}`);

    const localPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/tracks?limit=10`);
    const localTrack = localPayload.items?.find((item) => item.source === "local");
    assert(localTrack, "source bridge fixture should expose a local track for lyric matching");
    const matchedLyric = await fetchJson(`http://127.0.0.1:${bridgePort}/lyric?id=${encodeURIComponent(localTrack.id)}`);
    assert(matchedLyric.matched === true, "local track without sidecar lyrics should use plugin lyric matching");
    assert(String(matchedLyric.lrc || "").includes("[00:01.00]Bridge lyric line"), `matched lyric text mismatch: ${matchedLyric.lrc || "-"}`);

    await stopBridge(firstBridge);
    firstBridge = null;

    secondBridge = await startBridge({
      port: bridgePort,
      pluginCachePath,
      noDefaultManifest: true,
    });

    const restoredStream = await fetchHead(streamUrl);
    assert(restoredStream.status === 404, `snapshot without a currently verified manifest should be invalid, got HTTP ${restoredStream.status}`);

    const sidecarTrackPath = createBilingualSidecarFixture(path.dirname(pluginCachePath));
    const sidecarLyric = await fetchJson(`http://127.0.0.1:${bridgePort}/lyric-by-path?path=${encodeURIComponent(sidecarTrackPath)}`);
    assert(sidecarLyric.local === true, "lyric-by-path should mark resolved sidecar lyrics as local");
    assert(sidecarLyric.hasBilingual === true, "lyric-by-path should report bilingual sidecar lyrics");
    assert(String(sidecarLyric.lrc || "").includes("双语翻译行"), `lyric-by-path should prefer bilingual sidecar lyrics, got: ${sidecarLyric.lrc || "-"}`);
    assert(!String(sidecarLyric.lyricPath || "").includes(".lddc.verbatim.lrc"), "lyric-by-path should avoid the LDDC verbatim sidecar for normal display");

    const remoteSidecarPath = `/server/library/${path.basename(path.dirname(sidecarTrackPath))}/${path.basename(sidecarTrackPath)}`;
    const suffixSidecarLyric = await fetchJson(`http://127.0.0.1:${bridgePort}/lyric-by-path?path=${encodeURIComponent(remoteSidecarPath)}`);
    assert(suffixSidecarLyric.hasBilingual === true, "lyric-by-path should resolve Emby paths by music-dir suffix fallback");
    assert(String(suffixSidecarLyric.mediaPath || "") === sidecarTrackPath, `suffix fallback resolved wrong media path: ${suffixSidecarLyric.mediaPath || "-"}`);

    await waitForPluginCache(pluginCachePath, "resume-song");
    const cachePayload = JSON.parse(fs.readFileSync(pluginCachePath, "utf8"));
    assert(cachePayload.tracks?.some((item) => item.sourceId === "resume-song"), "plugin track cache did not persist the searched track");

    await stopBridge(secondBridge);
    secondBridge = null;
    await checkRejectedManifest(fixture.urls.unsignedManifest, fixture.publicKey, pluginCachePath, "unsigned");
    await checkRejectedManifest(fixture.urls.tamperedManifest, fixture.publicKey, pluginCachePath, "tampered");

    console.log("source-bridge-smoke ok");
  } finally {
    await stopBridge(firstBridge);
    await stopBridge(secondBridge);
    await closeServer(fixture.server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function createFixtureServer() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const pluginCodeForOrigin = (origin) => `
module.exports = {
  platform: "Smoke",
  supportedSearchType: ["music"],
  async search() {
    return [{
      id: "resume-song",
      title: "Bridge Resume Smoke",
      artist: "Smoke Artist",
      album: "Smoke Album",
      duration: 12,
      codec: "mp3",
      bitrate: 320000
    }];
  },
  async getMediaSource(track, quality) {
    return {
      url: "${origin}/media/resume-song.mp3?quality=" + encodeURIComponent(quality || "standard"),
      codec: "mp3",
      bitrate: 320000,
      contentType: "audio/mpeg",
      raw: track
    };
  },
  async getLyric() {
    return { lrc: "[00:01.00]Bridge lyric line\\n[00:02.00]Smoke lyric line" };
  }
};
`;

  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const origin = `http://${request.headers.host}`;
      const pluginCode = pluginCodeForOrigin(origin);
      const codeSignature = crypto.sign("sha256", Buffer.from(pluginCode), privateKey).toString("base64");
      const manifestBody = {
        plugins: [{
          name: "Smoke Plugin",
          url: `${origin}/plugin.js`,
          version: "1.0.0",
          signature: codeSignature,
        }],
      };
      const manifest = {
        ...manifestBody,
        signature: crypto.sign("sha256", Buffer.from(stableStringify(manifestBody)), privateKey).toString("base64"),
      };

      if (url.pathname === "/manifest.json") {
        sendJson(response, manifest);
        return;
      }
      if (url.pathname === "/unsigned-manifest.json") {
        sendJson(response, manifestBody);
        return;
      }
      if (url.pathname === "/tampered-manifest.json") {
        sendJson(response, { ...manifest, plugins: [{ ...manifest.plugins[0], version: "1.0.1" }] });
        return;
      }
      if (url.pathname === "/plugin.js") {
        sendText(response, pluginCode, "application/javascript; charset=utf-8");
        return;
      }
      if (url.pathname === "/media/resume-song.mp3") {
        response.writeHead(200, {
          "Content-Type": "audio/mpeg",
          "Content-Length": FIXTURE_MEDIA.length,
          "Accept-Ranges": "bytes",
        });
        if (request.method === "HEAD") {
          response.end();
          return;
        }
        response.end(FIXTURE_MEDIA);
        return;
      }
      sendJson(response, { error: "fixture not found" }, 404);
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        publicKey,
        urls: {
          manifest: `http://127.0.0.1:${port}/manifest.json`,
          unsignedManifest: `http://127.0.0.1:${port}/unsigned-manifest.json`,
          tamperedManifest: `http://127.0.0.1:${port}/tampered-manifest.json`,
        },
      });
    });
  });
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}


async function checkRejectedManifest(manifestUrl, trustedKey, pluginCachePath, label) {
  const port = await getFreePort();
  const bridge = await startBridge({
    port,
    manifestUrl,
    pluginCachePath,
    trustedKey,
    noDefaultManifest: true,
  });
  try {
    const payload = await fetchJson(`http://127.0.0.1:${port}/sources`);
    const manifest = payload.manifests?.[0];
    assert(manifest?.executable === false, `${label} manifest should not be executable`);
    assert(manifest?.error === "plugin manifest rejected", `${label} manifest rejection reason mismatch`);
  } finally {
    await stopBridge(bridge);
  }
}

async function startBridge(options) {
  const musicDir = options.musicDir || createLocalMusicFixture(options.pluginCachePath);
  const args = [
    BRIDGE_SCRIPT,
    "--host",
    "127.0.0.1",
    "--port",
    String(options.port),
    "--plugin-cache",
    options.pluginCachePath,
    "--music-dir",
    musicDir,
  ];

  if (options.manifestUrl) {
    args.push("--manifest-url", options.manifestUrl);
  }

  if (options.noDefaultManifest) {
    args.push("--no-default-manifest");
  }

  const child = childProcess.spawn(process.execPath, args, {
    cwd: ROOT_DIR,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(options.apiToken ? { SOURCE_BRIDGE_API_TOKEN: options.apiToken } : {}),
      ...(options.trustedKey ? { EMBY_BRIDGE_TRUSTED_KEYS: options.trustedKey } : {}),
    },
  });
  child.musicDir = musicDir;
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  child.output = output;

  try {
    await waitForHealth(`http://127.0.0.1:${options.port}/health`);
    return child;
  } catch (error) {
    await stopBridge(child);
    throw new Error(`${error.message}\n${output.join("").trim()}`);
  }
}

function createLocalMusicFixture(pluginCachePath) {
  const dir = path.join(path.dirname(pluginCachePath), "music");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "Smoke Artist - Bridge Resume Smoke.mp3"), FIXTURE_MEDIA);
  return dir;
}

function createBilingualSidecarFixture(rootDir) {
  const dir = path.join(rootDir, "music", "sidecar");
  const mediaPath = path.join(dir, "Sidecar Artist - Bilingual Sidecar.mp3");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(mediaPath, FIXTURE_MEDIA);
  fs.writeFileSync(path.join(dir, "Sidecar Artist - Bilingual Sidecar.lrc"), [
    "[00:01.00]English only line",
    "[00:02.00]Another English line",
  ].join("\n"));
  fs.writeFileSync(path.join(dir, "Sidecar Artist - Bilingual Sidecar.safe.lrc"), [
    "[00:01.00]Original line one",
    "[00:01.00]双语翻译行一",
    "[00:02.00]Original line two",
    "[00:02.00]双语翻译行二",
    "[00:03.00]Original line three",
    "[00:03.00]双语翻译行三",
  ].join("\n"));
  fs.writeFileSync(path.join(dir, "Sidecar Artist - Bilingual Sidecar.lddc.verbatim.lrc"), [
    "[00:01.00]<0.00>Original",
    "[00:01.00]<0.00>逐字备份",
  ].join("\n"));
  return mediaPath;
}

async function checkConfigureAuthentication(bridge, manifestUrl) {
  const portIndex = bridge.spawnargs.indexOf("--port");
  const url = `http://127.0.0.1:${bridge.spawnargs[portIndex + 1]}/configure`;
  const payload = JSON.stringify({ musicDir: bridge.musicDir, manifestUrl });
  const missing = await fetchJsonResponse(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
  assert(missing.response.status === 401, `configure without token returned HTTP ${missing.response.status}`);
  const mismatch = await fetchJsonResponse(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Bridge-Token": "wrong-token" }, body: payload });
  assert(mismatch.response.status === 401, `configure with mismatched token returned HTTP ${mismatch.response.status}`);
  const allowed = await fetchJsonResponse(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Bridge-Token": "smoke-config-token" }, body: payload });
  assert(allowed.response.status === 200 && allowed.payload?.ok === true, `configure with valid token returned HTTP ${allowed.response.status}`);
}

async function checkRemoteStreamGuards(port) {
  for (const target of ["http://127.0.0.1/media", "http://192.168.1.10/media", "http://10.0.0.1/media"]) {
    const result = await fetchJsonResponse(`http://127.0.0.1:${port}/remote-stream?url=${encodeURIComponent(target)}`);
    assert(result.response.status === 403, `blocked remote target returned HTTP ${result.response.status}: ${target}`);
  }
  const unsupported = await fetchJsonResponse(`http://127.0.0.1:${port}/remote-stream?url=${encodeURIComponent("file:///fixture")}`);
  assert(unsupported.response.status === 400, `unsupported remote protocol returned HTTP ${unsupported.response.status}`);
}

async function checkCorsPolicy(port) {
  const blocked = await fetchJsonResponse(`http://127.0.0.1:${port}/health`, { headers: { Origin: "https://blocked.example.test" } });
  assert(blocked.response.status === 403, `disallowed Origin returned HTTP ${blocked.response.status}`);
  const allowed = await fetchJsonResponse(`http://127.0.0.1:${port}/health`, { headers: { Origin: "http://127.0.0.1:5173" } });
  assert(allowed.response.status === 200, `allowed local Origin returned HTTP ${allowed.response.status}`);
  assert(allowed.response.headers.get("access-control-allow-origin") === "http://127.0.0.1:5173", "allowed Origin should be echoed exactly");
}
async function waitForHealth(url) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await delay(100);
  }

  throw new Error(`source bridge did not become healthy: ${url}`);
}

async function waitForPluginCache(cachePath, sourceId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    try {
      const payload = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (payload.tracks?.some((item) => item.sourceId === sourceId)) {
        return payload;
      }
    } catch {
      // Cache flush is asynchronous; keep polling until it appears.
    }

    await delay(100);
  }

  throw new Error(`plugin cache did not persist ${sourceId}: ${cachePath}`);
}

function stopBridge(child) {
  return new Promise((resolve) => {
    if (!child || child.killed || child.exitCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Best-effort cleanup.
      }
      resolve();
    }, 2000);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server?.close(() => resolve());
  });
}

function getFreePort() {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function fetchJsonResponse(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}
async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);
  assert(response.ok, `GET ${url} returned HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function fetchHead(url) {
  return fetch(url, { method: "HEAD" });
}

function sendJson(response, payload, statusCode = 200) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendText(response, body, contentType) {
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
