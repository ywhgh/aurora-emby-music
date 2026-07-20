(() => {
function createEmbyMusicStorage({
  accountProfilesKey,
  appName,
  clamp,
  deviceKey,
  filterStateKey,
  maxQueueTracks,
  maxRecentTracks,
  libraryViewKey,
  audioQualityProfileKey,
  audioQualityProfiles,
  playerMetaTargetKey,
  playerMetaTargets,
  playbackPreloadKey,
  playbackLosslessPrecacheKey,
  playbackStreamKey,
  playbackStreamPolicies,
  playModeKey,
  playModes,
  queueKey,
  recentKey,
  sessionKey,
  sortKeyKey,
  sortKeys,
  sortOrderKey,
  sortOrders,
  transcodeBitrateKey,
  transcodeBitrates,
  trackDensityKey,
  trackDensities,
  volumeKey,
}) {
  const DEVICE_NAME_KEY = "emby-music-web/device-name";
  const ACCOUNT_PROFILES_KEY = accountProfilesKey || "emby-music-web/account-profiles";
  const PLAYBACK_PRELOAD_KEY = playbackPreloadKey || "emby-music-web/playback-preload";
  const PLAYBACK_LOSSLESS_PRECACHE_KEY = playbackLosslessPrecacheKey || "emby-music-web/playback-lossless-precache";
  const ACCOUNT_PROFILES_LIMIT = 12;
  const LOCAL_QUEUE_FALLBACK_LIMIT = 80;
  const queueDatabase = window.EmbyMusicIdbQueue?.createIdbQueueStorage?.() || null;

  function saveSession(session) {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(sessionKey);
  }

  function loadAccountProfiles() {
    try {
      const raw = localStorage.getItem(ACCOUNT_PROFILES_KEY);
      const profiles = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(profiles)) {
        return [];
      }

      const byKey = new Map();
      profiles.forEach((profile) => {
        const session = normalizeAccountProfileSession(profile?.session || profile);
        const key = getAccountProfileKey(session);

        if (!key || byKey.has(key)) {
          return;
        }

        byKey.set(key, {
          key,
          session,
          savedAt: profile?.savedAt || session.savedAt || "",
        });
      });

      return [...byKey.values()]
        .sort((left, right) => compareProfileDate(right.savedAt, left.savedAt))
        .slice(0, ACCOUNT_PROFILES_LIMIT);
    } catch {
      return [];
    }
  }

  function saveAccountProfile(session) {
    const normalizedSession = normalizeAccountProfileSession(session);
    const key = getAccountProfileKey(normalizedSession);

    if (!key) {
      return;
    }

    const savedAt = new Date().toISOString();
    const nextProfile = {
      key,
      savedAt,
      session: {
        ...normalizedSession,
        savedAt,
      },
    };
    const profiles = loadAccountProfiles()
      .filter((profile) => profile.key !== key);

    localStorage.setItem(
      ACCOUNT_PROFILES_KEY,
      JSON.stringify([nextProfile, ...profiles].slice(0, ACCOUNT_PROFILES_LIMIT)),
    );
  }

  function removeAccountProfile(key) {
    if (!key) {
      return;
    }

    const profiles = loadAccountProfiles().filter((profile) => profile.key !== key);

    if (profiles.length) {
      localStorage.setItem(ACCOUNT_PROFILES_KEY, JSON.stringify(profiles));
    } else {
      localStorage.removeItem(ACCOUNT_PROFILES_KEY);
    }
  }

  function normalizeAccountProfileSession(session) {
    const isExternal = session?.sourceMode === "external";
    const serverUrl = session?.serverUrl || (isExternal ? "source-bridge://unconfigured" : "");

    if (!serverUrl || !session?.userId || (!session?.accessToken && !isExternal)) {
      return null;
    }

    return {
      sourceMode: session.sourceMode || "emby",
      serverUrl: String(serverUrl),
      externalSourceApiUrl: session.externalSourceApiUrl || "",
      serverId: session.serverId || "",
      serverName: session.serverName || "",
      version: session.version || "-",
      accessToken: session.accessToken || "",
      userId: session.userId,
      userName: session.userName || "",
      deviceId: session.deviceId || "",
      deviceName: session.deviceName || "",
      savedAt: session.savedAt || "",
    };
  }

  function getAccountProfileKey(session) {
    const isExternal = session?.sourceMode === "external";
    const serverUrl = session?.serverUrl || (isExternal ? "source-bridge://unconfigured" : "");

    if (!session?.userId || (!serverUrl && !isExternal)) {
      return "";
    }

    return `${getSessionStorageServerUrl(session)}::${session.userId}`;
  }

  function compareProfileDate(left, right) {
    return (Date.parse(left) || 0) - (Date.parse(right) || 0);
  }

  function loadRecentTracks(session) {
    try {
      const scopedKey = getScopedSessionKey(recentKey, session);
      const scopedRaw = localStorage.getItem(scopedKey);

      if (scopedRaw) {
        return normalizeRecentTracks(JSON.parse(scopedRaw));
      }

      if (!session?.userId || !session?.serverUrl) {
        return [];
      }

      const legacyRaw = localStorage.getItem(recentKey);
      const legacyTracks = legacyRaw ? normalizeRecentTracks(JSON.parse(legacyRaw)) : [];

      if (legacyTracks.length) {
        localStorage.setItem(scopedKey, JSON.stringify(legacyTracks));
        localStorage.removeItem(recentKey);
      }

      return legacyTracks;
    } catch {
      return [];
    }
  }

  function saveRecentTracks(session, tracks) {
    localStorage.setItem(getScopedSessionKey(recentKey, session), JSON.stringify(tracks.slice(0, maxRecentTracks)));
  }

  function normalizeRecentTracks(tracks) {
    return Array.isArray(tracks) ? tracks.filter((track) => track?.Id).slice(0, maxRecentTracks) : [];
  }

  function loadLibraryViewId(session) {
    try {
      const raw = localStorage.getItem(getScopedSessionKey(libraryViewKey, session)) || localStorage.getItem(libraryViewKey);
      const saved = raw ? JSON.parse(raw) : null;

      if (!saved || !isSameSession(saved, session)) {
        return "";
      }

      return typeof saved.viewId === "string" ? saved.viewId : "";
    } catch {
      return "";
    }
  }

  function saveLibraryViewId(session, viewId) {
    if (!session?.userId || !session?.serverUrl || !viewId) {
      clearLibraryViewId(session);
      return;
    }

    localStorage.setItem(getScopedSessionKey(libraryViewKey, session), JSON.stringify({
      serverUrl: session.serverUrl,
      userId: session.userId,
      serverId: session.serverId,
      viewId,
      savedAt: new Date().toISOString(),
    }));
  }

  function clearLibraryViewId(session) {
    localStorage.removeItem(getScopedSessionKey(libraryViewKey, session));
  }

  function loadFilterState(session) {
    try {
      const raw = localStorage.getItem(getScopedSessionKey(filterStateKey, session)) || localStorage.getItem(filterStateKey);
      const saved = raw ? JSON.parse(raw) : null;

      if (!saved || !isSameSession(saved, session)) {
        return emptyFilterState();
      }

      return normalizeFilterState(saved.filters);
    } catch {
      return emptyFilterState();
    }
  }

  function saveFilterState(session, filters) {
    const normalizedFilters = normalizeFilterState(filters);

    if (!session?.userId || !session?.serverUrl || isEmptyFilterState(normalizedFilters)) {
      clearFilterState(session);
      return;
    }

    localStorage.setItem(getScopedSessionKey(filterStateKey, session), JSON.stringify({
      serverUrl: session.serverUrl,
      userId: session.userId,
      serverId: session.serverId,
      filters: normalizedFilters,
      savedAt: new Date().toISOString(),
    }));
  }

  function clearFilterState(session) {
    localStorage.removeItem(getScopedSessionKey(filterStateKey, session));
  }

  function emptyFilterState() {
    return {
      genre: "",
      year: "",
      quality: "",
      favorite: "",
    };
  }

  function normalizeFilterState(filters) {
    const year = String(filters?.year || "").trim();
    const quality = String(filters?.quality || "").trim();
    const favorite = String(filters?.favorite || "").trim();

    return {
      genre: String(filters?.genre || "").trim(),
      year: /^\d{1,4}$/.test(year) ? year : "",
      quality: ["lossless", "lossy"].includes(quality) ? quality : "",
      favorite: ["favorite", "unfavorite"].includes(favorite) ? favorite : "",
    };
  }

  function isEmptyFilterState(filters) {
    return !filters.genre && !filters.year && !filters.quality && !filters.favorite;
  }

  function loadQueueState(session) {
    try {
      const saved = getQueueStateCandidates(session)
        .map((key) => {
          const raw = localStorage.getItem(key);
          if (!raw) {
            return null;
          }

          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })
        .find((candidate) => candidate && isSameSession(candidate, session));

      return normalizeQueueState(saved);
    } catch {
      return emptyQueueState();
    }
  }

  async function loadQueueStateAsync(session) {
    if (!queueDatabase) {
      return loadQueueState(session);
    }

    try {
      const saved = await queueDatabase.load(session);
      return saved && isSameSession(saved, session)
        ? normalizeQueueState(saved)
        : loadQueueState(session);
    } catch {
      return loadQueueState(session);
    }
  }

  function saveQueueState(queueState) {
    if (!queueState?.session || !Array.isArray(queueState.queue) || !queueState.queue.length) {
      clearQueueState(queueState?.session);
      return;
    }

    const savedAt = new Date().toISOString();
    const queue = queueState.queue.filter((track) => track?.Id).slice(0, maxQueueTracks);
    const payload = {
      serverUrl: queueState.session.serverUrl,
      userId: queueState.session.userId,
      serverId: queueState.session.serverId,
      queue: queue.slice(0, LOCAL_QUEUE_FALLBACK_LIMIT),
      currentTrackId: queueState.currentTrackId || "",
      currentTrackIndex: Number(queueState.currentTrackIndex) || 0,
      positionSeconds: Number(queueState.positionSeconds) || 0,
      savedAt,
    };

    try {
      localStorage.setItem(getScopedSessionKey(queueKey, queueState.session), JSON.stringify(payload));
    } catch {
      try {
        localStorage.setItem(getScopedSessionKey(queueKey, queueState.session), JSON.stringify({
          ...payload,
          queue: payload.queue.slice(0, Math.min(20, payload.queue.length)),
        }));
      } catch {
        getQueueStateCandidates(queueState.session).forEach((key) => localStorage.removeItem(key));
      }
    }

    void queueDatabase?.save({ ...queueState, queue, savedAt }).catch(() => {});
  }

  function clearQueueState(session) {
    getQueueStateCandidates(session).forEach((key) => {
      localStorage.removeItem(key);
    });
    void queueDatabase?.clear(session).catch(() => {});
  }

  function emptyQueueState() {
    return {
      queue: [],
      currentTrackIndex: -1,
      currentTrack: null,
      positionSeconds: 0,
      savedAt: "",
    };
  }

  function isSameSession(saved, session) {
    const sessionServerUrl = getSessionStorageServerUrl(session);

    if (!session?.userId || !sessionServerUrl) {
      return false;
    }

    return saved.userId === session.userId && getSavedQueueServerUrl(saved, session) === sessionServerUrl;
  }

  function normalizeQueueState(saved) {
    if (!saved) {
      return emptyQueueState();
    }

    const queue = Array.isArray(saved.queue)
      ? saved.queue.filter((track) => track?.Id).slice(0, maxQueueTracks)
      : [];

    if (!queue.length) {
      return emptyQueueState();
    }

    const fallbackIndex = Math.floor(clamp(Number(saved.currentTrackIndex) || 0, 0, queue.length - 1));
    const savedTrackIndex = saved.currentTrackId
      ? queue.findIndex((track) => track.Id === saved.currentTrackId)
      : -1;
    const resolvedIndex = savedTrackIndex >= 0 ? savedTrackIndex : fallbackIndex;

    return {
      queue,
      currentTrackIndex: resolvedIndex,
      currentTrack: queue[resolvedIndex] || queue[0],
      positionSeconds: Number.isFinite(Number(saved.positionSeconds))
        ? Math.max(0, Number(saved.positionSeconds))
        : 0,
      savedAt: typeof saved.savedAt === "string" ? saved.savedAt : "",
    };
  }

  function getSessionStorageServerUrl(session) {
    if (session?.sourceMode === "external") {
      return "source-bridge://external-source";
    }

    return normalizeStorageServerUrl(session?.serverUrl || "");
  }

  function getSavedQueueServerUrl(saved, session) {
    if (session?.sourceMode === "external" && saved?.userId === session.userId) {
      return "source-bridge://external-source";
    }

    return normalizeStorageServerUrl(saved?.serverUrl || "");
  }

  function normalizeStorageServerUrl(value) {
    return String(value || "").replace(/\/+$/, "").toLowerCase();
  }

  function getQueueStateCandidates(session) {
    return uniqueStorageKeys([
      getScopedSessionKey(queueKey, session),
      ...getExternalQueueStateFallbackKeys(queueKey, session),
      queueKey,
    ]);
  }

  function getExternalQueueStateFallbackKeys(baseKey, session) {
    if (session?.sourceMode !== "external" || !session?.userId) {
      return [];
    }

    const keys = new Set();
    [
      session.serverUrl,
      session.externalSourceApiUrl,
      "source-bridge://unconfigured",
    ].filter(Boolean).forEach((serverUrl) => {
      keys.add(getScopedSessionKey(baseKey, {
        ...session,
        sourceMode: "emby",
        serverUrl,
      }));
    });

    return [...keys];
  }

  function uniqueStorageKeys(keys) {
    return [...new Set(keys.filter(Boolean))];
  }

  function getScopedSessionKey(baseKey, session) {
    const profileKey = getAccountProfileKey(session);

    if (!profileKey) {
      return baseKey;
    }

    return `${baseKey}/${encodeURIComponent(profileKey)}`;
  }

  function loadPlayMode() {
    const savedMode = localStorage.getItem(playModeKey);
    return playModes.includes(savedMode) ? savedMode : "order";
  }

  function savePlayMode(mode) {
    localStorage.setItem(playModeKey, mode);
  }

  function clearPlayMode() {
    localStorage.removeItem(playModeKey);
  }

  function loadPlaybackStreamPolicy() {
    const savedPolicy = localStorage.getItem(playbackStreamKey);
    return playbackStreamPolicies.includes(savedPolicy) ? savedPolicy : "auto";
  }

  function savePlaybackStreamPolicy(policy) {
    localStorage.setItem(playbackStreamKey, policy);
  }

  function clearPlaybackStreamPolicy() {
    localStorage.removeItem(playbackStreamKey);
  }

  function loadSortOrder() {
    const savedOrder = localStorage.getItem(sortOrderKey);
    return sortOrders.includes(savedOrder) ? savedOrder : "default";
  }

  function loadSortKey() {
    const savedKey = localStorage.getItem(sortKeyKey);
    return sortKeys.includes(savedKey) ? savedKey : "recent";
  }

  function saveSortKey(sortKey) {
    localStorage.setItem(sortKeyKey, sortKeys.includes(sortKey) ? sortKey : "recent");
  }

  function clearSortKey() {
    localStorage.removeItem(sortKeyKey);
  }

  function saveSortOrder(order) {
    localStorage.setItem(sortOrderKey, sortOrders.includes(order) ? order : "default");
  }

  function clearSortOrder() {
    localStorage.removeItem(sortOrderKey);
  }

  function loadTranscodeBitrate() {
    const rawBitrate = Number(localStorage.getItem(transcodeBitrateKey));
    const allowedBitrates = transcodeBitrates.map((item) => Number(item.value));

    return allowedBitrates.includes(rawBitrate) ? rawBitrate : allowedBitrates[0];
  }

  function saveTranscodeBitrate(bitrate) {
    localStorage.setItem(transcodeBitrateKey, String(bitrate));
  }

  function clearTranscodeBitrate() {
    localStorage.removeItem(transcodeBitrateKey);
  }

  function loadAudioQualityProfile() {
    const savedProfile = localStorage.getItem(audioQualityProfileKey);
    const profiles = Array.isArray(audioQualityProfiles) ? audioQualityProfiles : [];

    return profiles.some((profile) => profile?.id === savedProfile)
      ? savedProfile
      : (profiles.find((profile) => profile?.recommended)?.id || profiles[0]?.id || "hls-aac-384");
  }

  function saveAudioQualityProfile(profileId) {
    localStorage.setItem(audioQualityProfileKey, profileId);
  }

  function clearAudioQualityProfile() {
    localStorage.removeItem(audioQualityProfileKey);
  }

  function loadPlaybackPreloadEnabled() {
    const saved = localStorage.getItem(PLAYBACK_PRELOAD_KEY);
    return saved === null ? true : saved === "true";
  }

  function savePlaybackPreloadEnabled(isEnabled) {
    localStorage.setItem(PLAYBACK_PRELOAD_KEY, isEnabled ? "true" : "false");
  }

  function clearPlaybackPreloadEnabled() {
    localStorage.removeItem(PLAYBACK_PRELOAD_KEY);
  }

  function loadPlaybackLosslessPrecacheEnabled() {
    return localStorage.getItem(PLAYBACK_LOSSLESS_PRECACHE_KEY) === "true";
  }

  function savePlaybackLosslessPrecacheEnabled(isEnabled) {
    localStorage.setItem(PLAYBACK_LOSSLESS_PRECACHE_KEY, isEnabled ? "true" : "false");
  }

  function clearPlaybackLosslessPrecacheEnabled() {
    localStorage.removeItem(PLAYBACK_LOSSLESS_PRECACHE_KEY);
  }

  function loadTrackDensity() {
    const savedDensity = localStorage.getItem(trackDensityKey);
    return trackDensities.includes(savedDensity) ? savedDensity : "comfortable";
  }

  function saveTrackDensity(density) {
    localStorage.setItem(trackDensityKey, trackDensities.includes(density) ? density : "comfortable");
  }

  function clearTrackDensity() {
    localStorage.removeItem(trackDensityKey);
  }

  function loadPlayerMetaTarget() {
    const savedTarget = localStorage.getItem(playerMetaTargetKey);
    return playerMetaTargets.includes(savedTarget) ? savedTarget : "immersive";
  }

  function savePlayerMetaTarget(target) {
    localStorage.setItem(playerMetaTargetKey, playerMetaTargets.includes(target) ? target : "immersive");
  }

  function clearPlayerMetaTarget() {
    localStorage.removeItem(playerMetaTargetKey);
  }

  function loadVolume() {
    const rawVolume = localStorage.getItem(volumeKey);

    if (rawVolume === null || rawVolume === "") {
      return 1;
    }

    const savedVolume = Number(rawVolume);
    return Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : 1;
  }

  function saveVolume(volume) {
    localStorage.setItem(volumeKey, String(volume));
  }

  function clearVolume() {
    localStorage.removeItem(volumeKey);
  }

  function getDeviceId() {
    const existing = localStorage.getItem(deviceKey);

    if (existing) {
      return existing;
    }

    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(deviceKey, id);
    return id;
  }

  function loadDeviceName(defaultName) {
    return localStorage.getItem(DEVICE_NAME_KEY) || defaultName;
  }

  function saveDeviceName(deviceName) {
    localStorage.setItem(DEVICE_NAME_KEY, deviceName);
  }

  function getDefaultDeviceName() {
    const platform = navigator.platform || "Browser";
    return `${appName} on ${platform}`;
  }

  return {
    getAccountProfileKey,
    clearAudioQualityProfile,
    clearFilterState,
    clearPlaybackLosslessPrecacheEnabled,
    clearPlaybackStreamPolicy,
    clearPlaybackPreloadEnabled,
    clearPlayerMetaTarget,
    clearLibraryViewId,
    clearPlayMode,
    clearQueueState,
    clearSession,
    clearSortKey,
    clearSortOrder,
    clearTrackDensity,
    clearTranscodeBitrate,
    clearVolume,
    getDefaultDeviceName,
    getDeviceId,
    loadDeviceName,
    loadAccountProfiles,
    loadAudioQualityProfile,
    loadFilterState,
    loadLibraryViewId,
    loadPlaybackLosslessPrecacheEnabled,
    loadPlaybackStreamPolicy,
    loadPlaybackPreloadEnabled,
    loadPlayerMetaTarget,
    loadPlayMode,
    loadQueueState,
    loadQueueStateAsync,
    loadRecentTracks,
    loadSession,
    loadSortKey,
    loadSortOrder,
    loadTrackDensity,
    loadTranscodeBitrate,
    loadVolume,
    saveDeviceName,
    removeAccountProfile,
    saveAccountProfile,
    saveAudioQualityProfile,
    saveFilterState,
    saveLibraryViewId,
    savePlaybackLosslessPrecacheEnabled,
    savePlaybackStreamPolicy,
    savePlaybackPreloadEnabled,
    savePlayerMetaTarget,
    savePlayMode,
    saveQueueState,
    saveRecentTracks,
    saveSession,
    saveSortKey,
    saveSortOrder,
    saveTrackDensity,
    saveTranscodeBitrate,
    saveVolume,
  };
}

window.EmbyMusicStorage = {
  createEmbyMusicStorage,
};
})();
