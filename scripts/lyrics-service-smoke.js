#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  classifyLyricLanguage,
  createLyricsService,
  createTranslationProvider,
  hasBilingualLrc,
  mergeBilingualLrc,
  normalizeMetadata,
  scoreLyricCandidate,
  scoreMetadataCandidate,
} = require("./lyrics-service.js");

const ORIGINAL = ["[00:01.000]Hello world", "[00:02.000]Stay with me", "[00:03.000]Good night"].join("\n");
const CHINESE = ["[00:01.000]你好，世界", "[00:02.000]陪着我", "[00:03.000]晚安"].join("\n");

async function main() {
  const exact = mergeBilingualLrc(ORIGINAL, CHINESE);
  assert(hasBilingualLrc(exact), "same-timestamp bilingual lines should merge");
  assert(exact.indexOf("Hello world") < exact.indexOf("你好，世界"), "foreign original should precede Chinese translation");

  const close = mergeBilingualLrc(ORIGINAL, CHINESE.replaceAll(".000]", ".050]"));
  assert(hasBilingualLrc(close), "0.05-second bilingual lines should merge");
  const far = mergeBilingualLrc(ORIGINAL, CHINESE.replaceAll(".000]", ".090]"));
  assert(!far, "lines farther than 0.08 seconds should stay separate");

  assert(classifyLyricLanguage("今日は君と歩く") === "ja", "Japanese kanji plus kana should be Japanese");
  assert(classifyLyricLanguage("오늘도 너와 함께") === "ko", "Hangul should be Korean");
  assert(classifyLyricLanguage("今天和你一起走") === "zh", "Chinese text should be Chinese");
  const cleaned = normalizeMetadata({ trackName: "Ｔｒａｃｋ (feat. Guest) (Remastered)", artistName: "Main Artist feat. Guest" });
  assert(cleaned.trackName === "Track" && cleaned.artistName === "Main Artist", "metadata normalization should remove Unicode and feat/version noise");

  const normal = scoreLyricCandidate({ filePath: "Track.lrc", exactBaseName: true, text: exact }, "Track");
  const verbatim = scoreLyricCandidate({ filePath: "Track.lddc.verbatim.lrc", text: ORIGINAL }, "Track");
  assert(normal > verbatim, "ordinary bilingual LRC should outrank verbatim LRC");
  const unrelated = scoreLyricCandidate({ filePath: "Other Song.bilingual.lrc", text: exact }, "Track");
  assert(!Number.isFinite(unrelated), "unrelated lyric files should be excluded even when bilingual");

  const durationMismatch = scoreMetadataCandidate(
    { trackName: "Exact Song", artistName: "Main Artist", albumName: "Album", duration: 120 },
    { trackName: "Exact Song", artistName: "Main Artist", albumName: "Album", duration: 140 },
  );
  assert(!durationMismatch.valid, "candidate farther than eight seconds should be rejected");

  await checkTranslationRequiresOptIn();
  await checkCachedOriginalCanBeTranslatedOnDemand();
  await checkTranslationTimeoutKeepsOriginal();
  await checkReadOnlyFallback();
  await checkBilingualSidecarSkipsNetwork();
  await checkDryRunDoesNotWrite();
  await checkSingleFlight();
  await checkCrossServiceFileLock();
  checkFrontendRaceGuards();
  console.log("lyrics-service-smoke ok");
}

async function checkTranslationRequiresOptIn() {
  const tempDir = makeTemp("translation-opt-in");
  let providerCalls = 0;
  const service = createLyricsService({
    cacheDir: tempDir,
    translationProvider: {
      name: "fixture-translator",
      async translate() { providerCalls += 1; return CHINESE; },
    },
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata: value }) => ({ lrc: ORIGINAL, source: "fixture", metadata: value }),
  });
  const withoutOptIn = await service.resolve({ metadata: metadata("Translation Opt In"), write: false, refresh: true });
  assert(providerCalls === 0, "translation provider should stay idle when the setting is off");
  assert(!withoutOptIn.hasBilingual, "setting off should retain the original single-language lyric");
  const withOptIn = await service.resolve({ metadata: metadata("Translation Opt In"), write: false, refresh: true, translate: true });
  assert(providerCalls === 1, "translation provider should run once after explicit opt-in");
  assert(withOptIn.hasBilingual, "explicit opt-in should merge the translated lyric");
}

async function checkCachedOriginalCanBeTranslatedOnDemand() {
  const tempDir = makeTemp("cached-translation-opt-in");
  let sourceCalls = 0;
  let providerCalls = 0;
  const trackMetadata = metadata("Cached Translation Opt In");
  const service = createLyricsService({
    cacheDir: tempDir,
    translationProvider: {
      name: "fixture-translator",
      async translate() { providerCalls += 1; return CHINESE; },
    },
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata: value }) => {
      sourceCalls += 1;
      return { lrc: ORIGINAL, source: "fixture", metadata: value };
    },
  });
  const originalOnly = await service.resolve({ metadata: trackMetadata, refresh: true });
  assert(originalOnly.cached && !originalOnly.hasBilingual, "first request should persist the original single-language lyric");
  assert(sourceCalls === 1 && providerCalls === 0, "setting off should cache once without translating");

  const translated = await service.resolve({ metadata: trackMetadata, translate: true });
  assert(translated.cached && translated.hasBilingual, "opening the setting should upgrade the cached original to bilingual lyrics");
  assert(sourceCalls === 1, "cached original should be translated without repeating the external lyric lookup");
  assert(providerCalls === 1, "cached original should call the translation provider once");

  const cachedBilingual = await service.resolve({ metadata: trackMetadata, translate: true });
  assert(cachedBilingual.hasBilingual, "subsequent requests should return the bilingual cache");
  assert(sourceCalls === 1 && providerCalls === 1, "bilingual cache should skip both lyric source and translation provider");
}

async function checkTranslationTimeoutKeepsOriginal() {
  const tempDir = makeTemp("translation-timeout");
  const provider = createTranslationProvider({
    endpoint: "https://translation.invalid/batch",
    timeoutMs: 15,
    fetch: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "AbortError" })), { once: true });
    }),
  });
  const service = createLyricsService({
    cacheDir: tempDir,
    translationProvider: provider,
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata }) => ({ lrc: ORIGINAL, source: "fixture", metadata }),
  });
  const result = await service.resolve({ metadata: metadata("Translation Timeout"), write: false, refresh: true, translate: true });
  assert(result.lrc.includes("Hello world"), "translation timeout should retain original lyric");
  assert(!result.hasBilingual, "translation timeout should not invent translated lines");
}

async function checkReadOnlyFallback() {
  const tempDir = makeTemp("cache-fallback");
  const mediaDir = path.join(tempDir, "music");
  fs.mkdirSync(mediaDir, { recursive: true });
  const mediaPath = path.join(mediaDir, "Cache Fallback.mp3");
  fs.writeFileSync(mediaPath, "fixture");
  fs.mkdirSync(path.join(mediaDir, "Cache Fallback.lrc"));
  const service = createLyricsService({
    cacheDir: path.join(tempDir, "bridge-cache"),
    resolveMediaPath: async () => mediaPath,
    findLocalCandidate: async () => null,
    fetchExact: async ({ metadata: value }) => ({ lrc: ORIGINAL, source: "fixture", metadata: value }),
  });
  const result = await service.resolve({ path: mediaPath, metadata: metadata("Cache Fallback"), refresh: true });
  assert(result.cached && result.cacheLocation === "bridge-cache", "unwritable sidecar should fall back to bridge cache");
}

async function checkBilingualSidecarSkipsNetwork() {
  const tempDir = makeTemp("sidecar-no-network");
  const mediaPath = path.join(tempDir, "Sidecar First.mp3");
  fs.writeFileSync(mediaPath, "fixture");
  let calls = 0;
  const bilingual = mergeBilingualLrc(ORIGINAL, CHINESE);
  const service = createLyricsService({
    cacheDir: path.join(tempDir, "bridge-cache"),
    resolveMediaPath: async () => mediaPath,
    findLocalCandidate: async () => ({ lrc: bilingual, source: "sidecar", hasBilingual: true }),
    fetchSource: async () => { calls += 1; return null; },
    fetchExact: async () => { calls += 1; return null; },
    fetchSearch: async () => { calls += 1; return null; },
  });
  const result = await service.resolve({ path: mediaPath, metadata: metadata("Sidecar First"), refresh: true });
  assert(result.local && result.hasBilingual, "bilingual sidecar should be returned directly");
  assert(calls === 0, `bilingual sidecar should skip network candidates, got ${calls} calls`);
}

async function checkDryRunDoesNotWrite() {
  const tempDir = makeTemp("dry-run");
  const cacheDir = path.join(tempDir, "bridge-cache");
  const service = createLyricsService({
    cacheDir,
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata: value }) => ({ lrc: ORIGINAL, source: "fixture", metadata: value }),
  });
  const result = await service.resolve({ metadata: metadata("Dry Run"), write: false, refresh: true });
  assert(result.lrc.includes("Hello world"), "dry-run should still resolve lyrics");
  assert(fs.readdirSync(cacheDir).length === 0, "dry-run should not create cache, lock or sidecar files");
}

async function checkSingleFlight() {
  const tempDir = makeTemp("single-flight");
  let calls = 0;
  const service = createLyricsService({
    cacheDir: tempDir,
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata: value }) => {
      calls += 1;
      await delay(30);
      return { lrc: ORIGINAL, source: "fixture", metadata: value };
    },
  });
  const input = { metadata: metadata("Single Flight"), write: false, refresh: true };
  await Promise.all([service.resolve(input), service.resolve(input)]);
  assert(calls === 1, `concurrent requests should query once, got ${calls}`);
}

async function checkCrossServiceFileLock() {
  const cacheDir = makeTemp("file-lock");
  let calls = 0;
  const createService = () => createLyricsService({
    cacheDir,
    resolveMediaPath: async () => "",
    fetchExact: async ({ metadata: value }) => {
      calls += 1;
      await delay(40);
      return { lrc: ORIGINAL, source: "fixture", metadata: value };
    },
  });
  await Promise.all([
    createService().resolve({ metadata: metadata("File Lock") }),
    createService().resolve({ metadata: metadata("File Lock") }),
  ]);
  assert(calls === 1, `file lock should prevent duplicate cross-service lookup, got ${calls}`);
}

function checkFrontendRaceGuards() {
  const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
  const externalApi = fs.readFileSync(path.resolve(__dirname, "..", "src", "external-source-api.js"), "utf8");
  assert(app.includes("state.lyricsAbortController?.abort()"), "new lyric load should abort the previous request");
  assert(app.includes("requestId !== state.lyricsLoadRequestId || state.currentTrack?.Id !== track.Id"), "old lyric response should not replace the current track");
  assert(app.includes('fetchLyricsBridgeJson(apiUrl, "lyric-by-metadata", track, options)'), "path failure should fall back to metadata lookup");
  assert(app.includes("signal: options.signal") && externalApi.includes("fetchLyric(apiUrl, track, options = {})"), "fallback source requests should share the lyric abort signal");
}

function metadata(trackName) {
  return { trackName, artistName: "Fixture Artist", albumName: "Fixture Album", duration: 120 };
}
function makeTemp(name) { return fs.mkdtempSync(path.join(os.tmpdir(), `aurora-${name}-`)); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
