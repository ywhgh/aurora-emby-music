#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
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
    });

    const searchPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/search?q=resume&limit=5`);
    const track = searchPayload.items?.find((item) => item.source === "plugin");

    assert(track, "source bridge search did not return a plugin track");
    assert(track.restore?.raw?.id === "resume-song", "plugin search result did not expose a restore snapshot");

    const mediaPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/media?id=${encodeURIComponent(track.id)}&quality=standard`);
    const streamUrl = String(mediaPayload.streamUrl || "");
    const streamSnapshot = new URL(streamUrl).searchParams.get("track");

    assert(streamUrl.includes("/plugin-stream"), `media did not return a stable plugin stream URL: ${streamUrl || "-"}`);
    assert(streamSnapshot && JSON.parse(streamSnapshot).raw?.id === "resume-song", "plugin stream URL did not carry a restore snapshot");

    const firstStream = await fetchHead(streamUrl);
    assert(firstStream.status === 200, `initial plugin stream HEAD returned HTTP ${firstStream.status}`);
    assert(firstStream.headers.get("content-type") === "audio/mpeg", `initial plugin stream content-type mismatch: ${firstStream.headers.get("content-type") || "-"}`);

    await stopBridge(firstBridge);
    firstBridge = null;

    secondBridge = await startBridge({
      port: bridgePort,
      pluginCachePath,
      noDefaultManifest: true,
    });

    const restoredStream = await fetchHead(streamUrl);
    assert(restoredStream.status === 200, `restored plugin stream HEAD returned HTTP ${restoredStream.status}`);
    assert(restoredStream.headers.get("content-type") === "audio/mpeg", `restored plugin stream content-type mismatch: ${restoredStream.headers.get("content-type") || "-"}`);

    const localPayload = await fetchJson(`http://127.0.0.1:${bridgePort}/tracks?limit=10`);
    const localTrack = localPayload.items?.find((item) => item.source === "local");
    assert(localTrack, "source bridge fixture should expose a local track for lyric matching");
    const matchedLyric = await fetchJson(`http://127.0.0.1:${bridgePort}/lyric?id=${encodeURIComponent(localTrack.id)}`);
    assert(matchedLyric.matched === true, "local track without sidecar lyrics should use plugin lyric matching");
    assert(String(matchedLyric.lrc || "").includes("[00:01.00]Bridge lyric line"), `matched lyric text mismatch: ${matchedLyric.lrc || "-"}`);

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

    console.log("source-bridge-smoke ok");
  } finally {
    await stopBridge(firstBridge);
    await stopBridge(secondBridge);
    await closeServer(fixture.server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function createFixtureServer() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (url.pathname === "/manifest.json") {
        sendJson(response, {
          plugins: [{
            name: "Smoke Plugin",
            url: `http://${request.headers.host}/plugin.js`,
            version: "1.0.0",
          }],
        });
        return;
      }

      if (url.pathname === "/plugin.js") {
        const origin = `http://${request.headers.host}`;
        const body = `
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
    return {
      lrc: "[00:01.00]Bridge lyric line\\n[00:02.00]Smoke lyric line"
    };
  }
};
`;
        sendText(response, body, "application/javascript; charset=utf-8");
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
        urls: {
          manifest: `http://127.0.0.1:${port}/manifest.json`,
        },
      });
    });
  });
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
  });
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
