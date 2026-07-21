import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { parentPort, workerData } from "node:worker_threads";
import axios from "axios";
import bigInteger from "big-integer";
import * as cheerio from "cheerio";
import CryptoJS from "crypto-js";
import dayjs from "dayjs";
import he from "he";
import qs from "qs";

const METHODS = new Set(["search", "getMediaSource", "getLyric"]);
const SAFE_DEPENDENCIES = new Set(["axios", "big-integer", "cheerio", "crypto-js", "dayjs", "he", "qs"]);

function validatePluginSource(value) {
  const code = String(value || "");
  const blocked = [
    /\bprocess\b/,
    /\bglobalThis\b/,
    /\bglobal\b/,
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bconstructor\b/,
    /\bWebAssembly\b/,
    /\bimport\s*(?:\(|[{'"*])/,
    /__proto__/,
  ];
  if (blocked.some((pattern) => pattern.test(code))) {
    throw new Error("plugin source blocked");
  }
  for (const match of code.matchAll(/\brequire\s*\(\s*(["'])([^"']+)\1\s*\)/g)) {
    if (!SAFE_DEPENDENCIES.has(match[2])) {
      throw new Error("plugin dependency blocked");
    }
  }
  return code;
}

function lockDownWorkerRealm(factory) {
  const prototypes = [
    Object.getPrototypeOf(factory),
    Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}),
    Object.getPrototypeOf(async function* () {}),
  ];
  prototypes.forEach((prototype) => {
    try {
      Object.defineProperty(prototype, "constructor", {
        configurable: false,
        enumerable: false,
        writable: false,
        value: undefined,
      });
    } catch {
      // Already locked by the runtime.
    }
  });
}

function isBlockedAddress(address) {
  const value = String(address || "").toLowerCase().split("%")[0];
  if (net.isIPv4(value)) {
    const [a, b] = value.split(".").map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
  if (!net.isIPv6(value)) {
    return true;
  }
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")) {
    return true;
  }
  const firstGroup = Number.parseInt(value.split(":")[0] || "0", 16);
  if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) {
    return true;
  }
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  return mapped ? isBlockedAddress(mapped) : false;
}

async function assertSafeRemoteUrl(input) {
  const url = new URL(String(input || ""));
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("plugin network target blocked");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || (net.isIP(hostname) && isBlockedAddress(hostname))) {
    throw new Error("plugin network target blocked");
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isBlockedAddress(record.address))) {
    throw new Error("plugin network target blocked");
  }
  return url.href;
}

async function safeFetch(input, init) {
  const href = await assertSafeRemoteUrl(input instanceof URL ? input.href : input);
  return fetch(href, init);
}

function createSafeAxios(instance = axios) {
  const validateConfig = async (urlOrConfig, maybeConfig = {}) => {
    const config = typeof urlOrConfig === "string" ? { ...maybeConfig, url: urlOrConfig } : { ...(urlOrConfig || {}) };
    const combined = config.baseURL ? new URL(String(config.url || ""), String(config.baseURL)).href : config.url;
    config.url = await assertSafeRemoteUrl(combined);
    delete config.baseURL;
    return config;
  };
  const callable = async (config) => instance(await validateConfig(config));
  callable.request = callable;
  ["get", "delete", "head", "options"].forEach((method) => {
    callable[method] = async (url, config) => instance[method]((await validateConfig(url, config)).url, await validateConfig(url, config));
  });
  ["post", "put", "patch"].forEach((method) => {
    callable[method] = async (url, data, config) => instance[method]((await validateConfig(url, config)).url, data, await validateConfig(url, config));
  });
  callable.create = (config = {}) => createSafeAxios(instance.create(config));
  callable.defaults = instance.defaults;
  callable.interceptors = instance.interceptors;
  callable.isAxiosError = axios.isAxiosError;
  callable.default = callable;
  return callable;
}

const packages = new Map([
  ["axios", createSafeAxios()],
  ["big-integer", bigInteger],
  ["cheerio", cheerio],
  ["crypto-js", CryptoJS],
  ["dayjs", dayjs],
  ["he", he],
  ["qs", qs],
]);

function safeRequire(name) {
  if (!packages.has(name)) {
    throw new Error("plugin dependency blocked");
  }
  return packages.get(name);
}

function serialize(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

function loadPlugin() {
  const moduleBox = { exports: {} };
  const code = validatePluginSource(workerData.code);
  const factory = new Function(
    "module",
    "exports",
    "dependency",
    "safeNetwork",
    "hostConsole",
    "safeBuffer",
    "SafeURL",
    "SafeURLSearchParams",
    "safeSetTimeout",
    "safeClearTimeout",
    "safeSetInterval",
    "safeClearInterval",
    `"use strict";
const require = dependency;
const fetch = safeNetwork;
const console = hostConsole;
const Buffer = safeBuffer;
const URL = SafeURL;
const URLSearchParams = SafeURLSearchParams;
const setTimeout = safeSetTimeout;
const clearTimeout = safeClearTimeout;
const setInterval = safeSetInterval;
const clearInterval = safeClearInterval;
const process = undefined;
const global = undefined;
const globalThis = undefined;
const Function = undefined;
${code}
//# sourceURL=source-plugin-worker.js`,
  );
  lockDownWorkerRealm(factory);
  factory(
    moduleBox,
    moduleBox.exports,
    safeRequire,
    safeFetch,
    console,
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  );
  const exported = moduleBox.exports?.default || moduleBox.exports;
  if (!exported || typeof exported !== "object") {
    throw new Error("plugin export missing");
  }
  return exported;
}

let plugin;
try {
  plugin = loadPlugin();
  parentPort.postMessage({
    type: "ready",
    methods: [...METHODS].filter((method) => typeof plugin[method] === "function"),
    metadata: {
      platform: String(plugin.platform || ""),
      supportedSearchType: serialize(plugin.supportedSearchType || []),
    },
  });
} catch {
  parentPort.postMessage({ type: "fatal", error: "plugin initialization failed" });
}

parentPort.on("message", async (message) => {
  if (!plugin || message?.type !== "call" || !METHODS.has(message.method) || typeof plugin[message.method] !== "function") {
    parentPort.postMessage({ type: "result", id: message?.id, ok: false, error: "plugin method blocked" });
    return;
  }
  try {
    const result = await plugin[message.method](...(Array.isArray(message.args) ? message.args : []));
    parentPort.postMessage({ type: "result", id: message.id, ok: true, value: serialize(result) });
  } catch {
    parentPort.postMessage({ type: "result", id: message.id, ok: false, error: "plugin method failed" });
  }
});
