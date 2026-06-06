#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const APP_URL = process.env.BROWSER_SMOKE_URL || "http://localhost:5173/";
const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"));
const EXPECTED_VERSION_LABEL = `v${PACKAGE_JSON.version}`;
const CHROME_TIMEOUT_MS = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 30000);
const PROFILE_CLEANUP_BUDGET_MS = Number(process.env.BROWSER_SMOKE_PROFILE_CLEANUP_BUDGET_MS || 2500);
const OLD_PROFILE_CLEANUP_LIMIT = Number(process.env.BROWSER_SMOKE_OLD_PROFILE_CLEANUP_LIMIT || 0);
const RUN_BROWSER_SMOKE = process.env.BROWSER_SMOKE_RUN === "1";
const SKIP_BROWSER_SMOKE = process.env.SKIP_BROWSER_SMOKE === "1" || !RUN_BROWSER_SMOKE;
const CHECK_MOBILE_VIEWPORT = process.env.BROWSER_SMOKE_DESKTOP_ONLY !== "1";
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const CHECKS = [
  { name: "desktop", width: 1366, height: 900 },
  ...(CHECK_MOBILE_VIEWPORT ? [{ name: "mobile", width: 390, height: 844 }] : []),
];

const errors = [];
let activeBrowserProfileDir = "";
let activeChromePid = 0;

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function findChrome() {
  return CHROME_PATHS.find((item) => fs.existsSync(item));
}

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

function requestStatus(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode || 0));
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

async function waitForTarget(port) {
  const deadline = Date.now() + Math.min(CHROME_TIMEOUT_MS, 15000);

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
  const events = [];
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
      return;
    }

    events.push(payload);
  };

  return new Promise((resolve, reject) => {
    socket.onerror = () => reject(new Error("Chrome DevTools WebSocket failed"));
    socket.onopen = () => {
      resolve({
        events,
        send(method, params = {}) {
          const id = ++nextId;
          socket.send(JSON.stringify({ id, method, params }));
          return withTimeout(new Promise((resolveCall, rejectCall) => {
            pending.set(id, { resolve: resolveCall, reject: rejectCall });
          }), 8000, method);
        },
        close() {
          socket.close();
        },
      });
    };
  });
}

function runDetachedCleanup(command, args) {
  try {
    const cleanup = childProcess.spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    cleanup.unref();
  } catch {
    // Best-effort cleanup.
  }
}

function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  runDetachedCleanup("taskkill.exe", ["/PID", String(pid), "/T", "/F"]);
}

function killChromeByProfile(profileDir) {
  if (!profileDir) {
    return;
  }

  const escapedProfile = profileDir.replace(/'/g, "''");
  runDetachedCleanup("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${escapedProfile}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
  ]);
}

async function removeDirectoryWithRetry(directory, options = {}) {
  const warnOnFailure = options.warnOnFailure !== false;
  const attempts = Number(options.attempts || 4);
  const deadlineAt = Number(options.deadlineAt || 0);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts - 1 || (deadlineAt && Date.now() >= deadlineAt)) {
        if (warnOnFailure) {
          console.warn(`browser-smoke cleanup warning: ${error.message}`);
        }
        return;
      }
      await delay(100);
    }
  }
}

async function cleanupOldProfiles() {
  if (OLD_PROFILE_CLEANUP_LIMIT <= 0) {
    return;
  }

  const tempDir = os.tmpdir();
  const deadlineAt = Date.now() + PROFILE_CLEANUP_BUDGET_MS;
  const entries = fs.readdirSync(tempDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("emby-music-browser-smoke-"))
    .map((entry) => {
      const fullPath = path.join(tempDir, entry.name);
      let mtimeMs = 0;

      try {
        mtimeMs = fs.statSync(fullPath).mtimeMs;
      } catch {
        // If the profile vanished between readdir and stat, treat it as old and harmless.
      }

      return { fullPath, mtimeMs };
    })
    .sort((left, right) => left.mtimeMs - right.mtimeMs)
    .slice(0, OLD_PROFILE_CLEANUP_LIMIT);

  for (const entry of entries) {
    if (Date.now() >= deadlineAt) {
      break;
    }

    await removeDirectoryWithRetry(entry.fullPath, {
      attempts: 1,
      deadlineAt,
      warnOnFailure: false,
    });
  }
}

function removeDirectoryInBackground(directory) {
  if (!directory) {
    return;
  }

  const cleanupScript = [
    "const fs = require('node:fs');",
    "const directory = process.argv[1];",
    "setTimeout(() => {",
    "  try { fs.rmSync(directory, { recursive: true, force: true }); } catch {}",
    "}, 250);",
  ].join("\n");

  try {
    const cleanup = childProcess.spawn(process.execPath, ["-e", cleanupScript, directory], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    cleanup.unref();
  } catch {
    // Locked Chrome profiles are safe to remove on a later run.
  }
}

async function findDebugPort() {
  for (let port = 9330; port < 9360; port += 1) {
    try {
      await requestJson(`http://127.0.0.1:${port}/json/version`, 300);
    } catch {
      return port;
    }
  }

  throw new Error("No available Chrome debugging port in 9330-9359");
}

async function createBrowser(chromePath) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "emby-music-browser-smoke-"));
  const port = await findDebugPort();
  const chrome = childProcess.spawn(chromePath, [
    `--remote-debugging-port=${port}`,
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
    "--window-size=1366,900",
    "about:blank",
  ], {
    detached: false,
    stdio: "ignore",
    windowsHide: true,
  });

  activeBrowserProfileDir = profileDir;
  activeChromePid = chrome.pid;
  return { chrome, port, profileDir };
}

async function closeBrowser(browser, cdp) {
  try {
    await withTimeout(Promise.resolve(cdp?.send("Browser.close")), 4000, "Browser.close");
  } catch {
    // Browser.close may fail if Chrome is already exiting.
  }
  try {
    cdp?.close();
  } catch {
    // Ignore close errors.
  }
  await delay(250);
  killProcessTree(browser?.chrome?.pid);
  await delay(150);
  killChromeByProfile(browser?.profileDir);
  await delay(150);
  removeDirectoryInBackground(browser?.profileDir);
  if (activeBrowserProfileDir === browser?.profileDir) {
    activeBrowserProfileDir = "";
    activeChromePid = 0;
  }
}

async function runBrowserCheck(cdp, check) {
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: check.width,
      height: check.height,
      deviceScaleFactor: check.name === "mobile" ? 2 : 1,
      mobile: check.name === "mobile",
    });
    await cdp.send("Page.navigate", {
      url: `${APP_URL}?browser-smoke=${encodeURIComponent(check.name)}-${Date.now()}`,
    });
    await delay(2500);

    const evaluation = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
        const exists = (selector) => Boolean(document.querySelector(selector));
        const isVisible = (selector) => {
          const element = document.querySelector(selector);
          if (!element) {
            return false;
          }
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const rect = (selector) => {
          const bounds = document.querySelector(selector)?.getBoundingClientRect();
          return bounds
            ? { width: Math.round(bounds.width), height: Math.round(bounds.height), top: Math.round(bounds.top), bottom: Math.round(bounds.bottom) }
            : null;
        };
        return {
          title: document.title,
          readyState: document.readyState,
          bodyClass: document.body.className,
          viewportWidth: window.innerWidth,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          loginHidden: document.querySelector("#loginView")?.hidden ?? null,
          mainHidden: document.querySelector("#mainView")?.hidden ?? null,
          activePanel: document.querySelector(".view-panel.active")?.dataset.panel || "",
          loginTitle: text("#loginTitle"),
          version: text("#loginVersion"),
          homeTitle: text("#homeStartTitle"),
          libraryStatus: text("#libraryStatus"),
          hasLoginView: exists("#loginView"),
          hasConnectForm: exists("#connectForm"),
          hasMainView: exists("#mainView"),
          loginViewVisible: isVisible("#loginView"),
          loginCardVisible: isVisible(".login-card"),
          connectFormVisible: isVisible("#connectForm"),
          loginCardRect: rect(".login-card"),
          hasHomeStart: exists("#homeStartTitle"),
          hasLibraryList: exists("#libraryTrackList"),
          hasImmersiveLyrics: exists("#immersiveLyricList"),
          hasPlayerBar: exists(".playerbar"),
          playerbarVisible: isVisible(".playerbar"),
          playerbarRect: rect(".playerbar"),
          mobileBottomNavVisible: isVisible(".mobile-bottom-nav"),
          mobileBottomNavRect: rect(".mobile-bottom-nav"),
          storageKeys: Object.keys(localStorage).filter((key) => key.startsWith("emby-music-web/")).sort(),
        };
      })()`,
    });

    const jsErrors = cdp.events
      .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
      .map((event) => event.params?.exceptionDetails?.text || event.params?.entry?.text || "")
      .filter(Boolean)
      .filter((message) => /ReferenceError|TypeError|SyntaxError|Unhandled promise rejection/i.test(message));

    return {
      ...evaluation.result.value,
      jsErrors,
    };
  } catch (error) {
    throw new Error(`[${check.name}] ${error.message}`);
  }
}

function checkPageState(check, page) {
  const label = `[${check.name}]`;
  assert(page.title === "Emby Music Web", `${label} expected title Emby Music Web, got ${page.title || "-"}`);
  assert(["interactive", "complete"].includes(page.readyState), `${label} document did not become interactive`);
  assert(page.hasLoginView, `${label} missing login view`);
  assert(page.hasConnectForm, `${label} missing login form`);
  assert(page.hasMainView, `${label} missing main view`);
  assert(page.documentWidth <= page.viewportWidth + 1, `${label} document overflows horizontally: ${page.documentWidth}px > ${page.viewportWidth}px`);
  if (!page.loginHidden) {
    assert(page.loginViewVisible, `${label} login view is not visible`);
    assert(page.loginCardVisible, `${label} login card is not visible`);
    assert(page.connectFormVisible, `${label} login form is not visible`);
    assert((page.loginCardRect?.width || 0) > 240, `${label} login card width is too small: ${page.loginCardRect?.width || 0}`);
  }
  if (page.loginHidden) {
    assert(page.hasHomeStart, `${label} missing home start controls`);
    assert(page.hasLibraryList, `${label} missing library track list`);
    assert(page.hasImmersiveLyrics, `${label} missing immersive lyric list`);
    assert(page.hasPlayerBar, `${label} missing player bar`);
    assert(page.playerbarVisible, `${label} player bar is not visible`);
    assert((page.playerbarRect?.height || 0) >= 48, `${label} player bar height is too small: ${page.playerbarRect?.height || 0}`);
    if (check.name === "mobile") {
      assert(page.mobileBottomNavVisible, `${label} mobile bottom navigation is not visible`);
      assert((page.mobileBottomNavRect?.height || 0) >= 44, `${label} mobile bottom navigation height is too small: ${page.mobileBottomNavRect?.height || 0}`);
    } else {
      assert(!page.mobileBottomNavVisible, `${label} mobile bottom navigation should not be visible on desktop`);
    }
  }
  assert(page.version === EXPECTED_VERSION_LABEL, `${label} version label mismatch: ${page.version || "-"}, expected ${EXPECTED_VERSION_LABEL}`);
  assert(!page.jsErrors.length, `${label} JavaScript errors: ${page.jsErrors.join("; ")}`);
}

async function main() {
  if (SKIP_BROWSER_SMOKE) {
    console.log("browser-smoke skipped (set BROWSER_SMOKE_RUN=1 to launch Chrome)");
    return;
  }

  const chromePath = findChrome();
  assert(chromePath, "Chrome executable was not found. Set CHROME_PATH to run browser smoke checks.");

  const status = await requestStatus(APP_URL);
  assert(status >= 200 && status < 300, `App URL returned HTTP ${status}: ${APP_URL}`);

  if (chromePath) {
    await cleanupOldProfiles();
    const browser = await createBrowser(chromePath);
    let cdp = null;
    try {
      const target = await waitForTarget(browser.port);
      cdp = await createCdpClient(target.webSocketDebuggerUrl);
      await cdp.send("Runtime.enable");
      await cdp.send("Page.enable");
      await cdp.send("Log.enable");

      for (const check of CHECKS) {
        const page = await withTimeout(runBrowserCheck(cdp, check), CHROME_TIMEOUT_MS, `browser smoke ${check.name}`);
        checkPageState(check, page);
      }
    } finally {
      await closeBrowser(browser, cdp);
    }
  }

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log(`browser-smoke ok (${CHECKS.map((check) => `${check.name} ${check.width}x${check.height}`).join(", ")})`);
}

const watchdog = setTimeout(() => {
  if (activeBrowserProfileDir) {
    killChromeByProfile(activeBrowserProfileDir);
  }
  if (activeChromePid) {
    killProcessTree(activeChromePid);
  }
  console.error(`browser-smoke timed out after ${CHROME_TIMEOUT_MS + 5000}ms`);
  process.exit(1);
}, CHROME_TIMEOUT_MS + 5000);

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    clearTimeout(watchdog);
  });
