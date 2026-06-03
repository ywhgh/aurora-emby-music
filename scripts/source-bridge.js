#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");
const { URL } = require("node:url");

const BRIDGE_VERSION = "0.1.0";
const AUDIO_EXTENSIONS = new Set([".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".opus"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".flv", ".ts"]);
const LYRIC_EXTENSIONS = [".lrc", ".txt"];
const BILIBILI_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const COVER_NAMES = [
  "cover.jpg",
  "cover.jpeg",
  "cover.png",
  "cover.webp",
  "folder.jpg",
  "folder.jpeg",
  "folder.png",
  "folder.webp",
];

const options = parseArgs(process.argv.slice(2));
const host = options.host || process.env.SOURCE_BRIDGE_HOST || "127.0.0.1";
const port = Number(options.port || process.env.SOURCE_BRIDGE_PORT || process.env.PORT || 5174);
let musicDirs = uniqueStrings([
  ...splitList(options.musicDir),
  ...splitList(process.env.MUSIC_DIR),
  ...splitList(process.env.SOURCE_BRIDGE_MUSIC_DIR),
]).map((item) => path.resolve(item));
let manifestUrls = uniqueStrings([
  ...splitList(options.manifestUrl),
  ...splitList(process.env.SOURCE_MANIFEST_URL),
  ...splitList(process.env.SOURCE_BRIDGE_MANIFEST_URL),
]);

const state = {
  tracks: [],
  trackMap: new Map(),
  manifests: [],
  plugins: [],
  pluginTrackMap: new Map(),
  pluginRuntimeMap: new Map(),
  lastScanAt: "",
};

main().catch((error) => {
  console.error(`[source-bridge] failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  await refreshState();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      if (response.headersSent) {
        response.end();
        return;
      }

      sendJson(request, response, 500, { error: error.message || "source bridge error" });
    });
  });

  server.listen(port, host, () => {
    console.log(`[source-bridge] listening on http://${host}:${port}`);
    console.log(`[source-bridge] local tracks: ${state.tracks.length}`);
    if (musicDirs.length) {
      console.log(`[source-bridge] music dir: ${musicDirs.join(", ")}`);
    }
    if (manifestUrls.length) {
      console.log(`[source-bridge] manifest url: ${manifestUrls.join(", ")}`);
    }
  });
}

async function refreshState() {
  state.tracks = scanMusicDirs(musicDirs);
  state.trackMap = new Map(state.tracks.map((track) => [track.id, track]));
  state.manifests = await Promise.all(manifestUrls.map(loadManifestSummary));
  state.plugins = state.manifests.flatMap((manifest) => manifest.plugins || []).map((plugin, index) => ({
    ...plugin,
    key: createPluginKey(plugin, index),
  }));
  state.pluginTrackMap = new Map();
  state.pluginRuntimeMap = new Map();
  state.lastScanAt = new Date().toISOString();
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    sendEmpty(request, response, 204);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  if (url.pathname === "/configure" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const nextMusicDirs = uniqueStrings([
      ...splitList(payload.musicDir),
      ...splitList(payload.musicDirs),
    ]).map((item) => path.resolve(item));
    const nextManifestUrls = uniqueStrings([
      ...splitList(payload.manifestUrl),
      ...splitList(payload.manifestUrls),
    ]);

    musicDirs = nextMusicDirs;
    manifestUrls = nextManifestUrls;
    await refreshState();
    sendJson(request, response, 200, {
      ok: true,
      localMusicDirs: musicDirs,
      localTrackCount: state.tracks.length,
      manifests: state.manifests,
      lastScanAt: state.lastScanAt,
    });
    return;
  }

  if (url.pathname === "/remote-stream" && (request.method === "GET" || request.method === "HEAD")) {
    await streamRemoteMedia(request, response, url);
    return;
  }

  if (request.method !== "GET") {
    sendJson(request, response, 405, { error: "method not allowed" });
    return;
  }

  if (url.pathname === "/health") {
    sendJson(request, response, 200, {
      name: "音源桥",
      version: BRIDGE_VERSION,
      mode: "other-source-bridge",
      localMusicDirs: musicDirs,
      localTrackCount: state.tracks.length,
      manifests: state.manifests,
      lastScanAt: state.lastScanAt,
    });
    return;
  }

  if (url.pathname === "/tracks") {
    sendTrackPage(request, response, url, state.tracks);
    return;
  }

  if (url.pathname === "/search") {
    const query = String(url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("keyword") || "").trim();
    const tracks = query
      ? await searchTracks(request, url, query)
      : state.tracks;
    sendTrackPage(request, response, url, tracks);
    return;
  }

  if (url.pathname === "/media") {
    const track = getTrackFromUrl(url);

    if (!track) {
      sendJson(request, response, 404, { error: "track not found" });
      return;
    }

    if (track.source === "plugin") {
      const requestedQuality = String(url.searchParams.get("videoQuality") || url.searchParams.get("quality") || "standard");
      const media = await resolvePluginMedia(track, requestedQuality);
      sendJson(request, response, 200, media);
      return;
    }

    const metadata = await resolveLocalMediaMetadata(track);

    sendJson(request, response, 200, {
      id: track.id,
      url: `${getRequestOrigin(request)}/stream?id=${encodeURIComponent(track.id)}`,
      mediaSourceId: `local-media:${track.id}`,
      ...metadata,
    });
    return;
  }

  if (url.pathname === "/stream") {
    const track = getTrackFromUrl(url);

    if (!track) {
      sendJson(request, response, 404, { error: "track not found" });
      return;
    }

    await streamFile(request, response, track.filePath, getAudioContentType(track.codec));
    return;
  }

  if (url.pathname === "/cover") {
    const track = getTrackFromUrl(url);

    if (!track || !track.coverPath) {
      sendJson(request, response, 404, { error: "cover not found" });
      return;
    }

    await streamFile(request, response, track.coverPath, getImageContentType(track.coverPath));
    return;
  }

  if (url.pathname === "/lyric") {
    const track = getTrackFromUrl(url);

    if (!track) {
      sendJson(request, response, 404, { error: "track not found" });
      return;
    }

    if (track.source === "plugin") {
      const lyric = await resolvePluginLyric(track);

      if (!lyric) {
        sendJson(request, response, 404, { error: "lyric not found" });
        return;
      }

      sendJson(request, response, 200, { lrc: lyric });
      return;
    }

    const lyric = findLyric(track.filePath);

    if (!lyric) {
      sendJson(request, response, 404, { error: "lyric not found" });
      return;
    }

    sendJson(request, response, 200, { lrc: fs.readFileSync(lyric, "utf8") });
    return;
  }

  if (url.pathname === "/sources") {
    sendJson(request, response, 200, { manifests: state.manifests });
    return;
  }

  if (url.pathname === "/pick-directory") {
    const directory = await pickDirectory(String(url.searchParams.get("current") || "").trim());
    sendJson(request, response, 200, { directory });
    return;
  }

  if (url.pathname === "/rescan") {
    await refreshState();
    sendJson(request, response, 200, { ok: true, trackCount: state.tracks.length, lastScanAt: state.lastScanAt });
    return;
  }

  sendJson(request, response, 404, { error: "not found" });
}

function sendTrackPage(request, response, url, tracks) {
  const offset = Math.max(0, Number(url.searchParams.get("offset") || url.searchParams.get("startIndex")) || 0);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 100));
  const page = tracks.slice(offset, offset + limit).map((track) => toApiTrack(request, track));

  sendJson(request, response, 200, {
    items: page,
    total: tracks.length,
    offset,
    limit,
  });
}

function toApiTrack(request, track) {
  const origin = getRequestOrigin(request);
  const isPluginTrack = track.source === "plugin";

  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration || 0,
    codec: track.codec,
    bitrate: track.bitrate || 0,
    mediaKind: track.mediaKind || "audio",
    sourceQuality: track.sourceQuality || "",
    qualityLabel: track.qualityLabel || "",
    resolution: track.resolution || "",
    qualityVerified: Boolean(track.qualityVerified),
    platform: track.platform || "local",
    source: track.source || "local",
    cover: isPluginTrack ? (track.cover || "") : (track.coverPath ? `${origin}/cover?id=${encodeURIComponent(track.id)}` : ""),
    artwork: isPluginTrack ? (track.cover || "") : (track.coverPath ? `${origin}/cover?id=${encodeURIComponent(track.id)}` : ""),
    url: "",
    streamUrl: "",
    lyric: track.lyric || "",
    raw: isPluginTrack ? {
      pluginKey: track.pluginKey,
      pluginName: track.pluginName,
      sourceId: track.sourceId,
      mediaKind: track.mediaKind || "audio",
      sourceQuality: track.sourceQuality || "",
      qualityLabel: track.qualityLabel || "",
      resolution: track.resolution || "",
      qualityVerified: Boolean(track.qualityVerified),
    } : undefined,
  };
}

async function searchTracks(request, url, query) {
  const localTracks = state.tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.toLowerCase()));
  const pluginTracks = await searchPluginTracks(request, url, query);
  return dedupeTracks([...localTracks, ...pluginTracks]);
}

async function searchPluginTracks(request, url, query) {
  if (!query || !state.plugins.length) {
    return [];
  }

  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 30));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPluginLimit = Math.max(3, Math.ceil(limit / Math.max(1, Math.min(state.plugins.length, 6))));
  const candidates = state.plugins
    .filter((plugin) => plugin.url && plugin.supported !== false)
    .slice(0, 8);

  const results = await Promise.allSettled(candidates.map(async (plugin) => {
    const runtime = await loadPluginRuntime(plugin);

    if (typeof runtime.module.search !== "function") {
      throw new Error("missing search()");
    }

    const payload = await callWithTimeout(runtime.module.search(query, page, "music"), 18000, `${plugin.name || plugin.key} search timeout`);
    return extractPluginItems(payload)
      .slice(0, perPluginLimit)
      .map((item, index) => createPluginTrack(plugin, item, index));
  }));

  const tracks = [];

  results.forEach((result, index) => {
    const plugin = candidates[index];

    if (result.status !== "fulfilled") {
      plugin.lastError = result.reason?.message || "search failed";
      return;
    }

    plugin.lastError = "";
    tracks.push(...result.value);
  });

  return tracks.slice(0, limit);
}

async function loadPluginRuntime(plugin) {
  const cached = state.pluginRuntimeMap.get(plugin.key);

  if (cached) {
    return cached;
  }

  const code = await fetchText(plugin.url);
  const module = { exports: {} };
  const sandbox = createPluginSandbox(module, plugin);

  vm.createContext(sandbox);
  new vm.Script(code, {
    filename: `source-plugin-${plugin.key}.js`,
    displayErrors: true,
  }).runInContext(sandbox, {
    timeout: 8000,
  });

  const exported = module.exports?.default || module.exports;

  if (!exported || typeof exported !== "object") {
    throw new Error("插件没有导出可用对象");
  }

  const runtime = {
    plugin,
    module: exported,
    loadedAt: new Date().toISOString(),
  };

  plugin.platform = plugin.platform || exported.platform || plugin.name || "音源";
  plugin.supportedSearchType = exported.supportedSearchType || plugin.supportedSearchType || [];
  state.pluginRuntimeMap.set(plugin.key, runtime);
  return runtime;
}

function createPluginSandbox(module, plugin) {
  const allowedModules = new Set([
    "axios",
    "crypto-js",
    "qs",
    "big-integer",
    "dayjs",
    "cheerio",
    "he",
  ]);
  const sandboxExports = module.exports;

  const sandbox = {
    module,
    exports: sandboxExports,
    require(name) {
      if (allowedModules.has(name)) {
        const loaded = require(name);

        if (name === "axios") {
          loaded.defaults.timeout = 18000;
        }

        return loaded;
      }

      throw new Error(`插件依赖未允许：${name}`);
    },
    console,
    Buffer,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Math,
    Date,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (value) => Buffer.from(String(value), "binary").toString("base64"),
    atob: (value) => Buffer.from(String(value), "base64").toString("binary"),
    fetch: globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined,
    global: null,
    globalThis: null,
    process: {
      env: {},
      platform: process.platform,
    },
    __pluginName: plugin.name || plugin.key,
  };

  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function extractPluginItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.data,
    payload?.musicList,
    payload?.items,
    payload?.tracks,
    payload?.songs,
    payload?.list,
    payload?.result,
    payload?.data?.musicList,
    payload?.data?.items,
    payload?.data?.tracks,
    payload?.data?.songs,
    payload?.data?.list,
    payload?.result?.data,
    payload?.result?.items,
  ];

  return candidates.find(Array.isArray) || [];
}

function createPluginTrack(plugin, item, index) {
  const sourceId = getPluginItemId(item, index);
  const id = `plugin:${plugin.key}:${encodeURIComponent(sourceId)}`;
  const title = pickFirstString(item.title, item.name, item.Name, item.songName, item.musicName) || "未命名歌曲";
  const artist = pickFirstString(item.artist, item.singer, item.author, item.artistName, item.Artist) || "未知艺人";
  const album = pickFirstString(item.album, item.albumName, item.Album) || "";
  const cover = normalizeRemoteUrl(pickFirstString(item.artwork, item.cover, item.pic, item.picture, item.img, item.albumPic));
  const mediaUrl = normalizeRemoteUrl(pickFirstString(item.streamUrl, item.src, item.playUrl));
  const mediaKind = isBilibiliPlugin(plugin) ? "video" : inferMediaKind(item, mediaUrl);
  const codec = inferCodec(item, { mediaKind, mediaUrl });
  const bitrate = inferBitrate(item);
  const resolution = inferResolution(item, mediaUrl);
  const maxQuality = inferMaxSourceQuality(item, { mediaKind, codec, bitrate, resolution, mediaUrl, platform: plugin.name || plugin.platform || plugin.key });
  const sourceQuality = maxQuality.sourceQuality || inferSourceQuality(item, { mediaKind, codec, bitrate, resolution });
  const qualityLabel = maxQuality.qualityLabel || inferQualityLabel(item, { mediaKind, codec, bitrate, resolution, sourceQuality });
  const track = {
    id,
    sourceId,
    source: "plugin",
    pluginKey: plugin.key,
    pluginName: plugin.name || plugin.platform || "音源",
    platform: plugin.name || plugin.platform || "音源",
    title,
    artist,
    album,
    codec,
    bitrate,
    mediaKind,
    sourceQuality,
    qualityLabel,
    resolution,
    qualityVerified: false,
    duration: normalizeDurationSeconds(item.duration ?? item.durationSeconds ?? item.interval ?? item.time),
    cover,
    mediaUrl,
    lyric: pickFirstString(item.lyric, item.lyrics, item.lrc, item.rawLrc),
    raw: item,
  };

  state.pluginTrackMap.set(id, track);
  state.pluginTrackMap.set(sourceId, track);
  return track;
}

async function resolvePluginMedia(track, quality) {
  const runtime = await loadPluginRuntime(getPluginByKey(track.pluginKey));

  if (isBilibiliTrack(track)) {
    const media = await resolveBilibiliMedia(track, quality);

    if (media) {
      return media;
    }
  }

  const directUrl = normalizeRemoteUrl(track.mediaUrl || pickFirstString(track.raw?.streamUrl, track.raw?.src, track.raw?.playUrl));

  if (directUrl) {
    const directMediaKind = track.mediaKind || inferMediaKind(track.raw, directUrl);
    const directCodec = track.codec || inferCodec(track.raw, { mediaKind: directMediaKind, mediaUrl: directUrl });
    const directBitrate = track.bitrate || inferBitrate(track.raw) || 0;
    const directResolution = track.resolution || inferResolution(track.raw, directUrl) || "";
    const directSourceQuality = track.sourceQuality || inferSourceQuality(track.raw, {
      mediaKind: directMediaKind,
      codec: directCodec,
      bitrate: directBitrate,
      resolution: directResolution,
    });
    const directQualityLabel = track.qualityLabel || inferQualityLabel(track.raw, {
      mediaKind: directMediaKind,
      codec: directCodec,
      bitrate: directBitrate,
      resolution: directResolution,
      sourceQuality: directSourceQuality,
    });

    return {
      id: track.id,
      url: directUrl,
      streamUrl: directUrl,
      mediaSourceId: `plugin-media:${track.pluginKey}:${track.sourceId}`,
      mediaKind: directMediaKind,
      codec: directCodec,
      bitrate: directBitrate,
      sourceQuality: directSourceQuality,
      qualityLabel: directQualityLabel,
      resolution: directResolution,
      qualityVerified: hasResolvedBridgeQuality({
        mediaKind: directMediaKind,
        codec: directCodec,
        bitrate: directBitrate,
        sourceQuality: directSourceQuality,
        qualityLabel: directQualityLabel,
        resolution: directResolution,
      }),
    };
  }

  if (typeof runtime.module.getMediaSource !== "function") {
    throw new Error("这个插件没有提供播放地址解析。");
  }

  const pluginQuality = mapPluginQuality(quality);
  const payload = await callWithTimeout(runtime.module.getMediaSource(track.raw, pluginQuality), 18000, `${track.pluginName || track.pluginKey} media timeout`);
  const mediaUrl = normalizeRemoteUrl(pickFirstString(
    payload?.url,
    payload?.streamUrl,
    payload?.src,
    payload?.playUrl,
    payload?.data?.url,
    payload?.data?.streamUrl,
    payload?.data?.src,
  ));

  if (!mediaUrl) {
    throw new Error("插件没有返回可播放地址。");
  }

  track.mediaUrl = mediaUrl;
  track.mediaKind = track.mediaKind === "video"
    ? "video"
    : (inferMediaKind(payload, mediaUrl) || track.mediaKind || "audio");
  track.codec = inferCodec(payload, { mediaKind: track.mediaKind, mediaUrl }) || track.codec;
  track.bitrate = inferBitrate(payload) || track.bitrate || 0;
  track.resolution = inferResolution(payload, mediaUrl) || track.resolution || "";
  track.sourceQuality = inferSourceQuality(payload, {
    mediaKind: track.mediaKind,
    codec: track.codec,
    bitrate: track.bitrate,
    resolution: track.resolution,
  }) || track.sourceQuality || "";
  track.qualityLabel = inferQualityLabel(payload, {
    mediaKind: track.mediaKind,
    codec: track.codec,
    bitrate: track.bitrate,
    resolution: track.resolution,
    sourceQuality: track.sourceQuality,
  }) || track.qualityLabel || "";
  track.qualityVerified = hasResolvedBridgeQuality({
    mediaKind: track.mediaKind,
    codec: track.codec,
    bitrate: track.bitrate,
    sourceQuality: track.sourceQuality,
    qualityLabel: track.qualityLabel,
    resolution: track.resolution,
  });

  return {
    id: track.id,
    url: mediaUrl,
    streamUrl: mediaUrl,
    mediaSourceId: `plugin-media:${track.pluginKey}:${track.sourceId}`,
    mediaKind: track.mediaKind,
    codec: track.codec,
    bitrate: track.bitrate || 0,
    sourceQuality: track.sourceQuality || "",
    qualityLabel: track.qualityLabel || "",
    resolution: track.resolution || "",
    qualityVerified: Boolean(track.qualityVerified),
    raw: payload,
  };
}

async function resolveBilibiliMedia(track, quality) {
  const bvid = pickFirstId(track.raw?.bvid, track.raw?.album, track.sourceId);
  const aid = pickFirstId(track.raw?.aid);
  const cid = await resolveBilibiliCid(track, bvid, aid);

  if (!cid || (!bvid && !aid)) {
    return null;
  }

  const requestQuality = mapBilibiliQuality(quality);
  const playInfo = await fetchBilibiliPlayUrl({ bvid, aid, cid, qn: requestQuality, fnval: 0 });
  const durl = Array.isArray(playInfo?.durl) ? playInfo.durl.find((item) => normalizeRemoteUrl(item?.url)) : null;
  const mediaUrl = normalizeRemoteUrl(durl?.url);
  const referer = `https://www.bilibili.com/video/${bvid || `av${aid}`}`;

  if (mediaUrl) {
    const proxiedUrl = createRemoteStreamUrl(mediaUrl, {
      referer,
      userAgent: BILIBILI_USER_AGENT,
      contentType: "video/mp4",
    });
    const resolution = inferBilibiliResolution(playInfo) || track.resolution || "720P";

    track.mediaUrl = proxiedUrl;
    track.mediaKind = "video";
    track.codec = "MP4";
    track.resolution = resolution;
    track.sourceQuality = resolution;
    track.qualityLabel = ["MV", resolution].filter(Boolean).join(" ");

    return {
      id: track.id,
      url: proxiedUrl,
      streamUrl: proxiedUrl,
      mediaSourceId: `plugin-media:${track.pluginKey}:${track.sourceId}`,
      mediaKind: "video",
      codec: "MP4",
      bitrate: Number(durl?.size || 0) > 0 && Number(track.duration || 0) > 0
        ? Math.round((Number(durl.size) * 8) / Number(track.duration))
        : 0,
      sourceQuality: track.sourceQuality,
      qualityLabel: track.qualityLabel,
      resolution,
      qualityVerified: true,
      contentType: "video/mp4",
      raw: {
        provider: "bilibili",
        bvid,
        aid,
        cid,
        quality: playInfo?.quality,
        format: playInfo?.format,
        acceptDescription: playInfo?.accept_description,
      },
    };
  }

  const dashInfo = await fetchBilibiliPlayUrl({ bvid, aid, cid, qn: requestQuality, fnval: 16 });
  const videos = Array.isArray(dashInfo?.dash?.video) ? dashInfo.dash.video : [];
  const audios = Array.isArray(dashInfo?.dash?.audio) ? dashInfo.dash.audio : [];
  const video = pickBestBilibiliDashVideo(videos, requestQuality);
  const audio = audios.slice().sort((left, right) => Number(right?.bandwidth || 0) - Number(left?.bandwidth || 0))[0];
  const videoUrl = normalizeRemoteUrl(video?.baseUrl || video?.base_url);
  const audioUrl = normalizeRemoteUrl(audio?.baseUrl || audio?.base_url);

  if (!videoUrl) {
    return null;
  }

  const proxiedVideoUrl = createRemoteStreamUrl(videoUrl, {
    referer,
    userAgent: BILIBILI_USER_AGENT,
    contentType: "video/mp4",
  });
  const proxiedAudioUrl = audioUrl ? createRemoteStreamUrl(audioUrl, {
    referer,
    userAgent: BILIBILI_USER_AGENT,
    contentType: "audio/mp4",
  }) : "";
  const resolution = inferBilibiliDashResolution(video) || inferBilibiliResolution(dashInfo) || track.resolution || "视频";

  track.mediaUrl = proxiedVideoUrl;
  track.mediaKind = "video";
  track.codec = "DASH";
  track.resolution = resolution;
  track.sourceQuality = resolution;
  track.qualityLabel = ["MV", resolution].filter(Boolean).join(" ");

  return {
    id: track.id,
    url: proxiedVideoUrl,
    streamUrl: proxiedVideoUrl,
    mediaSourceId: `plugin-media:${track.pluginKey}:${track.sourceId}`,
    mediaKind: "video",
    codec: "DASH",
    bitrate: Number(video?.bandwidth || 0),
    sourceQuality: track.sourceQuality,
    qualityLabel: track.qualityLabel,
    resolution,
    qualityVerified: true,
    contentType: "video/mp4",
    dash: {
      videoUrl: proxiedVideoUrl,
      audioUrl: proxiedAudioUrl,
      mimeType: pickFirstString(video?.mimeType, video?.mime_type) || "video/mp4",
      audioMimeType: pickFirstString(audio?.mimeType, audio?.mime_type) || "audio/mp4",
    },
    raw: {
      provider: "bilibili",
      bvid,
      aid,
      cid,
      quality: dashInfo?.quality,
      format: dashInfo?.format,
      acceptDescription: dashInfo?.accept_description,
      dashOnly: true,
    },
  };
}

async function resolveBilibiliCid(track, bvid, aid) {
  const directCid = pickFirstId(track.raw?.cid);

  if (directCid) {
    return directCid;
  }

  const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");

  if (bvid) {
    viewUrl.searchParams.set("bvid", bvid);
  } else if (aid) {
    viewUrl.searchParams.set("aid", aid);
  }

  const payload = await fetchJsonWithHeaders(viewUrl.toString(), getBilibiliRequestHeaders(bvid || aid));
  const cid = pickFirstId(payload?.data?.cid, payload?.data?.pages?.[0]?.cid);

  if (cid) {
    track.raw = {
      ...(track.raw || {}),
      bvid: pickFirstId(payload?.data?.bvid, bvid),
      aid: pickFirstId(payload?.data?.aid, aid),
      cid,
    };
  }

  return cid;
}

async function fetchBilibiliPlayUrl({ bvid, aid, cid, qn, fnval }) {
  const playUrl = new URL("https://api.bilibili.com/x/player/playurl");

  if (bvid) {
    playUrl.searchParams.set("bvid", bvid);
  } else if (aid) {
    playUrl.searchParams.set("aid", aid);
  }

  playUrl.searchParams.set("cid", cid);
  playUrl.searchParams.set("qn", String(qn || 64));
  playUrl.searchParams.set("fnval", String(fnval || 0));
  playUrl.searchParams.set("fourk", "1");

  const payload = await fetchJsonWithHeaders(playUrl.toString(), getBilibiliRequestHeaders(bvid || aid));

  if (payload?.code !== 0) {
    throw new Error(payload?.message || "Bilibili 播放地址解析失败。");
  }

  return payload?.data || {};
}

function getBilibiliRequestHeaders(id = "") {
  const referer = /^BV/i.test(String(id || ""))
    ? `https://www.bilibili.com/video/${id}`
    : "https://www.bilibili.com/";

  return {
    "User-Agent": BILIBILI_USER_AGENT,
    Accept: "application/json, text/plain, */*",
    Referer: referer,
    Origin: "https://www.bilibili.com",
  };
}

function isBilibiliPlugin(plugin) {
  const text = `${plugin?.name || ""} ${plugin?.platform || ""} ${plugin?.key || ""} ${plugin?.url || ""}`.toLowerCase();
  return text.includes("bilibili");
}

function isBilibiliTrack(track) {
  return track?.source === "plugin" && /bilibili/i.test(`${track.pluginName || ""} ${track.pluginKey || ""} ${track.platform || ""}`);
}

function mapBilibiliQuality(value) {
  const normalized = String(value || "").toLowerCase();

  if (/(video[-_ ]?4k|4k|2160)/.test(normalized)) {
    return 120;
  }

  if (/(video[-_ ]?1080|1080)/.test(normalized)) {
    return 80;
  }

  if (/(video[-_ ]?720|720)/.test(normalized)) {
    return 64;
  }

  if (/(video[-_ ]?480|480)/.test(normalized)) {
    return 32;
  }

  if (/(super|lossless|flac|hires|最高|无损|mv|video)/.test(normalized)) {
    return 120;
  }

  if (/(high|320|384|高)/.test(normalized)) {
    return 80;
  }

  if (/(low|128|省|低)/.test(normalized)) {
    return 32;
  }

  return 64;
}

function inferBilibiliResolution(playInfo) {
  const quality = Number(playInfo?.quality || 0);
  const descriptions = Array.isArray(playInfo?.accept_description) ? playInfo.accept_description : [];
  const qualities = Array.isArray(playInfo?.accept_quality) ? playInfo.accept_quality : [];
  const index = qualities.findIndex((item) => Number(item) === quality);
  const label = index >= 0 ? String(descriptions[index] || "") : String(playInfo?.format || "");

  if (/4k|2160/i.test(label) || quality >= 120) {
    return "4K";
  }

  if (/1080/.test(label) || quality >= 80) {
    return "1080P";
  }

  if (/720/.test(label) || quality >= 64) {
    return "720P";
  }

  if (/480/.test(label) || quality >= 32) {
    return "480P";
  }

  if (/360/.test(label) || quality > 0) {
    return "360P";
  }

  return "";
}

function inferBilibiliDashResolution(video) {
  const height = Number(video?.height || 0);

  if (height >= 2160) {
    return "4K";
  }

  if (height >= 1440) {
    return "1440P";
  }

  if (height >= 1080) {
    return "1080P";
  }

  if (height >= 720) {
    return "720P";
  }

  if (height >= 480) {
    return "480P";
  }

  if (height >= 360) {
    return "360P";
  }

  return "";
}

function pickBestBilibiliDashVideo(videos, preferredQuality) {
  if (!videos.length) {
    return null;
  }

  return videos
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(Number(left?.id || 0) - preferredQuality);
      const rightDistance = Math.abs(Number(right?.id || 0) - preferredQuality);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return Number(right?.bandwidth || 0) - Number(left?.bandwidth || 0);
    })[0];
}

function createRemoteStreamUrl(mediaUrl, options = {}) {
  const proxyUrl = new URL(`http://${host}:${port}/remote-stream`);
  proxyUrl.searchParams.set("url", mediaUrl);

  if (options.referer) {
    proxyUrl.searchParams.set("referer", options.referer);
  }

  if (options.userAgent) {
    proxyUrl.searchParams.set("ua", options.userAgent);
  }

  if (options.contentType) {
    proxyUrl.searchParams.set("type", options.contentType);
  }

  return proxyUrl.toString();
}

async function resolvePluginLyric(track) {
  if (track.lyric) {
    return track.lyric;
  }

  const runtime = await loadPluginRuntime(getPluginByKey(track.pluginKey));

  if (typeof runtime.module.getLyric !== "function") {
    return "";
  }

  const payload = await callWithTimeout(runtime.module.getLyric(track.raw), 18000, `${track.pluginName || track.pluginKey} lyric timeout`);
  const lyric = pickFirstString(
    payload?.rawLrc,
    payload?.lrc,
    payload?.lyric,
    payload?.lyrics,
    payload?.text,
    payload?.data?.rawLrc,
    payload?.data?.lrc,
    payload?.data?.lyric,
    payload?.data?.lyrics,
  );

  track.lyric = lyric;
  return lyric;
}

function scanMusicDirs(dirs) {
  const tracks = [];

  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) {
      continue;
    }

    for (const filePath of walkFiles(dir)) {
      const ext = path.extname(filePath).toLowerCase();

      if (!AUDIO_EXTENSIONS.has(ext)) {
        continue;
      }

      tracks.push(createTrack(filePath, dir));
    }
  }

  return tracks.sort((a, b) => `${a.artist} ${a.album} ${a.title}`.localeCompare(`${b.artist} ${b.album} ${b.title}`, "zh-Hans"));
}

function* walkFiles(root) {
  const entries = safeReadDir(root);

  for (const entry of entries) {
    const filePath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(filePath);
    } else if (entry.isFile()) {
      yield filePath;
    }
  }
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function createTrack(filePath, rootDir) {
  const parsed = path.parse(filePath);
  const titleParts = parseTitle(parsed.name);
  const relative = path.relative(rootDir, filePath);
  const parent = path.basename(path.dirname(filePath));
  const grandParent = path.basename(path.dirname(path.dirname(filePath)));
  const id = crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 20);
  const codec = parsed.ext.replace(".", "").toUpperCase();
  const sourceQuality = isLosslessBridgeCodec(codec) ? "SQ" : "";

  return {
    id,
    filePath,
    rootDir,
    relative,
    title: titleParts.title || parsed.name,
    artist: titleParts.artist || grandParent || "本地音乐",
    album: parent && parent !== "." ? parent : "本地音乐",
    codec,
    sourceQuality,
    qualityLabel: codec,
    qualityVerified: true,
    mediaKind: "audio",
    coverPath: findCover(path.dirname(filePath)),
  };
}

async function resolveLocalMediaMetadata(track) {
  const probed = await probeLocalMediaMetadata(track.filePath);
  const codec = normalizeCodecToken(probed.codec || track.codec);
  const bitrate = Number(probed.bitrate || track.bitrate || 0);
  const sourceQuality = inferSourceQuality({
    sourceQuality: track.sourceQuality,
    qualityLabel: track.qualityLabel,
  }, {
    mediaKind: "audio",
    codec,
    bitrate,
  }) || track.sourceQuality || "";
  const qualityLabel = bitrate > 0 && !isLosslessBridgeCodec(codec)
    ? `${Math.round(bitrate / 1000)}k`
    : (codec || track.qualityLabel || "");

  track.codec = codec || track.codec;
  track.bitrate = bitrate || track.bitrate || 0;
  track.sourceQuality = sourceQuality;
  track.qualityLabel = qualityLabel;
  track.qualityVerified = true;

  return {
    mediaKind: "audio",
    codec: track.codec || "",
    bitrate: track.bitrate || 0,
    sourceQuality: track.sourceQuality || "",
    qualityLabel: track.qualityLabel || "",
    resolution: "",
    qualityVerified: true,
  };
}

async function probeLocalMediaMetadata(filePath) {
  if (!filePath) {
    return {};
  }

  try {
    const payload = await execFileJson("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "stream=codec_name,bit_rate",
      "-of",
      "json",
      filePath,
    ], 4000);
    const stream = Array.isArray(payload?.streams) ? payload.streams[0] : null;
    return {
      codec: stream?.codec_name || "",
      bitrate: Number(stream?.bit_rate || 0),
    };
  } catch {
    return {};
  }
}

function execFileJson(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, {
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

function parseTitle(name) {
  const match = String(name || "").match(/^\s*(.+?)\s+-\s+(.+?)\s*$/);

  if (!match) {
    return { artist: "", title: name };
  }

  return {
    artist: match[1].trim(),
    title: match[2].trim(),
  };
}

function findCover(dir) {
  for (const name of COVER_NAMES) {
    const filePath = path.join(dir, name);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return "";
}

function findLyric(audioPath) {
  const parsed = path.parse(audioPath);

  for (const ext of LYRIC_EXTENSIONS) {
    const filePath = path.join(parsed.dir, `${parsed.name}${ext}`);

    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return "";
}

async function loadManifestSummary(url) {
  try {
    const payload = await fetchJson(url);
    const plugins = Array.isArray(payload?.plugins)
      ? payload.plugins.map((plugin) => ({
        name: plugin?.name || "",
        url: plugin?.url || "",
        version: plugin?.version || "",
        supported: Boolean(plugin?.url),
      }))
      : [];

    return {
      url,
      type: plugins.length ? "plugin-manifest" : "json",
      pluginCount: plugins.length,
      plugins,
      executable: Boolean(plugins.length),
      note: plugins.length
        ? "已识别为音源插件清单；搜索时会由本地音源桥加载插件并转换为 /search、/media 标准接口。"
        : "已读取 JSON；如需播放，请转换为 /tracks、/search、/media 标准接口。",
    };
  } catch (error) {
    return {
      url,
      type: "unknown",
      pluginCount: 0,
      plugins: [],
      executable: false,
      error: error.message,
    };
  }
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = (globalThis.fetch
      ? globalThis.fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      : fetchTextWithHttp(url));

    Promise.resolve(request).then(resolve, reject);
  });
}

function fetchTextWithHttp(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? require("node:https") : require("node:http");
    const request = client.get(target, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });
    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("request timeout"));
    });
  });
}

function createPluginKey(plugin, index) {
  const basis = `${plugin.name || "plugin"}:${plugin.url || index}`;
  const slug = String(plugin.name || "plugin")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "plugin";
  const hash = crypto.createHash("sha1").update(basis).digest("hex").slice(0, 10);
  return `${slug}-${hash}`;
}

function getPluginByKey(key) {
  const plugin = state.plugins.find((item) => item.key === key);

  if (!plugin) {
    throw new Error("找不到对应音源插件。");
  }

  return plugin;
}

function getPluginItemId(item, index) {
  const direct = String(item?.id ?? item?.Id ?? item?.mid ?? item?.songmid ?? item?.hash ?? item?.rid ?? item?.songId ?? "").trim();

  if (direct) {
    return direct;
  }

  return crypto.createHash("sha1").update(JSON.stringify(item || {}) || String(index)).digest("hex").slice(0, 16);
}

function pickFirstString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function pickFirstId(...values) {
  const value = values.find((item) => {
    if (typeof item === "number") {
      return Number.isFinite(item);
    }

    return typeof item === "string" && item.trim();
  });

  return value == null ? "" : String(value).trim();
}

function normalizeRemoteUrl(value) {
  const raw = String(value || "").trim();

  if (!raw || /^javascript:/i.test(raw)) {
    return "";
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return "";
}

function inferMediaKind(item, mediaUrl = "") {
  const explicit = [
    item?.mediaKind,
    item?.mediaType,
    item?.MediaType,
    item?.kind,
    item?.category,
    item?.contentType,
    item?.type,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean).join(" ");
  const titleText = [
    item?.title,
    item?.name,
    item?.Name,
    item?.songName,
    item?.musicName,
    item?.subtitle,
    item?.description,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean).join(" ");
  const urlExt = getUrlExtension(mediaUrl || pickFirstString(item?.url, item?.streamUrl, item?.src, item?.playUrl));
  const hasVideoMarker = Boolean(
    item?.isVideo
    || item?.hasVideo
    || item?.hasMv
    || item?.mv
    || item?.mvid
    || item?.mvId
    || item?.videoId
    || item?.vid
  );
  const hasExplicitVideoTitle = /(?:\bmv\b\s*(?:版|video|视频|官方|live|1080|720|4k)|(?:mv|music\s*video|video|视频)\s*(?:版|官方|高清|1080|720|4k)|\(\s*mv(?:\s*版)?\s*\)|（\s*mv(?:\s*版)?\s*）)/i.test(titleText);

  if (hasVideoMarker || hasExplicitVideoTitle || /\b(mv|mvideo|video|movie|vod)\b|视频|音乐视频/.test(explicit) || VIDEO_EXTENSIONS.has(urlExt)) {
    return "video";
  }

  return "audio";
}

function inferCodec(item, options = {}) {
  const explicit = normalizeCodecToken(pickFirstString(
    item?.codec,
    item?.format,
    item?.container,
    item?.fileType,
    item?.ext,
    item?.extension,
  ));

  if (explicit) {
    return explicit;
  }

  const mediaUrl = options.mediaUrl || pickFirstString(item?.url, item?.streamUrl, item?.src, item?.playUrl);
  const urlExt = getUrlExtension(mediaUrl);

  if (urlExt) {
    return urlExt.slice(1).toUpperCase();
  }

  const text = stringifyQualityFields(item).toLowerCase();

  if (/(flac|lossless|无损|sq|hi[\s-]?res|hires)/.test(text)) {
    return "FLAC";
  }

  if (/(aac|m4a|mp4a)/.test(text)) {
    return "AAC";
  }

  if (/(opus)/.test(text)) {
    return "OPUS";
  }

  if (/(mp3|mpeg)/.test(text)) {
    return "MP3";
  }

  return options.mediaKind === "video" ? "VIDEO" : "";
}

function inferBitrate(item) {
  const direct = Number(item?.bitrate ?? item?.bitRate ?? item?.br ?? item?.maxbr ?? item?.kbps);

  if (Number.isFinite(direct) && direct > 0) {
    return direct < 10000 ? Math.round(direct * 1000) : Math.round(direct);
  }

  const text = stringifyQualityFields(item).toLowerCase();

  if (/(flac|lossless|hires|sq)/.test(text)) {
    return 1000000;
  }

  if (/320/.test(text)) {
    return 320000;
  }

  if (/192/.test(text)) {
    return 192000;
  }

  if (/128/.test(text)) {
    return 128000;
  }

  return 0;
}

function inferResolution(item, mediaUrl = "") {
  const text = [
    item?.resolution,
    item?.quality,
    item?.qualityLabel,
    item?.sourceQuality,
    item?.level,
    item?.formats,
    item?.qualities,
    mediaUrl,
  ].map((value) => stringifyLoose(value)).join(" ").toLowerCase();
  const height = Number(item?.height || item?.videoHeight);

  if (Number.isFinite(height) && height > 0) {
    return `${Math.round(height)}P`;
  }

  if (/(4k|2160p|uhd)/.test(text)) {
    return "4K";
  }

  const match = text.match(/\b(1440|1080|720|540|480|360|240)\s*p?\b/);
  return match ? `${match[1]}P` : "";
}

function inferMaxSourceQuality(item, context = {}) {
  const mediaKind = context.mediaKind || inferMediaKind(item, context.mediaUrl || "");
  const text = stringifyQualityFields(item).toLowerCase();

  if (mediaKind === "video") {
    const resolution = context.resolution || inferResolution(item, context.mediaUrl || "");
    const label = ["MV", resolution || (/(mv|video|视频|音乐视频)/.test(text) ? "视频" : "")].filter(Boolean).join(" ");
    return {
      sourceQuality: resolution,
      qualityLabel: label,
      resolution,
    };
  }

  if (/(hi[\s-]?res|hires|24bit|24\s*bit|母带|master)/.test(text)) {
    return { sourceQuality: "Hi-Res", qualityLabel: "Hi-Res", resolution: "" };
  }

  if (/(lossless|flac|alac|wav|ape|无损|sq)/.test(text)) {
    return { sourceQuality: "SQ", qualityLabel: /flac/.test(text) ? "FLAC" : "SQ", resolution: "" };
  }

  const bitrates = [...text.matchAll(/\b(128|192|256|320|384)\s*k(?:bps)?\b/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const maxBitrate = bitrates.length ? Math.max(...bitrates) : 0;

  if (maxBitrate > 0) {
    return {
      sourceQuality: maxBitrate >= 300 ? "HQ" : "标准",
      qualityLabel: `${maxBitrate}k`,
      resolution: "",
    };
  }

  if (/(hq|高品|高音质)/.test(text)) {
    return { sourceQuality: "HQ", qualityLabel: "HQ", resolution: "" };
  }

  return { sourceQuality: "", qualityLabel: "", resolution: "" };
}

function inferSourceQuality(item, context = {}) {
  const explicit = pickFirstString(item?.sourceQuality, item?.qualityLabel, item?.quality, item?.level);
  const text = `${explicit} ${stringifyQualityFields(item)}`.toLowerCase();

  if (context.mediaKind === "video") {
    return context.resolution || inferResolution(item) || (/(mv|video|视频)/.test(text) ? "MV" : "");
  }

  if (/(hi[\s-]?res|hires|24bit|24\s*bit|母带|master)/.test(text)) {
    return "Hi-Res";
  }

  if (/(lossless|flac|alac|wav|ape|无损|sq)/.test(text)) {
    return "SQ";
  }

  if (/(hq|高品|高音质|320|384)/.test(text)) {
    return "HQ";
  }

  if (/(standard|标准|普通|128|192)/.test(text)) {
    return "标准";
  }

  if (context.bitrate >= 900000 || isLosslessBridgeCodec(context.codec)) {
    return "SQ";
  }

  if (context.bitrate >= 300000) {
    return "HQ";
  }

  if (context.bitrate > 0) {
    return "标准";
  }

  return "";
}

function inferQualityLabel(item, context = {}) {
  const explicit = pickFirstString(item?.qualityLabel, item?.qualityText, item?.qualityName);

  if (explicit) {
    return normalizeQualityLabel(explicit, context);
  }

  if (context.mediaKind === "video") {
    return ["MV", context.resolution || inferResolution(item)].filter(Boolean).join(" ");
  }

  const bitrate = Number(context.bitrate || inferBitrate(item) || 0);
  const codec = normalizeCodecToken(context.codec || inferCodec(item));
  const sourceQuality = context.sourceQuality || inferSourceQuality(item, context);

  if (sourceQuality === "Hi-Res") {
    return "Hi-Res";
  }

  if (sourceQuality === "SQ") {
    return codec && codec !== "MP3" ? codec : "SQ";
  }

  if (bitrate > 0) {
    return `${Math.round(bitrate / 1000)}k`;
  }

  if (sourceQuality === "HQ") {
    return "HQ";
  }

  if (sourceQuality === "标准") {
    return "标准";
  }

  return codec || "";
}

function normalizeQualityLabel(value, context = {}) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return "";
  }

  if (context.mediaKind === "video" && !/^mv\b/i.test(raw)) {
    return ["MV", context.resolution || inferResolution({ quality: raw })].filter(Boolean).join(" ");
  }

  if (/(hi[\s-]?res|hires|母带|master)/.test(lower)) {
    return "Hi-Res";
  }

  if (/(lossless|flac|无损|sq)/.test(lower)) {
    return "SQ";
  }

  const bitrate = lower.match(/\b(128|192|256|320|384)\s*k(?:bps)?\b/);

  if (bitrate) {
    return `${bitrate[1]}k`;
  }

  if (/(hq|高品|高音质)/.test(lower)) {
    return "HQ";
  }

  return raw;
}

function normalizeCodecToken(value) {
  const token = String(value || "")
    .split(",")[0]
    .trim()
    .replace(/^\./, "")
    .toUpperCase();
  const labels = {
    MPEG4: "AAC",
    MP4A: "AAC",
    M4A: "AAC",
    MPEG: "MP3",
    VIDEO: "VIDEO",
  };

  if (!token || /^(MUSIC|AUDIO|SONG|TRACK|MV|VIDEO|UNKNOWN|EXTERNAL)$/.test(token)) {
    return labels[token] || (token === "VIDEO" ? "VIDEO" : "");
  }

  return labels[token] || token;
}

function stringifyQualityFields(item) {
  return [
    item?.quality,
    item?.qualityLabel,
    item?.qualityText,
    item?.qualityName,
    item?.sourceQuality,
    item?.level,
    item?.bitrate,
    item?.bitRate,
    item?.br,
    item?.maxbr,
    item?.kbps,
    item?.codec,
    item?.format,
    item?.container,
    item?.formats,
    item?.qualities,
    item?.formatList,
    item?.files,
    item?.data?.quality,
    item?.data?.qualityLabel,
    item?.data?.qualityText,
    item?.data?.qualityName,
    item?.data?.sourceQuality,
    item?.data?.level,
    item?.data?.bitrate,
    item?.data?.bitRate,
    item?.data?.br,
    item?.data?.maxbr,
    item?.data?.kbps,
    item?.data?.codec,
    item?.data?.format,
    item?.data?.container,
    item?.data?.formats,
    item?.data?.qualities,
  ].map((value) => stringifyLoose(value)).filter(Boolean).join(" ");
}

function hasResolvedBridgeQuality(context = {}) {
  const mediaKind = String(context.mediaKind || "").toLowerCase() === "video" ? "video" : "audio";

  if (mediaKind === "video") {
    return Boolean(context.resolution || context.qualityLabel || context.bitrate || (context.codec && context.codec !== "VIDEO"));
  }

  return Boolean(
    context.qualityLabel
      || context.sourceQuality
      || context.bitrate
      || (context.codec && !["AUDIO", "MUSIC", "SONG", "TRACK", "UNKNOWN"].includes(String(context.codec).toUpperCase()))
  );
}

function stringifyLoose(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function getUrlExtension(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    return path.extname(new URL(raw, "http://source.local").pathname).toLowerCase();
  } catch {
    return path.extname(raw.split(/[?#]/)[0]).toLowerCase();
  }
}

function isLosslessBridgeCodec(codec) {
  return ["FLAC", "ALAC", "WAV", "PCM", "APE", "DSD"].includes(String(codec || "").toUpperCase());
}

function normalizeDurationSeconds(value) {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  if (duration > 36000) {
    return Math.round(duration / 1000);
  }

  return Math.round(duration);
}

function mapPluginQuality(value) {
  const normalized = String(value || "").toLowerCase();

  if (/(video[-_ ]?4k|4k|2160)/.test(normalized)) {
    return "4k";
  }

  if (/(video[-_ ]?1080|1080)/.test(normalized)) {
    return "1080p";
  }

  if (/(video[-_ ]?720|720)/.test(normalized)) {
    return "720p";
  }

  if (/(video[-_ ]?480|480)/.test(normalized)) {
    return "480p";
  }

  if (/(lossless|flac|hires|sq|无损|最高|super)/.test(normalized)) {
    return "super";
  }

  if (/(high|320|384|高)/.test(normalized)) {
    return "high";
  }

  if (/(low|128|低)/.test(normalized)) {
    return "low";
  }

  return "standard";
}

function callWithTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message || "request timeout")), timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function dedupeTracks(tracks) {
  const seen = new Set();
  const result = [];

  for (const track of tracks) {
    const key = [
      String(track.source || "local").toLowerCase(),
      String(track.platform || "").toLowerCase(),
      String(track.sourceId || track.id || "").toLowerCase(),
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(track);
  }

  return result;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = (globalThis.fetch
      ? globalThis.fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      : fetchJsonWithHttp(url));

    Promise.resolve(request).then(resolve, reject);
  });
}

function fetchJsonWithHttp(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const request = client.get(target, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("invalid JSON"));
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("request timeout"));
    });
  });
}

function fetchJsonWithHeaders(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const request = client.get(target, { headers }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("invalid JSON"));
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(18000, () => {
      request.destroy(new Error("request timeout"));
    });
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function streamFile(request, response, filePath, contentType) {
  const stat = await fs.promises.stat(filePath);
  const range = request.headers.range;

  if (!range) {
    writeCorsHeaders(request, response);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  const match = String(range).match(/^bytes=(\d*)-(\d*)$/);

  if (!match) {
    writeCorsHeaders(request, response);
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : stat.size - 1;
  const safeStart = Math.max(0, Math.min(start, stat.size - 1));
  const safeEnd = Math.max(safeStart, Math.min(end, stat.size - 1));

  writeCorsHeaders(request, response);
  response.writeHead(206, {
    "Content-Type": contentType,
    "Content-Length": safeEnd - safeStart + 1,
    "Content-Range": `bytes ${safeStart}-${safeEnd}/${stat.size}`,
    "Accept-Ranges": "bytes",
  });
  fs.createReadStream(filePath, { start: safeStart, end: safeEnd }).pipe(response);
}

function streamRemoteMedia(request, response, url) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const mediaUrl = normalizeRemoteUrl(url.searchParams.get("url"));

    if (!mediaUrl) {
      sendJson(request, response, 400, { error: "missing remote media url" });
      finish();
      return;
    }

    const target = new URL(mediaUrl);
    const client = target.protocol === "https:" ? https : http;
    const headers = {
      "User-Agent": String(url.searchParams.get("ua") || BILIBILI_USER_AGENT),
      Accept: "*/*",
      Referer: String(url.searchParams.get("referer") || "https://www.bilibili.com/"),
    };

    if (request.headers.range) {
      headers.Range = request.headers.range;
    }

    const proxyRequest = client.get(target, { headers }, (remoteResponse) => {
      writeCorsHeaders(request, response);

      const statusCode = remoteResponse.statusCode || 200;
      const responseHeaders = {
        "Content-Type": remoteResponse.headers["content-type"] || String(url.searchParams.get("type") || "application/octet-stream"),
        "Accept-Ranges": remoteResponse.headers["accept-ranges"] || "bytes",
      };

      [
        "content-length",
        "content-range",
        "last-modified",
        "etag",
      ].forEach((key) => {
        const value = remoteResponse.headers[key];

        if (value) {
          responseHeaders[toHeaderName(key)] = value;
        }
      });

      response.writeHead(statusCode, responseHeaders);
      if (request.method === "HEAD") {
        remoteResponse.resume();
        response.end();
        remoteResponse.on("end", finish);
        remoteResponse.on("error", (error) => {
          if (response.destroyed || request.destroyed) {
            finish();
            return;
          }

          fail(error);
        });
        return;
      }

      remoteResponse.pipe(response);
      remoteResponse.on("end", finish);
      remoteResponse.on("error", (error) => {
        if (response.destroyed || request.destroyed) {
          finish();
          return;
        }

        fail(error);
      });
    });

    proxyRequest.on("error", (error) => {
      if (response.destroyed || request.destroyed) {
        finish();
        return;
      }

      fail(error);
    });
    proxyRequest.setTimeout(30000, () => {
      proxyRequest.destroy(new Error("remote stream timeout"));
    });
    request.on("close", () => {
      proxyRequest.destroy();
      finish();
    });
  });
}

function toHeaderName(value) {
  return String(value || "")
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join("-");
}

function getTrackFromUrl(url) {
  const id = String(url.searchParams.get("id") || "").trim();

  if (!id) {
    return null;
  }

  return state.trackMap.get(id)
    || state.pluginTrackMap.get(id)
    || state.pluginTrackMap.get(decodeURIComponentSafe(id))
    || null;
}

function getRequestOrigin(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "http";
  return `${proto}://${request.headers.host || `${host}:${port}`}`;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pickDirectory(initialDirectory = "") {
  if (process.platform !== "win32") {
    throw new Error("当前目录选择器仅支持 Windows。请手动粘贴本地音乐目录。");
  }

  const selectedPath = initialDirectory && fs.existsSync(initialDirectory)
    ? initialDirectory
    : "";
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.StartPosition = 'CenterScreen'",
    "$owner.Width = 0",
    "$owner.Height = 0",
    "$owner.ShowInTaskbar = $false",
    "$owner.Opacity = 0",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = '选择本地音乐目录'",
    "$dialog.ShowNewFolderButton = $true",
    "$selectedPath = [Console]::In.ReadToEnd().Trim()",
    "if ($selectedPath) { $dialog.SelectedPath = $selectedPath }",
    "try { $owner.Show(); $owner.Activate(); $result = $dialog.ShowDialog($owner); if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $dialog.SelectedPath } } finally { $owner.Dispose(); $dialog.Dispose() }",
  ].join("; ");

  return new Promise((resolve, reject) => {
    const child = childProcess.execFile("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ], {
      windowsHide: false,
      timeout: 120000,
      encoding: "utf8",
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message || "目录选择失败"));
        return;
      }

      resolve(String(stdout || "").trim());
    });
    child.stdin?.end(selectedPath);
  });
}

function sendJson(request, response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  writeCorsHeaders(request, response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendEmpty(request, response, statusCode) {
  writeCorsHeaders(request, response);
  response.writeHead(statusCode);
  response.end();
}

function writeCorsHeaders(request, response) {
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  response.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");
}

function getAudioContentType(codec) {
  const value = String(codec || "").toLowerCase();
  const map = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    flv: "video/x-flv",
    ts: "video/mp2t",
  };

  return map[value] || "application/octet-stream";
}

function getImageContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return map[ext] || "application/octet-stream";
}

function parseArgs(args) {
  const result = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      result[key] = "true";
      continue;
    }

    if (result[key]) {
      result[key] = `${result[key]},${next}`;
    } else {
      result[key] = next;
    }
    index += 1;
  }

  return result;
}

function splitList(value) {
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}
