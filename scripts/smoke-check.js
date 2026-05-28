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

function main() {
  checkVersions();
  checkCss();
  checkLyrics();

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("smoke-check ok");
}

main();
