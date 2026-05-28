(() => {
function formatTicks(ticks) {
  if (!ticks) {
    return "--:--";
  }

  return formatSeconds(ticks / 10000000);
}

function formatSeconds(value) {
  const seconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDuration(value) {
  const seconds = Math.max(0, Math.floor(value || 0));

  if (!seconds) {
    return "";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  if (hours) {
    return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }

  if (minutes) {
    return `${minutes} 分`;
  }

  return `${remaining} 秒`;
}

function secondsToTicks(value) {
  return Math.max(0, Math.floor((value || 0) * 10000000));
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function formatCount(value) {
  const number = Number(value || 0);
  return number.toLocaleString("zh-CN");
}

function formatBitrate(value) {
  const bitrate = Number(value);

  if (!Number.isFinite(bitrate) || bitrate <= 0) {
    return "";
  }

  if (bitrate >= 1000000) {
    const mbps = bitrate / 1000000;
    return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(1)} Mbps`;
  }

  return `${Math.round(bitrate / 1000)} kbps`;
}

function coverClass(index) {
  return ["cover-a", "cover-b", "cover-c", "cover-d", "cover-e"][index % 5];
}

function escapeHeaderValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.EmbyMusicFormat = {
  clamp,
  coverClass,
  escapeHeaderValue,
  escapeHtml,
  formatBitrate,
  formatCount,
  formatDuration,
  formatSeconds,
  formatTicks,
  secondsToTicks,
};
})();
