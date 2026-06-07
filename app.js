const {
  ACCOUNT_PROFILES_KEY,
  APP_NAME,
  APP_VERSION,
  AUDIO_QUALITY_PROFILE_KEY,
  AUDIO_QUALITY_PROFILES,
  DEFAULT_EXTERNAL_SOURCE_API_URL = "",
  DEFAULT_SERVER_URL = "",
  DEVICE_KEY,
  EXTERNAL_SOURCE_API_KEY = "emby-music-web/external-source-api-url",
  FILTER_STATE_KEY,
  LIBRARY_VIEW_KEY,
  LOCK_SERVER_URL = false,
  MAX_PERSISTED_QUEUE_TRACKS,
  MAX_RECENT_TRACKS,
  PAGE_SIZE,
  PLAYBACK_STREAM_KEY,
  PLAYBACK_STREAM_LABELS,
  PLAYBACK_STREAM_POLICIES,
  PLAYBACK_PRELOAD_KEY,
  PLAYBACK_LOSSLESS_PRECACHE_KEY,
  PLAYER_META_TARGET_KEY,
  PLAYER_META_TARGET_LABELS,
  PLAYER_META_TARGETS,
  PLAY_MODE_KEY,
  PLAY_MODE_LABELS,
  PLAY_MODES,
  QUEUE_KEY,
  RECENT_KEY,
  SERVER_SEARCH_DEBOUNCE_MS,
  SERVER_SEARCH_LIMIT,
  SERVER_SEARCH_MIN_LENGTH,
  SEARCH_HISTORY_KEY,
  SESSION_KEY,
  SORT_KEYS,
  SORT_KEY_KEY,
  SORT_ORDERS,
  SORT_ORDER_KEY,
  SOURCE_BRIDGE_MANIFEST_KEY = "emby-music-web/source-bridge-manifest-url",
  SOURCE_BRIDGE_MUSIC_DIR_KEY = "emby-music-web/source-bridge-music-dir",
  SOURCE_MODES = ["emby", "external"],
  SOURCE_MODE_KEY = "emby-music-web/source-mode",
  TRACK_DENSITIES,
  TRACK_DENSITY_KEY,
  TRANSCODE_BITRATE_KEY,
  TRANSCODE_BITRATES,
  VOLUME_KEY,
  itemFields,
} = window.EmbyMusicConfig;
const {
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
} = window.EmbyMusicFormat;
const {
  extractLyricsText,
  parseLyrics,
} = window.EmbyMusicLyrics;
const storage = window.EmbyMusicStorage.createEmbyMusicStorage({
  accountProfilesKey: ACCOUNT_PROFILES_KEY,
  appName: APP_NAME,
  audioQualityProfileKey: AUDIO_QUALITY_PROFILE_KEY,
  audioQualityProfiles: AUDIO_QUALITY_PROFILES,
  clamp,
  deviceKey: DEVICE_KEY,
  filterStateKey: FILTER_STATE_KEY,
  libraryViewKey: LIBRARY_VIEW_KEY,
  maxQueueTracks: MAX_PERSISTED_QUEUE_TRACKS,
  maxRecentTracks: MAX_RECENT_TRACKS,
  playbackStreamKey: PLAYBACK_STREAM_KEY,
  playbackStreamPolicies: PLAYBACK_STREAM_POLICIES,
  playbackPreloadKey: PLAYBACK_PRELOAD_KEY,
  playbackLosslessPrecacheKey: PLAYBACK_LOSSLESS_PRECACHE_KEY,
  playerMetaTargetKey: PLAYER_META_TARGET_KEY,
  playerMetaTargets: PLAYER_META_TARGETS,
  playModeKey: PLAY_MODE_KEY,
  playModes: PLAY_MODES,
  queueKey: QUEUE_KEY,
  recentKey: RECENT_KEY,
  sessionKey: SESSION_KEY,
  sortKeyKey: SORT_KEY_KEY,
  sortKeys: SORT_KEYS,
  sortOrderKey: SORT_ORDER_KEY,
  sortOrders: SORT_ORDERS,
  transcodeBitrateKey: TRANSCODE_BITRATE_KEY,
  transcodeBitrates: TRANSCODE_BITRATES,
  trackDensityKey: TRACK_DENSITY_KEY,
  trackDensities: TRACK_DENSITIES,
  volumeKey: VOLUME_KEY,
});
const initialSession = loadSession();
const initialLibraryViewId = loadLibraryViewId(initialSession);
const initialFilterState = loadFilterState(initialSession);
const initialQueueState = loadQueueState(initialSession);
const DEFAULT_AUDIO_QUALITY_PROFILE = AUDIO_QUALITY_PROFILES.find((profile) => profile.recommended)
  || AUDIO_QUALITY_PROFILES[0];
const initialAudioQualityProfileId = loadAudioQualityProfile();
const initialAudioQualityProfile = AUDIO_QUALITY_PROFILES.find((profile) => profile.id === initialAudioQualityProfileId)
  || DEFAULT_AUDIO_QUALITY_PROFILE;
const embyApi = window.EmbyMusicApi.createEmbyApi({
  authorizationHeader,
  getDeviceId,
  getSession: () => state.session,
});
const externalSourceApi = window.EmbyMusicExternalSource.createExternalSourceApi();
const QUALITY_FILTER_LABELS = {
  lossless: "无损",
  lossy: "有损",
};
const QUALITY_FILTER_ORDER = ["lossless", "lossy"];
const LYRIC_PROGRESS_EPSILON = 0.04;
const LYRIC_TIMELINE_SEEK_THRESHOLD_SECONDS = 2.5;
const LYRIC_AUTO_SCROLL_MIN_INTERVAL_MS = 520;
const LYRIC_WORD_MIN_LINE_DURATION_SECONDS = 1.8;
const LYRIC_WORD_MAX_LINE_DURATION_SECONDS = 4.8;
const LYRIC_PROGRESS_RESUME_LEAD_MS = 220;
const LYRIC_PROGRESS_IDLE_MIN_DELAY_MS = 300;
const SHUFFLE_HISTORY_LIMIT = 80;
const LIBRARY_ALPHABET_HOVER_DELAY_MS = 2000;
const LIBRARY_ALPHABET_HIDE_DELAY_MS = 220;
const LIBRARY_ALPHABET_KEYS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
const CHINESE_PINYIN_BOUNDARIES = [
  ["A", "阿"],
  ["B", "八"],
  ["C", "嚓"],
  ["D", "咑"],
  ["E", "妸"],
  ["F", "发"],
  ["G", "旮"],
  ["H", "哈"],
  ["J", "讥"],
  ["K", "咔"],
  ["L", "垃"],
  ["M", "妈"],
  ["N", "拏"],
  ["O", "噢"],
  ["P", "妑"],
  ["Q", "七"],
  ["R", "呥"],
  ["S", "仨"],
  ["T", "他"],
  ["W", "穵"],
  ["X", "夕"],
  ["Y", "丫"],
  ["Z", "帀"],
];
const chinesePinyinCollator = new Intl.Collator("zh-Hans-u-co-pinyin");
const MAX_SEARCH_HISTORY_ITEMS = 10;
const PLAYBACK_STREAM_SHORT_LABELS = {
  auto: "自动",
  direct: "仅直连",
  transcode: "优先转码",
};
const AUDIO_QUALITY_METHOD_GROUPS = [
  {
    id: "direct",
    label: "直放",
    format: "FLAC 原文件",
    quality: "最高",
    stability: "最吃网络",
  },
  {
    id: "hls",
    label: "HLS 转码",
    format: "AAC + HLS .ts 分片",
    quality: "高，推荐",
    stability: "最稳",
  },
  {
    id: "http",
    label: "普通音频流转码",
    format: "AAC / MP3 / Opus 单文件流",
    quality: "高到一般",
    stability: "稳",
  },
  {
    id: "remux",
    label: "Remux/DirectStream",
    format: "不重编码，只换封装",
    quality: "基本无损",
    stability: "看客户端支持",
  },
  {
    id: "pcm",
    label: "PCM/WAV",
    format: "解码成 PCM/WAV",
    quality: "接近无损",
    stability: "带宽更大，不推荐公网",
  },
];
const PLAYBACK_RECOVERY_PROFILE_IDS = [
  "hls-aac-384",
  "hls-aac-256",
  "http-aac-128",
  "http-mp3-320",
];
const EXTERNAL_SOURCE_QUALITY_KEY = "emby-music-web/external-source-quality";
const EXTERNAL_SOURCE_VIDEO_QUALITY_KEY = "emby-music-web/external-source-video-quality";
const DEFAULT_EXTERNAL_SOURCE_QUALITY_ID = "high";
const DEFAULT_EXTERNAL_SOURCE_VIDEO_QUALITY_ID = "video-720";
const LYRIC_OFFSET_KEY = "emby-music-web/lyric-offset-seconds";
const DEFAULT_LYRIC_OFFSET_SECONDS = 0.18;
const LYRIC_OFFSET_STEP_SECONDS = 0.1;
const MIN_LYRIC_OFFSET_SECONDS = -2;
const MAX_LYRIC_OFFSET_SECONDS = 2;
const EXTERNAL_SOURCE_QUALITY_OPTIONS = [
  {
    id: "high",
    request: "high",
    label: "高品质",
    shortLabel: "高品",
    quality: "优先 320k/高品",
    stability: "均衡",
    scene: "适合日常播放，优先向插件请求更好的音频源。",
    icon: "wave",
    recommended: true,
  },
  {
    id: "standard",
    request: "standard",
    label: "标准",
    shortLabel: "标准",
    quality: "源站默认",
    stability: "最稳",
    scene: "插件返回最稳定的可播地址，适合网络一般时使用。",
    icon: "shield",
  },
  {
    id: "lossless",
    request: "super",
    label: "无损优先",
    shortLabel: "无损",
    quality: "SQ/无损优先",
    stability: "看源站",
    scene: "尽量请求无损、母带或更高规格，实际结果由插件和源站决定。",
    icon: "album",
  },
  {
    id: "low",
    request: "low",
    label: "省流",
    shortLabel: "省流",
    quality: "低码率",
    stability: "最快",
    scene: "弱网或移动流量下使用，优先请求更轻的音频源。",
    icon: "playNext",
  },
  {
    id: "video",
    request: "super",
    label: "视频策略",
    shortLabel: "视频",
    quality: "按清晰度",
    stability: "看下方",
    scene: "遇到 MV 或视频结果时，使用下方独立清晰度档位请求源站地址。",
    icon: "video",
  },
];
const EXTERNAL_SOURCE_VIDEO_QUALITY_OPTIONS = [
  {
    id: "video-480",
    request: "video-480",
    label: "流畅",
    shortLabel: "480P",
    quality: "MV 480P",
    stability: "省流",
    scene: "弱网或后台听 MV 时更稳，优先请求 480P 视频地址。",
    icon: "video",
  },
  {
    id: "video-720",
    request: "video-720",
    label: "高清",
    shortLabel: "720P",
    quality: "MV 720P",
    stability: "推荐",
    scene: "日常播放默认档，画面清楚且更容易拿到可播放地址。",
    icon: "video",
    recommended: true,
  },
  {
    id: "video-1080",
    request: "video-1080",
    label: "超清",
    shortLabel: "1080P",
    quality: "MV 1080P",
    stability: "看源站",
    scene: "优先请求 1080P，适合桌面端观看 MV 或视频结果。",
    icon: "video",
  },
  {
    id: "video-4k",
    request: "video-4k",
    label: "4K",
    shortLabel: "4K",
    quality: "MV 4K",
    stability: "源站限制",
    scene: "只在源站开放 4K 时生效，失败时由插件或源站自动回落。",
    icon: "spark",
  },
];
const SLEEP_TIMER_OPTIONS = [0, 15, 30, 45, 60, 90];
const AUTO_DISMISS_STATUS_MS = 1800;
const AUTO_DISMISS_NOTICE_MS = 1800;
const PLAYBACK_PRELOAD_CACHE_NAME = "emby-music-web-playback-preload";
const MAX_PLAYBACK_PRECACHE_BYTES = 32 * 1024 * 1024;
const PLAYBACK_POSITION_SAVE_INTERVAL_MS = 5000;
const PLAYBACK_POSITION_SAVE_EPSILON_SECONDS = 2;
const EXTERNAL_SEARCH_QUALITY_RESOLVE_LIMIT = 24;
const EXTERNAL_SEARCH_QUALITY_RESOLVE_CONCURRENCY = 3;
const TRACK_ACCENT_PALETTE = [
  { name: "赤红", color: "#ec4141", deep: "#d93030", rgb: "236, 65, 65" },
  { name: "琥珀", color: "#f59e0b", deep: "#d97706", rgb: "245, 158, 11" },
  { name: "青绿", color: "#14b8a6", deep: "#0f766e", rgb: "20, 184, 166" },
  { name: "蔚蓝", color: "#3b82f6", deep: "#1d4ed8", rgb: "59, 130, 246" },
  { name: "紫罗兰", color: "#8b5cf6", deep: "#6d28d9", rgb: "139, 92, 246" },
];
const DEFAULT_TRACK_ACCENT = TRACK_ACCENT_PALETTE[0];
const ACTION_ICON_PATHS = {
  play: '<path d="M8 5v14l11-7Z"></path>',
  playNext: '<path d="M5 5v14l9-7Z"></path><path d="M18 5v14"></path><path d="M21 9h-4"></path><path d="M19 7v4"></path>',
  queueAdd: '<path d="M4 6h10"></path><path d="M4 12h8"></path><path d="M4 18h7"></path><path d="M17 14v6"></path><path d="M14 17h6"></path>',
  playlist: '<path d="M5 6h11"></path><path d="M5 12h9"></path><path d="M5 18h7"></path><path d="M18 15v6"></path><path d="M15 18h6"></path>',
  drag: '<circle cx="9" cy="6" r="1"></circle><circle cx="15" cy="6" r="1"></circle><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="9" cy="18" r="1"></circle><circle cx="15" cy="18" r="1"></circle>',
  moveUp: '<path d="m12 5-5 5"></path><path d="m12 5 5 5"></path><path d="M12 5v14"></path>',
  moveDown: '<path d="m12 19-5-5"></path><path d="m12 19 5-5"></path><path d="M12 5v14"></path>',
  trash: '<path d="M4 7h16"></path><path d="M7 7l1 13h8l1-13"></path><path d="M9 7V4h6v3"></path><path d="M10 11v5"></path><path d="M14 11v5"></path>',
  artist: '<circle cx="12" cy="8" r="4"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>',
  album: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 4v3"></path>',
  playlists: '<path d="M5 6h11"></path><path d="M5 12h14"></path><path d="M5 18h8"></path><path d="m17 16 3 2-3 2Z"></path>',
  recent: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 5v5h5"></path><path d="M12 7v5l3 2"></path>',
  nowPlaying: '<path d="M7 18V6"></path><path d="M12 18V6"></path><path d="M17 18V6"></path>',
  repeat: '<path d="M17 2.8 21 7l-4 4.2"></path><path d="M3 11V9a2 2 0 0 1 2-2h16"></path><path d="M7 21.2 3 17l4-4.2"></path><path d="M21 13v2a2 2 0 0 1-2 2H3"></path>',
  more: '<circle cx="5" cy="12" r="1.4"></circle><circle cx="12" cy="12" r="1.4"></circle><circle cx="19" cy="12" r="1.4"></circle>',
  heart: '<path d="M19.2 5.4a5 5 0 0 0-7.2.2 5 5 0 0 0-7.2-.2c-2 2.1-1.9 5.5.2 7.6l7 6.8 7-6.8c2.1-2.1 2.2-5.5.2-7.6Z"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m16.2 16.2 4.1 4.1"></path>',
  check: '<path d="m5 12 4.4 4.4L19 7"></path>',
  shield: '<path d="M12 3 19 6v5c0 4.5-2.8 8.2-7 10-4.2-1.8-7-5.5-7-10V6l7-3Z"></path><path d="m9 12 2 2 4-4"></path>',
  wave: '<path d="M4 12h2.4l1.8-4 3.6 8 2.4-5 1.2 1H20"></path>',
  video: '<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h8a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 15 19H7a2.5 2.5 0 0 1-2.5-2.5v-9Z"></path><path d="m17.5 10 3-2v8l-3-2"></path>',
  spark: '<path d="M12 3l1.6 5.1L19 10l-5.4 1.9L12 17l-1.6-5.1L5 10l5.4-1.9L12 3Z"></path>',
};

const form = document.querySelector("#connectForm");
const loginTitle = document.querySelector("#loginTitle");
const loginSourceModeButtons = [...document.querySelectorAll("[data-login-source-mode]")];
const embyLoginFields = [...document.querySelectorAll("[data-emby-login-field]")];
const serverUrlInput = document.querySelector("#serverUrl");
const serverUrlHint = document.querySelector("#serverUrlHint");
const externalSourceApiField = document.querySelector("#externalSourceApiField");
const externalSourceApiUrlInput = document.querySelector("#externalSourceApiUrl");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const deviceNameInput = document.querySelector("#deviceName");
const connectButton = document.querySelector("#connectButton");
const testServerButton = document.querySelector("#testServerButton");
const copyLoginDiagnosticsButton = document.querySelector("#copyLoginDiagnosticsButton");
const clearLoginCacheButton = document.querySelector("#clearLoginCacheButton");
const loginVersion = document.querySelector("#loginVersion");
const savedAccountsSection = document.querySelector("#savedAccountsSection");
const savedAccountList = document.querySelector("#savedAccountList");
const clearSessionButton = document.querySelector("#clearSessionButton");
const message = document.querySelector("#message");
const loginView = document.querySelector("#loginView");
const mainView = document.querySelector("#mainView");
const content = document.querySelector(".content");
const connectionBadge = document.querySelector("#connectionBadge");
const topSettingsButton = document.querySelector("#topSettingsButton");
const accountMenuButton = document.querySelector("#accountMenuButton");
const accountAvatar = document.querySelector("#accountAvatar");
const accountMenu = document.querySelector("#accountMenu");
const accountMenuAvatar = document.querySelector("#accountMenuAvatar");
const accountMenuTitle = document.querySelector("#accountMenuTitle");
const accountMenuServer = document.querySelector("#accountMenuServer");
const accountMenuSavedSection = document.querySelector("#accountMenuSavedSection");
const accountMenuSavedList = document.querySelector("#accountMenuSavedList");
const accountMenuSavedCount = document.querySelector("#accountMenuSavedCount");
const accountSettingsButton = document.querySelector("#accountSettingsButton");
const accountSourceBridgeButton = document.querySelector("#accountSourceBridgeButton");
const accountTestConnectionButton = document.querySelector("#accountTestConnectionButton");
const accountSwitchButton = document.querySelector("#accountSwitchButton");
const appRefreshButton = document.querySelector("#appRefreshButton");
const searchInput = document.querySelector("#searchInput");
const clearSearchButton = document.querySelector("#clearSearchButton");
const searchSuggestPopover = document.querySelector("#searchSuggestPopover");
const searchSuggestList = document.querySelector("#searchSuggestList");
const refreshButton = document.querySelector("#refreshButton");
const shuffleButton = document.querySelector("#shuffleButton");
const sortSelect = document.querySelector("#sortSelect");
const sortOrderSelect = document.querySelector("#sortOrderSelect");
const genreSelect = document.querySelector("#genreSelect");
const yearSelect = document.querySelector("#yearSelect");
const qualitySelect = document.querySelector("#qualitySelect");
const favoriteFilterSelect = document.querySelector("#favoriteFilterSelect");
const trackDensitySelect = document.querySelector("#trackDensitySelect");
const libraryQuickTitle = document.querySelector("#libraryQuickTitle");
const libraryQuickMeta = document.querySelector("#libraryQuickMeta");
const quickFavoriteButton = document.querySelector("#quickFavoriteButton");
const quickLosslessButton = document.querySelector("#quickLosslessButton");
const quickRecentButton = document.querySelector("#quickRecentButton");
const quickCompactButton = document.querySelector("#quickCompactButton");
const quickPlayFilteredButton = document.querySelector("#quickPlayFilteredButton");
const quickQueueFilteredButton = document.querySelector("#quickQueueFilteredButton");
const enhancedLibrarySelects = [...document.querySelectorAll("[data-enhanced-select]")];

const serverName = document.querySelector("#serverName");
const serverNameLabel = document.querySelector("#serverNameLabel");
const serverVersion = document.querySelector("#serverVersion");
const serverVersionLabel = document.querySelector("#serverVersionLabel");
const currentUser = document.querySelector("#currentUser");
const currentUserLabel = document.querySelector("#currentUserLabel");
const currentServer = document.querySelector("#currentServer");
const heroTitle = document.querySelector("#heroTitle");
const heroSubtitle = document.querySelector("#heroSubtitle");
const libraryName = document.querySelector("#libraryName");
const libraryNameLabel = document.querySelector("#libraryNameLabel");
const sourceBridgeModal = document.querySelector("#sourceBridgeModal");
const sourceBridgeModalClose = document.querySelector("#sourceBridgeModalClose");
const sourceBridgeStatus = document.querySelector("#sourceBridgeModalStatus");
const sourceBridgeApiUrlInput = document.querySelector("#sourceBridgeApiUrl");
const sourceBridgeMusicDirInput = document.querySelector("#sourceBridgeMusicDir");
const sourceBridgeManifestUrlInput = document.querySelector("#sourceBridgeManifestUrl");
const sourceBridgeSaveButton = document.querySelector("#sourceBridgeSaveButton");
const sourceBridgeTestButton = document.querySelector("#sourceBridgeTestButton");
const sourceBridgeRefreshButton = document.querySelector("#sourceBridgeRefreshButton");
const sourceBridgeApiUrlWarning = document.querySelector("#sourceBridgeApiUrlWarning");
const sourceBridgeManifestUrlWarning = document.querySelector("#sourceBridgeManifestUrlWarning");
const sourceBridgeMusicDirWarning = document.querySelector("#sourceBridgeMusicDirWarning");
const sourceBridgeFolderButton = document.querySelector("#sourceBridgeFolderButton");
const sourceBridgeManifestMaskButton = document.querySelector("#sourceBridgeManifestMaskButton");
const sourceBridgeCommandText = document.querySelector("#sourceBridgeCommandText");
const sourceBridgeCopyCommandButton = document.querySelector("#sourceBridgeCopyCommandButton");
const libraryViewSelect = document.querySelector("#libraryViewSelect");
const trackCount = document.querySelector("#trackCount");
const albumCount = document.querySelector("#albumCount");
const artistCount = document.querySelector("#artistCount");
const playlistCount = document.querySelector("#playlistCount");
const libraryMeta = document.querySelector("#libraryMeta");
const albumMeta = document.querySelector("#albumMeta");
const artistMeta = document.querySelector("#artistMeta");
const playlistMeta = document.querySelector("#playlistMeta");
const favoriteMeta = document.querySelector("#favoriteMeta");
const recentMeta = document.querySelector("#recentMeta");
const queueMeta = document.querySelector("#queueMeta");
const nowQueueCount = document.querySelector("#nowQueueCount");
const settingsMeta = document.querySelector("#settingsMeta");
const settingsSourceMode = document.querySelector("#settingsSourceMode");
const settingsServerName = document.querySelector("#settingsServerName");
const settingsServerUrl = document.querySelector("#settingsServerUrl");
const settingsUser = document.querySelector("#settingsUser");
const settingsAppVersion = document.querySelector("#settingsAppVersion");
const settingsPwaStatus = document.querySelector("#settingsPwaStatus");
const settingsMediaSession = document.querySelector("#settingsMediaSession");
const settingsAccentColor = document.querySelector("#settingsAccentColor");
const settingsWindowTitle = document.querySelector("#settingsWindowTitle");
const settingsBrowserNetwork = document.querySelector("#settingsBrowserNetwork");
const settingsLibraryView = document.querySelector("#settingsLibraryView");
const settingsTrackDensity = document.querySelector("#settingsTrackDensity");
const settingsPlayerMetaTarget = document.querySelector("#settingsPlayerMetaTarget");
const settingsSortState = document.querySelector("#settingsSortState");
const settingsFilterState = document.querySelector("#settingsFilterState");
const settingsPlayMode = document.querySelector("#settingsPlayMode");
const settingsPlaybackSource = document.querySelector("#settingsPlaybackSource");
const settingsAudioQuality = document.querySelector("#settingsAudioQuality");
const settingsEffectiveProtocol = document.querySelector("#settingsEffectiveProtocol");
const settingsSleepTimer = document.querySelector("#settingsSleepTimer");
const settingsVolume = document.querySelector("#settingsVolume");
const settingsQueue = document.querySelector("#settingsQueue");
const settingsPlaySession = document.querySelector("#settingsPlaySession");
const settingsMediaSource = document.querySelector("#settingsMediaSource");
const settingsAudioElement = document.querySelector("#settingsAudioElement");
const settingsPlaybackError = document.querySelector("#settingsPlaybackError");
const settingsPlaybackPreload = document.querySelector("#settingsPlaybackPreload");
const settingsRecent = document.querySelector("#settingsRecent");
const settingsLyrics = document.querySelector("#settingsLyrics");
const playerMetaTargetSelect = document.querySelector("#playerMetaTargetSelect");
const playbackStreamSelect = document.querySelector("#playbackStreamSelect");
const transcodeBitrateSelect = document.querySelector("#transcodeBitrateSelect");
const sleepTimerSelect = document.querySelector("#sleepTimerSelect");
const playbackPreloadToggle = document.querySelector("#playbackPreloadToggle");
const playbackLosslessPrecacheToggle = document.querySelector("#playbackLosslessPrecacheToggle");
const filterBar = document.querySelector("#filterBar");
const filterLabel = document.querySelector("#filterLabel");
const clearFilterButton = document.querySelector("#clearFilterButton");
const playLibraryButton = document.querySelector("#playLibraryButton");
const queueLibraryButton = document.querySelector("#queueLibraryButton");
const playFavoritesButton = document.querySelector("#playFavoritesButton");
const queueFavoritesButton = document.querySelector("#queueFavoritesButton");
const playRecentButton = document.querySelector("#playRecentButton");
const queueRecentButton = document.querySelector("#queueRecentButton");
const albumDetailCover = document.querySelector("#albumDetailCover");
const albumDetailTitle = document.querySelector("#albumDetailTitle");
const albumDetailMeta = document.querySelector("#albumDetailMeta");
const albumTrackList = document.querySelector("#albumTrackList");
const playAlbumButton = document.querySelector("#playAlbumButton");
const shuffleAlbumButton = document.querySelector("#shuffleAlbumButton");
const nextAlbumButton = document.querySelector("#nextAlbumButton");
const queueAlbumButton = document.querySelector("#queueAlbumButton");
const favoriteAlbumButton = document.querySelector("#favoriteAlbumButton");
const backToAlbumsButton = document.querySelector("#backToAlbumsButton");
const artistDetailCover = document.querySelector("#artistDetailCover");
const artistDetailTitle = document.querySelector("#artistDetailTitle");
const artistDetailMeta = document.querySelector("#artistDetailMeta");
const artistAlbumGrid = document.querySelector("#artistAlbumGrid");
const artistTrackList = document.querySelector("#artistTrackList");
const playArtistButton = document.querySelector("#playArtistButton");
const shuffleArtistButton = document.querySelector("#shuffleArtistButton");
const nextArtistButton = document.querySelector("#nextArtistButton");
const queueArtistButton = document.querySelector("#queueArtistButton");
const favoriteArtistButton = document.querySelector("#favoriteArtistButton");
const backToArtistsButton = document.querySelector("#backToArtistsButton");
const playlistDetailCover = document.querySelector("#playlistDetailCover");
const playlistDetailTitle = document.querySelector("#playlistDetailTitle");
const playlistDetailMeta = document.querySelector("#playlistDetailMeta");
const playlistTrackList = document.querySelector("#playlistTrackList");
const playPlaylistButton = document.querySelector("#playPlaylistButton");
const shufflePlaylistButton = document.querySelector("#shufflePlaylistButton");
const nextPlaylistButton = document.querySelector("#nextPlaylistButton");
const queuePlaylistButton = document.querySelector("#queuePlaylistButton");
const favoritePlaylistButton = document.querySelector("#favoritePlaylistButton");
const backToPlaylistsButton = document.querySelector("#backToPlaylistsButton");
const shuffleQueueButton = document.querySelector("#shuffleQueueButton");
const organizeQueueButton = document.querySelector("#organizeQueueButton");
const locateQueueTrackButton = document.querySelector("#locateQueueTrackButton");
const clearPlayedQueueButton = document.querySelector("#clearPlayedQueueButton");
const clearQueueButton = document.querySelector("#clearQueueButton");
const queueOverviewCover = document.querySelector("#queueOverviewCover");
const queueOverviewTitle = document.querySelector("#queueOverviewTitle");
const queueOverviewMeta = document.querySelector("#queueOverviewMeta");
const queueOverviewProgress = document.querySelector("#queueOverviewProgress");
const queueOverviewPlayButton = document.querySelector("#queueOverviewPlayButton");
const queueOverviewLocateButton = document.querySelector("#queueOverviewLocateButton");
const queueOverviewNextTitle = document.querySelector("#queueOverviewNextTitle");
const queueOverviewNextMeta = document.querySelector("#queueOverviewNextMeta");
const queueOverviewPosition = document.querySelector("#queueOverviewPosition");
const queueOverviewShuffleButton = document.querySelector("#queueOverviewShuffleButton");
const clearRecentButton = document.querySelector("#clearRecentButton");
const createPlaylistButton = document.querySelector("#createPlaylistButton");
const settingsTestConnectionButton = document.querySelector("#settingsTestConnectionButton");
const settingsTestPlaybackButton = document.querySelector("#settingsTestPlaybackButton");
const settingsClearRecentButton = document.querySelector("#settingsClearRecentButton");
const settingsClearQueueButton = document.querySelector("#settingsClearQueueButton");
const settingsResetPreferencesButton = document.querySelector("#settingsResetPreferencesButton");
const settingsClearCacheButton = document.querySelector("#settingsClearCacheButton");
const settingsClearPlaybackCacheButton = document.querySelector("#settingsClearPlaybackCacheButton");
const settingsCopyDiagnosticsButton = document.querySelector("#settingsCopyDiagnosticsButton");
const settingsDiagnostics = document.querySelector("#settingsDiagnostics");
const appNotice = document.querySelector("#appNotice");
const appNoticeText = document.querySelector("#appNoticeText");
const appNoticeActions = document.querySelector("#appNoticeActions");
const appNoticeClose = document.querySelector("#appNoticeClose");
const playbackRecoveryPanel = document.querySelector("#playbackRecoveryPanel");
const playbackRecoveryTitle = document.querySelector("#playbackRecoveryTitle");
const playbackRecoveryMeta = document.querySelector("#playbackRecoveryMeta");
const playbackRetryButton = document.querySelector("#playbackRetryButton");
const playbackModeRetryButton = document.querySelector("#playbackModeRetryButton");
const playbackFallbackButton = document.querySelector("#playbackFallbackButton");
const playbackTestButton = document.querySelector("#playbackTestButton");
const playbackRecoveryDismiss = document.querySelector("#playbackRecoveryDismiss");
const playbackRecoveryQuickList = document.querySelector("#playbackRecoveryQuickList");
const floatingVideoRestoreButton = document.querySelector("#floatingVideoRestoreButton");
const playlistPicker = document.querySelector("#playlistPicker");
const playlistPickerClose = document.querySelector("#playlistPickerClose");
const playlistPickerTrack = document.querySelector("#playlistPickerTrack");
const playlistPickerSelect = document.querySelector("#playlistPickerSelect");
const playlistPickerMessage = document.querySelector("#playlistPickerMessage");
const playlistPickerCancel = document.querySelector("#playlistPickerCancel");
const playlistPickerAdd = document.querySelector("#playlistPickerAdd");
const createPlaylistModal = document.querySelector("#createPlaylistModal");
const createPlaylistClose = document.querySelector("#createPlaylistClose");
const createPlaylistName = document.querySelector("#createPlaylistName");
const createPlaylistMessage = document.querySelector("#createPlaylistMessage");
const createPlaylistCancel = document.querySelector("#createPlaylistCancel");
const createPlaylistSubmit = document.querySelector("#createPlaylistSubmit");
const mobileMoreNavButton = document.querySelector("#mobileMoreNavButton");
const trackActionSheet = document.querySelector("#trackActionSheet");
const trackActionSheetClose = document.querySelector("#trackActionSheetClose");
const trackActionSheetTitle = document.querySelector("#trackActionSheetTitle");
const trackActionSheetSubtitle = document.querySelector("#trackActionSheetSubtitle");
const trackActionSheetList = document.querySelector("#trackActionSheetList");
const quickQueuePopover = document.querySelector("#quickQueuePopover");
const quickQueueTitle = document.querySelector("#quickQueueTitle");
const quickQueueMeta = document.querySelector("#quickQueueMeta");
const quickQueueList = document.querySelector("#quickQueueList");
const quickQueueCloseButton = document.querySelector("#quickQueueCloseButton");
const quickQueueOpenButton = document.querySelector("#quickQueueOpenButton");
const quickQueueShuffleButton = document.querySelector("#quickQueueShuffleButton");
const quickQueueOrganizeButton = document.querySelector("#quickQueueOrganizeButton");
const quickQueueLocateButton = document.querySelector("#quickQueueLocateButton");
const quickQueueClearPlayedButton = document.querySelector("#quickQueueClearPlayedButton");
const quickQueueClearButton = document.querySelector("#quickQueueClearButton");
const libraryStatus = document.querySelector("#libraryStatus");

const homeStartArtButton = document.querySelector("#homeStartArtButton");
const homeStartCover = document.querySelector("#homeStartCover");
const homeStartTitle = document.querySelector("#homeStartTitle");
const homeStartMeta = document.querySelector("#homeStartMeta");
const homeStartProgressText = document.querySelector("#homeStartProgressText");
const homeStartProgressFill = document.querySelector("#homeStartProgressFill");
const homeStartTimeText = document.querySelector("#homeStartTimeText");
const homeStartNext = document.querySelector("#homeStartNext");
const homeStartNextTitle = document.querySelector("#homeStartNextTitle");
const homeStartLibraryStat = document.querySelector("#homeStartLibraryStat");
const homeStartQueueStat = document.querySelector("#homeStartQueueStat");
const homeStartQualityStat = document.querySelector("#homeStartQualityStat");
const homeStartFavoriteButton = document.querySelector("#homeStartFavoriteButton");
const homeStartMoreButton = document.querySelector("#homeStartMoreButton");
const homeStartShuffleButton = document.querySelector("#homeStartShuffleButton");
const homeStartResumeButton = document.querySelector("#homeStartResumeButton");
const homeStartQueueButton = document.querySelector("#homeStartQueueButton");
const homeStartImmersiveButton = document.querySelector("#homeStartImmersiveButton");
const homeRecentSection = document.querySelector("#homeRecentSection");
const homePlaylistSection = document.querySelector("#homePlaylistSection");
const homeFavoriteAlbumSection = document.querySelector("#homeFavoriteAlbumSection");
const homeRecentPlayButton = document.querySelector("#homeRecentPlayButton");
const homeRecentQueueButton = document.querySelector("#homeRecentQueueButton");
const homeRecentAddPlayButton = document.querySelector("#homeRecentAddPlayButton");
const homeRecentAddQueueButton = document.querySelector("#homeRecentAddQueueButton");
const allAlbumGrid = document.querySelector("#allAlbumGrid");
const playlistGrid = document.querySelector("#playlistGrid");
const favoriteAlbumGrid = document.querySelector("#favoriteAlbumGrid");
const favoriteArtistGrid = document.querySelector("#favoriteArtistGrid");
const favoritePlaylistGrid = document.querySelector("#favoritePlaylistGrid");
const homeRecentPlayedList = document.querySelector("#homeRecentPlayedList");
const homePlaylistGrid = document.querySelector("#homePlaylistGrid");
const homeFavoriteAlbumGrid = document.querySelector("#homeFavoriteAlbumGrid");
const recentTrackList = document.querySelector("#recentTrackList");
const libraryTrackList = document.querySelector("#libraryTrackList");
const libraryPanel = document.querySelector("#libraryPanel");
const searchResultTitle = document.querySelector("#searchResultTitle");
const searchResultMeta = document.querySelector("#searchResultMeta");
const searchSourceFilters = document.querySelector("#searchSourceFilters");
const searchTrackList = document.querySelector("#searchTrackList");
const playSearchResultsButton = document.querySelector("#playSearchResultsButton");
const queueSearchResultsButton = document.querySelector("#queueSearchResultsButton");
const searchAlbumSection = document.querySelector("#searchAlbumSection");
const searchArtistSection = document.querySelector("#searchArtistSection");
const searchPlaylistSection = document.querySelector("#searchPlaylistSection");
const searchAlbumGrid = document.querySelector("#searchAlbumGrid");
const searchArtistGrid = document.querySelector("#searchArtistGrid");
const searchPlaylistGrid = document.querySelector("#searchPlaylistGrid");
const artistGrid = document.querySelector("#artistGrid");
const favoriteTrackList = document.querySelector("#favoriteTrackList");
const recentPlayedList = document.querySelector("#recentPlayedList");
const queueTrackList = document.querySelector("#queueTrackList");
const lyricsList = document.querySelector("#lyricsList");
const upNextList = document.querySelector("#upNextList");
const loadMoreTracksButton = document.querySelector("#loadMoreTracksButton");
const loadMoreAlbumsButton = document.querySelector("#loadMoreAlbumsButton");
const loadMoreArtistsButton = document.querySelector("#loadMoreArtistsButton");
const loadMoreFavoritesButton = document.querySelector("#loadMoreFavoritesButton");
const loadMorePlaylistsButton = document.querySelector("#loadMorePlaylistsButton");
const viewPanels = [...document.querySelectorAll("[data-panel]")];
const viewButtons = [...document.querySelectorAll("[data-view]")];

const audioPlayer = document.querySelector("#audioPlayer");
const playerMetaButton = document.querySelector("#playerMetaButton");
const playerCover = document.querySelector("#playerCover");
const playerTitle = document.querySelector("#playerTitle");
const playerSubtitle = document.querySelector("#playerSubtitle");
const playerPlaybackMeta = document.querySelector("#playerPlaybackMeta");
const nowPlayingCover = document.querySelector("#nowPlayingCover");
const nowPlayingTitle = document.querySelector("#nowPlayingTitle");
const nowPlayingArtist = document.querySelector("#nowPlayingArtist");
const nowPlayingAlbum = document.querySelector("#nowPlayingAlbum");
const nowPlayingMeta = document.querySelector("#nowPlayingMeta");
const nowPlayingEmptyActions = document.querySelector("#nowPlayingEmptyActions");
const nowPlayingShuffleStartButton = document.querySelector("#nowPlayingShuffleStartButton");
const nowPlayingPlayLibraryButton = document.querySelector("#nowPlayingPlayLibraryButton");
const nowPlayingOpenLibraryButton = document.querySelector("#nowPlayingOpenLibraryButton");
const nowLyricFocus = document.querySelector("#nowLyricFocus");
const nowLyricStatus = document.querySelector("#nowLyricStatus");
const nowLyricCurrent = document.querySelector("#nowLyricCurrent");
const nowLyricNext = document.querySelector("#nowLyricNext");
const playButton = document.querySelector("#playButton");
const playerbarSweepLayer = document.querySelector("#playerbarSweepLayer");
const nowPlayButton = document.querySelector("#nowPlayButton");
const prevButton = document.querySelector("#prevButton");
const nowPrevButton = document.querySelector("#nowPrevButton");
const nextButton = document.querySelector("#nextButton");
const nowNextButton = document.querySelector("#nowNextButton");
const playModeButton = document.querySelector("#playModeButton");
const nowModeButton = document.querySelector("#nowModeButton");
const sleepTimerButton = document.querySelector("#sleepTimerButton");
const nowSleepTimerButton = document.querySelector("#nowSleepTimerButton");
const locateTrackButton = document.querySelector("#locateTrackButton");
const audioQualityButton = document.querySelector("#audioQualityButton");
const audioQualityModal = document.querySelector("#audioQualityModal");
const audioQualityClose = document.querySelector("#audioQualityClose");
const audioQualitySubtitle = document.querySelector("#audioQualitySubtitle");
const audioQualityCurrent = document.querySelector("#audioQualityCurrent");
const audioQualityMethodSummary = document.querySelector("#audioQualityMethodSummary");
const audioQualityList = document.querySelector("#audioQualityList");
const audioQualityTestButton = document.querySelector("#audioQualityTestButton");
const playerLyricsButton = document.querySelector("#playerLyricsButton");
const playerModeProxyButton = document.querySelector("[data-player-mode-proxy]");
const desktopImmersiveButton = document.querySelector("#desktopImmersiveButton");
const queueButton = document.querySelector("#queueButton");
const nowQueueButton = document.querySelector("#nowQueueButton");
const mobilePlayerQueueButton = document.querySelector("#mobilePlayerQueueButton");
const mobilePlayerQueueCount = document.querySelector("#mobilePlayerQueueCount");
const mobilePlayerQualityButton = document.querySelector("#mobilePlayerQualityButton");
const mobilePlayerQualityLabel = document.querySelector("#mobilePlayerQualityLabel");
const mobilePlayerLyricsButton = document.querySelector("#mobilePlayerLyricsButton");
const mobilePlayerImmersiveButton = document.querySelector("#mobilePlayerImmersiveButton");
const mobilePlayerMoreButton = document.querySelector("#mobilePlayerMoreButton");
const queueCount = document.querySelector("#queueCount");
const nowFavoriteButton = document.querySelector("#nowFavoriteButton");
const muteButton = document.querySelector("#muteButton");
const volumeSlider = document.querySelector("#volumeSlider");
const progressTrack = document.querySelector("#progressTrack");
const nowPlayingProgressTrack = document.querySelector("#nowPlayingProgressTrack");
const progressFill = document.querySelector("#progressFill");
const nowPlayingProgressFill = document.querySelector("#nowPlayingProgressFill");
const currentTime = document.querySelector("#currentTime");
const nowPlayingCurrentTime = document.querySelector("#nowPlayingCurrentTime");
const durationTime = document.querySelector("#durationTime");
const nowPlayingDurationTime = document.querySelector("#nowPlayingDurationTime");
const playerNextPreview = document.querySelector("#playerNextPreview");
const playerNextTitle = document.querySelector("#playerNextTitle");
const immersiveBackdrop = document.querySelector("#immersiveBackdrop");
const immersiveCover = document.querySelector("#immersiveCover");
const immersiveTitle = document.querySelector("#immersiveTitle");
const immersiveArtist = document.querySelector("#immersiveArtist");
const immersiveAlbum = document.querySelector("#immersiveAlbum");
const immersiveMeta = document.querySelector("#immersiveMeta");
const immersiveEmptyActions = document.querySelector("#immersiveEmptyActions");
const immersiveShuffleStartButton = document.querySelector("#immersiveShuffleStartButton");
const immersivePlayLibraryButton = document.querySelector("#immersivePlayLibraryButton");
const immersiveOpenLibraryButton = document.querySelector("#immersiveOpenLibraryButton");
const immersiveLyricList = document.querySelector("#immersiveLyricList");
const immersiveProgressTrack = document.querySelector("#immersiveProgressTrack");
const immersiveProgressFill = document.querySelector("#immersiveProgressFill");
const immersiveCurrentTime = document.querySelector("#immersiveCurrentTime");
const immersiveDurationTime = document.querySelector("#immersiveDurationTime");
const immersivePlayerPanel = document.querySelector("#immersivePlayerPanel");
const immersiveBackgroundButton = document.querySelector("#immersiveBackgroundButton");
const immersiveFullscreenButton = document.querySelector("#immersiveFullscreenButton");
const immersiveCloseButton = document.querySelector("#immersiveCloseButton");
const immersivePrevButton = document.querySelector("#immersivePrevButton");
const immersivePlayButton = document.querySelector("#immersivePlayButton");
const immersiveNextButton = document.querySelector("#immersiveNextButton");
const immersiveModeButton = document.querySelector("#immersiveModeButton");
const immersiveFavoriteButton = document.querySelector("#immersiveFavoriteButton");
const immersiveZenButton = document.querySelector("#immersiveZenButton");
const immersiveQueueButton = document.querySelector("#immersiveQueueButton");
const immersiveQueueDrawer = document.querySelector("#immersiveQueueDrawer");
const immersiveQueueCloseButton = document.querySelector("#immersiveQueueCloseButton");
const immersiveQueueLocateButton = document.querySelector("#immersiveQueueLocateButton");
const immersiveQueueShuffleButton = document.querySelector("#immersiveQueueShuffleButton");
const immersiveQueueClearPlayedButton = document.querySelector("#immersiveQueueClearPlayedButton");
const immersiveQueueClearButton = document.querySelector("#immersiveQueueClearButton");
const immersiveQueueCount = document.querySelector("#immersiveQueueCount");
const immersiveUpNextList = document.querySelector("#immersiveUpNextList");
const preloadAudio = new Audio();
preloadAudio.preload = "auto";
const unlockAudioPlayer = new Audio();
unlockAudioPlayer.preload = "auto";
let hlsPlayer = null;
let activePlaybackLoadProfile = null;
let mediaVideoHost = null;
let mediaVideoPlaceholder = null;
let floatingVideoShell = null;
let floatingVideoMinimizeButton = null;
let floatingVideoHideButton = null;
let statusDismissTimer = null;
let noticeDismissTimer = null;
let audioQualityCloseTimer = 0;
let trackFluidFrame = 0;
let trackFluidPhase = 0;
let trackFluidWidth = 50;
let trackFluidActiveTrackId = "";
let activeTrackRows = [];
let activeTrackRowsTrackId = "";
let activeTrackRowsCacheValid = false;
let progressRenderSignature = "";
let homeStartProgressSignature = "";
let playerNextPreviewSignature = "";
let lyricProgressFrame = 0;
let lyricProgressResumeTimer = 0;
let lyricProgressActiveIndex = -1;
let lyricProgressFullWordCount = -1;
let lyricProgressPartialWordIndex = -1;
let lyricClockAudioSeconds = 0;
let lyricClockStartedAtMs = 0;
let lyricClockPlaybackRate = 1;
let lyricClockIsRunning = false;
let lastLyricAutoScrollAt = 0;
let activeLyricListIndex = -1;
let lyricLineElements = [];
let immersiveLyricActiveIndex = -1;
let immersiveLyricLineElements = [];
let immersiveLyricWordElements = [];
let immersiveLyricWordTimings = [];
let immersiveLyricWordEndTimings = [];
let lastStaticLyricRenderSignature = "";
let lyricRenderRevision = 0;
let libraryAlphabetScrubber = null;
let libraryAlphabetHoverZone = null;
let libraryAlphabetHoverTimer = 0;
let libraryAlphabetHideTimer = 0;
let libraryAlphabetEntries = [];
let libraryAlphabetActiveKey = "";
let externalSearchQualityResolveToken = 0;
let externalSearchQualityResolveActiveCount = 0;
const externalSearchQualityResolveQueue = [];
const externalSearchQualityResolveInFlight = new Set();
const externalSearchQualityResolveDone = new Set();

const state = {
  session: initialSession,
  sourceMode: getSessionSourceMode(initialSession) || loadSourceMode(),
  externalSourceApiUrl: getInitialExternalSourceApiUrl(initialSession),
  sourceBridgeManifestUrl: loadSourceBridgeManifestUrl(),
  sourceBridgeMusicDir: loadSourceBridgeMusicDir(),
  lyricOffsetSeconds: loadLyricOffsetSeconds(),
  sourceBridgeInfo: null,
  views: [],
  libraryViewId: initialLibraryViewId,
  albums: [],
  tracks: [],
  artists: [],
  playlists: [],
  favoriteTracks: [],
  recentTracks: loadRecentTracks(initialSession),
  filteredAlbums: [],
  filteredTracks: [],
  filteredArtists: [],
  filteredPlaylists: [],
  filteredFavoriteAlbums: [],
  filteredFavoriteArtists: [],
  filteredFavoritePlaylists: [],
  filteredFavoriteTracks: [],
  queue: initialQueueState.queue,
  currentTrackIndex: initialQueueState.currentTrackIndex,
  query: "",
  searchResultQuery: "",
  searchSourceFilter: "",
  albumFilter: null,
  artistFilter: null,
  genreFilter: initialFilterState.genre,
  yearFilter: initialFilterState.year,
  qualityFilter: initialFilterState.quality,
  favoriteFilter: initialFilterState.favorite,
  availableGenres: [],
  availableYears: [],
  availableQualities: [],
  sortKey: loadSortKey(),
  sortOrder: loadSortOrder(),
  selectedAlbum: null,
  albumTracks: [],
  selectedArtist: null,
  artistTracks: [],
  artistAlbums: [],
  selectedPlaylist: null,
  playlistTracks: [],
  detailReturnViews: {
    albumDetail: "albums",
    artistDetail: "artists",
    playlistDetail: "playlists",
  },
  viewScrollPositions: {},
  playMode: loadPlayMode(),
  playbackStreamPolicy: initialAudioQualityProfile.mode === "direct" ? "direct" : "transcode",
  transcodeBitrate: initialAudioQualityProfile.bitrate || loadTranscodeBitrate(),
  audioQualityProfileId: initialAudioQualityProfile.id,
  playbackPreloadEnabled: loadPlaybackPreloadEnabled(),
  playbackLosslessPrecacheEnabled: loadPlaybackLosslessPrecacheEnabled(),
  trackDensity: loadTrackDensity(),
  playerMetaTarget: loadPlayerMetaTarget(),
  volume: loadVolume(),
  lastVolume: 1,
  totalTracks: 0,
  totalAlbums: 0,
  totalArtists: 0,
  totalPlaylists: 0,
  totalFavorites: 0,
  isLoadingMoreTracks: false,
  isLoadingMoreAlbums: false,
  isLoadingMoreArtists: false,
  isLoadingMorePlaylists: false,
  isLoadingMoreFavorites: false,
  isConnecting: false,
  isTestingServer: false,
  isTestingConnection: false,
  isTestingPlayback: false,
  isBrowserOnline: navigator.onLine !== false,
  isServerSearching: false,
  isLibraryLoaded: false,
  lastServerSearchQuery: "",
  serverSearchRequestId: 0,
  serverSearchTimer: null,
  searchSuggestActiveIndex: -1,
  playRequestId: 0,
  currentTrack: initialQueueState.currentTrack,
  savedPlaybackPositionSeconds: initialQueueState.positionSeconds,
  queueSavedAt: initialQueueState.savedAt,
  currentPlaybackMode: "direct",
  currentMediaSourceId: "",
  currentPlaySessionId: "",
  externalSourceQualityId: loadExternalSourceQualityId(),
  externalSourceVideoQualityId: loadExternalSourceVideoQualityId(),
  hasReportedPlaybackStart: false,
  isChangingTrack: false,
  isPlaybackBuffering: false,
  trackChangeTimer: null,
  currentAccent: DEFAULT_TRACK_ACCENT,
  albumAmbientRequestId: 0,
  fallbackAttempted: false,
  qualityFallbackAttempted: false,
  lastPlaybackInfoError: "",
  lastPlaybackError: "",
  lastProgressReportAt: 0,
  lastQueuePositionSaveAt: 0,
  lastQueuePositionSaveSeconds: initialQueueState.positionSeconds || 0,
  shuffleHistory: [],
  shuffleUpcomingIds: [],
  lastPlaybackProbe: "",
  audioUnlocked: false,
  pendingAutoplayResume: false,
  isHlsJsActive: false,
  isApplyingServiceWorkerUpdate: false,
  pendingServiceWorkerUpdate: false,
  preloadTrackId: null,
  preloadSource: "",
  preloadMode: "",
  preloadMediaSourceId: "",
  preloadPlaySessionId: "",
  preloadQualityProfileId: "",
  preloadSession: null,
  preloadRequestId: 0,
  preloadCacheController: null,
  preloadCacheRequestKey: "",
  preloadCacheStatus: "",
  lyricsTrackId: null,
  lyricsLoadRequestId: 0,
  lyricsStatus: "",
  lyricLines: [],
  lyricTimeline: [],
  lyricTimelineIndexByLineIndex: [],
  isLyricSynced: false,
  activeLyricIndex: -1,
  activeLyricTimelineIndex: -1,
  sleepTimerEndAt: 0,
  sleepTimerPresetMinutes: 0,
  sleepTimerTimeoutId: null,
  sleepTimerIntervalId: null,
  playlistPickerTrack: null,
  trackActionSheetTrack: null,
  trackActionSheetReturnFocus: null,
  queueUndoSnapshot: null,
  recentUndoSnapshot: null,
  isQuickQueueOpen: false,
  quickQueueReturnFocus: null,
  isAddingToPlaylist: false,
  isCreatingPlaylist: false,
  isMovingPlaylistTrack: false,
  isImmersiveQueueOpen: false,
  immersiveBackgroundMode: "original",
  immersiveReturnView: "home",
  videoFloatingMode: "hidden",
};

safeInit();

function safeInit() {
  try {
    init();
    window.EmbyMusicAppReady = true;
    window.EmbyMusicAppError = "";
  } catch (error) {
    window.EmbyMusicAppReady = false;
    window.EmbyMusicAppError = readableError(error);
    bindLoginEvents();
    showLogin();
    renderSavedAccounts();
    setBadge("error", "初始化失败");
    setMessage(`页面初始化失败：${readableError(error)}。请刷新或清除站点缓存后重试。`, "error");
    console.error(error);
  }
}

function init() {
  bindLoginEvents();
  deviceNameInput.value = storage.loadDeviceName(getDefaultDeviceName());
  if (state.session) {
    state.sourceMode = getSessionSourceMode(state.session);
    state.externalSourceApiUrl = state.session.externalSourceApiUrl || state.externalSourceApiUrl;
  }
  syncLoginSourceMode();
  const pendingCredentialLogin = readPendingCredentialLogin();
  const discardedLockedSession = discardSavedSessionForLockedServer();
  if (pendingCredentialLogin) {
    discardSavedSessionForCredentialLogin();
  }
  syncConfiguredServerUrl();
  showLogin();
  renderSavedAccounts();
  if (discardedLockedSession) {
    setMessage("当前部署已锁定服务器地址，请重新登录。");
  }
  renderLoadingShell();
  renderPlaybackPreferenceOptions();
  renderPlayerNextPreview();
  searchInput.disabled = true;
  clearSearchButton.disabled = true;
  refreshButton.disabled = true;
  shuffleButton.disabled = true;
  applyVolumePreference();
  applyTrackDensityPreference();
  updatePlayModeButton();
  updateSleepTimerControls();
  if (state.currentTrack) {
    updatePlayerMeta(state.currentTrack);
  }
  setPlayerEnabled(Boolean(state.queue.length));
  renderQueue();
  renderNowPlaying();
  renderLyricOffsetControls();
  applyImmersiveBackgroundMode();
  renderRestoredPlaybackProgress(state.currentTrack);

  if (!pendingCredentialLogin && state.session) {
    if (isExternalSourceSession(state.session)) {
      externalSourceApiUrlInput.value = getSessionExternalSourceApiUrl(state.session);
    } else {
      serverUrlInput.value = state.session.serverUrl;
      usernameInput.value = state.session.userName || "";
    }
    renderSession(state.session);
    verifySession(state.session);
  }

  clearSessionButton.addEventListener("click", clearSession);
  topSettingsButton.addEventListener("click", () => switchView("settings"));
  accountMenuButton.addEventListener("click", toggleAccountMenu);
  accountSettingsButton.addEventListener("click", () => {
    closeAccountMenu();
    switchView("settings");
  });
  accountSourceBridgeButton?.addEventListener("click", () => {
    closeAccountMenu();
    openSourceBridgeModal();
  });
  accountTestConnectionButton.addEventListener("click", () => {
    closeAccountMenu();
    testCurrentConnection();
  });
  accountSwitchButton.addEventListener("click", openAccountSwitcher);
  accountMenu.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, accountMenu)) {
      closeAccountMenu();
    }
  });
  searchInput.addEventListener("input", handleSearch);
  searchInput.addEventListener("focus", renderSearchSuggestions);
  searchInput.addEventListener("keydown", handleSearchSuggestKeydown);
  document.addEventListener("click", (event) => {
    if (shouldIgnoreExternalCloseEvent(event)) {
      return;
    }

    if (!event.target.closest(".search-box")) {
      closeSearchSuggestions();
    }
  });
  content.addEventListener("scroll", handleContentScroll);
  clearSearchButton.addEventListener("click", clearSearchAndFilters);
  refreshButton.addEventListener("click", () => {
    closeAccountMenu();
    refreshLibrary();
  });
  appRefreshButton?.addEventListener("click", refreshApplication);
  shuffleButton.addEventListener("click", shufflePlay);
  libraryViewSelect.addEventListener("change", handleLibraryViewChange);
  sortSelect.addEventListener("change", handleSortChange);
  sortOrderSelect.addEventListener("change", handleSortOrderChange);
  genreSelect.addEventListener("change", handleGenreChange);
  yearSelect.addEventListener("change", handleYearChange);
  qualitySelect.addEventListener("change", handleQualityChange);
  favoriteFilterSelect.addEventListener("change", handleFavoriteFilterChange);
  trackDensitySelect.addEventListener("change", handleTrackDensityChange);
  quickFavoriteButton.addEventListener("click", toggleQuickFavoriteFilter);
  quickLosslessButton.addEventListener("click", toggleQuickLosslessFilter);
  quickRecentButton.addEventListener("click", applyQuickRecentSort);
  quickCompactButton.addEventListener("click", toggleQuickCompactDensity);
  quickPlayFilteredButton.addEventListener("click", () => playTrackCollection(state.filteredTracks, "当前筛选结果"));
  quickQueueFilteredButton.addEventListener("click", () => queueTrackCollection(state.filteredTracks, "当前筛选结果"));
  playSearchResultsButton?.addEventListener("click", () => playTrackCollection(getVisibleSearchTracks(), "搜索结果"));
  queueSearchResultsButton?.addEventListener("click", () => queueTrackCollection(getVisibleSearchTracks(), "搜索结果"));
  initEnhancedLibrarySelects();
  initLibraryAlphabetScrubber();
  loadMoreTracksButton.addEventListener("click", loadMoreTracks);
  loadMoreAlbumsButton.addEventListener("click", loadMoreAlbums);
  loadMoreArtistsButton.addEventListener("click", loadMoreArtists);
  loadMoreFavoritesButton.addEventListener("click", loadMoreFavorites);
  loadMorePlaylistsButton.addEventListener("click", loadMorePlaylists);
  clearFilterButton.addEventListener("click", clearSearchAndFilters);
  playLibraryButton.addEventListener("click", () => playTrackCollection(state.filteredTracks, "音乐库"));
  queueLibraryButton.addEventListener("click", () => queueTrackCollection(state.filteredTracks, "音乐库"));
  playFavoritesButton.addEventListener("click", () => playTrackCollection(state.filteredFavoriteTracks, "收藏歌曲"));
  queueFavoritesButton.addEventListener("click", () => queueTrackCollection(state.filteredFavoriteTracks, "收藏歌曲"));
  playRecentButton.addEventListener("click", () => playTrackCollection(getVisibleRecentTracks(), "最近播放"));
  queueRecentButton.addEventListener("click", () => queueTrackCollection(getVisibleRecentTracks(), "最近播放"));
  homeStartArtButton?.addEventListener("click", openMobileImmersivePlayer);
  homeStartFavoriteButton?.addEventListener("click", () => toggleFavorite(state.currentTrack));
  homeStartMoreButton?.addEventListener("click", openMobilePlayerActions);
  homeStartShuffleButton.addEventListener("click", shufflePlay);
  homeStartResumeButton.addEventListener("click", togglePlayback);
  homeStartQueueButton?.addEventListener("click", () => switchView("queue"));
  homeStartImmersiveButton.addEventListener("click", openMobileImmersivePlayer);
  homeRecentPlayButton.addEventListener("click", playHomeRecentTracks);
  homeRecentQueueButton.addEventListener("click", queueHomeRecentTracks);
  homeRecentAddPlayButton.addEventListener("click", playHomeRecentAddedTracks);
  homeRecentAddQueueButton.addEventListener("click", queueHomeRecentAddedTracks);
  backToAlbumsButton.addEventListener("click", () => returnFromDetail("albumDetail"));
  playAlbumButton.addEventListener("click", playSelectedAlbum);
  shuffleAlbumButton.addEventListener("click", shuffleSelectedAlbum);
  nextAlbumButton.addEventListener("click", playSelectedAlbumNext);
  queueAlbumButton.addEventListener("click", queueSelectedAlbum);
  favoriteAlbumButton.addEventListener("click", () => toggleFavorite(state.selectedAlbum));
  backToArtistsButton.addEventListener("click", () => returnFromDetail("artistDetail"));
  playArtistButton.addEventListener("click", playSelectedArtist);
  shuffleArtistButton.addEventListener("click", shuffleSelectedArtist);
  nextArtistButton.addEventListener("click", playSelectedArtistNext);
  queueArtistButton.addEventListener("click", queueSelectedArtist);
  favoriteArtistButton.addEventListener("click", () => toggleFavorite(state.selectedArtist));
  backToPlaylistsButton.addEventListener("click", () => returnFromDetail("playlistDetail"));
  playPlaylistButton.addEventListener("click", playSelectedPlaylist);
  shufflePlaylistButton.addEventListener("click", shuffleSelectedPlaylist);
  nextPlaylistButton.addEventListener("click", playSelectedPlaylistNext);
  queuePlaylistButton.addEventListener("click", queueSelectedPlaylist);
  favoritePlaylistButton.addEventListener("click", () => toggleFavorite(state.selectedPlaylist));
  shuffleQueueButton.addEventListener("click", shuffleQueueRemainder);
  organizeQueueButton.addEventListener("click", organizeQueueRemainder);
  locateQueueTrackButton.addEventListener("click", locateCurrentQueueTrack);
  clearPlayedQueueButton.addEventListener("click", clearPlayedQueueTracks);
  clearQueueButton.addEventListener("click", clearQueue);
  queueOverviewPlayButton.addEventListener("click", playQueueOverviewCurrent);
  queueOverviewLocateButton.addEventListener("click", locateCurrentQueueTrack);
  queueOverviewShuffleButton.addEventListener("click", shuffleQueueRemainder);
  clearRecentButton.addEventListener("click", clearRecentTracks);
  createPlaylistButton.addEventListener("click", openCreatePlaylistModal);
  settingsTestConnectionButton.addEventListener("click", testCurrentConnection);
  settingsTestPlaybackButton.addEventListener("click", testCurrentPlaybackChain);
  settingsClearRecentButton.addEventListener("click", clearRecentTracks);
  settingsClearQueueButton.addEventListener("click", clearQueue);
  settingsResetPreferencesButton.addEventListener("click", resetPlayerPreferences);
  settingsClearCacheButton.addEventListener("click", clearAppCache);
  settingsClearPlaybackCacheButton?.addEventListener("click", clearPlaybackCache);
  settingsCopyDiagnosticsButton.addEventListener("click", copyDiagnostics);
  bindSourceBridgeControls();
  playerMetaTargetSelect.addEventListener("change", handlePlayerMetaTargetChange);
  playbackStreamSelect.addEventListener("change", handlePlaybackStreamPolicyChange);
  transcodeBitrateSelect.addEventListener("change", handleTranscodeBitrateChange);
  sleepTimerSelect.addEventListener("change", handleSleepTimerSelectChange);
  playbackPreloadToggle?.addEventListener("change", handlePlaybackPreloadToggleChange);
  playbackLosslessPrecacheToggle?.addEventListener("change", handlePlaybackLosslessPrecacheToggleChange);
  appNoticeClose.addEventListener("click", hideNotice);
  playbackRetryButton.addEventListener("click", retryPlaybackFromRecovery);
  playbackModeRetryButton.addEventListener("click", retryPlaybackModeFromRecovery);
  playbackFallbackButton.addEventListener("click", fallbackPlaybackFromRecovery);
  playbackTestButton.addEventListener("click", testPlaybackFromRecovery);
  playbackRecoveryDismiss.addEventListener("click", hidePlaybackRecovery);
  bindFloatingVideoControls();
  playlistPickerClose.addEventListener("click", closePlaylistPicker);
  playlistPickerCancel.addEventListener("click", closePlaylistPicker);
  playlistPickerAdd.addEventListener("click", addSelectedTrackToPlaylist);
  playlistPicker.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, playlistPicker)) {
      closePlaylistPicker();
    }
  });
  createPlaylistClose.addEventListener("click", closeCreatePlaylistModal);
  createPlaylistCancel.addEventListener("click", closeCreatePlaylistModal);
  createPlaylistSubmit.addEventListener("click", createPlaylistFromModal);
  createPlaylistName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createPlaylistFromModal();
    }
  });
  createPlaylistModal.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, createPlaylistModal)) {
      closeCreatePlaylistModal();
    }
  });
  trackActionSheetClose.addEventListener("click", closeTrackActionSheet);
  mobileMoreNavButton.addEventListener("click", openMobileNavigationSheet);
  trackActionSheet.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, trackActionSheet)) {
      closeTrackActionSheet();
    }
  });
  quickQueueCloseButton.addEventListener("click", closeQuickQueue);
  quickQueuePopover.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, quickQueuePopover)) {
      closeQuickQueue();
    }
  });
  quickQueueOpenButton.addEventListener("click", () => {
    closeQuickQueue({ restoreFocus: false });
    switchView("queue");
  });
  quickQueueShuffleButton.addEventListener("click", shuffleQueueRemainder);
  quickQueueOrganizeButton.addEventListener("click", organizeQueueRemainder);
  quickQueueLocateButton.addEventListener("click", locateCurrentQueueTrack);
  quickQueueClearPlayedButton.addEventListener("click", clearPlayedQueueTracks);
  quickQueueClearButton.addEventListener("click", clearQueue);

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view) {
        switchView(view);
      }
    });
  });

  playButton.addEventListener("click", togglePlayback);
  nowPlayButton.addEventListener("click", togglePlayback);
  immersivePlayButton.addEventListener("click", togglePlayback);
  prevButton.addEventListener("click", playPrevious);
  nowPrevButton.addEventListener("click", playPrevious);
  immersivePrevButton.addEventListener("click", playPrevious);
  nextButton.addEventListener("click", playNext);
  nowNextButton.addEventListener("click", playNext);
  immersiveNextButton.addEventListener("click", playNext);
  playModeButton.addEventListener("click", cyclePlayMode);
  nowModeButton.addEventListener("click", cyclePlayMode);
  immersiveModeButton.addEventListener("click", cyclePlayMode);
  sleepTimerButton.addEventListener("click", cycleSleepTimer);
  nowSleepTimerButton.addEventListener("click", cycleSleepTimer);
  locateTrackButton.addEventListener("click", () => switchView("settings"));
  audioQualityButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openAudioQualityModal();
  });
  playerLyricsButton?.addEventListener("click", () => switchView("nowPlaying"));
  playerModeProxyButton?.addEventListener("click", cyclePlayMode);
  audioQualityClose.addEventListener("click", closeAudioQualityModal);
  audioQualityTestButton.addEventListener("click", () => testCurrentPlaybackChain());
  document.addEventListener("click", handleAudioQualityDocumentClick);
  sourceBridgeModalClose?.addEventListener("click", closeSourceBridgeModal);
  document.addEventListener("click", handleSourceBridgeDocumentClick);
  initSourceBridgeModalInteractions();
  desktopImmersiveButton.addEventListener("click", openMobileImmersivePlayer);
  queueButton.addEventListener("click", toggleQuickQueue);
  nowQueueButton.addEventListener("click", () => switchView("queue"));
  mobilePlayerMoreButton.addEventListener("click", openMobilePlayerActions);
  mobilePlayerQueueButton.addEventListener("click", toggleQuickQueue);
  mobilePlayerQualityButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openAudioQualityModal();
  });
  mobilePlayerLyricsButton.addEventListener("click", () => switchView("nowPlaying"));
  mobilePlayerImmersiveButton.addEventListener("click", openMobileImmersivePlayer);
  immersiveQueueButton.addEventListener("click", toggleImmersiveQueue);
  immersiveQueueCloseButton.addEventListener("click", () => closeImmersiveQueue());
  immersiveQueueLocateButton.addEventListener("click", locateCurrentImmersiveQueueTrack);
  immersiveQueueShuffleButton.addEventListener("click", shuffleQueueRemainder);
  immersiveQueueClearPlayedButton.addEventListener("click", clearPlayedQueueTracks);
  immersiveQueueClearButton.addEventListener("click", clearQueue);
  immersiveBackgroundButton?.addEventListener("click", cycleImmersiveBackgroundMode);
  immersiveFullscreenButton.addEventListener("click", toggleImmersiveFullscreen);
  immersiveCloseButton.addEventListener("click", closeImmersivePlayer);
  immersiveZenButton?.addEventListener("click", toggleImmersiveZenMode);
  playerMetaButton.addEventListener("click", openConfiguredPlayerMetaTarget);
  nowFavoriteButton.addEventListener("click", () => toggleFavorite(state.currentTrack));
  immersiveFavoriteButton.addEventListener("click", () => toggleFavorite(state.currentTrack));
  nowPlayingArtist.addEventListener("click", () => {
    if (state.currentTrack) {
      openTrackArtist(state.currentTrack);
    }
  });
  nowPlayingAlbum.addEventListener("click", () => {
    if (state.currentTrack) {
      openTrackAlbum(state.currentTrack);
    }
  });
  nowPlayingShuffleStartButton.addEventListener("click", shufflePlayFromNowPlaying);
  nowPlayingPlayLibraryButton.addEventListener("click", playLibraryFromNowPlaying);
  nowPlayingOpenLibraryButton.addEventListener("click", () => switchView("library"));
  nowLyricFocus.addEventListener("click", focusActiveLyricLine);
  bindLyricOffsetControls();
  immersiveArtist.addEventListener("click", () => {
    if (state.currentTrack) {
      openTrackArtist(state.currentTrack);
    }
  });
  immersiveAlbum.addEventListener("click", () => {
    if (state.currentTrack) {
      openTrackAlbum(state.currentTrack);
    }
  });
  immersiveShuffleStartButton.addEventListener("click", shufflePlayFromImmersive);
  immersivePlayLibraryButton.addEventListener("click", playLibraryFromImmersive);
  immersiveOpenLibraryButton.addEventListener("click", () => switchView("library"));
  muteButton.addEventListener("click", toggleMute);
  volumeSlider.addEventListener("input", handleVolumeInput);
  progressTrack.addEventListener("click", seekFromProgress);
  nowPlayingProgressTrack.addEventListener("click", seekFromProgress);
  immersiveProgressTrack.addEventListener("click", seekFromProgress);
  playerNextPreview.addEventListener("click", () => {
    if (state.queue.length) {
      openQuickQueue();
    }
  });
  audioPlayer.addEventListener("play", handleAudioPlay);
  audioPlayer.addEventListener("pause", handleAudioPause);
  audioPlayer.addEventListener("ended", handleTrackEnded);
  audioPlayer.addEventListener("timeupdate", handleAudioTimeUpdate);
  audioPlayer.addEventListener("loadedmetadata", updateProgress);
  audioPlayer.addEventListener("loadstart", handleAudioBufferingStart);
  audioPlayer.addEventListener("waiting", handleAudioBufferingStart);
  audioPlayer.addEventListener("stalled", handleAudioBufferingStart);
  audioPlayer.addEventListener("seeking", handleAudioBufferingStart);
  audioPlayer.addEventListener("canplay", handleAudioBufferingEnd);
  audioPlayer.addEventListener("playing", handleAudioBufferingEnd);
  audioPlayer.addEventListener("durationchange", updateProgress);
  audioPlayer.addEventListener("seeked", handleAudioSeeked);
  audioPlayer.addEventListener("ratechange", handleAudioRateChange);
  audioPlayer.addEventListener("volumechange", updateVolumeButton);
  audioPlayer.addEventListener("error", handleAudioElementError);
  playerbarSweepLayer?.addEventListener("animationend", () => {
    playerbarSweepLayer.classList.remove("is-active");
  });
  window.addEventListener("keydown", handleKeyboardShortcut);
  window.addEventListener("hashchange", () => switchViewFromHash());
  window.addEventListener("focus", () => requestAnimationFrame(ensureVisibleMainPanel));
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  window.addEventListener("emby-music-hls-ready", handleHlsReady);
  window.addEventListener("pageshow", () => requestAnimationFrame(ensureVisibleMainPanel));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      requestAnimationFrame(ensureVisibleMainPanel);
      syncLyricProgressLoop();
    } else {
      persistPlaybackPosition({ force: true });
      stopLyricProgressLoop();
    }
  });
  window.addEventListener("pagehide", () => {
    persistPlaybackPosition({ force: true });
  });
  window.addEventListener("beforeunload", () => {
    persistPlaybackPosition({ force: true });
    reportPlaybackStopped();
  });
  syncBrowserNetworkStatus({ silent: true });
  setupMediaSession();
  registerServiceWorker();
  installBrowserSmokeHooks();
  switchViewFromHash();

  if (pendingCredentialLogin) {
    startPendingCredentialLogin(pendingCredentialLogin);
  }
}

function installBrowserSmokeHooks() {
  if (!isBrowserSmokeRun()) {
    return;
  }

  window.EmbyMusicBrowserSmoke = {
    runLyricProgressScenario,
  };
}

function isBrowserSmokeRun() {
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return isLocalHost && new URLSearchParams(window.location.search).has("browser-smoke");
}

function createBrowserSmokeTrack(options = {}) {
  const lyricsText = options.lyricsText || [
    "[00:00.00]Alpha beta gamma",
    "[00:03.00]Delta epsilon zeta",
    "[00:06.00]Eta theta iota",
  ].join("\n");

  return {
    Id: options.id || "browser-smoke-lyric-track",
    Type: "Audio",
    MediaType: "Audio",
    Name: options.name || "Browser Smoke Lyric Track",
    Album: "Smoke Tests",
    AlbumId: "browser-smoke-album",
    Artists: ["Emby Music Web"],
    ArtistItems: [{ Id: "browser-smoke-artist", Name: "Emby Music Web" }],
    RunTimeTicks: secondsToTicks(options.durationSeconds || 12),
    UserData: {},
    LyricsText: lyricsText,
    MediaSources: [
      {
        Id: "browser-smoke-source",
        Container: "mp3",
        MediaStreams: [{ Type: "Audio", Codec: "mp3", BitRate: 320000 }],
      },
    ],
  };
}

function runLyricProgressScenario() {
  const track = createBrowserSmokeTrack();
  const originalOffsetSeconds = state.lyricOffsetSeconds;

  state.session = {
    sourceMode: "emby",
    serverUrl: "http://browser-smoke.local",
    userId: "browser-smoke-user",
    userName: "Browser Smoke",
    serverName: "Browser Smoke",
    version: APP_VERSION,
  };
  state.tracks = [track];
  state.filteredTracks = [track];
  state.queue = [track];
  state.currentTrack = track;
  state.currentTrackIndex = 0;
  state.isLibraryLoaded = true;
  state.savedPlaybackPositionSeconds = 0;
  state.lyricOffsetSeconds = DEFAULT_LYRIC_OFFSET_SECONDS;
  state.lastProgressReportAt = Date.now();
  applyFilters();
  showMain();
  renderSession(state.session);
  renderLibrary();
  updatePlayerMeta(track);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });

  updateLyricsHighlight(4.12, true);
  const beforeOffset = collectBrowserSmokeLyricState();
  setLyricOffsetSeconds(0.68);
  updateLyricsHighlight(4.12, true);
  const afterOffset = collectBrowserSmokeLyricState();
  state.activeLyricIndex = -1;
  state.activeLyricTimelineIndex = -1;
  resetLyricProgressState();
  refreshLyricsForPlaybackResume(4.12);
  const afterResumeRefresh = collectBrowserSmokeLyricState();
  const longGapTrack = createBrowserSmokeTrack({
    id: "browser-smoke-long-gap-lyric-track",
    name: "Browser Smoke Long Gap Lyric Track",
    durationSeconds: 30,
    lyricsText: [
      "[00:00.00]Long gap lyric phrase",
      "[00:20.00]Next line arrives later",
    ].join("\n"),
  });
  state.currentTrack = longGapTrack;
  state.queue = [longGapTrack];
  state.tracks = [longGapTrack];
  state.filteredTracks = [longGapTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(longGapTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(4.8, true);
  const longGapProgress = collectBrowserSmokeLyricState();
  const longGapIdleResumeDelayMs = getLyricProgressIdleResumeDelayMs(1, getAdjustedLyricSeconds(4.8), { time: 20 });
  state.lyricOffsetSeconds = 0;
  const enhancedTrack = createBrowserSmokeTrack({
    id: "browser-smoke-enhanced-lyric-track",
    name: "Browser Smoke Enhanced Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>Alpha <0.60>beta <1.20>gamma",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = enhancedTrack;
  state.queue = [enhancedTrack];
  state.tracks = [enhancedTrack];
  state.filteredTracks = [enhancedTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(enhancedTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.6, true);
  const enhancedMidWordProgress = collectBrowserSmokeLyricState();
  updateLyricsHighlight(1.45, true);
  const enhancedLateWordProgress = collectBrowserSmokeLyricState();
  const denseWordPerformance = runBrowserSmokeDenseLyricPerformanceScenario();
  state.lyricOffsetSeconds = 0;
  const endScrollTrack = createBrowserSmokeTrack({
    id: "browser-smoke-end-scroll-lyric-track",
    name: "Browser Smoke End Scroll Lyric Track",
    durationSeconds: 96,
    lyricsText: Array.from({ length: 46 }, (_, index) => {
      const seconds = index * 2;
      const minutesLabel = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secondsLabel = String(seconds % 60).padStart(2, "0");
      return `[${minutesLabel}:${secondsLabel}.00]End scroll line ${index + 1}`;
    }).join("\n"),
  });
  state.currentTrack = endScrollTrack;
  state.queue = [endScrollTrack];
  state.tracks = [endScrollTrack];
  state.filteredTracks = [endScrollTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(endScrollTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  window.scrollTo(0, 0);
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = 0;
  }
  if (content) {
    content.scrollTop = 0;
  }
  updateLyricsHighlight(88.2, true);
  const endScrollLayout = collectBrowserSmokeImmersiveLayoutState();
  setLyricOffsetSeconds(originalOffsetSeconds);

  return {
    beforeOffset,
    afterOffset,
    afterResumeRefresh,
    longGapProgress,
    longGapIdleResumeDelayMs,
    enhancedMidWordProgress,
    enhancedLateWordProgress,
    denseWordPerformance,
    endScrollLayout,
    activeView: getActiveView(),
    mainHidden: mainView.hidden,
    loginHidden: loginView.hidden,
  };
}

function collectBrowserSmokeLyricState() {
  const activeLine = immersiveLyricLineElements[state.activeLyricIndex] || null;
  const words = [...(immersiveLyricWordElements[state.activeLyricIndex] || [])];
  const wordProgress = words.map((word) => Number(word._lyricProgress || 0));
  const cssWordProgress = words.map((word) => word.style.getPropertyValue("--word-progress"));
  const cssWordRatio = words.map((word) => word.style.getPropertyValue("--word-progress-ratio"));

  return {
    activeIndex: state.activeLyricIndex,
    timelineIndex: state.activeLyricTimelineIndex,
    lyricCount: state.lyricLines.length,
    isSynced: state.isLyricSynced,
    currentText: nowLyricCurrent?.textContent?.trim() || "",
    nextText: nowLyricNext?.textContent?.trim() || "",
    activeLineText: activeLine?.textContent?.trim() || "",
    activeLineClass: activeLine?.className || "",
    wordCount: words.length,
    wordProgress,
    cssWordProgress,
    cssWordRatio,
    offsetLabel: formatLyricOffsetLabel(state.lyricOffsetSeconds),
    scrollAllowedForced: shouldScrollLyricLine(true),
  };
}

function runBrowserSmokeDenseLyricPerformanceScenario() {
  const wordCount = 72;
  const sampleCount = 180;
  const wordStepSeconds = 0.18;
  const words = Array.from({ length: wordCount }, (_, index) => {
    const seconds = (index * wordStepSeconds).toFixed(2);
    return `<${seconds}>字${index + 1}`;
  }).join(" ");
  const track = createBrowserSmokeTrack({
    id: "browser-smoke-dense-lyric-track",
    name: "Browser Smoke Dense Lyric Track",
    durationSeconds: 22,
    lyricsText: [
      `[00:00.00]${words}`,
      "[00:18.00]Next dense lyric line",
    ].join("\n"),
  });
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  let ratioWriteCount = 0;
  let progressWriteCount = 0;

  state.lyricOffsetSeconds = 0;
  state.currentTrack = track;
  state.queue = [track];
  state.tracks = [track];
  state.filteredTracks = [track];
  state.currentTrackIndex = 0;
  updatePlayerMeta(track);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0, true);

  CSSStyleDeclaration.prototype.setProperty = function setBrowserSmokeStyleProperty(propertyName, ...args) {
    if (propertyName === "--word-progress-ratio") {
      ratioWriteCount += 1;
    } else if (propertyName === "--word-progress") {
      progressWriteCount += 1;
    }

    return originalSetProperty.call(this, propertyName, ...args);
  };

  const startedAt = getMonotonicNowMs();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      updateLyricsHighlight(index * 0.075);
    }
  } finally {
    CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
  }
  const durationMs = Math.round((getMonotonicNowMs() - startedAt) * 100) / 100;
  const finalState = collectBrowserSmokeLyricState();
  const ratioValues = finalState.cssWordRatio.map((value) => Number(value || 0));

  return {
    wordCount: finalState.wordCount,
    sampleCount,
    durationMs,
    averageUpdateMs: Math.round((durationMs / sampleCount) * 1000) / 1000,
    ratioWriteCount,
    progressWriteCount,
    activeIndex: finalState.activeIndex,
    maxWordProgress: Math.max(...finalState.wordProgress),
    partialWordCount: finalState.wordProgress.filter((progress) => progress > 0 && progress < 100).length,
    maxRatio: Math.max(...ratioValues),
  };
}

function collectBrowserSmokeImmersiveLayoutState() {
  const shell = document.querySelector(".immersive-player-shell");
  const shellRect = shell?.getBoundingClientRect();
  const listRect = immersiveLyricList?.getBoundingClientRect();
  const activeLine = immersiveLyricLineElements[state.activeLyricIndex] || null;
  const activeRect = activeLine?.getBoundingClientRect();
  const activeOffsetTop = activeLine && immersiveLyricList
    ? getElementOffsetWithinContainer(immersiveLyricList, activeLine)
    : null;
  const scrollingElement = document.scrollingElement || document.documentElement;
  const viewportHeight = window.innerHeight;
  const shellTop = shellRect ? Math.round(shellRect.top) : null;
  const shellBottom = shellRect ? Math.round(shellRect.bottom) : null;

  return {
    activeIndex: state.activeLyricIndex,
    lyricCount: state.lyricLines.length,
    activeLineText: activeLine?.textContent?.trim() || "",
    windowScrollY: Math.round(window.scrollY || 0),
    documentScrollTop: Math.round(scrollingElement?.scrollTop || 0),
    contentScrollTop: Math.round(content?.scrollTop || 0),
    viewportHeight,
    shellTop,
    shellBottom,
    shellHeight: shellRect ? Math.round(shellRect.height) : null,
    shellTopGapPx: shellRect ? Math.round(Math.max(0, shellRect.top)) : null,
    shellBottomGapPx: shellRect ? Math.round(Math.max(0, viewportHeight - shellRect.bottom)) : null,
    shellPinned: Boolean(shellRect && Math.abs(shellRect.top) <= 1 && Math.abs(shellRect.bottom - viewportHeight) <= 1),
    lyricListClientHeight: Math.round(immersiveLyricList?.clientHeight || 0),
    lyricListScrollHeight: Math.round(immersiveLyricList?.scrollHeight || 0),
    lyricListTop: listRect ? Math.round(listRect.top) : null,
    lyricListBottom: listRect ? Math.round(listRect.bottom) : null,
    lyricListScrollTop: Math.round(immersiveLyricList?.scrollTop || 0),
    lyricListMaxScrollTop: immersiveLyricList
      ? Math.round(Math.max(0, immersiveLyricList.scrollHeight - immersiveLyricList.clientHeight))
      : 0,
    activeLineTop: activeRect ? Math.round(activeRect.top) : null,
    activeLineBottom: activeRect ? Math.round(activeRect.bottom) : null,
    activeLineHeight: activeRect ? Math.round(activeRect.height) : null,
    activeOffsetTop: Number.isFinite(activeOffsetTop) ? Math.round(activeOffsetTop) : null,
    activeLineInsideList: Boolean(
      activeRect
      && listRect
      && activeRect.top >= listRect.top - 1
      && activeRect.bottom <= listRect.bottom + 1
    ),
  };
}

function shouldIgnoreExternalCloseEvent(event) {
  if (!(event.target instanceof Element)) {
    return true;
  }

  return document.visibilityState !== "visible" || !document.hasFocus();
}

function isBackdropCloseEvent(event, backdrop) {
  return !shouldIgnoreExternalCloseEvent(event) && event.target === backdrop;
}

function ensureVisibleMainPanel() {
  if (!mainView || mainView.hidden) {
    return;
  }

  const activePanel = document.querySelector(".view-panel.active");

  if (activePanel) {
    document.body.classList.toggle("immersive-player-open", activePanel.dataset.panel === "immersivePlayer");
    return;
  }

  const hashView = location.hash.slice(1);
  const fallbackView = viewPanels.some((panel) => panel.dataset.panel === hashView) ? hashView : "home";
  switchView(fallbackView, { updateHash: false });
}

function bindLoginEvents() {
  if (form.dataset.loginEventsBound === "true") {
    return;
  }

  form.dataset.loginEventsBound = "true";
  form.addEventListener("submit", handleConnect);
  connectButton.addEventListener("click", handleConnectButtonClick);
  loginSourceModeButtons.forEach((button) => {
    button.addEventListener("click", () => setLoginSourceMode(button.dataset.loginSourceMode));
  });
  serverUrlInput.addEventListener("input", syncLoginActionButtons);
  externalSourceApiUrlInput?.addEventListener("input", () => {
    const value = externalSourceApiUrlInput.value.trim();
    if (looksLikeSourceBridgeManifestUrl(value)) {
      state.externalSourceApiUrl = "";
      state.sourceBridgeManifestUrl = value;
      saveExternalSourceApiUrl("");
      saveSourceBridgeManifestUrl(value);
    } else {
      state.externalSourceApiUrl = value;
      saveExternalSourceApiUrl(state.externalSourceApiUrl);
    }
    syncLoginActionButtons();
  });
  testServerButton.addEventListener("click", testServerConnection);
  copyLoginDiagnosticsButton.addEventListener("click", copyLoginDiagnostics);
  clearLoginCacheButton.addEventListener("click", clearLoginCacheAndReload);
  loginVersion.textContent = `v${APP_VERSION}`;
  syncLoginSourceMode();
  syncLoginActionButtons();
}

function setLoginSourceMode(mode) {
  const nextMode = normalizeSourceMode(mode);

  if (state.sourceMode === nextMode) {
    return;
  }

  state.sourceMode = nextMode;
  saveSourceMode(nextMode);
  syncLoginSourceMode();
  syncLoginActionButtons();
  setMessage("");
}

function syncLoginSourceMode() {
  const mode = normalizeSourceMode(state.sourceMode);
  state.sourceMode = mode;
  loginSourceModeButtons.forEach((button) => {
    const isActive = button.dataset.loginSourceMode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  embyLoginFields.forEach((field) => {
    field.hidden = mode === "external";
  });

  if (externalSourceApiField) {
    externalSourceApiField.hidden = mode !== "external";
  }

  if (externalSourceApiUrlInput && !externalSourceApiUrlInput.value) {
    externalSourceApiUrlInput.value = state.externalSourceApiUrl || DEFAULT_EXTERNAL_SOURCE_API_URL || "";
  }

  if (loginTitle) {
    loginTitle.textContent = mode === "external" ? "连接音源桥" : "登录 Emby";
  }

  serverUrlInput.required = mode === "emby" && !isServerUrlLocked();
  usernameInput.required = mode === "emby";
  passwordInput.required = mode === "emby";
  if (externalSourceApiUrlInput) {
    externalSourceApiUrlInput.required = false;
  }
}

function readPendingCredentialLogin() {
  const pendingLogin = window.EmbyMusicPendingLogin || readCredentialLoginFromUrl();

  if (!pendingLogin || typeof pendingLogin !== "object") {
    return null;
  }

  const serverUrl = normalizeServerUrl(String(pendingLogin.serverUrl || ""));
  const username = String(pendingLogin.username || "").trim();
  const password = String(pendingLogin.password || "");
  const deviceName = String(pendingLogin.deviceName || "").trim();

  if (!serverUrl || !username || !password) {
    window.EmbyMusicPendingLogin = null;
    return null;
  }

  return { serverUrl, username, password, deviceName };
}

function readCredentialLoginFromUrl() {
  const url = new URL(location.href);
  const serverUrl = url.searchParams.get("serverUrl");
  const username = url.searchParams.get("username");
  const password = url.searchParams.get("password");
  const deviceName = url.searchParams.get("deviceName") || "";
  const hasCredentials = ["serverUrl", "username", "password", "deviceName"]
    .some((key) => url.searchParams.has(key));

  if (!hasCredentials) {
    return null;
  }

  ["serverUrl", "username", "password", "deviceName"].forEach((key) => {
    url.searchParams.delete(key);
  });
  history.replaceState(null, "", url.toString());

  return serverUrl && username && password
    ? { serverUrl, username, password, deviceName }
    : null;
}

function discardSavedSessionForCredentialLogin() {
  storage.clearQueueState(initialSession);
  storage.clearFilterState(initialSession);
  storage.clearLibraryViewId(initialSession);
  storage.clearSession();
  clearLibraryViewId();
  state.session = null;
  state.queue = [];
  state.currentTrack = null;
  state.currentTrackIndex = -1;
  state.queueUndoSnapshot = null;
  state.recentUndoSnapshot = null;
  resetShufflePlaybackState();
  state.savedPlaybackPositionSeconds = 0;
  state.queueSavedAt = "";
  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
}

function startPendingCredentialLogin(pendingLogin) {
  window.EmbyMusicPendingLogin = null;
  serverUrlInput.value = pendingLogin.serverUrl;
  usernameInput.value = pendingLogin.username;
  passwordInput.value = pendingLogin.password;

  if (pendingLogin.deviceName) {
    deviceNameInput.value = pendingLogin.deviceName;
  }

  syncLoginActionButtons();
  setMessage("已读取地址栏登录信息，正在连接 Emby...");
  handleConnect({ preventDefault() {} });
}

function handleConnectButtonClick(event) {
  event.preventDefault();
  handleConnect(event);
}

async function handleConnect(event) {
  event.preventDefault();

  if (state.isConnecting || state.isTestingServer) {
    return;
  }

  if (state.sourceMode === "external") {
    await connectExternalSource();
    return;
  }

  const serverUrl = getLoginServerUrl();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const deviceName = deviceNameInput.value.trim() || getDefaultDeviceName();

  if (!serverUrl || !username || !password) {
    setMessage("请填写服务器地址、用户名和密码。", "error");
    return;
  }

  storage.saveDeviceName(deviceName);
  setBusy(true);
  setMessage("正在连接 Emby 服务器...");
  setBadge("idle", "连接中");

  try {
    const auth = await authenticate(serverUrl, username, password, deviceName);
    const publicInfo = await fetchPublicInfo(serverUrl).catch(() => ({}));
    const session = buildSession(serverUrl, auth, publicInfo, deviceName);

    saveSourceMode("emby");
    saveSession(session);
    state.session = session;
    state.sourceMode = "emby";
    renderSession(session);
    setBadge("online", "已连接");
    setMessage("连接成功，会话已保存到本地浏览器。", "success");
    passwordInput.value = "";
    showMain();
    await loadMusicLibrary(session);
  } catch (error) {
    setBadge("error", "连接失败");
    setMessage(readableError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function connectExternalSource() {
  const correctedInput = reconcileLoginExternalSourceInput();
  const apiUrl = correctedInput.apiUrl;

  setBusy(true);
  setMessage(apiUrl
    ? "正在连接音源桥..."
    : (correctedInput.movedManifest ? "正在进入音乐桥，JSON 清单已保存..." : "正在进入音源桥空库..."));
  setBadge("idle", "连接中");

  try {
    const info = apiUrl
      ? await externalSourceApi.fetchHealth(apiUrl)
      : { name: "音源桥", version: "-", offline: true };
    const session = buildExternalSourceSession(apiUrl, info);

    saveExternalSourceApiUrl(apiUrl);
    saveSourceMode("external");
    saveSession(session);
    state.session = session;
    state.sourceMode = "external";
    state.externalSourceApiUrl = apiUrl;
    renderSession(session);
    setBadge("online", "已连接");
    setMessage(apiUrl
      ? "音源桥连接成功。"
      : (correctedInput.movedManifest
        ? "已进入音乐桥，JSON 清单已保存到来源管理。"
        : "已进入音源桥，当前未配置服务地址。"), "success");
    showMain();
    await loadMusicLibrary(session);
  } catch (error) {
    setBadge("error", "连接失败");
    setMessage(`音源桥连接失败：${readableError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

async function testServerConnection() {
  if (state.sourceMode === "external") {
    await testExternalSourceConnection();
    return;
  }

  const serverUrl = getLoginServerUrl();

  if (!serverUrl) {
    setMessage("请先填写服务器地址。", "error");
    return;
  }

  setTestServerBusy(true);
  setMessage("正在测试 Emby 服务器...");
  setBadge("idle", "检测中");

  try {
    const publicInfo = await fetchPublicInfo(serverUrl);
    const serverLabel = publicInfo.ServerName || publicInfo.LocalAddress || "Emby Server";
    const versionLabel = publicInfo.Version ? ` · Emby ${publicInfo.Version}` : "";

    setBadge("online", "服务器可用");
    setMessage(`服务器连接正常：${serverLabel}${versionLabel}。`, "success");
  } catch (error) {
    setBadge("error", "连接失败");
    setMessage(`服务器测试失败：${readableError(error)}`, "error");
  } finally {
    setTestServerBusy(false);
  }
}

async function testExternalSourceConnection() {
  const correctedInput = reconcileLoginExternalSourceInput();
  const apiUrl = correctedInput.apiUrl;

  if (!apiUrl) {
    setMessage(correctedInput.movedManifest
      ? "已识别 JSON 清单链接。请进入音乐桥后，在个人中心填写服务地址。"
      : "请先填写音源桥地址。", "error");
    return;
  }

  setTestServerBusy(true);
  setMessage("正在测试音源桥...");
  setBadge("idle", "检测中");

  try {
    const info = await externalSourceApi.fetchHealth(apiUrl);
    const label = info?.name || info?.serverName || info?.platform || "音源桥";
    const version = info?.version ? ` · ${info.version}` : "";

    setBadge("online", "接口可用");
    setMessage(`音源桥连接正常：${label}${version}。`, "success");
    saveExternalSourceApiUrl(apiUrl);
  } catch (error) {
    setBadge("error", "连接失败");
    setMessage(`音源桥测试失败：${readableError(error)}`, "error");
  } finally {
    setTestServerBusy(false);
  }
}

async function testCurrentConnection() {
  if (!state.session) {
    setLibraryStatus("当前没有可测试的连接。");
    return;
  }

  if (isExternalSourceSession()) {
    await testCurrentExternalSourceConnection();
    return;
  }

  state.isTestingConnection = true;
  renderSettings();
  setBadge("idle", "检测中");
  setLibraryStatus("正在测试当前 Emby 连接...");

  try {
    const [publicInfo, userInfo] = await Promise.all([
      fetchPublicInfo(state.session.serverUrl),
      embyFetch(state.session, `/Users/${encodeURIComponent(state.session.userId)}`),
    ]);
    const nextSession = {
      ...state.session,
      serverName: publicInfo.ServerName || publicInfo.LocalAddress || state.session.serverName,
      version: publicInfo.Version || state.session.version,
      userName: userInfo.Name || state.session.userName,
      savedAt: new Date().toISOString(),
    };
    const serverLabel = nextSession.serverName || "Emby Server";
    const versionLabel = nextSession.version && nextSession.version !== "-"
      ? ` · Emby ${nextSession.version}`
      : "";

    saveSession(nextSession);
    state.session = nextSession;
    renderSession(nextSession);
    setBadge("online", "已连接");
    setLibraryStatus(`当前连接正常：${serverLabel}${versionLabel}。`);
  } catch (error) {
    setBadge("error", "连接异常");
    showNotice(`当前连接测试失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重新登录", handler: clearSession },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } finally {
    state.isTestingConnection = false;
    renderSettings();
  }
}

async function testCurrentExternalSourceConnection() {
  state.isTestingConnection = true;
  renderSettings();
  setBadge("idle", "检测中");
  setLibraryStatus("正在测试当前音源桥...");

  try {
    const apiUrl = getSessionExternalSourceApiUrl(state.session);

    if (!apiUrl) {
      throw new Error("音乐桥还没有配置服务地址。");
    }

    const info = await externalSourceApi.fetchHealth(apiUrl);
    const nextSession = {
      ...buildExternalSourceSession(apiUrl, info),
      savedAt: new Date().toISOString(),
    };
    const label = nextSession.serverName || "音源桥";
    const version = nextSession.version && nextSession.version !== "-" ? ` · ${nextSession.version}` : "";

    saveSession(nextSession);
    state.session = nextSession;
    state.sourceMode = "external";
    state.externalSourceApiUrl = nextSession.externalSourceApiUrl;
    renderSession(nextSession);
    setBadge("online", "已连接");
    setLibraryStatus(`当前音源桥正常：${label}${version}。`);
  } catch (error) {
    setBadge("error", "连接异常");
    showNotice(`当前音源桥测试失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重新连接", handler: clearSession },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } finally {
    state.isTestingConnection = false;
    renderSettings();
  }
}

async function testCurrentPlaybackChain(trackOverride) {
  if (!state.session) {
    setLibraryStatus("当前没有可测试的连接。");
    return;
  }

  const track = trackOverride || state.currentTrack || state.filteredTracks[0] || state.tracks[0];

  if (!track?.Id) {
    showNotice("还没有读取到可测试的歌曲，请先加载音乐库。", {
      type: "warning",
      actions: [{ label: "刷新音乐库", handler: refreshLibrary }],
    });
    return;
  }

  if (isExternalSourceTrack(track)) {
    await testExternalPlaybackChain(track);
    return;
  }

  state.isTestingPlayback = true;
  renderSettings();
  setLibraryStatus(`正在测试播放链路：${track.Name || "未命名歌曲"}...`);

  try {
    const mode = resolvePlaybackMode();
    const fallbackMediaSourceId = getTrackDefaultMediaSourceId(track);
    const playbackInfo = await fetchPlaybackInfo(track, mode, fallbackMediaSourceId);
    const mediaSource = selectPlaybackMediaSource(playbackInfo, track, mode, fallbackMediaSourceId);
    const mediaSourceId = mediaSource?.Id || fallbackMediaSourceId;
    const playSessionId = ensurePlaybackSessionId(track, playbackInfo?.PlaySessionId || mediaSource?.PlaySessionId);

    const response = await probeAudioStream(getAudioStreamUrl(track, mode, playSessionId, mediaSourceId));

    const contentType = response.headers.get("Content-Type") || "未知格式";
    const contentLength = formatByteSize(response.headers.get("Content-Length"));
    const probeMethod = response.probeMethod === "range" ? "Range" : "HEAD";
    const profile = getAudioQualityProfile();
    const modeLabel = mode === "universal"
      ? `${getEffectiveTranscodeMethodLabel(profile)} / ${profile.transferFormat || profile.codec} / ${profile.bitrateLabel || "原码率"}`
      : "直连";
    state.lastPlaybackProbe = `${modeLabel} / ${contentType} / ${contentLength} / ${probeMethod}`;

    setLibraryStatus(`播放链路正常：${state.lastPlaybackProbe}。`);
    showNotice(`播放链路正常：${track.Name || "当前歌曲"}。`, {
      type: "success",
      actions: [
        { label: "立即播放", handler: () => playTrack(track, state.filteredTracks.length ? state.filteredTracks : state.tracks) },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } catch (error) {
    state.lastPlaybackError = readableError(error);
    state.lastPlaybackProbe = "";
    renderPlaybackRecoveryPanel();
    showNotice(`播放链路测试失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: getOppositePlaybackActionLabel(), handler: () => retryWithOppositePlaybackMode(track) },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } finally {
    state.isTestingPlayback = false;
    renderSettings();
  }
}

async function testExternalPlaybackChain(track) {
  state.isTestingPlayback = true;
  renderSettings();
  setLibraryStatus(`正在测试外部播放链路：${track.Name || "未命名歌曲"}...`);

  try {
    const media = await externalSourceApi.fetchMediaSource(track.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl(), track, {
      quality: getExternalPlaybackQuality(track),
      videoQuality: isVideoTrack(track) ? getExternalSourceVideoQuality() : "",
    });
    const response = await probeAudioStream(media.streamUrl);
    const contentType = response.headers.get("Content-Type") || "未知格式";
    const contentLength = formatByteSize(response.headers.get("Content-Length"));
    const probeMethod = response.probeMethod === "range" ? "Range" : "HEAD";

    state.lastPlaybackProbe = `外部直链 / ${contentType} / ${contentLength} / ${probeMethod}`;
    setLibraryStatus(`外部播放链路正常：${state.lastPlaybackProbe}。`);
    showNotice(`外部播放链路正常：${track.Name || "当前歌曲"}。`, {
      type: "success",
      actions: [
        { label: "立即播放", handler: () => playTrack(track, state.filteredTracks.length ? state.filteredTracks : state.tracks) },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } catch (error) {
    state.lastPlaybackError = readableError(error);
    state.lastPlaybackProbe = "";
    renderPlaybackRecoveryPanel();
    showNotice(`外部播放链路测试失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重试测试", handler: () => testExternalPlaybackChain(track) },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
  } finally {
    state.isTestingPlayback = false;
    renderSettings();
  }
}

async function probeAudioStream(streamUrl) {
  let headResponse;

  try {
    headResponse = await fetch(streamUrl, { method: "HEAD" });

    if (headResponse.ok) {
      headResponse.probeMethod = "head";
      return headResponse;
    }
  } catch {
    headResponse = null;
  }

  const rangeResponse = await fetch(streamUrl, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
  });

  if (rangeResponse.ok || rangeResponse.status === 206) {
    rangeResponse.probeMethod = "range";
    return rangeResponse;
  }

  const statusText = rangeResponse.statusText || headResponse?.statusText || "";
  const status = rangeResponse.status || headResponse?.status || "";
  throw new Error(`音频流返回 ${status} ${statusText}`.trim());
}

async function copyLoginDiagnostics() {
  const diagnostics = buildLoginDiagnostics();

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard unavailable");
    }

    await navigator.clipboard.writeText(diagnostics);
    setMessage("登录诊断信息已复制。", "success");
  } catch {
    setMessage("无法自动复制诊断信息，请打开浏览器开发者工具查看 Console。", "error");
    console.info(diagnostics);
  }
}

async function clearLoginCacheAndReload() {
  setMessage("正在清除应用缓存...");

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("emby-music-web-"))
          .map((key) => caches.delete(key))
      );
    }

    const url = new URL(location.href);
    url.searchParams.set("v", APP_VERSION);
    url.searchParams.set("reload", String(Date.now()));
    location.replace(url.toString());
  } catch (error) {
    setMessage(`清除缓存失败：${readableError(error)}`, "error");
  }
}

async function verifySession(session) {
  setMessage("正在校验已保存的会话...");

  if (isExternalSourceSession(session)) {
    await verifyExternalSourceSession(session);
    return;
  }

  try {
    const [publicInfo, userInfo] = await Promise.all([
      fetchPublicInfo(session.serverUrl).catch(() => ({})),
      embyFetch(session, `/Users/${encodeURIComponent(session.userId)}`),
    ]);

    const nextSession = {
      ...session,
      serverName: publicInfo.ServerName || publicInfo.LocalAddress || session.serverName,
      version: publicInfo.Version || session.version,
      userName: userInfo.Name || session.userName,
    };

    saveSession(nextSession);
    state.session = nextSession;
    renderSession(nextSession);
    setBadge("online", "已连接");
    setMessage("已恢复上次连接。", "success");
    showMain();
    await loadMusicLibrary(nextSession);
  } catch (error) {
    setBadge("error", "需重新登录");
    setMessage(`上次会话不可用：${readableError(error)}`, "error");
    showLogin();
  }
}

async function verifyExternalSourceSession(session) {
  try {
    const apiUrl = getSessionExternalSourceApiUrl(session);
    const info = apiUrl
      ? await externalSourceApi.fetchHealth(apiUrl)
      : { name: "音源桥", version: "-", offline: true };
    const nextSession = {
      ...buildExternalSourceSession(apiUrl, info),
      savedAt: session.savedAt || new Date().toISOString(),
    };

    saveSession(nextSession);
    state.session = nextSession;
    state.sourceMode = "external";
    state.externalSourceApiUrl = nextSession.externalSourceApiUrl;
    renderSession(nextSession);
    setBadge("online", "已连接");
    setMessage("已恢复音源桥。", "success");
    showMain();
    await loadMusicLibrary(nextSession);
  } catch (error) {
    setBadge("error", "需重新连接");
    setMessage(`音源桥不可用：${readableError(error)}`, "error");
    showLogin();
  }
}

async function loadMusicLibrary(session) {
  const savedFilterState = loadFilterState(session);
  const savedQueueState = loadQueueState(session);

  state.isLibraryLoaded = false;
  state.recentTracks = loadRecentTracks(session);
  state.queue = savedQueueState.queue;
  state.currentTrackIndex = savedQueueState.currentTrackIndex;
  state.currentTrack = savedQueueState.currentTrack;
  state.savedPlaybackPositionSeconds = savedQueueState.positionSeconds;
  state.lastQueuePositionSaveSeconds = savedQueueState.positionSeconds;
  state.lastQueuePositionSaveAt = Date.now();
  state.queueSavedAt = savedQueueState.savedAt;
  resetShufflePlaybackState();
  searchInput.disabled = true;
  clearSearchButton.disabled = true;
  refreshButton.disabled = true;
  shuffleButton.disabled = true;
  trackDensitySelect.value = state.trackDensity;
  libraryViewSelect.disabled = true;
  searchInput.value = "";
  genreSelect.value = savedFilterState.genre;
  genreSelect.disabled = true;
  yearSelect.value = savedFilterState.year;
  yearSelect.disabled = true;
  qualitySelect.value = savedFilterState.quality;
  qualitySelect.disabled = true;
  favoriteFilterSelect.value = savedFilterState.favorite;
  state.query = "";
  state.albumFilter = null;
  state.artistFilter = null;
  state.genreFilter = savedFilterState.genre;
  state.yearFilter = savedFilterState.year;
  state.qualityFilter = savedFilterState.quality;
  state.favoriteFilter = savedFilterState.favorite;
  state.availableGenres = [];
  state.availableYears = [];
  state.availableQualities = [];
  state.selectedAlbum = null;
  state.albumTracks = [];
  state.selectedArtist = null;
  state.artistTracks = [];
  state.artistAlbums = [];
  state.selectedPlaylist = null;
  state.playlistTracks = [];
  state.detailReturnViews = {
    albumDetail: "albums",
    artistDetail: "artists",
    playlistDetail: "playlists",
  };
  renderLoadingShell();

  if (isExternalSourceSession(session)) {
    await loadExternalMusicLibrary(session);
    return;
  }

  setLibraryStatus("正在加载 Emby 音乐库...");

  try {
    const viewsResponse = await safeEmbyFetch(session, `/Users/${encodeURIComponent(session.userId)}/Views`, { Items: [] });
    state.views = viewsResponse.Items || [];
    state.libraryViewId = resolveLibraryViewId(state.libraryViewId);
    saveLibraryViewId(state.libraryViewId);
    renderLibraryViewOptions();

    const scopedParams = getLibraryScopeParams();
    const [albumResponse, trackResponse, artistResponse, favoriteResponse, playlistResponse] = await Promise.all([
      embyFetch(session, userItemsPath(session, {
        Recursive: true,
        IncludeItemTypes: "MusicAlbum",
        SortBy: "DateCreated",
        SortOrder: "Descending",
        StartIndex: 0,
        Limit: PAGE_SIZE.albums,
        Fields: itemFields,
        EnableUserData: true,
        ...scopedParams,
      })),
      embyFetch(session, userItemsPath(session, {
        Recursive: true,
        IncludeItemTypes: "Audio",
        SortBy: "DateCreated",
        SortOrder: "Descending",
        StartIndex: 0,
        Limit: PAGE_SIZE.tracks,
        Fields: itemFields,
        EnableUserData: true,
        ...scopedParams,
      })),
      safeEmbyFetch(session, userItemsPath(session, {
        Recursive: true,
        IncludeItemTypes: "MusicArtist",
        SortBy: "SortName",
        SortOrder: "Ascending",
        StartIndex: 0,
        Limit: PAGE_SIZE.artists,
        Fields: itemFields,
        EnableUserData: true,
        ...scopedParams,
      }), { Items: [], TotalRecordCount: 0 }),
      safeEmbyFetch(session, userItemsPath(session, {
        Recursive: true,
        IncludeItemTypes: "Audio",
        IsFavorite: true,
        SortBy: "SortName",
        SortOrder: "Ascending",
        StartIndex: 0,
        Limit: PAGE_SIZE.favorites,
        Fields: itemFields,
        EnableUserData: true,
        ...scopedParams,
      }), { Items: [], TotalRecordCount: 0 }),
      safeEmbyFetch(session, userItemsPath(session, {
        Recursive: true,
        IncludeItemTypes: "Playlist",
        SortBy: "SortName",
        SortOrder: "Ascending",
        StartIndex: 0,
        Limit: PAGE_SIZE.playlists,
        Fields: itemFields,
        EnableUserData: true,
        ...scopedParams,
      }), { Items: [], TotalRecordCount: 0 }),
    ]);

    state.albums = normalizeItems(albumResponse.Items);
    state.tracks = mergeUniqueItems(normalizeItems(trackResponse.Items), state.queue);
    state.artists = normalizeItems(artistResponse.Items);
    state.playlists = normalizePlaylists(playlistResponse.Items);
    state.favoriteTracks = mergeUniqueItems(normalizeItems(favoriteResponse.Items), state.tracks.filter(isFavorite));
    state.lastServerSearchQuery = "";
    state.serverSearchRequestId += 1;
    clearTimeout(state.serverSearchTimer);
    state.isServerSearching = false;
    state.totalTracks = trackResponse.TotalRecordCount ?? state.tracks.length;
    state.totalAlbums = albumResponse.TotalRecordCount ?? state.albums.length;
    state.totalArtists = artistResponse.TotalRecordCount ?? state.artists.length;
    state.totalPlaylists = playlistResponse.TotalRecordCount ?? state.playlists.length;
    state.totalFavorites = favoriteResponse.TotalRecordCount ?? state.favoriteTracks.length;
    state.isLibraryLoaded = true;

    applyFilters();
    renderLibrary();
    libraryViewSelect.disabled = getMusicViews().length < 2;
    searchInput.disabled = false;
    genreSelect.disabled = !state.availableGenres.length;
    yearSelect.disabled = !state.availableYears.length;
    qualitySelect.disabled = !state.availableQualities.length;
    refreshButton.disabled = false;
    shuffleButton.disabled = !state.filteredTracks.length;
    setLibraryStatus("");
  } catch (error) {
    state.isLibraryLoaded = false;
    searchInput.disabled = true;
    clearSearchButton.disabled = true;
    libraryViewSelect.disabled = getMusicViews().length < 2;
    genreSelect.disabled = true;
    yearSelect.disabled = true;
    qualitySelect.disabled = true;
    refreshButton.disabled = false;
    shuffleButton.disabled = true;
    renderLibraryError(readableError(error));
    showNotice(`音乐库加载失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重新加载", handler: refreshLibrary },
        { label: "来源管理", handler: openSourceBridgeModal },
      ],
    });
  }
}

async function loadExternalMusicLibrary(session) {
  const apiUrl = getSessionExternalSourceApiUrl(session);

  if (!apiUrl) {
    setEmptyExternalSourceLibrary();
    return;
  }

  setLibraryStatus("正在加载音源桥...");

  try {
    const info = await externalSourceApi.fetchHealth(apiUrl).catch(() => null);
    state.sourceBridgeInfo = info;
    const response = await externalSourceApi.fetchTracks(apiUrl, {
      startIndex: 0,
      limit: PAGE_SIZE.tracks,
    });

    state.views = [];
    state.libraryViewId = "";
    state.albums = [];
    state.artists = [];
    state.playlists = [];
    state.tracks = mergeUniqueItems(normalizeItems(response.Items), state.queue);
    state.albums = mergeUniqueItems(state.albums, inferExternalAlbumsFromTracks(state.tracks));
    state.favoriteTracks = state.tracks.filter(isFavorite);
    state.totalTracks = response.TotalRecordCount ?? state.tracks.length;
    state.totalAlbums = state.albums.length;
    state.totalArtists = 0;
    state.totalPlaylists = 0;
    state.totalFavorites = state.favoriteTracks.length;
    state.lastServerSearchQuery = "";
    state.serverSearchRequestId += 1;
    clearTimeout(state.serverSearchTimer);
    state.isServerSearching = false;
    state.isLibraryLoaded = true;

    applyFilters();
    renderLibrary();
    libraryViewSelect.disabled = true;
    searchInput.disabled = false;
    genreSelect.disabled = true;
    yearSelect.disabled = true;
    qualitySelect.disabled = !state.availableQualities.length;
    refreshButton.disabled = false;
    shuffleButton.disabled = !state.filteredTracks.length;
    setLibraryStatus("");
  } catch (error) {
    state.isLibraryLoaded = false;
    searchInput.disabled = false;
    clearSearchButton.disabled = true;
    libraryViewSelect.disabled = true;
    genreSelect.disabled = true;
    yearSelect.disabled = true;
    qualitySelect.disabled = true;
    refreshButton.disabled = false;
    shuffleButton.disabled = true;
    renderLibraryError(readableError(error));
    showNotice(`音源桥加载失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重新加载", handler: refreshLibrary },
        { label: "查看设置", handler: () => switchView("settings") },
      ],
    });
  }
}

function setEmptyExternalSourceLibrary() {
  state.sourceBridgeInfo = null;
  state.views = [];
  state.libraryViewId = "";
  state.albums = [];
  state.artists = [];
  state.playlists = [];
  state.tracks = [];
  state.favoriteTracks = [];
  state.totalTracks = 0;
  state.totalAlbums = 0;
  state.totalArtists = 0;
  state.totalPlaylists = 0;
  state.totalFavorites = 0;
  state.lastServerSearchQuery = "";
  state.serverSearchRequestId += 1;
  clearTimeout(state.serverSearchTimer);
  state.isServerSearching = false;
  state.isLibraryLoaded = true;
  applyFilters();
  renderAll();
  renderSettings();
  searchInput.disabled = false;
  genreSelect.disabled = true;
  yearSelect.disabled = true;
  qualitySelect.disabled = true;
  refreshButton.disabled = false;
  shuffleButton.disabled = true;
  setLibraryStatus("音源桥未配置地址。可以先进入应用，之后启动本地桥接服务再连接。");
}

function renderSession(session) {
  const isBridge = isExternalSourceSession(session);
  if (serverNameLabel) {
    serverNameLabel.textContent = isBridge ? "模式" : "服务器";
  }
  if (libraryNameLabel) {
    libraryNameLabel.textContent = isBridge ? "来源" : "音乐库";
  }
  if (serverVersionLabel) {
    serverVersionLabel.textContent = isBridge ? "桥版本" : "服务器版本";
  }
  if (currentUserLabel) {
    currentUserLabel.textContent = isBridge ? "来源类型" : "当前用户";
  }
  serverName.textContent = isBridge ? "音乐桥" : (session.serverName || "-");
  serverVersion.textContent = session.version || "-";
  currentUser.textContent = isBridge ? "桥接来源" : (session.userName || "-");
  currentServer.textContent = isBridge ? getSourceBridgeDisplayUrl(session) : (session.serverUrl || "-");
  heroTitle.textContent = isBridge
    ? "音乐桥工作台"
    : (session.userName ? `欢迎回来，${session.userName}` : "欢迎回来");
  renderAccountMenu(session);
}

function renderAccountMenu(session = state.session || {}) {
  const userName = session.userName || "未连接";
  const isBridge = isExternalSourceSession(session);

  if (session.userName) {
    const initial = getAvatarInitial(session.userName);
    accountAvatar.dataset.initial = initial;
    accountMenuAvatar.dataset.initial = initial;
  } else {
    delete accountAvatar.dataset.initial;
    delete accountMenuAvatar.dataset.initial;
  }

  accountMenuTitle.textContent = userName;
  accountMenuServer.textContent = isBridge ? getSourceBridgeDisplayUrl(session) : (session.serverName || session.serverUrl || "-");
  if (accountSourceBridgeButton) {
    accountSourceBridgeButton.hidden = !isBridge;
    accountSourceBridgeButton.disabled = !isBridge;
  }
  renderAccountMenuSavedAccounts();
  accountTestConnectionButton.disabled = !state.session || state.isTestingConnection;
  accountTestConnectionButton.querySelector("span:last-child").textContent = state.isTestingConnection
    ? "检测中..."
    : "测试当前连接";
}

function getAvatarInitial(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed || trimmed === "未连接") {
    return "E";
  }

  return trimmed.slice(0, 1).toUpperCase();
}

function renderLibrary() {
  const selectedView = getSelectedLibraryView();
  const musicViews = getMusicViews();
  const names = musicViews.map((view) => view.Name).filter(Boolean);
  const isBridge = isExternalSourceSession();
  const libraryLabel = isBridge
    ? getSourceBridgeLibraryLabel()
    : (selectedView?.Name || (names.length ? names.join(" / ") : "全部音乐"));

  heroSubtitle.textContent = state.totalTracks
    ? `已读取 ${formatCount(state.totalTracks)} 首歌曲，点选任意歌曲即可播放。`
    : (isBridge ? "音乐桥还没有歌曲。可以添加本地目录、音源清单，或连接已有桥接服务。" : "没有读取到歌曲，请确认 Emby 中已经建立音乐库。");
  libraryName.textContent = libraryLabel;
  renderSourceBridgeWorkspace();
  renderLibraryViewOptions();
  sortSelect.value = state.sortKey;
  sortOrderSelect.value = state.sortOrder;
  trackCount.textContent = formatCount(state.totalTracks || state.tracks.length);
  albumCount.textContent = formatCount(state.totalAlbums || state.albums.length);
  artistCount.textContent = formatCount(state.totalArtists || state.artists.length);
  playlistCount.textContent = formatCount(state.totalPlaylists || state.playlists.length);
  libraryMeta.textContent = getTrackCollectionMeta(state.filteredTracks);
  albumMeta.textContent = `${state.filteredAlbums.length} 张专辑`;
  artistMeta.textContent = `${state.filteredArtists.length} 位艺人`;
  playlistMeta.textContent = `${state.filteredPlaylists.length} 个歌单`;
  createPlaylistButton.disabled = !state.session || state.isCreatingPlaylist;
  favoriteMeta.textContent = getFavoriteMetaText();
  if (state.isServerSearching) {
    libraryMeta.textContent = `${libraryMeta.textContent} · 搜索中`;
  }
  recentMeta.textContent = getRecentMetaText(state.recentTracks);
  queueMeta.textContent = getQueueMetaText();
  clearSearchButton.disabled = !state.query
    && !state.albumFilter
    && !state.artistFilter
    && !state.genreFilter
    && !state.yearFilter
    && !state.qualityFilter
    && !state.favoriteFilter;
  shuffleButton.disabled = !state.filteredTracks.length;
  playLibraryButton.disabled = !state.filteredTracks.length;
  queueLibraryButton.disabled = !state.filteredTracks.length;
  playFavoritesButton.disabled = !state.filteredFavoriteTracks.length;
  queueFavoritesButton.disabled = !state.filteredFavoriteTracks.length;
  renderLibraryQuickPanel();
  renderGenreOptions();
  renderYearOptions();
  renderQualityOptions();
  syncEnhancedLibrarySelects();

  renderAlbumGrid(allAlbumGrid, state.filteredAlbums);
  renderPlaylistGrid(playlistGrid, state.filteredPlaylists);
  renderHomeSections();
  renderPlaylistGrid(favoritePlaylistGrid, state.filteredFavoritePlaylists, {
    emptyText: "还没有收藏歌单。",
    searchEmptyText: "没有匹配的收藏歌单。",
  });
  renderAlbumGrid(favoriteAlbumGrid, state.filteredFavoriteAlbums, {
    emptyText: "还没有收藏专辑。",
    searchEmptyText: "没有匹配的收藏专辑。",
  });
  renderArtistGrid(favoriteArtistGrid, state.filteredFavoriteArtists, {
    emptyText: "还没有收藏艺人。",
    searchEmptyText: "没有匹配的收藏艺人。",
  });
  renderTrackList(recentTrackList, state.filteredTracks.slice(0, 16), {
    context: "home-preview",
    hideHeader: true,
  });
  renderTrackList(libraryTrackList, state.filteredTracks);
  renderSearchResults();
  syncLibraryAlphabetScrubber();
  renderTrackList(favoriteTrackList, state.filteredFavoriteTracks, {
    emptyText: hasActiveTrackFilter() ? "没有匹配的收藏歌曲。" : "还没有收藏歌曲。",
  });
  renderRecent();
  renderArtistGrid(artistGrid, state.filteredArtists);
  renderFilterBar();
  renderQueue();
  renderNowPlaying();
  renderRestoredPlaybackProgress(state.currentTrack);
  renderSettings();
  renderActiveDetailPanels();
  updateLoadMoreButtons();
  updateActiveRows();
}

function hasActiveTrackFilter() {
  return Boolean(state.query
    || state.albumFilter
    || state.artistFilter
    || state.genreFilter
    || state.yearFilter
    || state.qualityFilter
    || state.favoriteFilter);
}

function renderSourceBridgeWorkspace() {
  const isBridge = isExternalSourceSession();
  const apiUrl = getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "";
  const statusText = getSourceBridgeStatusText();

  if (accountSourceBridgeButton) {
    accountSourceBridgeButton.hidden = !isBridge;
    accountSourceBridgeButton.disabled = !isBridge;
  }
  syncSourceBridgeInputs();

  if (sourceBridgeStatus) {
    const label = sourceBridgeStatus.querySelector("span") || sourceBridgeStatus;
    label.textContent = statusText;
    sourceBridgeStatus.dataset.state = getSourceBridgeStatusState();
  }

  const canTest = Boolean(apiUrl);
  [sourceBridgeTestButton].forEach((button) => {
    if (button) {
      button.disabled = !canTest || state.isTestingServer;
    }
  });
  [sourceBridgeRefreshButton].forEach((button) => {
    if (button) {
      button.disabled = !state.session;
    }
  });
}

function syncSourceBridgeInputs() {
  const apiUrl = getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "";

  [
    sourceBridgeApiUrlInput,
  ].forEach((input) => {
    if (input && document.activeElement !== input) {
      input.value = apiUrl;
    }
  });

  [
    sourceBridgeManifestUrlInput,
  ].forEach((input) => {
    if (input && document.activeElement !== input) {
      input.value = state.sourceBridgeManifestUrl || "";
    }
  });

  [
    sourceBridgeMusicDirInput,
  ].forEach((input) => {
    if (input && document.activeElement !== input) {
      input.value = state.sourceBridgeMusicDir || "";
    }
  });
}

function getSourceBridgeStatusText() {
  const info = state.sourceBridgeInfo || {};
  const apiUrl = getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "";

  if (!apiUrl) {
    return "未配置";
  }

  if (Number.isFinite(Number(info.localTrackCount))) {
    const manifestCount = Array.isArray(info.manifests) ? info.manifests.length : 0;
    if (Number(info.localTrackCount) === 0) {
      return manifestCount ? `0 首 · ${manifestCount} 个清单` : "在线 · 0 首";
    }
    return `${formatCount(info.localTrackCount)} 首 · ${manifestCount} 个清单`;
  }

  return "已配置";
}

function getSourceBridgeStatusState() {
  const apiUrl = getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "";
  const info = state.sourceBridgeInfo || {};

  if (!apiUrl) {
    return "empty";
  }

  if (Number.isFinite(Number(info.localTrackCount)) && Number(info.localTrackCount) === 0) {
    return "warning";
  }

  if (Number.isFinite(Number(info.localTrackCount)) && Number(info.localTrackCount) > 0) {
    return "success";
  }

  return "ready";
}

function getSourceBridgeLibraryLabel() {
  const info = state.sourceBridgeInfo || {};
  const dirs = Array.isArray(info.localMusicDirs) ? info.localMusicDirs.filter(Boolean) : [];
  const manifests = Array.isArray(info.manifests) ? info.manifests : [];

  if (dirs.length && manifests.length) {
    return `本地目录 + ${manifests.length} 个清单`;
  }

  if (dirs.length) {
    return dirs.length === 1 ? "本地音乐" : `${dirs.length} 个本地目录`;
  }

  if (manifests.length) {
    return `${manifests.length} 个音源清单`;
  }

  return state.session?.externalSourceApiUrl ? "桥接服务" : "待添加来源";
}

function getSourceBridgeDisplayUrl(session = state.session) {
  return getSessionExternalSourceApiUrl(session) || state.externalSourceApiUrl || "未配置";
}

function renderLibraryViewOptions() {
  const selectedValue = resolveLibraryViewId(state.libraryViewId);
  const musicViews = getMusicViews();

  libraryViewSelect.replaceChildren();
  libraryViewSelect.append(new Option("全部音乐", ""));

  musicViews.forEach((view) => {
    libraryViewSelect.append(new Option(view.Name || "未命名音乐库", view.Id));
  });

  libraryViewSelect.value = selectedValue;
  libraryViewSelect.disabled = !state.session || !state.isLibraryLoaded || musicViews.length < 2;
}

function initEnhancedLibrarySelects() {
  enhancedLibrarySelects.forEach((shell) => {
    const select = shell.querySelector("select");
    const trigger = shell.querySelector("[data-select-trigger]");
    const menu = shell.querySelector("[data-select-menu]");

    if (!select || !trigger || !menu) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleEnhancedLibrarySelect(shell);
    });

    menu.addEventListener("click", (event) => {
      event.stopPropagation();
      const optionButton = event.target instanceof Element
        ? event.target.closest("[data-select-option]")
        : null;

      if (!optionButton || optionButton.disabled) {
        return;
      }

      select.value = optionButton.dataset.value || "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      closeEnhancedLibrarySelect(shell);
      trigger.focus();
    });

    select.addEventListener("change", () => {
      syncEnhancedLibrarySelect(shell);
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-enhanced-select]")) {
      return;
    }

    closeAllEnhancedLibrarySelects();

    if (!target?.closest(".advanced-filter-menu")) {
      closeAdvancedFilterMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllEnhancedLibrarySelects();
      closeAdvancedFilterMenus();
    }
  });

  syncEnhancedLibrarySelects();
}

function syncEnhancedLibrarySelects() {
  syncNativeLibraryFilterSelectValues();
  enhancedLibrarySelects.forEach(syncEnhancedLibrarySelect);
}

function syncNativeLibraryFilterSelectValues() {
  setSelectValueIfAvailable(libraryViewSelect, resolveLibraryViewId(state.libraryViewId));
  setSelectValueIfAvailable(sortSelect, SORT_KEYS.includes(state.sortKey) ? state.sortKey : "recent");
  setSelectValueIfAvailable(sortOrderSelect, SORT_ORDERS.includes(state.sortOrder) ? state.sortOrder : "default");
  setSelectValueIfAvailable(genreSelect, state.genreFilter || "");
  setSelectValueIfAvailable(yearSelect, state.yearFilter || "");
  setSelectValueIfAvailable(qualitySelect, state.qualityFilter || "");
  setSelectValueIfAvailable(favoriteFilterSelect, state.favoriteFilter || "");
  setSelectValueIfAvailable(trackDensitySelect, TRACK_DENSITIES.includes(state.trackDensity) ? state.trackDensity : "comfortable");
}

function setSelectValueIfAvailable(select, value) {
  if (!select) {
    return;
  }

  const nextValue = String(value ?? "");
  if ([...select.options].some((option) => option.value === nextValue)) {
    select.value = nextValue;
  }
}

function syncEnhancedLibrarySelect(shell) {
  const select = shell.querySelector("select");
  const trigger = shell.querySelector("[data-select-trigger]");
  const valueNode = shell.querySelector("[data-select-value]");

  if (!select || !trigger || !valueNode) {
    return;
  }

  const selectedOption = select.selectedOptions[0] || select.options[0];
  valueNode.textContent = selectedOption?.textContent || "全部";
  trigger.disabled = select.disabled;
  trigger.setAttribute("aria-disabled", select.disabled ? "true" : "false");
  shell.classList.toggle("is-disabled", select.disabled);
  renderEnhancedLibrarySelectOptions(shell);

  if (select.disabled) {
    closeEnhancedLibrarySelect(shell);
  }
}

function renderEnhancedLibrarySelectOptions(shell) {
  const select = shell.querySelector("select");
  const menu = shell.querySelector("[data-select-menu]");

  if (!select || !menu) {
    return;
  }

  menu.replaceChildren();
  [...select.options].forEach((option) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "enhanced-select-option";
    optionButton.dataset.value = option.value;
    optionButton.dataset.selectOption = "";
    optionButton.disabled = option.disabled;
    optionButton.setAttribute("role", "option");
    optionButton.setAttribute("aria-selected", option.selected ? "true" : "false");
    optionButton.classList.toggle("is-selected", option.selected);
    optionButton.textContent = option.textContent || "全部";
    menu.append(optionButton);
  });
}

function toggleEnhancedLibrarySelect(shell) {
  const select = shell.querySelector("select");

  if (!select || select.disabled) {
    return;
  }

  if (shell.classList.contains("is-open")) {
    closeEnhancedLibrarySelect(shell);
    return;
  }

  closeAllEnhancedLibrarySelects(shell);
  renderEnhancedLibrarySelectOptions(shell);
  shell.classList.add("is-open");
  shell.querySelector("[data-select-trigger]")?.setAttribute("aria-expanded", "true");
}

function closeAllEnhancedLibrarySelects(exceptShell = null) {
  enhancedLibrarySelects.forEach((shell) => {
    if (shell !== exceptShell) {
      closeEnhancedLibrarySelect(shell);
    }
  });
}

function closeEnhancedLibrarySelect(shell) {
  shell.classList.remove("is-open");
  shell.querySelector("[data-select-trigger]")?.setAttribute("aria-expanded", "false");
}

function closeAdvancedFilterMenus() {
  document.querySelectorAll(".advanced-filter-menu[open]").forEach((menu) => {
    menu.open = false;
  });
}

function initLibraryAlphabetScrubber() {
  if (!libraryTrackList || !libraryPanel) {
    return;
  }

  const trigger = ensureLibraryAlphabetHoverZone();

  trigger.addEventListener("pointerenter", handleLibraryAlphabetTriggerPointer);
  trigger.addEventListener("pointermove", handleLibraryAlphabetTriggerPointer);
  trigger.addEventListener("pointerleave", scheduleLibraryAlphabetScrubberHide);
}

function handleLibraryAlphabetTriggerPointer(event) {
  if (libraryAlphabetScrubber?.classList.contains("is-visible")) {
    handleLibraryAlphabetPointer(event);
    return;
  }

  scheduleLibraryAlphabetScrubber();
}

function scheduleLibraryAlphabetScrubber() {
  if (getActiveView() !== "library" || libraryAlphabetScrubber?.classList.contains("is-visible")) {
    return;
  }

  clearTimeout(libraryAlphabetHoverTimer);
  libraryAlphabetHoverTimer = setTimeout(() => {
    showLibraryAlphabetScrubber();
  }, LIBRARY_ALPHABET_HOVER_DELAY_MS);
}

function scheduleLibraryAlphabetScrubberHide() {
  clearTimeout(libraryAlphabetHoverTimer);
  clearTimeout(libraryAlphabetHideTimer);
  libraryAlphabetHideTimer = setTimeout(() => {
    const isTriggerHovered = getLibraryAlphabetTrigger()?.matches(":hover");
    const isScrubberHovered = libraryAlphabetScrubber?.matches(":hover");

    if (!isTriggerHovered && !isScrubberHovered) {
      hideLibraryAlphabetScrubber();
    }
  }, LIBRARY_ALPHABET_HIDE_DELAY_MS);
}

function getLibraryAlphabetTrigger() {
  return libraryAlphabetHoverZone || libraryTrackList;
}

function syncLibraryAlphabetScrubber() {
  libraryAlphabetEntries = getLibraryAlphabetEntries();

  if (!state.filteredTracks.length) {
    hideLibraryAlphabetScrubber();
    return;
  }

  if (libraryAlphabetScrubber?.classList.contains("is-visible")) {
    renderLibraryAlphabetScrubber();
  }
}

function getLibraryAlphabetEntries() {
  const entriesByKey = new Map();

  state.filteredTracks.forEach((track) => {
    const key = getTrackAlphabetKey(track);
    if (!key || entriesByKey.has(key)) {
      return;
    }

    entriesByKey.set(key, { key, trackId: track.Id });
  });

  return LIBRARY_ALPHABET_KEYS
    .map((key) => entriesByKey.get(key))
    .filter(Boolean);
}

function getTrackAlphabetKey(track) {
  const rawText = String(
    track?.SortName
      || track?.NameSort
      || track?.SortTitle
      || track?.OriginalTitle
      || track?.Name
      || ""
  ).trim();
  const text = rawText.replace(/^[\s"'([{【（《]+/, "");

  if (!text) {
    return "#";
  }

  for (const character of text) {
    const key = getAlphabetKeyFromCharacter(character);
    if (key) {
      return key;
    }
  }

  return "#";
}

function getAlphabetKeyFromCharacter(character) {
  const normalized = character.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const latin = normalized.match(/[A-Za-z]/);

  if (latin) {
    return latin[0].toUpperCase();
  }

  if (/^[0-9]$/.test(character)) {
    return "#";
  }

  const kanaKey = getKanaAlphabetKey(character);
  if (kanaKey) {
    return kanaKey;
  }

  if (/[\u4e00-\u9fff]/.test(character)) {
    return getChinesePinyinAlphabetKey(character);
  }

  return "";
}

function getChinesePinyinAlphabetKey(character) {
  for (let index = CHINESE_PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
    const [key, boundary] = CHINESE_PINYIN_BOUNDARIES[index];
    if (chinesePinyinCollator.compare(character, boundary) >= 0) {
      return key;
    }
  }

  return "A";
}

function getKanaAlphabetKey(character) {
  const code = character.codePointAt(0);
  const kana = code >= 0x30a1 && code <= 0x30f6
    ? String.fromCodePoint(code - 0x60)
    : character;

  if ("ぁあぃいぅうぇえぉおゔ".includes(kana)) {
    return "A";
  }

  if ("かがきぎくぐけげこご".includes(kana)) {
    return "K";
  }

  if ("さざしじすずせぜそぞ".includes(kana)) {
    return "S";
  }

  if ("ただちぢっつづてでとど".includes(kana)) {
    return "T";
  }

  if ("なにぬねの".includes(kana)) {
    return "N";
  }

  if ("はばぱひびぴふぶぷへべぺほぼぽ".includes(kana)) {
    return "H";
  }

  if ("まみむめも".includes(kana)) {
    return "M";
  }

  if ("ゃやゅゆょよ".includes(kana)) {
    return "Y";
  }

  if ("らりるれろ".includes(kana)) {
    return "R";
  }

  if ("ゎわをん".includes(kana)) {
    return "W";
  }

  return "";
}

function ensureLibraryAlphabetScrubber() {
  if (libraryAlphabetScrubber) {
    return libraryAlphabetScrubber;
  }

  libraryAlphabetScrubber = document.createElement("div");
  libraryAlphabetScrubber.className = "library-alphabet-scrubber";
  libraryAlphabetScrubber.setAttribute("aria-hidden", "true");
  libraryAlphabetScrubber.addEventListener("pointerenter", () => {
    clearTimeout(libraryAlphabetHideTimer);
  });
  libraryAlphabetScrubber.addEventListener("pointerleave", scheduleLibraryAlphabetScrubberHide);
  libraryAlphabetScrubber.addEventListener("pointermove", handleLibraryAlphabetPointer);
  libraryAlphabetScrubber.addEventListener("click", handleLibraryAlphabetPointer);
  libraryPanel.append(libraryAlphabetScrubber);
  return libraryAlphabetScrubber;
}

function ensureLibraryAlphabetHoverZone() {
  if (libraryAlphabetHoverZone) {
    return libraryAlphabetHoverZone;
  }

  libraryAlphabetHoverZone = document.createElement("div");
  libraryAlphabetHoverZone.className = "library-alphabet-hover-zone";
  libraryAlphabetHoverZone.setAttribute("aria-hidden", "true");
  libraryPanel.append(libraryAlphabetHoverZone);
  return libraryAlphabetHoverZone;
}

function showLibraryAlphabetScrubber() {
  syncLibraryAlphabetScrubber();

  if (!state.filteredTracks.length || getActiveView() !== "library") {
    return;
  }

  const scrubber = ensureLibraryAlphabetScrubber();
  renderLibraryAlphabetScrubber();
  scrubber.classList.add("is-visible");
  scrubber.setAttribute("aria-hidden", "false");
}

function hideLibraryAlphabetScrubber() {
  clearTimeout(libraryAlphabetHoverTimer);
  libraryAlphabetActiveKey = "";

  if (!libraryAlphabetScrubber) {
    return;
  }

  libraryAlphabetScrubber.classList.remove("is-visible");
  libraryAlphabetScrubber.setAttribute("aria-hidden", "true");
}

function renderLibraryAlphabetScrubber() {
  const scrubber = ensureLibraryAlphabetScrubber();
  scrubber.replaceChildren();

  LIBRARY_ALPHABET_KEYS.forEach((key) => {
    const entry = libraryAlphabetEntries.find((item) => item.key === key);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "library-alphabet-letter";
    button.dataset.key = key;
    button.textContent = key;
    button.disabled = !entry;
    button.setAttribute("aria-label", entry ? `跳到 ${key}` : `${key} 暂无歌曲`);
    scrubber.append(button);
  });
}

function handleLibraryAlphabetPointer(event) {
  if (!libraryAlphabetScrubber || !libraryAlphabetEntries.length) {
    return;
  }

  const button = getLibraryAlphabetButtonFromPointer(event);

  if (!button || button.disabled) {
    return;
  }

  const entry = libraryAlphabetEntries.find((item) => item.key === button.dataset.key);

  if (!entry) {
    return;
  }

  activateLibraryAlphabetEntry(entry);
}

function getLibraryAlphabetButtonFromPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY);
  const targetButton = target instanceof Element
    ? target.closest(".library-alphabet-letter")
    : null;

  if (targetButton) {
    return targetButton;
  }

  const buttons = [...libraryAlphabetScrubber.querySelectorAll(".library-alphabet-letter")];
  return buttons.find((button) => {
    const rect = button.getBoundingClientRect();
    return event.clientY >= rect.top && event.clientY <= rect.bottom;
  }) || null;
}

function activateLibraryAlphabetEntry(entry) {
  if (libraryAlphabetActiveKey === entry.key) {
    return;
  }

  libraryAlphabetActiveKey = entry.key;
  libraryAlphabetScrubber?.querySelectorAll(".library-alphabet-letter").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === entry.key);
  });

  const targetRow = [...libraryTrackList.querySelectorAll(".track-row")]
    .find((row) => row.dataset.trackId === entry.trackId);

  if (!targetRow) {
    return;
  }

  targetRow.scrollIntoView({ block: "center", behavior: "smooth" });
  targetRow.classList.add("located");
  setTimeout(() => targetRow.classList.remove("located"), 700);
}

function getMusicViews() {
  return state.views.filter((view) => view.CollectionType === "music" && view.Id);
}

function resolveLibraryViewId(viewId) {
  if (!viewId) {
    return "";
  }

  return getMusicViews().some((view) => view.Id === viewId) ? viewId : "";
}

function getSelectedLibraryView() {
  return getMusicViews().find((view) => view.Id === state.libraryViewId) || null;
}

function getLibraryViewLabel() {
  return getSelectedLibraryView()?.Name || "全部音乐";
}

function getLibraryScopeParams() {
  return state.libraryViewId ? { ParentId: state.libraryViewId } : {};
}

function getTrackCollectionMeta(tracks, emptyText = "0 首歌曲") {
  const count = tracks.length;

  if (!count) {
    return emptyText;
  }

  const duration = getTrackCollectionDuration(tracks);
  return [
    `${formatCount(count)} 首歌曲`,
    duration,
  ].filter(Boolean).join(" · ");
}

function getFavoriteMetaText() {
  const count = getFilteredFavoriteCount();
  const duration = getTrackCollectionDuration(state.filteredFavoriteTracks);

  return [
    `${formatCount(count)} 个收藏`,
    duration ? `歌曲 ${duration}` : "",
  ].filter(Boolean).join(" · ");
}

function getRecentMetaText(tracks) {
  const duration = getTrackCollectionDuration(tracks);

  return [
    `${formatCount(tracks.length)} 首本地记录`,
    duration,
  ].filter(Boolean).join(" · ");
}

function getQueueMetaText() {
  if (!state.queue.length) {
    return "0 首歌曲";
  }

  const remainingText = getQueueRemainingMetaText();

  return [
    getTrackCollectionMeta(state.queue),
    remainingText,
  ].filter(Boolean).join(" · ");
}

function getQueueRemainingMetaText() {
  const remainingTracks = getQueueRemainingTracks();

  if (!state.currentTrack || !state.queue.length) {
    return "";
  }

  if (!remainingTracks.length) {
    return "剩余 0 首";
  }

  const duration = getTrackCollectionDuration(remainingTracks);

  return [
    `剩余 ${formatCount(remainingTracks.length)} 首`,
    duration,
  ].filter(Boolean).join(" / ");
}

function getQueueRemainingTracks() {
  if (!state.queue.length) {
    return [];
  }

  const currentIndex = state.currentTrackIndex >= 0
    ? state.currentTrackIndex
    : state.currentTrack
      ? state.queue.findIndex((track) => track.Id === state.currentTrack.Id)
      : -1;

  if (currentIndex < 0) {
    return state.queue;
  }

  return state.queue.slice(currentIndex + 1);
}

function locateCurrentQueueTrack() {
  if (!state.currentTrack?.Id || !state.queue.length) {
    setLibraryStatus("当前没有可定位的播放歌曲。");
    return;
  }

  if (state.isQuickQueueOpen) {
    const quickItem = quickQueueList.querySelector(`.quick-queue-item[data-track-id="${CSS.escape(state.currentTrack.Id)}"]`);

    if (quickItem) {
      revealLocatedQuickQueueItem(quickItem);
      return;
    }
  }

  const row = queueTrackList.querySelector(`.track-row[data-track-id="${CSS.escape(state.currentTrack.Id)}"]`);

  if (!row) {
    setLibraryStatus("当前歌曲不在播放队列列表中。");
    return;
  }

  revealLocatedTrackRow(row);
}

function revealLocatedQuickQueueItem(item) {
  item.scrollIntoView({ behavior: "smooth", block: "center" });
  item.classList.add("located");
  window.setTimeout(() => item.classList.remove("located"), 1200);
  setLibraryStatus("已在快捷队列定位当前歌曲。");
}

function locateCurrentTrack() {
  if (!state.currentTrack?.Id) {
    setLibraryStatus("当前没有可定位的播放歌曲。");
    return;
  }

  const activePanel = document.querySelector(".view-panel.active");
  const activeRow = getCurrentTrackRow(activePanel);

  if (activeRow) {
    revealLocatedTrackRow(activeRow, "已定位当前歌曲。");
    return;
  }

  if (state.filteredTracks.some((track) => track.Id === state.currentTrack.Id)) {
    switchView("library");
    locateCurrentTrackAfterSwitch("library", "已在音乐库定位当前歌曲。");
    return;
  }

  if (state.queue.some((track) => track.Id === state.currentTrack.Id)) {
    switchView("queue");
    locateCurrentTrackAfterSwitch("queue", "已在播放队列定位当前歌曲。");
    return;
  }

  setLibraryStatus("当前歌曲不在已加载列表或播放队列中。");
}

function locateCurrentTrackAfterSwitch(view, message) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const panel = viewPanels.find((item) => item.dataset.panel === view);
      const row = getCurrentTrackRow(panel);

      if (!row) {
        setLibraryStatus("当前页面没有找到这首歌。");
        return;
      }

      revealLocatedTrackRow(row, message);
    });
  });
}

function getCurrentTrackRow(container) {
  if (!container || !state.currentTrack?.Id) {
    return null;
  }

  return container.querySelector(`.track-row[data-track-id="${CSS.escape(state.currentTrack.Id)}"]`);
}

function revealLocatedTrackRow(row, message = "已定位播放队列中的当前歌曲。") {
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("located");
  window.setTimeout(() => row.classList.remove("located"), 1200);
  setLibraryStatus(message);
}

function renderHomeSections() {
  const homeRecentTracks = state.recentTracks.slice(0, 8);
  const homePlaylists = state.filteredPlaylists.slice(0, 6);
  const homeFavoriteAlbums = state.filteredFavoriteAlbums.slice(0, 6);

  renderHomeStartPanel();
  homeRecentSection.hidden = !homeRecentTracks.length;
  homePlaylistSection.hidden = !homePlaylists.length;
  homeFavoriteAlbumSection.hidden = !homeFavoriteAlbums.length;
  homeRecentPlayButton.disabled = !homeRecentTracks.length;
  homeRecentQueueButton.disabled = !homeRecentTracks.length;
  updateHomeRecentAddedActions();

  if (homeRecentTracks.length) {
    renderTrackList(homeRecentPlayedList, homeRecentTracks, {
      context: "home-preview",
      emptyText: "还没有最近播放记录。",
      hideHeader: true,
    });
  }

  if (homePlaylists.length) {
    renderPlaylistGrid(homePlaylistGrid, homePlaylists);
  }

  if (homeFavoriteAlbums.length) {
    renderAlbumGrid(homeFavoriteAlbumGrid, homeFavoriteAlbums);
  }
}

function getHomeRecentTracks() {
  return state.recentTracks.slice(0, 8);
}

function getHomeRecentAddedTracks() {
  return normalizeItems(state.filteredTracks.slice(0, 16)).filter(isAudioItem);
}

function updateHomeRecentAddedActions() {
  const hasTracks = getHomeRecentAddedTracks().length > 0;
  homeRecentAddPlayButton.disabled = !hasTracks;
  homeRecentAddQueueButton.disabled = !hasTracks;
}

function playHomeTrackCollection(tracks, label) {
  const collection = mergeUniqueItems([], normalizeItems(tracks).filter(isAudioItem));

  if (!collection.length) {
    setLibraryStatus(`没有可播放的${label}。`);
    return;
  }

  playTrack(collection[0], collection);
}

function playHomeRecentTracks() {
  playHomeTrackCollection(getHomeRecentTracks(), "继续收听");
}

function queueHomeRecentTracks() {
  queueTrackCollection(getHomeRecentTracks(), "继续收听");
}

function playHomeRecentAddedTracks() {
  playHomeTrackCollection(getHomeRecentAddedTracks(), "最近添加歌曲");
}

function queueHomeRecentAddedTracks() {
  queueTrackCollection(getHomeRecentAddedTracks(), "最近添加歌曲");
}

function renderHomeStartPanel() {
  if (
    !homeStartTitle
    || !homeStartMeta
    || !homeStartLibraryStat
    || !homeStartQueueStat
    || !homeStartQualityStat
    || !homeStartShuffleButton
    || !homeStartResumeButton
    || !homeStartImmersiveButton
  ) {
    console.warn("Smart playback hub markup is incomplete; skipping home start panel render.");
    return;
  }

  const playableTracks = state.filteredTracks.length ? state.filteredTracks : state.tracks;
  const currentTrack = state.currentTrack;
  const profile = getAudioQualityProfile();
  const nextTrack = getNextPreviewTrack();
  const isPlaying = Boolean(currentTrack && !audioPlayer.paused && !audioPlayer.ended);
  const nextTitle = nextTrack?.Name || (state.queue.length ? "已到队尾" : "暂无待播");

  renderHomeStartArtwork(currentTrack);
  renderHomeStartProgress();
  renderHomeStartNext(nextTitle);
  homeStartTitle.textContent = currentTrack?.Name || "准备播放你的音乐库";
  homeStartMeta.textContent = currentTrack
    ? [
        isPlaying ? "正在播放" : "已暂停",
        getArtists(currentTrack) || "未知艺人",
        currentTrack.Album,
      ].filter(Boolean).join(" • ")
    : (playableTracks.length ? "随机播放、继续队列或进入沉浸播放。" : "还没有可播放歌曲，请先刷新音乐库。");
  homeStartLibraryStat.textContent = `${formatCount(playableTracks.length)} 首可播放`;
  homeStartQueueStat.textContent = state.queue.length ? `${formatCount(state.queue.length)} 首队列` : "队列为空";
  const currentQuality = getTrackQualitySummary(currentTrack);
  const externalCurrentQuality = currentTrack && isExternalSourceTrack(currentTrack) ? currentQuality : null;
  homeStartQualityStat.textContent = externalCurrentQuality?.shortLabel || getAudioQualityButtonLabel(profile);
  homeStartQualityStat.title = externalCurrentQuality?.detailLabel || `${profile.label} · ${profile.codec} · ${profile.bitrateLabel || "原码率"}`;
  homeStartQualityStat.parentElement?.setAttribute("data-quality-tone", externalCurrentQuality?.qualityTier || getHomeStartQualityTone(profile));
  homeStartShuffleButton.disabled = !playableTracks.length;
  if (homeStartQueueButton) {
    homeStartQueueButton.disabled = !state.queue.length;
  }
  if (homeStartArtButton) {
    homeStartArtButton.disabled = !state.currentTrack;
    homeStartArtButton.setAttribute(
      "aria-label",
      state.currentTrack
        ? `打开沉浸播放：${state.currentTrack.Name || "当前歌曲"}`
        : "暂无当前播放"
    );
    homeStartArtButton.title = state.currentTrack ? "打开沉浸播放" : "选择歌曲后可打开沉浸播放";
  }
  homeStartResumeButton.disabled = !currentTrack && !playableTracks.length;
  homeStartResumeButton.classList.toggle("playing", isPlaying);
  homeStartResumeButton.setAttribute("aria-label", isPlaying ? "暂停播放" : "播放");
  homeStartResumeButton.title = isPlaying ? "暂停播放" : "播放";
  homeStartImmersiveButton.disabled = !state.currentTrack;
  if (homeStartFavoriteButton) {
    renderPlaybackFavoriteButton(homeStartFavoriteButton, currentTrack);
  }
  if (homeStartMoreButton) {
    homeStartMoreButton.disabled = !currentTrack;
  }
  const resumeLabel = homeStartResumeButton.querySelector("span") || homeStartResumeButton;
  resumeLabel.textContent = isPlaying ? "暂停播放" : "播放";
}

function getHomeStartQualityTone(profile = getAudioQualityProfile()) {
  const codec = String(profile.codec || profile.audioCodec || "").toLowerCase();
  const bitrate = Number(profile.bitrate) || 0;

  if (profile.mode === "direct" || profile.directStream || codec.includes("flac") || codec.includes("wav") || codec.includes("pcm")) {
    return "lossless";
  }

  if (codec.includes("mp3")) {
    return "mp3";
  }

  if (codec.includes("opus")) {
    return "opus";
  }

  if (codec.includes("aac")) {
    return bitrate >= 320000 ? "aac-high" : "aac";
  }

  return "standard";
}

function renderHomeStartArtwork(track) {
  if (!homeStartCover) {
    return;
  }

  homeStartCover.replaceChildren();
  homeStartCover.className = `home-start-cover ${coverClass(state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0)}`;

  if (track) {
    appendImage(homeStartCover, getTrackImageUrl(track, 240), track.Name);
  }
}

function formatHomeStartTimelineTime(seconds) {
  const value = formatSeconds(seconds || 0);
  return /^\d:\d{2}$/.test(value) ? `0${value}` : value;
}

function renderHomeStartProgress(current = getAudioCurrentTimeSeconds(), duration = getAudioDurationSeconds()) {
  const displayDuration = duration || getTrackDurationSeconds(state.currentTrack);
  const percent = displayDuration ? Math.min((current / displayDuration) * 100, 100) : 0;
  const currentLabel = state.currentTrack ? formatHomeStartTimelineTime(current) : "00:00";
  const durationLabel = state.currentTrack ? formatHomeStartTimelineTime(displayDuration) : "00:00";
  const width = `${percent}%`;
  const signature = [
    state.currentTrack?.Id || "",
    currentLabel,
    durationLabel,
    width,
  ].join("|");

  if (signature === homeStartProgressSignature) {
    return;
  }

  homeStartProgressSignature = signature;

  if (homeStartProgressText) {
    setTextIfChanged(homeStartProgressText, currentLabel);
  }

  if (homeStartTimeText) {
    setTextIfChanged(homeStartTimeText, durationLabel);
  }

  if (homeStartProgressFill) {
    setStylePropertyIfChanged(homeStartProgressFill, "width", width);
  }
}

function renderHomeStartNext(title) {
  if (!homeStartNextTitle || !homeStartNext) {
    return;
  }

  homeStartNextTitle.textContent = title;
  homeStartNextTitle.dataset.text = title;
  homeStartNext.classList.toggle("is-marquee", title.length > 16);
}

function formatQueueSavedAt(value) {
  const timestamp = Date.parse(value || "");

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return "刚刚保存";
  }

  if (elapsedSeconds < 3600) {
    return `${Math.floor(elapsedSeconds / 60)} 分钟前保存`;
  }

  if (elapsedSeconds < 86400) {
    return `${Math.floor(elapsedSeconds / 3600)} 小时前保存`;
  }

  return `${Math.floor(elapsedSeconds / 86400)} 天前保存`;
}

function resumeSavedQueuePlayback() {
  if (!state.currentTrack || !state.queue.length) {
    setLibraryStatus("没有可恢复的播放队列。");
    return;
  }

  playTrack(state.currentTrack, state.queue, {
    positionSeconds: state.savedPlaybackPositionSeconds,
  });
}

function renderGenreOptions() {
  const selectedGenre = state.genreFilter;
  const genres = state.availableGenres;

  genreSelect.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "全部";
  genreSelect.append(defaultOption);

  genres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreSelect.append(option);
  });

  if (selectedGenre && !genres.includes(selectedGenre)) {
    genreSelect.append(new Option(`已保存：${selectedGenre}`, selectedGenre));
  }

  genreSelect.value = selectedGenre;
  genreSelect.disabled = (!genres.length && !selectedGenre) || !state.isLibraryLoaded;
}

function renderYearOptions() {
  const selectedYear = Number(state.yearFilter);
  const years = state.availableYears;

  yearSelect.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "全部";
  yearSelect.append(defaultOption);

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.append(option);
  });

  if (state.yearFilter && !years.includes(selectedYear)) {
    yearSelect.append(new Option(`已保存：${state.yearFilter}`, state.yearFilter));
  }

  yearSelect.value = state.yearFilter;
  yearSelect.disabled = (!years.length && !state.yearFilter) || !state.isLibraryLoaded;
}

function renderQualityOptions() {
  const selectedQuality = state.qualityFilter;
  const qualities = state.availableQualities;

  qualitySelect.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "全部";
  qualitySelect.append(defaultOption);

  qualities.forEach((quality) => {
    const option = document.createElement("option");
    option.value = quality;
    option.textContent = QUALITY_FILTER_LABELS[quality] || quality;
    qualitySelect.append(option);
  });

  if (selectedQuality && !qualities.includes(selectedQuality)) {
    qualitySelect.append(new Option(`已保存：${QUALITY_FILTER_LABELS[selectedQuality] || selectedQuality}`, selectedQuality));
  }

  qualitySelect.value = selectedQuality;
  qualitySelect.disabled = (!qualities.length && !selectedQuality) || !state.isLibraryLoaded;
}

function renderLoadingShell() {
  renderHomeStartPanel();
  homeRecentSection.hidden = !state.recentTracks.length;
  homePlaylistSection.hidden = false;
  homeFavoriteAlbumSection.hidden = false;
  homeRecentPlayButton.disabled = true;
  homeRecentQueueButton.disabled = true;
  homeRecentAddPlayButton.disabled = true;
  homeRecentAddQueueButton.disabled = true;
  homeRecentPlayedList.innerHTML = state.recentTracks.length
    ? homeTrackSkeletonMarkup("正在加载最近播放...")
    : "";
  homePlaylistGrid.innerHTML = loadingMarkup("正在加载歌单...");
  homeFavoriteAlbumGrid.innerHTML = loadingMarkup("正在加载收藏专辑...");
  allAlbumGrid.innerHTML = loadingMarkup("正在加载专辑...");
  playlistGrid.innerHTML = loadingMarkup("正在加载歌单...");
  favoritePlaylistGrid.innerHTML = loadingMarkup("正在加载收藏歌单...");
  favoriteAlbumGrid.innerHTML = loadingMarkup("正在加载收藏专辑...");
  favoriteArtistGrid.innerHTML = loadingMarkup("正在加载收藏艺人...");
  recentTrackList.innerHTML = homeTrackSkeletonMarkup("正在加载歌曲...");
  libraryTrackList.innerHTML = loadingMarkup("正在加载歌曲...");
  artistGrid.innerHTML = loadingMarkup("正在加载艺人...");
  favoriteTrackList.innerHTML = loadingMarkup("正在加载收藏...");
  renderRecent();
  queueTrackList.innerHTML = emptyMarkup("播放队列为空。");
  loadMoreTracksButton.hidden = true;
  loadMoreAlbumsButton.hidden = true;
  loadMoreArtistsButton.hidden = true;
  loadMoreFavoritesButton.hidden = true;
  loadMorePlaylistsButton.hidden = true;
}

function renderLibraryError(text) {
  const message = `无法读取音乐库：${text}`;
  renderHomeStartPanel();
  homeRecentSection.hidden = false;
  homePlaylistSection.hidden = false;
  homeFavoriteAlbumSection.hidden = false;
  homeRecentPlayButton.disabled = true;
  homeRecentQueueButton.disabled = true;
  homeRecentAddPlayButton.disabled = true;
  homeRecentAddQueueButton.disabled = true;
  homeRecentPlayedList.innerHTML = emptyMarkup(message);
  homePlaylistGrid.innerHTML = emptyMarkup(message);
  homeFavoriteAlbumGrid.innerHTML = emptyMarkup(message);
  allAlbumGrid.innerHTML = emptyMarkup(message);
  playlistGrid.innerHTML = emptyMarkup(message);
  favoritePlaylistGrid.innerHTML = emptyMarkup(message);
  favoriteAlbumGrid.innerHTML = emptyMarkup(message);
  favoriteArtistGrid.innerHTML = emptyMarkup(message);
  recentTrackList.innerHTML = emptyMarkup(message);
  libraryTrackList.innerHTML = emptyMarkup(message);
  favoriteTrackList.innerHTML = emptyMarkup(message);
  artistGrid.innerHTML = emptyMarkup(message);
}

function renderAlbumGrid(container, albums, options = {}) {
  container.replaceChildren();

  if (!albums.length) {
    const hasSearchEmpty = state.query || hasActiveTrackFilter();
    container.append(createEmptyState(state.query
      ? (options.searchEmptyText || "没有匹配的专辑。")
      : (options.emptyText || "没有读取到专辑。"), getLibraryEmptyActions({ includeFilters: hasSearchEmpty })));
    return;
  }

  albums.forEach((album, index) => {
    const card = document.createElement("article");
    card.className = "album-card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "collection-card-button";
    button.title = album.Name || "未命名专辑";
    button.addEventListener("click", () => {
      openAlbumDetail(album);
    });

    const cover = document.createElement("span");
    cover.className = `album-cover ${coverClass(index)}`;
    appendImage(cover, getImageUrl(album, 480), album.Name);

    const title = document.createElement("strong");
    title.textContent = album.Name || "未命名专辑";

    const subtitle = document.createElement("span");
    subtitle.textContent = getAlbumSubtitle(album);

    button.append(cover, title, subtitle, createCollectionMetaChips(getAlbumMetaChips(album)));
    card.append(button, createCollectionQuickActions([
      {
        icon: "play",
        label: `播放专辑 ${album.Name || "未命名专辑"}`,
        handler: () => playAlbumFromCard(album),
      },
      {
        icon: "queueAdd",
        label: `加入队列 ${album.Name || "未命名专辑"}`,
        handler: () => queueAlbumFromCard(album),
      },
    ]), createFavoriteButton(album, "collection-favorite-button"));
    container.append(card);
  });
}

function renderPlaylistGrid(container, playlists, options = {}) {
  container.replaceChildren();

  if (!playlists.length) {
    const hasSearchEmpty = state.query || hasActiveTrackFilter();
    container.append(createEmptyState(state.query
      ? (options.searchEmptyText || "没有匹配的歌单。")
      : (options.emptyText || "没有读取到 Emby 歌单。"), getLibraryEmptyActions({ includeFilters: hasSearchEmpty })));
    return;
  }

  playlists.forEach((playlist, index) => {
    const card = document.createElement("article");
    card.className = "playlist-card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "collection-card-button";
    button.title = playlist.Name || "未命名歌单";
    button.addEventListener("click", () => {
      openPlaylistDetail(playlist);
    });

    const cover = document.createElement("span");
    cover.className = `playlist-cover ${coverClass(index)}`;
    appendImage(cover, getImageUrl(playlist, 480), playlist.Name);

    const title = document.createElement("strong");
    title.textContent = playlist.Name || "未命名歌单";

    const subtitle = document.createElement("span");
    subtitle.textContent = getPlaylistSubtitle(playlist);

    button.append(cover, title, subtitle, createCollectionMetaChips(getPlaylistMetaChips(playlist)));
    card.append(button, createCollectionQuickActions([
      {
        icon: "play",
        label: `播放歌单 ${playlist.Name || "未命名歌单"}`,
        handler: () => playPlaylistFromCard(playlist),
      },
      {
        icon: "queueAdd",
        label: `加入队列 ${playlist.Name || "未命名歌单"}`,
        handler: () => queuePlaylistFromCard(playlist),
      },
    ]), createFavoriteButton(playlist, "collection-favorite-button"));
    container.append(card);
  });
}

function createCollectionMetaChips(items) {
  const chips = document.createElement("span");
  chips.className = "collection-meta-chips";

  items.filter(Boolean).slice(0, 3).forEach((item) => {
    const chip = document.createElement("em");
    chip.className = item.tone ? `collection-meta-chip ${item.tone}` : "collection-meta-chip";
    chip.textContent = item.label;
    chips.append(chip);
  });

  return chips;
}

function getAlbumMetaChips(album) {
  return [
    getProductionYear(album) ? { label: String(getProductionYear(album)), tone: "year" } : null,
    getAlbumQualityBucket(album) === "lossless" ? { label: "无损", tone: "quality" } : null,
    isFavorite(album) ? { label: "已收藏", tone: "favorite" } : null,
  ];
}

function getPlaylistMetaChips(playlist) {
  const count = Number(playlist.ChildCount || playlist.SongCount || playlist.ItemCount || 0);

  return [
    count ? { label: `${formatCount(count)} 首`, tone: "count" } : null,
    isFavorite(playlist) ? { label: "已收藏", tone: "favorite" } : null,
  ];
}

function getArtistMetaChips(artist) {
  const localTracks = getLocalArtistTracks(artist);
  const albumCount = getLocalArtistAlbums(artist).length;

  return [
    localTracks.length ? { label: `${formatCount(localTracks.length)} 首`, tone: "count" } : null,
    albumCount ? { label: `${formatCount(albumCount)} 专辑`, tone: "year" } : null,
    isFavorite(artist) ? { label: "已收藏", tone: "favorite" } : null,
  ];
}

function createCollectionQuickActions(actions) {
  const wrap = document.createElement("div");
  wrap.className = "collection-quick-actions";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `collection-quick-button collection-quick-${action.icon}`;
    button.title = action.label;
    button.setAttribute("aria-label", action.label);
    button.append(createActionIcon(action.icon));
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) {
        return;
      }

      await runCollectionQuickAction(button, action.handler);
    });
    wrap.append(button);
  });

  return wrap;
}

async function runCollectionQuickAction(button, handler) {
  const actions = button.closest(".collection-quick-actions");
  const buttons = actions ? [...actions.querySelectorAll("button")] : [button];
  const originalLabel = button.getAttribute("aria-label") || "";

  buttons.forEach((item) => {
    item.disabled = true;
  });
  button.classList.add("loading");
  button.setAttribute("aria-label", "正在加载歌曲");

  try {
    await handler();
  } catch (error) {
    setLibraryStatus(`快捷操作失败：${readableError(error)}`);
  } finally {
    button.classList.remove("loading");
    button.setAttribute("aria-label", originalLabel);
    buttons.forEach((item) => {
      item.disabled = false;
    });
  }
}

function getTrackIndexLabel(track, fallbackIndex, options = {}) {
  if (options.indexMode === "track") {
    const trackNumber = Number(track?.IndexNumber);
    const discNumber = Number(track?.ParentIndexNumber);
    const hasTrackNumber = Number.isInteger(trackNumber) && trackNumber > 0;
    const hasDiscNumber = Number.isInteger(discNumber) && discNumber > 0;

    if (hasTrackNumber && hasDiscNumber && discNumber > 1) {
      return `${discNumber}-${String(trackNumber).padStart(2, "0")}`;
    }

    if (hasTrackNumber) {
      return String(trackNumber).padStart(2, "0");
    }
  }

  return String(fallbackIndex + 1).padStart(2, "0");
}

function createTrackListHeader(context, options = {}) {
  const header = document.createElement("div");
  header.className = "track-list-header";
  header.setAttribute("aria-hidden", "true");

  const labels = [
    { className: "track-list-index-label", text: options.indexMode === "track" ? "曲序" : "#" },
    { className: "track-list-title-label", text: "歌曲" },
    { className: "track-list-artist-label", text: "艺人" },
    { className: "track-list-album-label", text: "专辑" },
    { className: "track-list-duration-label", text: "时长" },
    { className: "track-list-actions-label", text: context === "queue" ? "队列操作" : "操作" },
  ];

  labels.forEach(({ className, text }) => {
    const label = document.createElement("span");
    label.className = className;
    label.textContent = text;
    header.append(label);
  });

  return header;
}

function renderTrackList(container, tracks, options = {}) {
  container.replaceChildren();
  const context = options.context || "library";
  const playQueue = options.playQueue || tracks;
  const useUnifiedRows = options.unified !== false;
  container.classList.toggle("unified-track-list", useUnifiedRows);

  if (!tracks.length) {
    const emptyText = options.emptyText || (hasActiveTrackFilter() ? "没有匹配的歌曲。" : "没有读取到歌曲。");
    container.append(createEmptyState(emptyText, getTrackListEmptyActions(context)));
    return;
  }

  if (!useUnifiedRows && !options.hideHeader) {
    container.append(createTrackListHeader(context, options));
  }

  tracks.forEach((track, index) => {
    if (useUnifiedRows) {
      const row = createHomeTrackRow(track, index, tracks, playQueue, { ...options, context });
      applyTrackRowContext(row, track, index, tracks, context);
      container.append(row);
      return;
    }

    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.trackId = track.Id;
    row.dataset.trackIndex = String(index);
    row.addEventListener("pointermove", updateHomeTrackRippleOrigin);
    row.addEventListener("pointerenter", updateHomeTrackRippleOrigin);

    if (context === "queue") {
      row.classList.add("queue-track-row");
      row.draggable = tracks.length > 1;
      row.addEventListener("dragstart", (event) => handleQueueDragStart(event, index));
      row.addEventListener("dragover", (event) => handleQueueDragOver(event, index));
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (event) => handleQueueDrop(event, index));
      row.addEventListener("dragend", clearQueueDragState);
    } else if (context === "playlist") {
      row.classList.add("library-track-row", "playlist-track-row");
      row.draggable = canMoveTrackInSelectedPlaylist(track, tracks);
      row.addEventListener("dragstart", (event) => handlePlaylistDragStart(event, index, tracks));
      row.addEventListener("dragover", (event) => handlePlaylistDragOver(event, index));
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (event) => handlePlaylistDrop(event, index));
      row.addEventListener("dragend", clearPlaylistDragState);
    } else {
      row.classList.add("library-track-row");
    }

    const playArea = document.createElement("div");
    playArea.className = "track-play-area";
    playArea.tabIndex = 0;
    playArea.setAttribute("role", "button");
    playArea.setAttribute("aria-label", `播放 ${track.Name || "歌曲"}`);
    playArea.addEventListener("click", () => playTrack(track, playQueue));
    playArea.addEventListener("keydown", (event) => {
      if (event.target !== playArea) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        playTrack(track, playQueue);
      }
    });

    const number = document.createElement("span");
    number.className = "track-index";
    number.dataset.indexLabel = getTrackIndexLabel(track, index, options);
    number.textContent = number.dataset.indexLabel;

    const main = document.createElement("span");
    main.className = "track-main";

    const cover = document.createElement("span");
    cover.className = `track-cover ${coverClass(index)}`;
    appendImage(cover, getTrackImageUrl(track, 160), track.Name);
    const playCue = document.createElement("span");
    playCue.className = "track-cover-cue";
    playCue.setAttribute("aria-hidden", "true");
    playCue.append(createActionIcon("play"));
    cover.append(playCue);

    const titleBlock = document.createElement("span");
    titleBlock.className = "track-title-block";

    const title = document.createElement("span");
    title.className = "track-title";
    title.textContent = track.Name || "未命名歌曲";

    const subtitle = document.createElement("span");
    subtitle.className = "track-subtitle-wrap";
    subtitle.append(createTrackArtistButton(track, getArtists(track) || "未知艺人"));
    const qualityBadge = createTrackQualityBadge(track);
    if (qualityBadge) {
      subtitle.append(qualityBadge);
    }

    titleBlock.append(title, subtitle);
    main.append(cover, titleBlock);

    const artist = createTrackArtistButton(track, getArtists(track) || "-");
    artist.classList.add("track-artist");

    const album = createTrackAlbumButton(track, track.Album || "-");
    album.classList.add("track-album");

    const duration = document.createElement("span");
    duration.className = "track-duration";
    duration.textContent = formatTicks(track.RunTimeTicks);

    const favoriteButton = createFavoriteButton(track);

    const actions = document.createElement("span");
    actions.className = "track-actions";
    const actionItems = getTrackActionItems(track, index, context, tracks);
    const visibleActionItems = actionItems.filter((item) => !item.isSheetOnly);
    const actionButtons = visibleActionItems.map((item) => createTrackActionButton(item.icon, item.label, item.handler, item.disabled));
    const dragButton = actionButtons.find((button, itemIndex) => visibleActionItems[itemIndex].isDragHandle);
    const moreButton = createTrackActionButton("more", "更多操作", () => openTrackActionSheet(track, actionItems));
    bindTrackRowActionGestures(row, track, actionItems);

    if (dragButton) {
      dragButton.classList.add("drag-handle-button");
    }

    moreButton.classList.add("track-more-button");
    actions.append(favoriteButton, ...actionButtons, moreButton);

    playArea.append(number, main, artist, album, duration);
    row.append(playArea, actions);
    container.append(row);
  });
}

function applyTrackRowContext(row, track, index, tracks, context) {
  if (context === "queue") {
    row.classList.add("queue-track-row");
    row.draggable = tracks.length > 1;
    row.addEventListener("dragstart", (event) => handleQueueDragStart(event, index));
    row.addEventListener("dragover", (event) => handleQueueDragOver(event, index));
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (event) => handleQueueDrop(event, index));
    row.addEventListener("dragend", clearQueueDragState);
    return;
  }

  if (context === "playlist") {
    row.classList.add("library-track-row", "playlist-track-row");
    row.draggable = canMoveTrackInSelectedPlaylist(track, tracks);
    row.addEventListener("dragstart", (event) => handlePlaylistDragStart(event, index, tracks));
    row.addEventListener("dragover", (event) => handlePlaylistDragOver(event, index));
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (event) => handlePlaylistDrop(event, index));
    row.addEventListener("dragend", clearPlaylistDragState);
    return;
  }

  row.classList.add("library-track-row");
}

function createHomeTrackRow(track, index, tracks, playQueue, options = {}) {
  const row = document.createElement("div");
  row.className = "track-row home-track-row";
  row.dataset.trackId = track.Id;
  row.dataset.trackIndex = String(index);
  row.addEventListener("pointermove", updateHomeTrackRippleOrigin);
  row.addEventListener("pointerenter", updateHomeTrackRippleOrigin);

  const playArea = document.createElement("div");
  playArea.className = "track-play-area home-track-play-area";
  playArea.tabIndex = 0;
  playArea.setAttribute("role", "button");
  playArea.setAttribute("aria-label", `播放 ${track.Name || "歌曲"}`);
  playArea.addEventListener("click", () => playTrack(track, playQueue));
  playArea.addEventListener("keydown", (event) => {
    if (event.target !== playArea) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      playTrack(track, playQueue);
    }
  });

  const indicator = document.createElement("span");
  indicator.className = "home-track-indicator";
  indicator.dataset.indexLabel = getTrackIndexLabel(track, index, options);

  const indexLabel = document.createElement("span");
  indexLabel.className = "home-track-index";
  indexLabel.textContent = indicator.dataset.indexLabel;

  const equalizer = document.createElement("span");
  equalizer.className = "home-track-equalizer";
  equalizer.setAttribute("aria-hidden", "true");
  for (let barIndex = 0; barIndex < 4; barIndex += 1) {
    equalizer.append(document.createElement("span"));
  }
  indicator.append(indexLabel, equalizer);

  const cover = document.createElement("span");
  cover.className = `track-cover home-track-cover ${coverClass(index)}`;
  appendImage(cover, getTrackImageUrl(track, 160), track.Name);

  const titleBlock = document.createElement("span");
  titleBlock.className = "track-title-block home-track-copy";

  const title = document.createElement("span");
  title.className = "track-title home-track-title";
  title.textContent = track.Name || "未命名歌曲";

  const meta = document.createElement("span");
  meta.className = "home-track-meta";
  const artist = createTrackArtistButton(track, getArtists(track) || "未知艺人");
  artist.classList.add("home-track-artist");
  meta.append(artist);

  if (track.Album) {
    const separator = document.createElement("span");
    separator.className = "home-track-separator";
    separator.textContent = "/";
    const album = createTrackAlbumButton(track, track.Album);
    album.classList.add("home-track-album");
    meta.append(separator, album);
  }

  titleBlock.append(title, meta);
  playArea.append(indicator, cover, titleBlock);

  const duration = document.createElement("span");
  duration.className = "track-duration home-track-duration";
  duration.textContent = formatTicks(track.RunTimeTicks);

  const qualityBadge = createTrackQualityBadge(track);
  if (qualityBadge) {
    meta.append(qualityBadge);
  }

  const favoriteButton = createFavoriteButton(track, "home-track-favorite-button");
  const actionContext = options.context || "home-preview";
  const actionItems = getTrackActionItems(track, index, actionContext, tracks);
  const primaryActionItem = getUnifiedTrackPrimaryAction(actionItems);
  const moreButton = createTrackActionButton("more", "更多操作", () => openTrackActionSheet(track, actionItems));
  moreButton.classList.add("track-more-button", "home-track-more-button");

  const actions = document.createElement("span");
  actions.className = "track-actions home-track-actions";
  actions.append(duration, favoriteButton);

  if (primaryActionItem) {
    const primaryButton = createTrackActionButton(
      primaryActionItem.icon,
      primaryActionItem.label,
      primaryActionItem.handler,
      Boolean(primaryActionItem.disabled),
    );
    primaryButton.classList.add("home-track-primary-action-button");
    if (primaryActionItem.icon === "playNext") {
      primaryButton.classList.add("home-track-play-next-button");
    }
    if (primaryActionItem.isDragHandle) {
      primaryButton.classList.add("drag-handle-button");
    }
    actions.append(primaryButton);
  }

  actions.append(moreButton);
  bindTrackRowActionGestures(row, track, actionItems);

  row.append(playArea, actions);
  return row;
}

function getUnifiedTrackPrimaryAction(actionItems) {
  return actionItems.find((item) => item.icon === "playNext")
    || actionItems.find((item) => item.isDragHandle)
    || actionItems.find((item) => !item.isSheetOnly && item.handler && item.tone !== "danger")
    || null;
}

function updateHomeTrackRippleOrigin(event) {
  const row = event.currentTarget;
  const rect = row.getBoundingClientRect();
  const x = `${Math.round(event.clientX - rect.left)}px`;
  const y = `${Math.round(event.clientY - rect.top)}px`;

  row.style.setProperty("--ripple-x", x);
  row.style.setProperty("--ripple-y", y);
}

function getLibraryEmptyActions(options = {}) {
  const actions = [];
  const includeFilters = options.includeFilters !== false;

  if (includeFilters && hasActiveTrackFilter()) {
    actions.push({
      label: "清除筛选",
      handler: clearSearchAndFilters,
    });
  }

  if (state.session) {
    actions.push({
      label: "刷新音乐库",
      handler: refreshLibrary,
    });
  }

  return actions;
}

function getTrackListEmptyActions(context) {
  if (context === "queue") {
    const actions = [];

    if (state.filteredTracks.length || state.tracks.length) {
      actions.push({
        label: "随机播放",
        handler: shufflePlay,
      });
    }

    actions.push({
      label: "打开音乐库",
      handler: () => switchView("library"),
    });
    return actions;
  }

  return getLibraryEmptyActions();
}

function getTrackActionItems(track, index, context, tracks) {
  const sheetOnlyItems = getTrackSheetOnlyActions(track, tracks);

  if (context === "queue") {
    return [
      ...sheetOnlyItems,
      {
        icon: "playlist",
        label: "添加到歌单",
        handler: () => openPlaylistPicker(track),
        disabled: !state.playlists.length,
      },
      {
        icon: "drag",
        label: "拖拽排序",
        handler: null,
        disabled: tracks.length < 2,
        isDragHandle: true,
      },
      {
        icon: "moveUp",
        label: "上移",
        handler: () => moveQueueTrack(index, -1),
        disabled: index === 0,
      },
      {
        icon: "moveDown",
        label: "下移",
        handler: () => moveQueueTrack(index, 1),
        disabled: index >= tracks.length - 1,
      },
      {
        icon: "trash",
        label: "从队列移除",
        handler: () => removeQueueTrack(index),
        tone: "danger",
      },
    ];
  }

  const items = [
    ...sheetOnlyItems,
    {
      icon: "playNext",
      label: "下一首播放",
      handler: () => addTrackToPlayNext(track),
    },
    {
      icon: "queueAdd",
      label: "添加到队列",
      handler: () => addTrackToQueue(track),
    },
    {
      icon: "playlist",
      label: "添加到歌单",
      handler: () => openPlaylistPicker(track),
      disabled: isExternalSourceSession() || !state.playlists.length,
    },
  ];

  if (context === "playlist") {
    const canMove = canMoveTrackInSelectedPlaylist(track, tracks);
    items.push(
      {
        icon: "drag",
        label: "拖拽调整歌单顺序",
        handler: null,
        disabled: !canMove,
        isDragHandle: true,
      },
      {
        icon: "moveUp",
        label: "在歌单中上移",
        handler: () => moveSelectedPlaylistTrack(index, -1),
        disabled: !canMove || index === 0,
      },
      {
        icon: "moveDown",
        label: "在歌单中下移",
        handler: () => moveSelectedPlaylistTrack(index, 1),
        disabled: !canMove || index >= tracks.length - 1,
      },
      {
        icon: "trash",
        label: "从歌单移除",
        handler: () => removeTrackFromSelectedPlaylist(track),
        disabled: !canRemoveTrackFromSelectedPlaylist(track),
        tone: "danger",
      },
    );
  }

  return items;
}

function getTrackSheetOnlyActions(track, tracks) {
  return [
    {
      icon: "play",
      label: "播放这首",
      handler: () => playTrack(track, tracks?.length ? tracks : [track]),
      isSheetOnly: true,
    },
    {
      icon: "artist",
      label: "查看艺人",
      handler: () => openTrackArtist(track),
      disabled: !getPrimaryTrackArtist(track),
      isSheetOnly: true,
    },
    {
      icon: "album",
      label: "查看专辑",
      handler: () => openTrackAlbum(track),
      disabled: !track.AlbumId && !track.Album,
      isSheetOnly: true,
    },
  ];
}

function bindTrackRowActionGestures(row, track, actionItems) {
  let longPressTimer = 0;
  let longPressPointerId = null;
  let longPressStartX = 0;
  let longPressStartY = 0;
  let didOpenLongPress = false;

  const clearLongPress = () => {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
    }

    longPressTimer = 0;
    longPressPointerId = null;
    row.classList.remove("long-pressing");
  };

  const openActions = (event, source) => {
    event?.preventDefault();
    event?.stopPropagation();
    clearLongPress();
    didOpenLongPress = source === "longpress";
    openTrackActionSheet(track, actionItems, {
      title: source === "contextmenu" ? "歌曲快捷操作" : "歌曲操作",
    });
  };

  row.addEventListener("contextmenu", (event) => {
    if (shouldIgnoreTrackActionGesture(event.target)) {
      return;
    }

    openActions(event, "contextmenu");
  });

  row.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.button !== 0 || shouldIgnoreTrackActionGesture(event.target)) {
      return;
    }

    clearLongPress();
    didOpenLongPress = false;
    longPressPointerId = event.pointerId;
    longPressStartX = event.clientX;
    longPressStartY = event.clientY;
    row.classList.add("long-pressing");
    longPressTimer = window.setTimeout(() => {
      openActions(null, "longpress");
    }, 520);
  });

  row.addEventListener("pointermove", (event) => {
    if (event.pointerId !== longPressPointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - longPressStartX, event.clientY - longPressStartY);

    if (distance > 10) {
      clearLongPress();
    }
  });

  row.addEventListener("pointerup", clearLongPress);
  row.addEventListener("pointercancel", clearLongPress);
  row.addEventListener("pointerleave", clearLongPress);
  row.addEventListener("click", (event) => {
    if (!didOpenLongPress) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    didOpenLongPress = false;
  }, true);
}

function shouldIgnoreTrackActionGesture(target) {
  return Boolean(target instanceof Element && target.closest("button, a, input, select, textarea, .track-action-button, .favorite-button"));
}

function createTrackActionButton(icon, label, onClick, isDisabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "track-action-button";
  button.append(createActionIcon(icon));
  button.title = label;
  button.disabled = isDisabled;
  button.setAttribute("aria-label", label);
  if (onClick) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
  }
  return button;
}

function createActionIcon(icon) {
  const iconName = ACTION_ICON_PATHS[icon] ? icon : "";
  const wrapper = document.createElement("span");
  wrapper.className = "action-icon-wrap";

  if (!iconName) {
    wrapper.textContent = icon || "";
    return wrapper;
  }

  wrapper.innerHTML = `<svg class="line-icon action-icon-${iconName}" viewBox="0 0 24 24" aria-hidden="true">${ACTION_ICON_PATHS[iconName]}</svg>`;
  return wrapper;
}

function openTrackActionSheet(track, items, options = {}) {
  state.trackActionSheetReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const enabledItems = items.filter((item) => item.handler);

  if (!enabledItems.length) {
    setLibraryStatus(options.emptyMessage || "这首歌暂无更多可用操作。");
    return;
  }

  state.trackActionSheetTrack = track;
  trackActionSheetTitle.textContent = options.title || "歌曲操作";
  trackActionSheetSubtitle.textContent = options.subtitle || getTrackActionSheetSubtitle(track);
  trackActionSheetList.replaceChildren();

  enabledItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-sheet-item ${item.tone === "danger" ? "danger" : ""}`.trim();
    button.disabled = Boolean(item.disabled);
    const icon = document.createElement("span");
    icon.className = "action-sheet-icon";
    icon.append(createActionIcon(item.icon));
    const label = document.createElement("span");
    label.className = "action-sheet-copy";
    const title = document.createElement("strong");
    title.textContent = item.label;
    label.append(title);
    if (item.detail) {
      const detail = document.createElement("small");
      detail.textContent = item.detail;
      label.append(detail);
    }
    button.append(icon, label);
    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }

      closeTrackActionSheet();
      item.handler();
    });
    trackActionSheetList.append(button);
  });

  trackActionSheet.hidden = false;
  document.body.classList.add("action-sheet-open");
  const firstEnabledButton = trackActionSheetList.querySelector("button:not(:disabled)");
  (firstEnabledButton || trackActionSheetClose).focus();
}

function getTrackActionSheetSubtitle(track) {
  if (!track) {
    return "";
  }

  return [
    track.Name || "未命名歌曲",
    getArtists(track),
    track.Album,
  ].filter(Boolean).join(" · ");
}

function openMobileNavigationSheet() {
  const items = [
    { icon: "playlists", label: "歌单", view: "playlists" },
    { icon: "recent", label: "最近播放", view: "recent" },
    { icon: "album", label: "专辑", view: "albums" },
    { icon: "artist", label: "艺人", view: "artists" },
    { icon: "nowPlaying", label: "正在播放", view: "nowPlaying" },
  ];

  openTrackActionSheet(
    null,
    items.map((item) => ({
      icon: item.icon,
      label: item.label,
      handler: () => switchView(item.view),
      disabled: false,
    })),
    {
      title: "更多导航",
      subtitle: "更多页面",
      emptyMessage: "暂无更多页面。",
    },
  );
  state.trackActionSheetTrack = null;
}

function openMobilePlayerActions() {
  openTrackActionSheet(
    state.currentTrack,
    [
      {
        icon: "queueAdd",
        label: state.queue.length ? `播放队列（${state.queue.length}）` : "播放队列",
        detail: state.queue.length ? "查看待播、定位当前歌曲" : "队列为空",
        handler: toggleQuickQueue,
        disabled: !state.queue.length,
      },
      {
        icon: "shield",
        label: `音质：${getAudioQualityButtonLabel()}`,
        detail: isExternalSourceSession() ? "切换音乐桥源站质量策略" : "切换直放、HLS 或兼容转码",
        handler: openAudioQualityModal,
      },
      {
        icon: "repeat",
        label: `播放模式：${PLAY_MODE_LABELS[state.playMode] || PLAY_MODE_LABELS.order}`,
        detail: "顺序、随机、循环或单曲循环",
        handler: cyclePlayMode,
      },
      {
        icon: "search",
        label: "歌词 / 正在播放",
        detail: "查看封面、同步歌词和播放信息",
        handler: () => switchView("nowPlaying"),
        disabled: !state.currentTrack,
      },
      {
        icon: "nowPlaying",
        label: "沉浸播放",
        detail: "进入独立全屏播放界面",
        handler: openMobileImmersivePlayer,
        disabled: !state.currentTrack,
      },
    ],
    {
      title: "播放操作",
      subtitle: state.currentTrack
        ? `${state.currentTrack.Name || "当前歌曲"} · ${getArtists(state.currentTrack) || "未知艺人"}`
        : "选择歌曲后可使用更多播放操作",
      emptyMessage: "暂无播放操作。",
    },
  );
  state.trackActionSheetTrack = null;
}

function renderSavedAccounts() {
  if (!savedAccountsSection || !savedAccountList) {
    return;
  }

  const profiles = storage.loadAccountProfiles();
  savedAccountsSection.hidden = !profiles.length;
  savedAccountList.replaceChildren();

  profiles.forEach((profile) => {
    const item = document.createElement("div");
    item.className = "saved-account-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-account-main";
    button.addEventListener("click", () => activateSavedAccount(profile.session));

    const avatar = document.createElement("span");
    avatar.className = "saved-account-avatar";
    avatar.textContent = getAvatarInitial(profile.session.userName || profile.session.serverName || "E");

    const copy = document.createElement("span");
    copy.className = "saved-account-copy";

    const title = document.createElement("strong");
    title.textContent = profile.session.userName || (isExternalSourceSession(profile.session) ? "外部音源" : "Emby 账号");

    const subtitle = document.createElement("span");
    subtitle.textContent = getSavedAccountSubtitle(profile);

    copy.append(title, subtitle);
    button.append(avatar, copy);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "saved-account-remove";
    removeButton.textContent = "移除";
    removeButton.setAttribute("aria-label", `移除 ${title.textContent}`);
    removeButton.addEventListener("click", () => removeSavedAccount(profile.key));

    item.append(button, removeButton);
    savedAccountList.append(item);
  });
}

function renderAccountMenuSavedAccounts() {
  if (!accountMenuSavedSection || !accountMenuSavedList || !accountMenuSavedCount) {
    return;
  }

  const profiles = storage.loadAccountProfiles();
  const currentKey = storage.getAccountProfileKey(state.session);

  accountMenuSavedSection.hidden = !profiles.length;
  accountMenuSavedCount.textContent = profiles.length ? `${profiles.length}` : "0";
  accountMenuSavedList.replaceChildren();

  profiles.slice(0, 4).forEach((profile) => {
    const item = document.createElement("div");
    const isCurrent = profile.key === currentKey;
    item.className = `account-menu-saved-item ${isCurrent ? "active" : ""}`.trim();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "account-menu-saved-main";
    button.disabled = isCurrent;
    button.addEventListener("click", () => activateSavedAccount(profile.session));

    const avatar = document.createElement("span");
    avatar.className = "account-menu-saved-avatar";
    avatar.textContent = getAvatarInitial(profile.session.userName || profile.session.serverName || "E");

    const copy = document.createElement("span");
    copy.className = "account-menu-saved-copy";
    const title = document.createElement("strong");
    title.textContent = profile.session.userName || (isExternalSourceSession(profile.session) ? "外部音源" : "Emby 账号");
    const subtitle = document.createElement("span");
    subtitle.textContent = isCurrent ? "当前账号" : getSavedAccountSubtitle(profile);
    copy.append(title, subtitle);
    button.append(avatar, copy);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "account-menu-saved-remove";
    removeButton.append(createActionIcon("trash"));
    removeButton.setAttribute("aria-label", `移除 ${title.textContent}`);
    removeButton.title = `移除 ${title.textContent}`;
    removeButton.addEventListener("click", () => removeSavedAccount(profile.key, { fromAccountMenu: true }));

    item.append(button, removeButton);
    accountMenuSavedList.append(item);
  });

  if (profiles.length > 4) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "account-menu-saved-more";
    more.textContent = `还有 ${profiles.length - 4} 个账号，打开登录页管理`;
    more.addEventListener("click", openAccountSwitcher);
    accountMenuSavedList.append(more);
  }
}

function getSavedAccountSubtitle(profile) {
  const session = profile.session || {};
  const server = session.serverName || session.serverUrl || (isExternalSourceSession(session) ? "音源桥" : "Emby Server");
  const savedTime = profile.savedAt ? formatSavedAccountTime(profile.savedAt) : "";

  return savedTime ? `${server} · ${savedTime}` : server;
}

function formatSavedAccountTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function activateSavedAccount(session) {
  if (!session?.serverUrl || !session?.userId || (!session?.accessToken && !isExternalSourceSession(session))) {
    setMessage("这个保存账号缺少有效会话，请重新输入密码登录。", "error");
    return;
  }

  saveQueueState();
  storage.saveSession(session);
  storage.saveAccountProfile(session);
  renderSavedAccounts();
  setMessage(`正在切换到 ${session.userName || "已保存账号"}...`, "success");

  const url = new URL(location.href);
  url.searchParams.set("v", APP_VERSION);
  url.searchParams.set("account", String(Date.now()));
  location.replace(url.toString());
}

function removeSavedAccount(key, options = {}) {
  const removesCurrentSession = storage.getAccountProfileKey(state.session) === key;

  storage.removeAccountProfile(key);

  if (removesCurrentSession) {
    clearSession();
    setMessage("已移除并退出当前保存账号。");
    return;
  }

  renderSavedAccounts();
  renderAccountMenuSavedAccounts();
  renderSettings();
  setMessage("已移除这个保存账号。");

  if (options.fromAccountMenu) {
    setLibraryStatus("已移除这个保存账号。");
  }
}

function openAccountSwitcher() {
  closeAccountMenu();
  saveQueueState();
  renderSavedAccounts();
  showLogin();
  setBadge("idle", "切换账号");
  setMessage("选择已保存账号，或输入新账号登录。");
}

function toggleAccountMenu() {
  if (accountMenu.hidden) {
    openAccountMenu();
  } else {
    closeAccountMenu();
  }
}

function openAccountMenu() {
  renderAccountMenu();
  accountMenu.hidden = false;
  accountMenuButton.setAttribute("aria-expanded", "true");
  const firstButton = accountMenu.querySelector("button:not(:disabled)");
  firstButton?.focus();
}

function closeAccountMenu() {
  accountMenu.hidden = true;
  accountMenuButton.setAttribute("aria-expanded", "false");
}

function openSourceBridgeModal() {
  if (!isExternalSourceSession()) {
    showNotice("音乐桥来源管理只在音乐桥模式下可用。", { type: "warning" });
    return;
  }

  renderSourceBridgeWorkspace();
  if (sourceBridgeModal) {
    sourceBridgeModal.hidden = false;
    validateSourceBridgeUrlInputs();
    updateSourceBridgeCommandPreview();
    getSourceBridgeInitialFocusTarget()?.focus();
  }
}

function closeSourceBridgeModal() {
  if (sourceBridgeModal) {
    sourceBridgeModal.hidden = true;
  }
}

function handleSourceBridgeDocumentClick(event) {
  if (!sourceBridgeModal || sourceBridgeModal.hidden || shouldIgnoreExternalCloseEvent(event)) {
    return;
  }

  if (event.target === sourceBridgeModal) {
    closeSourceBridgeModal();
  }
}

function getSourceBridgeInitialFocusTarget() {
  return [
    sourceBridgeApiUrlInput,
    sourceBridgeMusicDirInput,
    sourceBridgeManifestUrlInput,
  ].find((input) => input && !String(input.value || "").trim())
    || sourceBridgeApiUrlInput
    || sourceBridgeSaveButton;
}

function closeTrackActionSheet(options = {}) {
  trackActionSheet.hidden = true;
  document.body.classList.remove("action-sheet-open");
  state.trackActionSheetTrack = null;
  trackActionSheetTitle.textContent = "歌曲操作";
  trackActionSheetSubtitle.textContent = "";
  trackActionSheetList.replaceChildren();
  if (options.restoreFocus !== false && state.trackActionSheetReturnFocus?.isConnected) {
    state.trackActionSheetReturnFocus.focus();
  }
  state.trackActionSheetReturnFocus = null;
}

function getTrackActionSheetFocusableElements() {
  if (!trackActionSheet || trackActionSheet.hidden) {
    return [];
  }

  return [...trackActionSheet.querySelectorAll("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")]
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
}

function trapTrackActionSheetFocus(event) {
  const focusable = getTrackActionSheetFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    trackActionSheetClose.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function createTrackQualityBadge(track) {
  const summary = getTrackQualitySummary(track);

  if (!summary) {
    return null;
  }

  const badge = document.createElement("span");
  badge.className = [
    "track-quality-badge",
    `quality-${summary.qualityTier || "standard"}`,
    summary.isLossless ? "lossless" : "",
  ].filter(Boolean).join(" ");
  badge.textContent = summary.shortLabel;
  badge.title = summary.detailLabel;
  badge.setAttribute("aria-label", `媒体格式：${summary.detailLabel}`);
  return badge;
}

function createTrackArtistButton(track, fallbackText) {
  const artist = getPrimaryTrackArtist(track);
  const button = createTrackLinkButton(fallbackText, "打开艺人", () => {
    openTrackArtist(track);
  });
  button.disabled = !artist?.Id && !artist?.Name && !fallbackText;
  return button;
}

function createTrackAlbumButton(track, fallbackText) {
  const button = createTrackLinkButton(fallbackText, "打开专辑", () => {
    openTrackAlbum(track);
  });
  button.disabled = !track.AlbumId && !track.Album;
  return button;
}

function createTrackLinkButton(text, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "track-link-button";
  button.textContent = text || "-";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

function renderArtistGrid(container, artists, options = {}) {
  container.replaceChildren();

  if (!artists.length) {
    const hasSearchEmpty = state.query || hasActiveTrackFilter();
    container.append(createEmptyState(state.query
      ? (options.searchEmptyText || "没有匹配的艺人。")
      : (options.emptyText || "没有读取到艺人。"), getLibraryEmptyActions({ includeFilters: hasSearchEmpty })));
    return;
  }

  artists.forEach((artist, index) => {
    const card = document.createElement("article");
    card.className = "artist-card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "artist-card-button";
    button.addEventListener("click", () => {
      openArtistDetail(artist);
    });

    const avatar = document.createElement("span");
    avatar.className = `artist-avatar ${coverClass(index)}`;
    appendImage(avatar, getImageUrl(artist, 260), artist.Name);

    const title = document.createElement("strong");
    title.textContent = artist.Name || "未知艺人";

    const subtitle = document.createElement("span");
    subtitle.textContent = getArtistSubtitle(artist);

    button.append(avatar, title, subtitle, createCollectionMetaChips(getArtistMetaChips(artist)));
    card.append(button, createCollectionQuickActions([
      {
        icon: "play",
        label: `播放艺人 ${artist.Name || "未知艺人"}`,
        handler: () => playArtistFromCard(artist),
      },
      {
        icon: "queueAdd",
        label: `加入队列 ${artist.Name || "未知艺人"}`,
        handler: () => queueArtistFromCard(artist),
      },
    ]), createFavoriteButton(artist, "collection-favorite-button"));
    container.append(card);
  });
}

function createFavoriteButton(item, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `favorite-button ${extraClass}`.trim();
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(item);
  });
  updateFavoriteButton(button, item);
  return button;
}

function updateFavoriteButton(button, item, label = "收藏") {
  const active = isFavorite(item);
  button.className = `${button.className.replace(/\s?active/g, "")} ${active ? "active" : ""}`.trim();
  button.replaceChildren(createActionIcon("heart"));
  button.title = active ? `取消${label}` : label;
  button.disabled = !item?.Id;
  button.setAttribute("aria-label", button.title);
}

function renderFilterBar() {
  const filters = [];

  if (state.query) {
    filters.push({ key: "query", label: `搜索：${searchInput.value.trim()}` });
  }

  if (state.albumFilter) {
    filters.push({ key: "album", label: `专辑：${getAlbumName(state.albumFilter) || "未知专辑"}` });
  }

  if (state.artistFilter) {
    filters.push({ key: "artist", label: `艺人：${getArtistName(state.artistFilter) || "未知艺人"}` });
  }

  if (state.genreFilter) {
    filters.push({ key: "genre", label: `风格：${state.genreFilter}` });
  }

  if (state.yearFilter) {
    filters.push({ key: "year", label: `年份：${state.yearFilter}` });
  }

  if (state.qualityFilter) {
    filters.push({ key: "quality", label: `音质：${QUALITY_FILTER_LABELS[state.qualityFilter] || state.qualityFilter}` });
  }

  if (state.favoriteFilter) {
    filters.push({ key: "favorite", label: `收藏：${getFavoriteFilterLabel(state.favoriteFilter)}` });
  }

  filterBar.hidden = !filters.length;
  filterLabel.replaceChildren();
  filterLabel.append(createFilterSummary(filters.length));

  filters.forEach((filter) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip";
    chip.textContent = `${filter.label} ×`;
    chip.title = `移除${filter.label}`;
    chip.setAttribute("aria-label", chip.title);
    chip.addEventListener("click", () => removeFilter(filter.key));
    filterLabel.append(chip);
  });
}

function createFilterSummary(filterCount) {
  const summary = document.createElement("span");
  summary.className = "filter-summary";
  summary.textContent = `已筛选 ${getFilteredLibraryTotal()} 项 · ${filterCount} 个条件`;
  return summary;
}

function getFilteredLibraryTotal() {
  return state.filteredTracks.length
    + state.filteredAlbums.length
    + state.filteredArtists.length
    + state.filteredPlaylists.length;
}

function renderQueue() {
  queueCount.textContent = String(state.queue.length);
  nowQueueCount.textContent = String(state.queue.length);
  mobilePlayerQueueCount.textContent = String(state.queue.length);
  immersiveQueueCount.textContent = String(state.queue.length);
  renderPlayerNextPreview();
  renderQueueOverview();
  immersiveQueueButton.setAttribute("aria-expanded", state.isImmersiveQueueOpen ? "true" : "false");
  queueMeta.textContent = getQueueMetaText();
  queueButton.disabled = !state.queue.length;
  nowQueueButton.disabled = !state.queue.length;
  mobilePlayerQueueButton.disabled = !state.queue.length;
  mobilePlayerImmersiveButton.disabled = !state.currentTrack;
  mobilePlayerMoreButton.disabled = !state.session;
  immersiveQueueButton.disabled = !state.queue.length;
  locateTrackButton.disabled = !state.session;
  shuffleQueueButton.disabled = getShuffleableQueueRange().length < 2;
  organizeQueueButton.disabled = getShuffleableQueueRange().length < 2;
  locateQueueTrackButton.disabled = !state.currentTrack || !state.queue.length;
  clearPlayedQueueButton.disabled = getCurrentQueueIndex() <= 0;
  clearQueueButton.disabled = !state.queue.length;
  immersiveQueueLocateButton.disabled = !state.currentTrack || !state.queue.length;
  immersiveQueueShuffleButton.disabled = getShuffleableQueueRange().length < 2;
  immersiveQueueClearPlayedButton.disabled = getCurrentQueueIndex() <= 0;
  immersiveQueueClearButton.disabled = !state.queue.length;
  settingsClearQueueButton.disabled = !state.queue.length;

  if (!state.queue.length) {
    queueTrackList.innerHTML = emptyMarkup("播放队列为空。点一首歌曲或使用随机播放。");
    closeQuickQueue({ restoreFocus: false });
    closeImmersiveQueue({ restoreFocus: false });
    renderUpNext();
    renderSettings();
    return;
  }

  renderTrackList(queueTrackList, state.queue, {
    context: "queue",
    playQueue: state.queue,
  });
  renderQuickQueue();
  renderUpNext();
  renderSettings();
}

function renderQueueOverview() {
  if (!queueOverviewTitle) {
    return;
  }

  const queueLength = state.queue.length;
  const currentIndex = getCurrentQueueIndex();
  const currentTrack = state.currentTrack || (currentIndex >= 0 ? state.queue[currentIndex] : null);
  const nextTrack = getNextPreviewTrack();
  const remainingTracks = getQueueRemainingTracks();
  const progressRatio = queueLength && currentIndex >= 0
    ? Math.min(100, Math.max(0, ((currentIndex + 1) / queueLength) * 100))
    : 0;

  queueOverviewCover.className = `queue-overview-cover ${coverClass(currentIndex >= 0 ? currentIndex : 0)}`;
  queueOverviewCover.replaceChildren();

  if (currentTrack) {
    appendImage(queueOverviewCover, getTrackImageUrl(currentTrack, 220), currentTrack.Name);
  }

  queueOverviewTitle.textContent = currentTrack?.Name || (queueLength ? "队列已准备" : "等待选择音乐");
  queueOverviewMeta.textContent = currentTrack
    ? [
        getArtists(currentTrack) || "未知艺人",
        currentTrack.Album,
        currentIndex >= 0 ? `第 ${currentIndex + 1} / ${queueLength} 首` : "",
      ].filter(Boolean).join(" · ")
    : (queueLength ? `${queueLength} 首待播，点击播放开始。` : "点一首歌或随机播放开始。");
  queueOverviewProgress.style.width = `${progressRatio}%`;
  const isPlaying = Boolean(currentTrack && !audioPlayer.paused && !audioPlayer.ended);
  queueOverviewPlayButton.disabled = !queueLength;
  queueOverviewPlayButton.textContent = isPlaying ? "暂停" : "播放";
  queueOverviewLocateButton.disabled = !currentTrack || !queueLength;

  queueOverviewNextTitle.textContent = nextTrack?.Name || (queueLength ? "已到队尾" : "暂无待播");
  queueOverviewNextMeta.textContent = nextTrack
    ? [getArtists(nextTrack) || "未知艺人", nextTrack.Album, formatTicks(nextTrack.RunTimeTicks)].filter(Boolean).join(" · ")
    : (queueLength ? "当前播放模式下没有下一首。" : "播放队列为空。");
  queueOverviewPosition.textContent = queueLength && currentIndex >= 0
    ? `${currentIndex + 1} / ${queueLength}`
    : `0 / ${queueLength}`;
  queueOverviewShuffleButton.disabled = getShuffleableQueueRange().length < 2;

  queueOverviewCover.classList.toggle("is-empty", !currentTrack);
}

function playQueueOverviewCurrent() {
  if (!state.queue.length) {
    setLibraryStatus("播放队列为空。");
    return;
  }

  if (state.currentTrack) {
    togglePlayback();
    return;
  }

  const firstTrack = state.queue[0];

  if (firstTrack) {
    playTrack(firstTrack, state.queue);
  }
}

function renderQuickQueue() {
  quickQueueTitle.textContent = state.currentTrack?.Name || "待播队列";
  quickQueueMeta.textContent = getQueueMetaText();
  const shuffleableQueueLength = getShuffleableQueueRange().length;
  quickQueueOpenButton.disabled = !state.queue.length;
  quickQueueShuffleButton.disabled = shuffleableQueueLength < 2;
  quickQueueOrganizeButton.disabled = shuffleableQueueLength < 2;
  quickQueueLocateButton.disabled = !state.currentTrack || !state.queue.length;
  quickQueueClearPlayedButton.disabled = getCurrentQueueIndex() <= 0;
  quickQueueClearButton.disabled = !state.queue.length;
  quickQueueList.replaceChildren();

  if (!state.queue.length) {
    quickQueueList.innerHTML = emptyMarkup("播放队列为空。");
    return;
  }

  const currentIndex = getCurrentQueueIndex();
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const visibleTracks = state.queue.slice(startIndex, startIndex + 12);

  visibleTracks.forEach((track, offset) => {
    const queueIndex = startIndex + offset;
    const isActive = track.Id === state.currentTrack?.Id;
    const isNext = queueIndex === currentIndex + 1;
    const item = document.createElement("div");
    item.className = "quick-queue-item";
    item.dataset.trackId = track.Id;
    item.classList.toggle("active", isActive);
    item.classList.toggle("next", isNext);
    item.addEventListener("pointermove", updateHomeTrackRippleOrigin);
    item.addEventListener("pointerenter", updateHomeTrackRippleOrigin);

    const number = document.createElement("span");
    number.className = "quick-queue-number";
    number.textContent = isActive ? "▶" : String(queueIndex + 1).padStart(2, "0");

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "quick-queue-play";
    playButton.setAttribute("aria-label", `播放 ${track.Name || "歌曲"}`);
    playButton.addEventListener("click", () => {
      closeQuickQueue({ restoreFocus: false });
      playTrack(track, state.queue);
    });

    const cover = document.createElement("span");
    cover.className = `quick-queue-cover ${coverClass(queueIndex)}`;
    appendImage(cover, getTrackImageUrl(track, 120), track.Name);
    const coverCue = document.createElement("span");
    coverCue.className = "quick-queue-cover-cue";
    coverCue.append(createActionIcon(isActive ? "nowPlaying" : "play"));
    cover.append(coverCue);

    const copy = document.createElement("span");
    copy.className = "quick-queue-copy";

    const title = document.createElement("strong");
    title.textContent = track.Name || "未命名歌曲";

    const subtitle = document.createElement("span");
    subtitle.textContent = [getArtists(track), track.Album].filter(Boolean).join(" · ") || "未知艺人";

    const duration = document.createElement("em");
    duration.textContent = isActive ? "正在播放" : (isNext ? "下一首" : formatTicks(track.RunTimeTicks));

    copy.append(title, subtitle);
    playButton.append(number, cover, copy, duration);
    item.append(playButton, createQuickQueueItemActions(queueIndex));
    quickQueueList.append(item);
  });

  if (state.queue.length > startIndex + visibleTracks.length) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "quick-queue-more";
    more.textContent = `还有 ${state.queue.length - startIndex - visibleTracks.length} 首，打开完整队列`;
    more.addEventListener("click", () => {
      closeQuickQueue({ restoreFocus: false });
      switchView("queue");
    });
    quickQueueList.append(more);
  }
}

function createQuickQueueItemActions(index) {
  const actions = document.createElement("span");
  actions.className = "quick-queue-item-actions";

  actions.append(
    createQuickQueueActionButton("moveUp", "上移", () => moveQueueTrack(index, -1), index <= 0),
    createQuickQueueActionButton("moveDown", "下移", () => moveQueueTrack(index, 1), index >= state.queue.length - 1),
    createQuickQueueActionButton("trash", "从队列移除", () => removeQueueTrack(index), false, "danger"),
  );

  return actions;
}

function createQuickQueueActionButton(icon, title, handler, disabled = false, tone = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = tone ? `quick-queue-action ${tone}` : "quick-queue-action";
  button.append(createActionIcon(icon));
  button.title = title;
  button.setAttribute("aria-label", title);
  button.disabled = disabled;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handler();
  });

  return button;
}

function renderPlayerNextPreview() {
  if (!playerNextPreview || !playerNextTitle) {
    return;
  }

  const nextTrack = getNextPreviewTrack();
  const remainingCount = getQueueRemainingTracks().length;
  const title = nextTrack?.Name || (state.queue.length ? "已到队尾" : "暂无待播");
  const tooltip = nextTrack
    ? `下一首：${nextTrack.Name || "未命名歌曲"} · ${getArtists(nextTrack) || "未知艺人"}`
    : (state.queue.length ? "打开队列" : "播放队列为空");
  const label = nextTrack
    ? `查看下一首：${nextTrack.Name || "未命名歌曲"}`
    : "查看播放队列";
  const remaining = remainingCount ? String(remainingCount) : "";
  const signature = [
    nextTrack?.Id || "",
    state.queue.length,
    state.playMode,
    title,
    tooltip,
    label,
    remaining,
  ].join("|");

  if (signature === playerNextPreviewSignature) {
    return;
  }

  playerNextPreviewSignature = signature;

  playerNextPreview.disabled = !state.queue.length;
  playerNextPreview.classList.toggle("is-empty", !nextTrack);
  setTextIfChanged(playerNextTitle, title);
  setDomPropertyIfChanged(playerNextPreview, "title", tooltip);
  setAttributeIfChanged(playerNextPreview, "aria-label", label);
  setDatasetValueIfChanged(playerNextPreview, "remaining", remaining);
}

function getNextPreviewTrack() {
  if (!state.queue.length) {
    return null;
  }

  if (!state.currentTrack) {
    return state.queue[0] || null;
  }

  const currentIndex = getCurrentQueueIndex();

  if (currentIndex < 0) {
    return state.queue[0] || null;
  }

  if (state.playMode === "repeat-one") {
    return state.currentTrack;
  }

  if (state.playMode === "shuffle" && state.queue.length > 1) {
    return getQueueTrackById(getNextShuffleTrackId());
  }

  if (currentIndex < state.queue.length - 1) {
    return state.queue[currentIndex + 1] || null;
  }

  return state.playMode === "repeat-all" ? state.queue[0] || null : null;
}

function renderPlaybackPreferenceOptions() {
  playbackStreamSelect.replaceChildren();
  PLAYBACK_STREAM_POLICIES.forEach((policy) => {
    const option = document.createElement("option");
    option.value = policy;
    option.textContent = PLAYBACK_STREAM_LABELS[policy] || policy;
    playbackStreamSelect.append(option);
  });

  transcodeBitrateSelect.replaceChildren();
  TRANSCODE_BITRATES.forEach((bitrate) => {
    const option = document.createElement("option");
    option.value = String(bitrate.value);
    option.textContent = bitrate.label;
    transcodeBitrateSelect.append(option);
  });
}

function bindSourceBridgeControls() {
  [
    sourceBridgeSaveButton,
  ].forEach((button) => button?.addEventListener("click", saveSourceBridgeSettings));
  [
    sourceBridgeTestButton,
  ].forEach((button) => button?.addEventListener("click", testSourceBridgeFromPanel));
  [
    sourceBridgeRefreshButton,
  ].forEach((button) => button?.addEventListener("click", refreshSourceBridgeFromPanel));
}

function initSourceBridgeModalInteractions() {
  [sourceBridgeApiUrlInput, sourceBridgeManifestUrlInput].forEach((input) => {
    input?.addEventListener("input", () => {
      validateSourceBridgeUrlInputs();
      updateSourceBridgeCommandPreview();
    });
    input?.addEventListener("keydown", handleSourceBridgeInputKeydown);
  });
  sourceBridgeMusicDirInput?.addEventListener("input", updateSourceBridgeCommandPreview);
  sourceBridgeMusicDirInput?.addEventListener("keydown", handleSourceBridgeInputKeydown);

  const dropZone = sourceBridgeMusicDirInput?.closest(".source-bridge-drop-zone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragging");
  });
  dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
    const item = event.dataTransfer?.items?.[0];
    const file = item?.getAsFile?.() || event.dataTransfer?.files?.[0];
    const pathValue = file?.path || file?.webkitRelativePath || "";

    if (pathValue) {
      sourceBridgeMusicDirInput.value = pathValue;
      sourceBridgeMusicDirWarning.hidden = true;
      updateSourceBridgeCommandPreview();
    } else if (sourceBridgeMusicDirWarning) {
      sourceBridgeMusicDirWarning.hidden = false;
    }
  });

  sourceBridgeFolderButton?.addEventListener("click", pickSourceBridgeMusicDirectory);

  sourceBridgeManifestMaskButton?.addEventListener("click", toggleSourceBridgeManifestMask);
  sourceBridgeCopyCommandButton?.addEventListener("click", copySourceBridgeCommand);
}

async function pickSourceBridgeMusicDirectory() {
  const apiUrl = getSourceBridgeBridgeApiUrlFromInputs();

  if (sourceBridgeFolderButton) {
    sourceBridgeFolderButton.disabled = true;
  }

  try {
    const url = new URL(`${apiUrl.replace(/\/+$/, "")}/pick-directory`);
    const currentDirectory = getSourceBridgeMusicDirFromInputs();
    if (currentDirectory) {
      url.searchParams.set("current", currentDirectory);
    }
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const directory = String(payload?.directory || "").trim();

    if (!directory) {
      return;
    }

    sourceBridgeMusicDirInput.value = directory;
    if (sourceBridgeApiUrlInput && shouldReplaceSourceBridgeApiInput(sourceBridgeApiUrlInput.value)) {
      sourceBridgeApiUrlInput.value = apiUrl;
      state.externalSourceApiUrl = apiUrl;
      saveExternalSourceApiUrl(apiUrl);
    }
    state.sourceBridgeMusicDir = directory;
    saveSourceBridgeMusicDir(directory);
    if (sourceBridgeMusicDirWarning) {
      sourceBridgeMusicDirWarning.hidden = true;
    }
    updateSourceBridgeCommandPreview();
  } catch (error) {
    sourceBridgeMusicDirInput?.focus();
    if (sourceBridgeMusicDirWarning) {
      sourceBridgeMusicDirWarning.textContent = `无法打开目录选择器：${readableError(error)}`;
      sourceBridgeMusicDirWarning.hidden = false;
    }
  } finally {
    if (sourceBridgeFolderButton) {
      sourceBridgeFolderButton.disabled = false;
    }
  }
}

function handleSourceBridgeInputKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  saveSourceBridgeSettings();
}

function validateSourceBridgeUrlInputs() {
  validateSourceBridgeUrlInput(sourceBridgeApiUrlInput, sourceBridgeApiUrlWarning);
  validateSourceBridgeUrlInput(sourceBridgeManifestUrlInput, sourceBridgeManifestUrlWarning);
}

function validateSourceBridgeUrlInput(input, warning) {
  if (!input || !warning) {
    return;
  }

  const value = input.value.trim();
  const isInvalidProtocol = Boolean(value) && !/^https?:\/\//i.test(value);
  const isAppPageUrl = input === sourceBridgeApiUrlInput && isCurrentAppUrl(value);
  const isWarning = isInvalidProtocol || isAppPageUrl;
  if (isAppPageUrl) {
    warning.textContent = "这是当前网页地址，不是音乐桥服务地址。请使用 http://127.0.0.1:5174。";
  } else {
    warning.textContent = "链接需要以 http:// 或 https:// 开头。";
  }
  input.closest(".source-bridge-field")?.classList.toggle("is-warning", isWarning);
  warning.hidden = !isWarning;
}

function toggleSourceBridgeManifestMask() {
  if (!sourceBridgeManifestUrlInput || !sourceBridgeManifestMaskButton) {
    return;
  }

  const shouldShow = sourceBridgeManifestUrlInput.type === "password";
  sourceBridgeManifestUrlInput.type = shouldShow ? "text" : "password";
  sourceBridgeManifestMaskButton.setAttribute("aria-pressed", shouldShow ? "true" : "false");
  sourceBridgeManifestMaskButton.setAttribute("aria-label", shouldShow ? "隐藏音源清单链接" : "显示音源清单链接");
  sourceBridgeManifestMaskButton.querySelector(".source-bridge-eye-open")?.toggleAttribute("hidden", shouldShow);
  sourceBridgeManifestMaskButton.querySelector(".source-bridge-eye-closed")?.toggleAttribute("hidden", !shouldShow);
}

function updateSourceBridgeCommandPreview() {
  if (!sourceBridgeCommandText) {
    return;
  }

  const musicDir = String(sourceBridgeMusicDirInput?.value || state.sourceBridgeMusicDir || "D:\\Music").trim() || "D:\\Music";
  sourceBridgeCommandText.textContent = `npm run bridge -- --music-dir "${musicDir}"`;
}

async function copySourceBridgeCommand() {
  if (!sourceBridgeCommandText || !sourceBridgeCopyCommandButton) {
    return;
  }

  const command = sourceBridgeCommandText.textContent || "";

  try {
    await navigator.clipboard?.writeText(command);
  } catch {
    showNotice("当前浏览器不允许自动复制，请手动复制命令。", { type: "warning" });
    return;
  }

  sourceBridgeCopyCommandButton.classList.add("is-copied");
  sourceBridgeCopyCommandButton.querySelector(".source-bridge-copy-icon")?.toggleAttribute("hidden", true);
  sourceBridgeCopyCommandButton.querySelector(".source-bridge-check-icon")?.toggleAttribute("hidden", false);
  window.setTimeout(() => {
    sourceBridgeCopyCommandButton.classList.remove("is-copied");
    sourceBridgeCopyCommandButton.querySelector(".source-bridge-copy-icon")?.toggleAttribute("hidden", false);
    sourceBridgeCopyCommandButton.querySelector(".source-bridge-check-icon")?.toggleAttribute("hidden", true);
  }, 1500);
}

async function saveSourceBridgeSettings() {
  const correctedInput = reconcileSourceBridgeInputUrls();
  const apiUrl = correctedInput.apiUrl;
  const manifestUrl = correctedInput.manifestUrl;
  const musicDir = getSourceBridgeMusicDirFromInputs();

  state.externalSourceApiUrl = apiUrl;
  state.sourceBridgeManifestUrl = manifestUrl;
  state.sourceBridgeMusicDir = musicDir;
  saveExternalSourceApiUrl(apiUrl);
  saveSourceBridgeManifestUrl(manifestUrl);
  saveSourceBridgeMusicDir(musicDir);

  if (state.session && isExternalSourceSession()) {
    const session = buildExternalSourceSession(apiUrl, {
      ...(state.sourceBridgeInfo || {}),
      name: state.sourceBridgeInfo?.name || "音源桥",
    });
    state.session = {
      ...session,
      savedAt: state.session.savedAt || session.savedAt,
    };
    saveSession(state.session);
    renderSession(state.session);
  }

  syncSourceBridgeInputs();
  validateSourceBridgeUrlInputs();
  updateSourceBridgeCommandPreview();

  if (!apiUrl) {
    setLibraryStatus(correctedInput.movedManifest
      ? "已识别 JSON 清单并保存。请填写音乐桥服务地址后再加载。"
      : "已保存。音乐桥地址为空，当前保持空库。");
    if (correctedInput.movedManifest) {
      showNotice("这个 JSON 地址已放入“音源清单链接”。音乐桥服务地址需要填写本地桥接服务，例如 http://127.0.0.1:5174。", {
        type: "warning",
      });
    }
    renderLibrary();
    renderSourceBridgeWorkspace();
    return;
  }

  setLibraryStatus("正在保存音乐桥来源...");

  try {
    const info = await externalSourceApi.configureSourceBridge(apiUrl, {
      manifestUrl,
      musicDir,
    }).catch(async (error) => {
      if (readableError(error).includes("404") || readableError(error).includes("405")) {
        return externalSourceApi.fetchHealth(apiUrl);
      }
      throw error;
    });
    state.sourceBridgeInfo = info;
    setLibraryStatus("音乐桥来源已保存。");
    await loadMusicLibrary(state.session);
    renderSourceBridgeWorkspace();
  } catch (error) {
    showNotice(`音乐桥保存失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "复制诊断", handler: copyDiagnostics, dismiss: false }],
    });
  }
}

async function testSourceBridgeFromPanel() {
  const correctedInput = reconcileSourceBridgeInputUrls();
  const apiUrl = correctedInput.apiUrl;

  if (!apiUrl) {
    showNotice(correctedInput.movedManifest
      ? "已把 JSON 地址放到音源清单链接。测试音乐桥前，还需要填写服务地址。"
      : "请先填写音乐桥服务地址。", { type: "warning" });
    return;
  }

  setSourceBridgeTestButtonState("loading", "测试中");
  setLibraryStatus("正在测试音乐桥...");

  try {
    const info = await externalSourceApi.fetchHealth(apiUrl);
    state.sourceBridgeInfo = info;
    saveExternalSourceApiUrl(apiUrl);
    state.externalSourceApiUrl = apiUrl;
    if (state.session && isExternalSourceSession()) {
      state.session = {
        ...buildExternalSourceSession(apiUrl, info),
        savedAt: state.session.savedAt || new Date().toISOString(),
      };
      saveSession(state.session);
      renderSession(state.session);
    }
    setLibraryStatus(`音乐桥可用：${info?.name || "音源桥"}${info?.version ? ` · ${info.version}` : ""}。`);
    renderSourceBridgeWorkspace();
    renderSettings();
    setSourceBridgeTestButtonState("success", "✓ 连接成功");
  } catch (error) {
    setSourceBridgeTestButtonState("error", "✗ 连接失败");
    setLibraryStatus(`音乐桥测试失败：${readableError(error)}`);
  }
}

function setSourceBridgeTestButtonState(stateName, label) {
  if (!sourceBridgeTestButton) {
    return;
  }

  const labelNode = sourceBridgeTestButton.querySelector("[data-source-bridge-button-label]") || sourceBridgeTestButton;
  sourceBridgeTestButton.classList.remove("is-loading", "is-success", "is-error");

  if (stateName) {
    sourceBridgeTestButton.classList.add(`is-${stateName}`);
  }

  sourceBridgeTestButton.disabled = stateName === "loading";
  labelNode.textContent = label || "测试音乐桥";

  if (stateName === "success" || stateName === "error") {
    window.setTimeout(() => {
      sourceBridgeTestButton.classList.remove("is-loading", "is-success", "is-error");
      sourceBridgeTestButton.disabled = !getSourceBridgeApiUrlFromInputs();
      labelNode.textContent = "测试音乐桥";
    }, 2000);
  }
}

async function refreshSourceBridgeFromPanel() {
  const correctedInput = reconcileSourceBridgeInputUrls();
  const apiUrl = correctedInput.apiUrl;

  if (!apiUrl) {
    if (correctedInput.movedManifest) {
      showNotice("已识别 JSON 清单。刷新音乐库前，请先填写音乐桥服务地址。", { type: "warning" });
    }
    setEmptyExternalSourceLibrary();
    return;
  }

  try {
    await externalSourceApi.rescanSourceBridge(apiUrl).catch((error) => {
      if (readableError(error).includes("404") || readableError(error).includes("405")) {
        return null;
      }
      throw error;
    });
    state.externalSourceApiUrl = apiUrl;
    saveExternalSourceApiUrl(apiUrl);
    if (state.session && isExternalSourceSession()) {
      state.session = {
        ...buildExternalSourceSession(apiUrl, state.sourceBridgeInfo || {}),
        savedAt: state.session.savedAt || new Date().toISOString(),
      };
      saveSession(state.session);
    }
    await loadMusicLibrary(state.session);
  } catch (error) {
    showNotice(`音乐桥刷新失败：${readableError(error)}`, { type: "error" });
  }
}

function getSourceBridgeApiUrlFromInputs() {
  const value = [
    sourceBridgeApiUrlInput?.value,
    getSessionExternalSourceApiUrl(state.session),
    state.externalSourceApiUrl,
  ].find((item) => String(item || "").trim());
  return normalizeSourceBridgeServiceUrl(value || "");
}

function getSourceBridgeBridgeApiUrlFromInputs() {
  const value = [
    sourceBridgeApiUrlInput?.value,
    state.externalSourceApiUrl,
    getSessionExternalSourceApiUrl(state.session),
  ].find((item) => String(item || "").trim() && !isCurrentAppUrl(item));
  return normalizeSourceBridgeServiceUrl(value || "http://127.0.0.1:5174");
}

function normalizeSourceBridgeServiceUrl(value) {
  const normalized = normalizeExternalSourceApiUrl(value || "");
  return isCurrentAppUrl(normalized) ? "" : normalized;
}

function shouldReplaceSourceBridgeApiInput(value) {
  return !String(value || "").trim() || isCurrentAppUrl(value);
}

function isCurrentAppUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || typeof location === "undefined") {
    return false;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    return url.hostname === location.hostname && url.port === location.port;
  } catch {
    return false;
  }
}

function getSourceBridgeManifestUrlFromInputs() {
  const value = [
    sourceBridgeManifestUrlInput?.value,
    state.sourceBridgeManifestUrl,
  ].find((item) => String(item || "").trim());
  return String(value || "").trim();
}

function getSourceBridgeMusicDirFromInputs() {
  const value = [
    sourceBridgeMusicDirInput?.value,
    state.sourceBridgeMusicDir,
  ].find((item) => String(item || "").trim());
  return String(value || "").trim();
}

function renderSettings() {
  const session = state.session || {};
  const isBridge = isExternalSourceSession(session);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasMediaSession = "mediaSession" in navigator;

  settingsMeta.textContent = `v${APP_VERSION}`;
  if (settingsSourceMode) {
    settingsSourceMode.textContent = isBridge ? "音乐桥" : "Emby";
  }
  settingsServerName.textContent = session.serverName || "-";
  settingsServerUrl.textContent = isBridge ? getSourceBridgeDisplayUrl(session) : (session.serverUrl || "-");
  settingsUser.textContent = isBridge ? "桥接来源" : (session.userName || "-");
  settingsLibraryView.textContent = isBridge ? getSourceBridgeLibraryLabel() : getLibraryViewLabel();
  settingsAppVersion.textContent = APP_VERSION;
  settingsPwaStatus.textContent = getPwaStatusLabel(hasServiceWorker, isStandalone);
  settingsMediaSession.textContent = hasMediaSession ? "支持" : "不支持";
  syncCurrentAccentStatus();
  renderAccountMenu();
  settingsWindowTitle.textContent = document.title;
  settingsBrowserNetwork.textContent = getBrowserNetworkLabel();
  settingsTrackDensity.textContent = getTrackDensityLabel(state.trackDensity);
  renderAudioQualityButton();
  settingsPlayerMetaTarget.textContent = getPlayerMetaTargetLabel();
  settingsSortState.textContent = `${getSortKeyLabel(state.sortKey)} / ${getSortOrderLabel(state.sortOrder)}`;
  settingsFilterState.textContent = getSavedFilterLabel();
  settingsPlayMode.textContent = PLAY_MODE_LABELS[state.playMode] || PLAY_MODE_LABELS.order;
  settingsPlaybackSource.textContent = getCurrentPlaybackSourceLabel();
  settingsAudioQuality.textContent = getSettingsAudioQualityLabel();
  settingsEffectiveProtocol.textContent = getSettingsEffectiveProtocolLabel();
  playbackStreamSelect.value = state.playbackStreamPolicy;
  playerMetaTargetSelect.value = state.playerMetaTarget;
  transcodeBitrateSelect.value = String(state.transcodeBitrate);
  transcodeBitrateSelect.disabled = state.playbackStreamPolicy === "direct";
  settingsVolume.textContent = `${Math.round((audioPlayer.muted ? 0 : audioPlayer.volume) * 100)}%`;
  settingsQueue.textContent = state.queue.length
    ? [
      `${state.queue.length} 首 / 当前 ${state.currentTrackIndex + 1 || 1}`,
      getQueueRemainingMetaText(),
    ].filter(Boolean).join(" · ")
    : "0 首";
  settingsPlaySession.textContent = getSettingsPlaybackSessionLabel();
  settingsMediaSource.textContent = getSettingsMediaSourceLabel();
  settingsAudioElement.textContent = getSettingsAudioElementLabel();
  if (playbackPreloadToggle) {
    playbackPreloadToggle.checked = state.playbackPreloadEnabled;
  }
  if (playbackLosslessPrecacheToggle) {
    playbackLosslessPrecacheToggle.checked = state.playbackLosslessPrecacheEnabled;
    playbackLosslessPrecacheToggle.disabled = !state.playbackPreloadEnabled;
  }
  if (settingsPlaybackPreload) {
    settingsPlaybackPreload.textContent = getSettingsPlaybackPreloadLabel();
  }
  settingsPlaybackError.textContent = getSettingsPlaybackErrorLabel();
  settingsPlaybackError.classList.toggle("settings-error-value", settingsPlaybackError.textContent !== "-");
  renderPlaybackRecoveryPanel();
  settingsRecent.textContent = `${state.recentTracks.length} 首`;
  settingsLyrics.textContent = state.lyricLines.length
    ? `${state.lyricLines.length} 行${state.isLyricSynced ? " / 已同步" : ""}`
    : "未读取";
  updateSleepTimerControls();
  settingsTestConnectionButton.disabled = !state.session || state.isTestingConnection;
  settingsTestConnectionButton.textContent = state.isTestingConnection ? "检测中..." : "测试当前连接";
  settingsTestPlaybackButton.disabled = !state.session || state.isTestingPlayback || (!state.currentTrack && !state.tracks.length && !state.filteredTracks.length);
  settingsTestPlaybackButton.textContent = state.isTestingPlayback ? "检测中..." : "测试播放链路";
  settingsClearRecentButton.disabled = !state.recentTracks.length;
  settingsClearQueueButton.disabled = !state.queue.length;
  renderSourceBridgeWorkspace();
  settingsDiagnostics.textContent = buildDiagnostics();
}

function getPwaStatusLabel(hasServiceWorker, isStandalone) {
  if (!hasServiceWorker) {
    return "当前浏览器不支持";
  }

  if (state.pendingServiceWorkerUpdate) {
    return "检测到新版本，待重载";
  }

  if (isStandalone) {
    return "已安装/独立窗口";
  }

  return navigator.serviceWorker?.controller ? "已启用缓存" : "支持安装";
}

function getSettingsAudioQualityLabel() {
  if (isExternalSourceSession()) {
    const option = getExternalSourceQualityOption();
    const currentQuality = getTrackQualitySummary(state.currentTrack);
    return [
      option.label,
      option.quality,
      currentQuality?.shortLabel ? `当前 ${currentQuality.shortLabel}` : "源站返回格式",
    ].filter(Boolean).join(" / ");
  }

  const profile = getAudioQualityProfile();
  return [
    profile.label,
    profile.codec,
    profile.bitrateLabel || "原码率",
    profile.transferFormat,
  ].filter(Boolean).join(" / ");
}

function getSettingsEffectiveProtocolLabel() {
  if (isExternalSourceSession()) {
    const mediaType = state.currentTrack
      ? (isVideoTrack(state.currentTrack) ? "视频/MV" : "音频")
      : "未播放";
    const hlsHint = state.isHlsJsActive
      ? " / hls.js 播放中"
      : "";

    return `音乐桥直链 / 源站返回格式 / ${mediaType}${hlsHint}`;
  }

  const profile = getAudioQualityProfile();
  const fallback = state.qualityFallbackAttempted ? " / 已兜底" : "";
  const hlsHint = profile.protocol === "hls"
    ? getHlsSupportSettingsLabel()
    : "";
  const method = profile.transferFormat ? ` / ${profile.transferFormat}` : "";

  return `${getEffectiveTranscodeMethodLabel(profile)}${method}${hlsHint}${fallback}`;
}

function getHlsSupportSettingsLabel() {
  if (supportsNativeHls()) {
    return " / 原生 HLS";
  }

  if (window.Hls?.isSupported?.()) {
    return state.isHlsJsActive ? " / hls.js 播放中" : " / hls.js 可用";
  }

  return " / HLS 不可用";
}

function getSettingsPlaybackSessionLabel() {
  if (!state.currentTrack) {
    return "未播放";
  }

  if (!state.currentPlaySessionId) {
    return "待创建";
  }

  return shortenIdentifier(state.currentPlaySessionId);
}

function getSettingsMediaSourceLabel() {
  if (!state.currentTrack) {
    return "-";
  }

  return shortenIdentifier(state.currentMediaSourceId || getTrackDefaultMediaSourceId(state.currentTrack));
}

function getSettingsAudioElementLabel() {
  if (!state.currentTrack) {
    return "-";
  }

  const base = [
    `ready ${audioPlayer.readyState}`,
    `network ${audioPlayer.networkState}`,
    audioPlayer.currentSrc ? "src 已设置" : "src 空",
  ].join(" / ");

  return state.lastPlaybackProbe ? `${base} · ${state.lastPlaybackProbe}` : base;
}

function getSettingsPlaybackPreloadLabel() {
  if (!state.playbackPreloadEnabled) {
    return "已关闭";
  }

  if (!state.currentTrack || !state.queue.length) {
    return "已开启，等待播放队列";
  }

  const nextTrack = getPreloadCandidateTrack();

  if (!nextTrack) {
    return "已开启，暂无下一首";
  }

  const status = state.preloadCacheStatus ? ` · ${state.preloadCacheStatus}` : "";
  const lossless = state.playbackLosslessPrecacheEnabled ? " · 允许无损下载" : "";
  return `下一首：${nextTrack.Name || "未命名歌曲"}${status}${lossless}`;
}

function getSettingsPlaybackErrorLabel() {
  return state.lastPlaybackError
    || state.lastPlaybackInfoError
    || (state.pendingAutoplayResume ? "等待用户确认自动播放" : "-");
}

function renderPlaybackRecoveryPanel() {
  if (!playbackRecoveryPanel) {
    return;
  }

  const errorText = state.lastPlaybackError || state.lastPlaybackInfoError;
  const track = state.currentTrack;

  playbackRecoveryPanel.hidden = !errorText || !track;

  if (playbackRecoveryPanel.hidden) {
    return;
  }

  const profile = getAudioQualityProfile();
  const isExternal = isExternalSourceTrack(track);
  playbackRecoveryTitle.textContent = isExternal ? "音源桥播放失败" : (track.Name || "播放遇到问题");
  playbackRecoveryMeta.textContent = [
    getCompactPlaybackErrorText(errorText),
    getCurrentPlaybackSourceLabel(),
    isExternal ? getExternalRecoveryHint(track) : `${profile.label} ${profile.bitrateLabel || "原码率"}`,
  ].filter(Boolean).join(" · ");
  playbackRetryButton.disabled = !track;
  playbackModeRetryButton.disabled = !track;
  playbackModeRetryButton.textContent = getOppositePlaybackActionLabel();
  playbackFallbackButton.hidden = isExternal;
  playbackFallbackButton.disabled = isExternal || !track || !shouldFallbackToCompatibleQuality();
  playbackTestButton.hidden = isExternal;
  playbackTestButton.disabled = isExternal || !track || state.isTestingPlayback;
  playbackTestButton.textContent = state.isTestingPlayback ? "检测中..." : "测试链路";
  playbackRecoveryPanel.classList.toggle("is-external-source", isExternal);
  renderPlaybackRecoveryQuickList(track);
}

function getCompactPlaybackErrorText(errorText) {
  const text = String(errorText || "").trim();

  if (/404|not found/i.test(text)) {
    return "源站地址失效或清单返回 404";
  }

  if (/no supported sources|not supported|MEDIA_ERR_SRC_NOT_SUPPORTED/i.test(text)) {
    return "当前地址不是浏览器可直接播放的媒体";
  }

  if (/timeout|timed out|超时/i.test(text)) {
    return "源站响应超时";
  }

  return text || "播放地址不可用";
}

function getExternalRecoveryHint(track) {
  if (isVideoTrack(track)) {
    return "可重试解析或换一个视频结果";
  }

  return "可重试解析或切换音源结果";
}

function hidePlaybackRecovery() {
  if (playbackRecoveryPanel) {
    playbackRecoveryPanel.hidden = true;
  }
}

function renderPlaybackRecoveryQuickList(track) {
  if (!playbackRecoveryQuickList) {
    return;
  }

  playbackRecoveryQuickList.replaceChildren();

  if (!track || isExternalSourceTrack(track)) {
    return;
  }

  PLAYBACK_RECOVERY_PROFILE_IDS
    .map((profileId) => AUDIO_QUALITY_PROFILES.find((profile) => profile.id === profileId))
    .filter(Boolean)
    .forEach((profile) => {
      const button = document.createElement("button");
      const isActive = profile.id === state.audioQualityProfileId;
      button.type = "button";
      button.className = `playback-recovery-quick ${isActive ? "active" : ""}`.trim();
      button.disabled = state.isTestingPlayback;
      button.title = `${profile.label} · ${profile.codec} · ${profile.bitrateLabel || "原码率"} · ${profile.scene}`;

      const icon = document.createElement("span");
      icon.className = "playback-recovery-quick-icon";
      icon.append(createActionIcon(getAudioQualityMethodIcon(getAudioQualityMethodGroupId(profile))));

      const copy = document.createElement("span");
      copy.className = "playback-recovery-quick-copy";

      const name = document.createElement("strong");
      name.textContent = getRecoveryProfileTitle(profile);

      const meta = document.createElement("small");
      meta.textContent = getRecoveryProfileMeta(profile);

      copy.append(name, meta);
      button.append(icon, copy);
      button.addEventListener("click", () => applyRecoveryQualityProfile(profile.id, track));
      playbackRecoveryQuickList.append(button);
    });
}

function clearPlaybackErrorState() {
  state.lastPlaybackError = "";
  state.lastPlaybackInfoError = "";
  hidePlaybackRecovery();
  renderSettings();
}

function retryPlaybackFromRecovery() {
  if (!state.currentTrack) {
    return;
  }

  playTrack(state.currentTrack, getPlaybackRetryQueue(state.currentTrack), {
    positionSeconds: getRetryPositionSeconds(),
  });
}

function retryPlaybackModeFromRecovery() {
  if (state.currentTrack) {
    retryWithOppositePlaybackMode(state.currentTrack);
  }
}

function fallbackPlaybackFromRecovery() {
  if (state.currentTrack) {
    fallbackToCompatibleQuality(state.currentTrack);
  }
}

function testPlaybackFromRecovery() {
  if (state.currentTrack) {
    testCurrentPlaybackChain(state.currentTrack);
  }
}

function shortenIdentifier(value) {
  const text = String(value || "");

  if (!text) {
    return "-";
  }

  return text.length > 18 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text;
}

function renderNowPlaying() {
  const track = state.currentTrack;

  nowPlayingCover.replaceChildren();
  nowPlayingCover.className = "now-playing-cover cover-a";
  nowPlayingCover.classList.toggle("is-empty", !track);
  renderNowPlayingEmptyActions(Boolean(track));

  if (!track) {
    nowPlayingCover.classList.remove("media-video-host");
    nowPlayingTitle.textContent = "等待选择音乐";
    nowPlayingArtist.textContent = "Emby Music Web";
    nowPlayingAlbum.textContent = "-";
    nowPlayingArtist.disabled = true;
    nowPlayingAlbum.disabled = true;
    nowPlayingMeta.hidden = true;
    nowPlayingMeta.replaceChildren();
    renderPlaybackFavoriteButton(nowFavoriteButton, null);
    renderLyrics(null);
    renderImmersivePlayer(null);
    renderUpNext();
    return;
  }

  nowPlayingTitle.textContent = track.Name || "未命名歌曲";
  nowPlayingArtist.textContent = getArtists(track) || "未知艺人";
  nowPlayingAlbum.textContent = track.Album || "未知专辑";
  nowPlayingArtist.disabled = !getPrimaryTrackArtist(track);
  nowPlayingAlbum.disabled = !track.AlbumId && !track.Album;
  renderNowPlayingPlaybackMeta(track);
  if (isVideoTrack(track)) {
    nowPlayingCover.classList.add("media-video-host");
    renderVideoTrackFrame(track);
    mountVideoElementForActiveView();
  } else {
    nowPlayingCover.classList.remove("media-video-host");
    appendImage(nowPlayingCover, getTrackImageUrl(track, 900), track.Name);
  }
  renderPlaybackFavoriteButton(nowFavoriteButton, track);
  renderLyrics(track);
  renderImmersivePlayer(track);
  renderUpNext();
}

function renderNowPlayingEmptyActions(hasTrack) {
  const hasPlayableTracks = Boolean(state.filteredTracks.length || state.tracks.length);

  nowPlayingEmptyActions.hidden = hasTrack;
  nowPlayingShuffleStartButton.disabled = !hasPlayableTracks;
  nowPlayingPlayLibraryButton.disabled = !hasPlayableTracks;
  nowPlayingOpenLibraryButton.disabled = !state.session;
}

function renderNowPlayingPlaybackMeta(track) {
  renderPlaybackMetaBadges(nowPlayingMeta, track);
}

function renderImmersivePlaybackMeta(track) {
  renderPlaybackMetaBadges(immersiveMeta, track);
}

function renderPlaybackMetaBadges(container, track) {
  container.replaceChildren();

  const items = getPlaybackMetaItems(track);
  if (!items.length) {
    container.hidden = true;
    return;
  }

  items.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = `now-playing-meta-badge ${item.tone || ""}`.trim();
    badge.textContent = item.label;
    if (item.title) {
      badge.title = item.title;
    }
    container.append(badge);
  });

  container.hidden = false;
}

function renderPlaybackFavoriteButton(button, track) {
  const isActive = isFavorite(track);

  button.disabled = !track;
  if (button.classList.contains("icon-favorite-button")) {
    button.classList.toggle("active", isActive);
    const label = button.querySelector(".sr-only");
    if (label) {
      label.textContent = isActive ? "取消收藏" : "收藏";
    }
  } else {
    button.className = `favorite-button ${isActive ? "active" : ""}`.trim();
    button.replaceChildren(createActionIcon("heart"));
  }
  button.title = isActive ? "取消收藏" : "收藏";
  button.setAttribute("aria-label", button.title);
}

function renderImmersivePlayer(track = state.currentTrack) {
  immersiveCover.replaceChildren();
  immersiveBackdrop.replaceChildren();
  immersiveCover.className = "immersive-cover cover-a";
  immersiveBackdrop.className = "immersive-backdrop cover-a";
  renderImmersiveEmptyActions(Boolean(track));

  if (!track) {
    immersiveCover.classList.remove("media-video-host");
    immersiveTitle.textContent = "等待选择音乐";
    immersiveArtist.textContent = "Emby Music Web";
    immersiveAlbum.textContent = "-";
    immersiveArtist.disabled = true;
    immersiveAlbum.disabled = true;
    renderImmersivePlaybackMeta(null);
    renderPlaybackFavoriteButton(immersiveFavoriteButton, null);
    renderImmersiveLyricFocus();
    return;
  }

  const imageUrl = getTrackImageUrl(track, 1100);
  immersiveTitle.textContent = track.Name || "未命名歌曲";
  immersiveArtist.textContent = getArtists(track) || "未知艺人";
  immersiveAlbum.textContent = track.Album || "未知专辑";
  immersiveArtist.disabled = !getPrimaryTrackArtist(track);
  immersiveAlbum.disabled = !track.AlbumId && !track.Album;
  if (isVideoTrack(track)) {
    immersiveCover.classList.add("media-video-host");
    renderVideoTrackFrame(track);
    mountVideoElementForActiveView();
  } else {
    immersiveCover.classList.remove("media-video-host");
    appendImage(immersiveCover, imageUrl, track.Name);
  }
  appendImage(immersiveBackdrop, imageUrl, "");
  renderImmersivePlaybackMeta(track);
  renderPlaybackFavoriteButton(immersiveFavoriteButton, track);
  renderImmersiveLyricFocus();
}

function renderImmersiveEmptyActions(hasTrack) {
  const hasPlayableTracks = Boolean(state.filteredTracks.length || state.tracks.length);

  immersiveEmptyActions.hidden = hasTrack;
  immersiveShuffleStartButton.disabled = !hasPlayableTracks;
  immersivePlayLibraryButton.disabled = !hasPlayableTracks;
  immersiveOpenLibraryButton.disabled = !state.session;
}

function renderLyrics(track) {
  resetLyricLineElementCache();

  if (!track) {
    state.lyricsTrackId = null;
    state.lyricsLoadRequestId += 1;
    state.lyricsStatus = "";
    state.lyricLines = [];
    state.lyricTimeline = [];
    state.lyricTimelineIndexByLineIndex = [];
    state.isLyricSynced = false;
    state.activeLyricIndex = -1;
    state.activeLyricTimelineIndex = -1;
    invalidateLyricRenderState();
    renderLyricsEmptyState("播放歌曲后显示歌词。", []);
    renderNowLyricFocus();
    renderImmersiveLyricFocus();
    return;
  }

  if (state.lyricsTrackId !== track.Id) {
    applyLyricsText(track, extractLyricsText(track), "");
    if (!state.lyricLines.length) {
      loadLyricsFromServer(track);
    }
  }

  lyricsList.replaceChildren();

  if (!state.lyricLines.length) {
    renderLyricsEmptyState(state.lyricsStatus || "没有读取到歌词。");
    renderNowLyricFocus();
    renderImmersiveLyricFocus();
    return;
  }

  state.lyricLines.forEach((line, index) => {
    const item = document.createElement("p");
    item.className = "lyric-line";
    item.dataset.lyricIndex = String(index);
    lyricLineElements[index] = item;
    appendLyricLineContent(item, line, {
      originalClassName: "lyric-original",
      translatedClassName: "lyric-translated",
      translatedTagName: "strong",
    });
    if (state.isLyricSynced && Number.isFinite(line.time)) {
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `跳转到 ${formatSeconds(line.time)}：${formatLyricLineLabel(line)}`);
      item.title = `跳转到 ${formatSeconds(line.time)}`;
      item.addEventListener("click", () => seekToLyricLine(index));
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        seekToLyricLine(index);
      });
    }
    lyricsList.append(item);
  });

  renderImmersiveLyricFocus();
  updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  renderNowLyricFocus();
}

function appendLyricLineContent(container, line, options = {}) {
  const text = line?.text || " ";
  const originalText = line?.originalText || "";

  if (!originalText) {
    container.textContent = text;
    return;
  }

  const original = document.createElement(options.originalTagName || "span");
  original.className = options.originalClassName || "lyric-original";
  original.textContent = originalText;

  const translated = document.createElement(options.translatedTagName || "span");
  translated.className = options.translatedClassName || "lyric-translated";
  translated.textContent = text;

  container.replaceChildren(original, translated);
}

function formatLyricLineLabel(line) {
  return [line?.originalText, line?.text].filter(Boolean).join(" / ") || "歌词";
}

function applyLyricsText(track, text, status = "") {
  const parsed = parseLyrics(text);
  state.lyricsTrackId = track?.Id || null;
  state.lyricLines = parsed.lines;
  state.lyricTimeline = buildLyricTimeline(parsed.lines);
  state.lyricTimelineIndexByLineIndex = buildLyricTimelineIndexMap(state.lyricTimeline, parsed.lines.length);
  state.isLyricSynced = parsed.isSynced;
  state.activeLyricIndex = -1;
  state.activeLyricTimelineIndex = -1;
  state.lyricsStatus = status;
  resetLyricProgressState();
  invalidateLyricRenderState();
  syncLyricProgressLoop();
}

async function loadLyricsFromServer(track) {
  if (!state.session || !track?.Id) {
    return;
  }

  const requestId = ++state.lyricsLoadRequestId;
  state.lyricsStatus = isExternalSourceTrack(track)
    ? "正在从音源桥尝试读取歌词..."
    : "正在从 Emby 尝试读取歌词...";
  invalidateLyricRenderState();
  renderLyricsEmptyState(state.lyricsStatus, []);
  renderNowLyricFocus();
  renderImmersiveLyricFocus();

  try {
    const text = await fetchLyricsText(track);

    if (requestId !== state.lyricsLoadRequestId || state.currentTrack?.Id !== track.Id) {
      return;
    }

    if (!text.trim()) {
      state.lyricsStatus = isExternalSourceTrack(track)
        ? "外部音源暂未提供歌词。"
        : "没有读取到歌词。";
      invalidateLyricRenderState();
      renderLyricsEmptyState(state.lyricsStatus);
      renderNowLyricFocus();
      renderImmersiveLyricFocus();
      return;
    }

    mergeLyricsIntoTrack(track, text);
    applyLyricsText(track, text, "");
    renderLyrics(track);
    renderSettings();
  } catch (error) {
    if (requestId !== state.lyricsLoadRequestId || state.currentTrack?.Id !== track.Id) {
      return;
    }

    state.lyricsStatus = `歌词读取失败：${readableError(error)}`;
    invalidateLyricRenderState();
    renderLyricsEmptyState(state.lyricsStatus);
    renderNowLyricFocus();
    renderImmersiveLyricFocus();
    renderSettings();
  }
}

function renderLyricsEmptyState(text, actions = getLyricsEmptyActions()) {
  lyricsList.replaceChildren();
  lyricsList.append(createEmptyState(text, actions));
}

function getLyricsEmptyActions() {
  const actions = [];

  if (state.currentTrack?.Id && state.session) {
    actions.push({
      label: "重试读取",
      handler: () => {
        state.lyricsTrackId = null;
        renderLyrics(state.currentTrack);
      },
    });
  }

  actions.push({
    label: "复制诊断",
    handler: copyDiagnostics,
  });

  return actions;
}

async function fetchLyricsText(track) {
  if (isExternalSourceTrack(track)) {
    const apiUrl = track.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl();

    if (!apiUrl) {
      return "";
    }

    return externalSourceApi.fetchLyric(apiUrl, track);
  }

  const encodedId = encodeURIComponent(track.Id);
  const candidates = [
    `/Items/${encodedId}/Lyrics`,
    `/Items/${encodedId}/Lyrics?MediaSourceId=${encodeURIComponent(getTrackDefaultMediaSourceId(track))}`,
    `/Audio/${encodedId}/Lyrics`,
  ];
  let lastError = null;

  for (const path of candidates) {
    try {
      const response = path.includes("/Lyrics")
        ? await embyApi.fetchText(state.session, path)
        : await embyFetch(state.session, path);
      const text = extractLyricsTextFromResponse(response);

      if (text.trim()) {
        return text;
      }
    } catch (error) {
      if (!readableError(error).includes("404")) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return "";
}

function extractLyricsTextFromResponse(response) {
  if (typeof response === "string") {
    const trimmed = response.trim();

    if (/^[{[]/.test(trimmed)) {
      try {
        return extractLyricsTextFromResponse(JSON.parse(trimmed));
      } catch {
        return response;
      }
    }

    return response;
  }

  if (!response || typeof response !== "object") {
    return "";
  }

  const direct = [
    response.Lyrics,
    response.Lyric,
    response.Text,
    response.LyricsText,
    response.Value,
    response.Data,
  ].find((value) => typeof value === "string" && value.trim());

  if (direct) {
    return direct;
  }

  const arrays = [
    response.Items,
    response.Lyrics,
    response.LyricsLines,
    response.Lines,
  ].filter(Array.isArray);

  for (const array of arrays) {
    const text = array.map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (!item || typeof item !== "object") {
        return "";
      }

      const lineText = item.Text || item.Line || item.Value || "";
      const ticks = Number(item.Start || item.StartPositionTicks || item.StartTicks);
      const seconds = Number(item.Time || item.StartSeconds);

      if (Number.isFinite(ticks) && ticks > 0) {
        return `[${formatLrcTimestamp(ticks / 10000000)}]${lineText}`;
      }

      if (Number.isFinite(seconds) && seconds >= 0) {
        return `[${formatLrcTimestamp(seconds)}]${lineText}`;
      }

      return lineText;
    }).filter(Boolean).join("\n");

    if (text.trim()) {
      return text;
    }
  }

  return "";
}

function formatLrcTimestamp(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);

  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function mergeLyricsIntoTrack(track, text) {
  const collections = [
    state.tracks,
    state.favoriteTracks,
    state.recentTracks,
    state.queue,
    state.albumTracks,
    state.artistTracks,
    state.playlistTracks,
  ];

  collections.forEach((collection) => {
    collection.forEach((item) => {
      if (item.Id === track.Id) {
        item.LyricsText = text;
      }
    });
  });

  if (state.currentTrack?.Id === track.Id) {
    state.currentTrack.LyricsText = text;
  }

  saveQueueState();
}

function bindLyricOffsetControls() {
  document.querySelectorAll("[data-lyric-offset-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.lyricOffsetAdjust;
      adjustLyricOffset(direction === "earlier" ? LYRIC_OFFSET_STEP_SECONDS : -LYRIC_OFFSET_STEP_SECONDS);
    });
  });

  document.querySelectorAll("[data-lyric-offset-reset]").forEach((button) => {
    button.addEventListener("click", () => resetLyricOffset());
  });
}

function adjustLyricOffset(deltaSeconds) {
  setLyricOffsetSeconds(state.lyricOffsetSeconds + deltaSeconds);
}

function resetLyricOffset() {
  setLyricOffsetSeconds(DEFAULT_LYRIC_OFFSET_SECONDS);
}

function setLyricOffsetSeconds(nextSeconds) {
  const normalizedSeconds = normalizeLyricOffsetSeconds(nextSeconds);

  if (Math.abs(normalizedSeconds - state.lyricOffsetSeconds) < 0.001) {
    renderLyricOffsetControls();
    return;
  }

  state.lyricOffsetSeconds = normalizedSeconds;
  saveLyricOffsetSeconds(normalizedSeconds);
  renderLyricOffsetControls();
  refreshLyricsAfterOffsetChange();
}

function refreshLyricsAfterOffsetChange() {
  state.activeLyricIndex = -1;
  state.activeLyricTimelineIndex = -1;
  resetLyricProgressState();
  updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  syncLyricProgressLoop();
}

function renderLyricOffsetControls() {
  const label = formatLyricOffsetLabel(state.lyricOffsetSeconds);
  const title = `歌词偏移 ${label}，正数会让歌词更早显示`;

  document.querySelectorAll("[data-lyric-offset-value]").forEach((element) => {
    element.textContent = label;
    element.title = title;
  });

  document.querySelectorAll("[data-lyric-offset-reset]").forEach((button) => {
    button.disabled = Math.abs(state.lyricOffsetSeconds - DEFAULT_LYRIC_OFFSET_SECONDS) < 0.001;
  });
}

function getAdjustedLyricSeconds(currentSeconds) {
  return (Number(currentSeconds) || 0) + state.lyricOffsetSeconds;
}

function formatLyricOffsetLabel(seconds) {
  const roundedSeconds = normalizeLyricOffsetSeconds(seconds);
  const sign = roundedSeconds >= 0 ? "+" : "";
  const tenths = Math.round(roundedSeconds * 10);
  const hundredths = Math.round(roundedSeconds * 100);
  const precision = Math.abs((tenths * 10) - hundredths) < 0.001 ? 1 : 2;
  return `${sign}${roundedSeconds.toFixed(precision)}s`;
}

function normalizeLyricOffsetSeconds(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") {
    return DEFAULT_LYRIC_OFFSET_SECONDS;
  }

  const numericSeconds = Number(seconds);
  const finiteSeconds = Number.isFinite(numericSeconds) ? numericSeconds : DEFAULT_LYRIC_OFFSET_SECONDS;
  return Math.round(clamp(finiteSeconds, MIN_LYRIC_OFFSET_SECONDS, MAX_LYRIC_OFFSET_SECONDS) * 100) / 100;
}

function loadLyricOffsetSeconds() {
  return normalizeLyricOffsetSeconds(localStorage.getItem(LYRIC_OFFSET_KEY));
}

function saveLyricOffsetSeconds(seconds) {
  localStorage.setItem(LYRIC_OFFSET_KEY, String(normalizeLyricOffsetSeconds(seconds)));
}

function updateLyricsHighlight(currentSeconds, forceScroll = false) {
  clearLyricProgressResumeTimer();

  if (!state.isLyricSynced || !state.lyricTimeline.length) {
    stopLyricProgressLoop();
    renderStaticLyricFocusIfNeeded();
    return;
  }

  const activeIndex = findActiveLyricIndex(currentSeconds);

  if (activeIndex === state.activeLyricIndex && !forceScroll) {
    if (isImmersiveLyricsVisible()) {
      updateImmersiveLyricProgress(currentSeconds);
    }
    syncLyricProgressLoop();
    return;
  }

  state.activeLyricIndex = activeIndex;
  renderNowLyricFocus();
  if (isImmersiveLyricsVisible()) {
    updateImmersiveLyricProgress(currentSeconds, forceScroll || getActiveView() === "immersivePlayer", forceScroll);
  }
  syncLyricListActiveClass(activeIndex);

  const activeItem = lyricLineElements[activeIndex];

  if (getActiveView() === "nowPlaying" && activeItem && shouldScrollLyricLine(forceScroll)) {
    scrollElementIntoContainerView(lyricsList, activeItem, {
      behavior: forceScroll ? "auto" : "smooth",
    });
  }

  syncLyricProgressLoop();
}

function scrollElementIntoContainerView(container, element, options = {}) {
  if (!container || !element || !container.contains(element)) {
    return false;
  }

  const behavior = options.behavior || "smooth";
  const block = options.block || "center";
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const elementOffsetTop = getElementOffsetWithinContainer(container, element);
  const centeredTop = elementOffsetTop - ((container.clientHeight - elementRect.height) / 2);
  const nearestTop = elementRect.top < containerRect.top
    ? elementOffsetTop
    : elementOffsetTop + elementRect.height - container.clientHeight;
  const targetTop = block === "nearest"
    && elementRect.top >= containerRect.top
    && elementRect.bottom <= containerRect.bottom
    ? container.scrollTop
    : block === "nearest"
    ? nearestTop
    : centeredTop;
  const nextScrollTop = clamp(targetTop, 0, maxScrollTop);
  const previousScrollTop = container.scrollTop;

  if (behavior === "auto" || behavior === "instant") {
    const previousScrollBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = "auto";
    container.scrollTop = nextScrollTop;
    container.style.scrollBehavior = previousScrollBehavior;
  } else {
    container.scrollTo({
      top: nextScrollTop,
      behavior,
    });
  }
  return true;
}

function getElementOffsetWithinContainer(container, element) {
  let offsetTop = 0;
  let current = element;

  while (current && current !== container) {
    offsetTop += current.offsetTop || 0;
    current = current.offsetParent;
  }

  if (current === container) {
    return offsetTop;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top - containerRect.top + container.scrollTop;
}

function shouldScrollLyricLine(isForced = false) {
  if (isForced) {
    lastLyricAutoScrollAt = getMonotonicNowMs();
    return true;
  }

  const nowMs = getMonotonicNowMs();
  if (nowMs - lastLyricAutoScrollAt < LYRIC_AUTO_SCROLL_MIN_INTERVAL_MS) {
    return false;
  }

  lastLyricAutoScrollAt = nowMs;
  return true;
}

function resetLyricLineElementCache() {
  activeLyricListIndex = -1;
  lyricLineElements = [];
}

function syncLyricListActiveClass(activeIndex) {
  if (activeLyricListIndex === activeIndex) {
    return;
  }

  lyricLineElements[activeLyricListIndex]?.classList.remove("active");
  lyricLineElements[activeIndex]?.classList.add("active");
  activeLyricListIndex = activeIndex;
}

function renderStaticLyricFocusIfNeeded() {
  const signature = [
    state.currentTrack?.Id || "",
    lyricRenderRevision,
    state.lyricsStatus || "",
    state.isLyricSynced ? "synced" : "static",
    state.lyricLines.length,
  ].join("|");

  if (signature === lastStaticLyricRenderSignature) {
    return;
  }

  lastStaticLyricRenderSignature = signature;
  renderNowLyricFocus();
  renderImmersiveLyricFocus();
}

function invalidateLyricRenderState() {
  lyricRenderRevision += 1;
  lastStaticLyricRenderSignature = "";
}

function findActiveLyricIndex(currentSeconds) {
  const targetSeconds = getAdjustedLyricSeconds(currentSeconds);
  const currentIndex = state.activeLyricIndex;
  const currentTimelineIndex = state.activeLyricTimelineIndex;

  if (
    currentIndex >= 0
    && currentIndex < state.lyricLines.length
    && currentTimelineIndex >= 0
    && currentTimelineIndex < state.lyricTimeline.length
  ) {
    const currentEntry = state.lyricTimeline[currentTimelineIndex];
    const nextEntry = state.lyricTimeline[currentTimelineIndex + 1];

    if (
      currentEntry
      && currentEntry.index === currentIndex
      && currentEntry.time <= targetSeconds
      && (!nextEntry || nextEntry.time > targetSeconds)
    ) {
      return currentIndex;
    }

    if (currentEntry?.index === currentIndex && nextEntry && nextEntry.time <= targetSeconds) {
      if (targetSeconds - currentEntry.time > LYRIC_TIMELINE_SEEK_THRESHOLD_SECONDS) {
        return findActiveLyricIndexBySearch(targetSeconds);
      }

      let timelineIndex = currentTimelineIndex + 1;

      while (timelineIndex < state.lyricTimeline.length) {
        const entry = state.lyricTimeline[timelineIndex];
        const followingEntry = state.lyricTimeline[timelineIndex + 1];

        if (!followingEntry || followingEntry.time > targetSeconds) {
          state.activeLyricTimelineIndex = timelineIndex;
          return entry.index;
        }

        timelineIndex += 1;
      }

      state.activeLyricTimelineIndex = state.lyricTimeline.length - 1;
      return state.lyricTimeline[state.activeLyricTimelineIndex]?.index ?? -1;
    }
  }

  return findActiveLyricIndexBySearch(targetSeconds);
}

function buildLyricTimeline(lines) {
  return lines
    .map((line, index) => ({ index, time: Number(line?.time) }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => left.time - right.time || left.index - right.index);
}

function buildLyricTimelineIndexMap(timeline, lineCount) {
  const indexMap = Array(lineCount).fill(-1);

  timeline.forEach((entry, timelineIndex) => {
    indexMap[entry.index] = timelineIndex;
  });

  return indexMap;
}

function findActiveLyricIndexBySearch(targetSeconds) {
  let low = 0;
  let high = state.lyricTimeline.length - 1;
  let activeIndex = -1;
  let activeTimelineIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const entry = state.lyricTimeline[middle];

    if (entry.time <= targetSeconds) {
      activeIndex = entry.index;
      activeTimelineIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  state.activeLyricTimelineIndex = activeTimelineIndex;
  return activeIndex;
}

function seekToLyricLine(index) {
  const line = state.lyricLines[index];

  if (!state.isLyricSynced || !line || !Number.isFinite(line.time)) {
    return;
  }

  if (seekToPosition(Math.max(0, line.time), { eventName: "Seek" })) {
    state.activeLyricIndex = -1;
    state.activeLyricTimelineIndex = -1;
    updateLyricsHighlight(line.time, true);
  }
}

function renderNowLyricFocus() {
  if (!nowLyricFocus) {
    return;
  }

  if (!state.currentTrack) {
    nowLyricStatus.textContent = "歌词";
    nowLyricCurrent.textContent = "播放歌曲后显示歌词。";
    nowLyricNext.textContent = "同步歌词可点击跳转。";
    nowLyricFocus.disabled = true;
    nowLyricFocus.classList.remove("synced");
    return;
  }

  if (!state.lyricLines.length) {
    nowLyricStatus.textContent = state.lyricsStatus ? "读取中" : "暂无歌词";
    nowLyricCurrent.textContent = state.lyricsStatus || "没有读取到歌词。";
    nowLyricNext.textContent = "可在 Emby 的歌曲元数据中添加歌词。";
    nowLyricFocus.disabled = true;
    nowLyricFocus.classList.remove("synced");
    return;
  }

  const activeIndex = state.isLyricSynced && state.activeLyricIndex >= 0
    ? state.activeLyricIndex
    : 0;
  const currentLine = state.lyricLines[activeIndex] || state.lyricLines[0];
  const nextLine = state.lyricLines[activeIndex + 1];

  nowLyricStatus.textContent = state.isLyricSynced ? "同步歌词" : "歌词";
  renderNowLyricFocusLine(currentLine);
  nowLyricNext.textContent = nextLine?.text
    ? `下一句：${nextLine.text}`
    : (state.isLyricSynced ? "已到歌词末尾" : "当前歌词没有时间轴。");
  nowLyricFocus.disabled = !state.isLyricSynced;
  nowLyricFocus.classList.toggle("synced", state.isLyricSynced);
}

function renderNowLyricFocusLine(line) {
  nowLyricCurrent.replaceChildren();
  appendLyricLineContent(nowLyricCurrent, line, {
    originalClassName: "now-lyric-original",
    translatedClassName: "now-lyric-translated",
  });
}

function focusActiveLyricLine() {
  if (!state.isLyricSynced || state.activeLyricIndex < 0) {
    return;
  }

  if (getActiveView() === "immersivePlayer") {
    const immersiveActiveItem = immersiveLyricLineElements[state.activeLyricIndex];

    if (immersiveActiveItem) {
      scrollElementIntoContainerView(immersiveLyricList, immersiveActiveItem);
      immersiveActiveItem.focus?.({ preventScroll: true });
    }
    return;
  }

  const activeItem = lyricLineElements[state.activeLyricIndex];

  if (activeItem) {
    scrollElementIntoContainerView(lyricsList, activeItem);
    activeItem.focus?.({ preventScroll: true });
  }
}

function renderImmersiveLyricFocus() {
  immersiveLyricList.replaceChildren();
  resetLyricProgressState();
  immersiveLyricActiveIndex = -1;
  immersiveLyricLineElements = [];
  immersiveLyricWordElements = [];
  immersiveLyricWordTimings = [];
  immersiveLyricWordEndTimings = [];

  const appendLine = (text, className = "") => {
    const line = document.createElement("p");
    line.className = className;
    line.textContent = text || " ";
    immersiveLyricList.append(line);
  };

  const appendLyricLine = (lyricLine, index) => {
    const line = document.createElement("p");
    const isActive = index === getVisibleImmersiveLyricIndex();
    line.className = "lyric-line";
    line.dataset.lyricIndex = String(index);
    line.classList.toggle("active", isActive);
    line.classList.toggle("seekable", state.isLyricSynced && Number.isFinite(lyricLine.time));
    const lineContent = appendImmersiveLyricLineContent(line, lyricLine);
    immersiveLyricWordElements[index] = lineContent.words;
    immersiveLyricWordTimings[index] = lineContent.timings;
    immersiveLyricWordEndTimings[index] = lineContent.endTimings;
    immersiveLyricLineElements[index] = line;
    if (state.isLyricSynced && Number.isFinite(lyricLine.time)) {
      line.tabIndex = 0;
      line.setAttribute("role", "button");
      line.setAttribute("aria-label", `跳转到 ${formatSeconds(lyricLine.time)}：${formatLyricLineLabel(lyricLine)}`);
      line.title = `跳转到 ${formatSeconds(lyricLine.time)}`;
      line.addEventListener("click", () => seekToLyricLine(index));
      line.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        seekToLyricLine(index);
      });
    }
    immersiveLyricList.append(line);
  };

  if (!state.currentTrack) {
    appendLine("播放歌曲后显示歌词。", "active");
    appendLine("可以继续使用底部播放器控制音乐。");
    return;
  }

  if (!state.lyricLines.length) {
    appendLine("暂无歌词", "active");
    appendLine("可以在 Emby 的歌曲元数据中添加歌词。");
    return;
  }

  state.lyricLines.forEach((line, index) => {
    appendLyricLine(line, index);
  });

  if (!state.isLyricSynced) {
    appendLine("歌词未带时间轴。", "hint");
  }

  updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
  syncLyricProgressLoop();
}

function getVisibleImmersiveLyricIndex() {
  return state.isLyricSynced && state.activeLyricIndex >= 0 ? state.activeLyricIndex : 0;
}

function appendImmersiveLyricLineContent(container, line) {
  const originalText = line?.originalText || line?.text || " ";
  const translatedText = line?.originalText ? line.text : "";
  const original = document.createElement("span");
  original.className = line?.originalText ? "immersive-lyric-original" : "immersive-lyric-original-fallback";
  const words = [];
  const timings = [];
  const endTimings = [];
  const wordParts = getLyricWordParts(line, originalText);

  wordParts.forEach((part) => {
    if (part.type === "space") {
      original.append(document.createTextNode(part.value));
      return;
    }

    const word = document.createElement("span");
    word.className = "word";
    word.textContent = part.value;
    word.dataset.wordText = part.value;
    if (Number.isFinite(part.time)) {
      word.dataset.wordTime = String(part.time);
    }
    if (Number.isFinite(part.endTime)) {
      word.dataset.wordEndTime = String(part.endTime);
    }
    word._lyricProgress = 0;
    word.style.setProperty("--word-progress", "0%");
    original.append(word);
    words.push(word);
    timings.push(Number.isFinite(part.time) ? Number(part.time) : NaN);
    endTimings.push(Number.isFinite(part.endTime) ? Number(part.endTime) : NaN);
  });

  if (!translatedText) {
    container.replaceChildren(original);
    return { words, timings, endTimings };
  }

  const translated = document.createElement("strong");
  translated.className = "immersive-lyric-translated";
  translated.textContent = translatedText;
  container.replaceChildren(original, translated);
  return { words, timings, endTimings };
}

function getLyricWordParts(line, fallbackText) {
  const timeline = Array.isArray(line?.wordTimeline) ? line.wordTimeline : [];

  if (!timeline.length) {
    return segmentLyricWords(fallbackText);
  }

  return timeline.flatMap((entry) => {
    const value = String(entry?.value || "");
    const leadingSpace = value.match(/^\s+/)?.[0] || "";
    const trailingSpace = value.match(/\s+$/)?.[0] || "";
    const text = value.trim();
    const parts = [];

    if (leadingSpace) {
      parts.push({ type: "space", value: leadingSpace });
    }

    if (text) {
      parts.push({
        type: "word",
        value: text,
        time: Number(entry.time),
        endTime: Number(entry.endTime),
      });
    }

    if (trailingSpace) {
      parts.push({ type: "space", value: trailingSpace });
    }

    return parts;
  });
}

function segmentLyricWords(text) {
  const value = String(text || " ");
  const parts = value.match(/[\u3400-\u9fff\uf900-\ufaff]|[^\s\u3400-\u9fff\uf900-\ufaff]+|\s+/g);

  return (parts?.length ? parts : [" "]).map((part) => ({
    type: /^\s+$/.test(part) ? "space" : "word",
    value: part,
  }));
}

function updateImmersiveLyricProgress(currentSeconds, shouldScroll = false, instantScroll = false) {
  if (!immersiveLyricList || !state.lyricLines.length) {
    return;
  }

  const activeIndex = getVisibleImmersiveLyricIndex();
  const activeItem = immersiveLyricLineElements[activeIndex];
  syncImmersiveLyricActiveClass(activeItem, activeIndex);
  updateImmersiveLineWordProgress(activeItem, activeIndex, currentSeconds);

  if (activeItem && shouldScroll && shouldScrollLyricLine(instantScroll)) {
    scrollElementIntoContainerView(immersiveLyricList, activeItem, {
      behavior: instantScroll ? "auto" : "smooth",
    });
  }
}

function syncImmersiveLyricActiveClass(activeItem, activeIndex) {
  if (immersiveLyricActiveIndex === activeIndex) {
    return;
  }

  immersiveLyricLineElements[immersiveLyricActiveIndex]?.classList.remove("active");
  activeItem?.classList.add("active");
  immersiveLyricActiveIndex = activeIndex;
}

function resetLyricProgressState() {
  clearLyricProgressResumeTimer();
  lyricProgressActiveIndex = -1;
  lyricProgressFullWordCount = -1;
  lyricProgressPartialWordIndex = -1;
}

function isImmersiveLyricsVisible() {
  return getActiveView() === "immersivePlayer"
    && immersivePlayerPanel?.classList.contains("active")
    && document.visibilityState !== "hidden";
}

function shouldRunLyricProgressLoop() {
  return state.isLyricSynced
    && state.lyricLines.length > 0
    && state.activeLyricIndex >= 0
    && isImmersiveLyricsVisible()
    && state.currentTrack
    && audioPlayer.src
    && !audioPlayer.paused
    && !audioPlayer.ended;
}

function syncLyricProgressLoop() {
  if (!shouldRunLyricProgressLoop()) {
    stopLyricProgressLoop();
    return;
  }

  if (lyricProgressResumeTimer) {
    return;
  }

  if (!lyricProgressFrame) {
    lyricProgressFrame = requestAnimationFrame(updateLyricProgressFrame);
  }
}

function stopLyricProgressLoop() {
  clearLyricProgressResumeTimer();

  if (lyricProgressFrame) {
    cancelAnimationFrame(lyricProgressFrame);
    lyricProgressFrame = 0;
  }
}

function clearLyricProgressResumeTimer() {
  if (!lyricProgressResumeTimer) {
    return;
  }

  window.clearTimeout(lyricProgressResumeTimer);
  lyricProgressResumeTimer = 0;
}

function updateLyricProgressFrame() {
  lyricProgressFrame = 0;

  if (!shouldRunLyricProgressLoop()) {
    return;
  }

  updateLyricsHighlight(getLyricPlaybackTimeSeconds());
}

function updateImmersiveLineWordProgress(activeItem, activeIndex, currentSeconds) {
  resetInactiveImmersiveWords(activeIndex);

  if (!activeItem) {
    return;
  }

  const words = immersiveLyricWordElements[activeIndex] || [];
  if (!words.length) {
    return;
  }

  if (!state.isLyricSynced) {
    words.forEach((word) => setLyricWordProgress(word, 100));
    lyricProgressFullWordCount = words.length;
    lyricProgressPartialWordIndex = -1;
    return;
  }

  const currentLine = state.lyricLines[activeIndex];
  const nextEntry = getNextLyricTimelineEntry(activeIndex);
  const start = Number(currentLine?.time);
  const lyricSeconds = getAdjustedLyricSeconds(currentSeconds);

  if (!Number.isFinite(start)) {
    updateLyricWordProgressWindow(words, words.length);
    return;
  }

  if (hasTimedLyricWords(activeIndex, words)) {
    updateTimedLyricWordProgress(activeIndex, words, lyricSeconds, nextEntry);
    return;
  }

  const end = getLyricWordProgressEndSeconds(start, nextEntry, words.length);
  const lineRatio = end > start
    ? clamp((lyricSeconds - start) / (end - start), 0, 1)
    : 1;
  const litWords = lineRatio * words.length;
  updateLyricWordProgressWindow(words, litWords);
  scheduleLyricProgressResumeIfIdle(lineRatio, lyricSeconds, nextEntry);
}

function hasTimedLyricWords(activeIndex, words) {
  const timings = getTimedLyricWordTimings(activeIndex, words);
  return timings.length === words.length
    && timings.length > 0
    && areTimedLyricWordTimingsUsable(timings);
}

function updateTimedLyricWordProgress(activeIndex, words, lyricSeconds, nextEntry) {
  const timings = getTimedLyricWordTimings(activeIndex, words);
  const endTimings = getTimedLyricWordEndTimings(activeIndex, words);
  const activeWordIndex = findTimedLyricWordIndex(timings, lyricSeconds);

  if (activeWordIndex < 0) {
    updateLyricWordProgressWindow(words, 0);
    return;
  }

  const start = timings[activeWordIndex];
  const nextWordStart = timings[activeWordIndex + 1];
  const explicitEnd = endTimings[activeWordIndex];
  const end = Number.isFinite(explicitEnd) && explicitEnd > start
    ? explicitEnd
    : Number.isFinite(nextWordStart)
    ? nextWordStart
    : getTimedLyricWordEndSeconds(words[activeWordIndex], start, nextEntry);
  const activeWordProgress = getTimedLyricWordProgress(lyricSeconds, start, end);
  const litWords = activeWordIndex + (activeWordProgress / 100);

  updateLyricWordProgressWindow(words, litWords);
  scheduleTimedLyricProgressResumeIfIdle(activeWordIndex >= words.length - 1 && activeWordProgress >= 100, lyricSeconds, nextEntry);
}

function getTimedLyricWordTimings(activeIndex, words) {
  const cached = immersiveLyricWordTimings[activeIndex] || [];

  if (cached.length === words.length) {
    return cached;
  }

  return words.map((word) => Number(word?.dataset?.wordTime));
}

function getTimedLyricWordEndTimings(activeIndex, words) {
  const cached = immersiveLyricWordEndTimings[activeIndex] || [];

  if (cached.length === words.length) {
    return cached;
  }

  return words.map((word) => Number(word?.dataset?.wordEndTime));
}

function areTimedLyricWordTimingsUsable(timings) {
  let previous = -Infinity;

  for (const time of timings) {
    if (!Number.isFinite(time) || time < previous) {
      return false;
    }

    previous = time;
  }

  return true;
}

function findTimedLyricWordIndex(timings, lyricSeconds) {
  if (!Number.isFinite(lyricSeconds) || !timings.length || lyricSeconds < timings[0]) {
    return -1;
  }

  let low = 0;
  let high = timings.length - 1;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (timings[middle] <= lyricSeconds) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function getTimedLyricWordEndSeconds(word, start, nextEntry) {
  if (Number.isFinite(nextEntry?.time) && nextEntry.time > start) {
    return nextEntry.time;
  }

  return start + Math.max(0.35, String(word?.textContent || "").length * 0.14);
}

function getTimedLyricWordProgress(lyricSeconds, start, end) {
  if (!Number.isFinite(start)) {
    return 0;
  }

  if (!Number.isFinite(end) || end <= start || lyricSeconds >= end) {
    return 100;
  }

  if (lyricSeconds < start) {
    return 0;
  }

  return Math.round(clamp((lyricSeconds - start) / (end - start), 0, 1) * 1000) / 10;
}

function scheduleTimedLyricProgressResumeIfIdle(isComplete, lyricSeconds, nextEntry) {
  if (!isComplete) {
    return;
  }

  scheduleLyricProgressResumeIfIdle(1, lyricSeconds, nextEntry);
}

function getLyricWordProgressEndSeconds(start, nextEntry, wordCount) {
  const fallbackDuration = Math.max(2.4, wordCount * 0.22);
  const actualDuration = Number.isFinite(nextEntry?.time) ? nextEntry.time - start : fallbackDuration;
  const duration = clamp(
    Number.isFinite(actualDuration) && actualDuration > 0 ? actualDuration : fallbackDuration,
    LYRIC_WORD_MIN_LINE_DURATION_SECONDS,
    LYRIC_WORD_MAX_LINE_DURATION_SECONDS
  );

  return start + duration;
}

function scheduleLyricProgressResumeIfIdle(lineRatio, lyricSeconds, nextEntry) {
  if (lineRatio < 1 || !Number.isFinite(nextEntry?.time) || !shouldRunLyricProgressLoop()) {
    return;
  }

  const delayMs = getLyricProgressIdleResumeDelayMs(lineRatio, lyricSeconds, nextEntry);
  if (!delayMs) {
    return;
  }

  if (lyricProgressFrame) {
    cancelAnimationFrame(lyricProgressFrame);
    lyricProgressFrame = 0;
  }

  lyricProgressResumeTimer = window.setTimeout(resumeLyricProgressAfterIdle, delayMs);
}

function getLyricProgressIdleResumeDelayMs(lineRatio, lyricSeconds, nextEntry) {
  if (lineRatio < 1 || !Number.isFinite(nextEntry?.time)) {
    return 0;
  }

  const secondsUntilNextLine = nextEntry.time - lyricSeconds;
  if (!Number.isFinite(secondsUntilNextLine) || secondsUntilNextLine <= 0) {
    return 0;
  }

  const delayMs = Math.max(0, (secondsUntilNextLine * 1000) - LYRIC_PROGRESS_RESUME_LEAD_MS);
  if (delayMs < LYRIC_PROGRESS_IDLE_MIN_DELAY_MS) {
    return 0;
  }

  return Math.round(delayMs);
}

function resumeLyricProgressAfterIdle() {
  lyricProgressResumeTimer = 0;
  if (!shouldRunLyricProgressLoop()) {
    return;
  }

  syncLyricPlaybackClock();
  updateLyricsHighlight(getLyricPlaybackTimeSeconds());
  syncLyricProgressLoop();
}

function updateLyricWordProgressWindow(words, litWords) {
  const nextFullWordCount = Math.min(words.length, Math.max(0, Math.floor(litWords)));
  const nextPartialWordIndex = nextFullWordCount < words.length ? nextFullWordCount : -1;
  const nextPartialProgress = nextPartialWordIndex >= 0
    ? Math.round(clamp(litWords - nextPartialWordIndex, 0, 1) * 1000) / 10
    : 0;
  const previousFullWordCount = lyricProgressFullWordCount;
  const previousPartialWordIndex = lyricProgressPartialWordIndex;

  if (previousFullWordCount < 0) {
    words.forEach((word, index) => {
      const progress = index < nextFullWordCount
        ? 100
        : (index === nextPartialWordIndex ? nextPartialProgress : 0);
      setLyricWordProgress(word, progress);
    });
    lyricProgressFullWordCount = nextFullWordCount;
    lyricProgressPartialWordIndex = nextPartialWordIndex;
    return;
  }

  if (nextFullWordCount > previousFullWordCount) {
    for (let index = previousFullWordCount; index < nextFullWordCount; index += 1) {
      setLyricWordProgress(words[index], 100);
    }
  } else if (nextFullWordCount < previousFullWordCount) {
    for (let index = nextFullWordCount; index < previousFullWordCount; index += 1) {
      if (index !== nextPartialWordIndex) {
        setLyricWordProgress(words[index], 0);
      }
    }
  }

  if (previousPartialWordIndex >= 0 && previousPartialWordIndex !== nextPartialWordIndex) {
    const previousProgress = previousPartialWordIndex < nextFullWordCount ? 100 : 0;
    setLyricWordProgress(words[previousPartialWordIndex], previousProgress);
  }

  if (nextPartialWordIndex >= 0) {
    setLyricWordProgress(words[nextPartialWordIndex], nextPartialProgress);
  }

  lyricProgressFullWordCount = nextFullWordCount;
  lyricProgressPartialWordIndex = nextPartialWordIndex;
}

function getNextLyricTimelineEntry(activeIndex) {
  const cachedTimelineIndex = state.activeLyricTimelineIndex;
  const currentEntry = state.lyricTimeline[cachedTimelineIndex];

  if (currentEntry?.index === activeIndex) {
    return state.lyricTimeline[cachedTimelineIndex + 1] || null;
  }

  const activeTimelineIndex = state.lyricTimelineIndexByLineIndex[activeIndex] ?? -1;
  return activeTimelineIndex >= 0 ? state.lyricTimeline[activeTimelineIndex + 1] || null : null;
}

function resetInactiveImmersiveWords(activeIndex) {
  if (lyricProgressActiveIndex === activeIndex) {
    return;
  }

  const previousActiveIndex = lyricProgressActiveIndex;
  lyricProgressActiveIndex = activeIndex;
  lyricProgressFullWordCount = -1;
  lyricProgressPartialWordIndex = -1;
  (immersiveLyricWordElements[previousActiveIndex] || []).forEach((word) => {
    setLyricWordProgress(word, 0);
  });
}

function setLyricWordProgress(word, percent) {
  if (!word) {
    return;
  }

  const normalizedPercent = clamp(Number(percent) || 0, 0, 100);
  const lastPercent = Number.isFinite(word._lyricProgress) ? word._lyricProgress : -1;

  if (Math.abs(lastPercent - normalizedPercent) < LYRIC_PROGRESS_EPSILON) {
    return;
  }

  word._lyricProgress = normalizedPercent;
  word.style.setProperty("--word-progress", `${normalizedPercent}%`);
  word.style.setProperty("--word-progress-ratio", String(normalizedPercent / 100));
}

function renderUpNext() {
  renderUpNextList(upNextList, 6);
  renderImmersiveQueue();
}

function renderUpNextList(container, limit) {
  container.replaceChildren();

  if (!state.queue.length || state.currentTrackIndex < 0) {
    container.innerHTML = emptyMarkup("暂无后续播放。");
    return;
  }

  const nextItems = getUpcomingTracks(limit);

  if (!nextItems.length) {
    container.innerHTML = emptyMarkup("当前已经是队列最后一首。");
    return;
  }

  nextItems.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "up-next-item";
    button.addEventListener("click", () => playTrack(track, state.queue));

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");

    const copy = document.createElement("span");
    copy.className = "up-next-copy";

    const title = document.createElement("strong");
    title.textContent = track.Name || "未命名歌曲";

    const subtitle = document.createElement("span");
    subtitle.textContent = getArtists(track) || "未知艺人";

    const duration = document.createElement("em");
    duration.textContent = formatTicks(track.RunTimeTicks);

    copy.append(title, subtitle);
    button.append(number, copy, duration);
    container.append(button);
  });
}

function renderImmersiveQueue() {
  immersiveUpNextList.replaceChildren();

  if (!state.queue.length) {
    immersiveUpNextList.innerHTML = emptyMarkup("播放队列为空。");
    return;
  }

  state.queue.forEach((track, index) => {
    const isActive = track.Id === state.currentTrack?.Id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "immersive-queue-item";
    button.dataset.trackId = track.Id;
    button.classList.toggle("active", isActive);
    button.classList.toggle("next", index === state.currentTrackIndex + 1);
    button.addEventListener("pointermove", updateHomeTrackRippleOrigin);
    button.addEventListener("pointerenter", updateHomeTrackRippleOrigin);
    button.addEventListener("click", () => playTrack(track, state.queue));

    const number = document.createElement("span");
    number.className = "immersive-queue-number";
    number.textContent = isActive ? "▶" : String(index + 1).padStart(2, "0");

    const cover = document.createElement("span");
    cover.className = `immersive-queue-cover ${coverClass(index)}`;
    appendImage(cover, getTrackImageUrl(track, 120), track.Name);

    const copy = document.createElement("span");
    copy.className = "immersive-queue-copy";

    const title = document.createElement("strong");
    title.textContent = track.Name || "未命名歌曲";

    const subtitle = document.createElement("span");
    subtitle.textContent = [getArtists(track), track.Album].filter(Boolean).join(" · ") || "未知艺人";

    const duration = document.createElement("em");
    duration.textContent = isActive ? "正在播放" : formatTicks(track.RunTimeTicks);

    copy.append(title, subtitle);
    button.append(number, cover, copy, duration);
    immersiveUpNextList.append(button);
  });

  scrollActiveImmersiveQueueItem();
}

function scrollActiveImmersiveQueueItem() {
  if (!state.isImmersiveQueueOpen) {
    return;
  }

  requestAnimationFrame(() => {
    const activeItem = immersiveUpNextList.querySelector(".immersive-queue-item.active");

    if (activeItem) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function locateCurrentImmersiveQueueTrack() {
  if (!state.currentTrack?.Id || !state.queue.length) {
    setLibraryStatus("当前没有可定位的播放歌曲。");
    return;
  }

  const activeItem = immersiveUpNextList.querySelector(".immersive-queue-item.active");

  if (!activeItem) {
    setLibraryStatus("当前歌曲不在沉浸队列中。");
    return;
  }

  activeItem.scrollIntoView({ block: "center", behavior: "smooth" });
  activeItem.classList.add("located");
  setTimeout(() => activeItem.classList.remove("located"), 1000);
  setLibraryStatus("已在沉浸队列定位当前歌曲。");
}

function getUpcomingTracks(limit) {
  if (!state.queue.length || state.currentTrackIndex < 0) {
    return [];
  }

  if (state.playMode === "shuffle" && state.queue.length > 1) {
    refillShuffleUpcomingQueue(Math.min(limit, state.queue.length - 1));
    return state.shuffleUpcomingIds
      .map(getQueueTrackById)
      .filter((track) => track && track.Id !== state.currentTrack?.Id)
      .slice(0, limit);
  }

  const tracks = [];
  const maxCount = Math.min(limit, state.queue.length - 1);

  for (let offset = 1; offset <= maxCount; offset += 1) {
    const rawIndex = state.currentTrackIndex + offset;

    if (rawIndex >= state.queue.length && state.playMode !== "repeat-all" && state.playMode !== "shuffle") {
      break;
    }

    const index = rawIndex % state.queue.length;
    const track = state.queue[index];

    if (track?.Id !== state.currentTrack?.Id) {
      tracks.push(track);
    }
  }

  return tracks;
}

function renderRecent() {
  const recentTracks = getVisibleRecentTracks();

  recentMeta.textContent = getRecentMetaText(recentTracks);
  clearRecentButton.disabled = !state.recentTracks.length;
  playRecentButton.disabled = !recentTracks.length;
  queueRecentButton.disabled = !recentTracks.length;
  renderTrackList(recentPlayedList, recentTracks, {
    emptyText: hasActiveRecentFilter() ? "没有匹配的最近播放记录。" : "还没有最近播放记录。播放一首歌后会出现在这里。",
  });
  renderSettings();
}

function hasActiveRecentFilter() {
  return Boolean(state.query || state.genreFilter || state.yearFilter || state.qualityFilter);
}

function getVisibleRecentTracks() {
  return state.recentTracks.filter((track) => matchesTrackFilters(track, {
    includeDetailFilters: false,
  }));
}

function openSearchResults(rawQuery = searchInput.value) {
  const query = String(rawQuery || "").trim();

  if (!query) {
    closeSearchSuggestions();
    setLibraryStatus("请输入关键词后再搜索。");
    return;
  }

  clearTimeout(state.serverSearchTimer);
  state.query = query.toLowerCase();
  state.searchResultQuery = query;
  state.searchSourceFilter = "";
  state.albumFilter = null;
  state.artistFilter = null;
  searchInput.value = query;
  closeSearchSuggestions();
  saveSearchHistoryQuery(query);
  applyFilters();
  renderLibrary();
  switchView("search", { resetScroll: true });
  runServerSearch(query);
}

function renderSearchResults() {
  if (!searchTrackList || !searchResultTitle || !searchResultMeta || !searchSourceFilters) {
    return;
  }

  const query = state.searchResultQuery || searchInput.value.trim();
  const sourceOptions = getSearchSourceOptions();
  ensureSearchSourceFilter(sourceOptions);
  const visibleTracks = getVisibleSearchTracks();
  const totalMatches = getBaseSearchTracks().length;
  const collectionResults = getSearchCollectionResults();

  searchResultTitle.textContent = query ? `“${query}”的搜索结果` : "搜索结果";
  searchResultMeta.textContent = getSearchResultMetaText(query, totalMatches, visibleTracks.length, sourceOptions.length, collectionResults);
  playSearchResultsButton.disabled = !visibleTracks.length;
  queueSearchResultsButton.disabled = !visibleTracks.length;
  renderSearchSourceFilters(sourceOptions, totalMatches);
  renderTrackList(searchTrackList, visibleTracks, {
    context: "search",
    emptyText: getSearchEmptyText(query),
  });
  scheduleExternalSearchQualityResolution(visibleTracks);
  renderSearchCollectionSection(searchAlbumSection, searchAlbumGrid, collectionResults.albums, "album");
  renderSearchCollectionSection(searchArtistSection, searchArtistGrid, collectionResults.artists, "artist");
  renderSearchCollectionSection(searchPlaylistSection, searchPlaylistGrid, collectionResults.playlists, "playlist");
}

function scheduleExternalSearchQualityResolution(tracks) {
  if (!isExternalSourceSession() || !Array.isArray(tracks) || !tracks.length) {
    return;
  }

  const token = externalSearchQualityResolveToken;
  const candidates = tracks
    .filter((track) => isExternalSourceTrack(track) && shouldResolveExternalTrackQuality(track))
    .slice(0, EXTERNAL_SEARCH_QUALITY_RESOLVE_LIMIT);

  candidates.forEach((track) => {
    const key = getExternalTrackQualityResolveKey(track);

    if (!key || externalSearchQualityResolveInFlight.has(key) || externalSearchQualityResolveDone.has(key)) {
      return;
    }

    externalSearchQualityResolveDone.add(key);
    setExternalTrackQualityState(track, "resolving");
    updateTrackQualityBadgeElements(track);
    externalSearchQualityResolveQueue.push({ track, key, token });
  });

  drainExternalSearchQualityResolveQueue();
}

function resetExternalSearchQualityResolution() {
  externalSearchQualityResolveToken += 1;
  externalSearchQualityResolveQueue.length = 0;
  externalSearchQualityResolveInFlight.clear();
  externalSearchQualityResolveDone.clear();
  externalSearchQualityResolveActiveCount = 0;
}

function shouldResolveExternalTrackQuality(track) {
  const external = track?.ExternalSource || {};

  if (external.qualityState === "resolved" || external.qualityState === "unknown" || external.qualityVerified) {
    return false;
  }

  return true;
}

function getExternalTrackQualityResolveKey(track) {
  const apiUrl = track?.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl();
  const quality = getExternalSearchQualityProbeRequest(track);
  return [apiUrl, track?.Id || track?.ExternalSource?.id || "", quality].filter(Boolean).join("::");
}

function drainExternalSearchQualityResolveQueue() {
  while (externalSearchQualityResolveActiveCount < EXTERNAL_SEARCH_QUALITY_RESOLVE_CONCURRENCY && externalSearchQualityResolveQueue.length) {
    const item = externalSearchQualityResolveQueue.shift();

    if (!item) {
      continue;
    }

    externalSearchQualityResolveActiveCount += 1;
    externalSearchQualityResolveInFlight.add(item.key);
    resolveExternalSearchTrackQuality(item.track, item.token)
      .catch(() => {
        setExternalTrackQualityState(item.track, "unknown");
        syncExternalTrackReference(item.track);
      })
      .finally(() => {
        externalSearchQualityResolveActiveCount = Math.max(0, externalSearchQualityResolveActiveCount - 1);
        externalSearchQualityResolveInFlight.delete(item.key);
        updateTrackQualityBadgeElements(item.track);
        drainExternalSearchQualityResolveQueue();
      });
  }
}

async function resolveExternalSearchTrackQuality(track, token) {
  const apiUrl = track?.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl();

  if (!apiUrl || token !== externalSearchQualityResolveToken) {
    return;
  }

  const probeQuality = getExternalSearchQualityProbeRequest(track);
  const media = await externalSourceApi.fetchMediaSource(apiUrl, track, {
    quality: probeQuality,
    videoQuality: isVideoTrack(track) ? probeQuality : "",
  });

  if (token !== externalSearchQualityResolveToken) {
    return;
  }

  applyExternalMediaMetadata(track, media, { qualityState: "resolved" });
  syncExternalTrackReference(track);
}

function getExternalSearchQualityProbeRequest(track) {
  return isVideoTrack(track) ? "video-4k" : "super";
}

function setExternalTrackQualityState(track, qualityState) {
  if (!isExternalSourceTrack(track)) {
    return;
  }

  track.ExternalSource = {
    ...(track.ExternalSource || {}),
    qualityState,
  };
}

function syncExternalTrackReference(track) {
  if (!track?.Id) {
    return;
  }

  syncTrackInCollection(state.tracks, track);
  syncTrackInCollection(state.filteredTracks, track);
  syncTrackInCollection(state.favoriteTracks, track);
  syncTrackInCollection(state.filteredFavoriteTracks, track);
  syncTrackInCollection(state.queue, track);
  syncTrackInCollection(state.recentTracks, track);
}

function syncTrackInCollection(collection, updatedTrack) {
  if (!Array.isArray(collection) || !updatedTrack?.Id) {
    return false;
  }

  const existing = collection.find((item) => item?.Id === updatedTrack.Id);

  if (!existing || existing === updatedTrack) {
    return false;
  }

  mergeTrackMetadata(existing, updatedTrack);
  return true;
}

function mergeTrackMetadata(target, source) {
  if (!target || !source) {
    return target;
  }

  if (source.ExternalSource) {
    target.ExternalSource = mergeDefinedObject(target.ExternalSource || {}, source.ExternalSource);
  }

  if (Array.isArray(source.MediaSources) && source.MediaSources.length && sourceHasQualityMetadata(source)) {
    target.MediaSources = source.MediaSources;
  }

  target.Type = source.Type || target.Type;
  target.MediaType = source.MediaType || target.MediaType;
  return target;
}

function mergeDefinedObject(target, source) {
  const merged = { ...(target || {}) };

  Object.entries(source || {}).forEach(([key, value]) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) {
      return;
    }

    merged[key] = value;
  });

  return merged;
}

function sourceHasQualityMetadata(track) {
  const external = track?.ExternalSource || {};
  const source = getPrimaryMediaSource(track);
  const stream = getPrimaryAudioStream(source);
  return Boolean(
    external.qualityVerified
      || external.qualityState === "resolved"
      || external.qualityState === "unknown"
      || external.codec
      || external.bitrate
      || external.sourceQuality
      || external.qualityLabel
      || external.resolution
      || source.Container
      || source.BitRate
      || source.SourceQuality
      || source.QualityLabel
      || source.Resolution
      || stream.Codec
      || stream.BitRate
  );
}

function updateTrackQualityBadgeElements(track) {
  if (!track?.Id || !searchTrackList) {
    return;
  }

  document.querySelectorAll(`.track-row[data-track-id="${escapeCssSelectorValue(track.Id)}"]`).forEach((row) => {
    const container = row.querySelector(".track-subtitle-wrap, .home-track-meta");

    if (!container) {
      return;
    }

    container.querySelectorAll(".track-quality-badge").forEach((badge) => badge.remove());
    const badge = createTrackQualityBadge(track);

    if (badge) {
      container.append(badge);
    }
  });
}

function escapeCssSelectorValue(value) {
  if (window.CSS?.escape) {
    return CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, "\\$&");
}

function getSearchResultMetaText(query, totalMatches, visibleCount, sourceCount, collectionResults = {}) {
  if (!query) {
    return "输入关键词后按 Enter 查看全部结果";
  }

  const albumCount = collectionResults.albums?.length || 0;
  const artistCount = collectionResults.artists?.length || 0;
  const playlistCount = collectionResults.playlists?.length || 0;
  const parts = [
    `${formatCount(visibleCount)} 首歌曲`,
    albumCount ? `${formatCount(albumCount)} 张专辑` : "",
    artistCount ? `${formatCount(artistCount)} 位艺人` : "",
    playlistCount ? `${formatCount(playlistCount)} 个歌单` : "",
    state.searchSourceFilter && totalMatches !== visibleCount ? `全部 ${formatCount(totalMatches)} 首` : "",
    totalMatches ? `${sourceCount || 1} 个来源` : "",
    state.isServerSearching ? "搜索中" : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function getSearchCollectionResults() {
  const query = String(state.searchResultQuery || searchInput.value || "").trim().toLowerCase();

  if (!query) {
    return { albums: [], artists: [], playlists: [] };
  }

  return {
    albums: sortAlbums(state.albums.filter((album) => matchesQuery(album, query))).slice(0, 12),
    artists: sortArtists(state.artists.filter((artist) => matchesQuery(artist, query))).slice(0, 12),
    playlists: sortPlaylists(state.playlists.filter((playlist) => matchesQuery(playlist, query))).slice(0, 12),
  };
}

function renderSearchCollectionSection(section, grid, items, type) {
  if (!section || !grid) {
    return;
  }

  section.hidden = !items.length;
  if (!items.length) {
    grid.replaceChildren();
    return;
  }

  if (type === "album") {
    renderAlbumGrid(grid, items, {
      searchEmptyText: "没有匹配的专辑。",
    });
  } else if (type === "artist") {
    renderArtistGrid(grid, items, {
      searchEmptyText: "没有匹配的艺人。",
    });
  } else {
    renderPlaylistGrid(grid, items, {
      searchEmptyText: "没有匹配的歌单。",
    });
  }
}

function getSearchEmptyText(query) {
  if (!query) {
    return "输入关键词后按 Enter 查看全部搜索结果。";
  }

  if (state.isServerSearching) {
    return `正在搜索“${query}”...`;
  }

  return state.searchSourceFilter
    ? "当前来源下没有匹配的歌曲。"
    : "没有找到匹配的歌曲，可以换个关键词再试。";
}

function getBaseSearchTracks() {
  const query = String(state.searchResultQuery || searchInput.value || "").trim().toLowerCase();

  if (!query) {
    return [];
  }

  return sortTracks(state.tracks.filter((track) => matchesQuery(track, query)));
}

function getVisibleSearchTracks() {
  const tracks = getBaseSearchTracks();
  const sourceKey = state.searchSourceFilter;

  if (!sourceKey) {
    return tracks;
  }

  return tracks.filter((track) => getSearchSourceInfo(track).key === sourceKey);
}

function getSearchSourceOptions() {
  const optionMap = new Map();

  getBaseSearchTracks().forEach((track) => {
    const source = getSearchSourceInfo(track);
    const current = optionMap.get(source.key) || { ...source, count: 0 };
    current.count += 1;
    optionMap.set(source.key, current);
  });

  return [...optionMap.values()].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return compareText(left.label, right.label);
  });
}

function getSearchSourceInfo(track) {
  if (isExternalSourceTrack(track)) {
    const external = track.ExternalSource || {};
    const raw = external.raw || {};
    const label = normalizeSearchSourceLabel([
      external.platform,
      raw.pluginName,
      raw.platform,
      raw.source,
      external.source,
    ].map((value) => String(value || "").trim()).find(Boolean) || "音乐桥");
    return {
      key: `external:${encodeURIComponent(label.toLowerCase())}`,
      label,
      priority: 20,
    };
  }

  return {
    key: isExternalSourceSession() ? "bridge-local" : "emby",
    label: isExternalSourceSession() ? "本地音乐" : "Emby",
    priority: isExternalSourceSession() ? 10 : 0,
  };
}

function normalizeSearchSourceLabel(label) {
  const text = String(label || "").trim();
  const lower = text.toLowerCase();

  if (!text || lower === "external" || lower === "source") {
    return "音乐桥";
  }

  if (lower === "local" || lower === "file" || lower === "folder") {
    return "本地音乐";
  }

  return text;
}

function renderSearchSourceFilters(sourceOptions, totalMatches) {
  searchSourceFilters.replaceChildren();

  const options = [
    { key: "", label: "全部", count: totalMatches },
    ...sourceOptions,
  ];

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-source-chip";
    button.dataset.sourceKey = option.key;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", state.searchSourceFilter === option.key ? "true" : "false");
    button.classList.toggle("active", state.searchSourceFilter === option.key);

    const label = document.createElement("span");
    label.textContent = option.label;
    const count = document.createElement("small");
    count.textContent = formatCount(option.count || 0);
    button.append(label, count);
    button.addEventListener("click", () => {
      state.searchSourceFilter = option.key;
      renderSearchResults();
    });
    searchSourceFilters.append(button);
  });
}

function ensureSearchSourceFilter(sourceOptions) {
  if (state.searchSourceFilter && !sourceOptions.some((option) => option.key === state.searchSourceFilter)) {
    state.searchSourceFilter = "";
  }
}

function handleSearch() {
  const rawQuery = searchInput.value.trim();
  state.query = rawQuery.toLowerCase();
  state.albumFilter = null;
  state.artistFilter = null;
  if (!rawQuery) {
    state.searchResultQuery = "";
    state.searchSourceFilter = "";
  }
  state.searchSuggestActiveIndex = -1;
  applyFilters();
  renderLibrary();
  renderSearchSuggestions();
  scheduleServerSearch(rawQuery);
}

function renderSearchSuggestions() {
  if (!searchSuggestPopover || !searchSuggestList || searchInput.disabled) {
    return;
  }

  const query = searchInput.value.trim();

  if (query.length < 1) {
    closeSearchSuggestions();
    return;
  }

  searchSuggestList.replaceChildren();
  const groups = getSearchSuggestionGroups();
  const visibleGroups = groups.filter((group) => group.items.length);

  if (!visibleGroups.length) {
    searchSuggestList.append(createSearchSuggestEmpty(query));
  } else {
    visibleGroups.forEach((group) => {
      searchSuggestList.append(createSearchSuggestGroup(group));
    });
  }

  searchSuggestPopover.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
  syncSearchSuggestActiveItem();
}

function closeSearchSuggestions() {
  if (searchSuggestPopover) {
    searchSuggestPopover.hidden = true;
  }
  state.searchSuggestActiveIndex = -1;
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  clearSearchSuggestActiveItems();
}

function handleSearchSuggestKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    openSearchResults(searchInput.value);
    return;
  }

  if (!searchSuggestPopover || searchSuggestPopover.hidden) {
    if (event.key === "ArrowDown" && searchInput.value.trim()) {
      event.preventDefault();
      renderSearchSuggestions();
      moveSearchSuggestActive(1);
    }
    return;
  }

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      moveSearchSuggestActive(1);
      break;
    case "ArrowUp":
      event.preventDefault();
      moveSearchSuggestActive(-1);
      break;
    case "Home":
      event.preventDefault();
      setSearchSuggestActive(0);
      break;
    case "End":
      event.preventDefault();
      setSearchSuggestActive(getSearchSuggestMainItems().length - 1);
      break;
    default:
      break;
  }
}

function moveSearchSuggestActive(delta) {
  const items = getSearchSuggestMainItems();

  if (!items.length) {
    return;
  }

  const nextIndex = state.searchSuggestActiveIndex < 0
    ? (delta > 0 ? 0 : items.length - 1)
    : (state.searchSuggestActiveIndex + delta + items.length) % items.length;
  setSearchSuggestActive(nextIndex);
}

function setSearchSuggestActive(index) {
  const items = getSearchSuggestMainItems();

  if (!items.length) {
    state.searchSuggestActiveIndex = -1;
    clearSearchSuggestActiveItems();
    return;
  }

  state.searchSuggestActiveIndex = clamp(index, 0, items.length - 1);
  syncSearchSuggestActiveItem();
}

function syncSearchSuggestActiveItem() {
  const items = getSearchSuggestMainItems();

  if (!items.length) {
    state.searchSuggestActiveIndex = -1;
    searchInput.removeAttribute("aria-activedescendant");
    return;
  }

  if (state.searchSuggestActiveIndex >= items.length) {
    state.searchSuggestActiveIndex = items.length - 1;
  }

  clearSearchSuggestActiveItems();

  if (state.searchSuggestActiveIndex < 0) {
    searchInput.removeAttribute("aria-activedescendant");
    return;
  }

  const item = items[state.searchSuggestActiveIndex];
  item.classList.add("active");
  item.closest(".search-suggest-item")?.classList.add("active");
  searchInput.setAttribute("aria-activedescendant", item.id);
  item.scrollIntoView({ block: "nearest" });
}

function clearSearchSuggestActiveItems() {
  getSearchSuggestMainItems().forEach((item) => {
    item.classList.remove("active");
    item.closest(".search-suggest-item")?.classList.remove("active");
  });
}

function getSearchSuggestMainItems() {
  return searchSuggestList ? [...searchSuggestList.querySelectorAll(".search-suggest-main")] : [];
}

function getSearchSuggestionGroups() {
  const groups = [];

  if (!state.query) {
    groups.push({
      title: "最近搜索",
      icon: "recent",
      items: loadSearchHistory(),
      create: createRecentSearchSuggestionItem,
    });
  }

  return [
    ...groups,
    {
      title: "歌曲",
      icon: "play",
      items: state.filteredTracks.slice(0, 5),
      create: createTrackSuggestionItem,
    },
    {
      title: "专辑",
      icon: "album",
      items: state.filteredAlbums.slice(0, 4),
      create: (album) => createCollectionSuggestionItem(album, "album"),
    },
    {
      title: "艺人",
      icon: "artist",
      items: state.filteredArtists.slice(0, 4),
      create: (artist) => createCollectionSuggestionItem(artist, "artist"),
    },
    {
      title: "歌单",
      icon: "playlists",
      items: state.filteredPlaylists.slice(0, 4),
      create: (playlist) => createCollectionSuggestionItem(playlist, "playlist"),
    },
  ];
}

function createSearchSuggestGroup(group) {
  const section = document.createElement("section");
  section.className = "search-suggest-group";

  const heading = document.createElement("div");
  heading.className = "search-suggest-heading";
  heading.append(createActionIcon(group.icon));

  const title = document.createElement("strong");
  title.textContent = group.title;
  heading.append(title);
  section.append(heading);

  group.items.forEach((item) => {
    section.append(group.create(item));
  });

  return section;
}

function createSearchSuggestEmpty(query) {
  const empty = document.createElement("div");
  empty.className = "search-suggest-empty";
  empty.append(createActionIcon("search"));

  const copy = document.createElement("span");
  copy.textContent = state.isServerSearching
    ? `正在从${isExternalSourceSession() ? "外部音源" : "Emby"}搜索“${query}”...`
    : `没有找到“${query}”`;
  empty.append(copy);
  return empty;
}

function createRecentSearchSuggestionItem(query) {
  const item = document.createElement("div");
  item.className = "search-suggest-item";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-suggest-main";
  button.id = createSearchSuggestItemId("recent", query);
  button.addEventListener("click", () => applySearchHistoryQuery(query));

  const cover = document.createElement("span");
  cover.className = "search-suggest-cover search-suggest-icon-cover";
  cover.append(createActionIcon("search"));

  const copy = document.createElement("span");
  copy.className = "search-suggest-copy";
  const title = document.createElement("strong");
  title.textContent = query;
  const meta = document.createElement("span");
  meta.textContent = "再次搜索";
  copy.append(title, meta);
  button.append(cover, copy);

  const actions = document.createElement("span");
  actions.className = "search-suggest-actions";
  actions.append(createSearchSuggestAction("trash", "删除这条搜索", () => removeSearchHistoryQuery(query)));

  item.append(button, actions);
  return item;
}

function createTrackSuggestionItem(track) {
  const item = document.createElement("div");
  item.className = "search-suggest-item";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-suggest-main";
  button.id = createSearchSuggestItemId("track", track.Id);
  button.addEventListener("click", () => {
    closeSearchSuggestions();
    playTrack(track, state.filteredTracks.length ? state.filteredTracks : [track]);
  });

  const cover = document.createElement("span");
  cover.className = "search-suggest-cover";
  appendImage(cover, getTrackImageUrl(track, 120), track.Name);

  const copy = document.createElement("span");
  copy.className = "search-suggest-copy";
  const title = document.createElement("strong");
  title.textContent = track.Name || "未命名歌曲";
  const meta = document.createElement("span");
  meta.textContent = [getArtists(track) || "未知艺人", track.Album].filter(Boolean).join(" · ");
  copy.append(title, meta);
  button.append(cover, copy);

  const actions = document.createElement("span");
  actions.className = "search-suggest-actions";
  actions.append(
    createSearchSuggestAction("playNext", "下一首播放", () => addTrackToPlayNext(track)),
    createSearchSuggestAction("queueAdd", "加入队列", () => addTrackToQueue(track)),
  );

  item.append(button, actions);
  return item;
}

function createCollectionSuggestionItem(collection, type) {
  const item = document.createElement("div");
  item.className = "search-suggest-item";
  const config = {
    album: {
      coverClassName: "search-suggest-cover",
      image: () => getImageUrl(collection, 120),
      meta: () => getAlbumSubtitle(collection),
      open: () => openAlbumDetail(collection),
      play: () => playAlbumFromCard(collection),
      queue: () => queueAlbumFromCard(collection),
    },
    artist: {
      coverClassName: "search-suggest-cover round",
      image: () => getImageUrl(collection, 120),
      meta: () => "Artist",
      open: () => openArtistDetail(collection),
      play: () => playArtistFromCard(collection),
      queue: () => queueArtistFromCard(collection),
    },
    playlist: {
      coverClassName: "search-suggest-cover",
      image: () => getImageUrl(collection, 120),
      meta: () => getPlaylistSubtitle(collection),
      open: () => openPlaylistDetail(collection),
      play: () => playPlaylistFromCard(collection),
      queue: () => queuePlaylistFromCard(collection),
    },
  }[type];

  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-suggest-main";
  button.id = createSearchSuggestItemId(type, collection.Id);
  button.addEventListener("click", () => {
    closeSearchSuggestions();
    config.open();
  });

  const cover = document.createElement("span");
  cover.className = config.coverClassName;
  appendImage(cover, config.image(), collection.Name);

  const copy = document.createElement("span");
  copy.className = "search-suggest-copy";
  const title = document.createElement("strong");
  title.textContent = collection.Name || "未命名";
  const meta = document.createElement("span");
  meta.textContent = config.meta();
  copy.append(title, meta);
  button.append(cover, copy);

  const actions = document.createElement("span");
  actions.className = "search-suggest-actions";
  actions.append(
    createSearchSuggestAction("play", "播放", config.play),
    createSearchSuggestAction("queueAdd", "加入队列", config.queue),
  );

  item.append(button, actions);
  return item;
}

function createSearchSuggestItemId(type, id) {
  return `search-suggest-${type}-${String(id || Math.random().toString(36).slice(2)).replace(/[^a-z0-9_-]/gi, "-")}`;
}

function createSearchSuggestAction(icon, label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-suggest-action";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createActionIcon(icon));
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSearchSuggestions();

    try {
      await handler();
    } catch (error) {
      setLibraryStatus(`搜索快捷操作失败：${readableError(error)}`);
    }
  });
  return button;
}

function applySearchHistoryQuery(query) {
  searchInput.value = query;
  handleSearch();
  searchInput.focus();
}

function saveSearchHistoryQuery(query) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery || normalizedQuery.length < SERVER_SEARCH_MIN_LENGTH) {
    return;
  }

  const nextHistory = [
    normalizedQuery,
    ...loadSearchHistory().filter((item) => item.toLowerCase() !== normalizedQuery.toLowerCase()),
  ].slice(0, MAX_SEARCH_HISTORY_ITEMS);

  saveSearchHistory(nextHistory);
}

function removeSearchHistoryQuery(query) {
  saveSearchHistory(loadSearchHistory().filter((item) => item.toLowerCase() !== String(query || "").toLowerCase()));
  renderSearchSuggestions();
}

function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(getSearchHistoryStorageKey());
    const history = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, MAX_SEARCH_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  const normalizedHistory = Array.isArray(history)
    ? history.map((item) => String(item || "").trim()).filter(Boolean).slice(0, MAX_SEARCH_HISTORY_ITEMS)
    : [];
  const key = getSearchHistoryStorageKey();

  if (normalizedHistory.length) {
    localStorage.setItem(key, JSON.stringify(normalizedHistory));
  } else {
    localStorage.removeItem(key);
  }
}

function getSearchHistoryStorageKey() {
  const profileKey = storage.getAccountProfileKey(state.session);
  return profileKey
    ? `${SEARCH_HISTORY_KEY}/${encodeURIComponent(profileKey)}`
    : SEARCH_HISTORY_KEY;
}

function scheduleServerSearch(rawQuery) {
  clearTimeout(state.serverSearchTimer);

  if (!state.session || !state.isLibraryLoaded || rawQuery.length < SERVER_SEARCH_MIN_LENGTH) {
    state.isServerSearching = false;
    return;
  }

  if (rawQuery.toLowerCase() === state.lastServerSearchQuery.toLowerCase()) {
    return;
  }

  state.serverSearchTimer = setTimeout(() => {
    runServerSearch(rawQuery);
  }, SERVER_SEARCH_DEBOUNCE_MS);
}

async function runServerSearch(rawQuery) {
  if (!state.session || !rawQuery || rawQuery.length < SERVER_SEARCH_MIN_LENGTH) {
    return;
  }

  if (isExternalSourceSession()) {
    await runExternalSourceSearch(rawQuery);
    return;
  }

  const requestId = ++state.serverSearchRequestId;
  state.isServerSearching = true;
  renderSearchResults();
  setLibraryStatus(`正在从 Emby 搜索“${rawQuery}”...`);

  try {
    const response = await fetchPagedItems("Audio,MusicAlbum,MusicArtist,Playlist", 0, SERVER_SEARCH_LIMIT, {
      SearchTerm: rawQuery,
      SortBy: "SortName",
      SortOrder: "Ascending",
    });

    if (requestId !== state.serverSearchRequestId || rawQuery.toLowerCase() !== searchInput.value.trim().toLowerCase()) {
      return;
    }

    state.isServerSearching = false;
    mergeServerSearchResults(normalizeItems(response.Items));
    state.lastServerSearchQuery = rawQuery;
    saveSearchHistoryQuery(rawQuery);
    applyFilters();
    renderLibrary();
    if (getActiveView() !== "search") {
      renderSearchSuggestions();
    }
    setLibraryStatus("");
  } catch (error) {
    if (requestId !== state.serverSearchRequestId) {
      return;
    }

    state.isServerSearching = false;
    renderLibrary();
    showNotice(`服务器搜索失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试搜索", handler: () => runServerSearch(rawQuery) }],
    });
  } finally {
    if (requestId === state.serverSearchRequestId) {
      state.isServerSearching = false;
    }
  }
}

async function runExternalSourceSearch(rawQuery) {
  const requestId = ++state.serverSearchRequestId;
  const apiUrl = getSessionExternalSourceApiUrl(state.session);

  if (!apiUrl) {
    state.isServerSearching = false;
    setLibraryStatus("音乐桥未配置服务地址，暂时不能搜索。");
    return;
  }

  resetExternalSearchQualityResolution();
  state.isServerSearching = true;
  renderSearchResults();
  setLibraryStatus(`正在从音源桥搜索“${rawQuery}”...`);

  try {
    const response = await externalSourceApi.fetchTracks(apiUrl, {
      query: rawQuery,
      startIndex: 0,
      limit: SERVER_SEARCH_LIMIT,
    });

    if (requestId !== state.serverSearchRequestId || rawQuery.toLowerCase() !== searchInput.value.trim().toLowerCase()) {
      return;
    }

    state.isServerSearching = false;
    state.tracks = mergeUniqueItems(normalizeItems(response.Items), state.tracks);
    state.albums = mergeUniqueItems(state.albums, inferExternalAlbumsFromTracks(response.Items));
    state.totalTracks = Math.max(state.totalTracks, state.tracks.length, response.TotalRecordCount || 0);
    state.totalAlbums = Math.max(state.totalAlbums, state.albums.length);
    state.lastServerSearchQuery = rawQuery;
    saveSearchHistoryQuery(rawQuery);
    applyFilters();
    renderLibrary();
    if (getActiveView() !== "search") {
      renderSearchSuggestions();
    }
    setLibraryStatus("");
  } catch (error) {
    if (requestId !== state.serverSearchRequestId) {
      return;
    }

    state.isServerSearching = false;
    renderLibrary();
    showNotice(`音源桥搜索失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试搜索", handler: () => runExternalSourceSearch(rawQuery) }],
    });
  } finally {
    if (requestId === state.serverSearchRequestId) {
      state.isServerSearching = false;
    }
  }
}

function mergeServerSearchResults(items) {
  const tracks = [];
  const albums = [];
  const artists = [];
  const playlists = [];

  items.forEach((item) => {
    if (item.Type === "Audio") {
      tracks.push(item);
    } else if (item.Type === "MusicAlbum") {
      albums.push(item);
    } else if (item.Type === "MusicArtist") {
      artists.push(item);
    } else if (item.Type === "Playlist") {
      playlists.push(item);
    }
  });

  state.tracks = mergeUniqueItems(state.tracks, tracks);
  state.albums = mergeUniqueItems(mergeUniqueItems(state.albums, albums), inferExternalAlbumsFromTracks(tracks));
  state.artists = mergeUniqueItems(state.artists, artists);
  state.playlists = mergeUniqueItems(state.playlists, normalizePlaylists(playlists));
  state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, tracks.filter(isFavorite));
}

function handleSortChange() {
  state.sortKey = SORT_KEYS.includes(sortSelect.value) ? sortSelect.value : "recent";
  storage.saveSortKey(state.sortKey);
  applyFilters();
  renderLibrary();
  setLibraryStatus(`排序字段：${getSortKeyLabel(state.sortKey)}。`);
}

function handleSortOrderChange() {
  state.sortOrder = SORT_ORDERS.includes(sortOrderSelect.value)
    ? sortOrderSelect.value
    : "default";
  storage.saveSortOrder(state.sortOrder);
  applyFilters();
  renderLibrary();
  setLibraryStatus(`排序方向：${getSortOrderLabel(state.sortOrder)}。`);
}

function handleGenreChange() {
  state.genreFilter = genreSelect.value;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
}

function handleYearChange() {
  state.yearFilter = yearSelect.value;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
}

function handleQualityChange() {
  state.qualityFilter = qualitySelect.value;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
}

function handleFavoriteFilterChange() {
  state.favoriteFilter = favoriteFilterSelect.value;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
}

function handleTrackDensityChange() {
  const nextDensity = TRACK_DENSITIES.includes(trackDensitySelect.value)
    ? trackDensitySelect.value
    : "comfortable";

  state.trackDensity = nextDensity;
  storage.saveTrackDensity(nextDensity);
  applyTrackDensityPreference();
  renderLibraryQuickPanel();
  renderSettings();
  setLibraryStatus(`列表密度：${getTrackDensityLabel(nextDensity)}。`);
}

function toggleQuickFavoriteFilter() {
  state.favoriteFilter = state.favoriteFilter === "favorite" ? "" : "favorite";
  favoriteFilterSelect.value = state.favoriteFilter;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
  setLibraryStatus(state.favoriteFilter ? "已只显示收藏内容。" : "已取消收藏筛选。");
}

function toggleQuickLosslessFilter() {
  state.qualityFilter = state.qualityFilter === "lossless" ? "" : "lossless";
  qualitySelect.value = state.qualityFilter;
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
  setLibraryStatus(state.qualityFilter ? "已只显示无损歌曲。" : "已取消音质筛选。");
}

function applyQuickRecentSort() {
  const isRecentSort = state.sortKey === "recent" && state.sortOrder === "default";

  state.sortKey = "recent";
  state.sortOrder = isRecentSort ? "desc" : "default";
  sortSelect.value = state.sortKey;
  sortOrderSelect.value = state.sortOrder;
  storage.saveSortKey(state.sortKey);
  storage.saveSortOrder(state.sortOrder);
  applyFilters();
  renderLibrary();
  setLibraryStatus(`已按最近添加${state.sortOrder === "desc" ? "倒序" : ""}排列。`);
}

function toggleQuickCompactDensity() {
  const nextDensity = state.trackDensity === "compact" ? "comfortable" : "compact";

  state.trackDensity = nextDensity;
  trackDensitySelect.value = nextDensity;
  storage.saveTrackDensity(nextDensity);
  applyTrackDensityPreference();
  renderLibraryQuickPanel();
  renderSettings();
  setLibraryStatus(`列表密度：${getTrackDensityLabel(nextDensity)}。`);
}

function handlePlayerMetaTargetChange() {
  const nextTarget = PLAYER_META_TARGETS.includes(playerMetaTargetSelect.value)
    ? playerMetaTargetSelect.value
    : "immersive";

  state.playerMetaTarget = nextTarget;
  storage.savePlayerMetaTarget(nextTarget);
  renderSettings();
  setLibraryStatus(`底栏封面点击：${getPlayerMetaTargetLabel(nextTarget)}。`);
}

function openConfiguredPlayerMetaTarget() {
  state.immersiveReturnView = getActiveView() === "immersivePlayer" ? "home" : getActiveView();
  switchView(state.playerMetaTarget === "nowPlaying" ? "nowPlaying" : "immersivePlayer");
}

function openMobileImmersivePlayer() {
  if (!state.currentTrack) {
    return;
  }

  state.immersiveReturnView = getActiveView() === "immersivePlayer" ? "home" : getActiveView();
  switchView("immersivePlayer");
}

function closeImmersivePlayer() {
  closeImmersiveQueue({ restoreFocus: false });
  setImmersiveZenMode(false);
  switchView(hasView(state.immersiveReturnView) ? state.immersiveReturnView : "home");
}

function toggleImmersiveZenMode() {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  setImmersiveZenMode(!shell?.classList.contains("is-zen-mode"));
}

function setImmersiveZenMode(isEnabled) {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");

  if (!shell) {
    return;
  }

  shell.classList.toggle("is-zen-mode", Boolean(isEnabled));
  immersiveZenButton?.setAttribute("aria-pressed", isEnabled ? "true" : "false");
  immersiveZenButton?.setAttribute("aria-label", isEnabled ? "关闭纯享无干扰模式" : "开启纯享无干扰模式");
  if (isEnabled) {
    closeImmersiveQueue({ restoreFocus: false });
  }
}

function cycleImmersiveBackgroundMode() {
  const modes = ["original", "fluid", "stage"];
  const currentIndex = modes.indexOf(state.immersiveBackgroundMode);
  state.immersiveBackgroundMode = modes[(currentIndex + 1) % modes.length];
  applyImmersiveBackgroundMode();
}

function applyImmersiveBackgroundMode() {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const mode = ["original", "fluid", "stage"].includes(state.immersiveBackgroundMode)
    ? state.immersiveBackgroundMode
    : "original";
  const labelMap = {
    original: "原始",
    fluid: "流体",
    stage: "舞台光",
  };

  if (!shell) {
    return;
  }

  shell.classList.toggle("is-fluid-bg", mode === "fluid");
  shell.classList.toggle("is-stage-bg", mode === "stage");
  immersiveBackgroundButton?.setAttribute("aria-label", `背景样式：${labelMap[mode]}`);
  immersiveBackgroundButton?.setAttribute("aria-pressed", mode === "original" ? "false" : "true");
  immersiveBackgroundButton?.setAttribute("title", `背景样式：${labelMap[mode]}`);
}

function toggleImmersiveQueue() {
  if (state.isImmersiveQueueOpen) {
    closeImmersiveQueue();
    return;
  }

  openImmersiveQueue();
}

function openImmersiveQueue() {
  if (!state.queue.length) {
    setLibraryStatus("播放队列为空。");
    return;
  }

  state.isImmersiveQueueOpen = true;
  renderImmersiveQueue();
  immersiveQueueDrawer.hidden = false;
  immersiveQueueButton.setAttribute("aria-expanded", "true");
}

function closeImmersiveQueue(options = {}) {
  if (!state.isImmersiveQueueOpen && immersiveQueueDrawer.hidden) {
    return;
  }

  state.isImmersiveQueueOpen = false;
  immersiveQueueDrawer.hidden = true;
  immersiveQueueButton.setAttribute("aria-expanded", "false");

  if (options.restoreFocus !== false && getActiveView() === "immersivePlayer") {
    immersiveQueueButton.focus();
  }
}

function toggleQuickQueue() {
  if (state.isQuickQueueOpen) {
    closeQuickQueue();
    return;
  }

  openQuickQueue();
}

function toggleActiveQueueView() {
  if (getActiveView() === "immersivePlayer") {
    toggleImmersiveQueue();
    return;
  }

  toggleQuickQueue();
}

function openQuickQueue() {
  if (!state.queue.length) {
    setLibraryStatus("播放队列为空。");
    return;
  }

  closeAccountMenu();
  closeTrackActionSheet({ restoreFocus: false });
  closeImmersiveQueue({ restoreFocus: false });
  state.isQuickQueueOpen = true;
  state.quickQueueReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : queueButton;
  renderQuickQueue();
  quickQueuePopover.hidden = false;
  queueButton.setAttribute("aria-expanded", "true");
  mobilePlayerQueueButton.setAttribute("aria-expanded", "true");
  queueButton.classList.add("active");
  mobilePlayerQueueButton.classList.add("active");
  quickQueueCloseButton.focus();
}

function closeQuickQueue(options = {}) {
  if (!state.isQuickQueueOpen && quickQueuePopover.hidden) {
    return;
  }

  state.isQuickQueueOpen = false;
  quickQueuePopover.hidden = true;
  queueButton.setAttribute("aria-expanded", "false");
  mobilePlayerQueueButton.setAttribute("aria-expanded", "false");
  queueButton.classList.remove("active");
  mobilePlayerQueueButton.classList.remove("active");

  if (options.restoreFocus !== false && state.quickQueueReturnFocus) {
    state.quickQueueReturnFocus.focus();
  }

  state.quickQueueReturnFocus = null;
}

function toggleImmersiveFullscreen() {
  if (!document.fullscreenElement) {
    immersivePlayerPanel.requestFullscreen?.().catch(() => {
      setLibraryStatus("当前浏览器不允许进入全屏。");
    });
    return;
  }

  document.exitFullscreen?.();
}

function getPlayerMetaTargetLabel(target = state.playerMetaTarget) {
  return PLAYER_META_TARGET_LABELS[target] || PLAYER_META_TARGET_LABELS.immersive || "沉浸播放页";
}

async function handleLibraryViewChange() {
  if (!state.session) {
    return;
  }

  state.libraryViewId = libraryViewSelect.value;
  saveLibraryViewId(state.libraryViewId);
  setLibraryStatus("正在切换音乐库...");
  await loadMusicLibrary(state.session);
}

function removeFilter(key) {
  if (key === "query") {
    clearTimeout(state.serverSearchTimer);
    state.serverSearchRequestId += 1;
    state.isServerSearching = false;
    state.query = "";
    searchInput.value = "";
  } else if (key === "album") {
    state.albumFilter = null;
  } else if (key === "artist") {
    state.artistFilter = null;
  } else if (key === "genre") {
    state.genreFilter = "";
    genreSelect.value = "";
    saveCurrentFilterState();
  } else if (key === "year") {
    state.yearFilter = "";
    yearSelect.value = "";
    saveCurrentFilterState();
  } else if (key === "quality") {
    state.qualityFilter = "";
    qualitySelect.value = "";
    saveCurrentFilterState();
  } else if (key === "favorite") {
    state.favoriteFilter = "";
    favoriteFilterSelect.value = "";
    saveCurrentFilterState();
  }

  applyFilters();
  renderLibrary();
  setLibraryStatus("");
}

function handlePlaybackStreamPolicyChange() {
  const nextPolicy = PLAYBACK_STREAM_POLICIES.includes(playbackStreamSelect.value)
    ? playbackStreamSelect.value
    : "auto";

  state.playbackStreamPolicy = nextPolicy;
  if (nextPolicy === "direct") {
    state.audioQualityProfileId = "direct-flac";
  } else if (nextPolicy === "transcode" && getAudioQualityProfile().mode === "direct") {
    state.audioQualityProfileId = DEFAULT_AUDIO_QUALITY_PROFILE.id;
  }
  storage.savePlaybackStreamPolicy(nextPolicy);
  storage.saveAudioQualityProfile(state.audioQualityProfileId);
  clearPreload();
  renderAudioQualityButton();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  setLibraryStatus(`播放源策略：${PLAYBACK_STREAM_LABELS[nextPolicy] || nextPolicy}`);
}

function handleTranscodeBitrateChange() {
  const nextBitrate = normalizeTranscodeBitrate(transcodeBitrateSelect.value);

  state.transcodeBitrate = nextBitrate;
  const matchedProfile = AUDIO_QUALITY_PROFILES.find((profile) => profile.bitrate === nextBitrate && profile.audioCodec === "aac")
    || AUDIO_QUALITY_PROFILES.find((profile) => profile.bitrate === nextBitrate && profile.mode !== "direct");
  if (matchedProfile) {
    state.audioQualityProfileId = matchedProfile.id;
  }
  storage.saveTranscodeBitrate(nextBitrate);
  storage.saveAudioQualityProfile(state.audioQualityProfileId);
  clearPreload();
  renderAudioQualityButton();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  setLibraryStatus(`转码码率：${getTranscodeBitrateLabel(nextBitrate)}`);
}

function handlePlaybackPreloadToggleChange() {
  state.playbackPreloadEnabled = playbackPreloadToggle?.checked ?? true;
  storage.savePlaybackPreloadEnabled?.(state.playbackPreloadEnabled);

  if (state.playbackPreloadEnabled) {
    preloadNextTrack();
    setLibraryStatus("歌曲预加载已开启。");
  } else {
    clearPreload();
    setLibraryStatus("歌曲预加载已关闭。");
  }

  renderSettings();
}

function handlePlaybackLosslessPrecacheToggleChange() {
  state.playbackLosslessPrecacheEnabled = playbackLosslessPrecacheToggle?.checked ?? false;
  storage.savePlaybackLosslessPrecacheEnabled?.(state.playbackLosslessPrecacheEnabled);

  if (state.playbackLosslessPrecacheEnabled) {
    preloadNextTrack({ force: true });
    setLibraryStatus("无损预缓存已开启。");
  } else {
    clearPreload();
    preloadNextTrack();
    setLibraryStatus("无损预缓存已关闭。");
  }

  renderSettings();
}

function openAudioQualityModal() {
  if (audioQualityCloseTimer) {
    clearTimeout(audioQualityCloseTimer);
    audioQualityCloseTimer = 0;
  }

  renderAudioQualityOptions();
  audioQualityModal.classList.remove("is-closing");
  audioQualityModal.hidden = false;
  requestAnimationFrame(() => {
    audioQualityModal.classList.add("is-open");
    audioQualityClose.focus();
  });
}

function closeAudioQualityModal() {
  if (audioQualityModal.hidden || audioQualityCloseTimer) {
    return;
  }

  audioQualityModal.classList.remove("is-open");
  audioQualityModal.classList.add("is-closing");
  audioQualityCloseTimer = window.setTimeout(() => {
    audioQualityModal.hidden = true;
    audioQualityModal.classList.remove("is-closing");
    audioQualityCloseTimer = 0;
  }, 300);
}

function handleAudioQualityDocumentClick(event) {
  if (audioQualityModal.hidden || !(event.target instanceof Element)) {
    return;
  }

  if (
    audioQualityModal.querySelector(".audio-quality-card")?.contains(event.target)
    || audioQualityButton.contains(event.target)
    || mobilePlayerQualityButton.contains(event.target)
  ) {
    return;
  }

  closeAudioQualityModal();
}

function renderAudioQualityOptions() {
  if (isExternalSourceSession()) {
    renderExternalSourceQualityOptions();
    return;
  }

  const currentProfile = getAudioQualityProfile();
  audioQualitySubtitle.textContent = supportsNativeHls()
    ? "按网络环境选择直放、HLS、单文件转码、DirectStream 或 PCM/WAV。"
    : (window.Hls?.isSupported?.()
      ? "当前浏览器会通过 hls.js 播放 HLS 分片，也可切换到单文件流。"
      : "当前浏览器缺少 HLS 支持，HLS 失败时会切到兼容兜底。");
  renderAudioQualityCurrent(currentProfile);
  renderAudioQualityMethodSummary(currentProfile);
  audioQualityList.replaceChildren();

  AUDIO_QUALITY_METHOD_GROUPS.forEach((group) => {
    const profiles = AUDIO_QUALITY_PROFILES.filter((profile) => getAudioQualityMethodGroupId(profile) === group.id);

    if (!profiles.length) {
      return;
    }

  const section = document.createElement("section");
  section.className = "audio-quality-group";

    const header = document.createElement("div");
    header.className = "audio-quality-group-heading";

    const titleWrap = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = group.label;
    const format = document.createElement("span");
    format.textContent = group.format;
    titleWrap.append(title, format);

    const meta = document.createElement("small");
    meta.textContent = `${group.quality} · ${group.stability}`;
    header.append(titleWrap, meta);
    section.append(header);

    const options = document.createElement("div");
    options.className = "audio-quality-group-list";
    profiles.forEach((profile) => {
      options.append(createAudioQualityOption(profile));
    });
    section.append(options);
    audioQualityList.append(section);
  });
}

function renderExternalSourceQualityOptions() {
  const currentOption = getExternalSourceQualityOption();
  const currentVideoOption = getExternalSourceVideoQualityOption();
  const currentTrackQuality = getTrackQualitySummary(state.currentTrack);

  audioQualitySubtitle.textContent = "音乐桥会分别保存音频源站策略和 MV 清晰度，播放时按媒体类型自动请求。";
  renderExternalSourceQualityCurrent(currentOption, currentTrackQuality, currentVideoOption);
  renderExternalSourceQualityMethodSummary(currentOption);
  audioQualityList.replaceChildren();

  const section = document.createElement("section");
  section.className = "audio-quality-group external-source-quality-group";

  const header = document.createElement("div");
  header.className = "audio-quality-group-heading";

  const titleWrap = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "音乐桥源站策略";
  const format = document.createElement("span");
  format.textContent = "请求插件返回不同质量的源站地址，不使用 Emby 转码。";
  titleWrap.append(title, format);

  const meta = document.createElement("small");
  meta.textContent = "源站决定实际音质";
  header.append(titleWrap, meta);
  section.append(header);

  const options = document.createElement("div");
  options.className = "audio-quality-selected-source";
  options.append(createExternalSourceQualityOption(currentOption));
  section.append(options);
  audioQualityList.append(section);

  const videoSection = document.createElement("section");
  videoSection.className = "audio-quality-group external-video-quality-group";

  const videoHeader = document.createElement("div");
  videoHeader.className = "audio-quality-group-heading";

  const videoTitleWrap = document.createElement("div");
  const videoTitle = document.createElement("strong");
  videoTitle.textContent = "MV / 视频清晰度";
  const videoFormat = document.createElement("span");
  videoFormat.textContent = "只影响视频或 MV 结果，普通歌曲仍使用上方音频策略。";
  videoTitleWrap.append(videoTitle, videoFormat);

  const videoMeta = document.createElement("small");
  videoMeta.textContent = `当前 ${currentVideoOption.shortLabel}`;
  videoHeader.append(videoTitleWrap, videoMeta);
  videoSection.append(videoHeader);

  const videoOptions = document.createElement("div");
  videoOptions.className = "audio-quality-video-grid";
  EXTERNAL_SOURCE_VIDEO_QUALITY_OPTIONS.forEach((option) => {
    videoOptions.append(createExternalSourceVideoQualityOption(option));
  });
  videoSection.append(videoOptions);
  audioQualityList.append(videoSection);
}

function renderExternalSourceQualityCurrent(option = getExternalSourceQualityOption(), currentTrackQuality = getTrackQualitySummary(state.currentTrack), videoOption = getExternalSourceVideoQualityOption()) {
  if (!audioQualityCurrent) {
    return;
  }

  audioQualityCurrent.replaceChildren();
  [
    `音频：${option.label} · ${option.quality}`,
    `视频：${videoOption.quality}`,
    state.currentTrack ? `当前播放：${isVideoTrack(state.currentTrack) ? "视频/MV" : "音频"} · ${currentTrackQuality?.shortLabel || "源站返回"}` : "当前未播放",
    `来源：${state.session?.serverName || "音乐桥"}`,
    "无 Emby 转码",
  ].filter(Boolean).forEach((text, index) => {
    const item = document.createElement("span");
    item.className = index <= 1 || text.includes("当前播放") ? "active" : "";
    item.textContent = text;
    audioQualityCurrent.append(item);
  });
}

function renderExternalSourceQualityMethodSummary(currentOption = getExternalSourceQualityOption()) {
  if (!audioQualityMethodSummary) {
    return;
  }

  audioQualityMethodSummary.replaceChildren();
  EXTERNAL_SOURCE_QUALITY_OPTIONS.forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `audio-quality-method-item ${getAudioQualityToneClass(option.id)} ${option.id === currentOption.id ? "active" : ""}`.trim();
    item.setAttribute("aria-pressed", option.id === currentOption.id ? "true" : "false");
    item.addEventListener("click", () => selectExternalSourceQuality(option.id));

    const icon = document.createElement("span");
    icon.className = "audio-quality-method-icon";
    icon.append(createActionIcon(option.icon || "wave"));

    const title = document.createElement("strong");
    title.textContent = option.label;
    const format = document.createElement("span");
    format.textContent = option.quality;
    const meta = document.createElement("small");
    meta.textContent = option.stability;

    item.append(icon, title, format, meta);
    audioQualityMethodSummary.append(item);
  });
}

function createExternalSourceQualityOption(option) {
  const isActive = option.id === state.externalSourceQualityId;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `audio-quality-option ${getAudioQualityToneClass(option.id)} ${isActive ? "active" : ""}`.trim();
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.addEventListener("click", () => selectExternalSourceQuality(option.id));

  const icon = document.createElement("span");
  icon.className = "audio-quality-option-icon";
  icon.append(createActionIcon(option.icon || "wave"));

  const heading = document.createElement("span");
  heading.className = "audio-quality-heading";
  const title = document.createElement("strong");
  title.textContent = option.label;
  const quality = document.createElement("span");
  quality.textContent = option.quality;
  heading.append(title, quality);

  const badges = document.createElement("span");
  badges.className = "audio-quality-badges";
  [
    "音乐桥",
    option.stability,
    option.recommended ? "推荐" : "",
    option.id === "video" ? "MV/视频" : "",
  ].filter(Boolean).forEach((text) => {
    const badge = document.createElement("em");
    if (isActive || text === "推荐" || text === "MV/视频") {
      badge.className = "active";
    }
    badge.textContent = text;
    badges.append(badge);
  });

  const scene = document.createElement("span");
  scene.className = "audio-quality-scene";
  scene.textContent = option.scene;

  const content = document.createElement("span");
  content.className = "audio-quality-option-content";
  content.append(heading, badges, scene);

  const stateBadge = document.createElement("span");
  stateBadge.className = "audio-quality-option-state";
  stateBadge.append(createActionIcon(isActive ? "check" : "spark"));

  button.append(icon, content, stateBadge);
  return button;
}

function createExternalSourceVideoQualityOption(option) {
  const isActive = option.id === state.externalSourceVideoQualityId;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `audio-quality-video-option ${getAudioQualityToneClass(option.id)} ${isActive ? "active" : ""}`.trim();
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.addEventListener("click", () => selectExternalSourceVideoQuality(option.id));

  const label = document.createElement("strong");
  label.textContent = option.shortLabel;

  const meta = document.createElement("span");
  meta.textContent = `${option.label} · ${option.stability}`;

  const scene = document.createElement("small");
  scene.textContent = option.scene;

  button.append(label, meta, scene);
  return button;
}

function renderAudioQualityMethodSummary(currentProfile = getAudioQualityProfile()) {
  if (!audioQualityMethodSummary) {
    return;
  }

  audioQualityMethodSummary.replaceChildren();
  AUDIO_QUALITY_METHOD_GROUPS.forEach((group) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `audio-quality-method-item ${getAudioQualityToneClass(group.id)} ${group.id === getAudioQualityMethodGroupId(currentProfile) ? "active" : ""}`.trim();
    item.setAttribute("aria-pressed", group.id === getAudioQualityMethodGroupId(currentProfile) ? "true" : "false");
    item.addEventListener("click", () => {
      const target = AUDIO_QUALITY_PROFILES.find((profile) => getAudioQualityMethodGroupId(profile) === group.id);
      if (target) {
        selectAudioQualityProfile(target.id);
      }
    });

    const icon = document.createElement("span");
    icon.className = "audio-quality-method-icon";
    icon.append(createActionIcon(getAudioQualityMethodIcon(group.id)));

    const title = document.createElement("strong");
    title.textContent = group.label;
    const format = document.createElement("span");
    format.textContent = group.format;
    const meta = document.createElement("small");
    meta.textContent = `${group.quality} · ${group.stability}`;

    item.append(icon, title, format, meta);
    audioQualityMethodSummary.append(item);
  });
}

function renderAudioQualityCurrent(profile) {
  if (!audioQualityCurrent) {
    return;
  }

  const effectiveMethod = getEffectiveTranscodeMethodLabel(profile);
  const modeText = state.currentTrack
    ? `当前播放：${state.currentPlaybackMode === "universal" ? effectiveMethod : "直连"}`
    : "当前未播放";
  const fallbackText = state.qualityFallbackAttempted ? "已触发兼容兜底" : "未触发兜底";

  audioQualityCurrent.replaceChildren();
  [
    `${profile.label} · ${profile.codec} ${profile.bitrateLabel || "原码率"}`.trim(),
    `${getEffectiveTranscodeMethodLabel(profile)} · ${profile.transferFormat || profile.container || "原文件"}`,
    modeText,
    fallbackText,
  ].forEach((text, index) => {
    const item = document.createElement("span");
    item.className = index === 0 ? "active" : getAudioQualityStatusClass(text);
    item.textContent = text;
    audioQualityCurrent.append(item);
  });
}

function createAudioQualityOption(profile) {
  const isActive = profile.id === state.audioQualityProfileId;
  const toneClass = getAudioQualityToneClass(getAudioQualityMethodGroupId(profile));
  const button = document.createElement("button");
  button.type = "button";
  button.className = `audio-quality-option ${toneClass} ${isActive ? "active" : ""}`.trim();
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.addEventListener("click", () => selectAudioQualityProfile(profile.id));

  const icon = document.createElement("span");
  icon.className = "audio-quality-option-icon";
  icon.append(createActionIcon(getAudioQualityMethodIcon(getAudioQualityMethodGroupId(profile))));

  const heading = document.createElement("span");
  heading.className = "audio-quality-heading";
  const title = document.createElement("strong");
  title.textContent = getAudioQualityOptionTitle(profile);
  const codec = document.createElement("span");
  codec.textContent = [profile.codec, profile.bitrateLabel].filter(Boolean).join(" · ");
  heading.append(title, codec);

  const badges = document.createElement("span");
  badges.className = "audio-quality-badges";
  [
    getEffectiveTranscodeMethodLabel(profile),
    profile.transferFormat,
    profile.quality,
    profile.stability,
    profile.recommended ? "推荐默认" : "",
  ].filter(Boolean).forEach((text) => {
    const badge = document.createElement("em");
    if (isActive || text === "推荐默认") {
      badge.className = "active";
    }
    badge.textContent = text;
    badges.append(badge);
  });

  const scene = document.createElement("span");
  scene.className = "audio-quality-scene";
  scene.textContent = getAudioQualitySceneText(profile);

  const content = document.createElement("span");
  content.className = "audio-quality-option-content";
  content.append(heading, badges, scene);

  const stateBadge = document.createElement("span");
  stateBadge.className = "audio-quality-option-state";
  stateBadge.append(createActionIcon(isActive ? "check" : "spark"));

  button.append(icon, content, stateBadge);
  return button;
}

function getAudioQualityMethodIcon(groupId) {
  const iconMap = {
    direct: "wave",
    hls: "shield",
    http: "playNext",
    remux: "album",
    pcm: "wave",
  };

  return iconMap[groupId] || "spark";
}

function getAudioQualityToneClass(id) {
  const toneMap = {
    high: "tone-high",
    direct: "tone-high",
    standard: "tone-standard",
    hls: "tone-standard",
    lossless: "tone-lossless",
    http: "tone-lossless",
    low: "tone-low",
    remux: "tone-low",
    video: "tone-video",
    "video-480": "tone-video-480",
    "video-720": "tone-video-720",
    "video-1080": "tone-video-1080",
    "video-4k": "tone-video-4k",
    pcm: "tone-video",
  };

  return toneMap[id] || "tone-high";
}

function getAudioQualityStatusClass(text) {
  if (text.includes("兜底")) {
    return text.includes("已触发") ? "warning" : "neutral";
  }

  if (text.includes("当前播放")) {
    return "active";
  }

  return "";
}

function selectAudioQualityProfile(profileId) {
  if (isExternalSourceSession()) {
    selectExternalSourceQuality(profileId);
    return;
  }

  const profile = AUDIO_QUALITY_PROFILES.find((item) => item.id === profileId) || DEFAULT_AUDIO_QUALITY_PROFILE;
  const previousProfileId = state.audioQualityProfileId;
  const shouldReloadCurrentTrack = Boolean(
    state.currentTrack
      && state.queue.length
      && audioPlayer.src
      && !audioPlayer.paused
      && !audioPlayer.ended
      && previousProfileId !== profile.id,
  );
  const resumePosition = getAudioCurrentTimeSeconds() || getRetryPositionSeconds();

  state.audioQualityProfileId = profile.id;
  state.playbackStreamPolicy = profile.mode === "direct" ? "direct" : "transcode";
  state.transcodeBitrate = profile.bitrate > 0 ? profile.bitrate : state.transcodeBitrate;
  storage.saveAudioQualityProfile(profile.id);
  storage.savePlaybackStreamPolicy(state.playbackStreamPolicy);
  storage.saveTranscodeBitrate(state.transcodeBitrate);
  clearPreload();
  renderAudioQualityButton();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  renderAudioQualityOptions();
  setLibraryStatus(shouldReloadCurrentTrack
    ? `正在应用音质：${profile.label} · ${profile.codec} ${profile.bitrateLabel || ""}`.trim()
    : `音质：${profile.label} · ${profile.codec} ${profile.bitrateLabel || ""}，下次播放生效。`.trim());

  if (shouldReloadCurrentTrack) {
    playTrack(state.currentTrack, state.queue, {
      positionSeconds: resumePosition,
    });
  }
}

function selectExternalSourceQuality(optionId) {
  const option = getExternalSourceQualityOption(optionId);
  const previousOptionId = state.externalSourceQualityId;
  const shouldReloadCurrentTrack = Boolean(
    state.currentTrack
      && isExternalSourceTrack(state.currentTrack)
      && state.queue.length
      && audioPlayer.src
      && !audioPlayer.paused
      && !audioPlayer.ended
      && !isVideoTrack(state.currentTrack)
      && previousOptionId !== option.id,
  );
  const resumePosition = getAudioCurrentTimeSeconds() || getRetryPositionSeconds();

  state.externalSourceQualityId = option.id;
  saveExternalSourceQualityId(option.id);
  clearPreload();
  renderAudioQualityButton();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  renderAudioQualityOptions();
  setLibraryStatus(shouldReloadCurrentTrack
    ? `正在应用音乐桥策略：${option.label}...`
    : `音乐桥策略：${option.label}，下次播放生效。`);

  if (shouldReloadCurrentTrack) {
    playTrack(state.currentTrack, state.queue, {
      positionSeconds: resumePosition,
    });
  }
}

function selectExternalSourceVideoQuality(optionId) {
  const option = getExternalSourceVideoQualityOption(optionId);
  const previousOptionId = state.externalSourceVideoQualityId;
  const shouldReloadCurrentTrack = Boolean(
    state.currentTrack
      && isExternalSourceTrack(state.currentTrack)
      && isVideoTrack(state.currentTrack)
      && state.queue.length
      && audioPlayer.src
      && !audioPlayer.paused
      && !audioPlayer.ended
      && previousOptionId !== option.id,
  );
  const resumePosition = getAudioCurrentTimeSeconds() || getRetryPositionSeconds();

  state.externalSourceVideoQualityId = option.id;
  saveExternalSourceVideoQualityId(option.id);
  clearPreload();
  renderAudioQualityButton();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  renderAudioQualityOptions();
  setLibraryStatus(shouldReloadCurrentTrack
    ? `正在应用 MV 清晰度：${option.quality}...`
    : `MV 清晰度：${option.quality}，下次播放视频生效。`);

  if (shouldReloadCurrentTrack) {
    playTrack(state.currentTrack, state.queue, {
      positionSeconds: resumePosition,
    });
  }
}

function handleContentScroll() {
  saveActiveViewScrollPosition();
  const distanceToBottom = content.scrollHeight - content.scrollTop - content.clientHeight;

  if (distanceToBottom > 520) {
    return;
  }

  const activePanel = document.querySelector(".view-panel.active")?.dataset.panel;

  if (activePanel === "library") {
    loadMoreTracks();
  } else if (activePanel === "albums") {
    loadMoreAlbums();
  } else if (activePanel === "artists") {
    loadMoreArtists();
  } else if (activePanel === "playlists") {
    loadMorePlaylists();
  } else if (activePanel === "favorites") {
    loadMoreFavorites();
  }
}

function handleBrowserOnline() {
  syncBrowserNetworkStatus();
}

function handleBrowserOffline() {
  syncBrowserNetworkStatus();
}

function syncBrowserNetworkStatus(options = {}) {
  const nextOnline = navigator.onLine !== false;

  if (state.isBrowserOnline === nextOnline && !options.silent) {
    renderSettings();
    return;
  }

  state.isBrowserOnline = nextOnline;
  renderSettings();

  if (nextOnline) {
    if (!options.silent) {
      setBadge("idle", state.session ? "网络恢复" : "未连接");
      showNotice("浏览器网络已恢复，可以重新测试连接或刷新音乐库。", {
        type: "success",
        actions: [
          { label: "测试连接", handler: testCurrentConnection },
          { label: "刷新音乐库", handler: refreshLibrary },
        ],
      });
    }
    return;
  }

  setBadge("error", "离线");

  if (!options.silent) {
    showNotice("浏览器当前处于离线状态，Emby 搜索、加载和播放可能失败。", {
      type: "error",
      actions: [{ label: "查看设置", handler: () => switchView("settings") }],
    });
  }
}

function clearSearchAndFilters() {
  clearTimeout(state.serverSearchTimer);
  state.serverSearchRequestId += 1;
  state.isServerSearching = false;
  state.query = "";
  state.searchResultQuery = "";
  state.searchSourceFilter = "";
  state.albumFilter = null;
  state.artistFilter = null;
  state.genreFilter = "";
  state.yearFilter = "";
  state.qualityFilter = "";
  state.favoriteFilter = "";
  searchInput.value = "";
  genreSelect.value = "";
  yearSelect.value = "";
  qualitySelect.value = "";
  favoriteFilterSelect.value = "";
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
  setLibraryStatus("");
}

async function refreshLibrary() {
  if (!state.session) {
    return;
  }

  await loadMusicLibrary(state.session);
}

async function loadMoreTracks() {
  if (!state.session || state.isLoadingMoreTracks || state.tracks.length >= state.totalTracks) {
    return;
  }

  if (isExternalSourceSession()) {
    await loadMoreExternalTracks();
    return;
  }

  state.isLoadingMoreTracks = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多歌曲...");

  try {
    const response = await fetchPagedItems("Audio", state.tracks.length, PAGE_SIZE.tracks, {
      SortBy: "DateCreated",
      SortOrder: "Descending",
    });

    state.tracks = mergeUniqueItems(state.tracks, normalizeItems(response.Items));
    state.totalTracks = response.TotalRecordCount ?? state.totalTracks;
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多歌曲失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreTracks }],
    });
  } finally {
    state.isLoadingMoreTracks = false;
    updateLoadMoreButtons();
  }
}

async function loadMoreExternalTracks() {
  const apiUrl = getSessionExternalSourceApiUrl(state.session);

  if (!apiUrl) {
    setLibraryStatus("音乐桥未配置服务地址。");
    return;
  }

  state.isLoadingMoreTracks = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多音乐桥歌曲...");

  try {
    const response = await externalSourceApi.fetchTracks(apiUrl, {
      startIndex: state.tracks.length,
      limit: PAGE_SIZE.tracks,
    });

    const tracks = normalizeItems(response.Items);
    state.tracks = mergeUniqueItems(state.tracks, tracks);
    state.albums = mergeUniqueItems(state.albums, inferExternalAlbumsFromTracks(tracks));
    state.totalTracks = Math.max(response.TotalRecordCount || 0, state.tracks.length);
    state.totalAlbums = Math.max(state.totalAlbums, state.albums.length);
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多音乐桥歌曲失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreExternalTracks }],
    });
  } finally {
    state.isLoadingMoreTracks = false;
    updateLoadMoreButtons();
  }
}

async function loadMoreAlbums() {
  if (!state.session || state.isLoadingMoreAlbums || state.albums.length >= state.totalAlbums) {
    return;
  }

  state.isLoadingMoreAlbums = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多专辑...");

  try {
    const response = await fetchPagedItems("MusicAlbum", state.albums.length, PAGE_SIZE.albums, {
      SortBy: "DateCreated",
      SortOrder: "Descending",
    });

    state.albums = mergeUniqueItems(state.albums, normalizeItems(response.Items));
    state.totalAlbums = response.TotalRecordCount ?? state.totalAlbums;
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多专辑失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreAlbums }],
    });
  } finally {
    state.isLoadingMoreAlbums = false;
    updateLoadMoreButtons();
  }
}

async function loadMoreArtists() {
  if (!state.session || state.isLoadingMoreArtists || state.artists.length >= state.totalArtists) {
    return;
  }

  state.isLoadingMoreArtists = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多艺人...");

  try {
    const response = await fetchPagedItems("MusicArtist", state.artists.length, PAGE_SIZE.artists, {
      SortBy: "SortName",
      SortOrder: "Ascending",
    });

    state.artists = mergeUniqueItems(state.artists, normalizeItems(response.Items));
    state.totalArtists = response.TotalRecordCount ?? state.totalArtists;
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多艺人失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreArtists }],
    });
  } finally {
    state.isLoadingMoreArtists = false;
    updateLoadMoreButtons();
  }
}

async function loadMorePlaylists() {
  if (!state.session || state.isLoadingMorePlaylists || state.playlists.length >= state.totalPlaylists) {
    return;
  }

  state.isLoadingMorePlaylists = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多歌单...");

  try {
    const response = await fetchPagedItems("Playlist", state.playlists.length, PAGE_SIZE.playlists, {
      SortBy: "SortName",
      SortOrder: "Ascending",
    });

    state.playlists = mergeUniqueItems(state.playlists, normalizePlaylists(response.Items));
    state.totalPlaylists = response.TotalRecordCount ?? state.totalPlaylists;
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多歌单失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMorePlaylists }],
    });
  } finally {
    state.isLoadingMorePlaylists = false;
    updateLoadMoreButtons();
  }
}

async function loadMoreFavorites() {
  if (!state.session || state.isLoadingMoreFavorites || state.favoriteTracks.length >= state.totalFavorites) {
    return;
  }

  state.isLoadingMoreFavorites = true;
  updateLoadMoreButtons();
  setLibraryStatus("正在加载更多收藏...");

  try {
    const response = await fetchPagedItems("Audio", state.favoriteTracks.length, PAGE_SIZE.favorites, {
      IsFavorite: true,
      EnableUserData: true,
      SortBy: "SortName",
      SortOrder: "Ascending",
    });

    state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, normalizeItems(response.Items));
    state.totalFavorites = response.TotalRecordCount ?? state.totalFavorites;
    applyFilters();
    renderLibrary();
    setLibraryStatus("");
  } catch (error) {
    showNotice(`加载更多收藏失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreFavorites }],
    });
  } finally {
    state.isLoadingMoreFavorites = false;
    updateLoadMoreButtons();
  }
}

function fetchPagedItems(includeItemTypes, startIndex, limit, extraParams = {}) {
  return embyFetch(state.session, userItemsPath(state.session, {
    Recursive: true,
    IncludeItemTypes: includeItemTypes,
    StartIndex: startIndex,
    Limit: limit,
    Fields: itemFields,
    EnableUserData: true,
    ...getLibraryScopeParams(),
    ...extraParams,
  }));
}

function updateLoadMoreButtons() {
  updateLoadMoreButton(loadMoreTracksButton, state.tracks.length, state.totalTracks, state.isLoadingMoreTracks, "歌曲");
  updateLoadMoreButton(loadMoreAlbumsButton, state.albums.length, state.totalAlbums, state.isLoadingMoreAlbums, "专辑");
  updateLoadMoreButton(loadMoreArtistsButton, state.artists.length, state.totalArtists, state.isLoadingMoreArtists, "艺人");
  updateLoadMoreButton(loadMorePlaylistsButton, state.playlists.length, state.totalPlaylists, state.isLoadingMorePlaylists, "歌单");
  updateLoadMoreButton(loadMoreFavoritesButton, state.favoriteTracks.length, state.totalFavorites, state.isLoadingMoreFavorites, "收藏");
}

function updateLoadMoreButton(button, loaded, total, isLoading, label) {
  const hasMore = total > loaded;

  button.hidden = !hasMore;
  button.disabled = isLoading;
  button.textContent = isLoading
    ? `正在加载更多${label}...`
    : `加载更多${label}（${formatCount(loaded)} / ${formatCount(total)}）`;
}

function mergeUniqueItems(existingItems, newItems) {
  const seen = new Set(existingItems.map((item) => item.Id));
  const merged = [...existingItems];

  newItems.forEach((item) => {
    if (!seen.has(item.Id)) {
      seen.add(item.Id);
      merged.push(item);
      return;
    }

    const existing = merged.find((existingItem) => existingItem?.Id === item.Id);
    mergeTrackMetadata(existing, item);
  });

  return merged;
}

function inferExternalAlbumsFromTracks(tracks) {
  const albumMap = new Map();

  normalizeItems(tracks).forEach((track) => {
    if (!isExternalSourceTrack(track) || !track.Album) {
      return;
    }

    const platform = track.ExternalSource?.platform || "external";
    const albumId = track.AlbumId || `external-album:${platform}:${track.Album}`;
    const key = `${platform}:${albumId || track.Album}`.toLowerCase();
    const existing = albumMap.get(key);

    if (existing) {
      existing.ChildCount += 1;
      existing.RunTimeTicks = (existing.RunTimeTicks || 0) + (Number(track.RunTimeTicks) || 0);
      if (!existing.ExternalSource?.artwork && track.ExternalSource?.artwork) {
        existing.ExternalSource.artwork = track.ExternalSource.artwork;
      }
      return;
    }

    albumMap.set(key, {
      Id: albumId,
      Type: "MusicAlbum",
      Name: track.Album,
      SortName: track.Album,
      AlbumArtist: track.AlbumArtist || getArtists(track),
      Artists: track.Artists || [],
      ArtistItems: track.ArtistItems || [],
      AlbumArtists: track.AlbumArtists || track.ArtistItems || [],
      ChildCount: 1,
      RunTimeTicks: Number(track.RunTimeTicks) || 0,
      DateCreated: track.DateCreated,
      UserData: { IsFavorite: false },
      ExternalSource: {
        ...(track.ExternalSource || {}),
        id: albumId,
        mediaKind: "album",
        artwork: track.ExternalSource?.artwork || "",
      },
    });
  });

  return [...albumMap.values()];
}

function shuffleTracks(tracks) {
  for (let index = tracks.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [tracks[index], tracks[randomIndex]] = [tracks[randomIndex], tracks[index]];
  }

  return tracks;
}

function shufflePlay() {
  const pool = state.filteredTracks.length ? [...state.filteredTracks] : [...state.tracks];

  if (!pool.length) {
    setLibraryStatus("没有可播放的歌曲。");
    return;
  }

  shuffleTracks(pool);

  playTrack(pool[0], pool);
  switchView("queue");
}

function shufflePlayFromImmersive() {
  shufflePlayInView("immersivePlayer");
}

function playLibraryFromImmersive() {
  playLibraryInView("immersivePlayer");
}

function shufflePlayFromNowPlaying() {
  shufflePlayInView("nowPlaying");
}

function playLibraryFromNowPlaying() {
  playLibraryInView("nowPlaying");
}

function shufflePlayInView(view) {
  const pool = state.filteredTracks.length ? [...state.filteredTracks] : [...state.tracks];

  if (!pool.length) {
    setLibraryStatus("没有可随机播放的歌曲，请先加载音乐库。");
    switchView("library");
    return;
  }

  shuffleTracks(pool);
  playTrack(pool[0], pool);
  switchView(view);
}

function playLibraryInView(view) {
  const collection = mergeUniqueItems([], normalizeItems(state.filteredTracks.length ? state.filteredTracks : state.tracks).filter(isAudioItem));

  if (!collection.length) {
    setLibraryStatus("没有可播放的歌曲，请先加载音乐库。");
    switchView("library");
    return;
  }

  playTrack(collection[0], collection);
  switchView(view);
}

function playTrackCollection(tracks, label) {
  const collection = mergeUniqueItems([], normalizeItems(tracks).filter(isAudioItem));

  if (!collection.length) {
    setLibraryStatus(`没有可播放的${label}。`);
    return;
  }

  playTrack(collection[0], collection);
  switchView("queue");
}

function openTrackAlbum(track) {
  const album = findAlbumForTrack(track);

  if (album) {
    state.albums = mergeUniqueItems(state.albums, [album]);
    openAlbumDetail(album);
    return;
  }

  focusLibrarySearch(track.Album, "未找到可打开的专辑详情，已按专辑名搜索。");
}

function openTrackArtist(track) {
  const artist = getPrimaryTrackArtist(track);

  if (artist?.Id) {
    state.artists = mergeUniqueItems(state.artists, [artist]);
    openArtistDetail(artist);
    return;
  }

  focusLibrarySearch(artist?.Name || getArtists(track), "未找到可打开的艺人详情，已按艺人名搜索。");
}

function findAlbumForTrack(track) {
  if (!track) {
    return null;
  }

  const album = state.albums.find((item) => {
    return (track.AlbumId && item.Id === track.AlbumId)
      || (track.Album && item.Name === track.Album);
  });

  if (album) {
    return album;
  }

  if (!track.AlbumId) {
    return null;
  }

  return {
    Id: track.AlbumId,
    Name: track.Album || "未命名专辑",
    AlbumArtist: track.AlbumArtist,
    ArtistItems: track.ArtistItems,
    Type: "MusicAlbum",
    UserData: {},
  };
}

function getPrimaryTrackArtist(track) {
  const linkedArtist = track?.ArtistItems?.find((artist) => artist?.Id || artist?.Name);

  if (linkedArtist) {
    return {
      Id: linkedArtist.Id,
      Name: linkedArtist.Name,
      Type: "MusicArtist",
      UserData: linkedArtist.UserData || {},
    };
  }

  const namedArtist = track?.Artists?.find(Boolean);

  if (namedArtist) {
    return { Name: namedArtist, Type: "MusicArtist" };
  }

  const artists = getArtists(track).split("/").map((name) => name.trim()).filter(Boolean);
  return artists.length ? { Name: artists[0], Type: "MusicArtist" } : null;
}

function focusLibrarySearch(term, statusText) {
  const query = String(term || "").trim();

  if (!query) {
    setLibraryStatus("没有可用于跳转的专辑或艺人信息。");
    return;
  }

  state.query = query.toLowerCase();
  state.albumFilter = null;
  state.artistFilter = null;
  state.genreFilter = "";
  state.yearFilter = "";
  state.qualityFilter = "";
  state.searchResultQuery = query;
  state.searchSourceFilter = "";
  searchInput.value = query;
  genreSelect.value = "";
  yearSelect.value = "";
  qualitySelect.value = "";
  saveSearchHistoryQuery(query);
  saveCurrentFilterState();
  applyFilters();
  renderLibrary();
  scheduleServerSearch(query);
  switchView("search", { resetScroll: true });
  setLibraryStatus(statusText);
}

function captureDetailReturnView(detailView, fallbackView) {
  const activeView = getActiveView();
  const returnView = activeView && activeView !== detailView ? activeView : fallbackView;
  state.detailReturnViews[detailView] = returnView || fallbackView;
}

function returnFromDetail(detailView) {
  const fallbackView = getDetailFallbackView(detailView);
  const returnView = state.detailReturnViews[detailView] || fallbackView;

  if (returnView === detailView || !hasView(returnView)) {
    switchView(fallbackView);
    return;
  }

  switchView(returnView);
}

function updateDetailBackButton(button, detailView) {
  const fallbackView = getDetailFallbackView(detailView);
  const returnView = state.detailReturnViews[detailView] || fallbackView;
  button.textContent = `返回${getViewLabel(returnView)}`;
}

function getDetailFallbackView(detailView) {
  if (detailView === "artistDetail") {
    return "artists";
  }

  if (detailView === "playlistDetail") {
    return "playlists";
  }

  return "albums";
}

function getActiveView() {
  return [...viewPanels].find((panel) => panel.classList.contains("active"))?.dataset.panel || "home";
}

function hasView(view) {
  return [...viewPanels].some((panel) => panel.dataset.panel === view);
}

function getViewLabel(view) {
  const labels = {
    home: "首页",
    library: "音乐库",
    favorites: "收藏",
    recent: "最近播放",
    albums: "专辑",
    artists: "艺人",
    playlists: "歌单",
    queue: "播放队列",
    nowPlaying: "正在播放",
    immersivePlayer: "沉浸播放",
    settings: "设置",
    albumDetail: "专辑详情",
    artistDetail: "艺人详情",
    playlistDetail: "歌单详情",
  };

  return labels[view] || "上一页";
}

async function openAlbumDetail(album) {
  captureDetailReturnView("albumDetail", "albums");
  state.selectedAlbum = album;
  state.albumTracks = [];
  renderAlbumDetail(album, [], true);
  switchView("albumDetail", { resetScroll: true });
  setLibraryStatus("正在加载专辑歌曲...");

  if (isExternalSourceSession() || isExternalSourceTrack(album)) {
    state.albumTracks = sortAlbumTracks(getAlbumTracks(album));
    renderAlbumDetail(album, state.albumTracks, false);
    setLibraryStatus(state.albumTracks.length ? "" : "当前专辑暂无已读取歌曲，可先搜索或刷新音乐桥。");
    return;
  }

  try {
    state.albumTracks = await fetchAlbumTracks(album);
  } catch (error) {
    state.albumTracks = sortAlbumTracks(state.tracks.filter((track) => {
      return track.AlbumId === album.Id || track.Album === album.Name;
    }));
    setLibraryStatus(`专辑歌曲加载失败，已使用本地已读取歌曲：${readableError(error)}`);
  }

  renderAlbumDetail(album, state.albumTracks, false);

  if (state.albumTracks.length) {
    setLibraryStatus("");
  }
}

async function fetchAlbumTracks(album) {
  const response = await embyFetch(state.session, userItemsPath(state.session, {
    ParentId: album.Id,
    Recursive: true,
    IncludeItemTypes: "Audio",
    Limit: 500,
    Fields: itemFields,
    EnableUserData: true,
  }));

  return sortAlbumTracks(normalizeItems(response.Items));
}

async function getPlayableAlbumTracks(album) {
  if (!album?.Id) {
    return [];
  }

  if (isExternalSourceSession() || isExternalSourceTrack(album)) {
    const localTracks = sortAlbumTracks(getAlbumTracks(album));
    if (state.selectedAlbum?.Id === album.Id) {
      state.albumTracks = localTracks;
    }
    return localTracks;
  }

  if (state.selectedAlbum?.Id === album.Id && state.albumTracks.length) {
    return state.albumTracks;
  }

  const localTracks = sortAlbumTracks(getAlbumTracks(album));

  try {
    const remoteTracks = await fetchAlbumTracks(album);
    const tracks = remoteTracks.length ? remoteTracks : localTracks;
    state.tracks = mergeUniqueItems(state.tracks, tracks);
    state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, tracks.filter(isFavorite));
    applyFilters();
    renderLibrary();
    return tracks;
  } catch (error) {
    if (localTracks.length) {
      setLibraryStatus(`专辑歌曲加载失败，已使用本地已读取歌曲：${readableError(error)}`);
      return localTracks;
    }

    throw error;
  }
}

async function playAlbumFromCard(album) {
  setLibraryStatus(`正在读取专辑：${album.Name || "未命名专辑"}...`);
  const tracks = await getPlayableAlbumTracks(album);
  playTrackCollection(tracks, "专辑");
}

async function queueAlbumFromCard(album) {
  setLibraryStatus(`正在读取专辑：${album.Name || "未命名专辑"}...`);
  const tracks = await getPlayableAlbumTracks(album);
  queueTrackCollection(tracks, "专辑");
}

function renderAlbumDetail(album, tracks, isLoading) {
  updateDetailBackButton(backToAlbumsButton, "albumDetail");
  albumDetailCover.replaceChildren();
  albumDetailCover.className = "album-detail-cover cover-a";
  appendImage(albumDetailCover, getImageUrl(album, 720), album.Name);
  albumDetailTitle.textContent = album.Name || "未命名专辑";
  albumDetailMeta.textContent = [
    getAlbumSubtitle(album),
    tracks.length ? getTrackCollectionMeta(tracks) : "",
    getCollectionQualitySummary(tracks),
  ].filter(Boolean).join(" · ");

  playAlbumButton.disabled = !tracks.length;
  shuffleAlbumButton.disabled = !tracks.length;
  nextAlbumButton.disabled = !tracks.length;
  queueAlbumButton.disabled = !tracks.length;
  updateFavoriteButton(favoriteAlbumButton, album, "收藏专辑");

  if (isLoading) {
    albumTrackList.innerHTML = loadingMarkup("正在加载专辑歌曲...");
    return;
  }

  renderTrackList(albumTrackList, tracks, { indexMode: "track" });
  updateActiveRows();
}

function playSelectedAlbum() {
  if (!state.albumTracks.length) {
    return;
  }

  playTrack(state.albumTracks[0], state.albumTracks);
}

function shuffleSelectedAlbum() {
  if (!state.albumTracks.length) {
    return;
  }

  const shuffled = [...state.albumTracks];
  shuffleTracks(shuffled);

  playTrack(shuffled[0], shuffled);
}

function queueSelectedAlbum() {
  queueTrackCollection(state.albumTracks, "专辑");
}

function playSelectedAlbumNext() {
  playTrackCollectionNext(state.albumTracks, "专辑");
}

async function openArtistDetail(artist) {
  if (!artist?.Id) {
    return;
  }

  captureDetailReturnView("artistDetail", "artists");
  state.selectedArtist = artist;
  state.artistTracks = [];
  state.artistAlbums = [];
  renderArtistDetail(artist, [], [], true);
  switchView("artistDetail", { resetScroll: true });
  setLibraryStatus("正在加载艺人内容...");

  const [trackResult, albumResult] = await Promise.allSettled([
    fetchArtistTracks(artist),
    fetchArtistAlbums(artist),
  ]);
  const errors = [];

  if (trackResult.status === "fulfilled") {
    state.artistTracks = sortArtistTracks(mergeUniqueItems([], trackResult.value));
  } else {
    state.artistTracks = sortArtistTracks(getLocalArtistTracks(artist));
    errors.push(readableError(trackResult.reason));
  }

  if (albumResult.status === "fulfilled") {
    state.artistAlbums = sortAlbums(mergeUniqueItems([], albumResult.value));
  } else {
    state.artistAlbums = sortAlbums(getLocalArtistAlbums(artist));
    errors.push(readableError(albumResult.reason));
  }

  state.tracks = mergeUniqueItems(state.tracks, state.artistTracks);
  state.albums = mergeUniqueItems(state.albums, state.artistAlbums);
  state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, state.artistTracks.filter(isFavorite));

  applyFilters();
  renderLibrary();

  if (errors.length) {
    setLibraryStatus(`艺人内容部分加载失败，已使用本地已读取内容：${errors[0]}`);
    return;
  }

  if (!state.artistTracks.length && !state.artistAlbums.length) {
    setLibraryStatus("这个艺人暂无可显示的歌曲或专辑。");
    return;
  }

  setLibraryStatus("");
}

async function fetchArtistTracks(artist) {
  const response = await embyFetch(state.session, userItemsPath(state.session, {
    Recursive: true,
    IncludeItemTypes: "Audio",
    ArtistIds: artist.Id,
    Limit: 500,
    Fields: itemFields,
    EnableUserData: true,
  }));

  const items = normalizeItems(response.Items);
  const matchedItems = items.filter((track) => itemHasArtist(track, artist.Id, artist.Name));

  return matchedItems.length ? matchedItems : getLocalArtistTracks(artist);
}

async function getPlayableArtistTracks(artist) {
  if (!artist?.Id) {
    return [];
  }

  if (state.selectedArtist?.Id === artist.Id && state.artistTracks.length) {
    return state.artistTracks;
  }

  const localTracks = sortArtistTracks(getLocalArtistTracks(artist));

  try {
    const remoteTracks = sortArtistTracks(mergeUniqueItems([], await fetchArtistTracks(artist)));
    const tracks = remoteTracks.length ? remoteTracks : localTracks;
    state.tracks = mergeUniqueItems(state.tracks, tracks);
    state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, tracks.filter(isFavorite));
    applyFilters();
    renderLibrary();
    return tracks;
  } catch (error) {
    if (localTracks.length) {
      setLibraryStatus(`艺人歌曲加载失败，已使用本地已读取歌曲：${readableError(error)}`);
      return localTracks;
    }

    throw error;
  }
}

async function playArtistFromCard(artist) {
  setLibraryStatus(`正在读取艺人：${artist.Name || "未知艺人"}...`);
  const tracks = await getPlayableArtistTracks(artist);
  playTrackCollection(tracks, "艺人歌曲");
}

async function queueArtistFromCard(artist) {
  setLibraryStatus(`正在读取艺人：${artist.Name || "未知艺人"}...`);
  const tracks = await getPlayableArtistTracks(artist);
  queueTrackCollection(tracks, "艺人歌曲");
}

async function fetchArtistAlbums(artist) {
  const response = await embyFetch(state.session, userItemsPath(state.session, {
    Recursive: true,
    IncludeItemTypes: "MusicAlbum",
    AlbumArtistIds: artist.Id,
    Limit: 240,
    Fields: itemFields,
    EnableUserData: true,
  }));

  const items = normalizeItems(response.Items);
  const matchedItems = items.filter((album) => albumHasArtist(album, artist));

  return matchedItems.length ? matchedItems : getLocalArtistAlbums(artist);
}

function renderArtistDetail(artist, albums, tracks, isLoading) {
  updateDetailBackButton(backToArtistsButton, "artistDetail");
  artistDetailCover.replaceChildren();
  artistDetailCover.className = "album-detail-cover artist-detail-cover cover-b";
  appendImage(artistDetailCover, getImageUrl(artist, 720), artist.Name);
  artistDetailTitle.textContent = artist.Name || "未知艺人";
  artistDetailMeta.textContent = [
    albums.length ? `${albums.length} 张专辑` : "",
    tracks.length ? getTrackCollectionMeta(tracks) : "",
    getCollectionQualitySummary(tracks),
  ].filter(Boolean).join(" · ") || "Artist";

  playArtistButton.disabled = !tracks.length;
  shuffleArtistButton.disabled = !tracks.length;
  nextArtistButton.disabled = !tracks.length;
  queueArtistButton.disabled = !tracks.length;
  updateFavoriteButton(favoriteArtistButton, artist, "收藏艺人");

  if (isLoading) {
    artistAlbumGrid.innerHTML = loadingMarkup("正在加载艺人专辑...");
    artistTrackList.innerHTML = loadingMarkup("正在加载艺人歌曲...");
    return;
  }

  renderAlbumGrid(artistAlbumGrid, albums);
  renderTrackList(artistTrackList, tracks, {
    emptyText: "没有读取到这个艺人的歌曲。",
  });
  updateActiveRows();
}

function renderActiveDetailPanels() {
  if (state.selectedAlbum) {
    renderAlbumDetail(state.selectedAlbum, state.albumTracks, false);
  }

  if (state.selectedArtist) {
    renderArtistDetail(state.selectedArtist, state.artistAlbums, state.artistTracks, false);
  }

  if (state.selectedPlaylist) {
    renderPlaylistDetail(state.selectedPlaylist, state.playlistTracks, false);
  }
}

function playSelectedArtist() {
  if (!state.artistTracks.length) {
    return;
  }

  playTrack(state.artistTracks[0], state.artistTracks);
}

function shuffleSelectedArtist() {
  if (!state.artistTracks.length) {
    return;
  }

  const shuffled = [...state.artistTracks];
  shuffleTracks(shuffled);

  playTrack(shuffled[0], shuffled);
}

function queueSelectedArtist() {
  queueTrackCollection(state.artistTracks, "艺人歌曲");
}

function playSelectedArtistNext() {
  playTrackCollectionNext(state.artistTracks, "艺人歌曲");
}

async function openPlaylistDetail(playlist) {
  if (!playlist?.Id) {
    return;
  }

  captureDetailReturnView("playlistDetail", "playlists");
  state.selectedPlaylist = playlist;
  state.playlistTracks = [];
  renderPlaylistDetail(playlist, [], true);
  switchView("playlistDetail", { resetScroll: true });
  setLibraryStatus("正在加载歌单歌曲...");

  try {
    state.playlistTracks = await fetchPlaylistTracks(playlist);
  } catch (error) {
    state.playlistTracks = [];
    setLibraryStatus(`歌单歌曲加载失败：${readableError(error)}`);
  }

  state.tracks = mergeUniqueItems(state.tracks, state.playlistTracks);
  state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, state.playlistTracks.filter(isFavorite));
  applyFilters();
  renderLibrary();

  if (state.playlistTracks.length) {
    setLibraryStatus("");
  }
}

async function fetchPlaylistTracks(playlist) {
  try {
    return await fetchPlaylistTracksFromPlaylistEndpoint(playlist);
  } catch (error) {
    const fallbackTracks = await fetchPlaylistTracksFromParent(playlist);

    if (fallbackTracks.length) {
      return fallbackTracks;
    }

    throw error;
  }
}

async function getPlayablePlaylistTracks(playlist) {
  if (!playlist?.Id) {
    return [];
  }

  if (state.selectedPlaylist?.Id === playlist.Id && state.playlistTracks.length) {
    return state.playlistTracks;
  }

  const tracks = await fetchPlaylistTracks(playlist);
  state.tracks = mergeUniqueItems(state.tracks, tracks);
  state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, tracks.filter(isFavorite));
  applyFilters();
  renderLibrary();
  return tracks;
}

async function playPlaylistFromCard(playlist) {
  setLibraryStatus(`正在读取歌单：${playlist.Name || "未命名歌单"}...`);
  const tracks = await getPlayablePlaylistTracks(playlist);
  playTrackCollection(tracks, "歌单");
}

async function queuePlaylistFromCard(playlist) {
  setLibraryStatus(`正在读取歌单：${playlist.Name || "未命名歌单"}...`);
  const tracks = await getPlayablePlaylistTracks(playlist);
  queueTrackCollection(tracks, "歌单");
}

async function fetchPlaylistTracksFromPlaylistEndpoint(playlist) {
  const encodedPlaylistId = encodeURIComponent(playlist.Id);

  return fetchAudioPages((startIndex, limit) => {
    return `/Playlists/${encodedPlaylistId}/Items?${toQueryString({
      UserId: state.session.userId,
      StartIndex: startIndex,
      Limit: limit,
      Fields: itemFields,
    })}`;
  });
}

async function fetchPlaylistTracksFromParent(playlist) {
  return fetchAudioPages((startIndex, limit) => {
    return userItemsPath(state.session, {
      ParentId: playlist.Id,
      Recursive: true,
      IncludeItemTypes: "Audio",
      StartIndex: startIndex,
      Limit: limit,
      Fields: itemFields,
      EnableUserData: true,
    });
  });
}

async function fetchAudioPages(buildPath) {
  const tracks = [];
  const limit = 500;
  let startIndex = 0;
  let total = null;

  while (true) {
    const response = await embyFetch(state.session, buildPath(startIndex, limit));
    const items = normalizeItems(response.Items);
    const audioItems = items.filter(isAudioItem);
    tracks.push(...audioItems);

    total = Number.isFinite(response.TotalRecordCount) ? response.TotalRecordCount : total;
    startIndex += items.length;

    if (!items.length || (total !== null && startIndex >= total) || (total === null && items.length < limit)) {
      break;
    }
  }

  return tracks;
}

function renderPlaylistDetail(playlist, tracks, isLoading) {
  updateDetailBackButton(backToPlaylistsButton, "playlistDetail");
  playlistDetailCover.replaceChildren();
  playlistDetailCover.className = "album-detail-cover playlist-detail-cover cover-d";
  appendImage(playlistDetailCover, getImageUrl(playlist, 720), playlist.Name);
  playlistDetailTitle.textContent = playlist.Name || "未命名歌单";
  playlistDetailMeta.textContent = [
    getPlaylistSubtitle(playlist),
    tracks.length ? getTrackCollectionMeta(tracks) : "",
    getCollectionQualitySummary(tracks),
  ].filter(Boolean).join(" · ");

  playPlaylistButton.disabled = !tracks.length;
  shufflePlaylistButton.disabled = !tracks.length;
  nextPlaylistButton.disabled = !tracks.length;
  queuePlaylistButton.disabled = !tracks.length;
  updateFavoriteButton(favoritePlaylistButton, playlist, "收藏歌单");

  if (isLoading) {
    playlistTrackList.innerHTML = loadingMarkup("正在加载歌单歌曲...");
    return;
  }

  renderTrackList(playlistTrackList, tracks, {
    context: "playlist",
    emptyText: "这个歌单里没有读取到可播放歌曲。",
  });
  updateActiveRows();
}

function playSelectedPlaylist() {
  if (!state.playlistTracks.length) {
    return;
  }

  playTrack(state.playlistTracks[0], state.playlistTracks);
}

function shuffleSelectedPlaylist() {
  if (!state.playlistTracks.length) {
    return;
  }

  const shuffled = [...state.playlistTracks];
  shuffleTracks(shuffled);

  playTrack(shuffled[0], shuffled);
}

function queueSelectedPlaylist() {
  queueTrackCollection(state.playlistTracks, "歌单");
}

function playSelectedPlaylistNext() {
  playTrackCollectionNext(state.playlistTracks, "歌单");
}

function openCreatePlaylistModal() {
  if (!state.session) {
    setLibraryStatus("请先连接 Emby 服务器。");
    return;
  }

  createPlaylistName.value = "";
  createPlaylistMessage.textContent = "";
  createPlaylistMessage.className = "message compact";
  createPlaylistModal.hidden = false;
  updateCreatePlaylistBusyState(false);
  createPlaylistName.focus();
}

function closeCreatePlaylistModal(options = {}) {
  if (state.isCreatingPlaylist && !options.force) {
    return;
  }

  createPlaylistModal.hidden = true;
  createPlaylistName.value = "";
  createPlaylistMessage.textContent = "";
}

async function createPlaylistFromModal() {
  const name = createPlaylistName.value.trim();

  if (!name) {
    createPlaylistMessage.textContent = "请填写歌单名称。";
    createPlaylistMessage.className = "message compact error";
    createPlaylistName.focus();
    return;
  }

  updateCreatePlaylistBusyState(true);
  createPlaylistMessage.textContent = "正在创建歌单...";
  createPlaylistMessage.className = "message compact";

  try {
    const playlist = await createEmbyPlaylist(name);
    const nextPlaylist = normalizeCreatedPlaylist(playlist, name);

    updatePlaylistAfterCreated(nextPlaylist);
    setLibraryStatus(`已创建歌单：${nextPlaylist.Name || name}。`);
    closeCreatePlaylistModal({ force: true });
    switchView("playlists");
  } catch (error) {
    createPlaylistMessage.textContent = `创建失败：${readableError(error)}`;
    createPlaylistMessage.className = "message compact error";
  } finally {
    updateCreatePlaylistBusyState(false);
  }
}

async function createEmbyPlaylist(name) {
  const path = `/Playlists?${toQueryString({
    Name: name,
    MediaType: "Audio",
    UserId: state.session.userId,
  })}`;
  const response = await embyRequest("POST", path);

  return response.json().catch(() => ({}));
}

function normalizeCreatedPlaylist(response, fallbackName) {
  const playlist = response?.Playlist || response?.Item || response || {};
  const id = playlist.Id || response?.Id;

  if (!id) {
    throw new Error("服务器没有返回新歌单 ID，请刷新音乐库确认是否已创建。");
  }

  return {
    ...playlist,
    Id: id,
    Name: playlist.Name || response?.Name || fallbackName,
    Type: "Playlist",
    MediaType: "Audio",
    ChildCount: Number(playlist.ChildCount || playlist.SongCount || playlist.ItemCount || 0),
    UserData: playlist.UserData || {},
  };
}

function updatePlaylistAfterCreated(playlist) {
  state.playlists = mergeUniqueItems([playlist], state.playlists);
  state.totalPlaylists = Math.max(state.totalPlaylists || 0, state.playlists.length);
  applyFilters();
  renderLibrary();
}

function updateCreatePlaylistBusyState(isBusy) {
  state.isCreatingPlaylist = isBusy;
  createPlaylistButton.disabled = !state.session || isBusy;
  createPlaylistSubmit.disabled = isBusy;
  createPlaylistCancel.disabled = isBusy;
  createPlaylistClose.disabled = isBusy;
  createPlaylistName.disabled = isBusy;
  createPlaylistSubmit.textContent = isBusy ? "创建中..." : "创建";
}

function canRemoveTrackFromSelectedPlaylist(track) {
  return Boolean(state.selectedPlaylist?.Id && track?.PlaylistItemId);
}

function canMoveTrackInSelectedPlaylist(track, tracks = state.playlistTracks) {
  return Boolean(
    state.selectedPlaylist?.Id
    && track?.Id
    && track?.PlaylistItemId
    && Array.isArray(tracks)
    && tracks.length > 1
    && !state.isMovingPlaylistTrack
  );
}

function moveSelectedPlaylistTrack(index, direction) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= state.playlistTracks.length) {
    return;
  }

  reorderSelectedPlaylistTrack(index, nextIndex);
}

async function reorderSelectedPlaylistTrack(fromIndex, toIndex, options = {}) {
  if (
    !state.selectedPlaylist?.Id
    || state.isMovingPlaylistTrack
    || fromIndex < 0
    || fromIndex >= state.playlistTracks.length
    || toIndex < 0
    || toIndex >= state.playlistTracks.length
    || fromIndex === toIndex
  ) {
    return;
  }

  const playlist = state.selectedPlaylist;
  const movedTrack = state.playlistTracks[fromIndex];

  if (!movedTrack?.PlaylistItemId) {
    setLibraryStatus("这首歌缺少歌单条目 ID，无法调整顺序。");
    return;
  }

  state.isMovingPlaylistTrack = true;
  renderPlaylistDetail(playlist, state.playlistTracks, false);
  setLibraryStatus("正在更新歌单顺序...");

  try {
    await moveTrackInEmbyPlaylist(playlist, movedTrack, toIndex);
    updatePlaylistTrackOrder(fromIndex, toIndex);
    renderPlaylistDetail(playlist, state.playlistTracks, false);
    setLibraryStatus(options.announce === false ? "" : "歌单顺序已更新。");
  } catch (error) {
    showNotice(`歌单排序失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重试", handler: () => reorderSelectedPlaylistTrack(fromIndex, toIndex, options) },
        { label: "刷新歌单", handler: () => openPlaylistDetail(playlist) },
      ],
    });
  } finally {
    state.isMovingPlaylistTrack = false;
    renderPlaylistDetail(state.selectedPlaylist || playlist, state.playlistTracks, false);
  }
}

async function moveTrackInEmbyPlaylist(playlist, track, toIndex) {
  const itemIds = [track.PlaylistItemId, track.Id].filter(Boolean);
  const uniqueItemIds = [...new Set(itemIds)];
  let lastError = null;

  for (const itemId of uniqueItemIds) {
    try {
      await embyRequest(
        "POST",
        `/Playlists/${encodeURIComponent(playlist.Id)}/Items/${encodeURIComponent(itemId)}/Move/${encodeURIComponent(toIndex)}`,
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("服务器没有接受歌单排序请求。");
}

function updatePlaylistTrackOrder(fromIndex, toIndex) {
  const nextTracks = [...state.playlistTracks];
  const [movedTrack] = nextTracks.splice(fromIndex, 1);
  nextTracks.splice(toIndex, 0, movedTrack);
  state.playlistTracks = nextTracks;
}

function handlePlaylistDragStart(event, index, tracks) {
  if (!canMoveTrackInSelectedPlaylist(tracks[index], tracks)) {
    event.preventDefault();
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(index));
  event.currentTarget.classList.add("dragging");
}

function handlePlaylistDragOver(event, index) {
  const fromIndex = getDraggedPlaylistIndex(event);

  if (fromIndex < 0 || fromIndex === index || state.isMovingPlaylistTrack) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
}

function handlePlaylistDrop(event, index) {
  const fromIndex = getDraggedPlaylistIndex(event);

  event.preventDefault();
  clearPlaylistDragState();

  if (fromIndex < 0 || fromIndex === index) {
    return;
  }

  reorderSelectedPlaylistTrack(fromIndex, index);
}

function getDraggedPlaylistIndex(event) {
  const value = event.dataTransfer?.getData("text/plain");
  const index = Number(value);

  return Number.isInteger(index) ? index : -1;
}

function clearPlaylistDragState() {
  document.querySelectorAll(".track-row.dragging, .track-row.drag-over").forEach((row) => {
    row.classList.remove("dragging", "drag-over");
  });
}

async function removeTrackFromSelectedPlaylist(track) {
  if (!canRemoveTrackFromSelectedPlaylist(track)) {
    setLibraryStatus("这首歌缺少歌单条目 ID，无法从歌单移除。");
    return;
  }

  const playlist = state.selectedPlaylist;
  const playlistItemId = track.PlaylistItemId;

  setLibraryStatus("正在从歌单移除歌曲...");

  try {
    await removeTrackFromEmbyPlaylist(playlist, playlistItemId);
    updatePlaylistAfterTrackRemoved(playlist, track);
    setLibraryStatus(`已从歌单移除：${track.Name || "未命名歌曲"}。`);
  } catch (error) {
    showNotice(`从歌单移除失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重试", handler: () => removeTrackFromSelectedPlaylist(track) },
        { label: "刷新歌单", handler: () => openPlaylistDetail(playlist) },
      ],
    });
  }
}

async function removeTrackFromEmbyPlaylist(playlist, playlistItemId) {
  const query = toQueryString({
    EntryIds: playlistItemId,
  });
  const path = `/Playlists/${encodeURIComponent(playlist.Id)}/Items?${query}`;

  try {
    await embyRequest("DELETE", path);
  } catch (error) {
    await embyRequest("POST", `/Playlists/${encodeURIComponent(playlist.Id)}/Items/Delete?${query}`);
  }
}

function updatePlaylistAfterTrackRemoved(playlist, track) {
  const nextTracks = state.playlistTracks.filter((item) => {
    if (track.PlaylistItemId && item.PlaylistItemId) {
      return item.PlaylistItemId !== track.PlaylistItemId;
    }

    return item.Id !== track.Id;
  });
  const currentCount = Number(playlist.ChildCount || playlist.SongCount || playlist.ItemCount || state.playlistTracks.length || 0);
  const nextPlaylist = {
    ...playlist,
    ChildCount: Math.max(0, currentCount - 1),
  };

  state.selectedPlaylist = state.selectedPlaylist?.Id === playlist.Id
    ? { ...state.selectedPlaylist, ...nextPlaylist }
    : state.selectedPlaylist;
  state.playlistTracks = nextTracks;
  state.playlists = state.playlists.map((item) => item.Id === playlist.Id ? { ...item, ...nextPlaylist } : item);

  applyFilters();
  renderLibrary();
}

function openPlaylistPicker(track) {
  if (!track?.Id) {
    return;
  }

  if (!state.playlists.length) {
    showNotice("还没有读取到可用歌单。", {
      type: "warning",
      actions: [
        { label: "查看歌单", handler: () => switchView("playlists") },
        { label: "刷新音乐库", handler: refreshLibrary },
      ],
    });
    return;
  }

  state.playlistPickerTrack = track;
  playlistPickerTrack.textContent = track.Name || "未命名歌曲";
  playlistPickerMessage.textContent = "";
  playlistPickerMessage.className = "message compact";
  playlistPickerSelect.replaceChildren();

  sortPlaylists(state.playlists).forEach((playlist) => {
    const option = document.createElement("option");
    option.value = playlist.Id;
    option.textContent = playlist.Name || "未命名歌单";
    playlistPickerSelect.append(option);
  });

  playlistPicker.hidden = false;
  playlistPickerSelect.focus();
  updatePlaylistPickerBusyState(false);
}

function closePlaylistPicker(options = {}) {
  if (state.isAddingToPlaylist && !options.force) {
    return;
  }

  playlistPicker.hidden = true;
  state.playlistPickerTrack = null;
  playlistPickerSelect.replaceChildren();
  playlistPickerMessage.textContent = "";
}

async function addSelectedTrackToPlaylist() {
  const track = state.playlistPickerTrack;
  const playlist = state.playlists.find((item) => item.Id === playlistPickerSelect.value);

  if (!state.session || !track?.Id || !playlist?.Id) {
    playlistPickerMessage.textContent = "请选择歌曲和歌单。";
    playlistPickerMessage.className = "message compact error";
    return;
  }

  if (isTrackKnownInPlaylist(playlist, track)) {
    playlistPickerMessage.textContent = "这首歌已经在当前歌单里。";
    playlistPickerMessage.className = "message compact";
    return;
  }

  updatePlaylistPickerBusyState(true);
  playlistPickerMessage.textContent = "正在添加到歌单...";
  playlistPickerMessage.className = "message compact";

  try {
    await addTrackToEmbyPlaylist(playlist, track);
    updatePlaylistAfterTrackAdded(playlist, track);
    setLibraryStatus(`已添加到歌单：${playlist.Name || "未命名歌单"}。`);
    closePlaylistPicker({ force: true });
  } catch (error) {
    playlistPickerMessage.textContent = `添加失败：${readableError(error)}`;
    playlistPickerMessage.className = "message compact error";
  } finally {
    updatePlaylistPickerBusyState(false);
  }
}

async function addTrackToEmbyPlaylist(playlist, track) {
  const path = `/Playlists/${encodeURIComponent(playlist.Id)}/Items?${toQueryString({
    UserId: state.session.userId,
    Ids: track.Id,
  })}`;

  await embyRequest("POST", path);
}

function isTrackKnownInPlaylist(playlist, track) {
  return state.selectedPlaylist?.Id === playlist.Id
    && state.playlistTracks.some((item) => item.Id === track.Id);
}

function updatePlaylistAfterTrackAdded(playlist, track) {
  const currentCount = Number(playlist.ChildCount || playlist.SongCount || playlist.ItemCount || 0);
  const nextPlaylist = {
    ...playlist,
    ChildCount: currentCount + 1,
  };

  state.playlists = state.playlists.map((item) => item.Id === playlist.Id ? { ...item, ...nextPlaylist } : item);
  state.filteredPlaylists = state.filteredPlaylists.map((item) => item.Id === playlist.Id ? { ...item, ...nextPlaylist } : item);
  state.filteredFavoritePlaylists = state.filteredFavoritePlaylists.map((item) => item.Id === playlist.Id ? { ...item, ...nextPlaylist } : item);

  if (state.selectedPlaylist?.Id === playlist.Id) {
    state.selectedPlaylist = { ...state.selectedPlaylist, ...nextPlaylist };
    state.playlistTracks = mergeUniqueItems(state.playlistTracks, [track]);
  }

  applyFilters();
  renderLibrary();
}

function updatePlaylistPickerBusyState(isBusy) {
  state.isAddingToPlaylist = isBusy;
  playlistPickerAdd.disabled = isBusy;
  playlistPickerCancel.disabled = isBusy;
  playlistPickerClose.disabled = isBusy;
  playlistPickerSelect.disabled = isBusy;
  playlistPickerAdd.textContent = isBusy ? "添加中..." : "添加";
}

function shuffleQueueRemainder() {
  const range = getShuffleableQueueRange();

  if (range.length < 2) {
    setLibraryStatus("没有足够的待播歌曲可随机重排。");
    return;
  }

  const shuffled = [...range];
  shuffleTracks(shuffled);

  const startIndex = getQueueShuffleStartIndex();
  state.queue = [
    ...state.queue.slice(0, startIndex),
    ...shuffled,
  ];

  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  renderQueue();
  updateActiveRows();
  preloadNextTrack();
  saveQueueState();
  setLibraryStatus(`已随机重排 ${shuffled.length} 首待播歌曲。`);
}

function organizeQueueRemainder() {
  const range = getShuffleableQueueRange();

  if (range.length < 2) {
    setLibraryStatus("没有足够的待播歌曲可整理。");
    return;
  }

  const organized = sortQueueTracks(range);
  const isUnchanged = organized.every((track, index) => track.Id === range[index]?.Id);

  if (isUnchanged) {
    setLibraryStatus("待播队列已经是整理后的顺序。");
    return;
  }

  const startIndex = getQueueShuffleStartIndex();
  state.queue = [
    ...state.queue.slice(0, startIndex),
    ...organized,
  ];

  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  saveQueueState();
  renderQueue();
  updateActiveRows();
  preloadNextTrack();
  setLibraryStatus(`已整理 ${organized.length} 首待播歌曲。`);
}

function sortQueueTracks(tracks) {
  return [...tracks].sort((left, right) => {
    return compareText(left.AlbumArtist || getArtists(left), right.AlbumArtist || getArtists(right))
      || compareText(left.Album, right.Album)
      || compareNumber(left.ParentIndexNumber, right.ParentIndexNumber)
      || compareNumber(left.IndexNumber, right.IndexNumber)
      || compareText(left.Name, right.Name)
      || compareDate(left.DateCreated, right.DateCreated);
  });
}

function getShuffleableQueueRange() {
  if (state.queue.length < 2) {
    return [];
  }

  return state.queue.slice(getQueueShuffleStartIndex());
}

function getQueueShuffleStartIndex() {
  const currentIndex = getCurrentQueueIndex();

  return currentIndex >= 0 ? currentIndex + 1 : 0;
}

function getCurrentQueueIndex() {
  if (!state.currentTrack?.Id || !state.queue.length) {
    return -1;
  }

  if (state.currentTrackIndex >= 0 && state.queue[state.currentTrackIndex]?.Id === state.currentTrack.Id) {
    return state.currentTrackIndex;
  }

  return state.queue.findIndex((track) => track.Id === state.currentTrack.Id);
}

function resetShufflePlaybackState() {
  state.shuffleHistory = [];
  state.shuffleUpcomingIds = [];
}

function pruneShufflePlaybackState() {
  if (!state.queue.length) {
    resetShufflePlaybackState();
    return;
  }

  const queueIds = new Set(state.queue.map((track) => track.Id).filter(Boolean));
  state.shuffleHistory = state.shuffleHistory
    .filter((id) => queueIds.has(id) && id !== state.currentTrack?.Id)
    .slice(-SHUFFLE_HISTORY_LIMIT);
  state.shuffleUpcomingIds = state.shuffleUpcomingIds
    .filter((id) => queueIds.has(id) && id !== state.currentTrack?.Id);
}

function getQueueTrackById(trackId) {
  return trackId ? state.queue.find((track) => track.Id === trackId) || null : null;
}

function rememberShuffleHistory(track) {
  if (state.playMode !== "shuffle" || !track?.Id || !state.queue.some((item) => item.Id === track.Id)) {
    return;
  }

  state.shuffleHistory = [
    ...state.shuffleHistory.filter((id) => id !== track.Id),
    track.Id,
  ].slice(-SHUFFLE_HISTORY_LIMIT);
}

function forgetShuffleUpcomingTrack(trackId) {
  if (!trackId) {
    return;
  }

  state.shuffleUpcomingIds = state.shuffleUpcomingIds.filter((id) => id !== trackId);
}

function getShuffleCandidateTracks() {
  const currentId = state.currentTrack?.Id || "";
  return state.queue.filter((track) => track?.Id && track.Id !== currentId);
}

function refillShuffleUpcomingQueue(limit = 1) {
  pruneShufflePlaybackState();

  const neededCount = Math.max(0, limit - state.shuffleUpcomingIds.length);
  if (!neededCount) {
    return;
  }

  const candidates = getShuffleCandidateTracks()
    .filter((track) => !state.shuffleUpcomingIds.includes(track.Id));

  if (!candidates.length) {
    return;
  }

  shuffleTracks(candidates);

  const nextIds = candidates.slice(0, neededCount).map((track) => track.Id);
  state.shuffleUpcomingIds = [...state.shuffleUpcomingIds, ...nextIds];
}

function getNextShuffleTrackId() {
  if (state.playMode !== "shuffle" || state.queue.length < 2) {
    return "";
  }

  refillShuffleUpcomingQueue(1);
  return state.shuffleUpcomingIds[0] || "";
}

function takeShuffleHistoryTrack() {
  pruneShufflePlaybackState();

  while (state.shuffleHistory.length) {
    const trackId = state.shuffleHistory.pop();
    const track = getQueueTrackById(trackId);

    if (track && track.Id !== state.currentTrack?.Id) {
      forgetShuffleUpcomingTrack(track.Id);
      return track;
    }
  }

  return null;
}

function prioritizeShuffleUpcomingTracks(trackIds) {
  if (!Array.isArray(trackIds) || !trackIds.length) {
    return;
  }

  const queueIds = new Set(state.queue.map((track) => track.Id));
  const currentId = state.currentTrack?.Id || "";
  const nextIds = trackIds.filter((id, index) => id && id !== currentId && queueIds.has(id) && trackIds.indexOf(id) === index);
  const nextIdSet = new Set(nextIds);

  state.shuffleUpcomingIds = [
    ...nextIds,
    ...state.shuffleUpcomingIds.filter((id) => !nextIdSet.has(id)),
  ];
}

function areQueuesSameById(leftQueue, rightQueue) {
  if (!Array.isArray(leftQueue) || !Array.isArray(rightQueue) || leftQueue.length !== rightQueue.length) {
    return false;
  }

  return leftQueue.every((track, index) => track?.Id === rightQueue[index]?.Id);
}

function syncShufflePlaybackStateForTrackChange(previousTrack, nextTrack, nextQueue, options = {}) {
  const queueChanged = !areQueuesSameById(state.queue, nextQueue);

  if (queueChanged || options.resetShuffleHistory) {
    resetShufflePlaybackState();
  } else {
    pruneShufflePlaybackState();
  }

  if (previousTrack?.Id && nextTrack?.Id && previousTrack.Id !== nextTrack.Id) {
    if (!options.fromShuffleHistory && !options.skipShuffleHistory) {
      rememberShuffleHistory(previousTrack);
    }

    forgetShuffleUpcomingTrack(nextTrack.Id);
  }
}

function clearPlayedQueueTracks() {
  closeQuickQueue({ restoreFocus: false });
  const currentIndex = getCurrentQueueIndex();

  if (currentIndex <= 0) {
    setLibraryStatus("没有可清除的已播歌曲。");
    return;
  }

  const undoSnapshot = saveQueueUndoSnapshot("clear-played");
  state.queue = state.queue.slice(currentIndex);
  state.currentTrackIndex = 0;
  pruneShufflePlaybackState();
  saveQueueState();
  renderQueue();
  updateActiveRows();
  preloadNextTrack();
  showQueueUndoNotice(`已清除 ${currentIndex} 首已播歌曲。`, undoSnapshot);
}

function clearQueue() {
  closeQuickQueue({ restoreFocus: false });
  const clearedCount = state.queue.length;
  const undoSnapshot = saveQueueUndoSnapshot("clear-all");

  state.playRequestId += 1;
  state.isChangingTrack = true;
  reportPlaybackStopped();
  audioPlayer.pause();
  unloadAudioSource();
  clearPreload();
  state.queue = [];
  state.currentTrackIndex = -1;
  state.currentTrack = null;
  state.savedPlaybackPositionSeconds = 0;
  state.currentPlaybackMode = "direct";
  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
  state.isChangingTrack = false;
  state.fallbackAttempted = false;
  state.qualityFallbackAttempted = false;
  resetShufflePlaybackState();
  clearQueueState();
  resetPlayerMeta();
  renderQueue();
  updateActiveRows();
  setPlayerEnabled(false);
  updateProgress();
  showQueueUndoNotice(`播放队列已清空，共 ${clearedCount} 首。`, undoSnapshot);
}

function saveQueueUndoSnapshot(reason) {
  const snapshot = createQueueUndoSnapshot(reason);
  state.queueUndoSnapshot = snapshot;
  return snapshot;
}

function createQueueUndoSnapshot(reason) {
  if (!state.queue.length) {
    return null;
  }

  const currentIndex = getCurrentQueueIndex();
  const currentTrack = state.currentTrack
    || state.queue[currentIndex]
    || state.queue[state.currentTrackIndex]
    || state.queue[0];
  const resolvedIndex = currentTrack
    ? state.queue.findIndex((track) => track.Id === currentTrack.Id)
    : currentIndex;

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    reason,
    queue: state.queue.map(sanitizeQueueTrack),
    currentTrackId: currentTrack?.Id || "",
    currentTrackIndex: resolvedIndex >= 0 ? resolvedIndex : 0,
    savedPlaybackPositionSeconds: getQueuePositionSeconds(),
    queueSavedAt: state.queueSavedAt,
    currentPlaybackMode: state.currentPlaybackMode,
    shuffleHistory: [...state.shuffleHistory],
    shuffleUpcomingIds: [...state.shuffleUpcomingIds],
  };
}

function showQueueUndoNotice(text, snapshot) {
  showNotice(text, {
    actions: snapshot ? [{ label: "撤销", handler: () => restoreQueueUndoSnapshot(snapshot.id) }] : [],
  });
}

function restoreQueueUndoSnapshot(snapshotId) {
  const snapshot = state.queueUndoSnapshot;

  if (!snapshot || snapshot.id !== snapshotId) {
    setLibraryStatus("没有可撤销的队列操作。");
    return;
  }

  const queue = snapshot.queue.map((track) => ({ ...track }));

  if (!queue.length) {
    state.queueUndoSnapshot = null;
    setLibraryStatus("没有可恢复的队列。");
    return;
  }

  const activePlayback = {
    trackId: state.currentTrack?.Id || "",
    mode: state.currentPlaybackMode,
    mediaSourceId: state.currentMediaSourceId,
    playSessionId: state.currentPlaySessionId,
    hasReportedPlaybackStart: state.hasReportedPlaybackStart,
    hasAudio: Boolean(audioPlayer.src),
  };
  const fallbackIndex = clamp(Number(snapshot.currentTrackIndex) || 0, 0, queue.length - 1);
  const restoredTrack = queue.find((track) => track.Id === snapshot.currentTrackId) || queue[fallbackIndex] || queue[0];
  const restoredIndex = queue.findIndex((track) => track.Id === restoredTrack.Id);

  state.queue = queue;
  state.currentTrack = restoredTrack;
  state.currentTrackIndex = restoredIndex >= 0 ? restoredIndex : fallbackIndex;
  state.savedPlaybackPositionSeconds = Number(snapshot.savedPlaybackPositionSeconds) || 0;
  state.queueSavedAt = snapshot.queueSavedAt || "";
  state.shuffleHistory = Array.isArray(snapshot.shuffleHistory) ? [...snapshot.shuffleHistory] : [];
  state.shuffleUpcomingIds = Array.isArray(snapshot.shuffleUpcomingIds) ? [...snapshot.shuffleUpcomingIds] : [];
  pruneShufflePlaybackState();

  if (activePlayback.hasAudio && activePlayback.trackId === restoredTrack.Id && activePlayback.hasReportedPlaybackStart) {
    state.currentPlaybackMode = activePlayback.mode;
    state.currentMediaSourceId = activePlayback.mediaSourceId;
    state.currentPlaySessionId = activePlayback.playSessionId;
    state.hasReportedPlaybackStart = activePlayback.hasReportedPlaybackStart;
  } else {
    state.currentPlaybackMode = snapshot.currentPlaybackMode || "direct";
    state.currentMediaSourceId = "";
    state.currentPlaySessionId = "";
    state.hasReportedPlaybackStart = false;
    state.isChangingTrack = false;
  }

  state.queueUndoSnapshot = null;
  saveQueueState(state.savedPlaybackPositionSeconds);
  updatePlayerMeta(restoredTrack);
  setPlayerEnabled(true);
  renderQueue();
  updateActiveRows();
  renderHomeStartPanel();
  renderRestoredPlaybackProgress(restoredTrack);
  preloadNextTrack();
  setLibraryStatus(`已恢复播放队列，共 ${queue.length} 首。`);
}

function addTrackToQueue(track) {
  if (!track?.Id) {
    return;
  }

  if (!state.currentTrack || !state.queue.length) {
    playTrack(track, [track]);
    return;
  }

  if (state.queue.some((item) => item.Id === track.Id)) {
    setLibraryStatus("这首歌已经在队列中。");
    return;
  }

  state.queue = [...state.queue, track];
  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  saveQueueState();
  renderQueue();
  setPlayerEnabled(true);
  updateActiveRows();
  preloadNextTrack();
  setLibraryStatus("已添加到播放队列。");
}

function addTrackToPlayNext(track) {
  if (!track?.Id) {
    return;
  }

  if (!state.currentTrack || !state.queue.length) {
    state.queue = [track];
    state.currentTrackIndex = 0;
    state.currentTrack = track;
    state.currentPlaybackMode = "direct";
    state.currentMediaSourceId = getTrackDefaultMediaSourceId(track);
    state.currentPlaySessionId = "";
    state.hasReportedPlaybackStart = false;
    state.fallbackAttempted = false;
    state.qualityFallbackAttempted = false;
    state.savedPlaybackPositionSeconds = 0;
    resetShufflePlaybackState();
    updatePlayerMeta(track);
    setPlayerEnabled(true);
    renderQueue();
    updateActiveRows();
    updateProgress();
    saveQueueState(0);
    setLibraryStatus("已设为下一首，点击播放开始。");
    return;
  }

  const currentIndex = state.currentTrackIndex >= 0
    ? state.currentTrackIndex
    : state.queue.findIndex((item) => item.Id === state.currentTrack.Id);

  if (state.queue[currentIndex]?.Id === track.Id) {
    setLibraryStatus("这首歌正在播放。");
    return;
  }

  if (state.queue[currentIndex + 1]?.Id === track.Id) {
    setLibraryStatus("这首歌已经是下一首。");
    return;
  }

  const queuedTrack = state.queue.find((item) => item.Id === track.Id) || track;
  const queueWithoutTrack = state.queue.filter((item) => item.Id !== track.Id);
  const adjustedCurrentIndex = queueWithoutTrack.findIndex((item) => item.Id === state.currentTrack.Id);
  const insertIndex = adjustedCurrentIndex >= 0
    ? adjustedCurrentIndex + 1
    : Math.min(currentIndex + 1, queueWithoutTrack.length);

  queueWithoutTrack.splice(insertIndex, 0, queuedTrack);
  state.queue = queueWithoutTrack;
  syncCurrentTrackIndex();
  prioritizeShuffleUpcomingTracks([queuedTrack.Id]);
  renderQueue();
  setPlayerEnabled(true);
  updateActiveRows();
  preloadNextTrack();
  saveQueueState();
  setLibraryStatus("已设为下一首播放。");
}

function playTrackCollectionNext(tracks, label) {
  const incomingTracks = mergeUniqueItems([], normalizeItems(tracks).filter(isAudioItem));

  if (!incomingTracks.length) {
    setLibraryStatus(`没有可设为下一首的${label}。`);
    return;
  }

  if (!state.currentTrack || !state.queue.length) {
    state.queue = incomingTracks;
    state.currentTrackIndex = 0;
    state.currentTrack = incomingTracks[0];
    state.currentPlaybackMode = "direct";
    state.currentMediaSourceId = getTrackDefaultMediaSourceId(state.currentTrack);
    state.currentPlaySessionId = "";
    state.hasReportedPlaybackStart = false;
    state.fallbackAttempted = false;
    state.qualityFallbackAttempted = false;
    state.savedPlaybackPositionSeconds = 0;
    resetShufflePlaybackState();
    updatePlayerMeta(state.currentTrack);
    setPlayerEnabled(true);
    renderQueue();
    updateActiveRows();
    updateProgress();
    saveQueueState(0);
    setLibraryStatus(`已将${label}设为待播队列，点击播放开始。`);
    return;
  }

  const currentId = state.currentTrack.Id;
  const existingById = new Map(state.queue.map((track) => [track.Id, track]));
  const nextTracks = incomingTracks
    .filter((track) => track.Id !== currentId)
    .map((track) => existingById.get(track.Id) || track);

  if (!nextTracks.length) {
    setLibraryStatus(`${label}没有可移动到下一首的歌曲。`);
    return;
  }

  const currentIndex = state.currentTrackIndex >= 0
    ? state.currentTrackIndex
    : state.queue.findIndex((track) => track.Id === currentId);
  const nextIds = nextTracks.map((track) => track.Id);
  const existingNextIds = state.queue
    .slice(currentIndex + 1, currentIndex + 1 + nextIds.length)
    .map((track) => track.Id);

  if (existingNextIds.length === nextIds.length && existingNextIds.every((id, index) => id === nextIds[index])) {
    setLibraryStatus(`${label}已经排在下一首之后。`);
    return;
  }

  const nextIdSet = new Set(nextIds);
  const queueWithoutTracks = state.queue.filter((track) => !nextIdSet.has(track.Id));
  const adjustedCurrentIndex = queueWithoutTracks.findIndex((track) => track.Id === currentId);
  const insertIndex = adjustedCurrentIndex >= 0
    ? adjustedCurrentIndex + 1
    : Math.min(currentIndex + 1, queueWithoutTracks.length);

  queueWithoutTracks.splice(insertIndex, 0, ...nextTracks);
  state.queue = queueWithoutTracks;
  syncCurrentTrackIndex();
  prioritizeShuffleUpcomingTracks(nextIds);
  renderQueue();
  setPlayerEnabled(true);
  updateActiveRows();
  preloadNextTrack();
  saveQueueState();
  setLibraryStatus(`已将${label}排到下一首之后。`);
}

function queueTrackCollection(tracks, label) {
  const incomingTracks = mergeUniqueItems([], normalizeItems(tracks).filter(isAudioItem));

  if (!incomingTracks.length) {
    setLibraryStatus(`没有可加入队列的${label}。`);
    return;
  }

  if (!state.queue.length) {
    state.queue = incomingTracks;
    state.currentTrackIndex = 0;
    state.currentTrack = incomingTracks[0];
    state.currentPlaybackMode = "direct";
    state.currentMediaSourceId = getTrackDefaultMediaSourceId(state.currentTrack);
    state.currentPlaySessionId = "";
    state.hasReportedPlaybackStart = false;
    state.fallbackAttempted = false;
    state.qualityFallbackAttempted = false;
    state.savedPlaybackPositionSeconds = 0;
    resetShufflePlaybackState();
    updatePlayerMeta(state.currentTrack);
    setPlayerEnabled(true);
    renderQueue();
    updateActiveRows();
    updateProgress();
    saveQueueState(0);
    setLibraryStatus(`已将${label}加入队列，点击播放开始。`);
    return;
  }

  const existingIds = new Set(state.queue.map((track) => track.Id));
  const nextTracks = incomingTracks.filter((track) => !existingIds.has(track.Id));

  if (!nextTracks.length) {
    setLibraryStatus(`${label}已经都在队列中。`);
    return;
  }

  state.queue = [...state.queue, ...nextTracks];
  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  renderQueue();
  setPlayerEnabled(true);
  updateActiveRows();
  preloadNextTrack();
  saveQueueState();
  setLibraryStatus(`已添加 ${nextTracks.length} 首${label}到队列。`);
}

function removeQueueTrack(index) {
  if (index < 0 || index >= state.queue.length) {
    return;
  }

  if (index === state.currentTrackIndex) {
    const nextQueue = state.queue.filter((_, itemIndex) => itemIndex !== index);

    if (!nextQueue.length) {
      clearQueue();
      return;
    }

    const nextIndex = Math.min(index, nextQueue.length - 1);
    playTrack(nextQueue[nextIndex], nextQueue);
    return;
  }

  state.queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  saveQueueState();
  renderQueue();
  setPlayerEnabled(Boolean(state.queue.length));
  updateActiveRows();
  preloadNextTrack();
  setLibraryStatus("已从队列移除。");
}

function moveQueueTrack(index, direction) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= state.queue.length) {
    return;
  }

  reorderQueueTrack(index, nextIndex, { announce: false });
}

function reorderQueueTrack(fromIndex, toIndex, options = {}) {
  if (
    fromIndex < 0
    || fromIndex >= state.queue.length
    || toIndex < 0
    || toIndex >= state.queue.length
    || fromIndex === toIndex
  ) {
    return;
  }

  const nextQueue = [...state.queue];
  const [movedTrack] = nextQueue.splice(fromIndex, 1);
  nextQueue.splice(toIndex, 0, movedTrack);
  state.queue = nextQueue;
  syncCurrentTrackIndex();
  pruneShufflePlaybackState();
  saveQueueState();
  renderQueue();
  updateActiveRows();
  preloadNextTrack();

  if (options.announce !== false) {
    setLibraryStatus("队列顺序已更新。");
  }
}

function handleQueueDragStart(event, index) {
  if (index < 0 || index >= state.queue.length) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(index));
  event.currentTarget.classList.add("dragging");
}

function handleQueueDragOver(event, index) {
  const fromIndex = getDraggedQueueIndex(event);

  if (fromIndex < 0 || fromIndex === index) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drag-over");
}

function handleQueueDrop(event, index) {
  const fromIndex = getDraggedQueueIndex(event);

  event.preventDefault();
  clearQueueDragState();

  if (fromIndex < 0 || fromIndex === index) {
    return;
  }

  const toIndex = fromIndex < index ? index : index;
  reorderQueueTrack(fromIndex, toIndex);
}

function getDraggedQueueIndex(event) {
  const value = event.dataTransfer?.getData("text/plain");
  const index = Number(value);

  return Number.isInteger(index) ? index : -1;
}

function clearQueueDragState() {
  document.querySelectorAll(".track-row.dragging, .track-row.drag-over").forEach((row) => {
    row.classList.remove("dragging", "drag-over");
  });
}

function syncCurrentTrackIndex() {
  if (!state.currentTrack) {
    state.currentTrackIndex = -1;
    return;
  }

  state.currentTrackIndex = state.queue.findIndex((item) => item.Id === state.currentTrack.Id);
}

function addRecentTrack(track) {
  const nextTrack = {
    ...track,
    LastPlayedAt: new Date().toISOString(),
  };

  state.recentUndoSnapshot = null;
  state.recentTracks = [
    nextTrack,
    ...state.recentTracks.filter((item) => item.Id !== track.Id),
  ].slice(0, MAX_RECENT_TRACKS);

  saveRecentTracks();
  renderRecent();
  renderHomeSections();
}

function clearRecentTracks() {
  if (!state.recentTracks.length) {
    setLibraryStatus("没有可清空的最近播放记录。");
    return;
  }

  const snapshot = saveRecentUndoSnapshot();
  const clearedCount = state.recentTracks.length;

  state.recentTracks = [];
  saveRecentTracks();
  renderRecent();
  renderHomeSections();
  showRecentUndoNotice(`最近播放记录已清空，共 ${clearedCount} 首。`, snapshot);
}

function saveRecentUndoSnapshot() {
  const snapshot = createRecentUndoSnapshot();
  state.recentUndoSnapshot = snapshot;
  return snapshot;
}

function createRecentUndoSnapshot() {
  if (!state.recentTracks.length) {
    return null;
  }

  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    tracks: state.recentTracks.map(sanitizeQueueTrack),
  };
}

function showRecentUndoNotice(text, snapshot) {
  showNotice(text, {
    actions: snapshot ? [{ label: "撤销", handler: () => restoreRecentUndoSnapshot(snapshot.id) }] : [],
  });
}

function restoreRecentUndoSnapshot(snapshotId) {
  const snapshot = state.recentUndoSnapshot;

  if (!snapshot || snapshot.id !== snapshotId) {
    setLibraryStatus("没有可撤销的最近播放操作。");
    return;
  }

  state.recentTracks = snapshot.tracks.map((track) => ({ ...track })).slice(0, MAX_RECENT_TRACKS);
  state.recentUndoSnapshot = null;
  saveRecentTracks();
  renderRecent();
  renderHomeSections();
  setLibraryStatus(`已恢复最近播放记录，共 ${state.recentTracks.length} 首。`);
}

function applyFilters() {
  const query = state.query;
  const genre = state.genreFilter;
  const year = state.yearFilter;
  const quality = state.qualityFilter;
  const favorite = state.favoriteFilter;
  state.availableGenres = getAvailableGenres();
  state.availableYears = getAvailableYears();
  state.availableQualities = getAvailableQualities();

  state.filteredAlbums = sortAlbums(state.albums.filter((album) => matchesQuery(album, query) && matchesGenre(album, genre) && matchesYear(album, year) && matchesAlbumQuality(album, quality) && matchesFavoriteFilter(album, favorite)));
  state.filteredArtists = sortArtists(state.artists.filter((artist) => matchesQuery(artist, query) && matchesFavoriteFilter(artist, favorite)));
  state.filteredPlaylists = sortPlaylists(state.playlists.filter((playlist) => matchesQuery(playlist, query) && matchesFavoriteFilter(playlist, favorite)));
  state.filteredFavoriteAlbums = sortAlbums(state.albums.filter((album) => isFavorite(album) && matchesQuery(album, query) && matchesGenre(album, genre) && matchesYear(album, year) && matchesAlbumQuality(album, quality) && matchesFavoriteFilter(album, favorite)));
  state.filteredFavoriteArtists = sortArtists(state.artists.filter((artist) => isFavorite(artist) && matchesQuery(artist, query) && matchesFavoriteFilter(artist, favorite)));
  state.filteredFavoritePlaylists = sortPlaylists(state.playlists.filter((playlist) => isFavorite(playlist) && matchesQuery(playlist, query) && matchesFavoriteFilter(playlist, favorite)));
  state.filteredFavoriteTracks = sortTracks(state.favoriteTracks.filter((track) => matchesQuery(track, query) && matchesGenre(track, genre) && matchesYear(track, year) && matchesQuality(track, quality) && matchesFavoriteFilter(track, favorite)));
  state.filteredTracks = sortTracks(state.tracks.filter((track) => matchesTrackFilters(track)));
}

function getAvailableGenres() {
  const genres = new Set();

  [...state.tracks, ...state.albums, ...state.favoriteTracks].forEach((item) => {
    getGenres(item).forEach((genre) => {
      genres.add(genre);
    });
  });

  return [...genres].sort((left, right) => compareText(left, right));
}

function getAvailableYears() {
  const years = new Set();

  [...state.tracks, ...state.albums, ...state.favoriteTracks].forEach((item) => {
    const year = getProductionYear(item);

    if (year) {
      years.add(year);
    }
  });

  return [...years].sort((left, right) => right - left);
}

function getAvailableQualities() {
  const qualities = new Set();

  [...state.tracks, ...state.favoriteTracks].forEach((track) => {
    const quality = getTrackQualityBucket(track);

    if (quality) {
      qualities.add(quality);
    }
  });

  return QUALITY_FILTER_ORDER.filter((quality) => qualities.has(quality));
}

function getFilteredFavoriteCount() {
  return state.filteredFavoriteAlbums.length
    + state.filteredFavoriteArtists.length
    + state.filteredFavoritePlaylists.length
    + state.filteredFavoriteTracks.length;
}

function getTrackCollectionDuration(tracks) {
  const ticks = tracks.reduce((total, track) => {
    const trackTicks = Number(track?.RunTimeTicks);
    return total + (Number.isFinite(trackTicks) && trackTicks > 0 ? trackTicks : 0);
  }, 0);

  return ticks > 0 ? formatDuration(ticks / 10000000) : "";
}

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  const text = [
    item.Name,
    item.Album,
    item.AlbumArtist,
    ...(item.Artists || []),
    ...(item.ArtistItems || []).map((artist) => artist.Name),
    ...(item.AlbumArtists || []).map((artist) => artist.Name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(query);
}

function matchesTrackFilters(track, options = {}) {
  const includeDetailFilters = options.includeDetailFilters !== false;

  if (includeDetailFilters && state.albumFilter && track.AlbumId !== state.albumFilter && track.Album !== getAlbumName(state.albumFilter)) {
    return false;
  }

  if (includeDetailFilters && state.artistFilter && !trackHasArtist(track, state.artistFilter)) {
    return false;
  }

  return matchesQuery(track, state.query)
    && matchesGenre(track, state.genreFilter)
    && matchesYear(track, state.yearFilter)
    && matchesQuality(track, state.qualityFilter)
    && matchesFavoriteFilter(track, state.favoriteFilter);
}

function matchesFavoriteFilter(item, favoriteFilter) {
  if (favoriteFilter === "favorite") {
    return isFavorite(item);
  }

  if (favoriteFilter === "unfavorite") {
    return !isFavorite(item);
  }

  return true;
}

function getFavoriteFilterLabel(favoriteFilter) {
  if (favoriteFilter === "favorite") {
    return "已收藏";
  }

  if (favoriteFilter === "unfavorite") {
    return "未收藏";
  }

  return "全部";
}

function renderLibraryQuickPanel() {
  if (!libraryQuickTitle) {
    return;
  }

  const activeFilters = getLibraryQuickFilterLabels();
  const totalLabel = getTrackCollectionMeta(state.filteredTracks);

  libraryQuickTitle.textContent = activeFilters.length ? activeFilters.join(" / ") : "全部歌曲";
  libraryQuickMeta.textContent = [
    totalLabel,
    state.isServerSearching ? "搜索中" : "",
    getSortKeyLabel(state.sortKey),
  ].filter(Boolean).join(" · ");

  quickFavoriteButton.classList.toggle("active", state.favoriteFilter === "favorite");
  quickFavoriteButton.setAttribute("aria-pressed", state.favoriteFilter === "favorite" ? "true" : "false");
  quickLosslessButton.classList.toggle("active", state.qualityFilter === "lossless");
  quickLosslessButton.setAttribute("aria-pressed", state.qualityFilter === "lossless" ? "true" : "false");
  quickRecentButton.classList.toggle("active", state.sortKey === "recent");
  quickRecentButton.setAttribute("aria-pressed", state.sortKey === "recent" ? "true" : "false");
  quickCompactButton.classList.toggle("active", state.trackDensity === "compact");
  quickCompactButton.setAttribute("aria-pressed", state.trackDensity === "compact" ? "true" : "false");
  quickCompactButton.textContent = getTrackDensityLabel(state.trackDensity);
  quickCompactButton.title = state.trackDensity === "compact" ? "切换到舒适列表" : "切换到紧凑列表";
  quickPlayFilteredButton.disabled = !state.filteredTracks.length;
  quickQueueFilteredButton.disabled = !state.filteredTracks.length;
  syncEnhancedLibrarySelects();
}

function getLibraryQuickFilterLabels() {
  const filters = [];

  if (state.query) {
    filters.push(`搜索 ${state.query}`);
  }

  if (state.albumFilter) {
    filters.push(getAlbumName(state.albumFilter) || "专辑筛选");
  }

  if (state.artistFilter) {
    filters.push(getArtistName(state.artistFilter) || "艺人筛选");
  }

  if (state.genreFilter) {
    filters.push(state.genreFilter);
  }

  if (state.yearFilter) {
    filters.push(`${state.yearFilter} 年`);
  }

  if (state.qualityFilter) {
    filters.push(QUALITY_FILTER_LABELS[state.qualityFilter] || state.qualityFilter);
  }

  if (state.favoriteFilter) {
    filters.push(getFavoriteFilterLabel(state.favoriteFilter));
  }

  return filters;
}

function getCurrentFilterState() {
  return {
    genre: state.genreFilter,
    year: state.yearFilter,
    quality: state.qualityFilter,
    favorite: state.favoriteFilter,
  };
}

function saveCurrentFilterState() {
  storage.saveFilterState(state.session, getCurrentFilterState());
}

function getSavedFilterLabel() {
  const filters = [];

  if (state.genreFilter) {
    filters.push(`风格 ${state.genreFilter}`);
  }

  if (state.yearFilter) {
    filters.push(`年份 ${state.yearFilter}`);
  }

  if (state.qualityFilter) {
    filters.push(`音质 ${QUALITY_FILTER_LABELS[state.qualityFilter] || state.qualityFilter}`);
  }

  if (state.favoriteFilter) {
    filters.push(`收藏 ${getFavoriteFilterLabel(state.favoriteFilter)}`);
  }

  return filters.length ? filters.join(" / ") : "全部";
}

function getBrowserNetworkLabel() {
  return state.isBrowserOnline ? "在线" : "离线";
}

function matchesGenre(item, genre) {
  if (!genre) {
    return true;
  }

  return getGenres(item).some((itemGenre) => normalizeSearchText(itemGenre) === normalizeSearchText(genre));
}

function matchesYear(item, year) {
  if (!year) {
    return true;
  }

  return String(getProductionYear(item)) === String(year);
}

function matchesQuality(track, quality) {
  if (!quality) {
    return true;
  }

  return getTrackQualityBucket(track) === quality;
}

function matchesAlbumQuality(album, quality) {
  if (!quality) {
    return true;
  }

  return getAlbumTracks(album).some((track) => matchesQuality(track, quality));
}

function getTrackQualityBucket(track) {
  const summary = getTrackQualitySummary(track);

  if (!summary) {
    return "";
  }

  return summary.isLossless ? "lossless" : "lossy";
}

function getAlbumQualityBucket(album) {
  const buckets = getAlbumTracks(album)
    .map(getTrackQualityBucket)
    .filter(Boolean);

  if (buckets.includes("lossless")) {
    return "lossless";
  }

  return buckets[0] || "";
}

function getAlbumTracks(album) {
  if (!album) {
    return [];
  }

  return state.tracks.filter((track) => {
    return (track.AlbumId && track.AlbumId === album.Id)
      || (track.Album && album.Name && normalizeSearchText(track.Album) === normalizeSearchText(album.Name));
  });
}

function getGenres(item) {
  return (Array.isArray(item?.Genres) ? item.Genres : [])
    .map((genre) => String(genre || "").trim())
    .filter(Boolean);
}

function getProductionYear(item) {
  const year = Number(item?.ProductionYear);

  return Number.isInteger(year) && year > 0 ? year : null;
}

function trackHasArtist(track, artistId) {
  const artist = findArtistById(artistId);

  return itemHasArtist(track, artistId, artist?.Name);
}

function albumHasArtist(album, artist) {
  return itemHasArtist(album, artist?.Id, artist?.Name);
}

function itemHasArtist(item, artistId, artistName) {
  const linkedArtists = [
    ...(item.ArtistItems || []),
    ...(item.AlbumArtists || []),
  ];

  if (artistId && linkedArtists.some((artist) => artist.Id === artistId)) {
    return true;
  }

  const targetName = normalizeSearchText(artistName);

  if (!targetName) {
    return false;
  }

  const names = [
    item.AlbumArtist,
    ...(item.Artists || []),
    ...linkedArtists.map((artist) => artist.Name),
  ];

  return names.some((name) => normalizeSearchText(name) === targetName);
}

function getLocalArtistTracks(artist) {
  return state.tracks.filter((track) => itemHasArtist(track, artist.Id, artist.Name));
}

function getLocalArtistAlbums(artist) {
  const trackAlbumIds = new Set(getLocalArtistTracks(artist).map((track) => track.AlbumId).filter(Boolean));

  return state.albums.filter((album) => albumHasArtist(album, artist) || trackAlbumIds.has(album.Id));
}

function findArtistById(artistId) {
  if (state.selectedArtist?.Id === artistId) {
    return state.selectedArtist;
  }

  return state.artists.find((artist) => artist.Id === artistId);
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function isFavorite(item) {
  return Boolean(item?.UserData?.IsFavorite);
}

function setFavoriteState(itemId, isFavoriteValue) {
  const collections = [
    state.albums,
    state.artists,
    state.playlists,
    state.tracks,
    state.favoriteTracks,
    state.recentTracks,
    state.queue,
    state.albumTracks,
    state.artistAlbums,
    state.artistTracks,
    state.playlistTracks,
  ];

  collections.forEach((collection) => {
    collection.forEach((item) => {
      if (item.Id === itemId) {
        item.UserData = { ...(item.UserData || {}), IsFavorite: isFavoriteValue };
      }
    });
  });

  [
    state.selectedAlbum,
    state.selectedArtist,
    state.selectedPlaylist,
    state.currentTrack,
  ].forEach((item) => {
    if (item?.Id === itemId) {
      item.UserData = { ...(item.UserData || {}), IsFavorite: isFavoriteValue };
    }
  });

  if (state.recentTracks.some((item) => item.Id === itemId)) {
    saveRecentTracks();
  }

  saveQueueState();
}

async function toggleFavorite(item) {
  if (!state.session || !item?.Id) {
    return;
  }

  const nextValue = !isFavorite(item);
  setFavoriteState(item.Id, nextValue);
  syncFavoriteCollections(item, nextValue);
  applyFilters();
  renderLibrary();

  try {
    await setFavoriteOnServer(item.Id, nextValue);
    setLibraryStatus(nextValue ? "已收藏。" : "已取消收藏。");
  } catch (error) {
    setFavoriteState(item.Id, !nextValue);
    syncFavoriteCollections(item, !nextValue);
    applyFilters();
    renderLibrary();
    showNotice(`收藏同步失败：${readableError(error)}`, {
      type: "error",
      actions: [
        { label: "重试", handler: () => toggleFavorite(item) },
        { label: "打开设置", handler: () => switchView("settings") },
      ],
    });
  }
}

function syncFavoriteCollections(item, shouldBeFavorite) {
  if (!isAudioItem(item)) {
    return;
  }

  const hadFavorite = state.favoriteTracks.some((track) => track.Id === item.Id);

  if (shouldBeFavorite) {
    state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, [{ ...item, UserData: { ...(item.UserData || {}), IsFavorite: true } }]);
    state.totalFavorites = hadFavorite ? state.totalFavorites : state.totalFavorites + 1;
    return;
  }

  state.favoriteTracks = state.favoriteTracks.filter((track) => track.Id !== item.Id);
  state.totalFavorites = hadFavorite ? Math.max(0, state.totalFavorites - 1) : state.totalFavorites;
}

async function setFavoriteOnServer(itemId, shouldBeFavorite) {
  const encodedUserId = encodeURIComponent(state.session.userId);
  const encodedItemId = encodeURIComponent(itemId);

  if (shouldBeFavorite) {
    await embyRequest("POST", `/Users/${encodedUserId}/FavoriteItems/${encodedItemId}`);
    return;
  }

  try {
    await embyRequest("DELETE", `/Users/${encodedUserId}/FavoriteItems/${encodedItemId}`);
  } catch (error) {
    await embyRequest("POST", `/Users/${encodedUserId}/FavoriteItems/${encodedItemId}/Delete`);
  }
}

function sortTracks(tracks) {
  const sorted = [...tracks];
  const direction = getSortDirection();

  sorted.sort((left, right) => {
    let result;

    switch (state.sortKey) {
      case "title":
        result = compareText(left.Name, right.Name);
        break;
      case "artist":
        result = compareText(getArtists(left), getArtists(right)) || compareText(left.Name, right.Name);
        break;
      case "album":
        result = compareText(left.Album, right.Album)
          || compareNumber(left.ParentIndexNumber, right.ParentIndexNumber)
          || compareNumber(left.IndexNumber, right.IndexNumber)
          || compareText(left.Name, right.Name);
        break;
      case "duration":
        result = compareNumber(left.RunTimeTicks, right.RunTimeTicks);
        break;
      case "recent":
      default:
        result = compareDate(left.DateCreated, right.DateCreated);
        break;
    }

    return (result * direction) || compareText(left.Name, right.Name);
  });

  return sorted;
}

function sortAlbumTracks(tracks) {
  return [...tracks].sort((left, right) => {
    return compareNumber(left.ParentIndexNumber, right.ParentIndexNumber)
      || compareNumber(left.IndexNumber, right.IndexNumber)
      || compareText(left.Name, right.Name);
  });
}

function sortArtistTracks(tracks) {
  return [...tracks].sort((left, right) => {
    return compareText(left.Album, right.Album)
      || compareNumber(left.ParentIndexNumber, right.ParentIndexNumber)
      || compareNumber(left.IndexNumber, right.IndexNumber)
      || compareText(left.Name, right.Name);
  });
}

function sortAlbums(albums) {
  const direction = getSortDirection();

  return [...albums].sort((left, right) => {
    let result;

    if (state.sortKey === "title") {
      result = compareText(left.Name, right.Name);
    } else if (state.sortKey === "artist") {
      result = compareText(getArtists(left), getArtists(right)) || compareText(left.Name, right.Name);
    } else {
      result = compareDate(left.DateCreated, right.DateCreated);
    }

    return (result * direction) || compareText(left.Name, right.Name);
  });
}

function sortArtists(artists) {
  const direction = getSortDirection();
  return [...artists].sort((left, right) => {
    return (compareText(left.SortName || left.Name, right.SortName || right.Name) * direction)
      || compareText(left.Name, right.Name);
  });
}

function sortPlaylists(playlists) {
  const direction = getSortDirection();
  return [...playlists].sort((left, right) => {
    return (compareText(left.SortName || left.Name, right.SortName || right.Name) * direction)
      || compareText(left.Name, right.Name);
  });
}

function getSortDirection() {
  if (state.sortOrder === "asc") {
    return 1;
  }

  if (state.sortOrder === "desc") {
    return -1;
  }

  return ["recent", "duration"].includes(state.sortKey) ? -1 : 1;
}

function getSortOrderLabel(sortOrder) {
  if (sortOrder === "asc") {
    return "升序";
  }

  if (sortOrder === "desc") {
    return "降序";
  }

  return "默认";
}

function getSortKeyLabel(sortKey) {
  const labels = {
    recent: "最近添加",
    title: "歌曲名",
    artist: "艺人",
    album: "专辑",
    duration: "时长",
  };

  return labels[sortKey] || labels.recent;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), "zh-CN", { numeric: true });
}

function compareNumber(left, right) {
  const leftNumber = Number(left || 0);
  const rightNumber = Number(right || 0);

  return leftNumber - rightNumber;
}

function compareDate(left, right) {
  return new Date(left || 0).getTime() - new Date(right || 0).getTime();
}

function getAlbumName(albumId) {
  return state.albums.find((album) => album.Id === albumId)?.Name;
}

function getArtistName(artistId) {
  return findArtistById(artistId)?.Name;
}

async function playTrack(track, queue, options = {}) {
  if (!state.session || !track?.Id) {
    return;
  }

  const requestId = ++state.playRequestId;
  const mode = resolvePlaybackMode(options.mode);
  const nextQueue = queue?.length ? [...queue] : [track];
  const previousTrack = state.currentTrack;
  const unlockPromise = ensureAudioUnlocked();

  state.isChangingTrack = true;
  setPlaybackBuffering(true);

  if (previousTrack) {
    reportPlaybackStopped(previousTrack);
  }

  activePlaybackLoadProfile = null;
  audioPlayer.pause();

  syncShufflePlaybackStateForTrackChange(previousTrack, track, nextQueue, options);
  state.queue = nextQueue;
  state.currentTrackIndex = state.queue.findIndex((item) => item.Id === track.Id);
  state.currentTrack = track;
  state.currentPlaybackMode = mode;
  state.currentMediaSourceId = getMediaSourceId(track);
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
  state.fallbackAttempted = mode !== "direct";
  state.qualityFallbackAttempted = Boolean(options.qualityFallbackAttempted);
  state.savedPlaybackPositionSeconds = 0;

  updatePlayerMeta(track);
  triggerPlayerTrackChange();
  triggerPlayerbarSweep();
  setPlayerEnabled(true);
  renderQueue();
  updateActiveRows();
  setLibraryStatus(mode === "universal"
    ? `正在加载${getTranscodeMethodLabel()}（${getAudioQualityButtonLabel()}）...`
    : "正在加载歌曲...");

  const playbackSession = takePreloadedPlaybackSession(track, mode) || await preparePlaybackSession(track, mode, requestId);

  if (requestId !== state.playRequestId || !playbackSession) {
    return;
  }

  state.currentMediaSourceId = playbackSession.mediaSourceId;
  state.currentPlaySessionId = playbackSession.playSessionId;
  const source = playbackSession.streamUrl;
  activePlaybackLoadProfile = playbackSession.loadProfile || null;

  await unlockPromise.catch(() => {});

  if (requestId !== state.playRequestId) {
    return;
  }

  loadAudioSource(source, getPlaybackLoadProfile(track, playbackSession));

  saveQueueState(options.positionSeconds);
  applyStartPosition(options.positionSeconds, requestId);

  audioPlayer.play()
    .then(() => {
      if (requestId === state.playRequestId) {
        state.isChangingTrack = false;
        setPlaybackBuffering(false);
        clearPlaybackErrorState();
        setLibraryStatus("");
        addRecentTrack(track);
        preloadNextTrack();
        reportPlaybackStarted(track);
      }
    })
    .catch((error) => {
      if (requestId === state.playRequestId) {
        state.isChangingTrack = false;
        setPlaybackBuffering(false);
      }

      handlePlayError(error, track, requestId);
    });
}

function normalizePlaybackSessionId(value) {
  return String(value || "").trim();
}

function ensurePlaybackSessionId(track, preferredId = "") {
  const candidate = normalizePlaybackSessionId(preferredId);

  if (candidate) {
    if (track?.Id && track.Id === state.currentTrack?.Id) {
      state.currentPlaySessionId = candidate;
    }

    return candidate;
  }

  const currentId = normalizePlaybackSessionId(state.currentPlaySessionId);

  if (track?.Id && track.Id === state.currentTrack?.Id && currentId) {
    return currentId;
  }

  const generatedId = createPlaybackSessionId(track);

  if (track?.Id && track.Id === state.currentTrack?.Id) {
    state.currentPlaySessionId = generatedId;
  }

  return generatedId;
}

function applyExternalMediaMetadata(track, media = {}, options = {}) {
  if (!isExternalSourceTrack(track) || !media) {
    return;
  }

  const currentSource = getPrimaryMediaSource(track);
  const currentStream = getPrimaryAudioStream(currentSource);
  const mediaKind = isVideoTrack(track)
    ? "video"
    : normalizeExternalMediaKind(media.mediaKind || track.ExternalSource?.mediaKind || currentSource.MediaKind || currentStream.Type);
  const mediaCodec = normalizeCodecLabel(media.codec);
  const mediaBitrate = Number(media.bitrate || 0);
  const mediaResolution = normalizeQualityText(media.resolution);
  const mediaSourceQuality = normalizeQualityText(media.sourceQuality);
  const mediaQualityLabel = normalizeExternalQualityLabel(media.qualityLabel, {
    mediaKind,
    resolution: mediaResolution,
    codec: mediaCodec,
    bitrate: mediaBitrate,
    sourceQuality: mediaSourceQuality,
  });
  const codec = mediaCodec || normalizeCodecLabel(currentStream.Codec || currentSource.Container || track.ExternalSource?.codec);
  const bitrate = mediaBitrate || Number(currentStream.BitRate || currentSource.BitRate || track.ExternalSource?.bitrate || 0);
  const resolution = mediaResolution || normalizeQualityText(track.ExternalSource?.resolution || currentSource.Resolution);
  const sourceQuality = mediaSourceQuality || normalizeQualityText(track.ExternalSource?.sourceQuality || currentSource.SourceQuality);
  const qualityLabel = mediaQualityLabel || normalizeExternalQualityLabel(track.ExternalSource?.qualityLabel || currentSource.QualityLabel, {
    mediaKind,
    resolution,
    codec,
    bitrate,
    sourceQuality,
  });
  const qualityVerified = Boolean(media.qualityVerified) || hasExternalResolvedQuality({
    mediaKind,
    codec: mediaCodec,
    bitrate: mediaBitrate,
    sourceQuality: mediaSourceQuality,
    qualityLabel: mediaQualityLabel,
    resolution: mediaResolution,
  });
  const qualityState = options.qualityState === "resolved" && qualityVerified
    ? "resolved"
    : (options.qualityState === "resolved" ? "unknown" : (track.ExternalSource?.qualityState || ""));
  const nextStream = {
    ...(currentStream || {}),
    Type: mediaKind === "video" ? "Video" : "Audio",
    Codec: codec,
    BitRate: bitrate,
  };

  track.ExternalSource = {
    ...(track.ExternalSource || {}),
    mediaUrl: media.streamUrl || track.ExternalSource?.mediaUrl || "",
    mediaKind,
    isVideo: mediaKind === "video",
    codec,
    bitrate,
    sourceQuality,
    qualityLabel,
    resolution,
    qualityState,
    qualityVerified,
    contentType: media.contentType || track.ExternalSource?.contentType || "",
    raw: media.raw || track.ExternalSource?.raw,
  };
  track.MediaSources = [{
    ...(currentSource || {}),
    Container: codec,
    BitRate: bitrate,
    SourceQuality: sourceQuality,
    QualityLabel: qualityLabel,
    Resolution: resolution,
    MediaKind: mediaKind,
    MediaStreams: [nextStream],
  }];
}

async function preparePlaybackSession(track, mode, requestId) {
  if (isExternalSourceTrack(track)) {
    try {
      const media = await externalSourceApi.fetchMediaSource(track.ExternalSource?.apiUrl || getSessionExternalSourceApiUrl(), track, {
        quality: getExternalPlaybackQuality(track),
        videoQuality: isVideoTrack(track) ? getExternalSourceVideoQuality() : "",
      });

      if (requestId !== state.playRequestId) {
        return null;
      }

      applyExternalMediaMetadata(track, media);
      updateMediaElementPresentation(track);
      state.lastPlaybackInfoError = "";

      return {
        mediaSourceId: media.mediaSourceId || track.Id,
        playSessionId: media.playSessionId || ensurePlaybackSessionId(track),
        streamUrl: media.streamUrl,
        loadProfile: buildExternalPlaybackLoadProfile(track, media.streamUrl, media),
      };
    } catch (error) {
      if (requestId !== state.playRequestId) {
        return null;
      }

      state.lastPlaybackInfoError = readableError(error);
      state.isChangingTrack = false;
      setPlaybackBuffering(false);
      renderPlaybackRecoveryPanel();
      return null;
    }
  }

  const fallbackMediaSourceId = getTrackDefaultMediaSourceId(track);
  const fallbackPlaySessionId = ensurePlaybackSessionId(track);
  const fallbackSession = {
    mediaSourceId: fallbackMediaSourceId,
    playSessionId: fallbackPlaySessionId,
    streamUrl: getAudioStreamUrl(track, mode, fallbackPlaySessionId, fallbackMediaSourceId),
  };

  try {
    const playbackInfo = await fetchPlaybackInfo(track, mode, fallbackMediaSourceId);

    if (requestId !== state.playRequestId) {
      return null;
    }

    const mediaSource = selectPlaybackMediaSource(playbackInfo, track, mode, fallbackMediaSourceId);
    const mediaSourceId = mediaSource?.Id || fallbackMediaSourceId;
    const playSessionId = ensurePlaybackSessionId(track, playbackInfo?.PlaySessionId || mediaSource?.PlaySessionId || fallbackPlaySessionId);

    state.lastPlaybackInfoError = "";

    return {
      mediaSourceId,
      playSessionId,
      streamUrl: getAudioStreamUrl(track, mode, playSessionId, mediaSourceId),
    };
  } catch (error) {
    if (requestId !== state.playRequestId) {
      return null;
    }

    state.lastPlaybackInfoError = readableError(error);
    console.warn("Emby PlaybackInfo failed; falling back to generated play session.", error);
    renderPlaybackRecoveryPanel();
    return fallbackSession;
  }
}

function selectPlaybackMediaSource(playbackInfo, track, mode, fallbackMediaSourceId) {
  const mediaSources = Array.isArray(playbackInfo?.MediaSources)
    ? playbackInfo.MediaSources.filter((source) => source?.Id)
    : [];

  return mediaSources.find((source) => source.Id === fallbackMediaSourceId)
    || mediaSources.find((source) => mode === "universal"
      ? source.SupportsTranscoding || source.TranscodingUrl
      : source.SupportsDirectStream || source.SupportsDirectPlay || source.DirectStreamUrl)
    || mediaSources[0]
    || null;
}

function applyStartPosition(positionSeconds, requestId) {
  const position = Number(positionSeconds) || 0;

  if (position <= 0) {
    return;
  }

  const seek = () => {
    if (requestId !== state.playRequestId || !Number.isFinite(audioPlayer.duration)) {
      return;
    }

    audioPlayer.currentTime = clamp(position, 0, Math.max(0, audioPlayer.duration - 1));
    updateProgress();
  };

  if (Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
    seek();
    return;
  }

  audioPlayer.addEventListener("loadedmetadata", seek, { once: true });
}

function loadAudioSource(source, profile = getAudioQualityProfile()) {
  const useHlsJs = shouldUseHlsJs(profile);

  if (!source) {
    unloadAudioSource();
    return;
  }

  if (useHlsJs) {
    if (!hlsPlayer) {
      hlsPlayer = new window.Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });
      hlsPlayer.attachMedia(audioPlayer);
      hlsPlayer.on(window.Hls.Events.ERROR, handleHlsPlayerError);
    }

    if (hlsPlayer.url !== source) {
      hlsPlayer.loadSource(source);
    }

    state.isHlsJsActive = true;
    renderSettings();
    return;
  }

  destroyHlsPlayer();

  if (audioPlayer.src !== source) {
    audioPlayer.src = source;
    audioPlayer.load();
  }
}

function getPlaybackLoadProfile(track, playbackSession = null) {
  if (playbackSession?.loadProfile) {
    return playbackSession.loadProfile;
  }

  if (activePlaybackLoadProfile && track?.Id === state.currentTrack?.Id) {
    return activePlaybackLoadProfile;
  }

  if (isExternalSourceTrack(track)) {
    return buildExternalPlaybackLoadProfile(track, track?.ExternalSource?.mediaUrl || "", track?.ExternalSource || {});
  }

  return getAudioQualityProfile();
}

function buildExternalPlaybackLoadProfile(track, source = "", media = {}) {
  const contentType = media?.contentType || track?.ExternalSource?.contentType || "";
  const isHls = /\.m3u8(?:[?#].*)?$/i.test(source) || /application\/(?:vnd\.apple\.mpegurl|x-mpegurl)/i.test(contentType);

  return {
    protocol: isHls ? "hls" : "http",
    label: isVideoTrack(track) ? "音乐桥视频" : "音乐桥直链",
    codec: isVideoTrack(track) ? (media?.codec || "Video") : (media?.codec || "External"),
  };
}

function handleHlsReady() {
  renderAudioQualityButton();
  renderSettings();

  if (state.currentTrack && audioPlayer.src) {
    const profile = getPlaybackLoadProfile(state.currentTrack);
    if (shouldUseHlsJs(profile) && !state.isHlsJsActive) {
      loadAudioSource(audioPlayer.src, profile);
    }
  }
}

function shouldUseHlsJs(profile = getAudioQualityProfile()) {
  return profile?.protocol === "hls"
    && !supportsNativeHls(audioPlayer)
    && Boolean(window.Hls?.isSupported?.());
}

function destroyHlsPlayer() {
  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }

  state.isHlsJsActive = false;
}

function handleHlsPlayerError(event, data = {}) {
  if (!data?.fatal) {
    return;
  }

  state.lastPlaybackError = data.details || data.type || "HLS 播放失败";
  renderPlaybackRecoveryPanel();

  if (data.type === window.Hls?.ErrorTypes?.NETWORK_ERROR) {
    hlsPlayer?.startLoad();
    renderSettings();
    return;
  }

  if (data.type === window.Hls?.ErrorTypes?.MEDIA_ERROR) {
    hlsPlayer?.recoverMediaError();
    renderSettings();
    return;
  }

  if (shouldFallbackToCompatibleQuality() && state.currentTrack) {
    fallbackToCompatibleQuality(state.currentTrack);
    return;
  }

  showNotice(`HLS 播放失败：${state.lastPlaybackError}`, {
    type: "error",
    actions: [
      state.currentTrack ? { label: "兼容兜底", handler: () => fallbackToCompatibleQuality(state.currentTrack) } : null,
      state.currentTrack ? { label: "测试链路", handler: () => testCurrentPlaybackChain(state.currentTrack), dismiss: false } : null,
      { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
    ].filter(Boolean),
  });
  renderSettings();
}

function ensureAudioUnlocked() {
  if (state.audioUnlocked || audioPlayer.src || audioPlayer.readyState > 0) {
    state.audioUnlocked = true;
    return Promise.resolve();
  }

  const previousVolume = unlockAudioPlayer.volume;
  const previousMuted = unlockAudioPlayer.muted;
  const unlockSource = getSilentAudioDataUrl();

  unlockAudioPlayer.muted = true;
  unlockAudioPlayer.volume = 0;
  unlockAudioPlayer.src = unlockSource;

  const unlockPromise = unlockAudioPlayer.play()
    .then(() => {
      state.audioUnlocked = true;
      if (unlockAudioPlayer.src === unlockSource) {
        unlockAudioPlayer.pause();
        unlockAudioPlayer.currentTime = 0;
      }
    })
    .catch((error) => {
      if (isAutoplayBlockedError(error)) {
        state.pendingAutoplayResume = true;
      }
    })
    .finally(() => {
      if (unlockAudioPlayer.src === unlockSource) {
        unlockAudioPlayer.removeAttribute("src");
        unlockAudioPlayer.load();
      }
      unlockAudioPlayer.volume = previousVolume;
      unlockAudioPlayer.muted = previousMuted;
    });

  return unlockPromise;
}

function getSilentAudioDataUrl() {
  return "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
}

function togglePlayback() {
  if (!audioPlayer.src) {
    if (state.currentTrack && state.queue.length) {
      playTrack(state.currentTrack, state.queue, {
        positionSeconds: state.savedPlaybackPositionSeconds,
      });
      return;
    }

    const firstTrack = state.filteredTracks[0] || state.tracks[0];

    if (firstTrack) {
      playTrack(firstTrack, state.filteredTracks.length ? state.filteredTracks : state.tracks);
    }

    return;
  }

  if (audioPlayer.paused) {
    audioPlayer.play()
      .then(() => {
        triggerPlayerbarSweep();
      })
      .catch((error) => {
        handleResumePlayError(error);
      });
  } else {
    audioPlayer.pause();
  }
}

function handleResumePlayError(error) {
  const track = state.currentTrack;

  if (isBenignPlaybackInterruption(error)) {
    handleBenignPlayInterruption();
    return;
  }

  state.lastPlaybackError = readableError(error);
  renderPlaybackRecoveryPanel();

  if (isAutoplayBlockedError(error)) {
    state.pendingAutoplayResume = true;
    showNotice("浏览器阻止了恢复播放，请再点一次播放。", {
      type: "warning",
      actions: [
        { label: "继续播放", handler: () => resumeBlockedPlayback(track) },
        { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      ],
    });
    renderSettings();
    return;
  }

  if (track && shouldFallbackToTranscode()) {
    setLibraryStatus(`恢复播放失败，正在尝试转码播放（${getTranscodeBitrateLabel()}）...`);
    playTrack(track, getPlaybackRetryQueue(track), {
      mode: "universal",
      positionSeconds: getRetryPositionSeconds(),
    });
    return;
  }

  showNotice(`播放失败：${readableError(error)}`, {
    type: "error",
    actions: [
      { label: "继续播放", handler: togglePlayback },
      track ? { label: "重载歌曲", handler: () => playTrack(track, getPlaybackRetryQueue(track), { positionSeconds: getRetryPositionSeconds() }) } : null,
      track ? { label: getOppositePlaybackActionLabel(), handler: () => retryWithOppositePlaybackMode(track) } : null,
      track ? { label: "测试链路", handler: () => testCurrentPlaybackChain(track), dismiss: false } : null,
      { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
    ].filter(Boolean),
  });
  renderSettings();
}

function handleKeyboardShortcut(event) {
  if (event.key === "Tab" && trackActionSheet && !trackActionSheet.hidden) {
    trapTrackActionSheetFocus(event);
    return;
  }

  if (event.key === "Escape") {
    if (searchSuggestPopover && !searchSuggestPopover.hidden) {
      closeSearchSuggestions();
      return;
    }

    if (state.isQuickQueueOpen) {
      closeQuickQueue();
      return;
    }

    if (state.isImmersiveQueueOpen) {
      closeImmersiveQueue();
      return;
    }

    if (!trackActionSheet.hidden) {
      closeTrackActionSheet();
      return;
    }

    if (!accountMenu.hidden) {
      closeAccountMenu();
      return;
    }

    if (!playlistPicker.hidden) {
      closePlaylistPicker();
      return;
    }

    if (!createPlaylistModal.hidden) {
      closeCreatePlaylistModal();
      return;
    }

    if (!audioQualityModal.hidden) {
      closeAudioQualityModal();
      return;
    }

    if (sourceBridgeModal && !sourceBridgeModal.hidden) {
      closeSourceBridgeModal();
      return;
    }

    if (getActiveView() === "immersivePlayer") {
      closeImmersivePlayer();
      return;
    }

    if (hasActiveTrackFilter()) {
      clearSearchAndFilters();
      setLibraryStatus("已清除搜索和筛选。");
      return;
    }
  }

  if (event.defaultPrevented || isTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  switch (event.key) {
    case " ":
      event.preventDefault();
      togglePlayback();
      break;
    case "ArrowLeft":
      event.preventDefault();
      seekRelative(-10);
      break;
    case "ArrowRight":
      event.preventDefault();
      seekRelative(10);
      break;
    case "ArrowUp":
      event.preventDefault();
      adjustVolume(0.05);
      break;
    case "ArrowDown":
      event.preventDefault();
      adjustVolume(-0.05);
      break;
    case "m":
    case "M":
      event.preventDefault();
      toggleMute();
      break;
    case "n":
    case "N":
      event.preventDefault();
      playNext();
      break;
    case "p":
    case "P":
      event.preventDefault();
      playPrevious();
      break;
    case "q":
    case "Q":
      event.preventDefault();
      toggleActiveQueueView();
      break;
    case "f":
    case "F":
      if (state.currentTrack) {
        event.preventDefault();
        toggleFavorite(state.currentTrack);
      }
      break;
    case "l":
    case "L":
      event.preventDefault();
      locateCurrentTrack();
      break;
    case "/":
      event.preventDefault();
      focusSearch();
      break;
    default:
      break;
  }
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function focusSearch() {
  if (searchInput.disabled) {
    return;
  }

  searchInput.focus();
  searchInput.select();
}

function seekRelative(deltaSeconds) {
  const duration = getAudioDurationSeconds();

  if (!audioPlayer.src || !duration) {
    return;
  }

  seekToPosition(getAudioCurrentTimeSeconds() + deltaSeconds, { eventName: "Seek" });
}

function seekToPosition(positionSeconds, options = {}) {
  const duration = getAudioDurationSeconds();
  const nextPosition = Number(positionSeconds);

  if (!audioPlayer.src || !duration || !Number.isFinite(nextPosition)) {
    return false;
  }

  const position = clamp(nextPosition, 0, duration);

  try {
    if (options.fastSeek && typeof audioPlayer.fastSeek === "function") {
      audioPlayer.fastSeek(position);
    } else {
      audioPlayer.currentTime = position;
    }
  } catch {
    audioPlayer.currentTime = position;
  }

  pauseLyricPlaybackClock();
  updateProgress();

  if (options.report !== false) {
    reportPlaybackProgress(true, options.eventName || "Seek");
  }

  return true;
}

function getAudioDurationSeconds() {
  const duration = Number(audioPlayer.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getAudioCurrentTimeSeconds() {
  const currentTime = Number(audioPlayer.currentTime);
  return Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
}

function getMonotonicNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function syncLyricPlaybackClock(options = {}) {
  const nowMs = getMonotonicNowMs();
  lyricClockAudioSeconds = getAudioCurrentTimeSeconds();
  lyricClockStartedAtMs = nowMs;
  lyricClockPlaybackRate = Number(audioPlayer.playbackRate) || 1;
  lyricClockIsRunning = options.running ?? shouldEstimateLyricPlaybackClock();
}

function shouldEstimateLyricPlaybackClock() {
  return Boolean(
    state.currentTrack
    && audioPlayer.src
    && !audioPlayer.paused
    && !audioPlayer.ended
    && !audioPlayer.seeking
    && !state.isPlaybackBuffering
  );
}

function getLyricPlaybackTimeSeconds() {
  if (!lyricClockIsRunning) {
    return getAudioCurrentTimeSeconds();
  }

  const elapsedSeconds = Math.max(0, (getMonotonicNowMs() - lyricClockStartedAtMs) / 1000);
  const estimatedSeconds = lyricClockAudioSeconds + (elapsedSeconds * lyricClockPlaybackRate);
  const durationSeconds = getAudioDurationSeconds();
  return durationSeconds ? clamp(estimatedSeconds, 0, durationSeconds) : Math.max(0, estimatedSeconds);
}

function getVisibleLyricSyncTimeSeconds(fallbackSeconds = getAudioCurrentTimeSeconds()) {
  return isImmersiveLyricsVisible() && shouldEstimateLyricPlaybackClock()
    ? getLyricPlaybackTimeSeconds()
    : fallbackSeconds;
}

function pauseLyricPlaybackClock() {
  lyricClockAudioSeconds = getAudioCurrentTimeSeconds();
  lyricClockStartedAtMs = getMonotonicNowMs();
  lyricClockPlaybackRate = Number(audioPlayer.playbackRate) || 1;
  lyricClockIsRunning = false;
}

function stopPlaybackFromMediaSession() {
  if (!state.currentTrack && !audioPlayer.src) {
    clearMediaSession();
    return;
  }

  state.savedPlaybackPositionSeconds = getAudioCurrentTimeSeconds();
  reportPlaybackStopped();
  audioPlayer.pause();
  pauseLyricPlaybackClock();
  unloadAudioSource();
  stopLyricProgressLoop();
  clearPreload();
  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
  state.pendingAutoplayResume = false;
  state.isChangingTrack = false;
  saveQueueState(state.savedPlaybackPositionSeconds);
  setProgressDisplay(state.savedPlaybackPositionSeconds, getTrackDurationSeconds(state.currentTrack));
  updatePlaybackState();
  renderRestoredPlaybackProgress(state.currentTrack);
  renderHomeStartPanel();
  renderSettings();
  setLibraryStatus("已停止播放。");
}

function adjustVolume(delta) {
  const nextVolume = clamp(audioPlayer.volume + delta, 0, 1);
  state.volume = nextVolume;
  audioPlayer.volume = nextVolume;
  audioPlayer.muted = false;

  if (nextVolume > 0) {
    state.lastVolume = nextVolume;
  }

  storage.saveVolume(nextVolume);
  updateVolumeButton();
}

function playPrevious() {
  if (!state.queue.length) {
    return;
  }

  if (state.playMode === "shuffle") {
    const previousTrack = takeShuffleHistoryTrack();

    if (previousTrack) {
      const currentTrack = state.currentTrack;

      if (currentTrack?.Id && currentTrack.Id !== previousTrack.Id) {
        prioritizeShuffleUpcomingTracks([currentTrack.Id]);
      }

      playTrack(previousTrack, state.queue, { fromShuffleHistory: true });
      return;
    }
  }

  const index = getNextQueueIndex(-1, false);

  if (index >= 0) {
    playTrack(state.queue[index], state.queue);
  }
}

function playNext(options = {}) {
  if (!state.queue.length) {
    updatePlaybackState();
    return;
  }

  const index = getNextQueueIndex(1, Boolean(options.fromEnded));

  if (index === -1) {
    finishQueue();
    return;
  }

  playTrack(state.queue[index], state.queue);
}

function handleTrackEnded() {
  stopLyricProgressLoop();
  pauseLyricPlaybackClock();

  if (state.playMode === "repeat-one" && state.currentTrack) {
    playTrack(state.currentTrack, state.queue);
    return;
  }

  playNext({ fromEnded: true });
}

function getNextQueueIndex(direction, fromEnded) {
  if (!state.queue.length) {
    return -1;
  }

  if (state.playMode === "shuffle" && state.queue.length > 1 && direction > 0) {
    const nextTrackId = getNextShuffleTrackId();
    const nextIndex = nextTrackId
      ? state.queue.findIndex((track) => track.Id === nextTrackId)
      : -1;

    return nextIndex >= 0 ? nextIndex : 0;
  }

  const lastIndex = state.queue.length - 1;
  const currentIndex = state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0;

  if (direction < 0) {
    return currentIndex <= 0 ? lastIndex : currentIndex - 1;
  }

  if (currentIndex < lastIndex) {
    return currentIndex + 1;
  }

  if (!fromEnded || state.playMode === "repeat-all" || state.playMode === "shuffle") {
    return 0;
  }

  return -1;
}

function finishQueue() {
  reportPlaybackStopped();
  updatePlaybackState();
  updateActiveRows();
  setLibraryStatus("队列播放完成。");
}

function cyclePlayMode() {
  const currentIndex = PLAY_MODES.indexOf(state.playMode);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PLAY_MODES.length : 0;
  state.playMode = PLAY_MODES[nextIndex];
  storage.savePlayMode(state.playMode);
  updatePlayModeButton();
  setLibraryStatus(`播放模式：${PLAY_MODE_LABELS[state.playMode]}`);
}

function updatePlayModeButton() {
  const modeLabel = PLAY_MODE_LABELS[state.playMode] || PLAY_MODE_LABELS.order;
  playModeButton.dataset.mode = state.playMode;
  playModeButton.title = `播放模式：${modeLabel}`;
  playModeButton.setAttribute("aria-label", `播放模式：${modeLabel}`);
  if (playerModeProxyButton) {
    playerModeProxyButton.dataset.mode = state.playMode;
    playerModeProxyButton.title = `播放模式：${modeLabel}`;
    playerModeProxyButton.setAttribute("aria-label", `播放模式：${modeLabel}`);
  }
  updateModeChip(nowModeButton, modeLabel);
  nowModeButton.dataset.mode = state.playMode;
  nowModeButton.title = playModeButton.title;
  updateModeChip(immersiveModeButton, modeLabel);
  immersiveModeButton.dataset.mode = state.playMode;
  immersiveModeButton.title = playModeButton.title;
  renderPlayerNextPreview();
  renderUpNext();
  renderSettings();
}

function updateModeChip(button, modeLabel) {
  if (!button) {
    return;
  }

  const label = button.querySelector("span");
  if (label) {
    label.textContent = modeLabel;
    return;
  }

  button.textContent = modeLabel;
}

function cycleSleepTimer() {
  const currentIndex = SLEEP_TIMER_OPTIONS.indexOf(state.sleepTimerPresetMinutes);
  const nextIndex = state.sleepTimerEndAt && currentIndex >= 0
    ? (currentIndex + 1) % SLEEP_TIMER_OPTIONS.length
    : 1;

  setSleepTimer(SLEEP_TIMER_OPTIONS[nextIndex]);
}

function handleSleepTimerSelectChange() {
  const minutes = Number(sleepTimerSelect.value);
  setSleepTimer(SLEEP_TIMER_OPTIONS.includes(minutes) ? minutes : 0);
}

function setSleepTimer(minutes, options = {}) {
  clearSleepTimer({ announce: false, render: false });

  const normalizedMinutes = SLEEP_TIMER_OPTIONS.includes(Number(minutes)) ? Number(minutes) : 0;

  if (!normalizedMinutes) {
    updateSleepTimerControls();
    if (options.announce !== false) {
      setLibraryStatus("睡眠定时已关闭。");
    }
    return;
  }

  state.sleepTimerPresetMinutes = normalizedMinutes;
  state.sleepTimerEndAt = Date.now() + normalizedMinutes * 60 * 1000;
  state.sleepTimerTimeoutId = window.setTimeout(handleSleepTimerExpired, normalizedMinutes * 60 * 1000);
  state.sleepTimerIntervalId = window.setInterval(updateSleepTimerControls, 1000);
  updateSleepTimerControls();

  if (options.announce !== false) {
    setLibraryStatus(`睡眠定时：${normalizedMinutes} 分钟后停止播放。`);
  }
}

function clearSleepTimer(options = {}) {
  if (state.sleepTimerTimeoutId) {
    window.clearTimeout(state.sleepTimerTimeoutId);
  }

  if (state.sleepTimerIntervalId) {
    window.clearInterval(state.sleepTimerIntervalId);
  }

  state.sleepTimerEndAt = 0;
  state.sleepTimerPresetMinutes = 0;
  state.sleepTimerTimeoutId = null;
  state.sleepTimerIntervalId = null;

  if (options.render !== false) {
    updateSleepTimerControls();
  }

  if (options.announce) {
    setLibraryStatus("睡眠定时已关闭。");
  }
}

function handleSleepTimerExpired() {
  clearSleepTimer({ announce: false });

  if (!audioPlayer.paused) {
    audioPlayer.pause();
  }

  reportPlaybackStopped();
  updatePlaybackState();
  saveQueueState();
  setLibraryStatus("睡眠定时已到，已暂停播放。");
  showNotice("睡眠定时已到，已暂停播放。", {
    type: "success",
    actions: state.currentTrack ? [{ label: "继续播放", handler: togglePlayback }] : [],
  });
}

function updateSleepTimerControls() {
  const remainingSeconds = getSleepTimerRemainingSeconds();
  const isActive = remainingSeconds > 0;
  const compactLabel = isActive ? `睡眠 ${formatSleepTimerCompact(remainingSeconds)}` : "睡眠";
  const detailLabel = isActive ? `${formatSleepTimerDetail(remainingSeconds)}后停止` : "关闭";

  sleepTimerButton.dataset.mode = isActive ? "sleep" : "";
  sleepTimerButton.title = isActive ? `睡眠定时：${detailLabel}` : "睡眠定时";
  sleepTimerButton.setAttribute("aria-label", sleepTimerButton.title);
  const nowSleepTimerLabel = nowSleepTimerButton.querySelector(".sr-only");
  if (nowSleepTimerLabel) {
    nowSleepTimerLabel.textContent = compactLabel;
  } else {
    nowSleepTimerButton.textContent = compactLabel;
  }
  nowSleepTimerButton.dataset.mode = sleepTimerButton.dataset.mode;
  nowSleepTimerButton.title = sleepTimerButton.title;
  sleepTimerSelect.value = isActive ? String(state.sleepTimerPresetMinutes) : "0";
  settingsSleepTimer.textContent = detailLabel;

  if (state.sleepTimerEndAt && !isActive) {
    handleSleepTimerExpired();
  }
}

function getSleepTimerRemainingSeconds() {
  if (!state.sleepTimerEndAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((state.sleepTimerEndAt - Date.now()) / 1000));
}

function formatSleepTimerCompact(seconds) {
  if (seconds < 60) {
    return `${seconds}秒`;
  }

  return `${Math.ceil(seconds / 60)}分`;
}

function formatSleepTimerDetail(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (!minutes) {
    return `${remainingSeconds} 秒`;
  }

  if (!remainingSeconds) {
    return `${minutes} 分钟`;
  }

  return `${minutes} 分 ${remainingSeconds} 秒`;
}

function setupMediaSession() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  setMediaSessionAction("play", () => {
    if (audioPlayer.paused) {
      togglePlayback();
    }
  });
  setMediaSessionAction("pause", () => {
    if (!audioPlayer.paused) {
      audioPlayer.pause();
    }
  });
  setMediaSessionAction("previoustrack", playPrevious);
  setMediaSessionAction("nexttrack", playNext);
  setMediaSessionAction("stop", stopPlaybackFromMediaSession);
  setMediaSessionAction("seekbackward", (details) => {
    const offset = Number(details?.seekOffset);
    seekRelative(-(Number.isFinite(offset) && offset > 0 ? offset : 10));
  });
  setMediaSessionAction("seekforward", (details) => {
    const offset = Number(details?.seekOffset);
    seekRelative(Number.isFinite(offset) && offset > 0 ? offset : 10);
  });
  setMediaSessionAction("seekto", (details) => {
    seekToPosition(details?.seekTime, {
      fastSeek: Boolean(details?.fastSeek),
      eventName: "Seek",
    });
  });
}

function setMediaSessionAction(action, handler) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Some browsers expose Media Session but do not support every action.
  }
}

function updateMediaSessionMetadata(track) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window) || !track) {
    return;
  }

  const artwork = [96, 128, 192, 256, 384, 512]
    .map((size) => {
      const src = getTrackImageUrl(track, size);
      return src ? { src, sizes: `${size}x${size}`, type: "image/jpeg" } : null;
    })
    .filter(Boolean);

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.Name || "未命名歌曲",
      artist: getArtists(track) || "未知艺人",
      album: track.Album || "Emby Music",
      artwork,
    });
  } catch {
    // Metadata should never block playback if a browser rejects artwork.
  }
}

function updateMediaSessionPlaybackState() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.playbackState = state.currentTrack
      ? (audioPlayer.paused ? "paused" : "playing")
      : "none";
  } catch {
    // Ignore partial Media Session implementations.
  }

  updateMediaSessionPosition();
}

function updateMediaSessionPosition() {
  if (!("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") {
    return;
  }

  const duration = getAudioDurationSeconds() || getTrackDurationSeconds(state.currentTrack);

  if (!duration) {
    return;
  }

  const playbackRate = Number(audioPlayer.playbackRate) || 1;
  const position = clamp(audioPlayer.src ? getAudioCurrentTimeSeconds() : state.savedPlaybackPositionSeconds, 0, duration);

  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate,
      position,
    });
  } catch {
    // Position state is advisory; playback UI should keep working without it.
  }
}

function clearMediaSession() {
  if (!("mediaSession" in navigator)) {
    return;
  }

  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch {
    // Ignore partial Media Session implementations.
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) {
    return;
  }

  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    handleServiceWorkerControllerChange(hadControllerAtStartup);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(APP_VERSION)}`).then((registration) => {
      watchServiceWorkerUpdate(registration);
      if (registration.waiting && navigator.serviceWorker.controller) {
        showAppUpdateNotice(registration);
      }
      if (registration.update) {
        registration.update().catch(() => {});
      }
    }).catch(() => {
      showNotice("PWA 缓存启用失败，网页仍可正常使用。", {
        type: "warning",
        actions: [{ label: "查看设置", handler: () => switchView("settings") }],
      });
    });
  });
}

function watchServiceWorkerUpdate(registration) {
  registration.addEventListener("updatefound", () => {
    const nextWorker = registration.installing;

    if (!nextWorker) {
      return;
    }

    nextWorker.addEventListener("statechange", () => {
      if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
        showAppUpdateNotice(registration);
      }
    });
  });
}

function showAppUpdateNotice(registration) {
  state.pendingServiceWorkerUpdate = true;
  renderSettings();
  showNotice("检测到新版本，更新后会重新载入应用。", {
    type: "success",
    actions: [
      { label: "立即更新", handler: () => applyServiceWorkerUpdate(registration), dismiss: false },
      { label: "稍后", handler: renderSettings },
    ],
  });
}

function applyServiceWorkerUpdate(registration) {
  state.isApplyingServiceWorkerUpdate = true;
  setLibraryStatus("正在切换到新版本...");

  if (registration?.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    window.setTimeout(reloadForAppUpdate, 1200);
    return;
  }

  reloadForAppUpdate();
}

function handleServiceWorkerControllerChange(hadControllerAtStartup) {
  if (!hadControllerAtStartup && !state.pendingServiceWorkerUpdate && !state.isApplyingServiceWorkerUpdate) {
    return;
  }

  state.pendingServiceWorkerUpdate = true;
  renderSettings();

  if (state.isApplyingServiceWorkerUpdate) {
    reloadForAppUpdate();
    return;
  }

  showNotice("应用缓存已更新，重新载入后使用新版本。", {
    type: "success",
    actions: [{ label: "重新载入", handler: reloadForAppUpdate, dismiss: false }],
  });
}

function reloadForAppUpdate() {
  reloadApplication();
}

function refreshApplication() {
  closeAccountMenu();
  setLibraryStatus("正在刷新应用...");
  reloadApplication();
}

function reloadApplication() {
  if (state.isApplyingServiceWorkerUpdate === "reloading") {
    return;
  }

  state.isApplyingServiceWorkerUpdate = "reloading";
  const url = new URL(location.href);
  url.searchParams.set("v", APP_VERSION);
  url.searchParams.set("reload", String(Date.now()));
  location.replace(url.toString());
}

function resetPlayerPreferences() {
  state.playMode = "order";
  state.sortKey = "recent";
  state.sortOrder = "default";
  state.audioQualityProfileId = DEFAULT_AUDIO_QUALITY_PROFILE.id;
  state.playbackStreamPolicy = DEFAULT_AUDIO_QUALITY_PROFILE.mode === "direct" ? "direct" : "transcode";
  state.transcodeBitrate = DEFAULT_AUDIO_QUALITY_PROFILE.bitrate || normalizeTranscodeBitrate(TRANSCODE_BITRATES[0]?.value);
  state.playbackPreloadEnabled = true;
  state.playbackLosslessPrecacheEnabled = false;
  state.trackDensity = "comfortable";
  state.playerMetaTarget = "immersive";
  state.volume = 1;
  state.lastVolume = 1;
  audioPlayer.volume = 1;
  audioPlayer.muted = false;
  storage.clearPlayMode();
  storage.clearSortKey();
  storage.clearSortOrder();
  storage.clearPlaybackStreamPolicy();
  storage.clearAudioQualityProfile();
  storage.clearPlaybackPreloadEnabled?.();
  storage.clearPlaybackLosslessPrecacheEnabled?.();
  storage.clearTrackDensity();
  storage.clearPlayerMetaTarget();
  storage.clearTranscodeBitrate();
  storage.clearVolume();
  clearPreload();
  clearSleepTimer({ announce: false });
  updatePlayModeButton();
  renderAudioQualityButton();
  applyTrackDensityPreference();
  updateVolumeButton();
  applyFilters();
  renderLibrary();
  renderSettings();
  setLibraryStatus("播放器偏好已重置。");
}

async function clearAppCache() {
  if (!("caches" in window)) {
    setLibraryStatus("当前浏览器不支持清除应用缓存。");
    return;
  }

  const keys = await caches.keys();
  const appKeys = keys.filter((key) => key.startsWith("emby-music-web-"));

  await Promise.all(appKeys.map((key) => caches.delete(key)));
  state.pendingServiceWorkerUpdate = false;
  setLibraryStatus(appKeys.length ? "应用缓存已清除，刷新后会重新缓存。" : "没有可清除的应用缓存。");
  renderSettings();
}

async function clearPlaybackCache() {
  clearPreload();

  if (!("caches" in window)) {
    setLibraryStatus("当前浏览器不支持清除歌曲缓存。");
    return;
  }

  const deleted = await caches.delete(PLAYBACK_PRELOAD_CACHE_NAME);
  setLibraryStatus(deleted ? "歌曲预缓存已清除。" : "没有可清除的歌曲预缓存。");
  renderSettings();
}

async function copyDiagnostics() {
  const text = buildDiagnostics();

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("Clipboard unavailable");
    }

    setLibraryStatus("诊断信息已复制。");
  } catch {
    setLibraryStatus("无法自动复制，可手动选中诊断信息。");
  }
}

function buildDiagnostics() {
  const guidance = getDiagnosticsGuidance();

  return [
    `${APP_NAME} ${APP_VERSION}`,
    `URL: ${location.href}`,
    `Recommended action: ${guidance}`,
    `Configured server URL: ${getConfiguredServerUrl() || "-"}`,
    `Server URL locked: ${isServerUrlLocked() ? "yes" : "no"}`,
    `Source mode: ${getSessionSourceMode(state.session)}`,
    `External source API: ${state.session?.externalSourceApiUrl || state.externalSourceApiUrl || "-"}`,
    `Display mode: ${window.matchMedia?.("(display-mode: standalone)")?.matches ? "standalone" : "browser"}`,
    `Window title: ${document.title || "-"}`,
    `Current accent: ${getCurrentAccentLabel()}`,
    `Service Worker: ${"serviceWorker" in navigator ? (navigator.serviceWorker.controller ? "controlled" : "supported") : "unsupported"}`,
    `PWA update pending: ${state.pendingServiceWorkerUpdate ? "yes" : "no"}`,
    `Media Session: ${"mediaSession" in navigator ? "supported" : "unsupported"}`,
    `Browser network: ${state.isBrowserOnline ? "online" : "offline"}`,
    `Server: ${state.session?.serverName || "-"}`,
    `Server URL: ${state.session?.serverUrl || "-"}`,
    `Server version: ${state.session?.version || "-"}`,
    `User: ${state.session?.userName || "-"}`,
    `Saved accounts: ${storage.loadAccountProfiles().length}`,
    `Library loaded: ${state.isLibraryLoaded ? "yes" : "no"}`,
    `Library view: ${getLibraryViewLabel()} (${state.libraryViewId || "-"})`,
    `Saved filters: ${getSavedFilterLabel()}`,
    `Tracks: ${state.tracks.length}/${state.totalTracks || state.tracks.length}`,
    `Albums: ${state.albums.length}/${state.totalAlbums || state.albums.length}`,
    `Artists: ${state.artists.length}/${state.totalArtists || state.artists.length}`,
    `Playlists: ${state.playlists.length}/${state.totalPlaylists || state.playlists.length}`,
    `Favorites: ${state.favoriteTracks.length}/${state.totalFavorites || state.favoriteTracks.length}`,
    `Last server search: ${state.lastServerSearchQuery || "-"}`,
    `Queue: ${state.queue.length}`,
    `Quick queue open: ${state.isQuickQueueOpen ? "yes" : "no"}`,
    `Queue restored: ${state.currentTrack ? "yes" : "no"}`,
    `Saved position: ${formatSeconds(getQueuePositionSeconds())}`,
    `Recent local: ${state.recentTracks.length}`,
    `Play mode: ${state.playMode}`,
    `Sort key: ${state.sortKey}`,
    `Sort order: ${state.sortOrder}`,
    `Playback stream policy: ${state.playbackStreamPolicy}`,
    `Audio quality profile: ${state.audioQualityProfileId}`,
    `External source quality: ${isExternalSourceSession() ? `${state.externalSourceQualityId} / ${getExternalSourceQuality()}` : "-"}`,
    `External video quality: ${isExternalSourceSession() ? `${state.externalSourceVideoQualityId} / ${getExternalSourceVideoQuality()}` : "-"}`,
    `Audio quality method: ${isExternalSourceSession() ? getSettingsEffectiveProtocolLabel() : `${getEffectiveTranscodeMethodLabel()} / ${getAudioQualityProfile().transferFormat || "-"} / ${getAudioQualityProfile().codec} / ${getAudioQualityProfile().bitrateLabel || "-"}`}`,
    `Playback preload: ${state.playbackPreloadEnabled ? "enabled" : "disabled"} / lossless ${state.playbackLosslessPrecacheEnabled ? "enabled" : "disabled"} / ${state.preloadTrackId || "-"} / ${state.preloadCacheStatus || "-"}`,
    `Quality fallback attempted: ${state.qualityFallbackAttempted ? "yes" : "no"}`,
    `Native HLS: ${supportsNativeHls() ? "yes" : "no"}`,
    `hls.js: ${window.Hls?.isSupported?.() ? (state.isHlsJsActive ? "active" : "supported") : "unavailable"}`,
    `Player meta target: ${state.playerMetaTarget}`,
    `Current playback source: ${state.currentPlaybackMode}`,
    `Current playback label: ${getCurrentPlaybackSourceLabel()}`,
    `Audio unlocked: ${state.audioUnlocked ? "yes" : "no"}`,
    `Pending autoplay resume: ${state.pendingAutoplayResume ? "yes" : "no"}`,
    `Testing playback chain: ${state.isTestingPlayback ? "yes" : "no"}`,
    `Audio readyState: ${audioPlayer.readyState}`,
    `Audio networkState: ${audioPlayer.networkState}`,
    `Audio currentSrc: ${audioPlayer.currentSrc ? "set" : "-"}`,
    `Current MediaSourceId: ${state.currentMediaSourceId || "-"}`,
    `Current PlaySessionId: ${state.currentPlaySessionId || "-"}`,
    `Last playback probe: ${state.lastPlaybackProbe || "-"}`,
    `Playback recovery visible: ${playbackRecoveryPanel && !playbackRecoveryPanel.hidden ? "yes" : "no"}`,
    `Transcode bitrate: ${state.transcodeBitrate}`,
    `Track density: ${state.trackDensity}`,
    `Volume: ${Math.round((audioPlayer.muted ? 0 : audioPlayer.volume) * 100)}%`,
    `Current track: ${state.currentTrack?.Name || "-"}`,
    `Last PlaybackInfo error: ${state.lastPlaybackInfoError || "-"}`,
    `Last playback error: ${state.lastPlaybackError || "-"}`,
    `Lyrics: ${state.lyricLines.length}${state.isLyricSynced ? " synced" : ""}`,
    `Lyrics status: ${state.lyricsStatus || "-"}`,
    `Lyrics track id: ${state.lyricsTrackId || "-"}`,
  ].join("\n");
}

function getDiagnosticsGuidance() {
  if (!state.session) {
    return "login required; test server first, then clear cache if the main app does not load";
  }

  if (!state.isLibraryLoaded) {
    return "reload library; verify the selected Emby music library is accessible";
  }

  if (state.pendingAutoplayResume) {
    return "browser blocked autoplay; tap play once inside the page";
  }

  if (state.lastPlaybackError || state.lastPlaybackInfoError) {
    if (state.currentPlaybackMode === "direct") {
      return "direct playback failed; try HLS/AAC 384k or AAC 320k in quality settings";
    }

    if (!state.qualityFallbackAttempted) {
      return "transcoded playback failed; use a recovery preset or MP3 compatible fallback";
    }

    return "compatible fallback also failed; run playback chain test and check server transcoding logs";
  }

  if (state.lastPlaybackProbe) {
    return "playback chain test succeeded; retry playback or switch track if the browser is still blocked";
  }

  return "no obvious error; keep this diagnostics snapshot with the exact failing track";
}

function buildLoginDiagnostics() {
  return [
    `${APP_NAME} ${APP_VERSION}`,
    `URL: ${location.href}`,
    `Recommended action: ${getLoginDiagnosticsGuidance()}`,
    `Script version: ${APP_VERSION}`,
    `Window title: ${document.title || "-"}`,
    `Server input: ${serverUrlInput.value || "-"}`,
    `Normalized server: ${getLoginServerUrl() || "-"}`,
    `Configured server URL: ${getConfiguredServerUrl() || "-"}`,
    `Server URL locked: ${isServerUrlLocked() ? "yes" : "no"}`,
    `Browser network: ${navigator.onLine === false ? "offline" : "online"}`,
    `Default device: ${getDefaultDeviceName()}`,
    `Service Worker: ${"serviceWorker" in navigator ? (navigator.serviceWorker.controller ? "controlled" : "supported") : "unsupported"}`,
    `Cache API: ${"caches" in window ? "supported" : "unsupported"}`,
    `Protocol: ${location.protocol}`,
    `User agent: ${navigator.userAgent}`,
  ].join("\n");
}

function getLoginDiagnosticsGuidance() {
  if (!getLoginServerUrl()) {
    return "enter the Emby server address, then test the server";
  }

  if (navigator.onLine === false) {
    return "browser is offline; reconnect the network before logging in";
  }

  if (location.protocol === "file:") {
    return "file protocol may be blocked by CORS; use the local dev server or a static web server";
  }

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    return "service worker is active; clear cache and reload if login opens an old page";
  }

  return "test server first; if it succeeds, connect with username and password";
}

function applyVolumePreference() {
  audioPlayer.volume = clamp(state.volume, 0, 1);
  audioPlayer.muted = false;
  state.lastVolume = audioPlayer.volume || 1;
  volumeSlider.value = String(Math.round(audioPlayer.volume * 100));
  updateVolumeButton();
}

function applyTrackDensityPreference() {
  const density = TRACK_DENSITIES.includes(state.trackDensity) ? state.trackDensity : "comfortable";

  state.trackDensity = density;
  trackDensitySelect.value = density;
  document.body.classList.toggle("density-compact", density === "compact");
  document.documentElement.classList.toggle("density-compact", density === "compact");
}

function renderAudioQualityButton() {
  const profile = getAudioQualityProfile();

  if (!audioQualityButton || !mobilePlayerQualityButton || !mobilePlayerQualityLabel) {
    return;
  }

  if (isExternalSourceSession()) {
    const option = getExternalPlaybackQualityOption(state.currentTrack);
    const currentQuality = getTrackQualitySummary(state.currentTrack);
    const currentLabel = isVideoTrack(state.currentTrack)
      ? `MV ${option.shortLabel}`
      : (currentQuality?.shortLabel || option.label);

    audioQualityButton.textContent = currentLabel;
    audioQualityButton.title = `音乐桥：${option.label} · ${option.quality} · ${currentQuality?.detailLabel || "源站返回格式"}`;
    audioQualityButton.dataset.mode = "external";
    mobilePlayerQualityLabel.textContent = isVideoTrack(state.currentTrack) ? option.shortLabel : option.shortLabel;
    mobilePlayerQualityButton.title = audioQualityButton.title;
    renderHomeStartPanel();
    return;
  }

  audioQualityButton.textContent = getAudioQualityButtonLabel(profile);
  audioQualityButton.title = `${profile.label} · ${profile.codec} · ${profile.bitrateLabel || "原码率"}`;
  audioQualityButton.dataset.mode = profile.mode === "direct" ? "direct" : "transcode";
  mobilePlayerQualityLabel.textContent = profile.mode === "direct"
    ? "无损"
    : `${profile.codec.slice(0, 3).toUpperCase()}${profile.bitrate ? Math.round(profile.bitrate / 1000) : ""}`;
  mobilePlayerQualityButton.title = audioQualityButton.title;
  renderHomeStartPanel();
}

function getAudioQualityButtonLabel(profile = getAudioQualityProfile()) {
  if (isExternalSourceSession()) {
    const option = getExternalPlaybackQualityOption();
    return isVideoTrack(state.currentTrack) ? `MV ${option.shortLabel}` : option.shortLabel;
  }

  if (profile.mode === "direct") {
    return "无损";
  }

  return `${profile.codec} ${profile.bitrate ? Math.round(profile.bitrate / 1000) : ""}k`.trim();
}

function getAudioQualityProfile() {
  return AUDIO_QUALITY_PROFILES.find((profile) => profile.id === state.audioQualityProfileId)
    || DEFAULT_AUDIO_QUALITY_PROFILE;
}

function getTranscodeMethodLabel(profile = getAudioQualityProfile()) {
  if (profile.mode === "direct") {
    return "直放";
  }

  if (profile.protocol === "hls") {
    return "HLS 转码";
  }

  if (profile.id === "remux-directstream") {
    return "Remux/DirectStream";
  }

  if (profile.id === "pcm-wav") {
    return "PCM/WAV";
  }

  return "普通音频流转码";
}

function getAudioQualityMethodGroupId(profile) {
  if (profile.mode === "direct") {
    return "direct";
  }

  if (profile.protocol === "hls") {
    return "hls";
  }

  if (profile.id === "remux-directstream") {
    return "remux";
  }

  if (profile.id === "pcm-wav") {
    return "pcm";
  }

  return "http";
}

function getAudioQualityOptionTitle(profile) {
  if (profile.id === "remux-directstream" || profile.id === "pcm-wav") {
    return profile.label;
  }

  if (profile.mode === "direct") {
    return "原始无损";
  }

  return [profile.label, profile.bitrateLabel].filter(Boolean).join(" · ");
}

function getEffectiveTranscodeMethodLabel(profile = getAudioQualityProfile()) {
  if (profile.protocol === "hls" && !supportsNativeHls() && !window.Hls?.isSupported?.()) {
    return "HLS 转码";
  }

  return getTranscodeMethodLabel(profile);
}

function getAudioQualitySceneText(profile) {
  if (profile.protocol === "hls") {
    if (supportsNativeHls()) {
      return `${profile.scene} · 当前浏览器原生支持 HLS`;
    }

    if (window.Hls?.isSupported?.()) {
      return `${profile.scene} · 当前浏览器将通过 hls.js 播放 HLS`;
    }

    return `${profile.scene} · 当前浏览器缺少 HLS 支持，失败时会切到兼容兜底`;
  }

  return profile.scene;
}

function supportsNativeHls(element = document.createElement("audio")) {
  return Boolean(element.canPlayType("application/vnd.apple.mpegurl")
    || element.canPlayType("application/x-mpegURL"));
}

function getTrackDensityLabel(density) {
  return density === "compact" ? "紧凑" : "舒适";
}

function handleVolumeInput() {
  const nextVolume = clamp(Number(volumeSlider.value) / 100, 0, 1);
  state.volume = nextVolume;
  audioPlayer.volume = nextVolume;
  audioPlayer.muted = false;

  if (nextVolume > 0) {
    state.lastVolume = nextVolume;
  }

  storage.saveVolume(nextVolume);
  updateVolumeButton();
}

function toggleMute() {
  if (audioPlayer.muted || audioPlayer.volume === 0) {
    const restoredVolume = clamp(state.lastVolume || state.volume || 1, 0.05, 1);
    state.volume = restoredVolume;
    audioPlayer.volume = restoredVolume;
    audioPlayer.muted = false;
  } else {
    state.lastVolume = audioPlayer.volume || state.volume || 1;
    audioPlayer.muted = true;
  }

  storage.saveVolume(state.volume);
  updateVolumeButton();
}

function updateVolumeButton() {
  const effectiveVolume = audioPlayer.muted ? 0 : audioPlayer.volume;
  const percent = Math.round(effectiveVolume * 100);

  muteButton.setAttribute("aria-label", audioPlayer.muted ? "取消静音" : "静音");
  muteButton.title = audioPlayer.muted ? "取消静音" : `音量 ${percent}%`;
  muteButton.dataset.muted = audioPlayer.muted || percent === 0 ? "true" : "false";
  volumeSlider.value = String(Math.round(audioPlayer.volume * 100));
  renderSettings();
}

function preloadNextTrack(options = {}) {
  if (!state.playbackPreloadEnabled || isExternalSourceSession() || !state.session || !state.queue.length || !state.currentTrack) {
    clearPreload();
    return;
  }

  const nextTrack = getPreloadCandidateTrack();

  if (!nextTrack || nextTrack.Id === state.currentTrack.Id) {
    clearPreload();
    return;
  }

  const mode = resolvePlaybackMode();
  const mediaSourceId = getTrackDefaultMediaSourceId(nextTrack);
  const playSessionId = createPlaybackSessionId(nextTrack);
  const source = getAudioStreamUrl(nextTrack, mode, playSessionId, mediaSourceId);

  if (!options.force && preloadAudio.src === source && state.preloadTrackId === nextTrack.Id) {
    return;
  }

  state.preloadTrackId = nextTrack.Id;
  state.preloadSource = source;
  state.preloadMode = mode;
  state.preloadMediaSourceId = mediaSourceId;
  state.preloadPlaySessionId = playSessionId;
  state.preloadQualityProfileId = state.audioQualityProfileId;
  state.preloadSession = null;
  state.preloadCacheStatus = "预加载中";
  preloadAudio.src = source;
  preloadAudio.load();
  preparePreloadedPlaybackSession(nextTrack, mode, playSessionId, mediaSourceId, source);
  precachePlaybackSource(source, nextTrack);
  renderSettings();
}

function getPreloadCandidateTrack() {
  return getNextPreviewTrack();
}

async function preparePreloadedPlaybackSession(track, mode, playSessionId, mediaSourceId, source) {
  const requestId = ++state.preloadRequestId;

  try {
    const playbackInfo = await fetchPlaybackInfo(track, mode, mediaSourceId);

    if (requestId !== state.preloadRequestId || state.preloadTrackId !== track.Id) {
      return;
    }

    const mediaSource = selectPlaybackMediaSource(playbackInfo, track, mode, mediaSourceId);
    const resolvedMediaSourceId = mediaSource?.Id || mediaSourceId;
    const resolvedPlaySessionId = normalizePlaybackSessionId(playbackInfo?.PlaySessionId || mediaSource?.PlaySessionId || playSessionId)
      || playSessionId;

    state.preloadMediaSourceId = resolvedMediaSourceId;
    state.preloadPlaySessionId = resolvedPlaySessionId;
    state.preloadSource = getAudioStreamUrl(track, mode, resolvedPlaySessionId, resolvedMediaSourceId);
    state.preloadSession = {
      mediaSourceId: resolvedMediaSourceId,
      playSessionId: resolvedPlaySessionId,
      streamUrl: state.preloadSource,
    };

    if (state.preloadSource !== source) {
      preloadAudio.src = state.preloadSource;
      preloadAudio.load();
      precachePlaybackSource(state.preloadSource, track);
    }

    renderSettings();
  } catch {
    if (requestId === state.preloadRequestId && state.preloadTrackId === track.Id) {
      state.preloadSession = {
        mediaSourceId,
        playSessionId,
        streamUrl: source,
      };
      renderSettings();
    }
  }
}

function takePreloadedPlaybackSession(track, mode) {
  if (!track?.Id || track.Id !== state.preloadTrackId || mode !== state.preloadMode) {
    return null;
  }

  if (state.preloadQualityProfileId !== state.audioQualityProfileId || !state.preloadSession?.streamUrl) {
    return null;
  }

  const session = { ...state.preloadSession };
  clearPreload({ keepAudioElement: true });
  return session;
}

async function precachePlaybackSource(source, track) {
  if (!source || !("caches" in window) || !window.AbortController) {
    state.preloadCacheStatus = source ? "浏览器仅预加载" : "";
    renderSettings();
    return;
  }

  const requestKey = `${track.Id}:${source}`;

  if (state.preloadCacheRequestKey === requestKey) {
    return;
  }

  state.preloadCacheController?.abort();
  const controller = new AbortController();
  state.preloadCacheController = controller;
  state.preloadCacheRequestKey = requestKey;

  try {
    const headResponse = await fetch(source, {
      cache: "no-store",
      credentials: "include",
      method: "HEAD",
      signal: controller.signal,
    }).catch(() => null);
    const contentLength = Number(headResponse?.headers?.get("content-length") || 0);

    if (!shouldPrecachePlaybackResponse(track, contentLength)) {
      state.preloadCacheStatus = getPrecacheSkippedLabel(track, contentLength);
      return;
    }

    const response = await fetch(source, {
      cache: "force-cache",
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const responseLength = Number(response.headers.get("content-length") || contentLength || 0);
    if (!shouldPrecachePlaybackResponse(track, responseLength)) {
      state.preloadCacheStatus = getPrecacheSkippedLabel(track, responseLength);
      return;
    }

    if (controller.signal.aborted || state.preloadCacheRequestKey !== requestKey) {
      return;
    }

    const cache = await caches.open(PLAYBACK_PRELOAD_CACHE_NAME);
    await cache.put(source, response.clone());
    state.preloadCacheStatus = "已预缓存";
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    state.preloadCacheStatus = "浏览器已预加载";
  } finally {
    if (state.preloadCacheRequestKey === requestKey) {
      state.preloadCacheController = null;
      renderSettings();
    }
  }
}

function shouldPrecachePlaybackResponse(track, contentLength) {
  if (state.playbackLosslessPrecacheEnabled) {
    return true;
  }

  if (getAudioQualityProfile().mode === "direct" && getTrackQualitySummary(track)?.isLossless) {
    return false;
  }

  return !contentLength || contentLength <= MAX_PLAYBACK_PRECACHE_BYTES;
}

function getPrecacheSkippedLabel(track, contentLength) {
  if (getAudioQualityProfile().mode === "direct" && getTrackQualitySummary(track)?.isLossless && !state.playbackLosslessPrecacheEnabled) {
    return "无损下载未开启";
  }

  return contentLength > MAX_PLAYBACK_PRECACHE_BYTES ? "文件较大，仅预加载" : "浏览器已预加载";
}

function clearPreload(options = {}) {
  state.preloadTrackId = null;
  state.preloadSource = "";
  state.preloadMode = "";
  state.preloadMediaSourceId = "";
  state.preloadPlaySessionId = "";
  state.preloadQualityProfileId = "";
  state.preloadSession = null;
  state.preloadRequestId += 1;
  state.preloadCacheStatus = "";
  state.preloadCacheRequestKey = "";
  state.preloadCacheController?.abort();
  state.preloadCacheController = null;
  if (!options.keepAudioElement) {
    preloadAudio.removeAttribute("src");
    preloadAudio.load();
  }
  renderSettings();
}

function unloadAudioSource() {
  activePlaybackLoadProfile = null;
  destroyHlsPlayer();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
}

function resolvePlaybackMode(requestedMode) {
  if (requestedMode === "direct" || requestedMode === "universal") {
    return requestedMode;
  }

  return getAudioQualityProfile().mode === "direct" ? "direct" : "universal";
}

function shouldFallbackToTranscode() {
  if (isExternalSourceTrack(state.currentTrack)) {
    return false;
  }

  return state.playbackStreamPolicy === "auto"
    && state.currentPlaybackMode === "direct"
    && !state.fallbackAttempted;
}

function retryWithOppositePlaybackMode(track) {
  if (isExternalSourceTrack(track)) {
    playTrack(track, state.queue, {
      positionSeconds: getRetryPositionSeconds(),
    });
    return;
  }

  const nextMode = state.currentPlaybackMode === "universal" ? "direct" : "universal";

  playTrack(track, state.queue, {
    mode: nextMode,
    positionSeconds: getRetryPositionSeconds(),
  });
}

function shouldFallbackToCompatibleQuality() {
  if (isExternalSourceTrack(state.currentTrack)) {
    return false;
  }

  const profile = getAudioQualityProfile();

  return state.currentPlaybackMode === "universal"
    && profile.id !== "http-mp3-320"
    && !state.qualityFallbackAttempted;
}

function fallbackToCompatibleQuality(track) {
  applyRecoveryQualityProfile("http-mp3-320", track, { automatic: true });
}

function applyRecoveryQualityProfile(profileId, track = state.currentTrack, options = {}) {
  const profile = AUDIO_QUALITY_PROFILES.find((item) => item.id === profileId) || DEFAULT_AUDIO_QUALITY_PROFILE;
  const previousProfileId = state.audioQualityProfileId;
  const resumePosition = getRetryPositionSeconds();

  state.audioQualityProfileId = profile.id;
  state.playbackStreamPolicy = profile.mode === "direct" ? "direct" : "transcode";
  state.transcodeBitrate = profile.bitrate > 0 ? profile.bitrate : state.transcodeBitrate;
  storage.saveAudioQualityProfile(profile.id);
  storage.savePlaybackStreamPolicy(state.playbackStreamPolicy);
  storage.saveTranscodeBitrate(state.transcodeBitrate);
  clearPreload();
  renderAudioQualityButton();
  renderAudioQualityOptions();
  renderPlayerPlaybackMeta(state.currentTrack);
  renderNowPlayingPlaybackMeta(state.currentTrack);
  renderImmersivePlaybackMeta(state.currentTrack);
  renderSettings();
  renderPlaybackRecoveryQuickList(track);

  const statusText = `${profile.codec} ${profile.bitrateLabel || "原码率"}`.trim();
  const prefix = options.automatic ? "当前音质播放失败，正在尝试兼容方案" : "正在切换稳播方案";
  setLibraryStatus(`${prefix}：${statusText}...`);
  showNotice(`${prefix}：${profile.label} · ${statusText}。`, {
    type: "warning",
    actions: [
      previousProfileId !== profile.id
        ? { label: "恢复原音质", handler: () => selectAudioQualityProfile(previousProfileId) }
        : null,
      { label: "选择音质", handler: openAudioQualityModal },
      { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
    ].filter(Boolean),
  });

  if (track?.Id) {
    playTrack(track, getPlaybackRetryQueue(track), {
      mode: profile.mode === "direct" ? "direct" : "universal",
      positionSeconds: resumePosition,
      qualityFallbackAttempted: Boolean(options.automatic || profile.id === "http-mp3-320"),
    });
  }
}

function getRecoveryProfileTitle(profile) {
  if (profile.id === "hls-aac-384") {
    return "推荐稳播";
  }

  if (profile.id === "hls-aac-256") {
    return "平衡网络";
  }

  if (profile.id === "http-aac-128") {
    return "弱网省流";
  }

  if (profile.id === "http-mp3-320") {
    return "兼容兜底";
  }

  return profile.label;
}

function getRecoveryProfileMeta(profile) {
  const method = getTranscodeMethodLabel(profile);
  const bitrate = profile.bitrateLabel || "原码率";

  return `${method} · ${profile.codec} ${bitrate}`.trim();
}

function getOppositePlaybackActionLabel() {
  if (isExternalSourceTrack(state.currentTrack)) {
    return "重新解析";
  }

  return state.currentPlaybackMode === "universal" ? "尝试直连" : "转码重试";
}

function getRetryPositionSeconds() {
  const currentTime = Number(audioPlayer.currentTime);

  if (Number.isFinite(currentTime) && currentTime > 0) {
    return currentTime;
  }

  return state.savedPlaybackPositionSeconds || 0;
}

function getPlaybackRetryQueue(track) {
  if (state.queue.length) {
    return state.queue;
  }

  if (state.filteredTracks.length) {
    return state.filteredTracks;
  }

  if (state.tracks.length) {
    return state.tracks;
  }

  return track ? [track] : [];
}

function getCurrentPlaybackSourceLabel() {
  if (isExternalSourceTrack(state.currentTrack)) {
    const quality = getTrackQualitySummary(state.currentTrack);
    return [
      "音乐桥直链",
      isVideoTrack(state.currentTrack) ? "视频/MV" : "音频",
      quality?.shortLabel,
      getExternalSourceQualityOption().label,
    ].filter(Boolean).join(" / ");
  }

  const profile = getAudioQualityProfile();
  const modeLabel = state.currentPlaybackMode === "universal" ? getTranscodeMethodLabel(profile) : "直连";
  const policyLabel = PLAYBACK_STREAM_LABELS[state.playbackStreamPolicy] || state.playbackStreamPolicy;

  if (!state.currentTrack) {
    return `${profile.label} / ${policyLabel} / 未播放`;
  }

  return state.currentPlaybackMode === "universal"
    ? `${modeLabel} / ${profile.codec} / ${profile.bitrateLabel || getTranscodeBitrateLabel()}`
    : modeLabel;
}

function normalizeTranscodeBitrate(value) {
  const bitrates = TRANSCODE_BITRATES.map((item) => Number(item.value));
  const nextBitrate = Number(value);

  return bitrates.includes(nextBitrate) ? nextBitrate : bitrates[0];
}

function getTranscodeBitrateLabel(value = state.transcodeBitrate) {
  const profile = getAudioQualityProfile();
  const bitrate = TRANSCODE_BITRATES.find((item) => Number(item.value) === Number(value));

  return profile.bitrateLabel || bitrate?.label || `${Math.round((Number(value) || 0) / 1000)} kbps`;
}

function getAudioErrorText() {
  const error = audioPlayer.error;
  const mediaLabel = isVideoTrack(state.currentTrack) ? "视频" : "音频";

  if (!error) {
    return `${mediaLabel}播放失败。`;
  }

  const labels = {
    1: "播放被浏览器中止。",
    2: `网络错误导致${mediaLabel}加载失败。`,
    3: `浏览器无法解码当前${mediaLabel}。`,
    4: `${mediaLabel}地址或格式不受支持。`,
  };

  return labels[error.code] || `${mediaLabel}元素错误 ${error.code}`;
}

function handlePlayError(error, track, requestId) {
  if (requestId !== state.playRequestId) {
    return;
  }

  if (isBenignPlaybackInterruption(error)) {
    handleBenignPlayInterruption();
    return;
  }

  state.lastPlaybackError = readableError(error);
  renderPlaybackRecoveryPanel();

  if (isAutoplayBlockedError(error)) {
    state.pendingAutoplayResume = true;
    showNotice("浏览器阻止了自动播放，请再点一次播放。", {
      type: "warning",
      actions: [
        { label: "继续播放", handler: () => resumeBlockedPlayback(track, requestId) },
        { label: "打开设置", handler: () => switchView("settings") },
      ],
    });
    renderSettings();
    return;
  }

  if (shouldFallbackToTranscode()) {
    setLibraryStatus(`直连播放失败，正在尝试转码播放（${getTranscodeBitrateLabel()}）...`);
    playTrack(track, state.queue, {
      mode: "universal",
      positionSeconds: getRetryPositionSeconds(),
    });
    return;
  }

  if (shouldFallbackToCompatibleQuality()) {
    fallbackToCompatibleQuality(track);
    return;
  }

  if (!state.hasReportedPlaybackStart) {
    state.currentPlaySessionId = "";
  }

  showNotice(`播放失败：${readableError(error)}`, {
    type: "error",
    actions: [
      { label: "重试", handler: () => playTrack(track, getPlaybackRetryQueue(track)) },
      { label: getOppositePlaybackActionLabel(), handler: () => retryWithOppositePlaybackMode(track) },
      { label: "测试链路", handler: () => testCurrentPlaybackChain(track), dismiss: false },
      { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      { label: "下一首", handler: playNext },
    ],
  });
  renderSettings();
}

function resumeBlockedPlayback(track, requestId = state.playRequestId) {
  if (requestId !== state.playRequestId || !track || !audioPlayer.src) {
    playTrack(track || state.currentTrack, state.queue, {
      positionSeconds: getRetryPositionSeconds(),
    });
    return;
  }

  state.pendingAutoplayResume = false;
  audioPlayer.play()
    .then(() => {
      if (requestId === state.playRequestId) {
        clearPlaybackErrorState();
        setLibraryStatus("");
        addRecentTrack(track);
        preloadNextTrack();
        reportPlaybackStarted(track);
      }
    })
    .catch((error) => handlePlayError(error, track, requestId));
}

function handleBenignPlayInterruption() {
  state.lastPlaybackError = "";
  state.lastPlaybackInfoError = "";
  setLibraryStatus("");
  updatePlaybackState();
  hidePlaybackRecovery();
  renderSettings();
}

function handleAudioElementError() {
  if (!state.currentTrack || !audioPlayer.src) {
    return;
  }

  if (audioPlayer.error?.code === 1) {
    handleBenignPlayInterruption();
    return;
  }

  state.lastPlaybackError = getAudioErrorText();
  renderPlaybackRecoveryPanel();

  if (shouldFallbackToTranscode()) {
    setLibraryStatus(`直连播放失败，正在尝试转码播放（${getTranscodeBitrateLabel()}）...`);
    playTrack(state.currentTrack, state.queue, {
      mode: "universal",
      positionSeconds: getRetryPositionSeconds(),
    });
    return;
  }

  if (shouldFallbackToCompatibleQuality()) {
    fallbackToCompatibleQuality(state.currentTrack);
    return;
  }

  reportPlaybackStopped(state.currentTrack);

  showNotice(`当前${isVideoTrack(state.currentTrack) ? "视频/MV" : "歌曲"}播放失败，可以换一首再试。`, {
    type: "error",
    actions: [
      { label: "重试", handler: () => playTrack(state.currentTrack, getPlaybackRetryQueue(state.currentTrack)) },
      { label: getOppositePlaybackActionLabel(), handler: () => retryWithOppositePlaybackMode(state.currentTrack) },
      { label: "测试链路", handler: () => testCurrentPlaybackChain(state.currentTrack), dismiss: false },
      { label: "复制诊断", handler: copyDiagnostics, dismiss: false },
      { label: "下一首", handler: playNext },
    ],
  });
  renderSettings();
}

function reportPlaybackStarted(track) {
  if (!state.session || !track) {
    return;
  }

  const playSessionId = ensurePlaybackSessionId(track);
  state.hasReportedPlaybackStart = true;
  state.lastProgressReportAt = Date.now();
  embyPost("/Sessions/Playing", buildPlaybackPayload(track, false, { playSessionId }));
}

function reportPlaybackProgress(force = false, eventName = "") {
  if (!state.session || !state.currentTrack) {
    return;
  }

  if (!force && audioPlayer.paused) {
    return;
  }

  if (!state.hasReportedPlaybackStart) {
    return;
  }

  const playSessionId = ensurePlaybackSessionId(state.currentTrack);

  state.lastProgressReportAt = Date.now();
  embyPost("/Sessions/Playing/Progress", buildPlaybackPayload(state.currentTrack, audioPlayer.paused, {
    playSessionId,
    eventName: eventName || (audioPlayer.paused ? "Pause" : "TimeUpdate"),
  }));
}

function reportPlaybackStopped(track = state.currentTrack) {
  if (!state.session || !track) {
    return;
  }

  const playSessionId = state.currentPlaySessionId || (state.hasReportedPlaybackStart ? ensurePlaybackSessionId(track) : "");

  if (!playSessionId || !state.hasReportedPlaybackStart) {
    if (!track || track.Id === state.currentTrack?.Id) {
      state.currentMediaSourceId = "";
      state.currentPlaySessionId = "";
      state.hasReportedPlaybackStart = false;
    }
    return;
  }

  embyPost("/Sessions/Playing/Stopped", buildPlaybackPayload(track, true, { playSessionId }));

  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
}

function buildPlaybackPayload(track, isPaused, options = {}) {
  const playSessionId = normalizePlaybackSessionId(options.playSessionId || state.currentPlaySessionId) || ensurePlaybackSessionId(track);
  const queueIndex = getCurrentQueueIndex();
  const payload = {
    ItemId: track.Id,
    MediaSourceId: getMediaSourceId(track),
    PlaySessionId: playSessionId,
    PlayMethod: state.currentPlaybackMode === "universal" ? "Transcode" : "DirectStream",
    PositionTicks: secondsToTicks(audioPlayer.currentTime),
    IsPaused: isPaused,
    IsMuted: audioPlayer.muted,
    CanSeek: true,
    PlaybackStartTimeTicks: secondsToTicks(0),
    PlaybackRate: audioPlayer.playbackRate || 1,
    VolumeLevel: audioPlayer.muted ? 0 : Math.round(audioPlayer.volume * 100),
  };

  if (options.eventName) {
    payload.EventName = options.eventName;
  }

  if (queueIndex >= 0) {
    payload.PlaylistIndex = queueIndex;
    payload.PlaylistLength = state.queue.length;
  }

  return removeEmptyPlaybackFields(payload);
}

function getMediaSourceId(track) {
  if (track?.Id && track.Id === state.currentTrack?.Id && state.currentMediaSourceId) {
    return state.currentMediaSourceId;
  }

  return getTrackDefaultMediaSourceId(track);
}

function getTrackDefaultMediaSourceId(track) {
  return track.MediaSources?.[0]?.Id || track.Id;
}

function createPlaybackSessionId(track) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const itemId = String(track?.Id || "audio").replace(/[^a-z0-9]/gi, "").slice(0, 12) || "audio";
  return `${Date.now().toString(36)}-${itemId}-${Math.random().toString(36).slice(2, 10)}`;
}

function removeEmptyPlaybackFields(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function formatByteSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "未知大小";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 || size >= 100 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function updatePlayerMeta(track) {
  applyTrackAccent(track);
  document.body.classList.toggle("has-current-track", Boolean(track));
  updateMediaElementPresentation(track);
  playerTitle.textContent = track.Name || "未命名歌曲";
  playerSubtitle.textContent = [getArtists(track), track.Album].filter(Boolean).join(" · ") || "Emby Music";
  renderPlayerPlaybackMeta(track);
  playerCover.replaceChildren();
  playerCover.className = "mini-cover";
  appendImage(playerCover, getTrackImageUrl(track, 180), track.Name);
  renderNowPlaying();
  renderRestoredPlaybackProgress(track);
  updatePlayButtonLabels();
  updateMediaSessionMetadata(track);
  updateDocumentTitle();
}

function updateMediaElementPresentation(track = state.currentTrack) {
  const isVideo = isVideoTrack(track);
  document.body.classList.toggle("is-video-track", Boolean(isVideo));
  document.body.classList.toggle("is-audio-track", Boolean(track && !isVideo));

  if (!isVideo) {
    state.videoFloatingMode = "hidden";
    restoreMediaElementHome();
    return;
  }

  if (!getActiveVideoHost()) {
    state.videoFloatingMode = "hidden";
  }

  renderVideoTrackFrame(track);
  mountVideoElementForActiveView();
}

function ensureMediaVideoPlaceholder() {
  if (mediaVideoPlaceholder?.isConnected) {
    return mediaVideoPlaceholder;
  }

  mediaVideoPlaceholder = document.createComment("audioPlayer-home");
  if (audioPlayer.parentNode) {
    audioPlayer.parentNode.insertBefore(mediaVideoPlaceholder, audioPlayer);
  }

  return mediaVideoPlaceholder;
}

function bindFloatingVideoControls() {
  ensureFloatingVideoShell();
  floatingVideoMinimizeButton?.addEventListener("click", toggleFloatingVideoCompact);
  floatingVideoHideButton?.addEventListener("click", hideFloatingVideo);
  floatingVideoRestoreButton?.addEventListener("click", restoreFloatingVideo);
}

function ensureFloatingVideoShell() {
  if (floatingVideoShell) {
    return floatingVideoShell;
  }

  floatingVideoShell = document.createElement("section");
  floatingVideoShell.className = "floating-video-shell";
  floatingVideoShell.hidden = true;
  floatingVideoShell.setAttribute("aria-label", "视频播放窗口");

  const controls = document.createElement("div");
  controls.className = "floating-video-controls";

  floatingVideoMinimizeButton = document.createElement("button");
  floatingVideoMinimizeButton.type = "button";
  floatingVideoMinimizeButton.className = "floating-video-control";
  floatingVideoMinimizeButton.setAttribute("aria-label", "缩小视频窗口");
  floatingVideoMinimizeButton.title = "缩小视频窗口";
  floatingVideoMinimizeButton.innerHTML = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H6.8A1.8 1.8 0 0 0 5 6.8V9"></path><path d="M15 5h2.2A1.8 1.8 0 0 1 19 6.8V9"></path><path d="M19 15v2.2a1.8 1.8 0 0 1-1.8 1.8H15"></path><path d="M9 19H6.8A1.8 1.8 0 0 1 5 17.2V15"></path></svg>';

  floatingVideoHideButton = document.createElement("button");
  floatingVideoHideButton.type = "button";
  floatingVideoHideButton.className = "floating-video-control";
  floatingVideoHideButton.setAttribute("aria-label", "隐藏视频窗口");
  floatingVideoHideButton.title = "隐藏视频窗口";
  floatingVideoHideButton.innerHTML = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10"></path><path d="M17 7 7 17"></path></svg>';

  controls.append(floatingVideoMinimizeButton, floatingVideoHideButton);
  floatingVideoShell.append(controls);
  document.body.append(floatingVideoShell);

  return floatingVideoShell;
}

function toggleFloatingVideoCompact() {
  state.videoFloatingMode = state.videoFloatingMode === "compact" ? "normal" : "compact";
  syncFloatingVideoState();
}

function hideFloatingVideo() {
  state.videoFloatingMode = "hidden";
  syncFloatingVideoState();
}

function restoreFloatingVideo() {
  state.videoFloatingMode = "normal";
  mountVideoElementForActiveView();
}

function syncFloatingVideoState() {
  const isVideo = isVideoTrack(state.currentTrack);
  const activeVideoHost = getActiveVideoHost();
  const isFloatingVideo = Boolean(isVideo && floatingVideoShell && audioPlayer.parentNode === floatingVideoShell);
  const isCompact = isFloatingVideo && state.videoFloatingMode === "compact";
  const isHidden = isVideo && state.videoFloatingMode === "hidden" && !activeVideoHost;

  document.body.classList.toggle("video-window-compact", isCompact);
  document.body.classList.toggle("video-window-hidden", isHidden);

  if (floatingVideoShell) {
    floatingVideoShell.hidden = !isFloatingVideo || isHidden;
  }

  if (floatingVideoRestoreButton) {
    floatingVideoRestoreButton.hidden = !isHidden;
  }

  if (floatingVideoMinimizeButton) {
    floatingVideoMinimizeButton.title = isCompact ? "还原视频窗口" : "缩小视频窗口";
    floatingVideoMinimizeButton.setAttribute("aria-label", floatingVideoMinimizeButton.title);
  }
}

function restoreMediaElementHome() {
  const placeholder = ensureMediaVideoPlaceholder();

  if (placeholder.parentNode && audioPlayer.parentNode !== placeholder.parentNode) {
    placeholder.parentNode.insertBefore(audioPlayer, placeholder.nextSibling);
  }

  mediaVideoHost = null;
  audioPlayer.removeAttribute("poster");
  syncFloatingVideoState();
}

function getActiveVideoHost() {
  if (getActiveView() === "immersivePlayer") {
    return immersiveCover;
  }

  if (getActiveView() === "nowPlaying") {
    return nowPlayingCover;
  }

  return null;
}

function mountVideoElementForActiveView() {
  if (!isVideoTrack(state.currentTrack)) {
    return;
  }

  const host = getActiveVideoHost();

  if (!host) {
    if (state.videoFloatingMode === "hidden") {
      restoreMediaElementHome();
      return;
    }

    mountFloatingVideoElement();
    return;
  }

  ensureMediaVideoPlaceholder();
  if (mediaVideoHost === host && audioPlayer.parentNode === host) {
    return;
  }

  host.replaceChildren(audioPlayer);
  host.classList.add("media-video-host");
  mediaVideoHost = host;
  syncFloatingVideoState();
}

function mountFloatingVideoElement() {
  const shell = ensureFloatingVideoShell();

  ensureMediaVideoPlaceholder();
  if (audioPlayer.parentNode !== shell) {
    shell.append(audioPlayer);
  }

  mediaVideoHost = null;
  syncFloatingVideoState();
}

function renderVideoTrackFrame(track) {
  const poster = getTrackImageUrl(track, 1100);
  if (poster) {
    audioPlayer.poster = poster;
  } else {
    audioPlayer.removeAttribute("poster");
  }
}

function triggerPlayerTrackChange() {
  if (state.trackChangeTimer) {
    clearTimeout(state.trackChangeTimer);
  }

  document.body.classList.remove("track-just-changed");
  requestAnimationFrame(() => {
    document.body.classList.add("track-just-changed");
    state.trackChangeTimer = setTimeout(() => {
      document.body.classList.remove("track-just-changed");
      state.trackChangeTimer = null;
    }, 760);
  });
}

function triggerPlayerbarSweep() {
  if (!playerbarSweepLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  playerbarSweepLayer.classList.remove("is-active");
  void playerbarSweepLayer.offsetWidth;
  playerbarSweepLayer.classList.add("is-active");
}

function resetPlayerMeta() {
  applyTrackAccent(null);
  document.body.classList.remove("has-current-track");
  document.body.classList.remove("is-video-track", "is-audio-track");
  document.body.classList.remove("track-just-changed");
  restoreMediaElementHome();
  if (state.trackChangeTimer) {
    clearTimeout(state.trackChangeTimer);
    state.trackChangeTimer = null;
  }
  playerTitle.textContent = "等待选择音乐";
  playerSubtitle.textContent = "Emby Music Web";
  renderPlayerPlaybackMeta(null);
  playerCover.replaceChildren();
  playerCover.className = "mini-cover";
  playButton.classList.remove("playing");
  nowPlayButton.classList.remove("playing");
  immersivePlayButton.classList.remove("playing");
  invalidateProgressRenderCache();
  setProgressDisplay(0, 0);
  renderNowPlaying();
  updatePlayButtonLabels();
  clearMediaSession();
  updateDocumentTitle();
}

function applyTrackAccent(track) {
  const accent = DEFAULT_TRACK_ACCENT;
  state.currentAccent = accent;
  document.documentElement.style.setProperty("--now-accent", accent.color);
  document.documentElement.style.setProperty("--now-accent-deep", accent.deep);
  document.documentElement.style.setProperty("--now-accent-rgb", accent.rgb);
  document.documentElement.style.setProperty("--accent-color", accent.color);
  document.documentElement.style.setProperty("--accent-color-rgb", accent.rgb);
  updateAlbumAmbientColor(track, accent);
  syncCurrentAccentStatus();
}

function updateAlbumAmbientColor(track, accent = state.currentAccent || DEFAULT_TRACK_ACCENT) {
  const requestId = state.albumAmbientRequestId + 1;
  state.albumAmbientRequestId = requestId;

  if (!track) {
    setAlbumAmbientColor(accent.rgb, accent.rgb, requestId);
    return;
  }

  const imageUrl = getTrackImageUrl(track, 120);
  if (!imageUrl) {
    setAlbumAmbientColor(accent.rgb, accent.rgb, requestId);
    return;
  }

  extractImageAverageRgb(imageUrl)
    .then((colors) => {
      setAlbumAmbientColor(colors?.primary || accent.rgb, colors?.secondary || accent.rgb, requestId);
    })
    .catch(() => {
      setAlbumAmbientColor(accent.rgb, accent.rgb, requestId);
    });
}

function setAlbumAmbientColor(primaryRgb, secondaryRgb = primaryRgb, requestId) {
  if (requestId !== state.albumAmbientRequestId || !primaryRgb) {
    return;
  }

  document.documentElement.style.setProperty("--album-ambient-rgb", primaryRgb);
  document.documentElement.style.setProperty("--album-ambient-rgb-alt", secondaryRgb || primaryRgb);
}

function extractImageAverageRgb(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.addEventListener("load", () => {
      try {
        const sampleSize = 28;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });

        if (!context) {
          resolve("");
          return;
        }

        canvas.width = sampleSize;
        canvas.height = sampleSize;
        context.drawImage(image, 0, 0, sampleSize, sampleSize);

        const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
        const buckets = new Map();

        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          if (alpha < 180) {
            continue;
          }

          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

          if (lightness < 26 || lightness > 238) {
            continue;
          }

          const key = [
            Math.round(r / 36),
            Math.round(g / 36),
            Math.round(b / 36),
          ].join("-");
          const bucket = buckets.get(key) || { red: 0, green: 0, blue: 0, count: 0 };
          bucket.red += r;
          bucket.green += g;
          bucket.blue += b;
          bucket.count += 1;
          buckets.set(key, bucket);
        }

        const colors = [...buckets.values()]
          .filter((bucket) => bucket.count > 1)
          .map((bucket) => ({
            rgb: `${Math.round(bucket.red / bucket.count)}, ${Math.round(bucket.green / bucket.count)}, ${Math.round(bucket.blue / bucket.count)}`,
            count: bucket.count,
          }))
          .sort((first, second) => second.count - first.count);

        if (!colors.length) {
          resolve(null);
          return;
        }

        resolve({
          primary: colors[0].rgb,
          secondary: colors[1]?.rgb || colors[0].rgb,
        });
      } catch (error) {
        reject(error);
      }
    }, { once: true });

    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

function getTrackAccent(track) {
  if (!track) {
    return DEFAULT_TRACK_ACCENT;
  }

  const seed = [
    track.Id,
    track.AlbumId,
    track.ArtistItems?.map((artist) => artist.Id || artist.Name).join(","),
    track.AlbumArtist,
    track.Album,
    track.Name,
  ].filter(Boolean).join("|");
  const hash = hashAccentSeed(seed || track.Name || "");
  return TRACK_ACCENT_PALETTE[Math.abs(hash) % TRACK_ACCENT_PALETTE.length] || DEFAULT_TRACK_ACCENT;
}

function hashAccentSeed(seed) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}

function getCurrentAccentLabel() {
  const accent = state.currentAccent || DEFAULT_TRACK_ACCENT;
  return `${accent.name} ${accent.color}`;
}

function syncCurrentAccentStatus() {
  if (!settingsAccentColor) {
    return;
  }

  const accent = state.currentAccent || DEFAULT_TRACK_ACCENT;
  settingsAccentColor.innerHTML = "";
  const swatch = document.createElement("span");
  swatch.className = "settings-accent-swatch";
  swatch.style.background = `linear-gradient(135deg, ${accent.color}, ${accent.deep})`;
  swatch.style.boxShadow = `0 0 0 3px rgba(${accent.rgb}, 0.12)`;
  const label = document.createElement("span");
  label.textContent = `${accent.name} ${accent.color}`;
  settingsAccentColor.className = "settings-accent-value";
  settingsAccentColor.append(swatch, label);
}

function updateDocumentTitle() {
  const track = state.currentTrack;

  if (!track) {
    document.title = APP_NAME;
    syncDocumentTitleStatus();
    return;
  }

  const trackTitle = track.Name || "未命名歌曲";
  const artist = getArtists(track);
  const trackLabel = [trackTitle, artist].filter(Boolean).join(" - ");
  const isPlaying = !audioPlayer.paused && !audioPlayer.ended;
  const prefix = isPlaying ? "▶ " : "";

  document.title = `${prefix}${trackLabel} | ${APP_NAME}`;
  syncDocumentTitleStatus();
}

function syncDocumentTitleStatus() {
  if (settingsWindowTitle) {
    settingsWindowTitle.textContent = document.title || APP_NAME;
  }

  if (settingsDiagnostics) {
    settingsDiagnostics.textContent = buildDiagnostics();
  }
}

function renderPlayerPlaybackMeta(track) {
  const items = getPlaybackMetaItems(track);

  if (!items.length) {
    playerPlaybackMeta.hidden = true;
    playerPlaybackMeta.textContent = "";
    playerPlaybackMeta.title = "";
    return;
  }

  playerPlaybackMeta.textContent = items.map((item) => item.label).join(" · ");
  playerPlaybackMeta.title = items.map((item) => item.title || item.label).join(" / ");
  playerPlaybackMeta.hidden = false;
}

function setPlayerEnabled(isEnabled) {
  playerMetaButton.disabled = !isEnabled;
  playButton.disabled = !isEnabled;
  nowPlayButton.disabled = !isEnabled;
  immersivePlayButton.disabled = !isEnabled;
  prevButton.disabled = !isEnabled;
  nowPrevButton.disabled = !isEnabled;
  immersivePrevButton.disabled = !isEnabled;
  nextButton.disabled = !isEnabled;
  nowNextButton.disabled = !isEnabled;
  immersiveNextButton.disabled = !isEnabled;
  progressTrack.disabled = !isEnabled;
  nowPlayingProgressTrack.disabled = !isEnabled;
  immersiveProgressTrack.disabled = !isEnabled;
  locateTrackButton.disabled = !state.session;
  desktopImmersiveButton.disabled = !isEnabled || !state.currentTrack;
  queueButton.disabled = !isEnabled || !state.queue.length;
  nowQueueButton.disabled = !isEnabled || !state.queue.length;
  mobilePlayerQueueButton.disabled = !isEnabled || !state.queue.length;
  mobilePlayerLyricsButton.disabled = !isEnabled || !state.currentTrack;
  mobilePlayerImmersiveButton.disabled = !isEnabled || !state.currentTrack;
  mobilePlayerMoreButton.disabled = !state.session;
  immersiveQueueButton.disabled = !isEnabled || !state.queue.length;
  immersiveQueueLocateButton.disabled = !isEnabled || !state.currentTrack || !state.queue.length;
  immersiveQueueShuffleButton.disabled = !isEnabled || getShuffleableQueueRange().length < 2;
  immersiveQueueClearPlayedButton.disabled = !isEnabled || getCurrentQueueIndex() <= 0;
  immersiveQueueClearButton.disabled = !isEnabled || !state.queue.length;
  updatePlayButtonLabels();
}

function updatePlaybackState() {
  const isPlaying = Boolean(state.currentTrack && !audioPlayer.paused && !audioPlayer.ended);

  playButton.classList.toggle("playing", isPlaying);
  nowPlayButton.classList.toggle("playing", isPlaying);
  immersivePlayButton.classList.toggle("playing", isPlaying);
  document.body.classList.toggle("is-audio-playing", isPlaying);
  document.body.classList.toggle("is-playback-buffering", state.isPlaybackBuffering);
  updatePlayButtonLabels();
  updateMediaSessionPlaybackState();
  updateDocumentTitle();
  updateActiveRows();
  renderHomeStartPanel();
  renderPlayerNextPreview();
  renderQueueOverview();
}

function updatePlayButtonLabels() {
  const restoredPosition = getRestoredPlaybackPosition(state.currentTrack);
  const label = state.isPlaybackBuffering
    ? "正在加载"
    : !audioPlayer.paused
      ? "暂停"
      : restoredPosition
        ? `从 ${formatSeconds(restoredPosition)} 继续播放`
        : "播放";

  playButton.setAttribute("aria-label", label);
  playButton.title = label;
  nowPlayButton.setAttribute("aria-label", label);
  nowPlayButton.title = label;
  immersivePlayButton.setAttribute("aria-label", label);
  immersivePlayButton.title = label;
}

function renderRestoredPlaybackProgress(track) {
  const restoredPosition = getRestoredPlaybackPosition(track);

  if (!restoredPosition) {
    if (!audioPlayer.src) {
      setProgressDisplay(0, getTrackDurationSeconds(track));
    }
    return;
  }

  const duration = getTrackDurationSeconds(track);
  setProgressDisplay(restoredPosition, duration);
  updateLyricsHighlight(restoredPosition, true);
}

function getRestoredPlaybackPosition(track) {
  const position = Number(state.savedPlaybackPositionSeconds) || 0;

  if (!track || audioPlayer.src || position <= 0) {
    return 0;
  }

  const duration = getTrackDurationSeconds(track);

  if (duration && position >= duration - 1) {
    return 0;
  }

  return duration ? clamp(position, 0, Math.max(0, duration - 1)) : position;
}

function getTrackDurationSeconds(track) {
  const duration = Number(track?.RunTimeTicks) / 10000000;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function handleAudioPlay() {
  setPlaybackBuffering(false);
  syncLyricPlaybackClock({ running: true });
  updatePlaybackState();
  refreshLyricsForPlaybackResume();

  if (state.currentTrack && !state.isChangingTrack) {
    reportPlaybackProgress(true, "Unpause");
  }
}

function handleAudioPause() {
  setPlaybackBuffering(false);
  pauseLyricPlaybackClock();
  updatePlaybackState();
  stopLyricProgressLoop();
  persistPlaybackPosition({ force: true });

  if (state.currentTrack && !state.isChangingTrack && audioPlayer.currentTime > 0 && !audioPlayer.ended) {
    reportPlaybackProgress(true, "Pause");
  }
}

function handleAudioTimeUpdate() {
  syncLyricPlaybackClock();
  updateProgress();
  persistPlaybackPosition();

  if (Date.now() - state.lastProgressReportAt > 15000) {
    reportPlaybackProgress();
  }
}

function handleAudioSeeked() {
  setPlaybackBuffering(false);
  syncLyricPlaybackClock();
  updateProgress({ syncLyrics: false });
  state.activeLyricTimelineIndex = -1;
  updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  syncLyricProgressLoop();

  if (state.currentTrack && !state.isChangingTrack && audioPlayer.src) {
    if (Date.now() - state.lastProgressReportAt > 500) {
      reportPlaybackProgress(true, "Seek");
    }

    persistPlaybackPosition({ force: true });
  }
}

function handleAudioBufferingStart() {
  if (!state.currentTrack || audioPlayer.paused || audioPlayer.ended) {
    return;
  }

  pauseLyricPlaybackClock();
  setPlaybackBuffering(true);
}

function handleAudioBufferingEnd() {
  setPlaybackBuffering(false);
  syncLyricPlaybackClock();
  refreshLyricsForPlaybackResume();
}

function handleAudioRateChange() {
  syncLyricPlaybackClock();
  updateMediaSessionPosition();
}

function refreshLyricsForPlaybackResume(fallbackSeconds = getAudioCurrentTimeSeconds()) {
  updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(fallbackSeconds));
  syncLyricProgressLoop();
}

function setPlaybackBuffering(isBuffering) {
  const nextValue = Boolean(isBuffering && state.currentTrack);

  if (state.isPlaybackBuffering === nextValue) {
    return;
  }

  state.isPlaybackBuffering = nextValue;
  document.body.classList.toggle("is-playback-buffering", nextValue);
  updatePlayButtonLabels();
}

function updateProgress(options = {}) {
  const duration = getAudioDurationSeconds();
  const current = getAudioCurrentTimeSeconds();
  const shouldSyncLyrics = options.syncLyrics !== false;

  setProgressDisplay(current, duration);
  if (shouldSyncLyrics) {
    updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(current));
  }
  updateMediaSessionPosition();
  renderPlayerNextPreview();
}

function setProgressDisplay(current, duration) {
  const percent = duration ? Math.min((current / duration) * 100, 100) : 0;
  const ratio = String(percent / 100);
  const width = `${percent}%`;
  const currentLabel = formatSeconds(current);
  const durationLabel = formatSeconds(duration);
  const progressLabel = duration
    ? `播放进度：${currentLabel} / ${durationLabel}`
    : "播放进度";
  const signature = [
    currentLabel,
    durationLabel,
    width,
    ratio,
    progressLabel,
  ].join("|");

  if (signature === progressRenderSignature) {
    renderHomeStartProgress(current, duration);
    return;
  }

  progressRenderSignature = signature;
  setStylePropertyIfChanged(progressFill, "width", width);
  setCssVariableIfChanged(progressFill, "--progress-ratio", ratio);
  setStylePropertyIfChanged(nowPlayingProgressFill, "width", width);
  setStylePropertyIfChanged(immersiveProgressFill, "width", width);
  setTextIfChanged(currentTime, currentLabel);
  setTextIfChanged(nowPlayingCurrentTime, currentLabel);
  setTextIfChanged(immersiveCurrentTime, currentLabel);
  setTextIfChanged(durationTime, durationLabel);
  setTextIfChanged(nowPlayingDurationTime, durationLabel);
  setTextIfChanged(immersiveDurationTime, durationLabel);
  renderHomeStartProgress(current, duration);
  setAttributeIfChanged(progressTrack, "aria-label", progressLabel);
  setAttributeIfChanged(nowPlayingProgressTrack, "aria-label", progressLabel);
  setAttributeIfChanged(immersiveProgressTrack, "aria-label", progressLabel);
}

function invalidateProgressRenderCache() {
  progressRenderSignature = "";
  homeStartProgressSignature = "";
  playerNextPreviewSignature = "";
}

function setTextIfChanged(element, text) {
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

function setAttributeIfChanged(element, name, value) {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

function setDomPropertyIfChanged(element, name, value) {
  if (element && element[name] !== value) {
    element[name] = value;
  }
}

function setDatasetValueIfChanged(element, name, value) {
  if (element && element.dataset[name] !== value) {
    element.dataset[name] = value;
  }
}

function setStylePropertyIfChanged(element, name, value) {
  if (element && element.style[name] !== value) {
    element.style[name] = value;
  }
}

function setCssVariableIfChanged(element, name, value) {
  if (element && element.style.getPropertyValue(name) !== value) {
    element.style.setProperty(name, value);
  }
}

function seekFromProgress(event) {
  const duration = getAudioDurationSeconds();

  if (!duration) {
    return;
  }

  const progressButton = event.currentTarget;
  const rect = progressButton.querySelector(".progress-track").getBoundingClientRect();
  const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  seekToPosition(duration * percent, { eventName: "Seek" });
}

function getActiveTrackRows() {
  const activeTrack = state.queue[state.currentTrackIndex];

  if (!activeTrack?.Id) {
    activeTrackRows = [];
    activeTrackRowsTrackId = "";
    activeTrackRowsCacheValid = true;
    return [];
  }

  if (!activeTrackRowsCacheValid || activeTrackRowsTrackId !== activeTrack.Id || activeTrackRows.some((row) => !row.isConnected)) {
    refreshActiveTrackRowsCache(activeTrack.Id);
  }

  return activeTrackRows;
}

function refreshActiveTrackRowsCache(activeTrackId) {
  activeTrackRowsTrackId = activeTrackId || "";
  activeTrackRowsCacheValid = true;
  activeTrackRows = activeTrackId
    ? [...document.querySelectorAll(`.track-row.active[data-track-id="${escapeCssSelectorValue(activeTrackId)}"]`)]
    : [];
}

function stopTrackFluidLoop() {
  if (!trackFluidFrame) {
    return;
  }

  cancelAnimationFrame(trackFluidFrame);
  trackFluidFrame = 0;
}

function updateTrackFluidFrame() {
  trackFluidFrame = 0;

  const activeTrack = state.queue[state.currentTrackIndex];
  const isPlaying = Boolean(activeTrack && !audioPlayer.paused && !audioPlayer.ended);

  if (!isPlaying) {
    trackFluidWidth = 50;
    getActiveTrackRows().forEach((row) => {
      row.style.setProperty("--track-fluid-width", "50%");
    });
    return;
  }

  trackFluidPhase += 0.075;

  const elapsed = Number(audioPlayer.currentTime) || 0;
  const slowWave = Math.sin(trackFluidPhase + elapsed * 1.8) * 0.5 + 0.5;
  const quickWave = Math.sin(trackFluidPhase * 2.45 + elapsed * 4.2) * 0.5 + 0.5;
  const energy = clamp((slowWave * 0.58) + (quickWave * 0.42), 0, 1);
  const targetWidth = 50 + (energy * 10);

  trackFluidWidth += (targetWidth - trackFluidWidth) * 0.18;

  getActiveTrackRows().forEach((row) => {
    row.style.setProperty("--track-fluid-width", `${trackFluidWidth.toFixed(2)}%`);
  });

  trackFluidFrame = requestAnimationFrame(updateTrackFluidFrame);
}

function syncTrackFluidRows(activeTrackId, isPlaying) {
  if (!activeTrackId || !isPlaying) {
    stopTrackFluidLoop();
    trackFluidActiveTrackId = activeTrackId || "";
    trackFluidWidth = 50;
    getActiveTrackRows().forEach((row) => {
      row.style.setProperty("--track-fluid-width", "50%");
    });
    return;
  }

  if (trackFluidActiveTrackId !== activeTrackId) {
    trackFluidActiveTrackId = activeTrackId;
    trackFluidPhase = 0;
    trackFluidWidth = 50;
  }

  if (!trackFluidFrame) {
    trackFluidFrame = requestAnimationFrame(updateTrackFluidFrame);
  }
}

function updateActiveRows() {
  const activeTrack = state.queue[state.currentTrackIndex];
  const isPlaying = Boolean(activeTrack && !audioPlayer.paused && !audioPlayer.ended);
  const nextActiveRows = [];

  document.querySelectorAll(".track-row").forEach((row) => {
    const isActive = Boolean(activeTrack && row.dataset.trackId === activeTrack.Id);
    const index = row.querySelector(".track-index");

    row.classList.toggle("active", isActive);
    row.classList.toggle("playing", isActive && isPlaying);
    row.classList.toggle("paused", isActive && !isPlaying);
    row.setAttribute("aria-current", isActive ? "true" : "false");

    if (!isActive) {
      row.style.removeProperty("--track-fluid-width");
    } else if (!isPlaying) {
      row.style.setProperty("--track-fluid-width", "50%");
    }

    if (isActive) {
      nextActiveRows.push(row);
    }

    if (!index) {
      return;
    }

    if (!isActive) {
      index.textContent = index.dataset.indexLabel || "";
      index.removeAttribute("aria-label");
      return;
    }

    index.textContent = isPlaying ? "▶" : "||";
    index.setAttribute("aria-label", isPlaying ? "正在播放" : "已暂停");
  });

  activeTrackRows = nextActiveRows;
  activeTrackRowsTrackId = activeTrack?.Id || "";
  activeTrackRowsCacheValid = true;
  syncTrackFluidRows(activeTrack?.Id || "", isPlaying);
}

function switchView(view, options = {}) {
  const nextView = viewPanels.some((panel) => panel.dataset.panel === view) ? view : "home";
  const previousView = getActiveView();
  const activeNavigationView = getNavigationView(nextView);
  const isMoreNavigationActive = isMobileMoreNavigationView(activeNavigationView);
  const shouldAutoHideVideo = previousView && previousView !== nextView && !["nowPlaying", "immersivePlayer"].includes(nextView);

  saveViewScrollPosition(previousView);
  hidePlaybackRecovery();

  if (shouldAutoHideVideo && isVideoTrack(state.currentTrack)) {
    state.videoFloatingMode = "hidden";
  }

  viewPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === nextView);
  });

  viewButtons.forEach((button) => {
    const isActive = button.dataset.view === activeNavigationView;
    button.classList.toggle("active", isActive);
    if (button.classList.contains("nav-item") || button.classList.contains("mobile-nav-item")) {
      button.toggleAttribute("aria-current", isActive);
    }
  });
  mobileMoreNavButton.classList.toggle("active", isMoreNavigationActive);
  mobileMoreNavButton.toggleAttribute("aria-current", isMoreNavigationActive);
  document.body.classList.toggle("immersive-player-open", nextView === "immersivePlayer");
  if (previousView === "immersivePlayer" && nextView !== "immersivePlayer") {
    setImmersiveZenMode(false);
  }
  if (nextView !== "library") {
    hideLibraryAlphabetScrubber();
  }
  closeQuickQueue({ restoreFocus: false });

  if (nextView !== "immersivePlayer") {
    closeImmersiveQueue({ restoreFocus: false });
  }

  mountVideoElementForActiveView();

  if (options.updateHash !== false && location.hash.slice(1) !== nextView) {
    history.replaceState(null, "", `#${nextView}`);
  }

  if (nextView === "immersivePlayer" && state.isLyricSynced) {
    updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
  }
  syncLyricProgressLoop();
  restoreViewScrollPosition(nextView, options);
}

function saveActiveViewScrollPosition() {
  saveViewScrollPosition(getActiveView());
}

function saveViewScrollPosition(view) {
  if (!view || !content) {
    return;
  }

  state.viewScrollPositions[view] = content.scrollTop || 0;
}

function restoreViewScrollPosition(view, options = {}) {
  const targetTop = options.resetScroll ? 0 : state.viewScrollPositions[view] || 0;

  requestAnimationFrame(() => {
    content.scrollTop = targetTop;
    requestAnimationFrame(() => {
      content.scrollTop = Math.min(targetTop, Math.max(0, content.scrollHeight - content.clientHeight));
    });
  });
}

function getNavigationView(view) {
  const map = {
    albumDetail: "albums",
    artistDetail: "artists",
    immersivePlayer: "nowPlaying",
    playlistDetail: "playlists",
  };

  return map[view] || view;
}

function isMobileMoreNavigationView(view) {
  return ["playlists", "recent", "albums", "artists", "nowPlaying"].includes(view);
}

function switchViewFromHash() {
  const view = location.hash.slice(1);

  if (viewPanels.some((panel) => panel.dataset.panel === view)) {
    switchView(view, { updateHash: false });
  }
}

async function fetchPublicInfo(serverUrl) {
  return embyApi.fetchPublicInfo(serverUrl);
}

async function authenticate(serverUrl, username, password, deviceName) {
  return embyApi.authenticate(serverUrl, username, password, deviceName);
}

async function fetchPlaybackInfo(track, mode, mediaSourceId) {
  if (isExternalSourceTrack(track)) {
    throw new Error("外部音源使用直链播放，不请求 Emby PlaybackInfo。");
  }

  const profile = getAudioQualityProfile();

  return embyApi.fetchPlaybackInfo(state.session, track, {
    mode,
    mediaSourceId,
    qualityProfile: mode === "universal" ? profile : null,
    transcodeBitrate: profile.bitrate > 0 ? profile.bitrate : undefined,
  });
}

async function embyFetch(session, path, options = {}) {
  return embyApi.fetchJson(session, path, options);
}

function embyPost(path, body) {
  if (isExternalSourceSession()) {
    return;
  }

  embyApi.post(path, body);
}

async function embyRequest(method, path, body) {
  if (isExternalSourceSession()) {
    throw new Error("外部音源模式不支持 Emby 写入操作。");
  }

  return embyApi.request(method, path, body);
}

async function safeEmbyFetch(session, path, fallback) {
  return embyApi.safeFetch(session, path, fallback);
}

function userItemsPath(session, params) {
  return embyApi.userItemsPath(session, params);
}

function toQueryString(params) {
  return embyApi.toQueryString(params);
}

function buildSession(serverUrl, auth, publicInfo, deviceName) {
  return {
    sourceMode: "emby",
    serverUrl,
    deviceName,
    accessToken: auth.AccessToken,
    userId: auth.User?.Id,
    userName: auth.User?.Name,
    serverId: auth.ServerId || publicInfo.Id,
    serverName: publicInfo.ServerName || publicInfo.LocalAddress || "Emby Server",
    version: publicInfo.Version || "-",
    savedAt: new Date().toISOString(),
  };
}

function authorizationHeader(deviceName) {
  const deviceId = getDeviceId();
  const parts = [
    `Client="${escapeHeaderValue(APP_NAME)}"`,
    `Device="${escapeHeaderValue(deviceName)}"`,
    `DeviceId="${escapeHeaderValue(deviceId)}"`,
    `Version="${escapeHeaderValue(APP_VERSION)}"`,
  ];

  return `MediaBrowser ${parts.join(", ")}`;
}

function normalizeServerUrl(value) {
  return embyApi.normalizeServerUrl(value);
}

function normalizeExternalSourceApiUrl(value) {
  return externalSourceApi.normalizeApiUrl(value);
}

function looksLikeSourceBridgeManifestUrl(value) {
  return /\.json(?:$|[?#])/i.test(String(value || "").trim());
}

function reconcileSourceBridgeInputUrls() {
  const rawApiUrl = String(sourceBridgeApiUrlInput?.value || "").trim();
  let manifestUrl = getSourceBridgeManifestUrlFromInputs();
  let apiUrl = normalizeSourceBridgeServiceUrl(rawApiUrl || getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "");
  let movedManifest = false;

  if (looksLikeSourceBridgeManifestUrl(rawApiUrl) || looksLikeSourceBridgeManifestUrl(apiUrl)) {
    manifestUrl = rawApiUrl || apiUrl;
    apiUrl = "";
    movedManifest = true;
    state.externalSourceApiUrl = "";
    state.sourceBridgeManifestUrl = manifestUrl;
    saveExternalSourceApiUrl("");
    saveSourceBridgeManifestUrl(manifestUrl);

    if (sourceBridgeApiUrlInput) {
      sourceBridgeApiUrlInput.value = "";
    }
    if (sourceBridgeManifestUrlInput) {
      sourceBridgeManifestUrlInput.value = manifestUrl;
    }
  } else if (rawApiUrl && isCurrentAppUrl(rawApiUrl)) {
    apiUrl = "";
  }

  return { apiUrl, manifestUrl, movedManifest };
}

function reconcileLoginExternalSourceInput() {
  const rawApiUrl = String(externalSourceApiUrlInput?.value || "").trim();
  let apiUrl = normalizeExternalSourceApiUrl(rawApiUrl || state.externalSourceApiUrl || DEFAULT_EXTERNAL_SOURCE_API_URL || "");
  let movedManifest = false;

  if (looksLikeSourceBridgeManifestUrl(rawApiUrl) || looksLikeSourceBridgeManifestUrl(apiUrl)) {
    const manifestUrl = rawApiUrl || apiUrl;
    apiUrl = "";
    movedManifest = true;
    state.externalSourceApiUrl = "";
    state.sourceBridgeManifestUrl = manifestUrl;
    saveExternalSourceApiUrl("");
    saveSourceBridgeManifestUrl(manifestUrl);

    if (externalSourceApiUrlInput) {
      externalSourceApiUrlInput.value = "";
    }
  }

  return { apiUrl, movedManifest };
}

function getConfiguredServerUrl() {
  return normalizeServerUrl(DEFAULT_SERVER_URL || "");
}

function isServerUrlLocked() {
  return Boolean(LOCK_SERVER_URL && getConfiguredServerUrl());
}

function getLoginServerUrl() {
  const configuredServerUrl = getConfiguredServerUrl();
  return isServerUrlLocked() ? configuredServerUrl : normalizeServerUrl(serverUrlInput.value);
}

function getLoginExternalSourceApiUrl() {
  const value = externalSourceApiUrlInput?.value || state.externalSourceApiUrl || DEFAULT_EXTERNAL_SOURCE_API_URL || "";
  if (looksLikeSourceBridgeManifestUrl(value)) {
    return "";
  }
  return normalizeExternalSourceApiUrl(value);
}

function syncConfiguredServerUrl() {
  if (state.sourceMode === "external") {
    syncLoginSourceMode();
    return;
  }

  const configuredServerUrl = getConfiguredServerUrl();
  const isLocked = isServerUrlLocked();

  if (configuredServerUrl && (isLocked || !serverUrlInput.value)) {
    serverUrlInput.value = configuredServerUrl;
  }

  serverUrlInput.disabled = isLocked;
  serverUrlInput.required = !isLocked;
  serverUrlInput.placeholder = configuredServerUrl || "http://192.168.1.10:8096";

  if (!serverUrlHint) {
    return;
  }

  serverUrlHint.hidden = !configuredServerUrl;
  serverUrlHint.textContent = isLocked
    ? "服务器地址已由部署配置锁定。"
    : "已从部署配置预填服务器地址，可按需修改。";
  syncLoginActionButtons();
}

function getSessionSourceMode(session) {
  return normalizeSourceMode(session?.sourceMode || "emby");
}

function isExternalSourceSession(session = state.session) {
  return getSessionSourceMode(session) === "external";
}

function isExternalSourceTrack(track) {
  return Boolean(track?.ExternalSource || String(track?.Id || "").startsWith("external:"));
}

function getExternalSourceQuality() {
  return getExternalSourceQualityOption().request;
}

function getExternalSourceVideoQuality() {
  return getExternalSourceVideoQualityOption().request;
}

function getExternalPlaybackQuality(track = state.currentTrack) {
  return isVideoTrack(track) ? getExternalSourceVideoQuality() : getExternalSourceQuality();
}

function getExternalPlaybackQualityOption(track = state.currentTrack) {
  return isVideoTrack(track) ? getExternalSourceVideoQualityOption() : getExternalSourceQualityOption();
}

function getExternalSourceQualityOption(optionId = state.externalSourceQualityId) {
  return EXTERNAL_SOURCE_QUALITY_OPTIONS.find((option) => option.id === optionId)
    || EXTERNAL_SOURCE_QUALITY_OPTIONS.find((option) => option.id === DEFAULT_EXTERNAL_SOURCE_QUALITY_ID)
    || EXTERNAL_SOURCE_QUALITY_OPTIONS[0];
}

function getExternalSourceVideoQualityOption(optionId = state.externalSourceVideoQualityId) {
  return EXTERNAL_SOURCE_VIDEO_QUALITY_OPTIONS.find((option) => option.id === optionId)
    || EXTERNAL_SOURCE_VIDEO_QUALITY_OPTIONS.find((option) => option.id === DEFAULT_EXTERNAL_SOURCE_VIDEO_QUALITY_ID)
    || EXTERNAL_SOURCE_VIDEO_QUALITY_OPTIONS[0];
}

function loadExternalSourceQualityId() {
  const saved = String(localStorage.getItem(EXTERNAL_SOURCE_QUALITY_KEY) || "").trim();
  return getExternalSourceQualityOption(saved).id;
}

function saveExternalSourceQualityId(optionId) {
  localStorage.setItem(EXTERNAL_SOURCE_QUALITY_KEY, getExternalSourceQualityOption(optionId).id);
}

function loadExternalSourceVideoQualityId() {
  const saved = String(localStorage.getItem(EXTERNAL_SOURCE_VIDEO_QUALITY_KEY) || "").trim();
  return getExternalSourceVideoQualityOption(saved).id;
}

function saveExternalSourceVideoQualityId(optionId) {
  localStorage.setItem(EXTERNAL_SOURCE_VIDEO_QUALITY_KEY, getExternalSourceVideoQualityOption(optionId).id);
}

function normalizeSourceMode(mode) {
  return SOURCE_MODES.includes(mode) ? mode : "emby";
}

function loadSourceMode() {
  return normalizeSourceMode(localStorage.getItem(SOURCE_MODE_KEY) || "emby");
}

function saveSourceMode(mode) {
  localStorage.setItem(SOURCE_MODE_KEY, normalizeSourceMode(mode));
}

function loadExternalSourceApiUrl() {
  const value = localStorage.getItem(EXTERNAL_SOURCE_API_KEY) || DEFAULT_EXTERNAL_SOURCE_API_URL || "";

  if (looksLikeSourceBridgeManifestUrl(value)) {
    saveSourceBridgeManifestUrl(value);
    localStorage.removeItem(EXTERNAL_SOURCE_API_KEY);
    return "";
  }

  return normalizeExternalSourceApiUrl(value);
}

function getInitialExternalSourceApiUrl(session) {
  const sessionApiUrl = session?.externalSourceApiUrl || "";

  if (looksLikeSourceBridgeManifestUrl(sessionApiUrl)) {
    saveSourceBridgeManifestUrl(sessionApiUrl);
    return loadExternalSourceApiUrl();
  }

  return isUnconfiguredSourceBridgeUrl(sessionApiUrl)
    ? loadExternalSourceApiUrl()
    : (sessionApiUrl || loadExternalSourceApiUrl());
}

function saveExternalSourceApiUrl(apiUrl) {
  const normalizedApiUrl = normalizeExternalSourceApiUrl(apiUrl);

  if (normalizedApiUrl) {
    localStorage.setItem(EXTERNAL_SOURCE_API_KEY, normalizedApiUrl);
  } else {
    localStorage.removeItem(EXTERNAL_SOURCE_API_KEY);
  }
}

function loadSourceBridgeManifestUrl() {
  return String(localStorage.getItem(SOURCE_BRIDGE_MANIFEST_KEY) || "").trim();
}

function saveSourceBridgeManifestUrl(value) {
  const normalized = String(value || "").trim();

  if (normalized) {
    localStorage.setItem(SOURCE_BRIDGE_MANIFEST_KEY, normalized);
  } else {
    localStorage.removeItem(SOURCE_BRIDGE_MANIFEST_KEY);
  }
}

function loadSourceBridgeMusicDir() {
  return String(localStorage.getItem(SOURCE_BRIDGE_MUSIC_DIR_KEY) || "").trim();
}

function saveSourceBridgeMusicDir(value) {
  const normalized = String(value || "").trim();

  if (normalized) {
    localStorage.setItem(SOURCE_BRIDGE_MUSIC_DIR_KEY, normalized);
  } else {
    localStorage.removeItem(SOURCE_BRIDGE_MUSIC_DIR_KEY);
  }
}

function getSessionExternalSourceApiUrl(session = state.session) {
  const value = session?.externalSourceApiUrl || "";
  if (isUnconfiguredSourceBridgeUrl(value) || looksLikeSourceBridgeManifestUrl(value)) {
    return "";
  }

  return normalizeExternalSourceApiUrl(value);
}

function isUnconfiguredSourceBridgeUrl(value) {
  return String(value || "").trim().toLowerCase() === "source-bridge://unconfigured";
}

function buildExternalSourceSession(apiUrl, info = {}) {
  const normalizedApiUrl = normalizeExternalSourceApiUrl(apiUrl);
  const serverUrl = normalizedApiUrl || "source-bridge://unconfigured";

  return {
    sourceMode: "external",
    serverUrl,
    externalSourceApiUrl: normalizedApiUrl,
    deviceName: getDefaultDeviceName(),
    accessToken: "",
    userId: "external-source",
    userName: info.userName || info.user || "外部音源",
    serverId: info.id || info.serverId || "external-source",
    serverName: info.name || info.serverName || info.platform || "音源桥",
    version: info.version || "-",
    savedAt: new Date().toISOString(),
  };
}

function discardSavedSessionForLockedServer() {
  const configuredServerUrl = getConfiguredServerUrl();

  if (!state.session || !isServerUrlLocked() || isSameServerUrl(state.session.serverUrl, configuredServerUrl)) {
    return false;
  }

  storage.clearFilterState(state.session);
  storage.clearSession();
  clearQueueState();
  clearLibraryViewId();
  state.session = null;
  state.queue = [];
  state.currentTrack = null;
  state.currentTrackIndex = -1;
  state.queueUndoSnapshot = null;
  state.recentUndoSnapshot = null;
  resetShufflePlaybackState();
  state.savedPlaybackPositionSeconds = 0;
  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
  return true;
}

function isSameServerUrl(left, right) {
  return normalizeServerUrl(left || "").toLowerCase() === normalizeServerUrl(right || "").toLowerCase();
}

function normalizeItems(items) {
  return Array.isArray(items) ? items.filter((item) => item && item.Id) : [];
}

function normalizePlaylists(items) {
  return normalizeItems(items).filter((item) => {
    return item.Type === "Playlist" && (!item.MediaType || item.MediaType === "Audio");
  });
}

function isAudioItem(item) {
  if (isExternalSourceTrack(item) && isVideoTrack(item)) {
    return true;
  }

  return item?.Type === "Audio" || item?.MediaType === "Audio";
}

function getImageUrl(item, maxWidth) {
  if (isExternalSourceTrack(item)) {
    return item?.ExternalSource?.artwork || "";
  }

  return embyApi.getImageUrl(state.session, item, maxWidth);
}

function getTrackImageUrl(track, maxWidth) {
  if (isExternalSourceTrack(track)) {
    return track?.ExternalSource?.artwork || "";
  }

  return embyApi.getTrackImageUrl(state.session, track, maxWidth);
}

function getAudioStreamUrl(track, mode = "direct", playSessionId = state.currentPlaySessionId, mediaSourceId = state.currentMediaSourceId) {
  if (isExternalSourceTrack(track)) {
    return track?.ExternalSource?.mediaUrl || "";
  }

  return embyApi.getAudioStreamUrl(state.session, track, mode, getAudioQualityProfile(), playSessionId, mediaSourceId);
}

function hasPrimaryImage(item) {
  return embyApi.hasPrimaryImage(item);
}

function appendImage(container, src, alt) {
  if (!src) {
    return;
  }

  const image = document.createElement("img");
  image.alt = alt || "";
  image.loading = "lazy";
  image.decoding = "async";
  image.classList.add("is-loading");
  container.classList.add("is-image-loading");

  const markLoaded = () => {
    image.classList.remove("is-loading");
    image.classList.add("is-loaded");
    container.classList.remove("is-image-loading");
  };

  image.addEventListener("load", markLoaded, { once: true });
  image.addEventListener("error", () => {
    container.classList.remove("is-image-loading");
    image.remove();
  }, { once: true });
  image.src = src;

  if (image.complete && image.naturalWidth > 0) {
    markLoaded();
  }

  container.append(image);
}

function getTrackQualitySummary(track) {
  if (isExternalSourceTrack(track)) {
    return getExternalTrackQualitySummary(track);
  }

  const source = getPrimaryMediaSource(track);
  const stream = getPrimaryAudioStream(source);
  const codec = normalizeCodecLabel(stream?.Codec || source?.AudioCodec || source?.Container);
  const bitrate = Number(stream?.BitRate || stream?.Bitrate || source?.BitRate || source?.Bitrate || 0);
  const bitDepth = Number(stream?.BitDepth || source?.BitDepth || 0);
  const sampleRate = Number(stream?.SampleRate || source?.SampleRate || 0);
  const channels = Number(stream?.Channels || source?.Channels || 0);
  const isLossless = isLosslessCodec(codec);
  const qualityTier = getTrackQualityTier({ codec, bitrate, bitDepth, sampleRate, isLossless });
  const shortLabel = buildShortQualityLabel(codec, bitrate, bitDepth, isLossless);
  const details = [
    codec,
    bitDepth > 0 ? `${bitDepth}bit` : "",
    sampleRate > 0 ? `${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz` : "",
    channels > 0 ? `${channels}ch` : "",
    formatBitrate(bitrate),
  ].filter(Boolean);

  if (!shortLabel && !details.length) {
    return null;
  }

  return {
    codec,
    isLossless,
    qualityTier,
    shortLabel: shortLabel || details[0],
    detailLabel: details.join(" · ") || shortLabel,
  };
}

function getExternalTrackQualitySummary(track) {
  const source = getPrimaryMediaSource(track);
  const stream = getPrimaryAudioStream(source);
  const external = track?.ExternalSource || {};
  const mediaKind = normalizeExternalMediaKind(external.mediaKind || source.MediaKind || stream.Type);
  const qualityState = external.qualityState || "";

  if (external.qualityVerified === false && !qualityState) {
    return null;
  }

  if (qualityState === "resolving") {
    return {
      codec: "",
      isLossless: false,
      isVideo: mediaKind === "video",
      qualityTier: "checking",
      shortLabel: "检测中",
      detailLabel: "正在向音源桥解析真实音质",
    };
  }

  if (qualityState === "unknown") {
    return {
      codec: "",
      isLossless: false,
      isVideo: mediaKind === "video",
      qualityTier: "unknown",
      shortLabel: mediaKind === "video" ? "MV 未标注" : "源站未标注",
      detailLabel: "音源桥已解析播放地址，但源站没有返回真实音质字段",
    };
  }

  const codec = normalizeCodecLabel(stream?.Codec || source?.AudioCodec || source?.Container || external.codec);
  const bitrate = Number(stream?.BitRate || stream?.Bitrate || source?.BitRate || source?.Bitrate || external.bitrate || 0);
  const maxQuality = inferExternalSearchMaxQuality(track, mediaKind);
  const resolution = normalizeQualityText(maxQuality.resolution || external.resolution || source.Resolution);
  const sourceQuality = normalizeQualityText(external.sourceQuality || source.SourceQuality);
  const qualityLabel = normalizeExternalQualityLabel(external.qualityLabel || source.QualityLabel, {
    mediaKind,
    resolution,
    codec,
    bitrate,
    sourceQuality,
  });
  const isVideo = mediaKind === "video";
  const isLossless = !isVideo && (isLosslessCodec(codec) || /(hi[\s-]?res|lossless|flac|sq|无损|母带|master)/i.test(`${sourceQuality} ${qualityLabel} ${maxQuality.qualityLabel}`));
  const shortLabel = isVideo
    ? ["MV", resolution || qualityLabel.replace(/^mv\s*/i, "")].filter(Boolean).join(" ")
    : (qualityLabel || maxQuality.qualityLabel || buildShortQualityLabel(codec, bitrate, 0, isLossless) || sourceQuality || codec);

  if (!isVideo && !qualityLabel && !sourceQuality && !codec && !bitrate) {
    return null;
  }

  const qualityTier = isVideo
    ? "video"
    : getExternalQualityTier({ codec, bitrate, isLossless, sourceQuality, qualityLabel });
  const detailParts = [
    external.platform || "音源桥",
    isVideo ? "MV" : "源站音质",
    resolution,
    qualityLabel && qualityLabel !== shortLabel ? qualityLabel : "",
    codec && codec !== "VIDEO" ? codec : "",
    formatBitrate(bitrate),
  ].filter(Boolean);

  if (!shortLabel && !detailParts.length) {
    return null;
  }

  return {
    codec,
    isLossless,
    isVideo,
    qualityTier,
    shortLabel: shortLabel || detailParts[0],
    detailLabel: detailParts.join(" · ") || shortLabel,
  };
}

function inferExternalSearchMaxQuality(track, mediaKind) {
  const external = track?.ExternalSource || {};
  const source = getPrimaryMediaSource(track);
  const text = [
    external.resolution,
    external.sourceQuality,
    external.qualityLabel,
    source.Resolution,
    source.SourceQuality,
    source.QualityLabel,
    external.raw,
  ].map(stringifyQualityValue).filter(Boolean).join(" ").toLowerCase();

  if (mediaKind === "video") {
    const resolution = inferResolutionFromQualityText(text);
    return {
      resolution,
      qualityLabel: ["MV", resolution || (/mv|video|视频|音乐视频/.test(text) ? "视频" : "")].filter(Boolean).join(" "),
    };
  }

  if (/(hi[\s-]?res|hires|24bit|24\s*bit|母带|master)/.test(text)) {
    return { resolution: "", qualityLabel: "Hi-Res" };
  }

  if (/(lossless|flac|alac|wav|ape|无损|sq)/.test(text)) {
    return { resolution: "", qualityLabel: /flac/.test(text) ? "FLAC" : "SQ" };
  }

  const bitrates = [...text.matchAll(/\b(128|192|256|320|384)\s*k(?:bps)?\b/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  if (bitrates.length) {
    return { resolution: "", qualityLabel: `${Math.max(...bitrates)}k` };
  }

  if (/(hq|高品|高音质)/.test(text)) {
    return { resolution: "", qualityLabel: "HQ" };
  }

  return { resolution: "", qualityLabel: "" };
}

function inferResolutionFromQualityText(text) {
  const normalized = String(text || "").toLowerCase();

  if (/(4k|2160p|uhd)/.test(normalized)) {
    return "4K";
  }

  const match = normalized.match(/\b(1440|1080|720|540|480|360|240)\s*p?\b/);
  return match ? `${match[1]}P` : "";
}

function stringifyQualityValue(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isVideoTrack(track) {
  if (!track) {
    return false;
  }

  const source = getPrimaryMediaSource(track);
  const streams = Array.isArray(source.MediaStreams) ? source.MediaStreams : [];
  const external = track.ExternalSource || {};
  const sourceUrl = external.mediaUrl || source.Path || source.DirectStreamUrl || "";
  const mediaKind = normalizeExternalMediaKind(external.mediaKind || source.MediaKind || source.MediaType || track.MediaType);

  return Boolean(
    external.isVideo
      || mediaKind === "video"
      || track.Type === "Video"
      || streams.some((stream) => stream?.Type === "Video")
      || /\.(mp4|m4v|mov|webm|mkv|avi|flv|ts)(?:[?#].*)?$/i.test(sourceUrl)
  );
}

function normalizeExternalMediaKind(value) {
  const mediaKind = String(value || "").trim().toLowerCase();
  return /^(video|mv)$/.test(mediaKind) ? "video" : "audio";
}

function normalizeQualityText(value) {
  return String(value || "").trim();
}

function normalizeExternalQualityLabel(value, context = {}) {
  const raw = normalizeQualityText(value);
  const lower = raw.toLowerCase();

  if (context.mediaKind === "video") {
    return ["MV", context.resolution || raw.replace(/^mv\s*/i, "")].filter(Boolean).join(" ");
  }

  if (/(hi[\s-]?res|hires|母带|master)/.test(lower)) {
    return "Hi-Res";
  }

  if (/(lossless|flac|无损|sq)/.test(lower)) {
    return context.codec && context.codec !== "MP3" ? context.codec : "SQ";
  }

  const bitrate = lower.match(/\b(128|192|256|320|384)\s*k(?:bps)?\b/);

  if (bitrate) {
    return `${bitrate[1]}k`;
  }

  if (/(hq|高品|高音质)/.test(lower)) {
    return "HQ";
  }

  if (raw) {
    return raw;
  }

  if (Number(context.bitrate) > 0) {
    return `${Math.round(Number(context.bitrate) / 1000)}k`;
  }

  return context.sourceQuality || "";
}

function hasExternalResolvedQuality(context = {}) {
  const mediaKind = normalizeExternalMediaKind(context.mediaKind);

  if (mediaKind === "video") {
    return Boolean(context.resolution || context.qualityLabel || context.bitrate || (context.codec && context.codec !== "VIDEO"));
  }

  return Boolean(
    context.qualityLabel
      || context.sourceQuality
      || context.bitrate
      || (context.codec && !["AUDIO", "MUSIC", "SONG", "TRACK", "UNKNOWN"].includes(String(context.codec).toUpperCase()))
  );
}

function getExternalQualityTier({ codec, bitrate, isLossless, sourceQuality, qualityLabel }) {
  const text = `${sourceQuality || ""} ${qualityLabel || ""}`.toLowerCase();

  if (isLossless || /(hi[\s-]?res|hires|lossless|sq|无损|母带|master)/.test(text)) {
    return "source-lossless";
  }

  if (Number(bitrate) >= 300000 || /(hq|高品|高音质|320|384)/.test(text)) {
    return "source-high";
  }

  if (codec) {
    return "source-standard";
  }

  return "standard";
}

function getTrackQualityTier({ codec, bitDepth, sampleRate, isLossless }) {
  if (isLossless && (bitDepth >= 24 || sampleRate >= 88200 || codec === "DSD")) {
    return "master";
  }

  if (isLossless) {
    return "hires";
  }

  return "standard";
}

function getCollectionQualitySummary(tracks) {
  const summaries = tracks.map(getTrackQualitySummary).filter(Boolean);

  if (!summaries.length) {
    return "";
  }

  const codecs = [];
  summaries.forEach((summary) => {
    const codec = summary.codec || summary.shortLabel;
    if (codec && !codecs.includes(codec)) {
      codecs.push(codec);
    }
  });

  const label = codecs.slice(0, 3).join(" / ");
  const suffix = codecs.length > 3 ? ` +${codecs.length - 3}` : "";
  const lossless = summaries.some((summary) => summary.isLossless) ? " · 含无损" : "";

  return `${label}${suffix}${lossless}`;
}

function getPlaybackMetaItems(track) {
  if (!track) {
    return [];
  }

  const quality = getTrackQualitySummary(track);
  const items = [];
  const isExternal = isExternalSourceTrack(track);

  if (quality) {
    items.push({
      label: quality.shortLabel,
      title: quality.detailLabel,
      tone: quality.isLossless ? "lossless" : "",
    });
  }

  items.push({
    label: getPlaybackSourceBadgeLabel(track),
    title: `当前播放源：${getCurrentPlaybackSourceLabel()}`,
    tone: isExternal ? "direct" : (state.currentPlaybackMode === "universal" ? "transcode" : "direct"),
  });

  if (isExternal) {
    const option = getExternalPlaybackQualityOption(track);
    items.push({
      label: isVideoTrack(track) ? `清晰度：${option.shortLabel}` : `策略：${option.label}`,
      title: isVideoTrack(track) ? `音乐桥视频清晰度：${option.quality}` : `音乐桥源站策略：${option.quality}`,
      tone: "policy",
    });
  } else {
    items.push({
      label: `策略：${PLAYBACK_STREAM_SHORT_LABELS[state.playbackStreamPolicy] || state.playbackStreamPolicy}`,
      title: PLAYBACK_STREAM_LABELS[state.playbackStreamPolicy] || state.playbackStreamPolicy,
      tone: "policy",
    });
  }

  return items;
}

function getPlaybackSourceBadgeLabel(track = state.currentTrack) {
  if (isExternalSourceTrack(track)) {
    return isVideoTrack(track) ? "音乐桥 MV" : "音乐桥";
  }

  const profile = getAudioQualityProfile();

  return state.currentPlaybackMode === "universal"
    ? `${profile.codec} ${profile.bitrate ? Math.round(profile.bitrate / 1000) : ""}k`.trim()
    : "直连";
}

function getPrimaryMediaSource(track) {
  return track?.MediaSources?.[0] || {};
}

function getPrimaryAudioStream(source) {
  return source?.MediaStreams?.find((stream) => stream?.Type === "Audio")
    || source?.MediaStreams?.find((stream) => stream?.Codec || stream?.BitRate || stream?.SampleRate)
    || {};
}

function normalizeCodecLabel(value) {
  const codec = String(value || "")
    .split(",")[0]
    .trim()
    .toUpperCase();
  const labels = {
    MPEG4: "AAC",
    MP4A: "AAC",
    VORBIS: "OGG",
    PCM_S16LE: "PCM",
    PCM_S24LE: "PCM",
  };

  return labels[codec] || codec;
}

function isLosslessCodec(codec) {
  return ["FLAC", "ALAC", "WAV", "PCM", "APE", "DSD"].includes(codec);
}

function buildShortQualityLabel(codec, bitrate, bitDepth, isLossless) {
  if (!codec && !bitrate) {
    return "";
  }

  if (isLossless) {
    return bitDepth > 0 ? `${codec} ${bitDepth}bit` : codec;
  }

  const shortBitrate = bitrate > 0 ? `${Math.round(bitrate / 1000)}k` : "";
  return [codec, shortBitrate].filter(Boolean).join(" ");
}

function getArtists(item) {
  if (Array.isArray(item.Artists) && item.Artists.length) {
    return item.Artists.join(" / ");
  }

  if (Array.isArray(item.ArtistItems) && item.ArtistItems.length) {
    return item.ArtistItems.map((artist) => artist.Name).filter(Boolean).join(" / ");
  }

  return item.AlbumArtist || "";
}

function getAlbumSubtitle(album) {
  const artist = getArtists(album) || album.AlbumArtist;
  const year = album.ProductionYear;

  return [artist, year].filter(Boolean).join(" · ") || "Album";
}

function getPlaylistSubtitle(playlist) {
  const count = playlist.ChildCount || playlist.SongCount || playlist.ItemCount;

  return count ? `${formatCount(count)} 首歌曲` : "Playlist";
}

function getArtistSubtitle(artist) {
  const tracks = getLocalArtistTracks(artist).length;
  const albums = getLocalArtistAlbums(artist).length;

  return [
    tracks ? `${formatCount(tracks)} 首歌曲` : "",
    albums ? `${formatCount(albums)} 张专辑` : "",
  ].filter(Boolean).join(" · ") || "Artist";
}

function loadingMarkup(text) {
  return `<div class="loading-state">${escapeHtml(text)}</div>`;
}

function homeTrackSkeletonMarkup(text) {
  const rows = Array.from({ length: 4 }, (_, index) => `
    <div class="home-track-skeleton-row" aria-hidden="true">
      <span class="home-track-skeleton-index"></span>
      <span class="home-track-skeleton-cover"></span>
      <span class="home-track-skeleton-copy">
        <span class="home-track-skeleton-line title"></span>
        <span class="home-track-skeleton-line meta"></span>
      </span>
      <span class="home-track-skeleton-duration"></span>
      <span class="home-track-skeleton-actions">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </div>
  `.trim()).join("");

  return `<div class="home-track-skeleton-list" role="status" aria-live="polite" aria-label="${escapeHtml(text)}">${rows}<span class="sr-only">${escapeHtml(text)}</span></div>`;
}

function emptyMarkup(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function createEmptyState(text, actions = []) {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const label = document.createElement("p");
  label.textContent = text;
  empty.append(label);

  const availableActions = actions.filter((action) => typeof action?.handler === "function");
  if (availableActions.length) {
    const actionGroup = document.createElement("div");
    actionGroup.className = "empty-actions";

    availableActions.slice(0, 2).forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "text-button";
      button.textContent = action.label;
      button.addEventListener("click", action.handler);
      actionGroup.append(button);
    });

    empty.append(actionGroup);
  }

  return empty;
}

function showLogin() {
  syncLoginSourceMode();
  syncConfiguredServerUrl();
  loginView.hidden = false;
  mainView.hidden = true;
}

function showMain() {
  loginView.hidden = true;
  mainView.hidden = false;
}

function setBusy(isBusy) {
  state.isConnecting = isBusy;
  syncLoginActionButtons();
}

function setTestServerBusy(isBusy) {
  state.isTestingServer = isBusy;
  syncLoginActionButtons();
}

function syncLoginActionButtons() {
  const isExternal = state.sourceMode === "external";
  const hasServerUrl = Boolean(isExternal ? getLoginExternalSourceApiUrl() : getLoginServerUrl());
  connectButton.disabled = state.isConnecting || state.isTestingServer;
  testServerButton.disabled = state.isConnecting || state.isTestingServer || !hasServerUrl;
  connectButton.querySelector("span").textContent = state.isConnecting
    ? "连接中..."
    : (isExternal ? "连接音源桥" : "连接 Emby");
  testServerButton.querySelector("span").textContent = state.isTestingServer
    ? "测试中..."
    : (isExternal ? "测试音源桥" : "测试服务器");
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

function setLibraryStatus(text) {
  clearStatusDismissTimer();
  libraryStatus.textContent = text;

  if (!text) {
    hideNotice();
    return;
  }

  if (shouldAutoDismissStatus(text)) {
    scheduleStatusDismiss(text);
  }
}

function showNotice(text, options = {}) {
  clearNoticeDismissTimer();
  clearStatusDismissTimer();
  appNoticeText.textContent = text;
  appNotice.className = `app-notice ${options.type || ""}`.trim();
  appNoticeActions.replaceChildren();
  const actions = options.actions || [];

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      if (action.dismiss !== false) {
        hideNotice();
      }
      action.handler();
    });
    appNoticeActions.append(button);
  });

  appNotice.hidden = false;
  libraryStatus.textContent = text;

  if (!actions.length && options.autoDismiss !== false && shouldAutoDismissNotice(options)) {
    noticeDismissTimer = window.setTimeout(() => {
      if (appNoticeText.textContent === text) {
        hideNotice();
      }
    }, Number(options.autoDismissMs) || AUTO_DISMISS_NOTICE_MS);
  }
}

function hideNotice() {
  clearNoticeDismissTimer();
  const noticeText = appNoticeText.textContent;
  appNotice.hidden = true;
  appNoticeText.textContent = "";
  appNoticeActions.replaceChildren();

  if (noticeText && libraryStatus.textContent === noticeText) {
    libraryStatus.textContent = "";
  }
}

function scheduleStatusDismiss(text) {
  statusDismissTimer = window.setTimeout(() => {
    if (libraryStatus.textContent === text && appNotice.hidden) {
      libraryStatus.textContent = "";
    }
  }, AUTO_DISMISS_STATUS_MS);
}

function clearStatusDismissTimer() {
  if (statusDismissTimer) {
    window.clearTimeout(statusDismissTimer);
    statusDismissTimer = null;
  }
}

function clearNoticeDismissTimer() {
  if (noticeDismissTimer) {
    window.clearTimeout(noticeDismissTimer);
    noticeDismissTimer = null;
  }
}

function shouldAutoDismissStatus(text) {
  const value = String(text || "");

  if (!value) {
    return false;
  }

  if (/正在|加载中|检测中|添加中|重试|失败|错误|阻止|不可用|离线|登录|连接/.test(value)) {
    return false;
  }

  return true;
}

function shouldAutoDismissNotice(options = {}) {
  return !["error", "warning"].includes(options.type);
}

function setBadge(type, text) {
  connectionBadge.className = `status-badge ${type}`;
  connectionBadge.querySelector("strong").textContent = text;
  accountMenuButton.dataset.status = type;
  accountMenuButton.title = text;
}

function saveSession(session) {
  storage.saveSession(session);
  storage.saveAccountProfile(session);
  renderSavedAccounts();
  renderAccountMenuSavedAccounts();
}

function loadSession() {
  return storage.loadSession();
}

function loadRecentTracks(session) {
  return storage.loadRecentTracks(session);
}

function loadFilterState(session) {
  return storage.loadFilterState(session);
}

function loadLibraryViewId(session) {
  return storage.loadLibraryViewId(session);
}

function saveLibraryViewId(viewId) {
  storage.saveLibraryViewId(state.session, viewId);
}

function clearLibraryViewId() {
  storage.clearLibraryViewId(state.session);
}

function loadQueueState(session) {
  return storage.loadQueueState(session);
}

function loadPlayMode() {
  return storage.loadPlayMode();
}

function loadPlaybackStreamPolicy() {
  return storage.loadPlaybackStreamPolicy();
}

function loadPlaybackPreloadEnabled() {
  return storage.loadPlaybackPreloadEnabled?.() ?? true;
}

function loadPlaybackLosslessPrecacheEnabled() {
  return storage.loadPlaybackLosslessPrecacheEnabled?.() ?? false;
}

function loadSortKey() {
  return storage.loadSortKey();
}

function loadSortOrder() {
  return storage.loadSortOrder();
}

function loadTrackDensity() {
  return storage.loadTrackDensity();
}

function loadPlayerMetaTarget() {
  return storage.loadPlayerMetaTarget();
}

function loadAudioQualityProfile() {
  return storage.loadAudioQualityProfile();
}

function loadTranscodeBitrate() {
  return storage.loadTranscodeBitrate();
}

function loadVolume() {
  return storage.loadVolume();
}

function saveRecentTracks() {
  storage.saveRecentTracks(state.session, state.recentTracks);
}

function persistPlaybackPosition(options = {}) {
  if (!state.session || !state.queue.length || !state.currentTrack) {
    return;
  }

  const positionSeconds = getQueuePositionSeconds();
  const durationSeconds = getTrackDurationSeconds(state.currentTrack);

  if (!options.force) {
    const now = Date.now();
    const positionDelta = Math.abs(positionSeconds - Number(state.lastQueuePositionSaveSeconds || 0));
    if (
      now - Number(state.lastQueuePositionSaveAt || 0) < PLAYBACK_POSITION_SAVE_INTERVAL_MS
      && positionDelta < PLAYBACK_POSITION_SAVE_EPSILON_SECONDS
    ) {
      return;
    }
  }

  if (durationSeconds && positionSeconds >= durationSeconds - 1) {
    saveQueueState(0);
    return;
  }

  saveQueueState(positionSeconds);
}

function saveQueueState(positionSeconds) {
  if (!state.session || !state.queue.length) {
    clearQueueState();
    return;
  }

  const currentTrack = state.currentTrack || state.queue[state.currentTrackIndex] || state.queue[0];
  const currentTrackIndex = currentTrack
    ? state.queue.findIndex((track) => track.Id === currentTrack.Id)
    : -1;
  const savedPositionSeconds = Number.isFinite(Number(positionSeconds))
    ? Math.max(0, Number(positionSeconds))
    : getQueuePositionSeconds();
  state.queueSavedAt = new Date().toISOString();
  state.savedPlaybackPositionSeconds = savedPositionSeconds;
  state.lastQueuePositionSaveAt = Date.now();
  state.lastQueuePositionSaveSeconds = savedPositionSeconds;

  storage.saveQueueState({
    session: state.session,
    queue: state.queue.map(sanitizeQueueTrack),
    currentTrackId: currentTrack?.Id || "",
    currentTrackIndex: currentTrackIndex >= 0 ? currentTrackIndex : 0,
    positionSeconds: savedPositionSeconds,
  });
  renderHomeStartPanel();
}

function clearQueueState() {
  storage.clearQueueState(state.session);
  state.queueSavedAt = "";
  renderHomeStartPanel();
}

function getQueuePositionSeconds() {
  if (Number.isFinite(audioPlayer.currentTime) && audioPlayer.currentTime > 0) {
    return audioPlayer.currentTime;
  }

  return state.savedPlaybackPositionSeconds || 0;
}

function sanitizeQueueTrack(track) {
  return {
    Id: track.Id,
    Type: track.Type,
    Name: track.Name,
    Album: track.Album,
    AlbumId: track.AlbumId,
    AlbumArtist: track.AlbumArtist,
    AlbumArtists: track.AlbumArtists,
    ArtistItems: track.ArtistItems,
    Artists: track.Artists,
    DateCreated: track.DateCreated,
    Genres: track.Genres,
    ImageTags: track.ImageTags,
    IndexNumber: track.IndexNumber,
    MediaSources: track.MediaSources,
    MediaType: track.MediaType,
    ParentIndexNumber: track.ParentIndexNumber,
    PrimaryImageAspectRatio: track.PrimaryImageAspectRatio,
    ProductionYear: track.ProductionYear,
    RunTimeTicks: track.RunTimeTicks,
    SortName: track.SortName,
    UserData: track.UserData,
    ExternalSource: track.ExternalSource,
  };
}

function clearSession() {
  closeAccountMenu();
  saveQueueState();
  reportPlaybackStopped();
  storage.clearSession();
  state.session = null;
  state.playRequestId += 1;
  state.currentTrack = null;
  state.views = [];
  state.libraryViewId = "";
  state.genreFilter = "";
  state.yearFilter = "";
  state.qualityFilter = "";
  state.favoriteFilter = "";
  state.availableGenres = [];
  state.availableYears = [];
  state.availableQualities = [];
  state.currentPlaybackMode = "direct";
  state.currentMediaSourceId = "";
  state.currentPlaySessionId = "";
  state.hasReportedPlaybackStart = false;
  state.isChangingTrack = false;
  state.fallbackAttempted = false;
  state.qualityFallbackAttempted = false;
  state.lastPlaybackError = "";
  audioPlayer.pause();
  unloadAudioSource();
  clearPreload();
  clearSleepTimer({ announce: false });
  state.queue = [];
  state.currentTrackIndex = -1;
  state.queueUndoSnapshot = null;
  state.recentUndoSnapshot = null;
  resetShufflePlaybackState();
  state.savedPlaybackPositionSeconds = 0;
  state.selectedAlbum = null;
  state.albumTracks = [];
  state.selectedArtist = null;
  state.artistTracks = [];
  state.artistAlbums = [];
  state.selectedPlaylist = null;
  state.playlistTracks = [];
  resetPlayerMeta();
  renderQueue();
  setPlayerEnabled(false);
  searchInput.value = "";
  searchInput.disabled = true;
  libraryViewSelect.value = "";
  libraryViewSelect.disabled = true;
  genreSelect.value = "";
  genreSelect.disabled = true;
  yearSelect.value = "";
  yearSelect.disabled = true;
  qualitySelect.value = "";
  qualitySelect.disabled = true;
  favoriteFilterSelect.value = "";
  clearSearchButton.disabled = true;
  refreshButton.disabled = true;
  shuffleButton.disabled = true;
  passwordInput.value = "";
  syncConfiguredServerUrl();
  renderSession({});
  setBadge("idle", "未连接");
  setMessage("已退出当前账号，保存账号和本地队列仍保留。");
  renderSavedAccounts();
  closeSearchSuggestions();
  showLogin();
}

function getDeviceId() {
  return storage.getDeviceId();
}

function getDefaultDeviceName() {
  return storage.getDefaultDeviceName();
}

function isBenignPlaybackInterruption(error) {
  const message = readableError(error).toLowerCase();

  return error?.name === "AbortError"
    || message.includes("interrupted by a new load request")
    || message.includes("interrupted by a call to pause")
    || message.includes("the play() request was interrupted");
}

function isAutoplayBlockedError(error) {
  const message = readableError(error).toLowerCase();

  return error?.name === "NotAllowedError"
    || message.includes("user didn't interact")
    || message.includes("user did not interact")
    || message.includes("play() failed because the user")
    || message.includes("not allowed by the user agent")
    || message.includes("request is not allowed");
}

function readableError(error) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}
