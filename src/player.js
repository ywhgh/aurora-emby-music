export function normalizeVolume(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.min(1, Math.max(0, Number(fallback) || 0));
  }
  return Math.min(1, Math.max(0, numeric));
}

export function getReplayGainDb(mediaSources, preferredMediaSourceId = "") {
  const sources = Array.isArray(mediaSources) ? mediaSources : [];
  const ordered = preferredMediaSourceId
    ? [...sources.filter((source) => source?.Id === preferredMediaSourceId), ...sources.filter((source) => source?.Id !== preferredMediaSourceId)]
    : sources;
  for (const source of ordered) {
    const streams = Array.isArray(source?.MediaStreams) ? source.MediaStreams : [];
    for (const stream of streams) {
      const raw = stream?.ReplayGain;
      const candidate = raw && typeof raw === "object"
        ? raw.TrackGain ?? raw.AlbumGain ?? raw.Gain
        : raw;
      const numeric = Number.parseFloat(String(candidate ?? "").replace(/\s*dB\s*$/i, ""));
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return null;
}

export function replayGainToMultiplier(replayGainDb) {
  const numeric = Number(replayGainDb);
  return Number.isFinite(numeric) ? Math.pow(10, numeric / 20) : 1;
}

export function getPlaybackPosition(audio, fallback = 0) {
  const currentTime = Number(audio?.currentTime);
  return Number.isFinite(currentTime) && currentTime > 0
    ? currentTime
    : Math.max(0, Number(fallback) || 0);
}

export function seekPlayer(audio, positionSeconds, durationSeconds, options = {}) {
  const duration = Number(durationSeconds);
  const requested = Number(positionSeconds);
  if (!audio?.src || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(requested)) {
    return false;
  }

  const position = Math.min(duration, Math.max(0, requested));
  try {
    if (options.fastSeek && typeof audio.fastSeek === "function") {
      audio.fastSeek(position);
    } else {
      audio.currentTime = position;
    }
  } catch {
    audio.currentTime = position;
  }
  return position;
}
