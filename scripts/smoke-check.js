const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function extract(pattern, text, label) {
  const match = text.match(pattern);
  assert(match, `Missing ${label}`);
  return match?.[1] || "";
}

function getCssRule(css, selectorStart) {
  const start = css.indexOf(selectorStart);

  if (start < 0) {
    return "";
  }

  const end = css.indexOf("\n}", start);
  return end >= 0 ? css.slice(start, end + 2) : css.slice(start);
}

function createMemoryLocalStorage() {
  const map = new Map();

  return {
    getItem(key) {
      const normalizedKey = String(key);
      return map.has(normalizedKey) ? map.get(normalizedKey) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    hasItem(key) {
      return map.has(String(key));
    },
  };
}

function checkVersions() {
  const index = read("index.html");
  const config = read("src/config.js");
  const sw = read("sw.js");
  const packageJson = JSON.parse(read("package.json"));
  const appVersion = extract(/APP_VERSION:\s*"([^"]+)"/, config, "APP_VERSION");
  const cacheVersion = extract(/CACHE_NAME\s*=\s*"emby-music-web-v([^"]+)"/, sw, "service worker cache version");
  const assetVersion = extract(/ASSET_VERSION\s*=\s*"([^"]+)"/, sw, "service worker asset version");
  const browserSmoke = read("scripts/browser-smoke.js");

  assert(appVersion === cacheVersion, `APP_VERSION ${appVersion} != CACHE_NAME ${cacheVersion}`);
  assert(appVersion === assetVersion, `APP_VERSION ${appVersion} != ASSET_VERSION ${assetVersion}`);
  assert(appVersion === packageJson.version, `APP_VERSION ${appVersion} != package.json ${packageJson.version}`);
  assert(config.includes('DEFAULT_EXTERNAL_SOURCE_API_URL: "http://127.0.0.1:5174"'), "Default source bridge URL should point to the built-in local bridge");
  assert(packageJson.scripts?.["smoke:browser"] === "node ./scripts/browser-smoke.js", "package.json should expose browser smoke checks");
  assert(packageJson.scripts?.check?.includes("npm run smoke:browser"), "npm run check should include browser smoke checks");
  assert(browserSmoke.includes('process.env.BROWSER_SMOKE_DESKTOP_ONLY !== "1"'), "Browser smoke should run mobile viewport by default with a desktop-only escape hatch");
  assert(browserSmoke.includes('{ name: "mobile", width: 390, height: 844 }'), "Browser smoke should include a mobile viewport check");
  assert(browserSmoke.includes('playerbarVisible: isVisible(".playerbar")'), "Browser smoke should verify playerbar visibility");
  assert(browserSmoke.includes('mobileBottomNavVisible: isVisible(".mobile-bottom-nav")'), "Browser smoke should verify mobile bottom navigation visibility");
  assert(browserSmoke.includes('check.name === "mobile"'), "Browser smoke should apply viewport-specific assertions");
  assert(browserSmoke.includes("documentWidth <= page.viewportWidth + 1"), "Browser smoke should detect horizontal document overflow");
  assert(browserSmoke.includes('loginCardVisible: isVisible(".login-card")'), "Browser smoke should verify login card visibility");
  assert(browserSmoke.includes('connectFormVisible: isVisible("#connectForm")'), "Browser smoke should verify login form visibility");
  assert(browserSmoke.includes("async function waitForAppReady"), "Browser smoke should wait for the main app to finish initialization");
  assert(browserSmoke.includes("window.EmbyMusicAppReady"), "Browser smoke should inspect the app ready marker before exercising controls");
  assert(browserSmoke.includes("window.EmbyMusicAppError"), "Browser smoke should surface app initialization errors");
  assert(browserSmoke.includes("main app did not report ready"), "Browser smoke should assert the app ready marker");
  assert(browserSmoke.includes("function createLyricOffsetSmokeScript"), "Browser smoke should exercise lyric offset controls in real Chrome");
  assert(browserSmoke.includes('localStorage.removeItem(key)'), "Browser smoke should reset lyric offset storage before checking controls");
  assert(browserSmoke.includes('click(\'[data-lyric-offset-adjust="earlier"]\')'), "Browser smoke should click the lyric offset earlier button");
  assert(browserSmoke.includes('click(\'[data-lyric-offset-adjust="later"]\')'), "Browser smoke should click the lyric offset later button");
  assert(browserSmoke.includes('click("[data-lyric-offset-reset]")'), "Browser smoke should click the lyric offset reset button");
  assert(browserSmoke.includes('afterEarlierStorage === "0.28"'), "Browser smoke should verify lyric offset earlier persistence");
  assert(browserSmoke.includes('afterLaterTwiceStorage === "0.08"'), "Browser smoke should verify lyric offset later persistence");
  assert(browserSmoke.includes('afterResetStorage === "0.18"'), "Browser smoke should verify lyric offset reset persistence");
  assert(browserSmoke.includes("EXPECTED_VERSION_LABEL"), "Browser smoke should derive the expected version label from package.json");
  assert(browserSmoke.includes("PROFILE_CLEANUP_BUDGET_MS"), "Browser smoke profile cleanup should have a bounded time budget");
  assert(browserSmoke.includes("OLD_PROFILE_CLEANUP_LIMIT"), "Browser smoke should limit old profile cleanup work per run");
  assert(browserSmoke.includes("BROWSER_SMOKE_OLD_PROFILE_CLEANUP_LIMIT || 0"), "Browser smoke should skip old profile cleanup by default on Windows");
  assert(browserSmoke.includes("if (OLD_PROFILE_CLEANUP_LIMIT <= 0)"), "Browser smoke should make old profile cleanup opt-in");
  assert(browserSmoke.includes('"--remote-debugging-port=0"'), "Browser smoke should let Chrome choose an unused debugging port");
  assert(browserSmoke.includes("DevToolsActivePort"), "Browser smoke should read the selected debugging port from the Chrome profile");
  assert(!browserSmoke.includes("async function findDebugPort"), "Browser smoke should not scan fixed debugging ports");
  assert(browserSmoke.includes('withTimeout(Promise.resolve(cdp?.send("Browser.close"))'), "Browser smoke should bound Browser.close during cleanup");
  assert(browserSmoke.includes("function runDetachedCleanup"), "Browser smoke process cleanup should run in detached helpers");
  assert(!browserSmoke.includes("spawnSync"), "Browser smoke should not use synchronous process cleanup on Windows");
  assert(browserSmoke.includes("function removeDirectoryInBackground"), "Browser smoke should clean current Chrome profiles in a detached helper");
  assert(browserSmoke.includes("cleanup.unref()"), "Browser smoke detached profile cleanup should not keep the test process alive");
  assert(browserSmoke.includes("removeDirectoryInBackground(browser?.profileDir)"), "Browser smoke should not synchronously remove the current Chrome profile");
  assert(browserSmoke.includes("Locked Chrome profiles are safe to remove on a later run"), "Browser smoke should not block on locked profile deletion");
  assert(!browserSmoke.includes(`page.version === "v${appVersion}"`), "Browser smoke should not hard-code the current version label");

  [
    "styles.css",
    "src/config.js",
    "src/format.js",
    "src/lyrics.js",
    "src/emby-api.js",
    "src/storage.js",
    "app.js",
    "manifest.webmanifest",
    "icon.svg",
  ].forEach((asset) => {
    assert(index.includes(`${asset}?v=${appVersion}`), `index.html is not using v=${appVersion} for ${asset}`);
  });

  assert(index.includes(`v${appVersion}`), "login version label is not synced");
  assert(index.includes(`const version = "${appVersion}"`), "fallback script version is not synced");
}

function checkCss() {
  const css = read("styles.css");
  let balance = 0;
  let line = 1;

  for (const char of css) {
    if (char === "\n") {
      line += 1;
    } else if (char === "{") {
      balance += 1;
    } else if (char === "}") {
      balance -= 1;
      assert(balance >= 0, `CSS brace balance went negative near line ${line}`);
    }
  }

  assert(balance === 0, `CSS brace balance is ${balance}`);
  [
    ".lyric-original",
    ".lyric-translated",
    ".now-lyric-original",
    ".now-lyric-translated",
    ".immersive-lyric-original",
    ".immersive-lyric-translated",
  ].forEach((selector) => {
    assert(css.includes(selector), `Missing CSS selector ${selector}`);
  });

  const lyricBaseRule = getCssRule(css, ".lyric-line {");
  const lyricHoverRule = getCssRule(css, ".lyric-line:hover,");
  const lyricActiveRule = getCssRule(css, ".lyric-line.active {");
  const immersiveLyricBaseRule = getCssRule(css, ".immersive-lyric-list .lyric-line,\n.immersive-lyric-list p {");
  const immersiveLyricActiveRule = getCssRule(css, ".immersive-lyric-list .lyric-line.active,");

  assert(/width:\s*100%;/.test(lyricBaseRule), "Lyric rows should span the full row width");
  assert(/background:\s*transparent;/.test(lyricBaseRule), "Inactive lyric rows should stay background-transparent");
  assert(/border-radius:\s*0;/.test(lyricBaseRule), "Lyric rows should not use rounded rectangle backgrounds");
  assert(
    /background\s+0\.35s cubic-bezier\(0\.25, 1, 0\.5, 1\),\s*opacity\s+0\.35s ease;/.test(lyricBaseRule),
    "Lyric row fog transitions should use the shared smooth easing"
  );
  assert(css.includes(".lyric-line:hover,\n.lyric-line:focus-visible"), "Lyric hover fog should apply to every lyric row");
  assert(!css.includes(".lyric-line[role=\"button\"]:hover,\n.lyric-line[role=\"button\"]:focus-visible"), "Lyric hover fog should not be limited to seekable rows");
  assert(/rgba\(255, 255, 255, 0\.03\) 25%/.test(lyricHoverRule), "Inactive lyric hover fog should stay subtle and feathered");
  assert(/rgba\(255, 255, 255, 0\.08\) 20%/.test(lyricActiveRule), "Active lyric fog should use a brighter feathered center");
  assert(/-webkit-backdrop-filter:\s*blur\(12px\);/.test(lyricActiveRule), "Active lyric fog should include webkit backdrop blur");
  assert(/backdrop-filter:\s*blur\(12px\);/.test(lyricActiveRule), "Active lyric fog should include backdrop blur");
  assert(/width:\s*100%;/.test(immersiveLyricBaseRule), "Immersive lyric rows should span the full row width");
  assert(/background:\s*transparent;/.test(immersiveLyricBaseRule), "Inactive immersive lyric rows should stay background-transparent");
  assert(/border-radius:\s*0;/.test(immersiveLyricBaseRule), "Immersive lyric rows should not use rounded rectangle backgrounds");
  assert(/width:\s*100%;/.test(immersiveLyricActiveRule), "Active immersive lyric fog should span the full row width");
  assert(/box-shadow:\s*none;/.test(immersiveLyricActiveRule), "Active immersive lyric fog should not add a framed shadow");
  assert(css.includes("body.topbar-lyric-active .top-tabs .tab"), "Playing topbar should be able to hide menu tabs behind lyrics");
  assert(css.includes("body.topbar-lyric-active .top-tabs:hover .tab"), "Hovering the topbar lyrics should restore the menu tabs");
  assert(css.includes(".top-lyric-current"), "Topbar lyric text should have a dedicated translated/current line style");
  assert(css.includes(".top-lyric-focus[hidden]"), "Hidden topbar lyrics should not leave an invisible overlay");
  assert(css.includes(".top-lyric-char"), "Topbar lyric shard effect should split lyric text into character spans");
  assert(/\.top-lyric-char\s*\{[\s\S]*?opacity:\s*0\.6;/.test(css), "Topbar lyric characters should start in the unplayed opacity state");
  assert(css.includes(".top-lyric-char.is-sharded"), "Topbar lyric shard effect should hide triggered characters");
  assert(css.includes(".top-lyric-shard-canvas"), "Topbar lyric shard effect should render temporary canvases");
  assert(/\.lyric-line \.lyric-original \{[\s\S]*?font-size:\s*0\.8rem;/.test(css), "Bilingual lyric original text should be smaller than the translated text");
  assert(/\.lyric-line \.lyric-translated \{[\s\S]*?font-size:\s*1rem;/.test(css), "Bilingual lyric translated text should be larger than the original text");
}

function checkLyrics() {
  const lyricsCode = read("src/lyrics.js");
  const index = read("index.html");
  const css = read("styles.css");
  const context = { window: {} };
  vm.runInNewContext(lyricsCode, context, { filename: "src/lyrics.js" });
  const parseLyrics = context.window.EmbyMusicLyrics?.parseLyrics;
  assert(typeof parseLyrics === "function", "parseLyrics is not exposed");

  [
    ["english", "[00:01.00]Hello world\n[00:01.00]你好世界", "Hello world", "你好世界"],
    ["japanese", "[00:02.00]君の名は\n[00:02.00]你的名字", "君の名は", "你的名字"],
    ["korean", "[00:03.00]사랑해\n[00:03.00]我爱你", "사랑해", "我爱你"],
    ["inline slash", "[00:04.00]Hello world // 你好世界", "Hello world", "你好世界"],
    ["inline single slash", "[00:05.00]君の名は / 你的名字", "君の名は", "你的名字"],
  ].forEach(([name, input, originalText, text]) => {
    const line = parseLyrics(input).lines[0];
    assert(line?.originalText === originalText, `${name} originalText expected ${originalText}, got ${line?.originalText}`);
    assert(line?.text === text, `${name} text expected ${text}, got ${line?.text}`);
  });

  const enhancedLine = parseLyrics("[00:00.00]<00:00.00>Alpha <00:00.60>beta <00:01.20>gamma").lines[0];
  assert(enhancedLine?.text === "Alpha beta gamma", `Enhanced LRC text expected Alpha beta gamma, got ${enhancedLine?.text}`);
  assert(Array.isArray(enhancedLine?.wordTimeline), "Enhanced LRC should expose wordTimeline");
  assert(enhancedLine.wordTimeline.length === 3, `Enhanced LRC should expose 3 timed words, got ${enhancedLine.wordTimeline?.length || 0}`);
  assert(enhancedLine.wordTimeline[1]?.time === 0.6, `Enhanced LRC second word time expected 0.6, got ${enhancedLine.wordTimeline[1]?.time}`);
  const relativeEnhancedLine = parseLyrics("[01:20.00]<0.00>后<0.50>半<1.00>段").lines[0];
  assert(relativeEnhancedLine.wordTimeline?.[0]?.time === 80, `Line-relative enhanced LRC first word time expected 80, got ${relativeEnhancedLine.wordTimeline?.[0]?.time}`);
  assert(relativeEnhancedLine.wordTimeline?.[2]?.time === 81, `Line-relative enhanced LRC third word time expected 81, got ${relativeEnhancedLine.wordTimeline?.[2]?.time}`);
  const absoluteEnhancedLine = parseLyrics("[01:20.00]<01:20.00>后<01:20.50>半<01:21.00>段").lines[0];
  assert(absoluteEnhancedLine.wordTimeline?.[0]?.time === 80, `Absolute enhanced LRC first word time expected 80, got ${absoluteEnhancedLine.wordTimeline?.[0]?.time}`);
  assert(absoluteEnhancedLine.wordTimeline?.[2]?.time === 81, `Absolute enhanced LRC third word time expected 81, got ${absoluteEnhancedLine.wordTimeline?.[2]?.time}`);
  const enhancedSecondOnlyLine = parseLyrics("[00:00.00]<0.00>你<0.30>好").lines[0];
  assert(enhancedSecondOnlyLine?.text === "你好", `Second-only enhanced LRC text expected 你好, got ${enhancedSecondOnlyLine?.text}`);
  assert(enhancedSecondOnlyLine.wordTimeline?.[1]?.time === 0.3, `Second-only enhanced LRC second word time expected 0.3, got ${enhancedSecondOnlyLine.wordTimeline?.[1]?.time}`);
  const yrcLine = parseLyrics("[1000,1800](0,500,0)你(500,500,0)好(1000,800,0)啊").lines[0];
  assert(yrcLine?.text === "你好啊", `YRC text expected 你好啊, got ${yrcLine?.text}`);
  assert(yrcLine.wordTimeline?.length === 3, `YRC should expose 3 timed words, got ${yrcLine.wordTimeline?.length || 0}`);
  assert(yrcLine.wordTimeline?.[0]?.time === 1, `YRC first word time expected 1, got ${yrcLine.wordTimeline?.[0]?.time}`);
  assert(yrcLine.wordTimeline?.[0]?.endTime === 1.5, `YRC first word endTime expected 1.5, got ${yrcLine.wordTimeline?.[0]?.endTime}`);
  assert(yrcLine.wordTimeline?.[2]?.time === 2, `YRC third word time expected 2, got ${yrcLine.wordTimeline?.[2]?.time}`);
  const ttmlLine = parseLyrics('<tt><body><div><p begin="00:00:01.000" end="00:00:03.000"><span begin="00:00:01.000" end="00:00:01.500">你</span><span begin="00:00:01.500" end="00:00:02.000">好</span></p></div></body></tt>').lines[0];
  assert(ttmlLine?.text === "你好", `TTML text expected 你好, got ${ttmlLine?.text}`);
  assert(ttmlLine.wordTimeline?.length === 2, `TTML should expose 2 timed words, got ${ttmlLine.wordTimeline?.length || 0}`);
  assert(ttmlLine.wordTimeline?.[1]?.time === 1.5, `TTML second word time expected 1.5, got ${ttmlLine.wordTimeline?.[1]?.time}`);
  assert(ttmlLine.wordTimeline?.[1]?.endTime === 2, `TTML second word endTime expected 2, got ${ttmlLine.wordTimeline?.[1]?.endTime}`);
  const offsetLine = parseLyrics("[offset:500]\n[00:01.00]Offset lyric").lines[0];
  assert(offsetLine?.time === 0.5, `LRC positive offset should shift line time earlier to 0.5, got ${offsetLine?.time}`);
  const lateOffsetLine = parseLyrics("[00:01.00]Offset lyric\n[offset:+500]").lines[0];
  assert(lateOffsetLine?.time === 0.5, `LRC offset should apply globally even when declared later, got ${lateOffsetLine?.time}`);
  const offsetEnhancedLine = parseLyrics("[offset:-200]\n[00:01.00]<1.00>你<1.30>好").lines[0];
  assert(offsetEnhancedLine?.time === 1.2, `LRC negative offset should shift line time later to 1.2, got ${offsetEnhancedLine?.time}`);
  assert(offsetEnhancedLine.wordTimeline?.[1]?.time === 1.5, `LRC offset should shift enhanced word time to 1.5, got ${offsetEnhancedLine.wordTimeline?.[1]?.time}`);
  const bilingualEnhancedLine = parseLyrics("[00:00.00]<0.00>Hello <0.60>world\n[00:00.00]<0.00>你<0.60>好").lines[0];
  assert(bilingualEnhancedLine?.originalText === "Hello world", `Bilingual enhanced originalText expected Hello world, got ${bilingualEnhancedLine?.originalText}`);
  assert(bilingualEnhancedLine?.text === "你好", `Bilingual enhanced translated text expected 你好, got ${bilingualEnhancedLine?.text}`);
  assert(bilingualEnhancedLine.wordTimeline?.length === 2, `Bilingual enhanced original should expose 2 timed words, got ${bilingualEnhancedLine.wordTimeline?.length || 0}`);
  assert(bilingualEnhancedLine.translatedWordTimeline?.length === 2, `Bilingual enhanced translation should expose 2 timed words, got ${bilingualEnhancedLine.translatedWordTimeline?.length || 0}`);
  assert(bilingualEnhancedLine.wordTimeline?.[1]?.time === 0.6, `Bilingual enhanced original second word time expected 0.6, got ${bilingualEnhancedLine.wordTimeline?.[1]?.time}`);
  assert(bilingualEnhancedLine.translatedWordTimeline?.[1]?.time === 0.6, `Bilingual enhanced translated second word time expected 0.6, got ${bilingualEnhancedLine.translatedWordTimeline?.[1]?.time}`);
  const bilingualOffsetLine = parseLyrics("[offset:-200]\n[00:01.00]<1.00>Hello <1.30>world\n[00:01.00]<1.00>你<1.30>好").lines[0];
  assert(bilingualOffsetLine.translatedWordTimeline?.[1]?.time === 1.5, `LRC offset should shift translated word time to 1.5, got ${bilingualOffsetLine.translatedWordTimeline?.[1]?.time}`);

  const app = read("app.js");
  assert(app.includes("function appendLyricLineContent"), "Missing shared lyric line renderer");
  assert(app.includes("renderNowLyricFocusLine"), "Missing now lyric focus renderer");
  assert(app.includes("renderImmersiveLyricFocus"), "Missing immersive lyric renderer");
  assert(app.includes("immersive-lyric-original"), "Immersive lyric renderer does not render original text");
  assert(app.includes("immersive-lyric-translated"), "Immersive lyric renderer does not render translated text");
  assert(app.includes("translatedWordTimeline"), "App should render translated timed words when available");
  assert(app.includes("immersiveLyricWordGroups"), "Immersive lyric progress should cache original/translated word groups");
  assert(app.includes("lyricLineWordGroups"), "Now-playing lyric list should cache word groups for active progress");
  assert(app.includes("nowLyricWordGroups"), "Current lyric focus should cache word groups for active progress");
  assert(app.includes("function updateInlineLyricProgress"), "Inline lyric surfaces should update word progress");
  assert(app.includes("function updateLyricProgressGroups"), "Immersive lyrics should update original and translated word groups together");
  assert(index.includes('data-lyric-offset-adjust="earlier"'), "Lyrics panel should expose a button for lyrics that are too slow");
  assert(index.includes('data-lyric-offset-adjust="later"'), "Lyrics panel should expose a button for lyrics that are too fast");
  assert(index.includes("data-lyric-offset-reset"), "Lyrics panel should expose a lyric offset reset button");
  assert(css.includes(".lyric-offset-controls"), "Lyric offset controls should have scoped styles");
  assert(app.includes('LYRIC_OFFSET_KEY = "emby-music-web/lyric-offset-seconds"'), "Lyric offset should be persisted in localStorage");
  assert(app.includes("DEFAULT_LYRIC_OFFSET_SECONDS = 0.18"), "Lyric offset should preserve the previous default lead");
  assert(app.includes("function loadLyricOffsetSeconds"), "Lyric offset should load a saved preference");
  assert(app.includes("function saveLyricOffsetSeconds"), "Lyric offset should save preference changes");
  assert(app.includes("function adjustLyricOffset"), "Lyric offset should be adjustable from controls");
  assert(app.includes("function getAdjustedLyricSeconds"), "Lyric timing should share one adjusted playback time");
  assert(!app.includes("currentSeconds + 0.18"), "Lyric timing should not use a hard-coded 0.18s lead");
  assert(/function findActiveLyricIndex\(currentSeconds\) \{\s*const targetSeconds = getAdjustedLyricSeconds\(currentSeconds\);/.test(app), "Active lyric lookup should use configurable lyric offset");
  assert(/const lyricSeconds = getAdjustedLyricSeconds\(currentSeconds\);[\s\S]*?clamp\(\(lyricSeconds - start\) \/ \(end - start\), 0, 1\)/.test(app), "Immersive word progress should use configurable lyric offset");
  assert(/function refreshLyricsAfterOffsetChange\(\) \{[\s\S]*?state\.activeLyricIndex = -1;[\s\S]*?state\.activeLyricTimelineIndex = -1;[\s\S]*?updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(\), true\);/.test(app), "Changing lyric offset should reset lyric caches and refresh immediately");
  assert(app.includes("function updateLyricProgressFrame"), "Immersive word lyrics should use an animation-frame progress loop");
  assert(app.includes("requestAnimationFrame(updateLyricProgressFrame)"), "Lyric word progress loop should be driven by requestAnimationFrame");
  assert(app.includes("lyricClockAudioSeconds"), "Lyric word progress should maintain a high-resolution playback clock");
  assert(app.includes("function syncLyricPlaybackClock"), "Lyric playback clock should be explicitly synchronized");
  assert(app.includes("function getLyricPlaybackTimeSeconds"), "Lyric word progress should read from a smooth playback clock");
  assert(app.includes("function getVisibleLyricSyncTimeSeconds"), "Visible lyric sync should choose the smooth clock only when appropriate");
  assert(app.includes("LYRIC_WORD_MIN_LINE_DURATION_SECONDS"), "Lyric word progress should define a minimum line duration");
  assert(app.includes("LYRIC_WORD_MAX_LINE_DURATION_SECONDS"), "Lyric word progress should cap long line durations");
  assert(app.includes("LYRIC_TIMED_WORD_MAX_DURATION_SECONDS"), "Timed lyric words should cap fallback word duration so the last word does not drag until the next line");
  assert(app.includes("LYRIC_PROGRESS_RESUME_LEAD_MS"), "Lyric word progress should resume shortly before the next line after idling");
  assert(app.includes("lyricProgressResumeTimer"), "Lyric word progress should have a low-frequency idle timer");
  assert(app.includes("function getLyricWordProgressEndSeconds"), "Lyric word progress should centralize line end timing");
  assert(app.includes("function getTimedLyricWordPreferredDurationSeconds"), "Timed lyric fallback word duration should be centralized");
  assert(app.includes("function getLyricProgressIdleResumeDelayMs"), "Lyric word progress should calculate idle resume delays");
  assert(/const end = getLyricWordProgressEndSeconds\(start, nextEntry, words\.length\);[\s\S]*?const lineRatio = end > start/.test(app), "Immersive word progress should use capped line end timing");
  assert(/scheduleLyricProgressResumeIfIdle\(lineRatio, lyricSeconds, nextEntry\);/.test(app), "Lyric word progress should idle after a line is fully highlighted");
  assert(/function updateLyricProgressFrame\(\) \{[\s\S]*?const currentSeconds = getLyricPlaybackTimeSeconds\(\);[\s\S]*?updateActiveImmersiveLyricWordProgressFrame\(currentSeconds\)[\s\S]*?updateLyricsHighlight\(currentSeconds\);/.test(app), "RAF lyric progress should use the smooth lyric playback clock with an immersive hot path");
  assert(app.includes("function updateActiveImmersiveLyricWordProgressFrame"), "Immersive word lyrics should have a direct RAF hot path");
  assert(app.includes("function isCurrentLyricLineActiveAtTime"), "Immersive word lyric hot path should verify the cached line before skipping full highlight sync");
  assert(!/function updateLyricProgressFrame\(\) \{[\s\S]*?updateLyricsHighlight\(getAudioCurrentTimeSeconds\(\)\);/.test(app), "RAF lyric progress should not depend on discrete audio.currentTime reads");
  assert(/function handleAudioPlay\(\) \{[\s\S]*?syncLyricPlaybackClock\(\{ running: true \}\);[\s\S]*?refreshLyricsForPlaybackResume\(\);/.test(app), "Audio play should immediately refresh lyrics from the smooth playback clock");
  assert(/function handleAudioPause\(\) \{[\s\S]*?pauseLyricPlaybackClock\(\);[\s\S]*?stopLyricProgressLoop\(\);/.test(app), "Audio pause should freeze the smooth lyric playback clock");
  assert(/function handleAudioTimeUpdate\(\) \{[\s\S]*?syncLyricPlaybackClock\(\);[\s\S]*?updateProgress\(\);/.test(app), "Audio timeupdate should recalibrate the smooth lyric playback clock");
  assert(app.includes("function shouldSyncLyricsFromProgressUpdate"), "Progress updates should avoid competing with the immersive lyric RAF loop");
  assert(/function shouldSyncLyricsFromProgressUpdate\(\) \{[\s\S]*?&& lyricClockIsRunning[\s\S]*?&& \(lyricProgressFrame \|\| lyricProgressResumeTimer\)/.test(app), "Progress update lyric sync should defer to the active smooth lyric clock and RAF loop");
  assert(/if \(shouldSyncLyrics && shouldSyncLyricsFromProgressUpdate\(\)\) \{[\s\S]*?updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(current\)\);/.test(app), "Playback timeupdate should not double-drive immersive word progress while RAF is active");
  assert(/function handleAudioSeeked\(\) \{[\s\S]*?syncLyricPlaybackClock\(\);[\s\S]*?updateProgress\(\{ syncLyrics: false \}\);[\s\S]*?updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(\), true\);/.test(app), "Audio seeked should recalibrate and force-refresh lyrics");
  assert(app.includes('audioPlayer.addEventListener("ratechange", handleAudioRateChange)'), "Playback rate changes should recalibrate lyric timing");
  assert(/function handleAudioRateChange\(\) \{[\s\S]*?syncLyricPlaybackClock\(\);[\s\S]*?updateMediaSessionPosition\(\);/.test(app), "Audio rate changes should sync lyric clock before updating media session position");
  assert(/function handleAudioBufferingEnd\(\) \{[\s\S]*?syncLyricPlaybackClock\(\);[\s\S]*?refreshLyricsForPlaybackResume\(\);/.test(app), "Audio canplay/playing should immediately refresh lyrics after buffering");
  assert(/function refreshLyricsForPlaybackResume\(fallbackSeconds = getAudioCurrentTimeSeconds\(\)\) \{[\s\S]*?updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(fallbackSeconds\)\);[\s\S]*?syncLyricProgressLoop\(\);/.test(app), "Playback resume should refresh the active lyric before starting the RAF loop");
  assert(app.includes("function isImmersiveLyricsVisible"), "Immersive word lyric animation should have an explicit visibility gate");
  assert(/function shouldRunLyricProgressLoop\(\) \{[\s\S]*?&& isImmersiveLyricsVisible\(\)[\s\S]*?&& !audioPlayer\.ended;/.test(app), "Immersive word lyric RAF loop should run only while the immersive lyrics are visible");
  assert(/if \(activeIndex === state\.activeLyricIndex && !forceScroll\) \{[\s\S]*?if \(isImmersiveLyricsVisible\(\)\) \{[\s\S]*?updateImmersiveLyricProgress\(currentSeconds\);/.test(app), "Hidden immersive lyrics should not receive per-frame word progress updates");
  assert(/if \(nextView === "immersivePlayer" && state\.isLyricSynced\) \{[\s\S]*?updateImmersiveLyricProgress\(getVisibleLyricSyncTimeSeconds\(\), true, true\);/.test(app), "Entering immersive playback should immediately refresh current word lyric progress");
  assert(app.includes("LYRIC_AUTO_SCROLL_MIN_INTERVAL_MS"), "Lyric auto-scroll should have a minimum interval to avoid stacked smooth scrolls");
  assert(app.includes("lastLyricAutoScrollAt"), "Lyric auto-scroll should track the previous automatic scroll time");
  assert(app.includes("function shouldScrollLyricLine"), "Lyric auto-scroll should use a shared throttle helper");
  assert(app.includes("function scrollElementIntoContainerView"), "Lyric auto-scroll should use a container-scoped scroll helper");
  assert(app.includes("function scrollElementIntoNearestContainerView"), "List locate actions should have a nearest-container scroll helper");
  assert(app.includes("function getNearestScrollableContainer"), "List locate actions should detect their intended scroll container");
  assert(/getActiveView\(\) === "nowPlaying"[\s\S]*?scrollElementIntoContainerView\(lyricsList, activeItem, \{[\s\S]*?behavior: forceScroll \? "auto" : "smooth"/.test(app), "Now-playing lyric auto-scroll should stay inside the lyrics list");
  assert(/scrollElementIntoContainerView\(immersiveLyricList, activeItem, \{[\s\S]*?behavior: instantScroll \? "auto" : "smooth"/.test(app), "Immersive lyric auto-scroll should stay inside the immersive lyric list");
  assert(!/activeItem\.scrollIntoView\(\{ block: "center", behavior: instantScroll \? "auto" : "smooth" \}\);/.test(app), "Immersive lyric auto-scroll should not scroll the whole page");
  assert(/activateLibraryAlphabetEntry\(entry\) \{[\s\S]*?scrollElementIntoContainerView\(libraryTrackList, targetRow/.test(app), "Library alphabet scrubber should scroll only the library list");
  assert(/function revealLocatedQuickQueueItem\(item\) \{[\s\S]*?scrollElementIntoContainerView\(quickQueueList, item/.test(app), "Quick queue locate should scroll only the quick queue list");
  assert(/function revealLocatedTrackRow\(row[\s\S]*?scrollElementIntoNearestContainerView\(row/.test(app), "Track locate should scroll the nearest list container instead of the document");
  assert(/function scrollActiveImmersiveQueueItem\(\) \{[\s\S]*?scrollElementIntoContainerView\(immersiveUpNextList, activeItem/.test(app), "Immersive queue auto-scroll should stay inside the queue list");
  assert(/function locateCurrentImmersiveQueueTrack\(\) \{[\s\S]*?scrollElementIntoContainerView\(immersiveUpNextList, activeItem/.test(app), "Immersive queue locate should scroll only the immersive queue list");
  assert(/function syncSearchSuggestActiveItem\(\) \{[\s\S]*?scrollElementIntoContainerView\(searchSuggestList, item\.closest\("\.search-suggest-item"\) \|\| item/.test(app), "Search suggestion keyboard navigation should scroll only the suggestion list");
  assert(!/\.scrollIntoView\(/.test(app), "App scrolling should use container-scoped helpers instead of native scrollIntoView");
  assert(css.includes("body.immersive-player-open .content"), "Immersive playback should lock the background app scroller");
  assert(css.includes("overscroll-behavior: contain;"), "Immersive lyric list should contain scroll chaining");
  assert(app.includes("function installBrowserSmokeHooks"), "Browser smoke should expose guarded lyric progress hooks");
  assert(/function installBrowserSmokeHooks\(\) \{[\s\S]*?if \(!isBrowserSmokeRun\(\)\) \{[\s\S]*?return;[\s\S]*?window\.EmbyMusicBrowserSmoke = \{[\s\S]*?runLyricProgressScenario,/.test(app), "Browser smoke lyric hooks should only be exposed during browser-smoke runs");
  assert(app.includes('["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)'), "Browser smoke lyric hooks should only be available on local test hosts");
  assert(app.includes("function runLyricProgressScenario"), "Browser smoke should be able to run a real synthetic lyric progress scenario");
  assert(app.includes("function collectBrowserSmokeLyricState"), "Browser smoke should collect actual word progress state from rendered lyrics");
  assert(app.includes("function getLyricWordParts"), "Immersive lyrics should render enhanced LRC timed words");
  assert(lyricsCode.includes("function normalizeInlineLyricWordTimeline"), "Enhanced LRC parser should normalize line-relative word timings");
  assert(lyricsCode.includes("function shouldUseLineRelativeInlineTimes"), "Enhanced LRC parser should detect line-relative inline word timings");
  assert(lyricsCode.includes("function parseYrcLyrics"), "Lyrics parser should support YRC word-timed lyrics");
  assert(lyricsCode.includes("function parseTtmlLyrics"), "Lyrics parser should support TTML word-timed lyrics");
  assert(app.includes("word.dataset.wordTime"), "Immersive lyrics should persist enhanced LRC word times on word nodes");
  assert(app.includes("word.dataset.wordEndTime"), "Immersive lyrics should persist explicit word end times on word nodes");
  assert(app.includes("function updateTimedLyricWordProgress"), "Immersive lyrics should use enhanced LRC word timing when available");
  assert(app.includes("function hasTimedLyricWords"), "Immersive lyrics should detect timed word nodes");
  assert(app.includes("immersiveLyricWordTimings"), "Enhanced LRC word timings should be cached with rendered word nodes");
  assert(app.includes("immersiveLyricWordEndTimings"), "Enhanced LRC word end timings should be cached with rendered word nodes");
  assert(app.includes("immersiveLyricTimedWordUsable"), "Enhanced LRC timed-word usability should be cached at render time");
  assert(app.includes("function findTimedLyricWordIndex"), "Enhanced LRC word progress should locate the current word by timing search");
  assert(app.includes("function getTimedLyricWordProgress"), "Enhanced LRC word progress should calculate the current word fill from exact timestamps");
  assert(app.includes("updateLyricWordProgressWindow(words, litWords)"), "Enhanced LRC word progress should reuse the changed-word update window");
  const timedLyricProgressStart = app.indexOf("function updateTimedLyricWordProgress");
  const timedLyricProgressEnd = app.indexOf("function getTimedLyricWordTimings", timedLyricProgressStart);
  const timedLyricProgressFunction = timedLyricProgressStart >= 0 && timedLyricProgressEnd > timedLyricProgressStart
    ? app.slice(timedLyricProgressStart, timedLyricProgressEnd)
    : "";
  assert(timedLyricProgressFunction && !timedLyricProgressFunction.includes("words.forEach((word, index)"), "Enhanced LRC word progress should not scan every word on each frame");
  const hasTimedLyricWordsStart = app.indexOf("function hasTimedLyricWords");
  const hasTimedLyricWordsEnd = app.indexOf("function updateTimedLyricWordProgress", hasTimedLyricWordsStart);
  const hasTimedLyricWordsFunction = hasTimedLyricWordsStart >= 0 && hasTimedLyricWordsEnd > hasTimedLyricWordsStart
    ? app.slice(hasTimedLyricWordsStart, hasTimedLyricWordsEnd)
    : "";
  assert(hasTimedLyricWordsFunction && !hasTimedLyricWordsFunction.includes("areTimedLyricWordTimingsUsable"), "Enhanced LRC word progress should not re-validate all word timings on each frame");
  assert(app.includes("progressRenderSignature"), "Playback progress rendering should cache visible progress state");
  assert(app.includes("homeStartProgressSignature"), "Home start progress rendering should skip unchanged DOM writes");
  assert(app.includes("playerNextPreviewSignature"), "Next-track preview rendering should skip unchanged DOM writes");
  assert(app.includes("function invalidateProgressRenderCache"), "Progress render caches should be explicitly invalidated");
  assert(app.includes("function setTextIfChanged"), "Progress rendering should avoid redundant textContent writes");
  assert(app.includes("function setStylePropertyIfChanged"), "Progress rendering should avoid redundant style writes");
  assert(app.includes("function setAttributeIfChanged"), "Progress rendering should avoid redundant aria-label writes");
  assert(app.includes("PLAYBACK_POSITION_SAVE_INTERVAL_MS"), "Playback position should have a local save throttle");
  assert(app.includes("function persistPlaybackPosition"), "Playback position should be persisted while audio is playing");
  assert(/function handleAudioTimeUpdate\(\) \{[\s\S]*?updateProgress\(\);[\s\S]*?persistPlaybackPosition\(\);/.test(app), "Playback time updates should persist local resume position independently of server progress reports");
  assert(/document\.addEventListener\("visibilitychange"[\s\S]*?persistPlaybackPosition\(\{ force: true \}\);[\s\S]*?stopLyricProgressLoop\(\);/.test(app), "Backgrounding the page should force-save playback position");
  assert(app.includes('window.addEventListener("pagehide", () => {\n    persistPlaybackPosition({ force: true });\n  });'), "Pagehide should force-save playback position on mobile browsers");
  assert(app.includes("serverSearchController: null"), "Server search should keep an abort controller for stale requests");
  assert(app.includes("function abortActiveServerSearch"), "Server search should abort stale in-flight requests");
  assert(/function scheduleServerSearch\(rawQuery\) \{[\s\S]*?clearTimeout\(state\.serverSearchTimer\);\s*abortActiveServerSearch\(\);/.test(app), "Typing a new search query should immediately abort the previous in-flight request");
  assert(/function runServerSearch\(rawQuery\) \{[\s\S]*?abortActiveServerSearch\(\);[\s\S]*?signal: controller\?\.signal/.test(app), "Emby server search should cancel older in-flight requests");
  assert(/function runExternalSourceSearch\(rawQuery\) \{[\s\S]*?abortActiveServerSearch\(\);[\s\S]*?signal: controller\?\.signal/.test(app), "External source search should cancel older in-flight requests");
  assert(app.includes("function isAbortError"), "Canceled searches should be detected and ignored");
  assert(!/function resetPlayerMeta\(\) \{[\s\S]*?progressFill\.style\.width = "0";/.test(app), "Player reset should reuse cached progress rendering instead of direct progress DOM writes");
  assert(app.includes("activeTrackRowsCacheValid"), "Track-row fluid animation should cache active rows instead of querying every frame");
  assert(app.includes("function refreshActiveTrackRowsCache"), "Track-row fluid animation should have an explicit active-row cache refresh");
  assert(!/function getActiveTrackRows\(\) \{[\s\S]*?document\.querySelectorAll\("\.track-row\.active"\)/.test(app), "Track-row fluid animation should not query all active rows on every animation frame");
  assert(app.includes("function setLyricWordProgress"), "Lyric word progress should avoid redundant DOM writes");
  assert(app.includes("word._lyricProgress = normalizedPercent"), "Lyric word progress should cache hot-path progress in memory");
  assert(app.includes("const lyricWordProgressCssCache = new Map()"), "Lyric word progress should cache formatted CSS values");
  assert(app.includes("word._lyricProgressCss = cssValue"), "Lyric word progress should cache the last CSS progress string on each word");
  assert(!app.includes("word.dataset.wordProgress = String(normalizedPercent)"), "Lyric word progress should not write data attributes on every frame");
  assert(app.includes("Number(word._lyricProgress || 0)"), "Browser smoke should read lyric progress from the in-memory cache");
  assert(app.includes("word.dataset.wordText = part.value"), "Lyric word highlight overlays should mirror the rendered word text");
  assert(app.includes('word.style.setProperty("--word-progress", cssValue)'), "Lyric word progress should drive stable formatted text fill percentages");
  assert(app.includes("function getLyricWordProgressCssValue"), "Lyric word progress should reuse formatted CSS percentage strings");
  assert(!app.includes("--word-progress-ratio"), "Lyric word progress should not use transform ratios that visually compress glyphs");
  const wordAfterMatch = css.match(/\.immersive-lyric-list \.word::after \{[^}]*\}/);
  const wordAfterRule = wordAfterMatch?.[0] || "";
  const activeWordAfterRule = getCssRule(css, ".immersive-lyric-list .lyric-line.active .word::after,");
  assert(/\.immersive-lyric-list \.word \{[\s\S]*?contain: paint;/.test(css), "Immersive lyric word highlights should use paint containment hints");
  assert(/\.lyric-line \.word,[\s\S]*?\.now-lyric-focus \.word \{[\s\S]*?contain: paint;/.test(css), "Inline lyric word highlights should use paint containment hints");
  assert(/\.lyric-line \.word::after,[\s\S]*?\.now-lyric-focus \.word::after \{[\s\S]*?clip-path: inset\(0 calc\(100% - var\(--word-progress, 0%\)\) 0 0\);[\s\S]*?content: attr\(data-word-text\);/.test(css), "Inline lyric word highlights should use clipped text overlays");
  assert(/clip-path: inset\(0 calc\(100% - var\(--word-progress, 0%\)\) 0 0\);[\s\S]*?content: attr\(data-word-text\);/.test(wordAfterRule), "Immersive lyric word highlights should use a bounded clip-path text overlay");
  assert(activeWordAfterRule.includes("will-change: clip-path"), "Immersive lyric word highlights should limit clip-path compositing hints to active lines");
  assert(wordAfterRule && !wordAfterRule.includes("width: var(--word-progress"), "Immersive lyric word highlights should avoid width layout writes on the hot path");
  assert(css.includes("--immersive-lyric-word-active"), "Immersive lyric word highlights should have a dedicated active word color");
  assert(!/\.immersive-lyric-list \.word \{[\s\S]*?background:\s*[\s\S]*?background-clip: text;/.test(css), "Immersive lyric word highlights should not return to background-gradient text fills");
  assert(app.includes("const LYRIC_PROGRESS_EPSILON = 0.04"), "Lyric word progress should use a sub-percent diff threshold");
  assert(app.includes("function normalizeLyricWordProgressPercent"), "Lyric word progress should normalize percentages before hot-path DOM writes");
  assert(app.includes("function formatLyricWordProgressPercent"), "Lyric word progress should format percentages consistently before CSS writes");
  assert(app.includes("function updateLyricWordProgressWindow"), "Lyric word progress should update only the changed word window");
  assert(app.includes("wordHighlightClipPath"), "Browser smoke lyric state should expose the rendered word highlight clipping mode");
  assert(app.includes("normalizeLyricWordProgressPercent(clamp(litWords - nextPartialWordIndex, 0, 1) * 100)"), "Lyric word progress should keep 0.1% precision for smoother highlighting");
  assert(!app.includes("Math.round(clamp(litWords - nextPartialWordIndex, 0, 1) * 100)"), "Lyric word progress should not be quantized to whole-percent steps");
  assert(app.includes("lyricProgressFullWordCount"), "Lyric word progress should cache the previous fully-lit word count");
  assert(app.includes("lyricProgressPartialWordIndex"), "Lyric word progress should cache the previous partial word index");
  assert(!/words\.forEach\(\(word,\s*index\)\s*=>\s*\{\s*const wordRatio = clamp\(litWords - index, 0, 1\)/.test(app), "Lyric word progress should not recalculate every word on each animation frame");
  assert(app.includes("lyricTimeline"), "Synced lyric highlighting should use a precomputed timeline");
  assert(app.includes("lyricTimelineIndexByLineIndex"), "Lyric word progress should map line indexes to timeline indexes");
  assert(app.includes("activeLyricTimelineIndex"), "Synced lyric highlighting should cache the active timeline index");
  assert(app.includes("function findActiveLyricIndexBySearch"), "Lyric seeks should use binary search over the timeline");
  assert(app.includes("LYRIC_TIMELINE_SEEK_THRESHOLD_SECONDS"), "Large lyric seeks should switch to timeline binary search");
  assert(app.includes("currentEntry.index === currentIndex"), "Lyric timeline fast path should verify the cached line index before reusing it");
  assert(app.includes("targetSeconds - currentEntry.time > LYRIC_TIMELINE_SEEK_THRESHOLD_SECONDS"), "Lyric timeline jumps should not be advanced line by line");
  assert(/function seekToPosition\(positionSeconds, options = \{\}\) \{[\s\S]*?updateProgress\(\{ syncLyrics: false \}\);[\s\S]*?state\.activeLyricTimelineIndex = -1;[\s\S]*?updateLyricsHighlight\(position, true\);[\s\S]*?syncLyricProgressLoop\(\);/.test(app), "Manual seeks should immediately force-refresh lyric highlights");
  assert(/function handleAudioSeeked\(\) \{[\s\S]*?updateProgress\(\{ syncLyrics: false \}\);[\s\S]*?state\.activeLyricTimelineIndex = -1;[\s\S]*?updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(\), true\);/.test(app), "Audio seeks should reset lyric timeline cache and force-refresh lyric highlights without double-rendering");
  assert(/function updateProgress\(options = \{\}\) \{[\s\S]*?const shouldSyncLyrics = options\.syncLyrics !== false;[\s\S]*?if \(shouldSyncLyrics && shouldSyncLyricsFromProgressUpdate\(\)\) \{\s*updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(current\)\);/.test(app), "Progress updates should allow seeked handlers to skip the regular lyric sync pass and avoid competing with RAF lyric progress");
  assert(!app.includes("state.lyricTimeline.findIndex"), "Lyric progress should not search the timeline every frame");
  assert(app.includes("function renderStaticLyricFocusIfNeeded"), "Static lyric views should skip redundant playback-time renders");
  assert(app.includes("lastStaticLyricRenderSignature"), "Static lyric views should cache their rendered state");
  assert(app.includes("lyricRenderRevision"), "Static lyric render cache should be invalidated by lyric revisions");
  assert(app.includes("function invalidateLyricRenderState"), "Lyric render cache should have an explicit invalidation helper");
  assert((app.match(/invalidateLyricRenderState\(\);/g) || []).length >= 4, "Lyric load/status changes should invalidate static lyric renders");
  assert(/if \(!state\.isLyricSynced \|\| !state\.lyricTimeline\.length\) \{\s*stopLyricProgressLoop\(\);\s*renderStaticLyricFocusIfNeeded\(\);\s*return;/m.test(app), "Unsynced lyric updates should not rebuild lyric DOM on every tick");
  assert(app.includes("function getNextLyricTimelineEntry"), "Lyric word progress should reuse the lyric timeline for next-line timing");
  assert(!/state\.lyricLines\s*\.\s*slice\(activeIndex \+ 1\)\s*\.\s*find/.test(app), "Lyric word progress should not allocate slices on every frame");
  assert(/const start = Number\(currentLine\?\.time\);[\s\S]*?if \(!Number\.isFinite\(start\)\) \{[\s\S]*?updateLyricProgressGroupsByLineRatio\(groups, words\.length,[\s\S]*?return;[\s\S]*?const end = getLyricWordProgressEndSeconds\(start, nextEntry, words\.length\);/.test(app), "Lyric word progress should explicitly handle synced lines without finite timing");
  assert(app.includes("lyricLineElements"), "Now-playing lyric lines should be cached for active updates");
  assert(app.includes("function syncLyricListActiveClass"), "Now-playing lyric active class should be updated without scanning the list");
  assert(!app.includes('lyricsList.querySelectorAll(".lyric-line")'), "Now-playing lyric active updates should not query every lyric line");
  assert(!app.includes('lyricsList.querySelector(".lyric-line.active")'), "Now-playing lyric scroll should use the cached active line");
  assert(app.includes("immersiveLyricLineElements"), "Immersive lyric lines should be cached for frame updates");
  assert(app.includes("immersiveLyricWordElements"), "Immersive lyric words should be cached for frame updates");
  assert(app.includes("immersiveLyricLineElements[activeIndex]"), "Lyric progress should use cached active line elements");
  assert(app.includes("immersiveLyricWordElements[activeIndex] || []"), "Lyric progress should use cached word elements");
  assert(app.includes("immersiveLyricActiveIndex = -1;\n  immersiveLyricLineElements = []"), "Immersive active class cache should reset when the lyric DOM is rebuilt");
  assert(!/function resetLyricProgressState\(\) \{\s*lyricProgressActiveIndex = -1;\s*immersiveLyricActiveIndex = -1;/.test(app), "Lyric progress resets should not hide the previous active class index");
  assert(!app.includes('querySelectorAll(`.lyric-line:not([data-lyric-index="${activeIndex}"]) .word`)'), "Lyric line changes should not scan all inactive word nodes");
  assert(
    /renderImmersiveLyricFocus\(\);\s*updateLyricsHighlight\(getVisibleLyricSyncTimeSeconds\(\), true\);/.test(app),
    "Immersive lyrics should be rendered once when lyric content is rebuilt"
  );
  assert(
    /state\.activeLyricIndex = activeIndex;[\s\S]*?renderNowLyricFocus\(\);[\s\S]*?updateImmersiveLyricProgress\(currentSeconds, forceScroll \|\| getActiveView\(\) === "immersivePlayer", forceScroll\);/.test(app),
    "Active lyric changes should update immersive lyric state without rebuilding the full list"
  );
  assert(
    !/state\.activeLyricIndex = activeIndex;\s*resetLyricProgressState\(\);/.test(app),
    "Active lyric changes should keep the previous word-progress index so the old line can be reset"
  );
  assert(
    !/state\.activeLyricIndex = activeIndex;[\s\S]*?renderImmersiveLyricFocus\(\);[\s\S]*?lyricsList\.querySelectorAll\("\.lyric-line"\)/.test(app),
    "Active lyric changes should not rebuild the immersive lyric DOM"
  );

  const browserSmoke = read("scripts/browser-smoke.js");
  assert(browserSmoke.includes("createLyricProgressSmokeScript"), "Browser smoke should include a real lyric progress scenario");
  assert(browserSmoke.includes("runLyricProgressScenario"), "Browser smoke should call the guarded lyric progress hook");
  assert(browserSmoke.includes("wordProgress?.[1] > 0"), "Browser smoke should verify partial word progress");
  assert(browserSmoke.includes("wordHighlightClipPath"), "Browser smoke should verify clipped word highlight rendering");
  assert(browserSmoke.includes("wordProgress?.[1] > lyricProgressBeforeOffset.wordProgress?.[1]"), "Browser smoke should verify lyric offset changes word progress");
  assert(browserSmoke.includes("lyricProgressAfterResumeRefresh"), "Browser smoke should verify immediate lyric refresh on playback resume");
  assert(browserSmoke.includes("enhancedTailWordProgress.wordProgress?.[2] === 100"), "Browser smoke should verify enhanced lyric tail words finish before a long next-line gap");
  assert(browserSmoke.includes("lyricLongGapProgress"), "Browser smoke should verify long-gap lyric word progress");
  assert(browserSmoke.includes("longGapIdleResumeDelayMs"), "Browser smoke should verify long-gap lyric RAF idling");
  assert(browserSmoke.includes("enhancedLateWordProgress"), "Browser smoke should verify enhanced LRC timed word progress");
  assert(browserSmoke.includes("relativeEnhancedProgress"), "Browser smoke should verify line-relative enhanced LRC timed word progress");
  assert(browserSmoke.includes("denseWordPerformance"), "Browser smoke should verify dense word lyric performance");
  assert(browserSmoke.includes("createSearchAbortSmokeScript"), "Browser smoke should verify stale search request cancellation");
  assert(app.includes("runSearchAbortScenario"), "Main app browser smoke hooks should expose search cancellation behavior");
  assert(browserSmoke.includes("progressWriteCount > 60"), "Browser smoke should verify visible lyric clip progress writes");
  assert(browserSmoke.includes("averageUpdateMs < 4"), "Browser smoke should guard dense lyric progress update cost");
  assert(browserSmoke.includes("endScrollLayout"), "Browser smoke should verify immersive end-of-lyrics layout stability");
  assert(browserSmoke.includes("shellBottomGapPx <= 1"), "Browser smoke should detect immersive bottom gaps");
  assert(browserSmoke.includes("documentScrollTop === 0"), "Browser smoke should verify immersive lyric scroll does not move the document");
  assert(browserSmoke.includes("contentScrollTop === 0"), "Browser smoke should verify immersive lyric scroll does not move the app content");
}

async function checkExternalSourceLyrics() {
  const externalSourceCode = read("src/external-source-api.js");
  const requests = [];
  const timeoutContext = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async (_url, options = {}) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
    window: {},
  };
  const context = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async (url) => {
      requests.push(String(url));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({
          data: {
            sentences: [
              { startTimeMs: 1230, text: "第一句" },
              { StartPositionTicks: 24500000, Text: "第二句" },
              { value: "无时间歌词" },
            ],
          },
        }),
      };
    },
    window: {},
  };
  vm.runInNewContext(externalSourceCode, context, { filename: "src/external-source-api.js" });
  vm.runInNewContext(externalSourceCode, timeoutContext, { filename: "src/external-source-api.js" });

  const api = context.window.EmbyMusicExternalSource.createExternalSourceApi();
  const trackContext = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        items: [{
          id: "plugin:wy-key:persisted-song",
          title: "持久歌源",
          artist: "测试艺人",
          platform: "网易",
          pluginUrl: "https://plugins.example.test/wy.js",
          raw: {
            pluginKey: "wy-key",
            pluginName: "网易",
            pluginUrl: "https://plugins.example.test/wy.js",
            sourceId: "persisted-song",
          },
        }],
        total: 1,
      }),
    }),
    window: {},
  };
  vm.runInNewContext(externalSourceCode, trackContext, { filename: "src/external-source-api.js" });
  const normalizedTracks = await trackContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchTracks("http://localhost:5174");
  const normalizedTrack = normalizedTracks.Items?.[0] || {};
  assert(normalizedTrack.ExternalSource?.restore?.pluginKey === "wy-key", `External tracks should persist restore pluginKey, got ${normalizedTrack.ExternalSource?.restore?.pluginKey || "-"}`);
  assert(normalizedTrack.ExternalSource?.restore?.pluginUrl === "https://plugins.example.test/wy.js", `External tracks should persist restore pluginUrl, got ${normalizedTrack.ExternalSource?.restore?.pluginUrl || "-"}`);
  assert(normalizedTrack.ExternalSource?.restore?.raw?.id === "plugin:wy-key:persisted-song", `External tracks should persist restore raw payload, got ${JSON.stringify(normalizedTrack.ExternalSource?.restore?.raw)}`);

  const lyric = await api.fetchLyric("http://localhost:5174", {
    Id: "external:test:song-1",
    ExternalSource: {
      id: "song-1",
      platform: "test",
    },
  });

  assert(requests[0]?.includes("/lyric"), `External lyric request should call /lyric, got ${requests[0] || "-"}`);
  assert(lyric.includes("[00:01.23]第一句"), `External lyric line array should convert millisecond time, got ${lyric}`);
  assert(lyric.includes("[00:02.45]第二句"), `External lyric line array should convert tick time, got ${lyric}`);
  assert(lyric.includes("无时间歌词"), `External lyric line array should keep untimed text, got ${lyric}`);

  const snapshotRequests = [];
  const snapshotContext = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async (url) => {
      snapshotRequests.push(String(url));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ url: "https://example.test/song.mp3" }),
      };
    },
    window: {},
  };
  vm.runInNewContext(externalSourceCode, snapshotContext, { filename: "src/external-source-api.js" });
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:wy-test-song",
    ExternalSource: {
      id: "plugin:wy-key:wy-test-song",
      platform: "网易",
      raw: {
        pluginKey: "wy-key",
        pluginName: "网易",
        pluginUrl: "https://plugins.example.test/wy.js",
        sourceId: "wy-test-song",
        raw: { id: "wy-test-song", name: "可恢复歌曲", artist: "测试艺人" },
      },
    },
  });
  const snapshotUrl = new URL(snapshotRequests[0]);
  const snapshot = JSON.parse(snapshotUrl.searchParams.get("track") || "{}");
  assert(snapshotUrl.pathname === "/media", `External media request should call /media, got ${snapshotUrl.pathname}`);
  assert(snapshot.pluginKey === "wy-key", `External media request should include pluginKey snapshot, got ${snapshot.pluginKey || "-"}`);
  assert(snapshot.pluginUrl === "https://plugins.example.test/wy.js", `External media request should include pluginUrl snapshot, got ${snapshot.pluginUrl || "-"}`);
  assert(snapshot.raw?.id === "wy-test-song", `External media request should include raw track snapshot, got ${JSON.stringify(snapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:wy-test-song-2",
    ExternalSource: {
      id: "plugin:wy-key:wy-test-song-2",
      platform: "网易",
      raw: {
        id: "plugin:wy-key:wy-test-song-2",
        raw: {
          pluginKey: "wy-key",
          pluginName: "网易",
          sourceId: "wy-test-song-2",
          raw: { id: "wy-test-song-2", name: "重进可恢复歌曲", url: "https://example.test/recovered.mp3" },
        },
      },
    },
  });
  const nestedSnapshotUrl = new URL(snapshotRequests[1]);
  const nestedSnapshot = JSON.parse(nestedSnapshotUrl.searchParams.get("track") || "{}");
  assert(nestedSnapshot.pluginKey === "wy-key", `Nested external media snapshot should recover pluginKey, got ${nestedSnapshot.pluginKey || "-"}`);
  assert(nestedSnapshot.raw?.url === "https://example.test/recovered.mp3", `Nested external media snapshot should preserve raw media url, got ${JSON.stringify(nestedSnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:wy-test-song-3",
    ExternalSource: {
      id: "plugin:wy-key:wy-test-song-3",
      platform: "网易",
      mediaUrl: "https://expired.example.test/old-token.mp3",
      raw: {
        pluginKey: "wy-key",
        pluginName: "网易",
        sourceId: "wy-test-song-3",
        raw: { id: "wy-test-song-3", name: "旧直链也要恢复", artist: "测试艺人" },
      },
    },
  });
  const restoredInlineUrl = new URL(snapshotRequests[2]);
  const restoredInlineSnapshot = JSON.parse(restoredInlineUrl.searchParams.get("track") || "{}");
  assert(restoredInlineUrl.pathname === "/media", `Restored plugin tracks with old inline URLs should re-resolve through /media, got ${restoredInlineUrl.href}`);
  assert(restoredInlineUrl.searchParams.get("id") === "plugin:wy-key:wy-test-song-3", `Restored plugin media request should keep the plugin id, got ${restoredInlineUrl.searchParams.get("id") || "-"}`);
  assert(restoredInlineSnapshot.raw?.id === "wy-test-song-3", `Restored plugin media request should preserve raw track snapshot, got ${JSON.stringify(restoredInlineSnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:qq:7063423",
    ExternalSource: {
      id: "plugin:qq-key:7063423",
      platform: "qq",
      mediaUrl: "https://expired.example.test/not-a-real-audio-page",
      raw: { id: 7063423, title: "插件音源必须实时解析" },
    },
  });
  const pluginIdOnlyUrl = new URL(snapshotRequests[3]);
  const pluginIdOnlySnapshot = JSON.parse(pluginIdOnlyUrl.searchParams.get("track") || "{}");
  assert(pluginIdOnlyUrl.pathname === "/media", `Plugin id tracks should always resolve through /media instead of stale mediaUrl, got ${pluginIdOnlyUrl.href}`);
  assert(pluginIdOnlySnapshot.pluginKey === "qq-key", `Plugin id tracks should infer pluginKey from ExternalSource.id, got ${pluginIdOnlySnapshot.pluginKey || "-"}`);
  assert(pluginIdOnlySnapshot.raw?.id === 7063423, `Plugin id tracks should preserve raw search payload, got ${JSON.stringify(pluginIdOnlySnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:wy-test-song-4",
    ExternalSource: {
      id: "plugin:wy-key:wy-test-song-4",
      platform: "网易",
      mediaUrl: "https://expired.example.test/media-response-token.mp3",
      raw: {
        pluginKey: "wy-key",
        pluginName: "网易",
        sourceId: "wy-test-song-4",
        raw: { id: "wy-test-song-4", name: "播放后仍可恢复" },
        media: { url: "https://example.test/resolved-once.mp3" },
      },
    },
  });
  const mediaRawSnapshotUrl = new URL(snapshotRequests[4]);
  const mediaRawSnapshot = JSON.parse(mediaRawSnapshotUrl.searchParams.get("track") || "{}");
  assert(mediaRawSnapshot.raw?.id === "wy-test-song-4", `Media response raw should keep original plugin track for later restore, got ${JSON.stringify(mediaRawSnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:restore-only-song",
    ExternalSource: {
      id: "plugin:wy-key:restore-only-song",
      platform: "网易",
      mediaUrl: "https://expired.example.test/media-response-only.mp3",
      restore: {
        pluginKey: "wy-key",
        pluginName: "网易",
        sourceId: "restore-only-song",
        raw: { id: "restore-only-song", name: "只靠恢复快照播放" },
      },
      raw: {
        url: "https://expired.example.test/media-response-only.mp3",
        bitrate: 320000,
      },
    },
  });
  const restoreOnlySnapshotUrl = new URL(snapshotRequests[5]);
  const restoreOnlySnapshot = JSON.parse(restoreOnlySnapshotUrl.searchParams.get("track") || "{}");
  assert(restoreOnlySnapshot.pluginKey === "wy-key", `Dedicated restore snapshot should keep pluginKey, got ${restoreOnlySnapshot.pluginKey || "-"}`);
  assert(restoreOnlySnapshot.raw?.id === "restore-only-song", `Dedicated restore snapshot should preserve raw plugin track, got ${JSON.stringify(restoreOnlySnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:legacy-song",
    ExternalSource: {
      id: "plugin:wy-key:legacy-song",
      platform: "网易",
      mediaUrl: "https://expired.example.test/legacy-token.mp3",
      raw: { id: "legacy-song", name: "旧缓存歌曲", artist: "测试艺人" },
    },
  });
  const legacySnapshotUrl = new URL(snapshotRequests[6]);
  const legacySnapshot = JSON.parse(legacySnapshotUrl.searchParams.get("track") || "{}");
  assert(legacySnapshot.pluginKey === "wy-key", `Legacy restored plugin track should infer pluginKey from id, got ${legacySnapshot.pluginKey || "-"}`);
  assert(legacySnapshot.sourceId === "legacy-song", `Legacy restored plugin track should infer sourceId from id, got ${legacySnapshot.sourceId || "-"}`);
  assert(legacySnapshot.raw?.id === "legacy-song", `Legacy restored plugin track should keep raw payload, got ${JSON.stringify(legacySnapshot.raw)}`);
  await snapshotContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:cached-only-song",
    Name: "只有旧缓存的歌",
    Artists: ["测试艺人"],
    Album: "测试专辑",
    ExternalSource: {
      id: "plugin:wy-key:cached-only-song",
      platform: "网易",
      pluginKey: "wy-key",
      pluginName: "网易",
      mediaKind: "audio",
    },
  }, { forceResolve: true });
  const cachedOnlySnapshotUrl = new URL(snapshotRequests[7]);
  const cachedOnlySnapshot = JSON.parse(cachedOnlySnapshotUrl.searchParams.get("track") || "{}");
  assert(cachedOnlySnapshot.pluginKey === "wy-key", `Cached-only plugin track should keep pluginKey, got ${cachedOnlySnapshot.pluginKey || "-"}`);
  assert(cachedOnlySnapshot.sourceId === "cached-only-song", `Cached-only plugin track should infer sourceId from plugin id, got ${cachedOnlySnapshot.sourceId || "-"}`);
  assert(cachedOnlySnapshot.raw?.id === "cached-only-song", `Cached-only plugin track should include fallback raw id, got ${JSON.stringify(cachedOnlySnapshot.raw)}`);
  assert(cachedOnlySnapshot.raw?.title === "只有旧缓存的歌", `Cached-only plugin track should include fallback title, got ${JSON.stringify(cachedOnlySnapshot.raw)}`);

  const forceResolveRequests = [];
  const forceResolveContext = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async (url) => {
      forceResolveRequests.push(String(url));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ url: "https://fresh.example.test/new-token.mp3" }),
      };
    },
    window: {},
  };
  vm.runInNewContext(externalSourceCode, forceResolveContext, { filename: "src/external-source-api.js" });
  const forceResolveApi = forceResolveContext.window.EmbyMusicExternalSource.createExternalSourceApi();
  const cachedInlineMedia = await forceResolveApi.fetchMediaSource("http://localhost:5174", {
    Id: "external:direct:cached-song",
    ExternalSource: {
      id: "cached-song",
      platform: "direct",
      mediaUrl: "https://expired.example.test/cached-token.mp3",
    },
  });
  assert(cachedInlineMedia.streamUrl === "https://expired.example.test/cached-token.mp3", `External media should keep direct inline URL by default, got ${cachedInlineMedia.streamUrl}`);
  assert(forceResolveRequests.length === 0, `Direct inline media should not hit /media by default, got ${forceResolveRequests.join(", ") || "-"}`);
  const freshMedia = await forceResolveApi.fetchMediaSource("http://localhost:5174", {
    Id: "external:direct:cached-song",
    ExternalSource: {
      id: "cached-song",
      platform: "direct",
      mediaUrl: "https://expired.example.test/cached-token.mp3",
    },
  }, { forceResolve: true });
  const freshMediaUrl = new URL(forceResolveRequests[0]);
  assert(freshMediaUrl.pathname === "/media", `Force-resolved external media should bypass stale inline URL and call /media, got ${freshMediaUrl.href}`);
  assert(freshMedia.streamUrl === "https://fresh.example.test/new-token.mp3", `Force-resolved external media should use the fresh bridge URL, got ${freshMedia.streamUrl}`);

  const bridgedMediaRequests = [];
  const bridgedMediaContext = {
    URL,
    AbortController,
    clearTimeout,
    location: { href: "http://localhost:5174/" },
    setTimeout,
    fetch: async (url) => {
      bridgedMediaRequests.push(String(url));
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({
          streamUrl: "http://localhost:5174/plugin-stream?id=plugin%3Awy-key%3Abridge-song&quality=standard",
          bridgeStreamUrl: "http://localhost:5174/plugin-stream?id=plugin%3Awy-key%3Abridge-song&quality=standard",
          directUrl: "https://media.example.test/fresh-token.mp3",
          restore: {
            pluginKey: "wy-key",
            pluginName: "网易",
            sourceId: "bridge-song",
            raw: { id: "bridge-song", name: "桥端稳定播放" },
          },
        }),
      };
    },
    window: {},
  };
  vm.runInNewContext(externalSourceCode, bridgedMediaContext, { filename: "src/external-source-api.js" });
  const bridgedMedia = await bridgedMediaContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchMediaSource("http://localhost:5174", {
    Id: "external:plugin:bridge-song",
    ExternalSource: {
      id: "plugin:wy-key:bridge-song",
      platform: "网易",
      pluginKey: "wy-key",
    },
  }, { forceResolve: true });
  assert(bridgedMedia.streamUrl.includes("/plugin-stream"), `Bridged media should keep the stable plugin stream URL, got ${bridgedMedia.streamUrl || "-"}`);
  assert(bridgedMedia.bridgeStreamUrl.includes("/plugin-stream"), `Bridged media should expose bridgeStreamUrl, got ${bridgedMedia.bridgeStreamUrl || "-"}`);
  assert(bridgedMedia.directUrl === "https://media.example.test/fresh-token.mp3", `Bridged media should keep directUrl as metadata, got ${bridgedMedia.directUrl || "-"}`);
  assert(bridgedMedia.restore?.pluginKey === "wy-key", `Bridged media should preserve restore snapshot, got ${JSON.stringify(bridgedMedia.restore)}`);

  try {
    await timeoutContext.window.EmbyMusicExternalSource.createExternalSourceApi().fetchTracks("http://localhost:5174", { timeoutMs: 5 });
    assert(false, "External source requests should time out when the bridge does not respond");
  } catch (error) {
    assert(String(error?.message || "").includes("音源桥请求超时"), `External source timeout should be readable, got ${error?.message || "-"}`);
  }

  try {
    const controller = new AbortController();
    const cancelledRequest = timeoutContext.window.EmbyMusicExternalSource.createExternalSourceApi()
      .fetchTracks("http://localhost:5174", { signal: controller.signal, timeoutMs: 1000 });
    controller.abort();
    await cancelledRequest;
    assert(false, "External source requests should respect caller cancellation");
  } catch (error) {
    assert(String(error?.message || "").includes("音源桥请求已取消"), `External source cancellation should be readable, got ${error?.message || "-"}`);
  }

  const bridge = read("scripts/source-bridge.js");
  assert(bridge.includes("DEFAULT_SOURCE_BRIDGE_MANIFEST_URLS"), "Source bridge should include built-in default manifests");
  assert(bridge.includes("https://13413.kstore.vip/yuanli/yuanli.json"), "Source bridge should include the default yuanli manifest");
  assert(bridge.includes("...DEFAULT_SOURCE_BRIDGE_MANIFEST_URLS"), "Source bridge should load the built-in manifest by default");
  assert(bridge.includes("function extractPluginLyricText"), "Source bridge should normalize plugin lyric payloads");
  assert(bridge.includes("formatPluginLyricLineArray"), "Source bridge should convert plugin lyric line arrays to LRC");
  assert(bridge.includes("payload.result?.sentences"), "Source bridge should inspect nested lyric sentence arrays");
  assert(bridge.includes("line?.StartPositionTicks"), "Source bridge should support Emby-style lyric tick fields");
  assert(bridge.includes("function formatLrcTimestamp"), "Source bridge should format converted lyric line timestamps");
  assert(bridge.includes("function restorePluginTrackFromSnapshot"), "Source bridge should restore plugin tracks from persisted snapshots");
  assert(bridge.includes("pluginTrackCachePath"), "Source bridge should persist plugin track cache between bridge restarts");
  assert(bridge.includes("function rememberPluginTrack"), "Source bridge should remember plugin search results for later playback");
  assert(bridge.includes("function loadPluginTrackCache"), "Source bridge should load plugin tracks from persistent cache");
  assert(bridge.includes("function restorePluginTrackFromCache"), "Source bridge should restore plugin tracks from cache without requiring a new search");
  assert(bridge.includes("function restorePluginTrackFromId"), "Source bridge should rebuild plugin tracks from plugin ids when no cache snapshot exists");
  assert(/function getTrackFromUrl\(url\) \{[\s\S]*?restorePluginTrackFromSnapshot\(url, id\)[\s\S]*?restorePluginTrackFromCache\(id\)[\s\S]*?restorePluginTrackFromId\(id\)/.test(bridge), "Source bridge media lookup should restore plugin tracks before returning 404");
  assert(bridge.includes('url.pathname === "/plugin-stream"'), "Source bridge should expose a stable local plugin stream endpoint");
  assert(bridge.includes("function streamPluginMedia"), "Source bridge should stream plugin media through the local bridge");
  assert(bridge.includes("function createPluginBridgeMediaResponse"), "Source bridge media responses should return stable local plugin stream URLs");
  assert(/function createPluginBridgeMediaResponse\(request, track, media = \{\}, requestedQuality = ""\) \{[\s\S]*?bridgeStreamUrl: streamUrl[\s\S]*?directUrl: media\.url \|\| media\.streamUrl/.test(bridge), "Plugin media responses should keep the direct URL only as metadata while playing through the bridge");
  assert(/function createPluginStreamUrl\(request, track, requestedQuality = ""\) \{[\s\S]*?appendPluginTrackSnapshot\(streamUrl, track\);[\s\S]*?return streamUrl\.toString\(\);/.test(bridge), "Plugin stream URLs should carry a restore snapshot for direct re-entry playback");
  assert(bridge.includes("function appendPluginTrackSnapshot"), "Source bridge should append plugin restore snapshots to stable stream URLs");
  assert(/function streamPluginMedia\(request, response, url\) \{[\s\S]*?const media = await resolvePluginMedia\(track, requestedQuality\)[\s\S]*?await streamRemoteMedia\(request, response, proxyUrl\)/.test(bridge), "Plugin stream endpoint should resolve fresh media and proxy it with range support");
  assert(bridge.includes('"GET, HEAD, POST, OPTIONS"'), "Source bridge CORS should advertise HEAD for media probing");
  assert(bridge.includes("function getPluginForSnapshot"), "Source bridge should recover persisted plugin tracks when the plugin key changes");
  assert(bridge.includes("function getPluginByUrlSafe"), "Source bridge should match restored plugin tracks by plugin URL");
  assert(bridge.includes("function getPluginByNameSafe"), "Source bridge should match restored plugin tracks by plugin name");
  assert(bridge.includes("url.searchParams.get(\"track\")"), "Source bridge should read persisted track snapshots from media requests");
  assert(bridge.includes("raw: track.raw"), "Source bridge API tracks should preserve plugin raw payloads for later playback");
  assert(bridge.includes("pluginUrl: track.pluginUrl"), "Source bridge API tracks should preserve plugin URL for resilient restored playback");
  assert(/function buildPluginMediaResponse\(track, options = \{\}\) \{[\s\S]*?pluginKey: track\.pluginKey[\s\S]*?media: payload/.test(bridge), "Source bridge media responses should preserve original plugin snapshots after playback resolution");
  assert(bridge.includes("function getPluginDirectMediaUrl"), "Source bridge should reuse direct plugin media URLs before plugin retries");
  assert(/async function resolvePluginMedia\(track, quality\) \{[\s\S]*?runtime\.module\.getMediaSource[\s\S]*?if \(directUrl\)/.test(bridge), "Source bridge should prefer live plugin media resolution before direct URL fallback");
  assert(bridge.includes("function isPluginDirectMediaUrlPlayable"), "Source bridge should not treat arbitrary plugin url fields as playable media");
  assert(bridge.includes("STREAMING_EXTENSIONS"), "Source bridge direct URL fallback should recognize streaming media URLs");
  assert(bridge.includes("function getPluginQualityCandidates"), "Source bridge should retry plugin media quality candidates");
  assert(bridge.includes("resolvePluginMediaPayload"), "Source bridge should resolve plugin media with fallback quality attempts");
  assert(externalSourceCode.includes("function hasRestorableExternalPluginSnapshot"), "External source playback should detect restorable plugin snapshots");
  assert(/function shouldResolveInlineUrlThroughBridge\(url, track\) \{[\s\S]*?hasRestorableExternalPluginSnapshot\(track\)/.test(externalSourceCode), "Restored plugin tracks should ignore stale inline URLs and re-resolve through the bridge");
  assert(/function shouldResolveInlineUrlThroughBridge\(url, track\) \{[\s\S]*?isRestorableExternalPluginTrack\(track\)/.test(externalSourceCode), "Plugin source tracks should ignore stale inline URLs even before a complete restore snapshot exists");
  assert(externalSourceCode.includes("options.forceResolve"), "External source playback should support bypassing stale inline URLs on retry");
}

function checkStorageQueuePersistence() {
  const storageCode = read("src/storage.js");
  const localStorage = createMemoryLocalStorage();
  const context = {
    localStorage,
    navigator: { platform: "Smoke" },
    window: {},
  };

  vm.runInNewContext(storageCode, context, { filename: "src/storage.js" });

  const queueKey = "emby-music-web/queue";
  const storage = context.window.EmbyMusicStorage.createEmbyMusicStorage({
    appName: "Smoke",
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    maxQueueTracks: 100,
    queueKey,
  });
  const currentSession = {
    sourceMode: "external",
    serverUrl: "http://127.0.0.1:5174",
    externalSourceApiUrl: "http://127.0.0.1:5174",
    userId: "external-source",
    serverId: "external-source",
  };
  const legacyQueueKey = `${queueKey}/${encodeURIComponent("source-bridge://unconfigured::external-source")}`;
  const legacyQueuePayload = {
    serverUrl: "source-bridge://unconfigured",
    userId: "external-source",
    serverId: "external-source",
    queue: [{ Id: "external:plugin:wy-key:restore-song", Name: "恢复播放歌曲" }],
    currentTrackId: "external:plugin:wy-key:restore-song",
    currentTrackIndex: 0,
    positionSeconds: 42,
    savedAt: "2026-06-08T00:00:00.000Z",
  };

  localStorage.setItem(legacyQueueKey, JSON.stringify(legacyQueuePayload));

  const restoredQueue = storage.loadQueueState(currentSession);
  assert(restoredQueue.currentTrack?.Id === "external:plugin:wy-key:restore-song", `External source queue should load legacy unconfigured bridge queue after re-entry, got ${restoredQueue.currentTrack?.Id || "-"}`);
  assert(restoredQueue.positionSeconds === 42, `External source queue should keep legacy playback position, got ${restoredQueue.positionSeconds}`);

  storage.saveQueueState({
    session: currentSession,
    queue: [{ Id: "external:plugin:wy-key:new-song", Name: "新缓存歌曲" }],
    currentTrackId: "external:plugin:wy-key:new-song",
    currentTrackIndex: 0,
    positionSeconds: 7,
  });

  const stableQueueKey = `${queueKey}/${encodeURIComponent("source-bridge://external-source::external-source")}`;
  assert(localStorage.hasItem(stableQueueKey), "External source queue should save under a stable bridge account key instead of the mutable bridge URL");
}

function checkAppFunctionReferences() {
  const app = read("app.js");
  const embyApi = read("src/emby-api.js");
  const externalSourceCode = read("src/external-source-api.js");
  const sourceBridge = read("scripts/source-bridge.js");
  const storageCode = read("src/storage.js");
  [
    "getAlbumQualityBucket",
    "getTrackQualityBucket",
    "renderPlaybackRecoveryQuickList",
    "applyRecoveryQualityProfile",
    "openMobilePlayerActions",
    "getDiagnosticsGuidance",
    "getLoginDiagnosticsGuidance",
    "trapTrackActionSheetFocus",
    "getTrackActionSheetFocusableElements",
  ].forEach((name) => {
    assert(app.includes(`function ${name}`), `Missing app function ${name}`);
  });

  assert(app.includes("Recommended action:"), "Diagnostics should include a recommended action");
  assert(embyApi.includes("const hasExternalSignal = Boolean(options.signal)"), "Emby API requests should distinguish caller cancellation from timeout");
  assert(embyApi.includes("function combineAbortSignals"), "Emby API requests should combine timeout and caller cancellation signals");
  assert(/if \(error\?\.name === "AbortError"\) \{[\s\S]*?if \(hasExternalSignal && !timedOut\) \{[\s\S]*?throw error;/.test(embyApi), "Emby API should preserve external AbortError for canceled searches while keeping timeout errors readable");
  assert(app.includes("Playback recovery visible:"), "Diagnostics should include playback recovery visibility");
  assert(app.includes("window.EmbyMusicAppReady = true"), "Main app should mark itself ready after initialization");
  assert(app.includes("window.EmbyMusicAppError = readableError(error)"), "Main app should expose initialization errors to fallback diagnostics");
  assert(!app.includes("window.EmbyMusicAppReady = true;\n  syncLoginActionButtons();"), "Login event binding must not mark a failed init as app-ready");
  assert(app.includes("const AUTO_DISMISS_NOTICE_MS = 1800"), "Actionless notices should auto-hide within 1-2 seconds");
  assert(app.includes("const AUTO_DISMISS_STATUS_MS = 1800"), "Transient status messages should auto-hide within 1-2 seconds");
  assert(app.includes("window.addEventListener(\"emby-music-hls-ready\", handleHlsReady)"), "hls.js loading should refresh playback capability without blocking init");
  assert(app.includes("function renderTopLyricFocus"), "Topbar lyrics should reuse the current lyric render state");
  assert(app.includes("function updateTopbarLyricState"), "Topbar lyrics should update from playback state");
  assert(app.includes("document.body.classList.toggle(\"topbar-lyric-active\", shouldShowLyric)"), "Playing lyrics should toggle the topbar lyric state class");
  assert(/function updatePlaybackState\(\) \{[\s\S]*?updateTopbarLyricState\(\);[\s\S]*?updatePlayButtonLabels\(\);/.test(app), "Playback state updates should refresh the topbar lyric/menu mode");
  assert(app.includes("function buildTopLyricCharacterFragment"), "Topbar lyric shard effect should split lyrics into character spans");
  assert(app.includes("function triggerNextWord(index)"), "Topbar lyric shard effect should expose a triggerNextWord controller");
  assert(app.includes("function spawnTopLyricShardCanvas"), "Topbar lyric shard effect should create a canvas over the active character");
  assert(app.includes("function createTopLyricShards"), "Topbar lyric shard effect should create shard objects");
  assert(app.includes("function sampleTopLyricGlyphPoints"), "Topbar lyric shard effect should sample glyph pixels before creating shards");
  assert(app.includes('const TOP_LYRIC_SHARD_DEFAULT_COLOR = "rgba(236, 65, 65, 0.96)"'), "Topbar shard particles should use the red brand color by default");
  assert(app.includes("TOP_LYRIC_SHARD_ACCENT_COLOR"), "Topbar shard particles should include a colored accent instead of fading to plain white");
  assert(app.includes("requestAnimationFrame(updateTopLyricShardFrame)"), "Topbar lyric shard timeline should be RAF-driven");
  assert(app.includes("topLyricShardAnimationFrame"), "Topbar shard canvas animation should use one shared RAF scheduler");
  assert(app.includes("requestAnimationFrame(updateTopLyricShardEffectsFrame)"), "Topbar shard canvas animation should be RAF-driven");
  assert(!app.includes("requestAnimationFrame(() => animateTopLyricShardEffect(effect))"), "Topbar shard canvases should not each schedule their own RAF loop");
  assert(app.includes("const TOP_LYRIC_SHARD_MAX_FRAME_TRIGGERS = 1"), "Topbar shard timeline should trigger at most one character per frame");
  assert(app.includes("TOP_LYRIC_SHARD_CATCHUP_ALIGN_SECONDS"), "Topbar shard timeline should align stale catch-up characters instead of replaying a burst");
  assert(app.includes("function shouldAlignTopLyricShardCatchup"), "Topbar shard timeline should detect stale catch-up spans");
  assert(app.includes("TOP_LYRIC_SHARD_MAX_ACTIVE_EFFECTS"), "Topbar shard canvases should have a bounded active effect count");
  assert(app.includes("flash: {"), "Topbar shard effect should include a single per-character flash layer");
  assert(app.includes("function renderTopLyricShardFlash"), "Topbar shard flash should be rendered separately from particles");
  assert(/if \(options\.shard && span\.textContent\?\.trim\(\)\) \{\s*spawnTopLyricShardCanvas\(span\);/.test(app), "Topbar shard trigger should not spawn particles for whitespace");
  assert(/vx:\s*0\.48 \+ \(burst \* 0\.94\)/.test(app), "Topbar shard physics should launch particles to the right with a controlled sweep");
  assert(/vy:\s*-\(\(0\.38 \+ \(Math\.random\(\) \* 0\.68\)\)/.test(app), "Topbar shard physics should drift upward without overshooting the topbar");
  assert(app.includes("shard.vx *= TOP_LYRIC_SHARD_DRAG"), "Topbar shard physics should apply air drag");
  assert(app.includes("shard.vy += TOP_LYRIC_SHARD_GRAVITY"), "Topbar shard physics should apply gravity");
  assert(app.includes("shard.alpha -= TOP_LYRIC_SHARD_FADE"), "Topbar shard physics should fade particles out");
  assert(app.includes("function trimTopLyricShardEffects"), "Topbar shard effects should trim old canvases under dense word timing");
  assert(app.includes("effect.canvas.remove()"), "Topbar shard cleanup should remove canvases");
  assert(app.includes("topTabs?.addEventListener(\"pointerenter\", handleTopbarMenuInteractionStart)"), "Topbar menu hover should pause shard lyrics");
  assert(app.includes("prefers-reduced-motion: reduce"), "Topbar shard effect should respect reduced motion");
  assert(app.includes("function clearPlaybackCache"), "Missing playback cache clearing action");
  assert(app.includes("function takePreloadedPlaybackSession"), "Missing playback preloaded session handoff");
  assert(app.includes("externalResolveRetryTrackId"), "External source playback should track one-shot fresh resolve retries");
  assert(app.includes("state.externalResolveRetryTrackId = \"\";\n        clearPlaybackErrorState();"), "Successful playback should clear the external fresh resolve retry marker");
  assert(app.includes("forceExternalResolve: isExternalSourceTrack(state.currentTrack)"), "Restored external queue playback should force a fresh bridge resolve");
  assert(app.includes("function markRestoredQueueTrackForFreshResolve"), "Restored queue tracks should be marked for a fresh external media resolve");
  assert(/function loadRecentTracks\(session\) \{[\s\S]*?const tracks = storage\.loadRecentTracks\(session\);[\s\S]*?tracks\.forEach\(markRestoredQueueTrackForFreshResolve\);[\s\S]*?return tracks;/.test(app), "Loaded recent external tracks should be marked for a fresh external media resolve");
  assert(/function loadQueueState\(session\) \{[\s\S]*?queueState\.queue\.forEach\(markRestoredQueueTrackForFreshResolve\);[\s\S]*?markRestoredQueueTrackForFreshResolve\(queueState\.currentTrack\);/.test(app), "Loaded external queue tracks should be marked as restored cache entries");
  assert(/function shouldForceResolveExternalTrack\(track, options = \{\}, queue = \[\]\) \{[\s\S]*?restoredQueueTrack\?\._restoredQueueNeedsFreshResolve[\s\S]*?\}/.test(app), "Any restored external queue item should bypass stale inline URLs when played");
  assert(/applyExternalMediaMetadata\(track, media\);\s*clearRestoredQueueFreshResolveMarker\(track\);\s*syncExternalTrackReference\(track\);/.test(app), "Fresh external media resolution should clear the restored queue fresh-resolve marker");
  assert(/function applyExternalMediaMetadata\(track, media = \{\}, options = \{\}\) \{[\s\S]*?pluginUrl: mediaRestore\?\.pluginUrl \|\| mediaPluginMeta\.pluginUrl \|\| track\.ExternalSource\?\.pluginUrl/.test(app), "Fresh external media metadata should promote plugin restore fields for the next app restart");
  assert(/function applyExternalMediaMetadata\(track, media = \{\}, options = \{\}\) \{[\s\S]*?bridgeStreamUrl[\s\S]*?mediaUrl: bridgeStreamUrl \|\| media\.streamUrl/.test(app), "Fresh external media metadata should prefer the stable bridge stream URL");
  assert(/if \(isExternalSourceTrack\(track\)\) \{\s*saveQueueState\(getQueuePositionSeconds\(\)\);/.test(app), "Successful external playback should persist refreshed restore metadata immediately");
  assert(/function getExternalSourceApiUrlFromSession\(session\) \{[\s\S]*?return session\.externalSourceApiUrl \|\| session\.serverUrl \|\| "";/.test(app), "External source sessions should recover the bridge URL from legacy serverUrl-only sessions");
  assert(/function getSessionExternalSourceApiUrl\(session = state\.session\) \{[\s\S]*?getExternalSourceApiUrlFromSession\(session\)/.test(app), "External source API URL lookup should use the legacy-compatible session helper");
  assert(/function init\(\) \{[\s\S]*?syncExternalSourceSessionApiUrl\(state\.session\)/.test(app), "App re-entry should sync legacy external sessions to the configured source bridge URL");
  assert(/async function verifyExternalSourceSession\(session\) \{[\s\S]*?const apiUrl = syncExternalSourceSessionApiUrl\(session\)/.test(app), "External session verification should use the resolved source bridge URL");
  assert(/function sanitizeQueueTrack\(track\) \{[\s\S]*?ExternalSource: sanitizeExternalSourceForPersistence\(track\.ExternalSource, track\)/.test(app), "Persisted queue tracks should compact external source restore metadata");
  assert(app.includes("function sanitizeExternalSourceForPersistence"), "External source queue persistence should have an explicit sanitizer");
  assert(app.includes("function isRestorableExternalSourcePlugin"), "External source persistence should detect plugin-backed tracks");
  assert(/mediaUrl:\s*isRestorablePlugin \? "" : external\.mediaUrl/.test(app), "Persisted plugin source tracks should not keep stale media URLs");
  assert(/bridgeStreamUrl:\s*""/.test(app), "Persisted plugin source tracks should not keep stale bridge stream URLs");
  assert(/directUrl:\s*""/.test(app), "Persisted plugin source tracks should not keep stale direct URLs");
  assert(/function getExternalSourceRawForPersistence\(raw, restore\) \{[\s\S]*?pluginKey: restore\.pluginKey[\s\S]*?raw: restore\.raw/.test(app), "External source persistence should keep a restorable raw plugin snapshot");
  assert(/function sanitizeExternalSourceForPersistence\(external, track = null\) \{[\s\S]*?pluginUrl: restore\?\.pluginUrl \|\| external\.pluginUrl/.test(app), "Persisted external source state should keep plugin URL restore metadata");
  assert(app.includes("function createExternalRestoreSnapshotForPersistence"), "External source persistence should rebuild a restore snapshot from plugin metadata");
  assert(app.includes("function getExternalPluginRestoreRawForPersistence"), "External source persistence should recover the original plugin raw track from media responses");
  assert(app.includes("stripExternalTrackPrefixForPersistence(track?.Id)"), "External source persistence should infer plugin ids from restored queue track ids");
  assert(/function looksLikeMediaPayloadOnlyForPersistence\(value\) \{[\s\S]*?const playableUrl[\s\S]*?const trackText[\s\S]*?!trackText/.test(app), "External source persistence should reject media-only playback responses even when they carry ids");
  assert(storageCode.includes("source-bridge://external-source"), "External source storage should use a stable queue/account key across bridge URL changes");
  assert(storageCode.includes("function getExternalQueueStateFallbackKeys"), "External source storage should read legacy bridge queue keys after re-entry");
  assert(storageCode.includes('"source-bridge://unconfigured"'), "External source storage should migrate old unconfigured bridge queues");
  assert(/takePreloadedPlaybackSession\(track, mode, playbackOptions\) \|\| await preparePlaybackSession\(track, mode, requestId, playbackOptions\)/.test(app), "Forced external media refresh should not be bypassed by a stale preloaded session");
  assert(/function takePreloadedPlaybackSession\(track, mode, options = \{\}\) \{[\s\S]*?if \(options\.forceExternalResolve\) \{[\s\S]*?clearPreload\(\);[\s\S]*?return null;/.test(app), "Preloaded sessions should be cleared and ignored during forced external media refreshes");
  assert(/function togglePlayback\(\) \{[\s\S]*?!audioPlayer\.src[\s\S]*?forceExternalResolve: isExternalSourceTrack\(state\.currentTrack\)/.test(app), "Player resume without an audio src should refresh external source media URLs");
  assert(app.includes("function shouldReloadExternalPlaybackBeforeResume"), "External source resume should detect stale direct playback sources");
  assert(/function togglePlayback\(\) \{[\s\S]*?shouldReloadExternalPlaybackBeforeResume\(state\.currentTrack\)[\s\S]*?forceExternalResolve: true/.test(app), "Paused external source playback should refresh stale sources before native resume");
  assert(/function handleResumePlayError\(error\) \{[\s\S]*?retryExternalPlaybackWithFreshMedia\(track, "恢复播放失败，正在重新解析音源\.\.\."\)/.test(app), "External source resume failures should retry with a fresh bridge media URL");
  assert(/function resumeBlockedPlayback\(track, requestId = state\.playRequestId\) \{[\s\S]*?!track \|\| !audioPlayer\.src[\s\S]*?forceExternalResolve: isExternalSourceTrack\(track \|\| state\.currentTrack\)/.test(app), "Autoplay resume reloads should refresh external source media URLs");
  assert(/function retryExternalPlaybackWithFreshMedia\(track = state\.currentTrack, reason = ""\) \{[\s\S]*?state\.externalResolveRetryTrackId === track\.Id[\s\S]*?forceExternalResolve: true/.test(app), "External source playback errors should retry once with a fresh bridge media URL");
  assert(/function handleAudioElementError\(\) \{[\s\S]*?retryExternalPlaybackWithFreshMedia\(state\.currentTrack\)/.test(app), "Audio element errors should auto-refresh external source media URLs");
  assert(/function retryWithOppositePlaybackMode\(track\) \{[\s\S]*?isExternalSourceTrack\(track\)[\s\S]*?forceExternalResolve: true/.test(app), "External source manual reparse should bypass stale cached media URLs");
  assert(app.includes("function getExternalTrackApiUrl"), "External source playback should centralize restored track bridge URL resolution");
  assert(/function getExternalTrackApiUrl\(track, session = state\.session\) \{[\s\S]*?const sessionApiUrl = getSessionExternalSourceApiUrl\(session\)[\s\S]*?loadExternalSourceApiUrl\(\);[\s\S]*?if \(sessionApiUrl\) \{[\s\S]*?return sessionApiUrl;[\s\S]*?const trackApiUrl = track\?\.ExternalSource\?\.apiUrl;/.test(app), "Restored external tracks should prefer the current bridge session URL over stale per-track URLs");
  assert(/fetchLyricsText\(track\)[\s\S]*?const apiUrl = getExternalTrackApiUrl\(track\)/.test(app), "External lyrics should use the current bridge URL after app re-entry");
  assert(/preparePlaybackSession\(track, mode, requestId, options = \{\}\)[\s\S]*?fetchMediaSource\(getExternalTrackApiUrl\(track\), track/.test(app), "External playback should use the current bridge URL after app re-entry");
  assert(/testExternalPlaybackChain\(track\)[\s\S]*?fetchMediaSource\(getExternalTrackApiUrl\(track\), track/.test(app), "External playback tests should use the current bridge URL after app re-entry");
  assert(/getExternalTrackQualityResolveKey\(track\)[\s\S]*?const apiUrl = getExternalTrackApiUrl\(track\)/.test(app), "External quality probing should use the current bridge URL after app re-entry");
  assert(/resolveExternalSearchTrackQuality\(track, token\)[\s\S]*?const apiUrl = getExternalTrackApiUrl\(track\)/.test(app), "External search quality resolution should use the current bridge URL after app re-entry");
  assert(!app.includes("track.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl()"), "Restored external tracks should not prefer stale per-track bridge URLs");
  assert(externalSourceCode.includes("function hasExternalPluginSnapshotIdentity"), "External source snapshots should allow plugin URL/name fallback when plugin key changes");
  assert(sourceBridge.includes("function createRuntimePluginFromSnapshot"), "Source bridge should restore plugin tracks from persisted plugin URLs without requiring a fresh search");
  assert(/function restorePluginTrackFromSnapshot\(url, id\) \{[\s\S]*?hasPluginSnapshotIdentity\(snapshot\)/.test(sourceBridge), "Source bridge snapshot restore should accept plugin URL/name identity, not only plugin key");
  assert(/function getPluginForSnapshot\(snapshot\) \{[\s\S]*?createRuntimePluginFromSnapshot\(snapshot\)/.test(sourceBridge), "Source bridge should create a runtime plugin from a persisted snapshot if the manifest key changed");
  assert(/function createRuntimePluginFromSnapshot\(snapshot\) \{[\s\S]*?state\.plugins\.push\(plugin\);[\s\S]*?return plugin;/.test(sourceBridge), "Runtime restored plugins should be registered before resolving media");
  assert(app.includes("External fresh resolve retry:"), "Diagnostics should include external fresh resolve retry state");
  assert(app.includes("precachePlaybackSource(source, nextTrack)"), "Next-track source should be eligible for precache");
  assert(app.includes("SHUFFLE_HISTORY_LIMIT"), "Shuffle playback should cap in-memory history");
  assert(app.includes("shuffleHistory: []"), "Shuffle playback should keep an in-memory previous-track history");
  assert(app.includes("shuffleUpcomingIds: []"), "Shuffle playback should keep a stable upcoming random pool");
  assert(app.includes("function resetShufflePlaybackState"), "Shuffle playback state should have an explicit reset helper");
  assert(app.includes("function pruneShufflePlaybackState"), "Shuffle playback history should be pruned when queue membership changes");
  assert(app.includes("function rememberShuffleHistory"), "Shuffle playback should remember real previous tracks");
  assert(app.includes("function takeShuffleHistoryTrack"), "Shuffle previous should pop from real playback history");
  assert(app.includes("function getNextShuffleTrackId"), "Shuffle next should use a stable upcoming track id");
  assert(app.includes("function prioritizeShuffleUpcomingTracks"), "Manual play-next actions should override shuffle upcoming order");
  assert(app.includes("function syncShufflePlaybackStateForTrackChange"), "Track changes should synchronize shuffle history and upcoming state");
  assert(/function playPrevious\(\) \{[\s\S]*?state\.playMode === "shuffle"[\s\S]*?takeShuffleHistoryTrack\(\)[\s\S]*?playTrack\(previousTrack, state\.queue, \{ fromShuffleHistory: true \}\);/.test(app), "Shuffle previous should return to the real previous random track");
  assert(/function getNextQueueIndex\(direction, fromEnded\) \{[\s\S]*?state\.playMode === "shuffle"[\s\S]*?getNextShuffleTrackId\(\)/.test(app), "Shuffle next should consume the stable upcoming random track");
  assert(/function getNextPreviewTrack\(\) \{[\s\S]*?state\.playMode === "shuffle"[\s\S]*?getQueueTrackById\(getNextShuffleTrackId\(\)\)/.test(app), "Next-track preview should show the same shuffle candidate that next will play");
  assert(/function getUpcomingTracks\(limit\) \{[\s\S]*?state\.playMode === "shuffle"[\s\S]*?refillShuffleUpcomingQueue\(Math\.min\(limit, state\.queue\.length - 1\)\)/.test(app), "Up-next list should reflect the stable shuffle upcoming pool");
  assert(/function getPreloadCandidateTrack\(\) \{\s*return getNextPreviewTrack\(\);\s*\}/.test(app), "Preload should follow the same next-track preview candidate");
  assert(/function addTrackToPlayNext\(track\) \{[\s\S]*?prioritizeShuffleUpcomingTracks\(\[queuedTrack\.Id\]\)/.test(app), "Single play-next action should take priority in shuffle mode");
  assert(/function playTrackCollectionNext\(tracks, label\) \{[\s\S]*?prioritizeShuffleUpcomingTracks\(nextIds\)/.test(app), "Collection play-next action should take priority in shuffle mode");
  assert(/function createQueueUndoSnapshot\(reason\) \{[\s\S]*?shuffleHistory: \[\.\.\.state\.shuffleHistory\][\s\S]*?shuffleUpcomingIds: \[\.\.\.state\.shuffleUpcomingIds\]/.test(app), "Queue undo snapshots should preserve shuffle history state");
  assert(app.includes("function createHomeTrackRow"), "Home track rows should use the redesigned list renderer");
  assert(app.includes("home-track-equalizer"), "Home track rows should render an equalizer indicator");
  assert(app.includes("home-track-favorite-button"), "Home track rows should expose the refined favorite action");
  assert(app.includes("createActionIcon(\"heart\")"), "Favorite buttons should render a line SVG heart");
  assert(app.includes("function updateAlbumAmbientColor"), "Playback should update album-aware ambient colors");
  assert(app.includes("function extractImageAverageRgb"), "Album art colors should be sampled with canvas");
  assert(app.includes("--album-ambient-rgb-alt"), "Album ambient system should expose two sampled colors");
  assert(app.includes("function getTrackQualityTier"), "Track quality badges should use tiered classification");
  assert(app.includes("return \"master\""), "Track quality badges should classify master-quality audio");
  assert(app.includes("homeTrackSkeletonMarkup"), "Home track lists should render skeleton rows while loading");
  assert(app.includes("updateHomeTrackRippleOrigin"), "Home track rows should bind ripple origin to pointer position");

  const index = read("index.html");
  assert(index.includes("mobilePlayerMoreButton"), "Missing mobile player more button");
  assert(index.includes("id=\"topLyricFocus\""), "Topbar should include a lyric display layer");
  assert(index.includes("id=\"topLyricCurrent\""), "Topbar lyric display should include the translated/current lyric line");
  assert(index.includes("action-sheet-grabber"), "Missing mobile action sheet grabber");
  assert(index.includes("aria-describedby=\"trackActionSheetSubtitle\""), "Action sheet should expose subtitle to assistive tech");
  assert(index.includes("Recommended action:"), "Fallback diagnostics should include a recommended action");
  assert(index.includes("Main app error:"), "Fallback diagnostics should expose the app init error");
  assert(index.includes("id=\"playbackPreloadToggle\""), "Settings should include playback preload toggle");
  assert(index.includes("id=\"playbackLosslessPrecacheToggle\""), "Settings should include lossless precache toggle");
  assert(index.includes("id=\"settingsClearPlaybackCacheButton\""), "Settings should include playback cache clearing action");
  assert(index.indexOf("./app.js?v=") < index.indexOf("hls.min.js"), "External hls.js should load after the main app script");
  assert(index.includes("hls.min.js\" async"), "External hls.js should not block main app initialization");
  assert(index.indexOf("class=\"account-menu-profile\"") < index.indexOf("id=\"connectionBadge\""), "Account menu status badge should live in the top heading");
  assert(index.includes("class=\"hero-side\""), "Home dashboard stats should live inside the hero side region");
  assert(index.includes("server-card stat-connection"), "Home server summary should be merged into the dashboard stats grid");
  assert(index.includes("stat-playlists"), "Home dashboard stats should expose colored stat icon classes");
  assert(index.includes("class=\"home-start-panel smart-playback-hub\""), "Home start panel should use the fused smart playback hub");
  assert(index.includes("id=\"homeStartArtButton\""), "Smart playback hub artwork should be a clickable immersive entry");
  assert(index.includes("homeStartCover"), "Smart playback hub should render dynamic artwork");
  assert(index.includes("home-start-tonearm"), "Smart playback hub should render the floating tonearm");
  assert(index.includes("homeStartNextTitle"), "Smart playback hub should render next track preview");
  assert(!index.includes("id=\"homeResumeSection\""), "Old standalone resume queue section should be removed from the home page");
  assert(!index.includes("home-start-spindle"), "Smart playback hub should not render the old turntable base spindle");

  const css = read("styles.css");
  const config = read("src/config.js");
  const storage = read("src/storage.js");
  assert(config.includes("PLAYBACK_PRELOAD_KEY"), "Config should include playback preload preference key");
  assert(config.includes("PLAYBACK_LOSSLESS_PRECACHE_KEY"), "Config should include lossless precache preference key");
  assert(storage.includes("loadPlaybackPreloadEnabled"), "Storage should load playback preload preference");
  assert(storage.includes("savePlaybackLosslessPrecacheEnabled"), "Storage should save lossless precache preference");
  assert(css.includes("scrollbar-width: none !important"), "Global scrollbars should be hidden while preserving scrolling");
  assert(css.includes("*::-webkit-scrollbar"), "WebKit scrollbars should be hidden globally");
  assert(css.includes("@keyframes homeEqualizerBounce"), "Home track list should animate the active equalizer");
  assert(css.includes("@keyframes homeHeartBeat"), "Home track favorite action should have a click heartbeat");
  assert(css.includes("@keyframes jellyBounce"), "Home track actions should use spring-like jelly feedback");
  assert(css.includes("@keyframes glowPulse"), "Active home track rows should have ambient glow pulse");
  assert(css.includes("@keyframes shimmer"), "Home track skeletons should use shimmer loading");
  assert(css.includes("transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"), "Track row hover should use the premium light motion curve");
  assert(css.includes("box-shadow: 0 12px 30px rgba(var(--accent-color-rgb), 0.04)"), "Track row hover should use the original light integrated shadow");
  assert(/\.track-row::after,\s*\.queue-track-row::after,\s*\.library-track-row::after[\s\S]*?display: none;[\s\S]*?content: none;/.test(css), "Full queue and library rows should keep the restored non-ripple hover layer");
  assert(getCssRule(css, ".track-row:hover,").includes("transform: none"), "Track row hover should not lift rows away from the list rhythm");
  assert(getCssRule(css, ".queue-track-row.playing::after,").includes("display: none"), "Active queue/library rows should keep the restored non-ripple hover layer");
  assert(css.includes("backdrop-filter: blur(120px) opacity(6%)"), "Album-aware ambient light should use large blurred glow");
  assert(css.includes("transition: all 1.2s cubic-bezier(0.25, 1, 0.5, 1)"), "Album ambient light should transition smoothly on track changes");
  assert(css.includes("background: var(--accent-color, #ff2f3d)"), "Home equalizer should stay bound to the red theme accent fallback");
  assert(css.includes("0 8px 24px rgba(var(--accent-color-rgb), 0.06)"), "Active home track rows should glow from accent color");
  assert(css.includes(".track-quality-badge.quality-master"), "Master quality badge styles are missing");
  assert(css.includes(".track-quality-badge.quality-hires"), "Hi-res quality badge styles are missing");
  assert(css.includes(".track-quality-badge.quality-standard"), "Standard quality badge styles are missing");
  assert(css.includes(".home-track-skeleton-row"), "Home track skeleton row styles are missing");
  assert(css.includes("content-visibility: auto"), "Artwork should opt into content visibility for smoother loading");
  assert(css.includes(".home-track-row:hover"), "Home track rows should have hover movement and background feedback");
  assert(css.includes(".home-track-actions .line-icon"), "Home track actions should use fine line icons");
  assert(app.includes("queue-track-row"), "Full queue rows should get refined queue styling hooks");
  assert(app.includes("library-track-row"), "All non-home song lists should get refined track row styling hooks");
  assert(app.includes("quick-queue-item") && app.includes("updateHomeTrackRippleOrigin"), "Quick queue rows should bind pointer ripple origin");
  assert(app.includes("immersive-queue-item") && app.includes("updateHomeTrackRippleOrigin"), "Immersive queue rows should bind pointer ripple origin");
  assert(css.includes(".queue-track-row") && css.includes(".library-track-row"), "Full queue and library rows should keep refined list styling hooks");
  assert(css.includes(".quick-queue-item::after"), "Quick queue items should have pointer-origin ripple");
  assert(css.includes(".immersive-queue-item::after"), "Immersive queue items should have pointer-origin ripple");
  assert(css.includes("--mobile-bottom-control-stack"), "Mobile overlays should share a bottom control stack offset");
  assert(css.includes("bottom: calc(var(--mobile-bottom-control-stack)"), "Mobile queue/video overlays should avoid the player and bottom navigation");
  assert(css.includes("calc(100dvh - var(--mobile-bottom-control-stack)"), "Mobile queue overlay height should use dynamic viewport space above controls");
  assert(!css.includes("bottom: 8.8rem"), "Mobile quick queue should not use a fixed bottom offset");
  assert(!css.includes("bottom: 8rem"), "Mobile quick queue should not use a fixed compact bottom offset");
  assert(!css.includes("bottom: 8.25rem"), "Mobile floating video should not use a fixed bottom offset");
  assert(css.includes(".queue-track-row.playing"), "Full queue active rows should share accent glow styling");
  assert(css.includes(".library-track-row.playing"), "All song list active rows should share accent glow styling");
  assert(css.includes(".quick-queue-action:not(:disabled):active"), "Quick queue actions should have spring click feedback");
  assert(css.includes(".immersive-queue-tools button:active:not(:disabled)"), "Immersive queue tools should have spring click feedback");
  assert(css.includes("#homeRecentSection .section-actions .text-button::before"), "Home section action buttons should include quiet line icons");
  assert(css.includes("body.action-sheet-open .content"), "Action sheet should lock background scrolling");
  assert(css.includes(".action-sheet-copy small"), "Action sheet details should have mobile-friendly styling");
  assert(css.includes("max-height: min(62dvh, calc(100dvh - 10.5rem))"), "Mobile search suggestions should use a bounded viewport panel");
  assert(css.includes(".search-suggest-action .line-icon"), "Mobile search suggestion actions should remain visible and sized");
  assert(css.includes(".hero-side"), "Home hero side layout styles are missing");
  assert(css.includes("grid-template-columns: repeat(4, minmax(5.15rem, 1fr))"), "Home stat cards should use a compact two-row desktop grid");
  assert(css.includes(".server-card small"), "Home server URL should have compact card text styling");
  assert(css.includes(".stat-playlists .stat-icon"), "Home stat cards should use colored stat icon variants");
  assert(css.includes(".home-start-control"), "Smart playback hub control layout styles are missing");
  assert(css.includes(".home-start-art:focus-visible"), "Smart playback hub artwork button should expose a focus style");
  assert(index.includes("class=\"home-start-media\""), "Smart playback hub should group turntable and text in a left media region");
  assert(css.includes(".home-start-media"), "Smart playback hub left media region styles are missing");
  assert(css.includes(".home-start-waveform"), "Smart playback hub waveform progress styles are missing");
  assert(index.includes("id=\"homeStartTimeText\""), "Smart playback hub should render compact progress time");
  assert(index.includes("id=\"homeStartFavoriteButton\""), "Smart playback hub should expose a compact favorite action");
  assert(index.includes("id=\"homeStartMoreButton\""), "Smart playback hub should expose a compact more action");
  assert(css.includes(".home-start-action {"), "Smart playback hub buttons should use a dedicated capsule action style");
  assert(css.includes("@keyframes hubMarquee"), "Smart playback hub marquee animation is missing");
  assert(css.includes("@keyframes hubRipple"), "Smart playback hub ripple animation is missing");
  assert(css.includes("@keyframes hubAlbumSpin"), "Smart playback hub album spin animation is missing");
  assert(css.includes(".is-audio-playing .home-start-vinyl::before"), "Smart playback hub vinyl should animate while playing");
  assert(css.includes(".is-audio-playing .home-start-cover"), "Smart playback hub album artwork should animate while playing");
  assert(css.includes(".home-start-tonearm"), "Smart playback hub floating tonearm styles are missing");
  assert(css.includes(".tonearm-arm"), "Smart playback hub tonearm should render a structured SVG arm");
  assert(index.includes("viewBox=\"0 0 104 78\""), "Smart playback hub tonearm needs enough canvas to park outside the record");
  assert(index.includes("cx=\"88\" cy=\"18\""), "Smart playback hub tonearm pivot should sit outside the record");
  assert(css.includes("transform-origin: 88px 18px"), "Smart playback hub tonearm should rotate from the external pivot");
  assert(css.includes("transform: rotate(-24deg)"), "Smart playback hub tonearm should park off the record when paused");
  assert(css.includes(".is-audio-playing .tonearm-arm"), "Smart playback hub tonearm should react to playing state");
  assert(css.includes("transform: rotate(20deg)"), "Smart playback hub tonearm should drop near the album art while playing");
  assert(!css.includes(".home-start-spindle"), "Smart playback hub should not keep old spindle styles");

  assert(app.includes("homeStartArtButton?.addEventListener(\"click\", openMobileImmersivePlayer)"), "Smart playback hub artwork should open immersive playback");
  assert(app.includes("homeStartFavoriteButton?.addEventListener(\"click\", () => toggleFavorite(state.currentTrack))"), "Smart playback hub favorite action should reuse current track favorite logic");
  assert(app.includes("homeStartMoreButton?.addEventListener(\"click\", openMobilePlayerActions)"), "Smart playback hub more action should reuse playback action sheet");
  assert(app.includes("if (homeStartArtButton)"), "Smart playback hub artwork rendering should tolerate older cached markup");
  assert(app.includes("homeStartArtButton.disabled = !state.currentTrack"), "Smart playback hub artwork should be disabled without a current track");
  assert(app.includes("settingsClearPlaybackCacheButton?.addEventListener"), "New settings cache action should tolerate older cached markup");
  assert(app.includes("playbackPreloadToggle?.addEventListener"), "Playback preload setting should tolerate older cached markup");
  assert(app.includes("if (settingsPlaybackPreload)"), "Playback preload status rendering should tolerate older cached markup");
  assert(app.includes("storage.loadPlaybackPreloadEnabled?.() ?? true"), "Playback preload preference should tolerate older cached storage helpers");
  assert(app.includes("storage.savePlaybackLosslessPrecacheEnabled?.("), "Lossless precache persistence should tolerate older cached storage helpers");
  assert(app.includes("removeButton.append(createActionIcon(\"trash\"))"), "Account menu saved account removal should use a line trash icon");
  assert(css.includes("box-shadow: 0 12px 32px rgba(0, 0, 0, 0.05)"), "Account menu should use the refined light shadow");
  assert(css.includes(".account-menu-actions .action-sheet-icon"), "Account menu should locally normalize action icons");
  assert(css.includes("grid-template-columns: 1.5rem minmax(0, 1fr)"), "Account menu action rows should use a fixed icon column");
  assert(css.includes(".account-menu-card .account-menu-actions svg.line-icon"), "Account menu line icons should be normalized independently of global icon colors");
  assert(css.includes("justify-items: start"), "Account menu icons should align to the left edge of the fixed icon column");
  assert(css.includes(".account-menu-profile > span"), "Account menu avatar should keep its own aligned profile icon box");
  assert(!index.includes("account-menu-profile\">\n                  <span id=\"accountMenuAvatar\">\n                    <svg class=\"line-icon icon-user\""), "Account menu avatar should not use global colored icon classes");
  assert(!index.includes("account-menu-actions") || !/account-menu-actions[\\s\\S]*?svg class=\"line-icon icon-(refresh|settings|server|user|logout)\"/.test(index), "Account menu action icons should not use global colored icon classes");
  assert(css.includes("background: transparent;\n  color: #4b5563"), "Account menu action icons should not keep gray icon discs");
  assert(css.includes(".account-menu-actions .action-sheet-item.danger:hover"), "Account menu danger row should have a dedicated hover state");
  assert(css.includes("background: rgba(254, 242, 242, 0.4)"), "Account menu danger hover should use a subtle red tint");
}

function checkDomReferences() {
  const app = read("app.js");
  const index = read("index.html");
  const browserSmoke = read("scripts/browser-smoke.js");
  const ids = new Set([...index.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const referencedIds = new Set([...app.matchAll(/document\.querySelector\(\s*"#([^"]+)"\s*\)/g)].map((match) => match[1]));
  const missingIds = [...referencedIds].filter((id) => !ids.has(id)).sort();
  const browserSmokeIds = new Set([...browserSmoke.matchAll(/querySelector\(\s*["'`]#([A-Za-z][\w:-]*)["'`]\s*\)/g)].map((match) => match[1]));
  const missingBrowserSmokeIds = [...browserSmokeIds].filter((id) => !ids.has(id)).sort();

  assert(!missingIds.length, `app.js references missing index.html id(s): ${missingIds.map((id) => `#${id}`).join(", ")}`);
  assert(!missingBrowserSmokeIds.length, `browser-smoke.js references missing index.html id(s): ${missingBrowserSmokeIds.map((id) => `#${id}`).join(", ")}`);

  [
    "aria-controls",
    "aria-labelledby",
    "aria-describedby",
    "for",
  ].forEach((attribute) => {
    const missingAttributeIds = findMissingHtmlIdReferences(index, ids, attribute);
    assert(
      !missingAttributeIds.length,
      `index.html ${attribute} references missing id(s): ${missingAttributeIds.map((id) => `#${id}`).join(", ")}`
    );
  });
}

function findMissingHtmlIdReferences(html, ids, attribute) {
  const references = new Set();
  const pattern = new RegExp(`\\b${attribute}="([^"]+)"`, "g");

  [...html.matchAll(pattern)].forEach((match) => {
    String(match[1] || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((id) => references.add(id));
  });

  return [...references].filter((id) => !ids.has(id)).sort();
}

async function main() {
  checkVersions();
  checkCss();
  checkLyrics();
  await checkExternalSourceLyrics();
  checkStorageQueuePersistence();
  checkAppFunctionReferences();
  checkDomReferences();

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("smoke-check ok");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
