export function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

export function matchesQuery(item, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  const text = [
    item?.Name,
    item?.Album,
    item?.AlbumArtist,
    ...(item?.Artists || []),
    ...(item?.ArtistItems || []).map((artist) => artist?.Name),
    ...(item?.AlbumArtists || []).map((artist) => artist?.Name),
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes(normalizedQuery);
}

export function getSortDirection(sortKey, sortOrder) {
  if (sortOrder === "asc") return 1;
  if (sortOrder === "desc") return -1;
  return ["recent", "duration"].includes(sortKey) ? -1 : 1;
}

export function sortTracks(tracks, options) {
  const { sortKey, sortOrder, compareText, compareNumber, compareDate, getArtists } = options;
  const direction = getSortDirection(sortKey, sortOrder);
  return [...tracks].sort((left, right) => {
    let result;
    switch (sortKey) {
      case "title": result = compareText(left.Name, right.Name); break;
      case "artist": result = compareText(getArtists(left), getArtists(right)) || compareText(left.Name, right.Name); break;
      case "album": result = compareText(left.Album, right.Album)
        || compareNumber(left.ParentIndexNumber, right.ParentIndexNumber)
        || compareNumber(left.IndexNumber, right.IndexNumber)
        || compareText(left.Name, right.Name); break;
      case "duration": result = compareNumber(left.RunTimeTicks, right.RunTimeTicks); break;
      case "recent":
      default: result = compareDate(left.DateCreated, right.DateCreated); break;
    }
    return (result * direction) || compareText(left.Name, right.Name);
  });
}

export function sortCollections(items, options) {
  const { kind, sortKey, sortOrder, compareText, compareDate, getArtists } = options;
  const direction = getSortDirection(sortKey, sortOrder);
  return [...items].sort((left, right) => {
    let result;
    if (kind === "album") {
      result = sortKey === "title"
        ? compareText(left.Name, right.Name)
        : sortKey === "artist"
          ? compareText(getArtists(left), getArtists(right)) || compareText(left.Name, right.Name)
          : compareDate(left.DateCreated, right.DateCreated);
    } else {
      result = compareText(left.SortName || left.Name, right.SortName || right.Name);
    }
    return (result * direction) || compareText(left.Name, right.Name);
  });
}

export function collectGenres(items, getGenres, compareText) {
  const genres = new Set();
  items.forEach((item) => getGenres(item).forEach((genre) => genres.add(genre)));
  return [...genres].sort(compareText);
}

export function collectYears(items, getProductionYear) {
  const years = new Set();
  items.forEach((item) => {
    const year = getProductionYear(item);
    if (year) years.add(year);
  });
  return [...years].sort((left, right) => right - left);
}
