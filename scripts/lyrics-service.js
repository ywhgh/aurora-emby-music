"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RESPONSE_FIELDS = [
  "lrc", "originalLrc", "translatedLrc", "local", "matched", "hasCjk",
  "hasBilingual", "source", "translationSource", "matchMode", "confidence",
  "cached", "cacheLocation", "mediaPath", "lyricPath", "lineCount",
];
const METADATA_TAG = /^\[(?:ar|al|ti|by|offset|re|ve|source|translation):/i;
const CREDIT_LINE = /^(?:作词|作曲|编曲|制作人|混音|母带|录音|演唱|词|曲|lyrics?|composer|producer|arranger|mix(?:ed)? by)\s*[:：]/i;
const PERFORMANCE_LINE = /^[\s[(（【]*(?:instrumental|music|intro|outro|interlude|演奏|间奏|前奏|尾奏|纯音乐)[\s)\]）】]*$/i;
const TRANSLATION_SKIP = /^(?:\s*$|[\p{P}\p{S}\s]+|\d+(?:[.,:]\d+)*|\[[^\]]+\])$/u;

function normalizeUnicode(value) {
  return String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function stripMetadataNoise(value, kind = "title") {
  let text = normalizeUnicode(value)
    .replace(/^\s*(?:cd|disc|disk|盘)\s*\d+[\s._-]*/i, "")
    .replace(/^\s*\d{1,3}\s*[._-]\s*/, "")
    .replace(/\s*[\[(（【]\s*(?:disc|disk|cd)\s*\d+\s*[\])）】]\s*$/i, "")
    .replace(/\s*[-–—_]\s*(?:flac|mp3|aac|alac|wav|ape|dsd|hi[- ]?res|lossless|无损|高解析|母带|\d{2,4}k(?:bps)?|\d{2,3}bit|\d{2,3}khz)\s*$/i, "");
  if (kind === "title") {
    text = text
      .replace(/(?:\s*[\[(（【][^\])）】]*(?:feat(?:uring)?\.?|ft\.?|version|ver\.?|remaster(?:ed)?|live|edit|mix|mono|stereo|instrumental|伴奏|现场|版本|重制|翻唱|cover|纯享)[^\])）】]*[\])）】])+\s*$/i, "")
      .replace(/\s+(?:feat(?:uring)?|ft)\.?\s+.+$/i, "");
  } else if (kind === "artist") {
    text = text.replace(/\s+(?:feat(?:uring)?|ft)\.?\s+.+$/i, "");
  }
  return text.replace(/\s+/g, " ").trim();
}

function normalizeMetadata(metadata = {}) {
  return {
    trackName: stripMetadataNoise(metadata.trackName || metadata.title, "title"),
    artistName: stripMetadataNoise(metadata.artistName || metadata.artist, "artist"),
    albumName: stripMetadataNoise(metadata.albumName || metadata.album, "album"),
    duration: normalizeDuration(metadata.duration),
  };
}

function normalizeDuration(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 1000) / 1000 : 0;
}

function normalizeForMatch(value, kind = "title") {
  return stripMetadataNoise(value, kind)
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactForMatch(value, kind) {
  return normalizeForMatch(value, kind).replace(/\s+/g, "");
}

function diceSimilarity(leftValue, rightValue, kind = "title") {
  const left = compactForMatch(leftValue, kind);
  const right = compactForMatch(rightValue, kind);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length >= 3 && right.length >= 3 && (left.includes(right) || right.includes(left))) return 0.9;
  if (left.length < 2 || right.length < 2) return 0;
  const grams = (value) => {
    const map = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };
  const a = grams(left);
  const b = grams(right);
  let overlap = 0;
  a.forEach((count, gram) => { overlap += Math.min(count, b.get(gram) || 0); });
  return (2 * overlap) / Math.max(1, left.length + right.length - 2);
}

function artistTokens(value) {
  return stripMetadataNoise(value, "artist")
    .split(/\s*(?:,|，|、|\/|&|;|；|\bx\b|\band\b)\s*/i)
    .map((item) => compactForMatch(item, "artist"))
    .filter(Boolean);
}

function hasPrimaryArtistMatch(expected, actual) {
  const left = artistTokens(expected);
  const right = artistTokens(actual);
  return left.length > 0 && right.length > 0 && left.some((a) => right.some((b) => a === b || diceSimilarity(a, b, "artist") >= 0.82));
}

function scoreMetadataCandidate(expectedValue, candidateValue, options = {}) {
  const expected = normalizeMetadata(expectedValue);
  const candidate = normalizeMetadata(candidateValue);
  const titleSimilarity = diceSimilarity(expected.trackName, candidate.trackName, "title");
  const artistMatched = hasPrimaryArtistMatch(expected.artistName, candidate.artistName);
  const albumSimilarity = expected.albumName && candidate.albumName
    ? diceSimilarity(expected.albumName, candidate.albumName, "album")
    : 0;
  const durationKnown = Boolean(expected.duration && candidate.duration);
  const durationDelta = durationKnown ? Math.abs(expected.duration - candidate.duration) : null;
  const maxDurationDelta = Number(options.maxDurationDelta || 8);
  const valid = titleSimilarity >= Number(options.titleThreshold || 0.82)
    && artistMatched
    && (!durationKnown || durationDelta <= maxDurationDelta);
  const score = valid
    ? Math.round((titleSimilarity * 60 + (artistMatched ? 25 : 0) + albumSimilarity * 8
      + (durationKnown ? Math.max(0, 7 - durationDelta * 0.75) : -5)) * 100) / 100
    : -1;
  return { valid, score, titleSimilarity, artistMatched, albumSimilarity, durationKnown, durationDelta };
}

function parseLrcLines(text) {
  const timePattern = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const lines = [];
  String(text || "").split(/\r?\n/).forEach((rawLine, order) => {
    if (METADATA_TAG.test(rawLine.trim())) return;
    const matches = [...rawLine.matchAll(timePattern)];
    const lineText = rawLine.replace(timePattern, "").trim();
    if (!matches.length || !lineText) return;
    matches.forEach((match) => {
      const fraction = match[4] ? Number(`0.${match[4].padEnd(3, "0").slice(0, 3)}`) : 0;
      lines.push({
        time: Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + fraction,
        text: lineText,
        raw: rawLine,
        order,
      });
    });
  });
  return lines.sort((a, b) => a.time - b.time || a.order - b.order);
}

function classifyLyricLanguage(value) {
  const text = normalizeUnicode(value);
  if (!text) return "unknown";
  if (/[\u3040-\u30ff\u31f0-\u31ff]/u.test(text)) return "ja";
  if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(text)) return "ko";
  if (/[\u3400-\u9fff\uf900-\ufaff]/u.test(text)) return "zh";
  if (/\p{L}/u.test(text)) return "foreign";
  return "unknown";
}

function isChineseLine(value) {
  return classifyLyricLanguage(value) === "zh";
}

function isForeignLine(value) {
  return ["foreign", "ja", "ko"].includes(classifyLyricLanguage(value));
}

function nearestUnusedLine(lines, time, used, tolerance) {
  let best = null;
  lines.forEach((line, index) => {
    if (used.has(index)) return;
    const delta = Math.abs(line.time - time);
    if (delta <= tolerance + 1e-9 && (!best || delta < best.delta || (delta === best.delta && line.order < best.line.order))) {
      best = { line, index, delta };
    }
  });
  return best;
}

function mergeBilingualLrc(originalLrc, translatedLrc, options = {}) {
  const tolerance = Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : 0.08;
  const original = parseLrcLines(originalLrc);
  const translated = parseLrcLines(translatedLrc).filter((line) => isChineseLine(line.text));
  if (!original.length || !translated.length) return "";
  if (original.filter((line) => isChineseLine(line.text)).length >= Math.ceil(original.length * 0.6)) return "";
  const used = new Set();
  let matches = 0;
  const output = [];
  original.forEach((line) => {
    output.push(`[${formatTimestamp(line.time)}]${line.text}`);
    const match = nearestUnusedLine(translated, line.time, used, tolerance);
    if (match && normalizeLyricText(match.line.text) !== normalizeLyricText(line.text)) {
      used.add(match.index);
      output.push(`[${formatTimestamp(line.time)}]${match.line.text}`);
      matches += 1;
    }
  });
  return matches ? output.join("\n") : "";
}

function splitBilingualLrc(lrc, tolerance = 0.08) {
  const lines = parseLrcLines(lrc);
  const chinese = lines.map((line, index) => ({ line, index })).filter(({ line }) => isChineseLine(line.text));
  const foreign = lines.map((line, index) => ({ line, index })).filter(({ line }) => isForeignLine(line.text));
  if (!foreign.length) {
    return {
      originalLrc: lines.map((line) => `[${formatTimestamp(line.time)}]${line.text}`).join("\n"),
      translatedLrc: "",
    };
  }
  const usedChinese = new Set();
  const original = [];
  const translated = [];
  foreign.forEach(({ line }) => {
    original.push(`[${formatTimestamp(line.time)}]${line.text}`);
    const match = chinese
      .map(({ line: item, index }) => ({ item, index, delta: Math.abs(item.time - line.time) }))
      .filter(({ index, delta }) => !usedChinese.has(index) && delta <= tolerance + 1e-9)
      .sort((a, b) => a.delta - b.delta || a.item.order - b.item.order)[0];
    if (match) {
      usedChinese.add(match.index);
      translated.push(`[${formatTimestamp(line.time)}]${match.item.text}`);
    }
  });
  return { originalLrc: original.join("\n"), translatedLrc: translated.join("\n") };
}
function countBilingualTimestampGroups(lrc, tolerance = 0.08) {
  const lines = parseLrcLines(lrc);
  let count = 0;
  const usedChinese = new Set();
  lines.forEach((line) => {
    if (!isForeignLine(line.text)) return;
    const chinese = lines
      .map((item, index) => ({ item, index, delta: Math.abs(item.time - line.time) }))
      .filter(({ item, index, delta }) => isChineseLine(item.text) && !usedChinese.has(index) && delta <= tolerance + 1e-9)
      .sort((a, b) => a.delta - b.delta || a.item.order - b.item.order)[0];
    if (chinese) { usedChinese.add(chinese.index); count += 1; }
  });
  return count;
}

function hasBilingualLrc(lrc) {
  return countBilingualTimestampGroups(lrc) > 0;
}

function getLyricContentLines(text) {
  const timed = parseLrcLines(text).map((line) => line.text).filter(Boolean);
  if (timed.length) return timed;
  return String(text || "").split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !METADATA_TAG.test(line));
}

function hasCjk(lrc) {
  return getLyricContentLines(lrc).some((line) => ["zh", "ja", "ko"].includes(classifyLyricLanguage(line)));
}

function isUsableLyric(text) {
  const value = String(text || "").trim();
  if (!value || Buffer.byteLength(value, "utf8") > 1024 * 1024 || /<(?:html|body)|(?:404|403)\s+(?:not found|forbidden)/i.test(value)) return false;
  const content = getLyricContentLines(value);
  if (!content.length) return false;
  const meaningful = content.filter((line) => !CREDIT_LINE.test(line) && !PERFORMANCE_LINE.test(line) && !TRANSLATION_SKIP.test(line));
  return meaningful.length >= Math.min(2, content.length);
}

function isExcludedLyricFile(filePath) {
  const base = path.basename(String(filePath || ""));
  return !base || base.startsWith(".") || /(?:\.bak(?:\.|$)|\.tmp(?:\.|$)|~$|\.swp$|\.part$)/i.test(base);
}

function scoreLyricCandidate(candidate, audioBaseName = "") {
  const filePath = String(candidate?.filePath || "");
  const text = String(candidate?.text || "");
  if (isExcludedLyricFile(filePath) || !isUsableLyric(text)) return Number.NEGATIVE_INFINITY;
  const parsed = path.parse(filePath);
  const stem = parsed.name.replace(/\.lddc\.verbatim$/i, "");
  const stemKey = compactForMatch(stem);
  const audioKey = compactForMatch(audioBaseName);
  const exact = candidate?.exactBaseName === true || (audioKey && stemKey === audioKey);
  const related = exact || !audioKey || stemKey.includes(audioKey) || audioKey.includes(stemKey)
    || diceSimilarity(stem, audioBaseName) >= 0.72;
  if (!related) return Number.NEGATIVE_INFINITY;
  let score = exact ? 1000 : 360;
  if (countBilingualTimestampGroups(text) >= 3) score += 700;
  if (parsed.ext.toLowerCase() === ".lrc") score += 80;
  if (/bilingual|translated|translation|双语|翻译/i.test(parsed.base)) score += 110;
  if (/\.lddc\.verbatim\.lrc$/i.test(parsed.base) || /逐字|verbatim/i.test(parsed.base)) score -= 420;
  return score;
}

function formatTimestamp(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`;
}

function normalizeLyricText(value) {
  return normalizeUnicode(value).replace(/\s+/g, "");
}

function createCacheKey(metadata) {
  const value = normalizeMetadata(metadata);
  return crypto.createHash("sha256").update(JSON.stringify({
    title: normalizeForMatch(value.trackName),
    artist: normalizeForMatch(value.artistName, "artist"),
    album: normalizeForMatch(value.albumName, "album"),
    duration: value.duration ? Math.round(value.duration) : 0,
  })).digest("hex");
}

function createLyricResponse(details = {}) {
  const lrc = String(details.lrc || "");
  const split = splitBilingualLrc(lrc);
  const response = {
    lrc,
    originalLrc: String(details.originalLrc || split.originalLrc || lrc),
    translatedLrc: String(details.translatedLrc || split.translatedLrc || ""),
    local: Boolean(details.local),
    matched: Boolean(details.matched),
    hasCjk: details.hasCjk == null ? hasCjk(lrc) : Boolean(details.hasCjk),
    hasBilingual: details.hasBilingual == null ? hasBilingualLrc(lrc) : Boolean(details.hasBilingual),
    source: String(details.source || "none"),
    translationSource: String(details.translationSource || ""),
    matchMode: String(details.matchMode || "none"),
    confidence: Number.isFinite(Number(details.confidence)) ? Number(details.confidence) : 0,
    cached: Boolean(details.cached),
    cacheLocation: String(details.cacheLocation || ""),
    mediaPath: String(details.mediaPath || ""),
    lyricPath: String(details.lyricPath || ""),
    lineCount: getLyricContentLines(lrc).length,
  };
  RESPONSE_FIELDS.forEach((field) => { if (!(field in response)) response[field] = field === "lrc" ? "" : false; });
  return response;
}

function formatStandardLrc(metadata, result) {
  const normalized = normalizeMetadata(metadata);
  const source = String(result.source || "unknown").replace(/[\r\n\]]/g, "");
  const translation = String(result.translationSource || "none").replace(/[\r\n\]]/g, "");
  const timedLines = parseLrcLines(result.lrc);
  const lines = timedLines.length
    ? timedLines.map((line) => `[${formatTimestamp(line.time)}]${line.text}`)
    : getLyricContentLines(result.lrc);
  return [
    `[ti:${normalized.trackName}]`, `[ar:${normalized.artistName}]`, `[al:${normalized.albumName}]`,
    "[re:Aurora Lyrics Bridge]", `[source:${source}]`, `[translation:${translation}]`, "", ...lines,
  ].join("\n").trim();
}

function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tempPath, `${String(content).trim()}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tempPath, filePath);
    return true;
  } catch {
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best effort */ }
    return false;
  }
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function readCache(cacheDir, key) {
  const lrcPath = path.join(cacheDir, `${key}.lrc`);
  const jsonPath = path.join(cacheDir, `${key}.lyrics.json`);
  const metadata = readJson(jsonPath);
  if (!fs.existsSync(lrcPath) || !metadata) return null;
  const lrc = fs.readFileSync(lrcPath, "utf8");
  if (!isUsableLyric(lrc)) return null;
  return createLyricResponse({ ...metadata, lrc, cached: true, cacheLocation: "bridge-cache", lyricPath: lrcPath });
}

function readNegativeCache(cacheDir, key, ttlMs) {
  const filePath = path.join(cacheDir, `${key}.negative.json`);
  const payload = readJson(filePath);
  return payload && Date.now() - Number(payload.generatedAt || 0) < ttlMs ? payload : null;
}

function saveNegativeCache(cacheDir, key, metadata, version) {
  atomicWrite(path.join(cacheDir, `${key}.negative.json`), JSON.stringify({ metadata, generatedAt: Date.now(), version }, null, 2));
}

function saveCache(cacheDir, key, metadata, response, version) {
  const lrcPath = path.join(cacheDir, `${key}.lrc`);
  const jsonPath = path.join(cacheDir, `${key}.lyrics.json`);
  if (!atomicWrite(lrcPath, formatStandardLrc(metadata, response))) return null;
  const lrc = fs.readFileSync(lrcPath, "utf8");
  const descriptor = {
    source: response.source, translationSource: response.translationSource, matchMode: response.matchMode,
    confidence: response.confidence, local: false, matched: response.matched, mediaPath: response.mediaPath,
    generatedAt: new Date().toISOString(), generatedAtEpoch: Date.now(), version,
    contentSha256: crypto.createHash("sha256").update(lrc).digest("hex"), metadata: normalizeMetadata(metadata),
  };
  atomicWrite(jsonPath, JSON.stringify(descriptor, null, 2));
  if (isUsableLyric(response.verbatimLrc)) atomicWrite(path.join(cacheDir, `${key}.lddc.verbatim.lrc`), response.verbatimLrc);
  if (response.rawLyricsData) {
    try { atomicWrite(path.join(cacheDir, `${key}.source.json`), JSON.stringify(response.rawLyricsData, null, 2)); } catch { /* optional source asset */ }
  }
  return createLyricResponse({ ...response, lrc, cached: true, cacheLocation: "bridge-cache", lyricPath: lrcPath });
}

function persistGeneratedLyric({ cacheDir, key, metadata, response, mediaPath, version, write = true, overwrite = false }) {
  const standardLrc = formatStandardLrc(metadata, response);
  if (write && mediaPath) {
    const parsed = path.parse(mediaPath);
    const sidecarPath = path.join(parsed.dir, `${parsed.name}.lrc`);
    const descriptorPath = path.join(parsed.dir, `${parsed.name}.lyrics.meta.json`);
    const legacyDescriptorPath = path.join(parsed.dir, `${parsed.name}.lyrics.json`);
    const rawDataPath = legacyDescriptorPath;
    const verbatimPath = path.join(parsed.dir, `${parsed.name}.lddc.verbatim.lrc`);
    let existing = "";
    try {
      existing = fs.statSync(sidecarPath).isFile() ? fs.readFileSync(sidecarPath, "utf8") : "";
    } catch {
      existing = "";
    }
    const descriptor = readJson(descriptorPath) || readJson(legacyDescriptorPath);
    const owned = descriptor?.generator === "Aurora Lyrics Bridge"
      && descriptor?.contentSha256 === crypto.createHash("sha256").update(existing).digest("hex");
    const mayWrite = !existing || (overwrite && owned);
    if (mayWrite) {
      if (existing) atomicWrite(`${sidecarPath}.bak`, existing);
      if (atomicWrite(sidecarPath, standardLrc)) {
        const written = fs.readFileSync(sidecarPath, "utf8");
        if (isUsableLyric(response.verbatimLrc) && !fs.existsSync(verbatimPath)) atomicWrite(verbatimPath, response.verbatimLrc);
        if (response.rawLyricsData && !fs.existsSync(rawDataPath)) {
          try { atomicWrite(rawDataPath, JSON.stringify(response.rawLyricsData, null, 2)); } catch { /* optional source asset */ }
        }
        atomicWrite(descriptorPath, JSON.stringify({
          generator: "Aurora Lyrics Bridge", version, generatedAt: new Date().toISOString(),
          source: response.source, translationSource: response.translationSource, confidence: response.confidence,
          metadata: normalizeMetadata(metadata), contentSha256: crypto.createHash("sha256").update(written).digest("hex"),
        }, null, 2));
        return createLyricResponse({ ...response, lrc: written, cached: true, cacheLocation: "sidecar", lyricPath: sidecarPath, mediaPath });
      }
    }
  }
  return saveCache(cacheDir, key, metadata, { ...response, mediaPath }, version) || response;
}

function getTranslatableLines(lrc) {
  return parseLrcLines(lrc).filter((line) => isForeignLine(line.text) && !METADATA_TAG.test(line.text)
    && !TRANSLATION_SKIP.test(line.text) && !PERFORMANCE_LINE.test(line.text));
}

function createTranslationProvider(config = {}) {
  const endpoint = String(config.endpoint || "").trim();
  const token = String(config.token || "").trim();
  const model = String(config.model || "").trim();
  const fetchImpl = config.fetch || global.fetch;
  const timeoutMs = Number(config.timeoutMs || 10000);
  if (!endpoint || typeof fetchImpl !== "function") return null;
  return {
    name: String(config.name || "configured-provider"),
    async translate({ lrc, metadata }) {
      const lines = getTranslatableLines(lrc);
      if (!lines.length) return "";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const context = lines.map((line, index) => ({ index, text: line.text }));
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            model, track: normalizeMetadata(metadata), targetLanguage: "zh-CN", preserveOrder: true,
            context, prompt: "Translate the ordered lyric batch using the song title, artist and adjacent lines as context. Return JSON with translations [{index,text}].",
          }),
          signal: controller.signal,
        });
        if (!response.ok) return "";
        const payload = await response.json();
        const values = Array.isArray(payload?.translations) ? payload.translations
          : (Array.isArray(payload?.data?.translations) ? payload.data.translations : []);
        const byIndex = new Map(values.map((item, index) => [Number(item?.index ?? index), String(item?.text || item?.translation || "").trim()]));
        return lines.map((line, index) => {
          const translated = byIndex.get(index);
          return translated && isChineseLine(translated) ? `[${formatTimestamp(line.time)}]${translated}` : "";
        }).filter(Boolean).join("\n");
      } catch {
        return "";
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFileLock(lockPath, action, timeoutMs = 2500) {
  const startedAt = Date.now();
  let handle = null;
  while (!handle && Date.now() - startedAt < timeoutMs) {
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      handle = fs.openSync(lockPath, "wx");
    } catch (error) {
      if (error?.code !== "EEXIST") break;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > 120000) fs.rmSync(lockPath, { force: true });
      } catch { /* another process released it */ }
      if (!handle) await delay(50);
    }
  }
  if (!handle) return await action(false);
  try {
    return await action(true);
  } finally {
    try { fs.closeSync(handle); } catch { /* best effort */ }
    try { fs.rmSync(lockPath, { force: true }); } catch { /* best effort */ }
  }
}

function createLyricsService(options = {}) {
  const cacheDir = path.resolve(options.cacheDir || path.join(process.cwd(), "bridge-cache", "lyrics"));
  const version = String(options.version || "1");
  const negativeTtlMs = Number(options.negativeTtlMs || 6 * 60 * 60 * 1000);
  const lockTimeoutMs = Number(options.lockTimeoutMs || 60000);
  const inFlight = new Map();
  fs.mkdirSync(cacheDir, { recursive: true });

  function needsRequestedTranslation(candidate, input) {
    return input.translate === true
      && typeof options.translationProvider?.translate === "function"
      && Boolean(candidate?.lrc)
      && !candidate.hasBilingual
      && !parseLrcLines(candidate.lrc).some((line) => isChineseLine(line.text))
      && getTranslatableLines(candidate.originalLrc || candidate.lrc).length > 0;
  }

  async function resolve(input = {}) {
    const metadata = normalizeMetadata(input.metadata || input);
    const key = createCacheKey(metadata);
    const refresh = Boolean(input.refresh);
    const mediaPath = String(await options.resolveMediaPath?.(input.path, metadata) || "");
    const localCandidate = mediaPath ? await options.findLocalCandidate?.(mediaPath, metadata) : null;
    let preferredLocalOriginal = null;
    if (localCandidate?.lrc && (localCandidate.cached || hasBilingualLrc(localCandidate.lrc))) {
      const localResponse = createLyricResponse({
        ...localCandidate,
        local: true,
        source: localCandidate.source || "sidecar",
        matchMode: "path",
        confidence: 1,
        mediaPath,
      });
      if (!needsRequestedTranslation(localResponse, input)) return localResponse;
      preferredLocalOriginal = localResponse;
    }
    if (!refresh) {
      const cached = readCache(cacheDir, key);
      if (cached && !needsRequestedTranslation(cached, input)) return cached;
      if (!cached && readNegativeCache(cacheDir, key, negativeTtlMs)) {
        return createLyricResponse({ source: "negative-cache", cached: true, cacheLocation: "bridge-cache", mediaPath });
      }
    }
    const flightKey = [
      key,
      refresh ? "refresh" : "normal",
      input.write === false ? "dry" : "write",
      input.translate === true ? "translate" : "original",
    ].join(":");
    if (inFlight.has(flightKey)) return inFlight.get(flightKey);

    const resolveFresh = async () => {
      let firstUsableOriginal = preferredLocalOriginal;
      if (!refresh) {
        const cached = readCache(cacheDir, key);
        if (cached) {
          if (!needsRequestedTranslation(cached, input)) return cached;
          firstUsableOriginal = cached;
        } else if (readNegativeCache(cacheDir, key, negativeTtlMs)) {
          return createLyricResponse({ source: "negative-cache", cached: true, cacheLocation: "bridge-cache", mediaPath });
        }
      }
      let selected = null;
      if (!firstUsableOriginal) {
        const stages = [
          ["structured", options.fetchStructured],
          ["source", options.fetchSource],
          ["lrclib-get", options.fetchExact],
          ["lrclib-search", options.fetchSearch],
        ];
        for (const [mode, fetcher] of stages) {
          if (typeof fetcher !== "function") continue;
          const candidate = await fetcher({ metadata, mediaPath, path: input.path, refresh }).catch(() => null);
          if (!candidate?.lrc || !isUsableLyric(candidate.lrc)) continue;
          if (candidate.metadata) {
            const match = scoreMetadataCandidate(metadata, candidate.metadata, { maxDurationDelta: 8 });
            if (!match.valid) continue;
            candidate.confidence = candidate.confidence ?? match.score / 100;
          }
          const normalizedCandidate = {
            ...createLyricResponse({ ...candidate, matched: true, matchMode: candidate.matchMode || mode, mediaPath }),
            verbatimLrc: candidate.verbatimLrc || "",
            rawLyricsData: candidate.rawLyricsData || null,
          };
          if (normalizedCandidate.hasBilingual) {
            selected = normalizedCandidate;
            break;
          }
          firstUsableOriginal ||= normalizedCandidate;
        }
      }
      selected ||= firstUsableOriginal;
      if (!selected?.lrc && localCandidate?.lrc && isUsableLyric(localCandidate.lrc)) {
        selected = createLyricResponse({
          ...localCandidate,
          local: true,
          source: localCandidate.source || "sidecar",
          matchMode: "path-fallback",
          confidence: 1,
          mediaPath,
        });
      }
      let translationApplied = false;
      if (needsRequestedTranslation(selected, input)) {
        const originalWasLocal = selected.local;
        const originalLrc = selected.originalLrc || selected.lrc;
        const translatedLrc = await options.translationProvider.translate({ lrc: originalLrc, metadata }).catch(() => "");
        const merged = translatedLrc ? mergeBilingualLrc(originalLrc, translatedLrc) : "";
        if (merged) {
          selected = createLyricResponse({
            ...selected,
            lrc: merged,
            originalLrc,
            translatedLrc,
            hasCjk: undefined,
            hasBilingual: undefined,
            local: false,
            matched: !originalWasLocal || selected.matched,
            matchMode: originalWasLocal ? "path-translation" : selected.matchMode,
            translationSource: options.translationProvider.name || "configured-provider",
          });
          translationApplied = true;
        }
      }
      if (!selected?.lrc) {
        if (input.write !== false) saveNegativeCache(cacheDir, key, metadata, version);
        return createLyricResponse({ source: "none", matchMode: "none", mediaPath });
      }
      if (selected.local || input.write === false || (selected.cached && !translationApplied)) return selected;
      return persistGeneratedLyric({
        cacheDir,
        key,
        metadata,
        response: selected,
        mediaPath,
        version,
        write: true,
        overwrite: Boolean(input.overwrite),
      });
    };

    const promise = (input.write === false
      ? resolveFresh()
      : withFileLock(path.join(cacheDir, `${key}.lock`), async (acquired) => {
        if (!acquired) {
          const cached = readCache(cacheDir, key);
          if (cached && !needsRequestedTranslation(cached, input)) return cached;
        }
        return resolveFresh();
      }, lockTimeoutMs)
    ).finally(() => inFlight.delete(flightKey));
    inFlight.set(flightKey, promise);
    return promise;
  }

  return { resolve, cacheDir };
}

module.exports = {
  RESPONSE_FIELDS,
  artistTokens,
  atomicWrite,
  classifyLyricLanguage,
  countBilingualTimestampGroups,
  createCacheKey,
  createLyricResponse,
  createLyricsService,
  createTranslationProvider,
  diceSimilarity,
  formatStandardLrc,
  hasBilingualLrc,
  hasCjk,
  hasPrimaryArtistMatch,
  isExcludedLyricFile,
  isUsableLyric,
  mergeBilingualLrc,
  normalizeMetadata,
  normalizeUnicode,
  parseLrcLines,
  persistGeneratedLyric,
  scoreLyricCandidate,
  scoreMetadataCandidate,
  splitBilingualLrc,
  stripMetadataNoise,
};
