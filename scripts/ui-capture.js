#!/usr/bin/env node
"use strict";

/**
 * Screenshot the logged-in UI against scripts/mock-emby.js.
 *
 * Complements browser-smoke.js, which only ever sees the login page: this
 * driver actually authenticates, loads a library, starts playback, and dumps
 * one PNG per view per viewport so mobile layout regressions are reviewable.
 *
 *   node ./scripts/mock-emby.js 8096 &
 *   node "<static server>" . 5173 &
 *   node ./scripts/ui-capture.js
 *
 * Env:
 *   UI_CAPTURE_URL         app origin (default http://localhost:5173/)
 *   UI_CAPTURE_EMBY_URL    mock server origin (default http://127.0.0.1:8096)
 *   UI_CAPTURE_DIR         output directory (default ./.ui-capture)
 *   UI_CAPTURE_VIEWPORTS   comma list of viewport names to run
 *   UI_CAPTURE_VIEWS       comma list of view ids to capture
 *   CHROME_PATH            Chrome executable
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const APP_URL = process.env.UI_CAPTURE_URL || "http://localhost:5173/";
const EMBY_URL = process.env.UI_CAPTURE_EMBY_URL || "http://127.0.0.1:8096";
const OUTPUT_DIR = path.resolve(process.env.UI_CAPTURE_DIR || path.join(__dirname, "..", ".ui-capture"));
const TIMEOUT_MS = Number(process.env.UI_CAPTURE_TIMEOUT_MS || 45000);
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const ALL_VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, mobile: true, scale: 2 },
  { name: "mobile-narrow", width: 360, height: 780, mobile: true, scale: 2 },
  { name: "tablet-narrow", width: 768, height: 920, mobile: true, scale: 2 },
  { name: "desktop", width: 1366, height: 900, mobile: false, scale: 1 },
];
const ALL_VIEWS = ["home", "library", "favorites", "playlists", "albums", "artists", "queue", "nowPlaying", "settings"];

function selected(envValue, all, key) {
  const wanted = String(envValue || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!wanted.length) {
    return all;
  }
  return all.filter((entry) => wanted.includes(key ? entry[key] : entry));
}

const VIEWPORTS = selected(process.env.UI_CAPTURE_VIEWPORTS, ALL_VIEWPORTS, "name");
const VIEWS = selected(process.env.UI_CAPTURE_VIEWS, ALL_VIEWS, "");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Request timed out: ${url}`)));
  });
}

async function withTimeout(promise, timeoutMs, label) {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readDevToolsPort(profileDir, output) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    const fromOutput = /ws:\/\/127\.0\.0\.1:(\d+)\//.exec(output.join(""));
    if (fromOutput) {
      return Number(fromOutput[1]);
    }
    try {
      const [portLine] = fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    } catch {
      // Chrome writes DevToolsActivePort once the endpoint is listening.
    }
    await delay(150);
  }

  throw new Error("Chrome did not expose a DevTools port");
}

async function waitForTarget(port) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const targets = await requestJson(`http://127.0.0.1:${port}/json`);
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) {
        return target;
      }
    } catch {
      // Chrome may still be starting.
    }
    await delay(150);
  }
  throw new Error(`Chrome DevTools target did not open on port ${port}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 0;
  const pending = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.onmessage = (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) {
        reject(new Error(payload.error.message || JSON.stringify(payload.error)));
      } else {
        resolve(payload.result || {});
      }
    }
  };

  return new Promise((resolve, reject) => {
    socket.onerror = () => reject(new Error("Chrome DevTools WebSocket failed"));
    socket.onopen = () => resolve({
      send(method, params = {}) {
        const id = ++nextId;
        socket.send(JSON.stringify({ id, method, params }));
        return withTimeout(new Promise((resolveCall, rejectCall) => {
          pending.set(id, { resolve: resolveCall, reject: rejectCall });
        }), 30000, method);
      },
      close() {
        socket.close();
      },
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed");
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await evaluate(cdp, expression);
    if (latest) {
      return latest;
    }
    await delay(200);
  }
  throw new Error(`${label} did not become true (last value: ${JSON.stringify(latest)})`);
}

async function captureScreenshot(cdp, filePath) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));
  return filePath;
}

function loginScript(embyUrl) {
  return `(() => {
    const serverUrl = document.getElementById("serverUrl");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const form = document.getElementById("connectForm");
    if (!serverUrl || !username || !password || !form) {
      return "missing-login-fields";
    }
    const setValue = (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue(serverUrl, ${JSON.stringify(embyUrl)});
    setValue(username, "demo");
    setValue(password, "demo");
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return "submitted";
  })()`;
}

async function switchView(cdp, view) {
  const clicked = await evaluate(cdp, `(() => {
    const candidates = [...document.querySelectorAll('[data-view=${JSON.stringify(view)}]')]
      .filter((node) => node.offsetParent !== null || node.getClientRects().length);
    const target = candidates[0] || document.querySelector('[data-view=${JSON.stringify(view)}]');
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) {
    return false;
  }
  await delay(500);
  await evaluate(cdp, `window.scrollTo(0, 0); document.querySelector(".view-panel:not([hidden])")?.scrollTo?.(0, 0); true`);
  await delay(250);
  return true;
}

async function startPlayback(cdp) {
  // Rows in the hidden panels still match `[data-track-id]`, so pick a laid-out
  // one. `.track-play-area` is the real click target (a role=button div, not a
  // <button>), and it is what app.js binds the play handler to.
  const started = await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('[data-track-id]')]
      .find((node) => node.getBoundingClientRect().width > 0);
    if (!row) return false;
    (row.querySelector('.track-play-area') || row).click();
    return true;
  })()`);
  if (!started) {
    return false;
  }
  // app.js plays through `new Audio()`, which never enters the DOM, so the
  // mini player title is the only observable "playback actually started".
  await waitFor(
    cdp,
    `document.getElementById("playerTitle")?.textContent.trim() === "等待选择音乐" ? false : document.getElementById("playerTitle")?.textContent.trim() || false`,
    "playback started",
    10000,
  );
  await delay(1200);
  return true;
}

async function run() {
  const chromePath = CHROME_PATHS.find((item) => fs.existsSync(item));
  if (!chromePath) {
    throw new Error("Chrome executable not found. Set CHROME_PATH.");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "emby-music-ui-capture-"));
  const args = [
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--hide-scrollbars",
    "about:blank",
  ];
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    args.splice(3, 0, "--no-sandbox");
  }

  const chrome = childProcess.spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  const output = [];
  chrome.stderr?.on("data", (chunk) => output.push(String(chunk)));

  const written = [];
  let cdp = null;

  try {
    const port = await readDevToolsPort(profileDir, output);
    const target = await waitForTarget(port);
    cdp = await createCdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    for (const viewport of VIEWPORTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.scale,
        mobile: viewport.mobile,
      });
      if (viewport.mobile) {
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      } else {
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }

      await cdp.send("Page.navigate", { url: `${APP_URL}?ui-capture=1` });
      await waitFor(cdp, "Boolean(window.EmbyMusicAppReady)", `[${viewport.name}] app ready`);
      await delay(300);

      written.push(await captureScreenshot(cdp, path.join(OUTPUT_DIR, `${viewport.name}-00-login.png`)));

      const loginResult = await evaluate(cdp, loginScript(EMBY_URL));
      if (loginResult !== "submitted") {
        throw new Error(`[${viewport.name}] login form not usable: ${loginResult}`);
      }

      await waitFor(cdp, `!document.getElementById("mainView")?.hidden`, `[${viewport.name}] main view visible`);
      await waitFor(cdp, "document.querySelectorAll('[data-track-id]').length > 0", `[${viewport.name}] library loaded`);
      await delay(600);

      let index = 1;
      for (const view of VIEWS) {
        const ok = await switchView(cdp, view);
        if (!ok) {
          console.warn(`[${viewport.name}] no control for view "${view}"`);
          continue;
        }
        const label = String(index).padStart(2, "0");
        written.push(await captureScreenshot(cdp, path.join(OUTPUT_DIR, `${viewport.name}-${label}-${view}.png`)));
        index += 1;
      }

      await switchView(cdp, "library");
      if (await startPlayback(cdp)) {
        written.push(await captureScreenshot(cdp, path.join(OUTPUT_DIR, `${viewport.name}-90-playing.png`)));
        await switchView(cdp, "nowPlaying");
        written.push(await captureScreenshot(cdp, path.join(OUTPUT_DIR, `${viewport.name}-91-now-playing.png`)));
      } else {
        console.warn(`[${viewport.name}] could not start playback`);
      }

      await evaluate(cdp, "localStorage.clear(); true");
    }
  } finally {
    try {
      await withTimeout(Promise.resolve(cdp?.send("Browser.close")), 4000, "Browser.close");
    } catch {
      // Chrome may already be exiting.
    }
    try {
      cdp?.close();
    } catch {
      // Ignore socket close errors.
    }
    await delay(300);
    try {
      if (chrome.pid) {
        process.platform === "win32"
          ? childProcess.spawnSync("taskkill", ["/pid", String(chrome.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true })
          : process.kill(chrome.pid, "SIGKILL");
      }
    } catch {
      // Chrome already exited.
    }
    await delay(200);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // Locked profiles are cleaned up on a later run.
    }
  }

  console.log(`ui-capture wrote ${written.length} screenshots to ${OUTPUT_DIR}`);
}

run().catch((error) => {
  console.error(`ui-capture failed: ${error.message}`);
  process.exit(1);
});
