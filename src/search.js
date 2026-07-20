export function normalizeQuery(value) {
  return String(value || "").trim();
}

export function normalizeHistory(history, limit = 10) {
  return Array.isArray(history)
    ? history.map(normalizeQuery).filter(Boolean).slice(0, limit)
    : [];
}

export function addHistory(history, query, options = {}) {
  const normalizedQuery = normalizeQuery(query);
  const minLength = Number(options.minLength) || 1;
  const limit = Number(options.limit) || 10;
  if (normalizedQuery.length < minLength) {
    return normalizeHistory(history, limit);
  }
  return [
    normalizedQuery,
    ...normalizeHistory(history, limit).filter((item) => item.toLowerCase() !== normalizedQuery.toLowerCase()),
  ].slice(0, limit);
}

export function removeHistory(history, query, limit = 10) {
  const normalizedQuery = normalizeQuery(query).toLowerCase();
  return normalizeHistory(history, limit).filter((item) => item.toLowerCase() !== normalizedQuery);
}

export function getScopedHistoryKey(baseKey, profileKey) {
  return profileKey ? `${baseKey}/${encodeURIComponent(profileKey)}` : baseKey;
}
