const SENSITIVE_KEYS = new Set([
  "serverurl", "serverid", "userid", "accesstoken", "deviceid", "devicename",
  "externalsourceapiurl", "lyricssourcebridgeapiurl", "host", "hostname", "origin",
]);
const HOST_PATTERN = /(?:https?:\/\/|source-bridge:\/\/|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b)/i;
const TRACK_FIELDS = [
  "Id", "Name", "Album", "AlbumId", "Artists", "ArtistItems", "AlbumArtists",
  "RunTimeTicks", "ProductionYear", "Genres", "Type", "MediaType", "IndexNumber",
  "ParentIndexNumber", "ImageTags", "AlbumPrimaryImageTag", "UserData",
];

export function containsSensitiveData(value, seen = new Set()) {
  if (typeof value === "string") return HOST_PATTERN.test(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => SENSITIVE_KEYS.has(key.toLowerCase()) || containsSensitiveData(child, seen));
}

export function sanitizeTrack(track) {
  const clean = {};
  TRACK_FIELDS.forEach((key) => {
    if (track?.[key] !== undefined && !containsSensitiveData(track[key])) clean[key] = track[key];
  });
  if (clean.UserData) {
    clean.UserData = {
      IsFavorite: Boolean(clean.UserData.IsFavorite),
      PlaybackPositionTicks: Number(clean.UserData.PlaybackPositionTicks) || 0,
      PlayCount: Number(clean.UserData.PlayCount) || 0,
    };
  }
  return clean.Id ? clean : null;
}

export function sanitizeTrackList(items, limit = 10000) {
  return (Array.isArray(items) ? items : []).slice(0, limit).map(sanitizeTrack).filter(Boolean);
}

export function createExportPayload(data, appVersion, generatedAt = new Date().toISOString()) {
  return {
    version: 1,
    metadata: { appVersion: String(appVersion || ""), generatedAt },
    data: {
      queue: sanitizeTrackList(data?.queue),
      favorites: sanitizeTrackList(data?.favorites),
      recent: sanitizeTrackList(data?.recent),
      preferences: { ...(data?.preferences || {}) },
    },
  };
}

export function validateImportPayload(input) {
  const payload = typeof input === "string" ? JSON.parse(input) : input;
  if (!payload || payload.version !== 1 || !payload.data || typeof payload.data !== "object") {
    throw new TypeError("Unsupported local data version");
  }
  if (containsSensitiveData(payload)) throw new TypeError("Sensitive fields detected");
  return createExportPayload(payload.data, payload.metadata?.appVersion, payload.metadata?.generatedAt);
}
