(() => {
const TICKS_PER_SECOND = 10000000;
const EXTERNAL_SOURCE_REQUEST_TIMEOUT_MS = 18000;

function createExternalSourceApi() {
  async function fetchHealth(apiUrl) {
    await assertSupportedApiUrl(apiUrl);

    const url = buildUrl(apiUrl, "/health");
    return requestJson(url);
  }

  async function fetchTracks(apiUrl, options = {}) {
    const query = String(options.query || "").trim();
    const path = query ? "/search" : "/tracks";
    const url = buildUrl(apiUrl, path);
    const startIndex = Math.max(0, Number(options.startIndex) || 0);
    const limit = Math.max(1, Number(options.limit) || 100);

    url.searchParams.set("offset", String(startIndex));
    url.searchParams.set("startIndex", String(startIndex));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", String(Math.floor(startIndex / limit) + 1));

    if (query) {
      url.searchParams.set("q", query);
      url.searchParams.set("query", query);
      url.searchParams.set("keyword", query);
      url.searchParams.set("type", "music");
    }

    const payload = await requestJson(url, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    const rawItems = extractItems(payload);
    const items = rawItems.map((item, index) => normalizeExternalTrack(item, {
      apiUrl,
      index: startIndex + index,
    })).filter(Boolean);
    const total = extractTotal(payload, items.length, startIndex);

    return {
      Items: items,
      TotalRecordCount: total,
      Raw: payload,
    };
  }

  async function configureSourceBridge(apiUrl, options = {}) {
    const url = buildUrl(apiUrl, "/configure");
    const payload = {
      musicDir: String(options.musicDir || "").trim(),
      manifestUrl: String(options.manifestUrl || "").trim(),
    };

    return requestJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async function rescanSourceBridge(apiUrl) {
    const url = buildUrl(apiUrl, "/rescan");
    return requestJson(url);
  }

  async function fetchMediaSource(apiUrl, track, options = {}) {
    const inlineUrl = normalizeUrl(track?.ExternalSource?.mediaUrl || track?.ExternalSource?.url || track?.Path, apiUrl);
    const forceResolve = Boolean(options.forceResolve);

    if (inlineUrl && !forceResolve && !shouldResolveInlineUrlThroughBridge(inlineUrl, track)) {
      const codec = getExternalTrackCodec(track);
      const bitrate = getExternalTrackBitrate(track);
      const sourceQuality = track.ExternalSource?.sourceQuality || "";
      const qualityLabel = track.ExternalSource?.qualityLabel || "";
      const resolution = track.ExternalSource?.resolution || "";
      const qualityVerified = hasResolvedQuality({
        mediaKind: track.ExternalSource?.mediaKind || "audio",
        codec,
        bitrate,
        sourceQuality,
        qualityLabel,
        resolution,
      });
      return {
        streamUrl: inlineUrl,
        mediaSourceId: track.ExternalSource?.mediaSourceId || track.Id,
        playSessionId: createExternalPlaySessionId(track),
        mediaKind: track.ExternalSource?.mediaKind || "audio",
        codec,
        bitrate,
        sourceQuality,
        qualityLabel,
        resolution,
        qualityVerified,
        qualityState: qualityVerified ? "resolved" : "unknown",
      };
    }

    const externalId = track?.ExternalSource?.id || stripExternalTrackPrefix(track?.Id);

    if (!externalId) {
      throw new Error("外部音源缺少歌曲 ID。");
    }

    const url = buildUrl(apiUrl, "/media");
    url.searchParams.set("id", externalId);
    url.searchParams.set("quality", options.quality || "standard");
    if (options.videoQuality) {
      url.searchParams.set("videoQuality", options.videoQuality);
    }
    appendExternalTrackSnapshot(url, track);
    const payload = await requestJson(url, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });
    const streamUrl = normalizeUrl(
      payload?.url
        || payload?.streamUrl
        || payload?.src
        || payload?.data?.url
        || payload?.data?.streamUrl
        || payload?.data?.src,
      apiUrl,
    );

    if (!streamUrl) {
      throw new Error("音源桥没有返回可播放地址。");
    }

    const mediaKind = payload?.mediaKind || payload?.data?.mediaKind || track.ExternalSource?.mediaKind || normalizeExternalMediaKind(payload);
    const codec = normalizeCodecLabel(
      payload?.codec
        || payload?.format
        || payload?.container
        || payload?.data?.codec
        || payload?.data?.format
        || getUrlCodec(streamUrl)
        || inferCodecFromQualityPayload(payload),
    ) || getExternalTrackCodec(track);
    const bitrate = normalizeBitrate(
      payload?.bitrate
        ?? payload?.bitRate
        ?? payload?.br
        ?? payload?.maxbr
        ?? payload?.kbps
        ?? payload?.data?.bitrate
        ?? payload?.data?.bitRate
        ?? payload?.data?.br
        ?? payload?.data?.maxbr
        ?? payload?.data?.kbps,
    ) || inferBitrateFromQualityPayload(payload) || getExternalTrackBitrate(track);
    const sourceQuality = pickString(payload?.sourceQuality, payload?.quality, payload?.level, payload?.data?.sourceQuality, payload?.data?.quality, payload?.data?.level) || track.ExternalSource?.sourceQuality || "";
    const qualityLabel = pickString(payload?.qualityLabel, payload?.qualityText, payload?.qualityName, payload?.data?.qualityLabel, payload?.data?.qualityText, payload?.data?.qualityName) || track.ExternalSource?.qualityLabel || "";
    const resolution = pickString(payload?.resolution, payload?.data?.resolution) || inferExternalResolution(payload) || track.ExternalSource?.resolution || "";
    const qualityVerified = Boolean(payload?.qualityVerified || payload?.data?.qualityVerified) || hasResolvedQuality({
      mediaKind,
      codec,
      bitrate,
      sourceQuality,
      qualityLabel,
      resolution,
    });

    return {
      streamUrl,
      mediaSourceId: payload?.mediaSourceId || payload?.id || track.Id,
      playSessionId: payload?.playSessionId || createExternalPlaySessionId(track),
      mediaKind,
      codec,
      bitrate,
      sourceQuality,
      qualityLabel,
      resolution,
      qualityVerified,
      qualityState: qualityVerified ? "resolved" : "unknown",
      contentType: pickString(payload?.contentType, payload?.mimeType, payload?.data?.contentType, payload?.data?.mimeType),
      dash: payload?.dash || payload?.data?.dash || null,
      raw: payload,
    };
  }

  function shouldResolveInlineUrlThroughBridge(url, track) {
    if (isRestorableExternalPluginTrack(track) || hasRestorableExternalPluginSnapshot(track)) {
      return true;
    }

    if (/\.m4s(?:$|[?#])/i.test(String(url || ""))) {
      return true;
    }

    return /bilibili/i.test(`${track?.ExternalSource?.platform || ""} ${track?.ExternalSource?.id || ""}`);
  }

  async function fetchLyric(apiUrl, track) {
    const inlineLyric = pickString(
      track?.ExternalSource?.lyric,
      track?.ExternalSource?.lyrics,
      track?.ExternalSource?.raw?.lyric,
      track?.ExternalSource?.raw?.lyrics,
      track?.Lyrics,
      track?.Lyric,
    );

    if (inlineLyric) {
      return inlineLyric;
    }

    const externalId = track?.ExternalSource?.id || stripExternalTrackPrefix(track?.Id);

    if (!externalId) {
      return "";
    }

    const url = buildUrl(apiUrl, "/lyric");
    url.searchParams.set("id", externalId);
    appendExternalTrackSnapshot(url, track);

    try {
      const payload = await requestJson(url);
      return extractLyricText(payload);
    } catch (error) {
      if (String(error?.message || "").includes("404")) {
        return "";
      }

      throw error;
    }
  }

  return {
    fetchHealth,
    fetchTracks,
    configureSourceBridge,
    fetchMediaSource,
    fetchLyric,
    rescanSourceBridge,
    normalizeApiUrl,
  };
}

function appendExternalTrackSnapshot(url, track) {
  const snapshot = createExternalTrackSnapshot(track);

  if (!snapshot) {
    return;
  }

  url.searchParams.set("track", snapshot);
}

function createExternalTrackSnapshot(track) {
  const external = track?.ExternalSource || {};
  const restore = external.restore && typeof external.restore === "object" ? external.restore : {};
  const raw = external.raw;
  const pluginIdParts = getExternalPluginIdParts(track, external);

  const pluginMeta = raw?.pluginKey
    ? raw
    : (raw?.raw && typeof raw.raw === "object" && raw.raw.pluginKey ? raw.raw : {});
  const pluginRaw = getExternalPluginRestoreRaw(raw, restore)
    || createExternalPluginFallbackRawTrack(track, external, restore, pluginIdParts);
  const sourceId = restore.sourceId
    || pluginMeta.sourceId
    || external.sourceId
    || pluginIdParts.sourceId
    || getExternalPluginRawSourceId(pluginRaw)
    || external.id;
  const snapshot = {
    id: external.id || stripExternalTrackPrefix(track?.Id),
    pluginKey: restore.pluginKey || pluginMeta.pluginKey || external.pluginKey || pluginIdParts.pluginKey,
    pluginName: restore.pluginName || pluginMeta.pluginName || external.platform,
    pluginUrl: restore.pluginUrl || pluginMeta.pluginUrl || external.pluginUrl,
    pluginPlatform: restore.pluginPlatform || pluginMeta.pluginPlatform || external.pluginPlatform || external.platform,
    sourceId,
    mediaKind: restore.mediaKind || pluginMeta.mediaKind || external.mediaKind,
    sourceQuality: restore.sourceQuality || pluginMeta.sourceQuality || external.sourceQuality,
    qualityLabel: restore.qualityLabel || pluginMeta.qualityLabel || external.qualityLabel,
    resolution: restore.resolution || pluginMeta.resolution || external.resolution,
    qualityVerified: restore.qualityVerified || pluginMeta.qualityVerified || external.qualityVerified,
    raw: pluginRaw,
  };

  if (!snapshot.pluginKey || !snapshot.raw) {
    return "";
  }

  try {
    return JSON.stringify(snapshot);
  } catch {
    return "";
  }
}

function hasRestorableExternalPluginSnapshot(track) {
  return Boolean(createExternalTrackSnapshot(track));
}

function isRestorableExternalPluginTrack(track) {
  const external = track?.ExternalSource || {};
  const idParts = getExternalPluginIdParts(track, external);

  return Boolean(
    idParts.pluginKey
      || external.pluginKey
      || external.restore?.pluginKey
      || external.raw?.pluginKey
      || external.raw?.raw?.pluginKey
  );
}

function createExternalPluginRestoreSnapshot(rawTrack, meta = {}) {
  if (!rawTrack || typeof rawTrack !== "object") {
    return null;
  }

  return {
    id: meta.id || meta.sourceId || "",
    pluginKey: meta.pluginKey || "",
    pluginName: meta.pluginName || "",
    pluginUrl: meta.pluginUrl || "",
    pluginPlatform: meta.pluginPlatform || "",
    sourceId: meta.sourceId || meta.id || "",
    mediaKind: meta.mediaKind || "",
    sourceQuality: meta.sourceQuality || "",
    qualityLabel: meta.qualityLabel || "",
    resolution: meta.resolution || "",
    qualityVerified: Boolean(meta.qualityVerified),
    raw: rawTrack,
  };
}

function normalizeExternalPluginRestoreSnapshot(restore, fallbackRawTrack, meta = {}) {
  if (restore && typeof restore === "object" && restore.raw && typeof restore.raw === "object") {
    return {
      id: restore.id || meta.id || meta.sourceId || "",
      pluginKey: restore.pluginKey || meta.pluginKey || "",
      pluginName: restore.pluginName || meta.pluginName || "",
      pluginUrl: restore.pluginUrl || meta.pluginUrl || "",
      pluginPlatform: restore.pluginPlatform || meta.pluginPlatform || "",
      sourceId: restore.sourceId || meta.sourceId || meta.id || "",
      mediaKind: restore.mediaKind || meta.mediaKind || "",
      sourceQuality: restore.sourceQuality || meta.sourceQuality || "",
      qualityLabel: restore.qualityLabel || meta.qualityLabel || "",
      resolution: restore.resolution || meta.resolution || "",
      qualityVerified: Boolean(restore.qualityVerified || meta.qualityVerified),
      raw: restore.raw,
    };
  }

  return createExternalPluginRestoreSnapshot(fallbackRawTrack, meta);
}

function getExternalPluginRestoreRaw(raw, restore = {}) {
  if (restore.raw && typeof restore.raw === "object") {
    return restore.raw;
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (raw.raw && typeof raw.raw === "object" && raw.raw.pluginKey && raw.raw.raw && typeof raw.raw.raw === "object") {
    return raw.raw.raw;
  }

  if (raw.raw && typeof raw.raw === "object" && !raw.raw.pluginKey) {
    return raw.raw;
  }

  if (raw.track && typeof raw.track === "object") {
    return raw.track;
  }

  if (raw.originalTrack && typeof raw.originalTrack === "object") {
    return raw.originalTrack;
  }

  if (raw.sourceTrack && typeof raw.sourceTrack === "object") {
    return raw.sourceTrack;
  }

  if (raw.item && typeof raw.item === "object") {
    return raw.item;
  }

  if (raw.song && typeof raw.song === "object") {
    return raw.song;
  }

  if (raw.media && typeof raw.media === "object" && !looksLikeMediaPayloadOnly(raw.media)) {
    return raw.media;
  }

  return raw;
}

function createExternalPluginFallbackRawTrack(track, external = {}, restore = {}, pluginIdParts = {}) {
  const sourceId = restore.sourceId
    || external.sourceId
    || pluginIdParts.sourceId
    || getExternalPluginRawSourceId(external.raw)
    || "";

  if (!sourceId) {
    return null;
  }

  const title = pickString(
    track?.Name,
    external.title,
    external.name,
    external.raw?.title,
    external.raw?.name,
  );
  const artist = pickString(
    Array.isArray(track?.Artists) ? track.Artists.join(", ") : "",
    track?.AlbumArtist,
    external.artist,
    external.singer,
    external.raw?.artist,
    external.raw?.singer,
  );
  const album = pickString(track?.Album, external.album, external.raw?.album);

  return {
    id: sourceId,
    Id: sourceId,
    sourceId,
    mid: sourceId,
    songmid: sourceId,
    hash: sourceId,
    rid: sourceId,
    songId: sourceId,
    title,
    name: title,
    Name: title,
    songName: title,
    artist,
    singer: artist,
    author: artist,
    artistName: artist,
    album,
    albumName: album,
    artwork: external.artwork || "",
    cover: external.artwork || "",
    mediaKind: external.mediaKind || "",
    sourceQuality: external.sourceQuality || "",
    qualityLabel: external.qualityLabel || "",
    resolution: external.resolution || "",
  };
}

function getExternalPluginRawSourceId(raw) {
  if (!raw || typeof raw !== "object") {
    return "";
  }

  return pickString(
    raw.sourceId,
    raw.id,
    raw.Id,
    raw.mid,
    raw.songmid,
    raw.hash,
    raw.rid,
    raw.songId,
  );
}

function looksLikeMediaPayloadOnly(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Boolean(
    pickString(value.url, value.streamUrl, value.src, value.playUrl, value.play_url, value.location, value.link)
      && !pickString(value.id, value.Id, value.mid, value.songmid, value.hash, value.rid, value.name, value.title, value.songName)
  );
}

function getExternalPluginIdParts(track, external = {}) {
  const candidates = [
    external.id,
    stripExternalTrackPrefix(track?.Id),
  ].map((item) => String(item || "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/^plugin:([^:]+):(.+)$/);

    if (match) {
      return {
        pluginKey: match[1],
        sourceId: decodeURIComponentSafe(match[2]),
      };
    }
  }

  return {
    pluginKey: "",
    sourceId: "",
  };
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function normalizeApiUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return withProtocol.replace(/\/+$/, "");
  }
}

function buildUrl(apiUrl, path) {
  const base = normalizeApiUrl(apiUrl);

  if (!base) {
    throw new Error("请填写音源桥地址。");
  }

  return new URL(`${base.replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`);
}

async function assertSupportedApiUrl(apiUrl) {
  const normalizedApiUrl = normalizeApiUrl(apiUrl);

  if (!looksLikeJsonManifestUrl(normalizedApiUrl)) {
    return;
  }

  let payload = null;

  try {
    payload = await requestJson(new URL(normalizedApiUrl));
  } catch {
    throw new Error("这个地址看起来是 JSON 文件，不是音源桥服务地址。请填写提供 /health、/tracks、/search、/media 的服务地址。");
  }

  if (isPluginManifest(payload)) {
    throw new Error("这个地址是音源插件清单 JSON，不是音源桥服务地址。请先用桥接服务把清单转换成 /health、/tracks、/search、/media，再在这里填写桥接服务地址。");
  }

  throw new Error("这个 JSON 文件不是受支持的音源桥服务地址。请填写服务地址，而不是单个 JSON 文件。");
}

function looksLikeJsonManifestUrl(value) {
  return /\.json(?:$|[?#])/i.test(String(value || ""));
}

function isPluginManifest(payload) {
  return Array.isArray(payload?.plugins)
    && payload.plugins.some((plugin) => plugin?.url && /\.js(?:$|[?#])/i.test(String(plugin.url)));
}

async function requestJson(url, options = {}) {
  let response;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || EXTERNAL_SOURCE_REQUEST_TIMEOUT_MS);
  const abortState = createRequestAbortState(options.signal, timeoutMs);
  const requestOptions = {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
    signal: abortState.signal,
  };

  delete requestOptions.timeoutMs;

  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    if (error?.name === "AbortError") {
      if (!abortState.timedOut) {
        throw new Error("音源桥请求已取消。");
      }

      throw new Error("音源桥请求超时，请检查音乐桥是否在线或插件源站是否响应。");
    }

    throw error;
  } finally {
    abortState.cleanup();
  }

  const text = await response.text();

  if (!response.ok) {
    const detail = extractErrorMessage(text);
    throw new Error(detail || `音源桥返回 ${response.status} ${response.statusText || ""}`.trim());
  }

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("音源桥没有返回 JSON。");
  }
}

function extractErrorMessage(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const payload = JSON.parse(raw);
    const message = pickString(payload?.error, payload?.message, payload?.data?.error, payload?.data?.message);
    return message ? `音源桥：${message}` : "";
  } catch {
    return "";
  }
}

function createRequestAbortState(externalSignal, timeoutMs) {
  if (typeof AbortController !== "function") {
    return {
      signal: externalSignal,
      get timedOut() {
        return false;
      },
      cleanup() {},
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else if (typeof externalSignal.addEventListener === "function") {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      clearTimeout(timeoutId);
      if (externalSignal && typeof externalSignal.removeEventListener === "function") {
        externalSignal.removeEventListener("abort", abortFromExternalSignal);
      }
    },
  };
}

function extractItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.Items,
    payload?.items,
    payload?.tracks,
    payload?.songs,
    payload?.musicList,
    payload?.list,
    payload?.result,
    payload?.data,
    payload?.data?.Items,
    payload?.data?.items,
    payload?.data?.tracks,
    payload?.data?.songs,
    payload?.data?.musicList,
    payload?.data?.list,
    payload?.data?.result,
  ];

  return candidates.find(Array.isArray) || [];
}

function extractTotal(payload, itemCount, startIndex) {
  const total = Number(
    payload?.TotalRecordCount
      ?? payload?.total
      ?? payload?.count
      ?? payload?.data?.total
      ?? payload?.data?.count
      ?? payload?.result?.total,
  );

  if (Number.isFinite(total) && total >= 0) {
    return total;
  }

  return startIndex + itemCount;
}

function extractLyricText(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const direct = pickString(
    payload.lyric,
    payload.lyrics,
    payload.lrc,
    payload.rawLrc,
    payload.text,
    payload.value,
    payload.data,
    payload.data?.lyric,
    payload.data?.lyrics,
    payload.data?.lrc,
    payload.data?.rawLrc,
    payload.data?.text,
    payload.result,
    payload.result?.lyric,
    payload.result?.lyrics,
    payload.result?.lrc,
  );

  if (direct) {
    return direct;
  }

  return formatLyricLineArray([
    payload.lines,
    payload.Lines,
    payload.lyricLines,
    payload.LyricLines,
    payload.sentences,
    payload.Sentences,
    payload.data?.lines,
    payload.data?.Lines,
    payload.data?.lyricLines,
    payload.data?.LyricLines,
    payload.data?.sentences,
    payload.data?.Sentences,
    payload.result?.lines,
    payload.result?.Lines,
    payload.result?.lyricLines,
    payload.result?.LyricLines,
    payload.result?.sentences,
    payload.result?.Sentences,
  ].find(Array.isArray));
}

function formatLyricLineArray(lines) {
  if (!lines) {
    return "";
  }

  return lines.map((line) => {
    if (typeof line === "string") {
      return line;
    }

    if (!line || typeof line !== "object") {
      return "";
    }

    const text = pickString(line.text, line.Text, line.line, line.Line, line.value, line.Value);
    const time = getLyricLineTimeSeconds(line);

    if (Number.isFinite(time) && time >= 0) {
      return `[${formatLrcTimestamp(time)}]${text}`;
    }

    return text;
  }).filter(Boolean).join("\n");
}

function getLyricLineTimeSeconds(line) {
  const seconds = Number(
    line?.time
      ?? line?.Time
      ?? line?.seconds
      ?? line?.Seconds
      ?? line?.startTime
      ?? line?.StartTime
      ?? line?.startSeconds
      ?? line?.StartSeconds
  );

  if (Number.isFinite(seconds)) {
    return seconds;
  }

  const milliseconds = Number(
    line?.timeMs
      ?? line?.TimeMs
      ?? line?.startTimeMs
      ?? line?.StartTimeMs
      ?? line?.startMilliseconds
      ?? line?.StartMilliseconds
      ?? line?.offset
      ?? line?.Offset
  );

  if (Number.isFinite(milliseconds)) {
    return milliseconds / 1000;
  }

  const ticks = Number(
    line?.ticks
      ?? line?.Ticks
      ?? line?.startTicks
      ?? line?.StartTicks
      ?? line?.StartPositionTicks
  );

  if (Number.isFinite(ticks)) {
    return ticks / TICKS_PER_SECOND;
  }

  return NaN;
}

function normalizeExternalTrack(item, context = {}) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const sourceId = String(item.id ?? item.Id ?? item.mid ?? item.songmid ?? item.hash ?? item.rid ?? context.index ?? "").trim();

  if (!sourceId) {
    return null;
  }

  const title = pickString(item.title, item.name, item.Name, item.songName, item.musicName) || "未命名歌曲";
  const artistText = pickString(item.artist, item.singer, item.author, item.artistName, item.Artist, item.AlbumArtist) || "未知艺人";
  const album = pickString(item.album, item.albumName, item.Album) || "";
  const platform = pickString(item.platform, item.source, item.vendor) || "external";
  const mediaKind = normalizeExternalMediaKind(item);
  const maxQuality = inferExternalMaxQuality(item, mediaKind);
  const sourceQuality = maxQuality.sourceQuality || pickString(item.sourceQuality, item.quality, item.level, item.raw?.sourceQuality, item.raw?.quality) || "";
  const qualityLabel = maxQuality.qualityLabel || pickString(item.qualityLabel, item.qualityText, item.qualityName, item.raw?.qualityLabel) || sourceQuality;
  const resolution = maxQuality.resolution || pickString(item.resolution, item.raw?.resolution) || inferExternalResolution(item);
  const codec = normalizeCodecLabel(pickString(item.codec, item.format, item.container, item.fileType, item.ext));
  const bitrate = normalizeBitrate(item.bitrate ?? item.bitRate ?? item.br);
  const qualityVerified = Boolean(item.qualityVerified || item.raw?.qualityVerified);
  const mediaSourceId = `external-media:${platform}:${sourceId}`;
  const artists = splitArtists(artistText);
  const albumId = String(item.albumId || item.AlbumId || (album ? `external-album:${platform}:${album}` : "")).trim();

  return {
    Id: `external:${platform}:${sourceId}`,
    Type: mediaKind === "video" ? "Video" : "Audio",
    MediaType: mediaKind === "video" ? "Video" : "Audio",
    Name: title,
    SortName: title,
    Album: album,
    AlbumId: albumId,
    AlbumArtist: artistText,
    Artists: artists,
    ArtistItems: artists.map((name) => ({ Name: name, Id: `external-artist:${name}` })),
    AlbumArtists: artists.map((name) => ({ Name: name, Id: `external-artist:${name}` })),
    DateCreated: item.date || item.createTime || item.publishTime || new Date().toISOString(),
    RunTimeTicks: normalizeDurationTicks(item.duration ?? item.durationSeconds ?? item.interval ?? item.time),
    UserData: { IsFavorite: false },
    ExternalSource: {
      apiUrl: normalizeApiUrl(context.apiUrl),
      id: sourceId,
      platform,
      mediaKind,
      isVideo: mediaKind === "video",
      sourceQuality,
      qualityLabel,
      resolution,
      qualityVerified,
      qualityState: qualityVerified ? "resolved" : "",
      artwork: normalizeUrl(pickArtworkString(
        item.artwork,
        item.cover,
        item.coverUrl,
        item.coverURL,
        item.coverImgUrl,
        item.pic,
        item.picUrl,
        item.picture,
        item.img,
        item.image,
        item.imageUrl,
        item.thumbnail,
        item.thumbnailUrl,
        item.albumPic,
        item.album?.picUrl,
        item.album?.pic,
        item.album?.cover,
        item.album?.coverUrl,
        item.al?.picUrl,
        item.al?.pic_str,
        item.artists?.[0]?.img1v1Url,
        item.artist?.picUrl,
        item.artist?.img1v1Url,
        item.raw?.artwork,
        item.raw?.cover,
        item.raw?.picUrl,
      ), context.apiUrl),
      mediaUrl: normalizeUrl(pickString(item.url, item.streamUrl, item.src, item.playUrl), context.apiUrl),
      lyric: pickString(item.lyric, item.lyrics, item.lrc, item.rawLrc),
      raw: item,
      restore: normalizeExternalPluginRestoreSnapshot(item.restore, item, {
        id: sourceId,
        pluginKey: pickString(item.pluginKey, item.raw?.pluginKey),
        pluginName: pickString(item.pluginName, item.raw?.pluginName, platform),
        pluginUrl: pickString(item.pluginUrl, item.raw?.pluginUrl),
        pluginPlatform: pickString(item.pluginPlatform, item.raw?.pluginPlatform, platform),
        sourceId: pickString(item.sourceId, item.raw?.sourceId, sourceId),
        mediaKind,
        sourceQuality,
        qualityLabel,
        resolution,
        qualityVerified,
      }),
    },
    MediaSources: [{
      Id: mediaSourceId,
      Container: codec,
      BitRate: bitrate,
      SourceQuality: sourceQuality,
      QualityLabel: qualityLabel,
      Resolution: resolution,
      QualityVerified: qualityVerified,
      MediaKind: mediaKind,
      SupportsDirectPlay: true,
      SupportsDirectStream: true,
      MediaStreams: [{
        Type: mediaKind === "video" ? "Video" : "Audio",
        Codec: codec,
        BitRate: bitrate,
        Width: resolution ? 0 : undefined,
      }],
    }],
  };
}

function pickString(...values) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function pickArtworkString(...values) {
  const value = values.find((item) => {
    if (typeof item !== "string" || !item.trim()) {
      return false;
    }

    const normalized = item.trim();
    return /^https?:\/\//i.test(normalized) || normalized.startsWith("//") || normalized.startsWith("/");
  });

  return value ? value.trim() : "";
}

function splitArtists(value) {
  return String(value || "")
    .split(/\s*(?:\/|、|,|，|&)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDurationTicks(value) {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }

  if (duration > 1000000000) {
    return Math.round(duration);
  }

  if (duration > 36000) {
    return Math.round(duration * 10000);
  }

  return Math.round(duration * TICKS_PER_SECOND);
}

function normalizeBitrate(value) {
  const bitrate = Number(value);

  if (!Number.isFinite(bitrate) || bitrate <= 0) {
    return 0;
  }

  return bitrate < 10000 ? Math.round(bitrate * 1000) : Math.round(bitrate);
}

function normalizeCodecLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  const labels = {
    MPEG4: "AAC",
    MP4A: "AAC",
    M4A: "AAC",
    MPEG: "MP3",
  };

  if (!normalized || /^(AUDIO|MUSIC|SONG|TRACK|MV|VIDEO|EXTERNAL|UNKNOWN)$/.test(normalized)) {
    return normalized === "VIDEO" || normalized === "MV" ? "VIDEO" : "";
  }

  return labels[normalized] || normalized;
}

function getExternalTrackCodec(track) {
  const source = track?.MediaSources?.[0] || {};
  const stream = source.MediaStreams?.find((item) => item?.Codec) || {};
  return normalizeCodecLabel(stream.Codec || source.Container || track?.ExternalSource?.codec);
}

function getExternalTrackBitrate(track) {
  const source = track?.MediaSources?.[0] || {};
  const stream = source.MediaStreams?.find((item) => item?.BitRate || item?.Bitrate) || {};
  return normalizeBitrate(stream.BitRate ?? stream.Bitrate ?? source.BitRate ?? source.Bitrate ?? track?.ExternalSource?.bitrate);
}

function normalizeExternalMediaKind(item) {
  const text = [
    item?.mediaKind,
    item?.mediaType,
    item?.MediaType,
    item?.kind,
    item?.type,
    item?.category,
    item?.contentType,
    item?.qualityLabel,
    item?.quality,
    item?.title,
    item?.name,
    item?.Name,
    item?.songName,
    item?.musicName,
    item?.subtitle,
    item?.description,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean).join(" ");
  const url = pickString(item?.url, item?.streamUrl, item?.src, item?.playUrl);
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
  const hasExplicitVideoTitle = /(?:\bmv\b\s*(?:版|video|视频|官方|live|1080|720|4k)|(?:mv|music\s*video|video|视频)\s*(?:版|官方|高清|1080|720|4k)|\(\s*mv(?:\s*版)?\s*\)|（\s*mv(?:\s*版)?\s*）)/i.test(text);

  if (hasVideoMarker || hasExplicitVideoTitle || /\b(mv|mvideo|video|movie|vod)\b|视频|音乐视频/.test(text) || /\.(mp4|m4v|mov|webm|mkv|avi|flv|m3u8)(?:$|[?#])/i.test(url)) {
    return "video";
  }

  return "audio";
}

function inferExternalResolution(item) {
  const text = stringifyExternalQualityFields(item).toLowerCase();
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

function inferExternalMaxQuality(item, mediaKind) {
  const text = stringifyExternalQualityFields(item).toLowerCase();

  if (mediaKind === "video") {
    const resolution = inferExternalResolution(item);
    const label = ["MV", resolution || (/mv|video|视频|音乐视频/.test(text) ? "视频" : "")].filter(Boolean).join(" ");
    return {
      sourceQuality: resolution || "MV",
      qualityLabel: label || "MV",
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

function inferCodecFromQualityPayload(payload) {
  const text = stringifyExternalQualityFields(payload).toLowerCase();

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

  return "";
}

function inferBitrateFromQualityPayload(payload) {
  const text = stringifyExternalQualityFields(payload).toLowerCase();
  const bitrates = [...text.matchAll(/\b(128|192|256|320|384)\s*k(?:bps)?\b/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  return bitrates.length ? Math.max(...bitrates) * 1000 : 0;
}

function hasResolvedQuality(context = {}) {
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

function stringifyExternalQualityFields(item) {
  return [
    item?.resolution,
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
    item?.url,
    item?.streamUrl,
    item?.src,
    item?.playUrl,
    item?.data?.resolution,
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
  ].map((value) => {
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
  }).filter(Boolean).join(" ");
}

function formatLrcTimestamp(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainingSeconds.toFixed(2).padStart(5, "0")}`;
}

function normalizeUrl(value, apiUrl) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    return new URL(raw, normalizeApiUrl(apiUrl) || location.href).toString();
  } catch {
    return raw;
  }
}

function getUrlCodec(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const baseUrl = typeof location !== "undefined" ? location.href : "http://source.local/";
    const extension = new URL(raw, baseUrl).pathname.split(".").pop() || "";
    return normalizeCodecLabel(extension);
  } catch {
    const match = raw.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
    return normalizeCodecLabel(match?.[1] || "");
  }
}

function stripExternalTrackPrefix(id) {
  const value = String(id || "");

  if (value.startsWith("external:plugin:")) {
    return value.slice("external:".length);
  }

  return value.replace(/^external:[^:]+:/, "");
}

function createExternalPlaySessionId(track) {
  const id = String(track?.Id || "external").replace(/[^a-z0-9]/gi, "").slice(0, 18) || "external";
  return `external-${Date.now().toString(36)}-${id}`;
}

window.EmbyMusicExternalSource = {
  createExternalSourceApi,
};
})();
