(() => {
function toUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function redactHost(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");

  if (!host) {
    return "***";
  }

  if (/^\d+(?:\.\d+){3}$/.test(host)) {
    return `${host.split(".").slice(0, 2).join(".")}.*.*`;
  }

  if (host.includes(":")) {
    return "[***]";
  }

  const labels = host.split(".");
  return labels.map((part, index) => {
    if (index === labels.length - 1 && labels.length > 1) {
      return part;
    }

    return part.length > 2 ? `${part.slice(0, 3)}***` : "***";
  }).join(".");
}

function redactUserInfo(username) {
  const value = String(username || "");
  return value ? `${value.slice(0, 2)}***` : "";
}

function formatRedactedUrl(value, includePath) {
  const url = toUrl(value);

  if (!url || !url.protocol || !url.hostname) {
    return "***";
  }

  const userInfo = url.username ? `${redactUserInfo(url.username)}@` : "";
  const port = url.port ? ":****" : "";
  const path = includePath && url.pathname && url.pathname !== "/" ? url.pathname : "";

  return `${url.protocol}//${userInfo}${redactHost(url.hostname)}${port}${path}`;
}

function redactUrl(value) {
  return formatRedactedUrl(value, false);
}

function redactServer(value) {
  return formatRedactedUrl(value, true);
}

function redactToken(value) {
  const token = String(value || "").trim();
  return token ? `***${token.slice(-4)}` : "";
}

function redactText(value) {
  const text = String(value || "");
  const urlPattern = /\bhttps?:\/\/[^\s"'<>]+/gi;
  const fieldPattern = /\b(serverUrl|serverId|userId|accessToken|deviceId|deviceName|externalSourceApiUrl|lyricsSourceBridgeApiUrl)\b(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi;

  return text
    .replace(urlPattern, (match) => {
      const trailing = match.match(/[),.;!?]+$/)?.[0] || "";
      return redactUrl(match.slice(0, match.length - trailing.length)) + trailing;
    })
    .replace(/\b(Bearer\s+|X-Emby-Token\s*[:=]\s*)[^\s,;]+/gi, "$1***")
    .replace(fieldPattern, (_match, field, separator) => `${field}${separator}***`);
}

window.EmbyMusicRedact = {
  redactServer,
  redactText,
  redactToken,
  redactUrl,
};
})();
