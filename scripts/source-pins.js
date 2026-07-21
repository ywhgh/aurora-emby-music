"use strict";

const crypto = require("node:crypto");

const DEFAULT_BUILT_IN_SOURCE_MANIFEST_URLS = [
  "https://13413.kstore.vip/yuanli/yuanli.json",
];

const BUILT_IN_SOURCE_PINS = new Map([
  [normalizeComparableUrl(DEFAULT_BUILT_IN_SOURCE_MANIFEST_URLS[0]), {
    manifestSha256: "09619cc8a2db5e243ecccb52b566f813fc640aaca1aa82a95d8c21fe2e6afbcf",
    plugins: new Map([
      [normalizeComparableUrl("https://13413.kstore.vip/yuanli/wy.js"), "e82e0b56916bd59f7fd68c6272d1c4ad444e66e3e3efa10597132e87111baa59"],
      [normalizeComparableUrl("https://13413.kstore.vip/yuanli/kw.js"), "1d7e2229882a4bd4d31034fd776785e4213f95f99593f8024b1adae5bb08e894"],
      [normalizeComparableUrl("https://13413.kstore.vip/yuanli/kg.js"), "cbe3d57be2b4e0031f09d03fa91c35a586c0fa1c557166a83df1ecdf0af729ca"],
      [normalizeComparableUrl("https://13413.kstore.vip/yuanli/qq.js"), "aababf90ce1b6b5235ce5ef2d7d4ef629d5e38215281599e3acec7b6a015e8d7"],
      [normalizeComparableUrl("https://gitee.com/maotoumao/MusicFreePlugins/raw/v0.1/dist/bilibili/index.js"), "3e49093f80d553d96439745891812c848388a32ae7dca346c1c3282748783be1"],
      [normalizeComparableUrl("https://13413.kstore.vip/yuanli/xiaomi.js"), "0b3c5caddf0eff04a01324a019e9e65234a6e5f5a89467f021f65c525d6e6bd7"],
    ]),
  }],
]);

function normalizeComparableUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function getBuiltInSourcePin(manifestUrl) {
  return BUILT_IN_SOURCE_PINS.get(normalizeComparableUrl(manifestUrl)) || null;
}

function sha256Hex(content) {
  return crypto.createHash("sha256").update(String(content)).digest("hex");
}

function isPinnedSha256(content, expectedHash) {
  const expected = String(expectedHash || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(expected) && sha256Hex(content) === expected;
}

function verifyBuiltInManifestContent(manifestUrl, manifestContent) {
  return isPinnedSha256(manifestContent, getBuiltInSourcePin(manifestUrl)?.manifestSha256);
}

function verifyBuiltInPluginContent(manifestUrl, pluginUrl, code) {
  const expectedHash = getBuiltInSourcePin(manifestUrl)?.plugins.get(normalizeComparableUrl(pluginUrl));
  return isPinnedSha256(code, expectedHash);
}

module.exports = {
  BUILT_IN_SOURCE_PINS,
  DEFAULT_BUILT_IN_SOURCE_MANIFEST_URLS,
  getBuiltInSourcePin,
  isPinnedSha256,
  normalizeComparableUrl,
  sha256Hex,
  verifyBuiltInManifestContent,
  verifyBuiltInPluginContent,
};
