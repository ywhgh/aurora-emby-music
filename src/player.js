export function normalizeVolume(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.min(1, Math.max(0, Number(fallback) || 0));
  }
  return Math.min(1, Math.max(0, numeric));
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
