#!/usr/bin/env node
"use strict";

/**
 * Local mock Emby server.
 *
 * Serves just enough of the Emby REST surface that app.js consumes so the
 * logged-in UI (library, player, immersive view) can be exercised and
 * screenshotted without a real media server. Node built-ins only.
 *
 *   node ./scripts/mock-emby.js [port]
 *
 * Optional compatibility mode for playlist-read smoke tests:
 *   MOCK_EMBY_PLAYLIST_READ_MODE=both|playlist-only|parent-only
 *
 * Then log in from the app with any username/password against
 * http://127.0.0.1:<port>.
 */

const http = require("node:http");
const zlib = require("node:zlib");

const PORT = Number(process.argv[2] || process.env.MOCK_EMBY_PORT || 8096);
const requestedPlaylistReadMode = String(process.env.MOCK_EMBY_PLAYLIST_READ_MODE || "both").trim().toLowerCase();
const PLAYLIST_READ_MODE = ["both", "playlist-only", "parent-only"].includes(requestedPlaylistReadMode)
  ? requestedPlaylistReadMode
  : "both";
const SERVER_ID = "mock-emby-server-0001";
const USER_ID = "mock-user-0001";
const ACCESS_TOKEN = "mock-access-token";
const VIEW_ID = "view-music";
const TICKS_PER_SECOND = 10_000_000;

// ---------------------------------------------------------------------------
// Deterministic catalog
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARTIST_NAMES = [
  "夏日回声", "Northern Lantern", "陈可依", "Velvet Harbor", "林间电台", "Slow Tide",
  "白鲸计划", "Paper Cranes", "沈亦白", "Midnight Atlas", "苏合", "Quiet Machines",
];
const ALBUM_WORDS = [
  "潮汐", "Afterglow", "折返", "Blue Hour", "共鸣", "Paper Sky", "静电", "Long Way Home",
  "候鸟", "Slow Motion", "灯塔", "Open Water", "回声室", "Undercurrent", "浮岛", "Northbound",
  "夜行", "Cassette", "序章", "Signal Fade", "云图", "Sunroom", "远洋", "Half Light",
];
const TRACK_WORDS = [
  "夜航", "Drift", "第一场雪", "Runaway", "旧信封", "Amber", "无风带", "Static Bloom",
  "沿海公路", "Ceiling Fan", "候车厅", "Weightless", "冷光", "Paper Boats", "回南天", "Slow Burn",
  "远处的灯", "Undertow", "空白页", "Evergreen", "山雾", "Nightshift", "潜行", "Tin Roof",
];
const GENRES = ["独立流行", "Indie Rock", "民谣", "Ambient", "电子", "City Pop", "爵士"];
const QUALITY_TIERS = [
  { container: "flac", codec: "flac", bitrate: 1_058_000, bitDepth: 24, sampleRate: 96_000 },
  { container: "flac", codec: "flac", bitrate: 906_000, bitDepth: 16, sampleRate: 44_100 },
  { container: "m4a", codec: "aac", bitrate: 256_000, bitDepth: 0, sampleRate: 44_100 },
  { container: "mp3", codec: "mp3", bitrate: 320_000, bitDepth: 0, sampleRate: 44_100 },
  { container: "mp3", codec: "mp3", bitrate: 128_000, bitDepth: 0, sampleRate: 44_100 },
];

function buildCatalog() {
  const random = mulberry32(20260727);
  const artists = ARTIST_NAMES.map((name, index) => ({
    Id: `artist-${index + 1}`,
    Name: name,
    SortName: name,
    Type: "MusicArtist",
    ServerId: SERVER_ID,
    ImageTags: { Primary: `artist-tag-${index + 1}` },
    UserData: { IsFavorite: index % 5 === 0, PlayCount: Math.floor(random() * 40) },
  }));

  const albums = [];
  const tracks = [];

  ALBUM_WORDS.forEach((word, albumIndex) => {
    const artist = artists[albumIndex % artists.length];
    const year = 2013 + (albumIndex % 12);
    const genre = GENRES[albumIndex % GENRES.length];
    const albumId = `album-${albumIndex + 1}`;
    const trackCount = 6 + (albumIndex % 5);
    const albumTracks = [];

    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      const tier = QUALITY_TIERS[(albumIndex + trackIndex) % QUALITY_TIERS.length];
      const seconds = 132 + Math.floor(random() * 168);
      const trackId = `track-${albumIndex + 1}-${trackIndex + 1}`;
      const mediaSourceId = `source-${trackId}`;

      albumTracks.push({
        Id: trackId,
        Name: `${TRACK_WORDS[(albumIndex * 3 + trackIndex) % TRACK_WORDS.length]}${trackIndex ? ` ${trackIndex + 1}` : ""}`,
        SortName: trackId,
        Type: "Audio",
        MediaType: "Audio",
        ServerId: SERVER_ID,
        ParentId: albumId,
        Album: word,
        AlbumId: albumId,
        AlbumArtist: artist.Name,
        AlbumPrimaryImageTag: `album-tag-${albumIndex + 1}`,
        Artists: [artist.Name],
        ArtistItems: [{ Id: artist.Id, Name: artist.Name }],
        AlbumArtists: [{ Id: artist.Id, Name: artist.Name }],
        IndexNumber: trackIndex + 1,
        ParentIndexNumber: 1,
        ProductionYear: year,
        Genres: [genre],
        RunTimeTicks: seconds * TICKS_PER_SECOND,
        DateCreated: new Date(Date.UTC(year, albumIndex % 12, 1 + (trackIndex % 27))).toISOString(),
        ImageTags: {},
        UserData: {
          IsFavorite: (albumIndex + trackIndex) % 7 === 0,
          PlayCount: Math.floor(random() * 25),
          Played: false,
          PlaybackPositionTicks: 0,
        },
        MediaSources: [{
          Id: mediaSourceId,
          Name: word,
          Container: tier.container,
          Size: Math.round((tier.bitrate / 8) * seconds),
          Bitrate: tier.bitrate,
          SupportsDirectPlay: true,
          SupportsDirectStream: true,
          SupportsTranscoding: true,
          MediaStreams: [{
            Type: "Audio",
            Codec: tier.codec,
            BitRate: tier.bitrate,
            BitDepth: tier.bitDepth || undefined,
            SampleRate: tier.sampleRate,
            Channels: 2,
            IsDefault: true,
          }],
        }],
      });
    }

    const albumSeconds = albumTracks.reduce((total, track) => total + track.RunTimeTicks, 0);

    albums.push({
      Id: albumId,
      Name: word,
      SortName: word,
      Type: "MusicAlbum",
      ServerId: SERVER_ID,
      ParentId: VIEW_ID,
      AlbumArtist: artist.Name,
      Artists: [artist.Name],
      ArtistItems: [{ Id: artist.Id, Name: artist.Name }],
      AlbumArtists: [{ Id: artist.Id, Name: artist.Name }],
      ProductionYear: year,
      Genres: [genre],
      ChildCount: trackCount,
      RunTimeTicks: albumSeconds,
      DateCreated: new Date(Date.UTC(year, albumIndex % 12, 1)).toISOString(),
      ImageTags: { Primary: `album-tag-${albumIndex + 1}` },
      UserData: { IsFavorite: albumIndex % 6 === 0, PlayCount: Math.floor(random() * 30) },
    });

    tracks.push(...albumTracks);
  });

  const playlists = ["深夜通勤", "Focus Flow", "周末清晨", "Rainy Window"].map((name, index) => {
    const memberIds = tracks.filter((_, position) => position % (4 + index) === index).slice(0, 18).map((track) => track.Id);
    return {
      Id: `playlist-${index + 1}`,
      Name: name,
      SortName: name,
      Type: "Playlist",
      MediaType: "Audio",
      ServerId: SERVER_ID,
      ChildCount: memberIds.length,
      RunTimeTicks: memberIds.length * 210 * TICKS_PER_SECOND,
      DateCreated: new Date(Date.UTC(2025, index, 12)).toISOString(),
      ImageTags: { Primary: `playlist-tag-${index + 1}` },
      UserData: { IsFavorite: false, PlayCount: 0 },
      MemberIds: memberIds,
    };
  });

  return { artists, albums, tracks, playlists };
}

const catalog = buildCatalog();
const itemsById = new Map();
[...catalog.artists, ...catalog.albums, ...catalog.tracks, ...catalog.playlists].forEach((item) => {
  itemsById.set(item.Id, item);
});

const VIEWS = [{
  Id: VIEW_ID,
  Name: "音乐",
  ServerId: SERVER_ID,
  Type: "CollectionFolder",
  CollectionType: "music",
  ImageTags: { Primary: "view-tag-1" },
}];

// ---------------------------------------------------------------------------
// Media synthesis
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue] = pixelAt(x, y);
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] = hue < 60 ? [chroma, secondary, 0]
    : hue < 120 ? [secondary, chroma, 0]
      : hue < 180 ? [0, chroma, secondary]
        : hue < 240 ? [0, secondary, chroma]
          : hue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return [
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255),
  ];
}

const coverCache = new Map();

function buildCover(itemId, size) {
  const cacheKey = `${itemId}:${size}`;
  const cached = coverCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const seed = hashString(itemId);
  const hueA = seed % 360;
  const hueB = (hueA + 40 + (seed >>> 8) % 120) % 360;
  const stripe = 3 + ((seed >>> 16) % 5);
  const png = encodePng(size, (x, y) => {
    const diagonal = (x + y) / (size * 2);
    const band = Math.sin(((x - y) / size) * Math.PI * stripe) * 0.08;
    const mix = Math.min(1, Math.max(0, diagonal + band));
    const hue = hueA + (hueB - hueA) * mix;
    return hslToRgb(((hue % 360) + 360) % 360, 0.52, 0.34 + mix * 0.28);
  });

  coverCache.set(cacheKey, png);
  return png;
}

const audioCache = new Map();

function buildAudio(itemId) {
  const cached = audioCache.get(itemId);
  if (cached) {
    return cached;
  }

  const sampleRate = 22050;
  const seconds = 12;
  const base = 174 + (hashString(itemId) % 12) * 18;
  const sampleCount = sampleRate * seconds;
  const data = Buffer.alloc(sampleCount * 2);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.max(0, Math.min(1, time * 4, (seconds - time) * 4));
    const tone = Math.sin(2 * Math.PI * base * time) * 0.55
      + Math.sin(2 * Math.PI * base * 1.5 * time) * 0.25
      + Math.sin(2 * Math.PI * base * 0.5 * time) * 0.2;
    data.writeInt16LE(Math.round(tone * envelope * 7000), index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  const wav = Buffer.concat([header, data]);
  audioCache.set(itemId, wav);
  return wav;
}

// ---------------------------------------------------------------------------
// Query handling
// ---------------------------------------------------------------------------

function matchesSearch(item, term) {
  if (!term) {
    return true;
  }
  const needle = term.toLowerCase();
  return [item.Name, item.Album, item.AlbumArtist, ...(item.Artists || [])]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle));
}

function poolFor(types) {
  if (types.includes("MusicAlbum")) return catalog.albums;
  if (types.includes("MusicArtist") || types.includes("AlbumArtist")) return catalog.artists;
  if (types.includes("Playlist")) return catalog.playlists;
  return catalog.tracks;
}

function sortItems(items, sortBy, sortOrder) {
  const keys = String(sortBy || "SortName").split(",").map((key) => key.trim()).filter(Boolean);
  const descending = String(sortOrder || "Ascending").toLowerCase() === "descending";
  const sorted = items.slice().sort((left, right) => {
    for (const key of keys) {
      const leftValue = left[key] ?? left.SortName ?? left.Name ?? "";
      const rightValue = right[key] ?? right.SortName ?? right.Name ?? "";
      if (leftValue === rightValue) continue;
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return leftValue - rightValue;
      }
      return String(leftValue).localeCompare(String(rightValue), "zh-Hans-CN");
    }
    return String(left.Id).localeCompare(String(right.Id));
  });
  return descending ? sorted.reverse() : sorted;
}

function queryItems(params) {
  const types = String(params.get("IncludeItemTypes") || "").split(",").map((type) => type.trim()).filter(Boolean);
  const parentId = params.get("ParentId") || "";
  const searchTerm = params.get("SearchTerm") || "";
  const startIndex = Number(params.get("StartIndex") || 0) || 0;
  const limit = Number(params.get("Limit") || 0) || 0;
  const ids = String(params.get("Ids") || "").split(",").map((id) => id.trim()).filter(Boolean);

  let pool = ids.length
    ? ids.map((id) => itemsById.get(id)).filter(Boolean)
    : poolFor(types);
  let playlistEntryPrefix = "";

  if (!ids.length) {
    const parent = parentId ? itemsById.get(parentId) : null;
    if (parent && parent.Type === "MusicAlbum") {
      pool = catalog.tracks.filter((track) => track.AlbumId === parentId);
    } else if (parent && parent.Type === "MusicArtist") {
      pool = pool.filter((item) => (item.ArtistItems || []).some((artist) => artist.Id === parentId));
    } else if (parent && parent.Type === "Playlist") {
      playlistEntryPrefix = parent.Id;
      pool = PLAYLIST_READ_MODE === "playlist-only"
        ? []
        : (parent.MemberIds || []).map((id) => itemsById.get(id)).filter(Boolean);
    }

    if (params.get("IsFavorite") === "true") {
      pool = pool.filter((item) => item.UserData?.IsFavorite);
    }
    if (params.get("AlbumIds")) {
      const albumIds = new Set(String(params.get("AlbumIds")).split(","));
      pool = pool.filter((item) => albumIds.has(item.AlbumId));
    }
    if (params.get("ArtistIds")) {
      const artistIds = new Set(String(params.get("ArtistIds")).split(","));
      pool = pool.filter((item) => (item.ArtistItems || []).some((artist) => artistIds.has(artist.Id)));
    }
    if (params.get("Genres")) {
      const genres = new Set(String(params.get("Genres")).split("|"));
      pool = pool.filter((item) => (item.Genres || []).some((genre) => genres.has(genre)));
    }
    if (params.get("Years")) {
      const years = new Set(String(params.get("Years")).split(",").map(Number));
      pool = pool.filter((item) => years.has(Number(item.ProductionYear)));
    }
    pool = pool.filter((item) => matchesSearch(item, searchTerm));
  }

  const sorted = ids.length ? pool : sortItems(pool, params.get("SortBy"), params.get("SortOrder"));
  const page = limit > 0 ? sorted.slice(startIndex, startIndex + limit) : sorted.slice(startIndex);

  return {
    Items: page.map(({ MemberIds, ...item }, index) => playlistEntryPrefix
      ? { ...item, PlaylistItemId: `${playlistEntryPrefix}-entry-${startIndex + index}` }
      : item),
    TotalRecordCount: sorted.length,
    StartIndex: startIndex,
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function withCors(response, extraHeaders = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "content-length,content-range,accept-ranges",
    "cache-control": "no-store",
    ...extraHeaders,
  };
}

function sendJson(response, payload, status = 200) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(status, withCors(response, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
  }));
  response.end(body);
}

function sendBuffer(request, response, buffer, contentType) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || "");

  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), buffer.length - 1) : buffer.length - 1;
    if (start >= buffer.length || start > end) {
      response.writeHead(416, withCors(response, { "content-range": `bytes */${buffer.length}` }));
      response.end();
      return;
    }
    const slice = buffer.subarray(start, end + 1);
    response.writeHead(206, withCors(response, {
      "content-type": contentType,
      "content-length": slice.length,
      "content-range": `bytes ${start}-${end}/${buffer.length}`,
      "accept-ranges": "bytes",
    }));
    response.end(request.method === "HEAD" ? undefined : slice);
    return;
  }

  response.writeHead(200, withCors(response, {
    "content-type": contentType,
    "content-length": buffer.length,
    "accept-ranges": "bytes",
  }));
  response.end(request.method === "HEAD" ? undefined : buffer);
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", () => resolve(""));
  });
}

function buildPlaybackInfo(track, mediaSourceId) {
  const source = track.MediaSources?.[0] || {};
  return {
    PlaySessionId: `mock-play-session-${track.Id}`,
    MediaSources: [{
      ...source,
      Id: mediaSourceId || source.Id,
      SupportsDirectPlay: true,
      SupportsDirectStream: true,
      SupportsTranscoding: true,
      RunTimeTicks: track.RunTimeTicks,
      Path: `/mock/${track.Id}.${source.Container || "mp3"}`,
      Protocol: "File",
    }],
  };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, withCors(response, { "access-control-max-age": "600" }));
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://localhost:${PORT}`);
  const path = url.pathname.replace(/^\/emby(?=\/|$)/i, "") || "/";
  const params = url.searchParams;

  if (path === "/System/Info/Public") {
    sendJson(response, {
      Id: SERVER_ID,
      ServerName: "Mock Emby",
      Version: "4.8.0.0-mock",
      LocalAddress: `http://127.0.0.1:${PORT}`,
      OperatingSystem: "Mock",
      ProductName: "Emby Server",
    });
    return;
  }

  if (path === "/Users/AuthenticateByName" && request.method === "POST") {
    const body = await readBody(request);
    let username = "demo";
    try {
      username = JSON.parse(body || "{}").Username || username;
    } catch {
      // Keep the default username when the payload is not JSON.
    }
    sendJson(response, {
      AccessToken: ACCESS_TOKEN,
      ServerId: SERVER_ID,
      SessionInfo: { Id: "mock-session", UserId: USER_ID },
      User: { Id: USER_ID, Name: username, ServerId: SERVER_ID, HasPassword: true },
    });
    return;
  }

  const viewsMatch = /^\/Users\/[^/]+\/Views$/.exec(path);
  if (viewsMatch) {
    sendJson(response, { Items: VIEWS, TotalRecordCount: VIEWS.length });
    return;
  }

  const userItemsMatch = /^\/Users\/[^/]+\/Items$/.exec(path);
  if (userItemsMatch) {
    sendJson(response, queryItems(params));
    return;
  }

  const userItemMatch = /^\/Users\/[^/]+\/Items\/([^/]+)$/.exec(path);
  if (userItemMatch) {
    const item = itemsById.get(decodeURIComponent(userItemMatch[1]));
    if (!item) {
      sendJson(response, { error: "not found" }, 404);
      return;
    }
    const { MemberIds, ...payload } = item;
    sendJson(response, payload);
    return;
  }

  const favoriteMatch = /^\/Users\/[^/]+\/FavoriteItems\/([^/]+)(\/Delete)?$/.exec(path);
  if (favoriteMatch) {
    const item = itemsById.get(decodeURIComponent(favoriteMatch[1]));
    if (item) {
      item.UserData = { ...(item.UserData || {}), IsFavorite: !favoriteMatch[2] };
    }
    sendJson(response, item?.UserData || { IsFavorite: false });
    return;
  }

  const userMatch = /^\/Users\/([^/]+)$/.exec(path);
  if (userMatch) {
    sendJson(response, { Id: USER_ID, Name: "demo", ServerId: SERVER_ID, Policy: { IsAdministrator: false } });
    return;
  }

  const lyricsMatch = /^\/Items\/([^/]+)\/Lyrics$/.exec(path);
  if (lyricsMatch) {
    const track = itemsById.get(decodeURIComponent(lyricsMatch[1]));
    if (!track || track.Type !== "Audio") {
      sendJson(response, { error: "lyrics not found" }, 404);
      return;
    }
    sendJson(response, {
      Lyrics: [
        { Start: "00:00:01.0000000", Text: `Emby lyric: ${track.Name}`, TranslatedText: `Emby translation: ${track.Name}` },
        { StartPositionTicks: 30000000, Text: "Emby second lyric line", Translation: "Emby second translated line" },
      ],
    });
    return;
  }

  const playbackMatch = /^\/Items\/([^/]+)\/PlaybackInfo$/.exec(path);
  if (playbackMatch) {
    const track = itemsById.get(decodeURIComponent(playbackMatch[1]));
    if (!track) {
      sendJson(response, { error: "not found" }, 404);
      return;
    }
    if (request.method === "POST") {
      await readBody(request);
    }
    sendJson(response, buildPlaybackInfo(track, params.get("MediaSourceId")));
    return;
  }

  const imageMatch = /^\/Items\/([^/]+)\/Images\/Primary$/.exec(path);
  if (imageMatch) {
    const requestedWidth = Number(params.get("maxWidth") || params.get("MaxWidth") || 480);
    const size = Math.max(64, Math.min(600, Number.isFinite(requestedWidth) ? requestedWidth : 480));
    sendBuffer(request, response, buildCover(decodeURIComponent(imageMatch[1]), Math.round(size / 4) * 4), "image/png");
    return;
  }

  const audioMatch = /^\/Audio\/([^/]+)\/(?:universal|stream)(?:\.[a-z0-9]+)?$/i.exec(path);
  if (audioMatch) {
    sendBuffer(request, response, buildAudio(decodeURIComponent(audioMatch[1])), "audio/wav");
    return;
  }

  const playlistItemsMatch = /^\/Playlists\/([^/]+)\/Items$/.exec(path);
  if (playlistItemsMatch) {
    const playlist = itemsById.get(decodeURIComponent(playlistItemsMatch[1]));
    if (request.method !== "GET") {
      await readBody(request);
      sendJson(response, { Id: playlist?.Id || "" });
      return;
    }
    if (PLAYLIST_READ_MODE === "parent-only") {
      sendJson(response, { error: "playlist endpoint disabled for compatibility smoke" }, 404);
      return;
    }
    const members = (playlist?.MemberIds || []).map((id) => itemsById.get(id)).filter(Boolean);
    const startIndex = Number(params.get("StartIndex") || 0) || 0;
    const limit = Number(params.get("Limit") || 0) || 0;
    const page = limit > 0 ? members.slice(startIndex, startIndex + limit) : members.slice(startIndex);
    sendJson(response, {
      Items: page.map((item, index) => ({ ...item, PlaylistItemId: `${playlist?.Id}-entry-${startIndex + index}` })),
      TotalRecordCount: members.length,
    });
    return;
  }

  if (/^\/Playlists\//.test(path) || /^\/Sessions\/Playing/.test(path)) {
    await readBody(request);
    response.writeHead(204, withCors(response));
    response.end();
    return;
  }

  if (path === "/Items" && request.method === "GET") {
    sendJson(response, queryItems(params));
    return;
  }

  sendJson(response, { error: `mock-emby has no route for ${request.method} ${path}` }, 404);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock-emby listening on http://127.0.0.1:${PORT}`);
  console.log(`  ${catalog.albums.length} albums · ${catalog.tracks.length} tracks · ${catalog.artists.length} artists · ${catalog.playlists.length} playlists`);
  console.log(`  playlist read mode: ${PLAYLIST_READ_MODE}`);
  console.log("  log in with any username/password");
});
