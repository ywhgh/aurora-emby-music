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

function checkVersions() {
  const index = read("index.html");
  const config = read("src/config.js");
  const sw = read("sw.js");
  const packageJson = JSON.parse(read("package.json"));
  const appVersion = extract(/APP_VERSION:\s*"([^"]+)"/, config, "APP_VERSION");
  const cacheVersion = extract(/CACHE_NAME\s*=\s*"emby-music-web-v([^"]+)"/, sw, "service worker cache version");
  const assetVersion = extract(/ASSET_VERSION\s*=\s*"([^"]+)"/, sw, "service worker asset version");

  assert(appVersion === cacheVersion, `APP_VERSION ${appVersion} != CACHE_NAME ${cacheVersion}`);
  assert(appVersion === assetVersion, `APP_VERSION ${appVersion} != ASSET_VERSION ${assetVersion}`);
  assert(appVersion === packageJson.version, `APP_VERSION ${appVersion} != package.json ${packageJson.version}`);

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

  const index = read("index.html");
  assert(index.includes("mobilePlayerMoreButton"), "Missing mobile player more button");
  assert(index.includes("action-sheet-grabber"), "Missing mobile action sheet grabber");
  assert(index.includes("aria-describedby=\"trackActionSheetSubtitle\""), "Action sheet should expose subtitle to assistive tech");
  assert(index.includes("Recommended action:"), "Fallback diagnostics should include a recommended action");
  assert(index.includes("class=\"hero-side\""), "Home dashboard stats should live inside the hero side region");
  assert(index.includes("server-card stat-connection"), "Home server summary should be merged into the dashboard stats grid");
  assert(index.includes("stat-playlists"), "Home dashboard stats should expose colored stat icon classes");

  const css = read("styles.css");
  assert(css.includes("body.action-sheet-open .content"), "Action sheet should lock background scrolling");
  assert(css.includes(".action-sheet-copy small"), "Action sheet details should have mobile-friendly styling");
  assert(css.includes("max-height: min(62dvh, calc(100dvh - 10.5rem))"), "Mobile search suggestions should use a bounded viewport panel");
  assert(css.includes(".search-suggest-action .line-icon"), "Mobile search suggestion actions should remain visible and sized");
  assert(css.includes(".hero-side"), "Home hero side layout styles are missing");
  assert(css.includes("grid-template-columns: repeat(4, minmax(5.15rem, 1fr))"), "Home stat cards should use a compact two-row desktop grid");
  assert(css.includes(".server-card small"), "Home server URL should have compact card text styling");
  assert(css.includes(".stat-playlists .stat-icon"), "Home stat cards should use colored stat icon variants");
}

function main() {
  checkVersions();
  checkCss();
  checkLyrics();
  checkAppFunctionReferences();

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("smoke-check ok");
}

main();
