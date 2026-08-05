#!/usr/bin/env node
"use strict";

/**
 * Browser-level regression coverage for Emby playlist reads.
 *
 * Runs the same logged-in UI flow against two deliberately incompatible mock
 * server shapes:
 *   1. `/Playlists/{id}/Items` works while ParentId returns an empty page.
 *   2. `/Playlists/{id}/Items` returns 404 while ParentId works.
 *
 * It proves that the app selects the standard endpoint first and retains the
 * ParentId compatibility fallback without exposing a real Emby session.
 */

const childProcess = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const requestedAppPort = Number(process.env.PLAYLIST_SMOKE_APP_PORT || 0);
const requestedMockPort = Number(process.env.PLAYLIST_SMOKE_MOCK_PORT || 0);
const START_TIMEOUT_MS = Number(process.env.PLAYLIST_SMOKE_START_TIMEOUT_MS || 12_000);
const BROWSER_TIMEOUT_MS = Number(process.env.PLAYLIST_SMOKE_BROWSER_TIMEOUT_MS || 30_000);
const cases = [
  { mode: "playlist-only", expectedSource: "playlist" },
  { mode: "parent-only", expectedSource: "parent" },
];

function requestStatus(url, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode || 0));
    });
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Request timed out: ${url}`)));
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHttp(url, label) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const status = await requestStatus(url);
      if (status >= 200 && status < 300) {
        return;
      }
      lastError = new Error(`HTTP ${status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`${label} did not become ready: ${lastError?.message || "unknown error"}`);
}

function startNode(label, args, env = {}) {
  const output = [];
  const processHandle = childProcess.spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  processHandle.stdout.on("data", (chunk) => output.push(String(chunk)));
  processHandle.stderr.on("data", (chunk) => output.push(String(chunk)));
  processHandle.once("error", (error) => output.push(`${label} spawn error: ${error.message}`));

  return { label, processHandle, output };
}

async function stopNode(handle) {
  if (!handle?.processHandle || handle.processHandle.exitCode !== null) {
    return;
  }

  const processHandle = handle.processHandle;
  const exited = new Promise((resolve) => processHandle.once("exit", resolve));
  processHandle.kill("SIGTERM");
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2_500)),
  ]);

  if (!stopped && processHandle.pid) {
    childProcess.spawnSync("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}

function runBrowserSmoke(appUrl, mockUrl, expectedSource) {
  const result = childProcess.spawnSync(process.execPath, [path.join("scripts", "browser-smoke.js")], {
    cwd: root,
    env: {
      ...process.env,
      BROWSER_SMOKE_RUN: "1",
      BROWSER_SMOKE_DESKTOP_ONLY: "1",
      BROWSER_SMOKE_TIMEOUT_MS: String(BROWSER_TIMEOUT_MS),
      BROWSER_SMOKE_URL: appUrl,
      BROWSER_SMOKE_PLAYLIST: "1",
      BROWSER_SMOKE_SERVER_URL: mockUrl,
      BROWSER_SMOKE_USERNAME: "demo",
      BROWSER_SMOKE_PASSWORD: "demo",
      BROWSER_SMOKE_EXPECTED_PLAYLIST_SOURCE: expectedSource,
    },
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(`browser playlist smoke failed for expected source ${expectedSource} (exit ${result.status ?? "unknown"})`);
  }
}

async function main() {
  const appPort = requestedAppPort > 0 ? requestedAppPort : await getFreePort();
  const appUrl = `http://127.0.0.1:${appPort}/`;
  const app = startNode("static server", [path.join("scripts", "static-server.js"), String(appPort)]);

  try {
    await waitForHttp(appUrl, "static server");

    for (const testCase of cases) {
      const mockPort = requestedMockPort > 0 ? requestedMockPort : await getFreePort();
      const mockUrl = `http://127.0.0.1:${mockPort}`;
      const mock = startNode("mock Emby", [path.join("scripts", "mock-emby.js"), String(mockPort)], {
        MOCK_EMBY_PLAYLIST_READ_MODE: testCase.mode,
      });

      try {
        await waitForHttp(`${mockUrl}/System/Info/Public`, `mock Emby (${testCase.mode})`);
        console.log(`playlist-smoke: ${testCase.mode} → ${testCase.expectedSource}`);
        runBrowserSmoke(appUrl, mockUrl, testCase.expectedSource);
      } finally {
        await stopNode(mock);
      }
    }
  } finally {
    await stopNode(app);
  }

  console.log("playlist-smoke ok (playlist endpoint primary + ParentId fallback)");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});