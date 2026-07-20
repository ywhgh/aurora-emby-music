export function normalizeApiUrl(value, normalizer) {
  return typeof normalizer === "function" ? normalizer(value) : String(value || "").trim();
}

export function looksLikeManifestUrl(value) {
  return /\.json(?:$|[?#])/i.test(String(value || "").trim());
}

export function normalizeHttpUrl(value, normalizer) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return "";
    return normalizeApiUrl(url.toString(), normalizer);
  } catch {
    return "";
  }
}

export function isUnconfiguredUrl(value) {
  return String(value || "").trim().toLowerCase() === "source-bridge://unconfigured";
}
