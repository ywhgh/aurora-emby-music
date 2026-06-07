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

async function readDevToolsPort(profileDir) {
  const activePortPath = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + Math.min(CHROME_TIMEOUT_MS, 15000);

  while (Date.now() < deadline) {
    try {
      const [portLine] = fs.readFileSync(activePortPath, "utf8").trim().split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    } catch {
      // Chrome writes DevToolsActivePort after the debugging endpoint is ready.
    }

    await delay(150);
  }

  throw new Error(`Chrome DevTools port file did not appear in ${profileDir}`);
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

function createLyricOffsetSmokeScript() {
  return `(() => {
    const key = "emby-music-web/lyric-offset-seconds";
    const getLabels = () => [...document.querySelectorAll("[data-lyric-offset-value]")]
      .map((element) => element.textContent.trim());
    const getResetDisabledStates = () => [...document.querySelectorAll("[data-lyric-offset-reset]")]
      .map((button) => Boolean(button.disabled));
    const click = (selector) => {
      const button = document.querySelector(selector);
      if (!button) {
        return false;
      }
      button.click();
      return true;
    };

    localStorage.removeItem(key);

    const hasEarlierButton = Boolean(document.querySelector('[data-lyric-offset-adjust="earlier"]'));
    const hasLaterButton = Boolean(document.querySelector('[data-lyric-offset-adjust="later"]'));
    const hasResetButton = Boolean(document.querySelector("[data-lyric-offset-reset]"));
    const hasValueLabels = document.querySelectorAll("[data-lyric-offset-value]").length >= 2;
    const initialLabels = getLabels();
    const initialResetDisabled = getResetDisabledStates();

    const clickedEarlier = click('[data-lyric-offset-adjust="earlier"]');
    const afterEarlierLabels = getLabels();
    const afterEarlierStorage = localStorage.getItem(key) || "";
    const afterEarlierResetDisabled = getResetDisabledStates();

    const clickedLaterOnce = click('[data-lyric-offset-adjust="later"]');
    const afterLaterOnceLabels = getLabels();
    const afterLaterOnceStorage = localStorage.getItem(key) || "";

    const clickedLaterTwice = click('[data-lyric-offset-adjust="later"]');
    const afterLaterTwiceLabels = getLabels();
    const afterLaterTwiceStorage = localStorage.getItem(key) || "";

    const clickedReset = click("[data-lyric-offset-reset]");
    const afterResetLabels = getLabels();
    const afterResetStorage = localStorage.getItem(key) || "";
    const afterResetDisabled = getResetDisabledStates();

    return {
      key,
      hasEarlierButton,
      hasLaterButton,
      hasResetButton,
      hasValueLabels,
      initialLabels,
      initialResetDisabled,
      clickedEarlier,
      afterEarlierLabels,
      afterEarlierStorage,
      afterEarlierResetDisabled,
      clickedLaterOnce,
      afterLaterOnceLabels,
      afterLaterOnceStorage,
      clickedLaterTwice,
      afterLaterTwiceLabels,
      afterLaterTwiceStorage,
      clickedReset,
      afterResetLabels,
      afterResetStorage,
      afterResetDisabled,
    };
  })()`;
}

function createLyricProgressSmokeScript() {
  return `(() => {
    const hooks = window.EmbyMusicBrowserSmoke;
    if (!hooks || typeof hooks.runLyricProgressScenario !== "function") {
      return { hasHook: false };
    }

    try {
      return {
        hasHook: true,
        ...hooks.runLyricProgressScenario(),
      };
    } catch (error) {
      return {
        hasHook: true,
        error: String(error?.stack || error?.message || error),
      };
    }
  })()`;
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

async function createBrowser(chromePath) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "emby-music-browser-smoke-"));
  const chrome = childProcess.spawn(chromePath, [
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
    "--window-size=1366,900",
    "about:blank",
  ], {
    detached: false,
    stdio: "ignore",
    windowsHide: true,
  });

  activeBrowserProfileDir = profileDir;
  activeChromePid = chrome.pid;
  const port = await readDevToolsPort(profileDir);
  return { chrome, port, profileDir };
}

async function waitForAppReady(cdp, check) {
  const deadline = Date.now() + CHROME_TIMEOUT_MS;
  let latest = null;

  while (Date.now() < deadline) {
    const evaluation = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => ({
        readyState: document.readyState,
        appReady: Boolean(window.EmbyMusicAppReady),
        appError: String(window.EmbyMusicAppError || ""),
      }))()`,
    });
    latest = evaluation.result.value || {};

    if (latest.appReady) {
      return latest;
    }

    if (latest.appError) {
      throw new Error(`[${check.name}] app initialization failed: ${latest.appError}`);
    }

    await delay(150);
  }

  throw new Error(`[${check.name}] app did not become ready: ${JSON.stringify(latest)}`);
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
    await waitForAppReady(cdp, check);
    await delay(250);

    const evaluation = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const lyricOffset = ${createLyricOffsetSmokeScript()};
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
        const pageState = {
          title: document.title,
          readyState: document.readyState,
          appReady: Boolean(window.EmbyMusicAppReady),
          appError: String(window.EmbyMusicAppError || ""),
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
          lyricOffset,
          storageKeys: Object.keys(localStorage).filter((key) => key.startsWith("emby-music-web/")).sort(),
        };

        return {
          ...pageState,
          lyricProgress: ${createLyricProgressSmokeScript()},
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
  const lyricOffset = page.lyricOffset || {};
  const lyricProgress = page.lyricProgress || {};
  const lyricProgressBeforeOffset = lyricProgress.beforeOffset || {};
  const lyricProgressAfterOffset = lyricProgress.afterOffset || {};
  const lyricProgressAfterResumeRefresh = lyricProgress.afterResumeRefresh || {};
  const lyricLongGapProgress = lyricProgress.longGapProgress || {};
  const enhancedMidWordProgress = lyricProgress.enhancedMidWordProgress || {};
  const enhancedLateWordProgress = lyricProgress.enhancedLateWordProgress || {};
  const relativeEnhancedProgress = lyricProgress.relativeEnhancedProgress || {};
  const denseWordPerformance = lyricProgress.denseWordPerformance || {};
  const endScrollLayout = lyricProgress.endScrollLayout || {};
  const topLyricShard = lyricProgress.topLyricShard || {};
  const labelsEqual = (labels, expected) => Array.isArray(labels) && labels.length >= 2 && labels.every((item) => item === expected);
  const resetStatesEqual = (states, expected) => Array.isArray(states) && states.length >= 2 && states.every((item) => item === expected);

  assert(page.title === "Emby Music Web", `${label} expected title Emby Music Web, got ${page.title || "-"}`);
  assert(["interactive", "complete"].includes(page.readyState), `${label} document did not become interactive`);
  assert(page.appReady, `${label} main app did not report ready`);
  assert(!page.appError, `${label} main app reported initialization error: ${page.appError || "-"}`);
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
  assert(lyricOffset.hasEarlierButton, `${label} missing lyric offset earlier button`);
  assert(lyricOffset.hasLaterButton, `${label} missing lyric offset later button`);
  assert(lyricOffset.hasResetButton, `${label} missing lyric offset reset button`);
  assert(lyricOffset.hasValueLabels, `${label} missing mirrored lyric offset value labels`);
  assert(labelsEqual(lyricOffset.initialLabels, "+0.18s"), `${label} initial lyric offset labels were ${JSON.stringify(lyricOffset.initialLabels)}`);
  assert(resetStatesEqual(lyricOffset.initialResetDisabled, true), `${label} lyric offset reset should start disabled`);
  assert(lyricOffset.clickedEarlier, `${label} lyric offset earlier button did not click`);
  assert(labelsEqual(lyricOffset.afterEarlierLabels, "+0.28s"), `${label} earlier click did not advance labels: ${JSON.stringify(lyricOffset.afterEarlierLabels)}`);
  assert(lyricOffset.afterEarlierStorage === "0.28", `${label} earlier click did not persist 0.28, got ${lyricOffset.afterEarlierStorage || "-"}`);
  assert(resetStatesEqual(lyricOffset.afterEarlierResetDisabled, false), `${label} lyric offset reset should enable after adjustment`);
  assert(lyricOffset.clickedLaterOnce, `${label} lyric offset later button did not click once`);
  assert(labelsEqual(lyricOffset.afterLaterOnceLabels, "+0.18s"), `${label} first later click did not return to default labels: ${JSON.stringify(lyricOffset.afterLaterOnceLabels)}`);
  assert(lyricOffset.afterLaterOnceStorage === "0.18", `${label} first later click did not persist 0.18, got ${lyricOffset.afterLaterOnceStorage || "-"}`);
  assert(lyricOffset.clickedLaterTwice, `${label} lyric offset later button did not click twice`);
  assert(labelsEqual(lyricOffset.afterLaterTwiceLabels, "+0.08s"), `${label} second later click did not delay labels: ${JSON.stringify(lyricOffset.afterLaterTwiceLabels)}`);
  assert(lyricOffset.afterLaterTwiceStorage === "0.08", `${label} second later click did not persist 0.08, got ${lyricOffset.afterLaterTwiceStorage || "-"}`);
  assert(lyricOffset.clickedReset, `${label} lyric offset reset button did not click`);
  assert(labelsEqual(lyricOffset.afterResetLabels, "+0.18s"), `${label} reset click did not restore labels: ${JSON.stringify(lyricOffset.afterResetLabels)}`);
  assert(lyricOffset.afterResetStorage === "0.18", `${label} reset click did not persist 0.18, got ${lyricOffset.afterResetStorage || "-"}`);
  assert(resetStatesEqual(lyricOffset.afterResetDisabled, true), `${label} lyric offset reset should disable after reset`);
  assert(lyricProgress.hasHook, `${label} missing browser-smoke lyric progress hook`);
  assert(!lyricProgress.error, `${label} lyric progress smoke failed: ${lyricProgress.error || "-"}`);
  assert(lyricProgress.activeView === "immersivePlayer", `${label} lyric progress smoke did not open immersive player`);
  assert(lyricProgress.loginHidden === true && lyricProgress.mainHidden === false, `${label} lyric progress smoke did not show the main app`);
  assert(lyricProgressBeforeOffset.isSynced, `${label} synthetic lyrics should be synced`);
  assert(lyricProgressBeforeOffset.lyricCount === 3, `${label} synthetic lyrics should render 3 lines, got ${lyricProgressBeforeOffset.lyricCount || 0}`);
  assert(lyricProgressBeforeOffset.activeIndex === 1, `${label} lyric progress before offset should focus line 1, got ${lyricProgressBeforeOffset.activeIndex}`);
  assert(lyricProgressBeforeOffset.wordCount === 3, `${label} lyric progress before offset should split 3 words, got ${lyricProgressBeforeOffset.wordCount || 0}`);
  assert(lyricProgressBeforeOffset.wordProgress?.[0] === 100, `${label} first word should be fully highlighted before offset`);
  assert(lyricProgressBeforeOffset.wordProgress?.[1] > 0 && lyricProgressBeforeOffset.wordProgress?.[1] < 100, `${label} second word should be partially highlighted before offset: ${JSON.stringify(lyricProgressBeforeOffset.wordProgress)}`);
  assert(lyricProgressBeforeOffset.wordProgress?.[2] === 0, `${label} third word should not be highlighted before offset: ${JSON.stringify(lyricProgressBeforeOffset.wordProgress)}`);
  assert(parseFloat(lyricProgressBeforeOffset.cssWordProgress?.[1]) > 0 && parseFloat(lyricProgressBeforeOffset.cssWordProgress?.[1]) < 100, `${label} partial word should expose clipped text progress before offset`);
  assert(/Delta epsilon zeta/.test(lyricProgressBeforeOffset.activeLineText || ""), `${label} active lyric line text mismatch before offset: ${lyricProgressBeforeOffset.activeLineText || "-"}`);
  assert(lyricProgressBeforeOffset.activeLineClass?.includes("active"), `${label} active lyric line should have active class before offset`);
  assert(lyricProgressAfterOffset.offsetLabel === "+0.68s", `${label} lyric offset smoke should adjust to +0.68s, got ${lyricProgressAfterOffset.offsetLabel || "-"}`);
  assert(lyricProgressAfterOffset.activeIndex === 1, `${label} lyric progress after offset should stay on line 1, got ${lyricProgressAfterOffset.activeIndex}`);
  assert(lyricProgressAfterOffset.wordProgress?.[1] > lyricProgressBeforeOffset.wordProgress?.[1], `${label} lyric offset should advance partial word progress: before ${JSON.stringify(lyricProgressBeforeOffset.wordProgress)}, after ${JSON.stringify(lyricProgressAfterOffset.wordProgress)}`);
  assert(lyricProgressAfterOffset.wordProgress?.[2] === 0, `${label} lyric offset smoke should not skip to the next word window: ${JSON.stringify(lyricProgressAfterOffset.wordProgress)}`);
  assert(lyricProgressAfterOffset.scrollAllowedForced === true, `${label} forced lyric scroll should remain available`);
  assert(lyricProgressAfterResumeRefresh.activeIndex === 1, `${label} lyric resume refresh should restore the active lyric immediately, got ${lyricProgressAfterResumeRefresh.activeIndex}`);
  assert(lyricProgressAfterResumeRefresh.wordProgress?.[1] > 0, `${label} lyric resume refresh should immediately light the partial word: ${JSON.stringify(lyricProgressAfterResumeRefresh.wordProgress)}`);
  assert(lyricLongGapProgress.activeIndex === 0, `${label} long-gap lyric should still focus the first line, got ${lyricLongGapProgress.activeIndex}`);
  assert(lyricLongGapProgress.wordProgress?.every((progress) => progress === 100), `${label} long-gap lyric words should finish within the capped line duration: ${JSON.stringify(lyricLongGapProgress.wordProgress)}`);
  assert(lyricProgress.longGapIdleResumeDelayMs > 10000, `${label} long-gap lyric should idle the RAF until near the next line, got ${lyricProgress.longGapIdleResumeDelayMs || 0}ms`);
  assert(enhancedMidWordProgress.wordProgress?.[0] === 100, `${label} enhanced lyric first word should complete at the second word timestamp: ${JSON.stringify(enhancedMidWordProgress.wordProgress)}`);
  assert(enhancedMidWordProgress.wordProgress?.[1] === 0, `${label} enhanced lyric second word should start from its own timestamp: ${JSON.stringify(enhancedMidWordProgress.wordProgress)}`);
  assert(enhancedLateWordProgress.wordProgress?.[0] === 100 && enhancedLateWordProgress.wordProgress?.[1] === 100, `${label} enhanced lyric first two words should complete by 1.45s: ${JSON.stringify(enhancedLateWordProgress.wordProgress)}`);
  assert(enhancedLateWordProgress.wordProgress?.[2] > 0 && enhancedLateWordProgress.wordProgress?.[2] < 100, `${label} enhanced lyric third word should be partially highlighted from inline timing: ${JSON.stringify(enhancedLateWordProgress.wordProgress)}`);
  assert(relativeEnhancedProgress.activeIndex === 0, `${label} relative enhanced lyric should focus the late line, got ${relativeEnhancedProgress.activeIndex}`);
  assert(relativeEnhancedProgress.wordProgress?.[0] === 100, `${label} relative enhanced lyric first word should complete at 80.75s: ${JSON.stringify(relativeEnhancedProgress.wordProgress)}`);
  assert(relativeEnhancedProgress.wordProgress?.[1] > 0 && relativeEnhancedProgress.wordProgress?.[1] < 100, `${label} relative enhanced lyric second word should be partially highlighted at 80.75s: ${JSON.stringify(relativeEnhancedProgress.wordProgress)}`);
  assert(relativeEnhancedProgress.wordProgress?.[2] === 0, `${label} relative enhanced lyric third word should wait for its own line-relative timestamp: ${JSON.stringify(relativeEnhancedProgress.wordProgress)}`);
  assert(denseWordPerformance.wordCount === 72, `${label} dense lyric scenario should render 72 timed words, got ${denseWordPerformance.wordCount || 0}`);
  assert(denseWordPerformance.sampleCount === 180, `${label} dense lyric scenario should run 180 progress samples, got ${denseWordPerformance.sampleCount || 0}`);
  assert(denseWordPerformance.progressWriteCount > 60 && denseWordPerformance.progressWriteCount < 260, `${label} dense lyric progress should only write changed clip progress values: ${JSON.stringify(denseWordPerformance)}`);
  assert(denseWordPerformance.averageUpdateMs < 4, `${label} dense lyric progress average update is too slow: ${JSON.stringify(denseWordPerformance)}`);
  assert(denseWordPerformance.partialWordCount <= 1, `${label} dense lyric progress should keep at most one partial word: ${JSON.stringify(denseWordPerformance)}`);
  assert(denseWordPerformance.maxRatio === 1, `${label} dense lyric in-memory progress should reach fully lit words: ${JSON.stringify(denseWordPerformance)}`);
  assert(endScrollLayout.lyricCount === 46, `${label} end-scroll lyric scenario should render 46 lines, got ${endScrollLayout.lyricCount || 0}`);
  assert(endScrollLayout.activeIndex >= 43, `${label} end-scroll lyric should focus a near-ending line, got ${endScrollLayout.activeIndex}`);
  assert(endScrollLayout.lyricListScrollTop > 0, `${label} immersive lyric list should scroll internally near the end: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.lyricListMaxScrollTop >= endScrollLayout.lyricListScrollTop, `${label} immersive lyric list scrollTop should be clamped: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.windowScrollY === 0 && endScrollLayout.documentScrollTop === 0, `${label} immersive lyric scrolling should not move the document: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.contentScrollTop === 0, `${label} immersive lyric scrolling should not move the app content: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.shellPinned === true, `${label} immersive player should remain pinned to the viewport: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.shellBottomGapPx <= 1, `${label} immersive player should not reveal a bottom gap: ${JSON.stringify(endScrollLayout)}`);
  assert(endScrollLayout.activeLineInsideList === true, `${label} active ending lyric should remain inside the lyric list viewport: ${JSON.stringify(endScrollLayout)}`);
  assert(topLyricShard.text === "满世界嘻嘻哈哈", `${label} top lyric shard text mismatch: ${JSON.stringify(topLyricShard)}`);
  assert(topLyricShard.charCount === 7, `${label} top lyric shard should split 7 characters: ${JSON.stringify(topLyricShard)}`);
  assert(topLyricShard.timingCount === 7, `${label} top lyric shard should map character timings: ${JSON.stringify(topLyricShard)}`);
  assert(topLyricShard.firstSpanClass?.includes("is-sharded"), `${label} top lyric shard trigger should hide the activated character: ${JSON.stringify(topLyricShard)}`);
  if (check.name !== "mobile") {
    assert(topLyricShard.canvasCountAfterTrigger >= 1, `${label} top lyric shard trigger should create a canvas: ${JSON.stringify(topLyricShard)}`);
  }
  assert(topLyricShard.canvasCountAfterCleanup === 0, `${label} top lyric shard cleanup should remove canvases: ${JSON.stringify(topLyricShard)}`);
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
