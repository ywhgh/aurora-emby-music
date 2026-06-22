(() => {
function createEmbyApi({ authorizationHeader, getDeviceId, getSession }) {
  async function fetchPublicInfo(serverUrl) {
    return requestJson(buildServerUrl(serverUrl, "/emby/System/Info/Public"));
  }

  async function authenticate(serverUrl, username, password, deviceName) {
    return requestJson(buildServerUrl(serverUrl, "/emby/Users/AuthenticateByName"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": authorizationHeader(deviceName),
      },
      body: JSON.stringify({
        Username: username,
        Pw: password,
      }),
    });
  }

  async function fetchJson(session, path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("X-Emby-Token", session.accessToken);
    headers.set("X-Emby-Authorization", authorizationHeader(session.deviceName));

    return requestJson(buildServerUrl(session.serverUrl, `/emby${path}`), {
      ...options,
      headers,
    });
  }

  async function fetchText(session, path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("X-Emby-Token", session.accessToken);
    headers.set("X-Emby-Authorization", authorizationHeader(session.deviceName));

    return requestText(buildServerUrl(session.serverUrl, `/emby${path}`), {
      ...options,
      headers,
    });
  }

  function post(path, body) {
    const session = getSession();

    if (!session) {
      return;
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-Emby-Token", session.accessToken);
    headers.set("X-Emby-Authorization", authorizationHeader(session.deviceName));

    fetch(buildServerUrl(session.serverUrl, `/emby${path}`), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        console.warn(`Emby playback report failed: ${path} ${response.status}`);
      }
    }).catch(() => {
      // Playback reporting should never interrupt local playback.
    });
  }

  async function request(method, path, body) {
    const session = getSession();

    if (!session) {
      throw new Error("未连接 Emby。");
    }

    const headers = new Headers();
    headers.set("X-Emby-Token", session.accessToken);
    headers.set("X-Emby-Authorization", authorizationHeader(session.deviceName));

    const options = { method, headers };

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(body);
    }

    const response = await fetch(buildServerUrl(session.serverUrl, `/emby${path}`), options);

    if (!response.ok) {
      throw new Error(`服务器返回 ${response.status} ${response.statusText || ""}`.trim());
    }

    return response;
  }

  async function safeFetch(session, path, fallback) {
    try {
      return await fetchJson(session, path);
    } catch {
      return fallback;
    }
  }

  async function fetchPlaybackInfo(session, track, options = {}) {
    const id = encodeURIComponent(track.Id);
    const profile = typeof options.qualityProfile === "object" && options.qualityProfile ? options.qualityProfile : {};
    const maxStreamingBitrate = Number(options.transcodeBitrate);
    const mediaSourceId = options.mediaSourceId || track.MediaSources?.[0]?.Id || track.Id;
    const profileParams = getPlaybackProfileParams(profile);
    const params = {
      UserId: session.userId,
      StartTimeTicks: 0,
      IsPlayback: true,
      AutoOpenLiveStream: true,
      MediaSourceId: mediaSourceId,
      ...profileParams,
    };
    if (Number.isFinite(maxStreamingBitrate) && maxStreamingBitrate > 0) {
      params.MaxStreamingBitrate = maxStreamingBitrate;
    }
    const path = `/Items/${id}/PlaybackInfo?${toQueryString(params)}`;
    const bodyParams = {
      UserId: session.userId,
      StartTimeTicks: 0,
      IsPlayback: true,
      AutoOpenLiveStream: true,
      MediaSourceId: mediaSourceId,
      ...profileParams,
    };
    if (Number.isFinite(maxStreamingBitrate) && maxStreamingBitrate > 0) {
      bodyParams.MaxStreamingBitrate = maxStreamingBitrate;
    }
    const body = JSON.stringify(bodyParams);

    try {
      return await fetchJson(session, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (error) {
      try {
        return await fetchJson(session, path);
      } catch {
        throw error;
      }
    }
  }

  function userItemsPath(session, params) {
    return `/Users/${encodeURIComponent(session.userId)}/Items?${toQueryString(params)}`;
  }

  function toQueryString(params) {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    });

    return search.toString();
  }

  function normalizeServerUrl(value) {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      url.hash = "";
      url.search = "";
      url.pathname = normalizeServerPath(url.pathname);
      return url.toString().replace(/\/+$/, "");
    } catch {
      return withProtocol.replace(/\/+$/, "");
    }
  }

  function getImageUrl(session, item, maxWidth) {
    if (!session || !item?.Id || !hasPrimaryImage(item)) {
      return "";
    }

    return buildServerUrl(session.serverUrl, `/emby/Items/${encodeURIComponent(item.Id)}/Images/Primary?${toQueryString({
      maxWidth,
      quality: 82,
      format: "webp",
      api_key: session.accessToken,
    })}`);
  }

  function getTrackImageUrl(session, track, maxWidth) {
    if (!session || !track?.Id) {
      return "";
    }

    const imageItemId = hasPrimaryImage(track) ? track.Id : track.AlbumId;

    if (!imageItemId) {
      return "";
    }

    return buildServerUrl(session.serverUrl, `/emby/Items/${encodeURIComponent(imageItemId)}/Images/Primary?${toQueryString({
      maxWidth,
      quality: 82,
      format: "webp",
      api_key: session.accessToken,
    })}`);
  }

  function getAudioStreamUrl(session, track, mode = "direct", qualityProfile = {}, playSessionId = "", mediaSourceId = "") {
    const id = encodeURIComponent(track.Id);
    const profile = typeof qualityProfile === "object" && qualityProfile ? qualityProfile : {};
    const maxStreamingBitrate = Number(profile.bitrate);
    const resolvedMediaSourceId = mediaSourceId || track.MediaSources?.[0]?.Id || track.Id;

    if (mode === "universal") {
      const requestedProtocol = profile.protocol || "http";
      const protocol = requestedProtocol;
      const isHls = protocol === "hls";
      const container = isHls ? "ts" : (profile.container || "mp3");
      const audioCodec = profile.audioCodec || "";
      const params = {
        UserId: session.userId,
        DeviceId: getDeviceId(),
        MediaSourceId: resolvedMediaSourceId,
        PlaySessionId: playSessionId,
        Container: container,
        TranscodingContainer: container.split(",")[0],
        TranscodingProtocol: protocol,
        api_key: session.accessToken,
      };

      if (Number.isFinite(maxStreamingBitrate) && maxStreamingBitrate > 0) {
        params.MaxStreamingBitrate = maxStreamingBitrate;
      }

      if (audioCodec) {
        params.AudioCodec = audioCodec;
      }

      if (isHls) {
        params.SegmentContainer = "ts";
        params.MinSegments = 1;
      }

      if (profile.directStream) {
        params.EnableDirectStream = true;
        params.EnableDirectPlay = false;
        params.EnableAudioStreamCopy = true;
        delete params.AudioCodec;
      }

      if (profile.id === "pcm-wav") {
        params.AudioCodec = audioCodec || "pcm_s16le";
        params.Container = "wav";
        params.TranscodingContainer = "wav";
      }

      return buildServerUrl(session.serverUrl, `/emby/Audio/${id}/universal?${toQueryString(params)}`);
    }

    return buildServerUrl(session.serverUrl, `/emby/Audio/${id}/stream?${toQueryString({
      UserId: session.userId,
      DeviceId: getDeviceId(),
      MediaSourceId: resolvedMediaSourceId,
      PlaySessionId: playSessionId,
      Static: true,
      api_key: session.accessToken,
    })}`);
  }

  function getPlaybackProfileParams(profile = {}) {
    if (!profile || profile.mode !== "universal") {
      return {};
    }

    const protocol = profile.protocol || "http";
    const isHls = protocol === "hls";
    const container = isHls ? "ts" : (profile.container || "mp3");
    const params = {
      EnableDirectPlay: false,
      EnableDirectStream: Boolean(profile.directStream),
      EnableTranscoding: !profile.directStream,
      TranscodingProtocol: protocol,
      Container: container,
      TranscodingContainer: container.split(",")[0],
    };

    if (profile.audioCodec && !profile.directStream) {
      params.AudioCodec = profile.audioCodec;
    }

    if (isHls) {
      params.SegmentContainer = "ts";
    }

    if (profile.directStream) {
      params.EnableAudioStreamCopy = true;
    }

    if (profile.id === "pcm-wav") {
      params.AudioCodec = profile.audioCodec || "pcm_s16le";
      params.Container = "wav";
      params.TranscodingContainer = "wav";
    }

    return params;
  }

  return {
    authenticate,
    fetchPlaybackInfo,
    fetchJson,
    fetchText,
    fetchPublicInfo,
    getAudioStreamUrl,
    getImageUrl,
    getTrackImageUrl,
    hasPrimaryImage,
    normalizeServerUrl,
    post,
    request,
    requestJson,
    safeFetch,
    toQueryString,
    userItemsPath,
  };
}

function buildServerUrl(serverUrl, path) {
  const baseUrl = serverUrl.replace(/\/+$/, "");
  let nextPath = path.startsWith("/") ? path : `/${path}`;

  if (hasEmbyBasePath(baseUrl) && /^\/emby(?=\/|$|\?)/i.test(nextPath)) {
    nextPath = nextPath.replace(/^\/emby(?=\/|$|\?)/i, "");
  }

  return `${baseUrl}${nextPath}`;
}

function hasEmbyBasePath(serverUrl) {
  try {
    const pathname = new URL(serverUrl).pathname.replace(/\/+$/, "");
    return /(^|\/)emby$/i.test(pathname);
  } catch {
    return /\/emby$/i.test(serverUrl.replace(/\/+$/, ""));
  }
}

function normalizeServerPath(pathname) {
  let normalizedPath = pathname.replace(/\/+$/, "");

  normalizedPath = normalizedPath.replace(/\/web\/index\.html?$/i, "");
  normalizedPath = normalizedPath.replace(/\/web$/i, "");

  return normalizedPath || "";
}

const REQUEST_TIMEOUT_MS = 15000;

async function requestJson(url, options = {}) {
  const response = await requestRaw(url, options);

  return response.json();
}

async function requestText(url, options = {}) {
  const response = await requestRaw(url, options);

  return response.text();
}

async function requestRaw(url, options = {}) {
  let response;
  const timeoutController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, REQUEST_TIMEOUT_MS);
  const hasExternalSignal = Boolean(options.signal);
  const abortState = combineAbortSignals(options.signal, timeoutController.signal);
  const requestOptions = {
    ...options,
    signal: abortState.signal,
  };

  try {
    response = await fetch(url, requestOptions);
  } catch (error) {
    if (error?.name === "AbortError") {
      if (hasExternalSignal && !timedOut) {
        throw error;
      }

      throw new Error("连接服务器超时，请检查服务器是否在线、端口是否开放。");
    }

    throw new Error("网络请求失败，请检查地址、协议、端口和浏览器 CORS 限制。");
  } finally {
    clearTimeout(timeoutId);
    abortState.cleanup();
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("认证失败，请检查用户名或密码。");
    }

    throw new Error(`服务器返回 ${response.status} ${response.statusText || ""}`.trim());
  }

  return response;
}

function hasPrimaryImage(item) {
  return Boolean(item?.ImageTags?.Primary || item?.PrimaryImageTag);
}

function combineAbortSignals(externalSignal, timeoutSignal) {
  if (!externalSignal) {
    return {
      signal: timeoutSignal,
      cleanup() {},
    };
  }

  if (externalSignal.aborted) {
    return {
      signal: externalSignal,
      cleanup() {},
    };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  externalSignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      externalSignal.removeEventListener("abort", abort);
      timeoutSignal.removeEventListener("abort", abort);
    },
  };
}

window.EmbyMusicApi = {
  createEmbyApi,
};
})();
