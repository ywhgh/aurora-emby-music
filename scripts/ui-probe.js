#!/usr/bin/env node
"use strict";

/**
 * One-off DOM/layout probe against the mock server. Prints markup + computed
 * geometry for the elements named in PROBE so mobile layout bugs can be
 * measured instead of eyeballed. Not part of `npm run check`.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const APP_URL = process.env.UI_CAPTURE_URL || "http://localhost:5173/";
const EMBY_URL = process.env.UI_CAPTURE_EMBY_URL || "http://127.0.0.1:8096";
const WIDTH = Number(process.env.PROBE_WIDTH || 390);
const HEIGHT = Number(process.env.PROBE_HEIGHT || 844);
const VIEW = process.env.PROBE_VIEW || "library";
const EXPRESSION = process.env.PROBE_EXPRESSION || "";

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function requestJson(url) {
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
    request.setTimeout(2500, () => request.destroy(new Error("timeout")));
  });
}

function createCdpClient(url) {
  let nextId = 0;
  const pending = new Map();
  const socket = new WebSocket(url);
  socket.onmessage = (message) => {
    const payload = JSON.parse(message.data);
    const entry = pending.get(payload.id);
    if (!entry) return;
    pending.delete(payload.id);
    payload.error ? entry.reject(new Error(payload.error.message)) : entry.resolve(payload.result || {});
  };
  return new Promise((resolve, reject) => {
    socket.onerror = () => reject(new Error("cdp socket failed"));
    socket.onopen = () => resolve({
      send(method, params = {}) {
        const id = ++nextId;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolveCall, rejectCall) => pending.set(id, { resolve: resolveCall, reject: rejectCall }));
      },
      close: () => socket.close(),
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return true;
    await delay(200);
  }
  throw new Error(`${label} timed out`);
}

async function main() {
  const chromePath = CHROME_PATHS.find((item) => fs.existsSync(item));
  if (!chromePath) throw new Error("Chrome not found");
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "emby-music-probe-"));
  const chrome = childProcess.spawn(chromePath, [
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--hide-scrollbars",
    // Without this the <audio> element never starts, so `body.is-audio-playing`
    // is never set and playing-state styles cannot be measured.
    "--autoplay-policy=no-user-gesture-required",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });

  const output = [];
  chrome.stderr?.on("data", (chunk) => output.push(String(chunk)));

  let cdp = null;
  try {
    let port = 0;
    const deadline = Date.now() + 15000;
    while (!port && Date.now() < deadline) {
      try {
        port = Number(fs.readFileSync(path.join(profileDir, "DevToolsActivePort"), "utf8").trim().split(/\r?\n/)[0]) || 0;
      } catch {
        await delay(150);
      }
    }
    let target = null;
    while (!target && Date.now() < deadline + 10000) {
      try {
        target = (await requestJson(`http://127.0.0.1:${port}/json`)).find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      } catch {
        await delay(150);
      }
    }
    cdp = await createCdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: APP_URL });
    await waitFor(cdp, "Boolean(window.EmbyMusicAppReady)", "app ready");

    await evaluate(cdp, `(() => {
      const set = (id, value) => {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set("serverUrl", ${JSON.stringify(EMBY_URL)});
      set("username", "demo");
      set("password", "demo");
      document.getElementById("connectForm").requestSubmit();
      return true;
    })()`);
    await waitFor(cdp, "document.querySelectorAll('[data-track-id]').length > 0", "library loaded");
    await evaluate(cdp, `document.querySelector('[data-view=${JSON.stringify(VIEW)}]')?.click(); true`);
    await delay(700);

    const result = await evaluate(cdp, EXPRESSION || "'set PROBE_EXPRESSION'");
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  } finally {
    try {
      await cdp?.send("Browser.close");
    } catch {
      // Chrome may already be exiting.
    }
    try {
      cdp?.close();
    } catch {
      // Ignore.
    }
    await delay(250);
    try {
      childProcess.spawnSync("taskkill", ["/pid", String(chrome.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {
      // Already gone.
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 2 });
    } catch {
      // Locked profiles clean up later.
    }
  }
}

main().catch((error) => {
  console.error(`probe failed: ${error.message}`);
  process.exit(1);
});
