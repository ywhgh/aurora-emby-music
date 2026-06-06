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
  assert(browserSmoke.includes("EXPECTED_VERSION_LABEL"), "Browser smoke should derive the expected version label from package.json");
  assert(browserSmoke.includes("PROFILE_CLEANUP_BUDGET_MS"), "Browser smoke profile cleanup should have a bounded time budget");
  assert(browserSmoke.includes("OLD_PROFILE_CLEANUP_LIMIT"), "Browser smoke should limit old profile cleanup work per run");
  assert(browserSmoke.includes("BROWSER_SMOKE_OLD_PROFILE_CLEANUP_LIMIT || 0"), "Browser smoke should skip old profile cleanup by default on Windows");
  assert(browserSmoke.includes("if (OLD_PROFILE_CLEANUP_LIMIT <= 0)"), "Browser smoke should make old profile cleanup opt-in");
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
}

function checkLyrics() {
  const lyricsCode = read("src/lyrics.js");
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

  const app = read("app.js");
  assert(app.includes("function appendLyricLineContent"), "Missing shared lyric line renderer");
  assert(app.includes("renderNowLyricFocusLine"), "Missing now lyric focus renderer");
  assert(app.includes("renderImmersiveLyricFocus"), "Missing immersive lyric renderer");
  assert(app.includes("immersive-lyric-original"), "Immersive lyric renderer does not render original text");
  assert(app.includes("immersive-lyric-translated"), "Immersive lyric renderer does not render translated text");
  assert(app.includes("function updateLyricProgressFrame"), "Immersive word lyrics should use an animation-frame progress loop");
  assert(app.includes("requestAnimationFrame(updateLyricProgressFrame)"), "Lyric word progress loop should be driven by requestAnimationFrame");
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
  assert(!/function resetPlayerMeta\(\) \{[\s\S]*?progressFill\.style\.width = "0";/.test(app), "Player reset should reuse cached progress rendering instead of direct progress DOM writes");
  assert(app.includes("activeTrackRowsCacheValid"), "Track-row fluid animation should cache active rows instead of querying every frame");
  assert(app.includes("function refreshActiveTrackRowsCache"), "Track-row fluid animation should have an explicit active-row cache refresh");
  assert(!/function getActiveTrackRows\(\) \{[\s\S]*?document\.querySelectorAll\("\.track-row\.active"\)/.test(app), "Track-row fluid animation should not query all active rows on every animation frame");
  assert(app.includes("function setLyricWordProgress"), "Lyric word progress should avoid redundant DOM writes");
  assert(app.includes("LYRIC_PROGRESS_EPSILON"), "Lyric word progress should be diffed before style updates");
  assert(app.includes("function updateLyricWordProgressWindow"), "Lyric word progress should update only the changed word window");
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
  assert(/function handleAudioSeeked\(\) \{[\s\S]*?updateProgress\(\{ syncLyrics: false \}\);[\s\S]*?state\.activeLyricTimelineIndex = -1;[\s\S]*?updateLyricsHighlight\(getAudioCurrentTimeSeconds\(\), true\);/.test(app), "Audio seeks should reset lyric timeline cache and force-refresh lyric highlights without double-rendering");
  assert(/function updateProgress\(options = \{\}\) \{[\s\S]*?const shouldSyncLyrics = options\.syncLyrics !== false;[\s\S]*?if \(shouldSyncLyrics\) \{\s*updateLyricsHighlight\(current\);/.test(app), "Progress updates should allow seeked handlers to skip the regular lyric sync pass");
  assert(!app.includes("state.lyricTimeline.findIndex"), "Lyric progress should not search the timeline every frame");
  assert(app.includes("function renderStaticLyricFocusIfNeeded"), "Static lyric views should skip redundant playback-time renders");
  assert(app.includes("lastStaticLyricRenderSignature"), "Static lyric views should cache their rendered state");
  assert(app.includes("lyricRenderRevision"), "Static lyric render cache should be invalidated by lyric revisions");
  assert(app.includes("function invalidateLyricRenderState"), "Lyric render cache should have an explicit invalidation helper");
  assert((app.match(/invalidateLyricRenderState\(\);/g) || []).length >= 4, "Lyric load/status changes should invalidate static lyric renders");
  assert(/if \(!state\.isLyricSynced \|\| !state\.lyricTimeline\.length\) \{\s*stopLyricProgressLoop\(\);\s*renderStaticLyricFocusIfNeeded\(\);\s*return;/m.test(app), "Unsynced lyric updates should not rebuild lyric DOM on every tick");
  assert(app.includes("function getNextLyricTimelineEntry"), "Lyric word progress should reuse the lyric timeline for next-line timing");
  assert(!/state\.lyricLines\s*\.\s*slice\(activeIndex \+ 1\)\s*\.\s*find/.test(app), "Lyric word progress should not allocate slices on every frame");
  assert(/const start = Number\(currentLine\?\.time\);[\s\S]*?if \(!Number\.isFinite\(start\)\) \{[\s\S]*?updateLyricWordProgressWindow\(words, words\.length\);[\s\S]*?return;[\s\S]*?const fallbackEnd = start \+/.test(app), "Lyric word progress should explicitly handle synced lines without finite timing");
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
    /renderImmersiveLyricFocus\(\);\s*updateLyricsHighlight\(audioPlayer\.currentTime \|\| 0, true\);/.test(app),
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
}

function checkAppFunctionReferences() {
  const app = read("app.js");
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
  assert(app.includes("Playback recovery visible:"), "Diagnostics should include playback recovery visibility");
  assert(app.includes("window.EmbyMusicAppReady = true"), "Main app should mark itself ready after initialization");
  assert(app.includes("window.EmbyMusicAppError = readableError(error)"), "Main app should expose initialization errors to fallback diagnostics");
  assert(!app.includes("window.EmbyMusicAppReady = true;\n  syncLoginActionButtons();"), "Login event binding must not mark a failed init as app-ready");
  assert(app.includes("const AUTO_DISMISS_NOTICE_MS = 1800"), "Actionless notices should auto-hide within 1-2 seconds");
  assert(app.includes("const AUTO_DISMISS_STATUS_MS = 1800"), "Transient status messages should auto-hide within 1-2 seconds");
  assert(app.includes("window.addEventListener(\"emby-music-hls-ready\", handleHlsReady)"), "hls.js loading should refresh playback capability without blocking init");
  assert(app.includes("function clearPlaybackCache"), "Missing playback cache clearing action");
  assert(app.includes("function takePreloadedPlaybackSession"), "Missing playback preloaded session handoff");
  assert(app.includes("precachePlaybackSource(source, nextTrack)"), "Next-track source should be eligible for precache");
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

function main() {
  checkVersions();
  checkCss();
  checkLyrics();
  checkAppFunctionReferences();
  checkDomReferences();

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("smoke-check ok");
}

main();
