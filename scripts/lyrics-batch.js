#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bridgeUrl = normalizeHttpUrl(options.bridge || process.env.LYRICS_BRIDGE_URL || "");
  if (!bridgeUrl) throw new Error("--bridge is required");
  const offset = toNonNegativeInt(options.offset, 0);
  const limit = toPositiveInt(options.limit, 0);
  const tracks = (await loadTracks(options, bridgeUrl)).slice(offset, limit ? offset + limit : undefined);
  const dryRunFlag = isEnabled(options["dry-run"]);
  const writeEnabled = isEnabled(options.write) && !dryRunFlag;
  const runOptions = { ...options, dryRunFlag, writeEnabled };
  const concurrency = Math.min(8, toPositiveInt(options.concurrency, 2));
  const rateMs = toNonNegativeInt(options.rate, 250);
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: !writeEnabled,
    offset,
    limit: limit || null,
    concurrency,
    totals: { input: tracks.length, matched: 0, translated: 0, cached: 0, written: 0, missed: 0, errors: 0 },
    items: [],
  };
  const limiter = createRateLimiter(rateMs);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, tracks.length)) }, async () => {
    while (cursor < tracks.length) {
      const index = cursor++;
      const track = normalizeTrack(tracks[index]);
      const result = await processTrack(bridgeUrl, track, runOptions, limiter).catch((error) => ({ error: error.message || String(error) }));
      const item = {
        index: offset + index,
        title: track.trackName,
        artist: track.artistName,
        source: result.source || "",
        translationSource: result.translationSource || "",
        confidence: Number(result.confidence || 0),
        cached: Boolean(result.cached),
        cacheLocation: result.cacheLocation || "",
        lyricPath: result.lyricPath || "",
        matched: Boolean(result.matched),
        hasBilingual: Boolean(result.hasBilingual),
        error: result.error || "",
      };
      report.items[index] = item;
      updateTotals(report.totals, item);
    }
  });
  await Promise.all(workers);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), output, "utf8");
  process.stdout.write(output);
  if (report.totals.errors) process.exitCode = 2;
}

async function loadTracks(options, bridgeUrl) {
  if (options.input) {
    const text = fs.readFileSync(path.resolve(options.input), "utf8").trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) {
      const payload = JSON.parse(text);
      return Array.isArray(payload) ? payload : (payload.Items || payload.items || payload.tracks || []);
    }
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  }
  const url = new URL("/tracks", `${bridgeUrl}/`);
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", String(toPositiveInt(options["scan-limit"], 5000)));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`track scan returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload.Items || payload.items || [];
}

async function processTrack(bridgeUrl, track, options, limiter) {
  if (!track.trackName || !track.artistName) return { error: "missing track metadata" };
  const url = new URL("/lyric-by-metadata", `${bridgeUrl}/`);
  Object.entries(track).forEach(([key, value]) => { if (value !== "" && value !== 0) url.searchParams.set(key, String(value)); });
  url.searchParams.set("write", options.writeEnabled ? "1" : "0");
  if (isEnabled(options.overwrite)) url.searchParams.set("overwrite", "1");
  if (isEnabled(options.refresh)) url.searchParams.set("refresh", "1");
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await limiter.wait();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), toPositiveInt(options.timeout, 20000));
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (response.ok || response.status === 404) return payload;
      if (response.status !== 429 && response.status < 500) return { ...payload, error: payload.error || `HTTP ${response.status}` };
      lastError = new Error(payload.error || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await delay(300 * (2 ** attempt));
  }
  throw lastError || new Error("lyrics request failed");
}

function normalizeTrack(track) {
  const artists = track?.Artists || track?.ArtistItems?.map((item) => item.Name) || track?.artistName || track?.artist || "";
  return {
    trackName: clean(track?.trackName || track?.Name || track?.title),
    artistName: clean(Array.isArray(artists) ? artists.join(", ") : artists),
    albumName: clean(track?.albumName || track?.Album || track?.album),
    duration: normalizeDuration(track?.duration || (Number(track?.RunTimeTicks) / 10000000)),
    path: clean(track?.path || track?.Path),
  };
}
function createRateLimiter(intervalMs) {
  let nextAt = 0;
  let chain = Promise.resolve();
  return { wait() {
    const task = chain.then(async () => {
      const waitMs = Math.max(0, nextAt - Date.now());
      if (waitMs) await delay(waitMs);
      nextAt = Date.now() + intervalMs;
    });
    chain = task.catch(() => {});
    return task;
  } };
}
function updateTotals(totals, item) {
  if (item.error) totals.errors += 1;
  else if (!item.matched && !item.source) totals.missed += 1;
  if (item.matched) totals.matched += 1;
  if (item.translationSource) totals.translated += 1;
  if (item.cached) totals.cached += 1;
  if (item.cacheLocation === "sidecar") totals.written += 1;
}
function parseArgs(args) {
  const output = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) continue;
    const [rawKey, inline] = item.slice(2).split("=", 2);
    if (inline !== undefined) output[rawKey] = inline;
    else if (args[index + 1] && !args[index + 1].startsWith("--")) output[rawKey] = args[++index];
    else output[rawKey] = true;
  }
  return output;
}
function isEnabled(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return /^(?:1|true|yes|on)$/i.test(String(value).trim());
}
function normalizeHttpUrl(value) { try { const url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.toString().replace(/\/+$/, "") : ""; } catch { return ""; } }
function clean(value) { return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500); }
function normalizeDuration(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.round(number * 1000) / 1000 : 0; }
function toPositiveInt(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : fallback; }
function toNonNegativeInt(value, fallback) { const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : fallback; }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

main().catch((error) => {
  process.stderr.write(`${error.message || String(error)}\n`);
  process.exit(1);
});
