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
  LYRICS_SOURCE_BRIDGE_API_KEY = "emby-music-web/lyrics-source-bridge-api-url",
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
const redact = window.EmbyMusicRedact || {
  redactServer: (value) => String(value || ""),
  redactText: (value) => String(value || ""),
  redactToken: (value) => String(value || ""),
  redactUrl: (value) => String(value || ""),
};
const {
  appendEmpty,
  appendLoading,
  setStaticMarkup,
} = window.EmbyMusicDomHelpers;
const {
  bridge: bridgeOps,
  library: libraryOps,
  player: playerOps,
  queue: queueOps,
  search: searchOps,
  settings: settingsOps,
  store: storeOps,
} = window.EmbyMusicModules;
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
const LYRIC_USER_SCROLL_SUPPRESS_MS = 3200;
const LYRIC_WORD_MIN_LINE_DURATION_SECONDS = 1.8;
const LYRIC_WORD_MAX_LINE_DURATION_SECONDS = 14;
const LYRIC_WORD_ESTIMATED_DURATION_SECONDS = 0.48;
const LYRIC_WORD_CHARACTER_ESTIMATED_DURATION_SECONDS = 0.2;
const LYRIC_TIMED_WORD_MIN_DURATION_SECONDS = 0.16;
const LYRIC_TIMED_WORD_MAX_DURATION_SECONDS = 3.2;
const LYRIC_TIMED_WORD_MIN_STEP_SECONDS = 0.08;
const LYRIC_PROGRESS_RESUME_LEAD_MS = 220;
const LYRIC_PROGRESS_IDLE_MIN_DELAY_MS = 300;
const LYRIC_CLOCK_RESYNC_THRESHOLD_SECONDS = 0.08;
const LYRIC_CLOCK_HARD_RESYNC_THRESHOLD_SECONDS = 0.45;
const LYRIC_CLOCK_DRIFT_CORRECTION_RATIO = 0.35;
const TOP_LYRIC_SHARD_MIN_COUNT = 16;
const TOP_LYRIC_SHARD_MAX_COUNT = 22;
const TOP_LYRIC_SHARD_PADDING = 24;
const TOP_LYRIC_SHARD_DRAG = 0.972;
const TOP_LYRIC_SHARD_GRAVITY = 0.034;
const TOP_LYRIC_SHARD_FADE = 0.026;
const TOP_LYRIC_SHARD_MAX_DPR = 2;
const TOP_LYRIC_SHARD_MAX_FRAME_TRIGGERS = 1;
const TOP_LYRIC_SHARD_MAX_ACTIVE_EFFECTS = 12;
const TOP_LYRIC_SHARD_CATCHUP_ALIGN_SECONDS = 0.32;
const TOP_LYRIC_SHARD_FLASH_FADE = 0.68;
const TOP_LYRIC_SHARD_DEFAULT_COLOR = "rgba(236, 65, 65, 0.96)";
const TOP_LYRIC_SHARD_ACCENT_COLOR = "rgba(255, 126, 96, 0.88)";
const TOP_LYRIC_SHARD_GLOW_COLOR = "rgba(236, 65, 65, 0.55)";
const TOPBAR_LYRIC_DISPLAY_ENABLED = true;
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
const LYRIC_SETTINGS_KEY = "emby-music-web/lyric-settings";
const IMMERSIVE_PLAYER_STYLE_KEY = "emby-music-web/immersive-player-style";
const DEFAULT_LYRIC_OFFSET_SECONDS = 0.18;
const LYRIC_OFFSET_STEP_SECONDS = 0.1;
const MIN_LYRIC_OFFSET_SECONDS = -2;
const MAX_LYRIC_OFFSET_SECONDS = 2;
const PLAYLIST_TRACK_PAGE_SIZE = 500;
const DEFAULT_LYRIC_SETTINGS = Object.freeze({
  fontScale: 1,
  fontFamily: "system",
  letterSpacing: 0,
  autoScroll: true,
  autoImmersiveLyrics: false,
});
const LYRIC_FONT_FAMILY_OPTIONS = Object.freeze([
  { id: "system", label: "系统默认", detail: "跟随设备字体" },
  { id: "rounded", label: "柔和圆体", detail: "更适合大字号歌词" },
  { id: "serif", label: "温润衬线", detail: "阅读感更安静" },
  { id: "mono", label: "等宽歌词", detail: "节奏分隔更清楚" },
]);
const LYRIC_FONT_FAMILY_MAP = Object.freeze({
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  rounded: '"SF Pro Rounded", "HarmonyOS Sans SC", "MiSans", "Microsoft YaHei UI", system-ui, sans-serif',
  serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", Georgia, serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
});
const IMMERSIVE_PLAYER_THEME_OPTIONS = Object.freeze([
  { id: "original", label: "原始封面" },
  { id: "fluid", label: "流体光雾" },
  { id: "stage", label: "舞台暖光" },
]);
const IMMERSIVE_VISUALIZER_STYLE_OPTIONS = Object.freeze([
  { id: "wave", label: "暖白长波" },
  { id: "ribbon", label: "柔光丝带" },
  { id: "pulse", label: "低频脉冲" },
]);
const DEFAULT_IMMERSIVE_PLAYER_STYLE = Object.freeze({
  theme: "original",
  visualizer: "wave",
});
const initialImmersivePlayerStyle = loadImmersivePlayerStyle();
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
const IMMERSIVE_MORE_PLAYBACK_DISPLAY_KEY = "emby-music-web/immersive-more-playback-display";
const PLAYBACK_DISPLAY_DEFAULTS = {
  volumeLeveling: false,
  backgroundMix: false,
  fadeInOut: false,
  smartTransition: true,
  soundEffect: "none",
  playbackRate: 1,
};
const PLAYBACK_DISPLAY_SOUND_EFFECTS = [
  { id: "none", label: "原始" },
  { id: "warm", label: "暖声" },
  { id: "vocal", label: "人声" },
  { id: "night", label: "夜间" },
  { id: "bass", label: "低频" },
];
const PLAYBACK_DISPLAY_RATE_OPTIONS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];
const AUTO_DISMISS_STATUS_MS = 1800;
const AUTO_DISMISS_NOTICE_MS = 1800;
const PLAYBACK_PRELOAD_CACHE_NAME = "emby-music-web-playback-preload";
const MAX_PLAYBACK_PRECACHE_BYTES = 32 * 1024 * 1024;
const PLAYBACK_POSITION_SAVE_INTERVAL_MS = 5000;
const PLAYBACK_POSITION_SAVE_EPSILON_SECONDS = 2;
const LISTEN_TIME_TOTAL_KEY = "emby-music-web/listen-time-total-seconds";
const LISTEN_TIME_SAVE_INTERVAL_SECONDS = 5;
const EXTERNAL_SEARCH_QUALITY_RESOLVE_LIMIT = 24;
const EXTERNAL_SEARCH_QUALITY_RESOLVE_CONCURRENCY = 3;
const TRACK_ACCENT_PALETTE = [
  { name: "赤红", color: "#ff2f3d", deep: "#e92531", rgb: "255, 47, 61" },
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
  download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17h1.1a2 2 0 0 0 1.8-2.9 1.6 1.6 0 0 1 1.4-2.4H18a5.5 5.5 0 0 0 0-11H12Z"></path><circle cx="7.7" cy="10" r="0.9"></circle><circle cx="10.3" cy="7.6" r="0.9"></circle><circle cx="13.8" cy="7.7" r="0.9"></circle><circle cx="16.2" cy="10.4" r="0.9"></circle>',
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
const openLoginSheetButton = document.querySelector("#openLoginSheetButton");
const loginSheetCloseTargets = [...document.querySelectorAll("[data-close-login-sheet]")];
const loginModeSwipeArea = document.querySelector("[data-login-mode-swipe]");
const loginEntryVersion = document.querySelector(".login-entry-version");
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
const loadMorePlaylistTracksButton = document.querySelector("#loadMorePlaylistTracksButton");
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
const lyricsSourceBridgeApiUrlInput = document.querySelector("#lyricsSourceBridgeApiUrl");
const settingsSaveLyricsSourceBridgeButton = document.querySelector("#settingsSaveLyricsSourceBridgeButton");
const settingsLyricsSourceBridgeStatus = document.querySelector("#settingsLyricsSourceBridgeStatus");
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
const mobileRadarButton = document.querySelector("#mobileRadarButton");
const mobileMoreNavigationButtons = [mobileMoreNavButton].filter(Boolean);
const trackActionSheet = document.querySelector("#trackActionSheet");
const trackActionSheetClose = document.querySelector("#trackActionSheetClose");
const trackActionSheetBack = document.querySelector("#trackActionSheetBack");
const trackActionSheetForward = document.querySelector("#trackActionSheetForward");
const trackActionSheetTitle = document.querySelector("#trackActionSheetTitle");
const trackActionSheetSubtitle = document.querySelector("#trackActionSheetSubtitle");
const trackActionSheetList = document.querySelector("#trackActionSheetList");
const trackActionSheetDetail = document.querySelector("#trackActionSheetDetail");
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
const mobileProfileAvatarInitial = document.querySelector("#mobileProfileAvatarInitial");
const mobileProfileAvatarImage = document.querySelector("#mobileProfileAvatarImage");
const mobileProfileName = document.querySelector("#mobileProfileName");
const mobileProfileSourceBadge = document.querySelector("#mobileProfileSourceBadge");
const mobileProfileSubtitle = document.querySelector("#mobileProfileSubtitle");
const mobileProfileServerLine = document.querySelector("#mobileProfileServerLine");
const mobileProfileStatusDot = document.querySelector("#mobileProfileStatusDot");
const mobileProfileStatusText = document.querySelector("#mobileProfileStatusText");
const mobileProfileListenTime = document.querySelector("#mobileProfileListenTime");
const mobileProfileContentList = document.querySelector("#mobileProfileContentList");
const mobileProfileMainTabButtons = [...document.querySelectorAll("[data-profile-main-tab]")];
const mobileProfileSubTabButtons = [...document.querySelectorAll("[data-profile-sub-tab]")];

const audioPlayer = document.querySelector("#audioPlayer");
const playerMetaButton = document.querySelector("#playerMetaButton");
const playerCover = document.querySelector("#playerCover");
const playerTitle = document.querySelector("#playerTitle");
const playerSubtitle = document.querySelector("#playerSubtitle");
const playerPlaybackMeta = document.querySelector("#playerPlaybackMeta");
const playerQualityBadge = document.querySelector("#playerQualityBadge");
const miniPlayerLyric = document.querySelector("#miniPlayerLyric");
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
const topTabs = document.querySelector(".top-tabs");
const topLyricFocus = document.querySelector("#topLyricFocus");
const topLyricOriginal = document.querySelector("#topLyricOriginal");
const topLyricCurrent = document.querySelector("#topLyricCurrent");
const playButton = document.querySelector("#playButton");
const playerFavoriteButton = document.querySelector("#playerFavoriteButton");
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
const downloadOptionsModal = document.querySelector("#downloadOptionsModal");
const downloadOptionsClose = document.querySelector("#downloadOptionsClose");
const downloadOptionsSubtitle = document.querySelector("#downloadOptionsSubtitle");
const downloadOptionsList = document.querySelector("#downloadOptionsList");
const lyricSettingsModal = document.querySelector("#lyricSettingsModal");
const lyricSettingsClose = document.querySelector("#lyricSettingsClose");
const lyricFontSizeRange = document.querySelector("#lyricFontSizeRange");
const lyricFontSizeValue = document.querySelector("#lyricFontSizeValue");
const lyricFontFamilyButton = document.querySelector("#lyricFontFamilyButton");
const lyricFontFamilyValue = document.querySelector("#lyricFontFamilyValue");
const lyricLetterSpacingRange = document.querySelector("#lyricLetterSpacingRange");
const lyricLetterSpacingValue = document.querySelector("#lyricLetterSpacingValue");
const lyricAutoScrollToggle = document.querySelector("#lyricAutoScrollToggle");
const lyricAutoImmersiveToggle = document.querySelector("#lyricAutoImmersiveToggle");
const playerStyleModal = document.querySelector("#playerStyleModal");
const playerStyleClose = document.querySelector("#playerStyleClose");
const playerThemeButtons = [...document.querySelectorAll("[data-player-theme]")];
const visualizerStyleButtons = [...document.querySelectorAll("[data-visualizer-style]")];
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
const miniPlayerCoverContainer = document.querySelector("#miniPlayerCoverContainer");
const miniPlayerProgress = document.querySelector("#miniPlayerProgress");
const miniPlayerTitleViewport = document.querySelector(".mini-player-title-viewport");
const miniPlayerTitleScroll = document.querySelector(".mini-player-title-scroll");
const nowPlayingProgressFill = document.querySelector("#nowPlayingProgressFill");
const currentTime = document.querySelector("#currentTime");
const nowPlayingCurrentTime = document.querySelector("#nowPlayingCurrentTime");
const durationTime = document.querySelector("#durationTime");
const nowPlayingDurationTime = document.querySelector("#nowPlayingDurationTime");
const playerNextPreview = document.querySelector("#playerNextPreview");
const playerNextTitle = document.querySelector("#playerNextTitle");
const immersiveBackdrop = document.querySelector("#immersiveBackdrop");
const immersiveCover = document.querySelector("#immersiveCover");
const immersiveMobileStageToggle = document.querySelector("#immersiveMobileStageToggle");
const immersiveDesktopStageToggle = document.querySelector("#immersiveDesktopStageToggle");
const immersiveDesktopCurrentLyric = document.querySelector("#immersiveDesktopCurrentLyric");
const immersiveMobileCoverProxy = document.querySelector(".immersive-mobile-cover-proxy");
const immersiveMobileTitleGroup = document.querySelector(".immersive-mobile-title");
const immersiveMobileTitle = document.querySelector("#immersiveMobileTitle");
const immersiveMobileArtist = document.querySelector("#immersiveMobileArtist");
const immersiveMobileDeckTitle = document.querySelector("#immersiveMobileDeckTitle");
const immersiveMobileDeckSubtitle = document.querySelector("#immersiveMobileDeckSubtitle");
const immersiveMobileDeckQuality = document.querySelector("#immersiveMobileDeckQuality");
const immersiveMobileCurrentLyric = document.querySelector("#immersiveMobileCurrentLyric");
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
const immersiveTopRevealButton = document.querySelector("#immersiveTopRevealButton");
const immersiveBackgroundButton = document.querySelector("#immersiveBackgroundButton");
const immersiveFullscreenButton = document.querySelector("#immersiveFullscreenButton");
const immersiveCloseButton = document.querySelector("#immersiveCloseButton");
const immersiveQualityButton = document.querySelector("#immersiveQualityButton");
const immersiveDownloadButton = document.querySelector("#immersiveDownloadButton");
const immersiveMoreButton = document.querySelector("#immersiveMoreButton");
const immersiveMobileFavoriteButton = document.querySelector("#immersiveMobileFavoriteButton");
const immersiveMobileZenButton = document.querySelector("#immersiveMobileZenButton");
const immersiveMobileQualityButton = document.querySelector("#immersiveMobileQualityButton");
const immersiveMobileDownloadButton = document.querySelector("#immersiveMobileDownloadButton");
const immersiveMobileMoreButton = document.querySelector("#immersiveMobileMoreButton");
const immersiveMobileFullscreenButton = document.querySelector("#immersiveMobileFullscreenButton");
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
let downloadOptionsCloseTimer = 0;
let lyricSettingsCloseTimer = 0;
let lyricSettingsSaveTimer = 0;
let immersiveMobileCurrentLyricAnimationTimer = 0;
let playerStyleCloseTimer = 0;
let immersiveCloseAnimationTimer = 0;
let immersiveFullscreenState = Boolean(document.fullscreenElement);
let trackFluidFrame = 0;
let trackFluidPhase = 0;
let trackFluidWidth = 50;
let trackFluidActiveTrackId = "";
let immersiveVisualizerAudioContext = null;
let immersiveVisualizerSource = null;
let immersiveVisualizerAnalyser = null;
let immersiveVisualizerData = null;
let immersiveVisualizerFrequencyData = null;
let immersiveVisualizerStream = null;
let immersiveVisualizerSourceElement = null;
let immersiveVisualizerFrame = 0;
let immersiveVisualizerSyncFrame = 0;
let immersiveVisualizerSyncTimer = 0;
let immersiveVisualizerLevels = [];
let immersiveVisualizerPhase = 0;
let immersiveVisualizerLastStats = null;
let activeTrackRows = [];
let activeTrackRowsTrackId = "";
let activeTrackRowsCacheValid = false;
let progressRenderSignature = "";
let homeStartProgressSignature = "";
let playerNextPreviewSignature = "";
let lyricProgressFrame = 0;
let lyricSettingsLayoutFrame = 0;
let lyricProgressResumeTimer = 0;
let lyricProgressActiveIndex = -1;
let lyricProgressFullWordCount = -1;
let lyricProgressPartialWordIndex = -1;
let lyricClockAudioSeconds = 0;
let lyricClockStartedAtMs = 0;
let lyricClockPlaybackRate = 1;
let lyricClockIsRunning = false;
let lastLyricAutoScrollAt = 0;
let lastManualLyricScrollAt = 0;
let activeLyricListIndex = -1;
let lyricLineElements = [];
let lyricLineWordGroups = [];
let nowLyricWordGroups = [];
let immersiveLyricActiveIndex = -1;
let immersiveLyricLineElements = [];
let immersiveLyricWordElements = [];
let immersiveLyricWordTimings = [];
let immersiveLyricWordEndTimings = [];
let immersiveLyricTimedWordUsable = [];
let immersiveLyricWordGroups = [];
const lyricWordProgressCssCache = new Map();
let lastStaticLyricRenderSignature = "";
let lyricRenderRevision = 0;
let topLyricRenderedSignature = "";
let topLyricCharacterSpans = [];
let topLyricCharacterTimings = [];
let topLyricCharacterGroups = [];
let topLyricTriggeredWordIndex = -1;
let topLyricAlignPastOnNextLoop = false;
let topLyricShardFrame = 0;
let topLyricShardAnimationFrame = 0;
let topLyricShardEffects = [];
let topLyricShardOptions = {};
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

const store = storeOps.createStore({
  session: initialSession,
  sourceMode: getSessionSourceMode(initialSession) || loadSourceMode(),
  externalSourceApiUrl: getInitialExternalSourceApiUrl(initialSession),
  sourceBridgeManifestUrl: loadSourceBridgeManifestUrl(),
  sourceBridgeMusicDir: loadSourceBridgeMusicDir(),
  lyricOffsetSeconds: loadLyricOffsetSeconds(),
  lyricSettings: loadLyricSettings(),
  sourceBridgeInfo: null,
  views: [],
  libraryViewId: initialLibraryViewId,
  albums: [],
  tracks: [],
  artists: [],
  playlists: [],
  favoriteTracks: [],
  recentTracks: loadRecentTracks(initialSession),
  listenTimeTotalSeconds: loadListenTimeTotalSeconds(),
  listenTimeUnsavedSeconds: 0,
  listenTimeLastTickSeconds: 0,
  mobileProfileMainTab: "music",
  mobileProfileSubTab: "overview",
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
  totalPlaylistTracks: 0,
  hasMorePlaylistTracks: false,
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
  isLoadingMorePlaylistTracks: false,
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
  serverSearchController: null,
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
  externalResolveRetryTrackId: "",
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
  lyricsSourceDiagnostics: null,
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
  actionSheetPage: "main",
  actionSheetHistory: [],
  actionSheetForward: [],
  actionSheetDraft: null,
  queueUndoSnapshot: null,
  recentUndoSnapshot: null,
  isQuickQueueOpen: false,
  quickQueueReturnFocus: null,
  isAddingToPlaylist: false,
  isCreatingPlaylist: false,
  isMovingPlaylistTrack: false,
  isImmersiveQueueOpen: false,
  mobileImmersiveView: "cover",
  desktopImmersiveView: "visualizer",
  immersiveTopActionsCollapsed: false,
  immersivePlayerStyle: initialImmersivePlayerStyle,
  playbackDisplaySettings: loadPlaybackDisplaySettings(),
  immersiveBackgroundMode: initialImmersivePlayerStyle.theme,
  immersiveVisualizerStyle: initialImmersivePlayerStyle.visualizer,
  immersiveReturnView: "home",
  videoFloatingMode: "hidden",
}, {
  requestIdle: window.requestIdleCallback?.bind(window),
  cancelIdle: window.cancelIdleCallback?.bind(window),
});
const state = store.state;

const MINI_PLAYER_LYRIC_REVEAL_DELAY_MS = 30000;
const MINI_PLAYER_PROGRESS_LYRIC_TAIL_GUARD_SECONDS = 0.85;
let miniPlayerLyricRevealTimer = 0;
let miniPlayerLyricText = "";
let miniPlayerLyricRefreshTimer = 0;
let miniPlayerLyricIdleListenersBound = false;
let miniPlayerLyricLastIdleResetAt = 0;

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
    console.error(redact.redactText(readableError(error)));
  }
}

function init() {
  window.EmbyMusicTheme?.init?.();
  bindLoginEvents();
  deviceNameInput.value = storage.loadDeviceName(getDefaultDeviceName());
  if (state.session) {
    state.sourceMode = getSessionSourceMode(state.session);
    if (isExternalSourceSession(state.session)) {
      syncExternalSourceSessionApiUrl(state.session);
    } else {
      state.externalSourceApiUrl = state.session.externalSourceApiUrl || state.externalSourceApiUrl;
    }
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
  renderMobileProfilePage();
  bindMobileProfileTabs();
  bindMiniPlayerLyricIdleListeners();
  void hydrateQueueStateFromIndexedDb(initialSession, initialQueueState.savedAt);

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
  bindLyricManualScrollGuards();
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
  loadMorePlaylistTracksButton?.addEventListener("click", () => loadMoreSelectedPlaylistTracks());
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
  settingsSaveLyricsSourceBridgeButton?.addEventListener("click", saveLyricsSourceBridgeApiUrlFromSettings);
  lyricsSourceBridgeApiUrlInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveLyricsSourceBridgeApiUrlFromSettings();
    }
  });
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
  trackActionSheetBack?.addEventListener("click", goBackActionSheetPage);
  trackActionSheetForward?.addEventListener("click", goForwardActionSheetPage);
  mobileMoreNavigationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      triggerMobileNavItemAnimation(button);
      openMobileNavigationSheet();
    });
  });
  mobileRadarButton?.addEventListener("click", () => {
    triggerMobileNavItemAnimation(mobileRadarButton);
    openRadarImmersivePlayer();
  });
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
      triggerMobileNavItemAnimation(button);
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
  downloadOptionsClose?.addEventListener("click", closeDownloadOptionsModal);
  document.addEventListener("click", handleDownloadOptionsDocumentClick);
  lyricSettingsClose?.addEventListener("click", closeLyricSettingsModal);
  playerStyleClose?.addEventListener("click", closePlayerStyleModal);
  playerThemeButtons.forEach((button) => {
    button.addEventListener("click", () => updateImmersivePlayerStyle("theme", button.dataset.playerTheme));
  });
  visualizerStyleButtons.forEach((button) => {
    button.addEventListener("click", () => updateImmersivePlayerStyle("visualizer", button.dataset.visualizerStyle));
  });
  lyricFontSizeRange?.addEventListener("input", () => {
    updateLyricSetting("fontScale", Number(lyricFontSizeRange.value) / 100);
  });
  lyricFontFamilyButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openLyricFontChoicePopover();
  });
  lyricLetterSpacingRange?.addEventListener("input", () => {
    updateLyricSetting("letterSpacing", Number(lyricLetterSpacingRange.value));
  });
  lyricAutoScrollToggle?.addEventListener("change", () => {
    updateLyricSetting("autoScroll", lyricAutoScrollToggle.checked);
  });
  lyricAutoImmersiveToggle?.addEventListener("change", () => {
    updateLyricSetting("autoImmersiveLyrics", lyricAutoImmersiveToggle.checked);
  });
  lyricSettingsModal?.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, lyricSettingsModal)) {
      closeLyricSettingsModal();
    }
  });
  document.addEventListener("click", handleLyricSettingsDocumentClick);
  playerStyleModal?.addEventListener("click", (event) => {
    if (isBackdropCloseEvent(event, playerStyleModal)) {
      closePlayerStyleModal();
    }
  });
  document.addEventListener("click", handlePlayerStyleDocumentClick);
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
  immersiveTopRevealButton?.addEventListener("click", () => setImmersiveTopActionsCollapsed(false));
  immersiveQualityButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openAudioQualityModal();
  });
  immersiveDownloadButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openDownloadOptionsModal();
  });
  immersiveMoreButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openImmersiveMoreActions();
  });
  immersiveMobileFavoriteButton?.addEventListener("click", () => toggleFavorite(state.currentTrack));
  immersiveMobileZenButton?.addEventListener("click", toggleImmersiveZenMode);
  immersiveMobileQualityButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openAudioQualityModal();
  });
  immersiveMobileDownloadButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openDownloadOptionsModal();
  });
  immersiveMobileMoreButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openImmersiveMoreActions();
  });
  immersiveFullscreenButton.addEventListener("click", toggleImmersiveFullscreen);
  immersiveMobileFullscreenButton?.addEventListener("click", toggleImmersiveFullscreen);
  immersiveCloseButton.addEventListener("click", closeImmersivePlayer);
  immersiveZenButton?.addEventListener("click", toggleImmersiveZenMode);
  playerMetaButton.addEventListener("click", openConfiguredPlayerMetaTarget);
  playerFavoriteButton?.addEventListener("click", async (event) => {
    event.stopPropagation();
    await toggleFavorite(state.currentTrack);
    renderPlaybackFavoriteButton(playerFavoriteButton, state.currentTrack);
  });
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
  applyLyricSettings();
  applyImmersivePlayerStyle();
  applyPlaybackDisplaySettings();
  setDesktopImmersiveStageView("visualizer", { animate: false });
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
  immersiveMobileStageToggle?.addEventListener("click", toggleMobileImmersiveStageView);
  immersiveDesktopStageToggle?.addEventListener("click", () => setDesktopImmersiveStageView("lyrics", { animate: true }));
  immersivePlayerPanel?.addEventListener("click", handleImmersiveLyricReturnClick, true);
  immersiveMobileTitleGroup?.addEventListener("keydown", handleImmersiveMobileTitleKeydown);
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
  document.addEventListener("fullscreenchange", updateImmersiveFullscreenLabel);
  playerbarSweepLayer?.addEventListener("animationend", () => {
    playerbarSweepLayer.classList.remove("is-active");
  });
  topTabs?.addEventListener("pointerenter", handleTopbarMenuInteractionStart);
  topTabs?.addEventListener("pointerleave", handleTopbarMenuInteractionEnd);
  topTabs?.addEventListener("focusin", handleTopbarMenuInteractionStart);
  topTabs?.addEventListener("focusout", (event) => {
    if (!topTabs.contains(event.relatedTarget)) {
      handleTopbarMenuInteractionEnd();
    }
  });
  window.addEventListener("keydown", handleKeyboardShortcut);
  window.addEventListener("hashchange", () => switchViewFromHash());
  window.addEventListener("focus", () => requestAnimationFrame(ensureVisibleMainPanel));
  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  window.addEventListener("emby-music-hls-ready", handleHlsReady);
  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleDocumentVisibilityChange);
  window.addEventListener("pagehide", () => {
    flushLyricSettingsSave();
    flushListenTimeRecord({ force: true });
    persistPlaybackPosition({ force: true });
  });
  window.addEventListener("beforeunload", () => {
    flushLyricSettingsSave();
    flushListenTimeRecord({ force: true });
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
    runImmersiveVisualizerScenario,
    runExternalSourceReentryScenario,
    runSearchAbortScenario,
  };
}

function isBrowserSmokeRun() {
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return isLocalHost && new URLSearchParams(window.location.search).has("browser-smoke");
}

function handleDocumentVisibilityChange() {
  if (document.visibilityState === "visible") {
    requestAnimationFrame(ensureVisibleMainPanel);
    syncLyricPlaybackClock();
    refreshLyricsForPlaybackResume();
    return;
  }

  flushLyricSettingsSave();
  persistPlaybackPosition({ force: true });
  pauseLyricPlaybackClock();
  stopLyricProgressLoop();
}

function handlePageShow(event = {}) {
  requestAnimationFrame(ensureVisibleMainPanel);

  if (document.visibilityState === "visible") {
    syncLyricPlaybackClock();
    refreshLyricsForPlaybackResume();
  }

  refreshExternalSourceAfterPageRestore(Boolean(event?.persisted));
}

function refreshExternalSourceAfterPageRestore(wasRestoredFromPageCache = false) {
  if (!wasRestoredFromPageCache || !isExternalSourceSession(state.session)) {
    return;
  }

  syncExternalSourceSessionApiUrl(state.session);
  clearPreload();

  if (Array.isArray(state.queue)) {
    state.queue.forEach(markRestoredQueueTrackForFreshResolve);
  }

  if (state.currentTrack) {
    markRestoredQueueTrackForFreshResolve(state.currentTrack);
  }
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
    Artists: ["Aurora Music"],
    ArtistItems: [{ Id: "browser-smoke-artist", Name: "Aurora Music" }],
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

function runSearchAbortScenario() {
  const previousSession = state.session;
  const previousIsLibraryLoaded = state.isLibraryLoaded;
  const previousLastServerSearchQuery = state.lastServerSearchQuery;
  const previousIsServerSearching = state.isServerSearching;
  const previousController = state.serverSearchController;
  const previousTimer = state.serverSearchTimer;
  let abortedImmediately = false;

  clearTimeout(state.serverSearchTimer);
  state.session = {
    sourceMode: "emby",
    serverUrl: "http://browser-smoke.local",
    userId: "browser-smoke-user",
    userName: "Browser Smoke",
    serverName: "Browser Smoke",
    version: APP_VERSION,
  };
  state.isLibraryLoaded = true;
  state.lastServerSearchQuery = "";
  state.serverSearchController = {
    abort() {
      abortedImmediately = true;
    },
  };

  scheduleServerSearch("browser smoke query");
  const timerScheduled = Boolean(state.serverSearchTimer);

  clearTimeout(state.serverSearchTimer);
  state.serverSearchTimer = previousTimer;
  state.serverSearchController = previousController;
  state.session = previousSession;
  state.isLibraryLoaded = previousIsLibraryLoaded;
  state.lastServerSearchQuery = previousLastServerSearchQuery;
  state.isServerSearching = previousIsServerSearching;

  return {
    abortedImmediately,
    timerScheduled,
  };
}

async function runExternalSourceReentryScenario() {
  const staleBridgeUrl = "http://127.0.0.1:5999";
  const currentBridgeUrl = "http://127.0.0.1:5174";
  const track = createBrowserSmokeExternalRestoredTrack(staleBridgeUrl);
  const staleSession = buildExternalSourceSession(staleBridgeUrl, {
    name: "Browser Smoke Stale Bridge",
    version: "stale",
  });
  const currentSession = buildExternalSourceSession(currentBridgeUrl, {
    name: "Browser Smoke Current Bridge",
    version: "current",
  });
  const previous = {
    session: state.session,
    sourceMode: state.sourceMode,
    externalSourceApiUrl: state.externalSourceApiUrl,
    tracks: state.tracks,
    filteredTracks: state.filteredTracks,
    queue: state.queue,
    currentTrack: state.currentTrack,
    currentTrackIndex: state.currentTrackIndex,
    currentPlaybackMode: state.currentPlaybackMode,
    currentMediaSourceId: state.currentMediaSourceId,
    currentPlaySessionId: state.currentPlaySessionId,
    hasReportedPlaybackStart: state.hasReportedPlaybackStart,
    savedPlaybackPositionSeconds: state.savedPlaybackPositionSeconds,
    isChangingTrack: state.isChangingTrack,
    isPlaybackBuffering: state.isPlaybackBuffering,
    audioUnlocked: state.audioUnlocked,
    pendingAutoplayResume: state.pendingAutoplayResume,
    lastPlaybackInfoError: state.lastPlaybackInfoError,
    lastPlaybackError: state.lastPlaybackError,
    externalResolveRetryTrackId: state.externalResolveRetryTrackId,
  };
  const originalFetchMediaSource = externalSourceApi.fetchMediaSource;
  const originalAudioPlay = audioPlayer.play;
  const hadOwnAudioPlay = Object.prototype.hasOwnProperty.call(audioPlayer, "play");
  const fetchCalls = [];
  let playCalled = false;
  let loadedQueueState = null;
  let playbackTrack = null;
  let persistedQueueState = null;
  let restoredMarkerBeforePlay = false;
  let restoredMarkerClearedAfterPlay = false;
  let pageShowMarkedFreshResolve = false;
  let pageShowUsedCurrentBridgeUrl = false;
  let result = null;

  externalSourceApi.fetchMediaSource = async (apiUrl, requestedTrack, options = {}) => {
    fetchCalls.push({
      apiUrl,
      forceResolve: Boolean(options.forceResolve),
      quality: options.quality || "",
      trackApiUrl: requestedTrack?.ExternalSource?.apiUrl || "",
      trackMediaUrl: requestedTrack?.ExternalSource?.mediaUrl || "",
      trackBridgeStreamUrl: requestedTrack?.ExternalSource?.bridgeStreamUrl || "",
      trackDirectUrl: requestedTrack?.ExternalSource?.directUrl || "",
    });

    return createBrowserSmokeExternalMediaResponse(currentBridgeUrl, requestedTrack);
  };
  audioPlayer.play = () => {
    playCalled = true;
    return Promise.resolve();
  };

  try {
    clearBrowserSmokeExternalQueueKeys(staleSession, currentSession);
    writeBrowserSmokeLegacyExternalQueue(staleSession, track, 12.5);

    loadedQueueState = loadQueueState(staleSession);
    playbackTrack = loadedQueueState.currentTrack || loadedQueueState.queue[0];
    state.session = currentSession;
    state.sourceMode = "external";
    state.externalSourceApiUrl = currentBridgeUrl;
    state.tracks = [playbackTrack];
    state.filteredTracks = [playbackTrack];
    state.queue = loadedQueueState.queue;
    state.currentTrack = playbackTrack;
    state.currentTrackIndex = 0;
    state.savedPlaybackPositionSeconds = loadedQueueState.positionSeconds;
    state.audioUnlocked = true;
    state.pendingAutoplayResume = false;
    state.lastPlaybackInfoError = "";
    state.lastPlaybackError = "";
    state.externalResolveRetryTrackId = "";
    clearPreload();
    restoredMarkerBeforePlay = Boolean(playbackTrack?._restoredQueueNeedsFreshResolve);

    await playTrack(playbackTrack, loadedQueueState.queue, {
      positionSeconds: loadedQueueState.positionSeconds,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    persistedQueueState = storage.loadQueueState(currentSession);
    const persistedTrack = persistedQueueState.queue[0] || null;
    const persistedExternal = persistedTrack?.ExternalSource || {};
    const currentExternal = playbackTrack.ExternalSource || {};
    const loadedExternal = loadedQueueState.queue[0]?.ExternalSource || {};
    const staleValues = [
      loadedExternal.mediaUrl,
      loadedExternal.bridgeStreamUrl,
      loadedExternal.directUrl,
    ].filter(Boolean);
    const persistedValues = [
      persistedExternal.mediaUrl,
      persistedExternal.bridgeStreamUrl,
      persistedExternal.directUrl,
    ].filter(Boolean);
    restoredMarkerClearedAfterPlay = !playbackTrack?._restoredQueueNeedsFreshResolve;
    clearRestoredQueueFreshResolveMarker(playbackTrack);
    handlePageShow({ persisted: true });
    pageShowMarkedFreshResolve = Boolean(playbackTrack?._restoredQueueNeedsFreshResolve);
    pageShowUsedCurrentBridgeUrl = getSessionExternalSourceApiUrl(state.session) === currentBridgeUrl;

    result = {
      loadedFromLegacyQueue: loadedQueueState.queue.length === 1 && playbackTrack?.Id === track.Id,
      restoredMarkerBeforePlay,
      restoredMarkerClearedAfterPlay,
      fetchCallCount: fetchCalls.length,
      fetchCall: fetchCalls[0] || null,
      usedCurrentBridgeUrl: fetchCalls[0]?.apiUrl === currentBridgeUrl,
      ignoredStaleTrackBridgeUrl: fetchCalls[0]?.apiUrl !== track.ExternalSource.apiUrl,
      forceResolve: fetchCalls[0]?.forceResolve === true,
      staleInlineUrlPassedToFetch: fetchCalls[0]?.trackMediaUrl === track.ExternalSource.mediaUrl,
      playCalled,
      audioSourceUsesCurrentBridge: String(audioPlayer.src || "").startsWith(`${currentBridgeUrl}/plugin-stream`),
      currentMediaUrl: currentExternal.mediaUrl || "",
      currentBridgeStreamUrl: currentExternal.bridgeStreamUrl || "",
      currentDirectUrl: currentExternal.directUrl || "",
      currentUsesFreshBridgeStream: currentExternal.bridgeStreamUrl?.startsWith(`${currentBridgeUrl}/plugin-stream`) || false,
      currentUsesFreshDirectUrl: currentExternal.directUrl === "https://fresh.example.invalid/browser-smoke.flac",
      persistedQueueLength: persistedQueueState.queue.length,
      persistedCurrentTrackId: persistedQueueState.currentTrack?.Id || "",
      persistedMediaUrl: persistedExternal.mediaUrl || "",
      persistedBridgeStreamUrl: persistedExternal.bridgeStreamUrl || "",
      persistedDirectUrl: persistedExternal.directUrl || "",
      persistedDroppedStaleUrls: !persistedValues.some((value) => staleValues.includes(value)),
      persistedDroppedPlayableUrls: !persistedExternal.mediaUrl && !persistedExternal.bridgeStreamUrl && !persistedExternal.directUrl,
      persistedRestoreHasPluginIdentity: Boolean(
        persistedExternal.restore?.pluginKey
          && persistedExternal.restore?.pluginUrl
          && persistedExternal.restore?.raw
      ),
      pageShowMarkedFreshResolve,
      pageShowUsedCurrentBridgeUrl,
      persistedPluginUrl: persistedExternal.pluginUrl || "",
      savedPositionSeconds: persistedQueueState.positionSeconds,
      lastPlaybackInfoError: state.lastPlaybackInfoError,
      lastPlaybackError: state.lastPlaybackError,
      pendingAutoplayResume: state.pendingAutoplayResume,
      externalResolveRetryTrackId: state.externalResolveRetryTrackId,
    };
  } finally {
    state.playRequestId += 1;
    audioPlayer.pause();
    unloadAudioSource();
    externalSourceApi.fetchMediaSource = originalFetchMediaSource;
    if (hadOwnAudioPlay) {
      audioPlayer.play = originalAudioPlay;
    } else {
      delete audioPlayer.play;
    }
    state.session = previous.session;
    state.sourceMode = previous.sourceMode;
    state.externalSourceApiUrl = previous.externalSourceApiUrl;
    state.tracks = previous.tracks;
    state.filteredTracks = previous.filteredTracks;
    state.queue = previous.queue;
    state.currentTrack = previous.currentTrack;
    state.currentTrackIndex = previous.currentTrackIndex;
    state.currentPlaybackMode = previous.currentPlaybackMode;
    state.currentMediaSourceId = previous.currentMediaSourceId;
    state.currentPlaySessionId = previous.currentPlaySessionId;
    state.hasReportedPlaybackStart = previous.hasReportedPlaybackStart;
    state.savedPlaybackPositionSeconds = previous.savedPlaybackPositionSeconds;
    state.isChangingTrack = previous.isChangingTrack;
    state.audioUnlocked = previous.audioUnlocked;
    state.pendingAutoplayResume = previous.pendingAutoplayResume;
    state.lastPlaybackInfoError = previous.lastPlaybackInfoError;
    state.lastPlaybackError = previous.lastPlaybackError;
    state.externalResolveRetryTrackId = previous.externalResolveRetryTrackId;
    setPlaybackBuffering(previous.isPlaybackBuffering);
    clearBrowserSmokeExternalQueueKeys(staleSession, currentSession);
  }

  return result;
}

function createBrowserSmokeExternalRestoredTrack(apiUrl) {
  const pluginKey = "browser-smoke-plugin";
  const sourceId = "restored-track";
  const rawTrack = {
    id: sourceId,
    Id: sourceId,
    name: "Browser Smoke Restored Bridge Track",
    title: "Browser Smoke Restored Bridge Track",
    artist: "Smoke Tests",
    album: "Bridge Restore",
    duration: 180,
  };

  return {
    Id: `external:plugin:${pluginKey}:${sourceId}`,
    Type: "Audio",
    MediaType: "Audio",
    Name: rawTrack.name,
    Album: rawTrack.album,
    Artists: [rawTrack.artist],
    ArtistItems: [{ Id: "browser-smoke-bridge-artist", Name: rawTrack.artist }],
    RunTimeTicks: secondsToTicks(rawTrack.duration),
    UserData: {},
    ExternalSource: {
      apiUrl,
      id: `plugin:${pluginKey}:${sourceId}`,
      platform: "browser-smoke",
      pluginKey,
      pluginName: "Browser Smoke Plugin",
      pluginUrl: "https://browser-smoke.invalid/plugin.js",
      pluginPlatform: "Browser Smoke",
      sourceId,
      mediaKind: "audio",
      codec: "MP3",
      bitrate: 320000,
      sourceQuality: "HQ",
      qualityLabel: "HQ",
      qualityState: "resolved",
      qualityVerified: true,
      contentType: "audio/mpeg",
      mediaUrl: "https://stale.example.invalid/browser-smoke.mp3",
      bridgeStreamUrl: `${apiUrl}/plugin-stream?id=stale`,
      directUrl: "https://stale.example.invalid/direct-browser-smoke.mp3",
      raw: {
        pluginKey,
        pluginName: "Browser Smoke Plugin",
        pluginUrl: "https://browser-smoke.invalid/plugin.js",
        pluginPlatform: "Browser Smoke",
        sourceId,
        raw: rawTrack,
      },
      restore: {
        pluginKey,
        pluginName: "Browser Smoke Plugin",
        pluginUrl: "https://browser-smoke.invalid/plugin.js",
        pluginPlatform: "Browser Smoke",
        sourceId,
        mediaKind: "audio",
        raw: rawTrack,
      },
    },
    MediaSources: [
      {
        Id: `external-media:plugin:${pluginKey}:${sourceId}`,
        Container: "mp3",
        BitRate: 320000,
        MediaKind: "audio",
        MediaStreams: [{ Type: "Audio", Codec: "MP3", BitRate: 320000 }],
      },
    ],
  };
}

function createBrowserSmokeExternalMediaResponse(apiUrl, track) {
  const sourceId = track?.ExternalSource?.sourceId || "restored-track";
  const streamUrl = `${apiUrl}/plugin-stream?id=${encodeURIComponent(sourceId)}&quality=super`;
  const raw = track?.ExternalSource?.restore?.raw || track?.ExternalSource?.raw?.raw || {};

  return {
    mediaSourceId: "browser-smoke-fresh-media",
    playSessionId: "browser-smoke-fresh-session",
    streamUrl,
    bridgeStreamUrl: streamUrl,
    directUrl: "https://fresh.example.invalid/browser-smoke.flac",
    contentType: "audio/flac",
    codec: "FLAC",
    bitrate: 1000000,
    sourceQuality: "SQ",
    qualityLabel: "FLAC",
    qualityVerified: true,
    raw: {
      pluginKey: "browser-smoke-plugin",
      pluginName: "Browser Smoke Plugin",
      pluginUrl: "https://browser-smoke.invalid/plugin.js",
      pluginPlatform: "Browser Smoke",
      sourceId,
      raw,
      media: {
        streamUrl,
        directUrl: "https://fresh.example.invalid/browser-smoke.flac",
      },
    },
    restore: {
      pluginKey: "browser-smoke-plugin",
      pluginName: "Browser Smoke Plugin",
      pluginUrl: "https://browser-smoke.invalid/plugin.js",
      pluginPlatform: "Browser Smoke",
      sourceId,
      mediaKind: "audio",
      sourceQuality: "SQ",
      qualityLabel: "FLAC",
      qualityVerified: true,
      raw,
    },
  };
}

function writeBrowserSmokeLegacyExternalQueue(session, track, positionSeconds = 0) {
  localStorage.setItem(getBrowserSmokeLegacyQueueKey(session), JSON.stringify({
    serverUrl: session.serverUrl,
    userId: session.userId,
    serverId: session.serverId,
    queue: [track],
    currentTrackId: track.Id,
    currentTrackIndex: 0,
    positionSeconds,
    savedAt: new Date().toISOString(),
  }));
}

function getBrowserSmokeLegacyQueueKey(session) {
  const serverUrl = String(session?.serverUrl || "").replace(/\/+$/, "").toLowerCase();
  return `${QUEUE_KEY}/${encodeURIComponent(`${serverUrl}::${session.userId}`)}`;
}

function clearBrowserSmokeExternalQueueKeys(...sessions) {
  const keys = new Set([
    QUEUE_KEY,
    ...sessions.filter(Boolean).flatMap((session) => [
      getBrowserSmokeLegacyQueueKey(session),
      `${QUEUE_KEY}/${encodeURIComponent(`source-bridge://external-source::${session.userId}`)}`,
      `${QUEUE_KEY}/${encodeURIComponent(`source-bridge://unconfigured::${session.userId}`)}`,
    ]),
  ]);

  keys.forEach((key) => localStorage.removeItem(key));
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
  updateLyricsHighlight(15.2, true);
  const longGapLateProgress = collectBrowserSmokeLyricState();
  const longGapIdleResumeDelayMs = getLyricProgressIdleResumeDelayMs(1, getAdjustedLyricSeconds(4.8), { time: 20 });
  state.lyricOffsetSeconds = 0;
  const weightedFallbackTrack = createBrowserSmokeTrack({
    id: "browser-smoke-weighted-fallback-lyric-track",
    name: "Browser Smoke Weighted Fallback Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]a synchronization",
      "[00:06.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = weightedFallbackTrack;
  state.queue = [weightedFallbackTrack];
  state.tracks = [weightedFallbackTrack];
  state.filteredTracks = [weightedFallbackTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(weightedFallbackTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const weightedFallbackProgress = collectBrowserSmokeLyricState();
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
  updateLyricsHighlight(2.1, true);
  const enhancedTailWordProgress = collectBrowserSmokeLyricState();
  const repeatedTimestampTrack = createBrowserSmokeTrack({
    id: "browser-smoke-repeated-timestamp-lyric-track",
    name: "Browser Smoke Repeated Timestamp Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>一<0.00>二<0.00>三<0.24>四",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = repeatedTimestampTrack;
  state.queue = [repeatedTimestampTrack];
  state.tracks = [repeatedTimestampTrack];
  state.filteredTracks = [repeatedTimestampTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(repeatedTimestampTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.1, true);
  const repeatedTimestampProgress = collectBrowserSmokeLyricState();
  const relativeEnhancedTrack = createBrowserSmokeTrack({
    id: "browser-smoke-relative-enhanced-lyric-track",
    name: "Browser Smoke Relative Enhanced Lyric Track",
    durationSeconds: 90,
    lyricsText: [
      "[01:20.00]<0.00>后 <0.50>半 <1.00>段",
      "[01:24.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = relativeEnhancedTrack;
  state.queue = [relativeEnhancedTrack];
  state.tracks = [relativeEnhancedTrack];
  state.filteredTracks = [relativeEnhancedTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(relativeEnhancedTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(80.75, true);
  const relativeEnhancedProgress = collectBrowserSmokeLyricState();
  const bilingualEnhancedTrack = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-enhanced-lyric-track",
    name: "Browser Smoke Bilingual Enhanced Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>Hello <0.60>world",
      "[00:00.00]<0.00>你<0.60>好",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = bilingualEnhancedTrack;
  state.queue = [bilingualEnhancedTrack];
  state.tracks = [bilingualEnhancedTrack];
  state.filteredTracks = [bilingualEnhancedTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(bilingualEnhancedTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualEnhancedProgress = collectBrowserSmokeLyricState();
  switchView("nowPlaying", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualSurfaceProgress = collectBrowserSmokeLyricSurfaceState();
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  const bilingualSyntheticTranslationTrack = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-synthetic-translation-lyric-track",
    name: "Browser Smoke Bilingual Synthetic Translation Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>Hello <0.60>world",
      "[00:00.00]你好",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = bilingualSyntheticTranslationTrack;
  state.queue = [bilingualSyntheticTranslationTrack];
  state.tracks = [bilingualSyntheticTranslationTrack];
  state.filteredTracks = [bilingualSyntheticTranslationTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(bilingualSyntheticTranslationTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualSyntheticTranslationProgress = collectBrowserSmokeLyricState();
  const bilingualSyntheticSpacedTranslationTrack = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-synthetic-spaced-translation-lyric-track",
    name: "Browser Smoke Bilingual Synthetic Spaced Translation Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>你<0.60>好",
      "[00:00.00]good night",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = bilingualSyntheticSpacedTranslationTrack;
  state.queue = [bilingualSyntheticSpacedTranslationTrack];
  state.tracks = [bilingualSyntheticSpacedTranslationTrack];
  state.filteredTracks = [bilingualSyntheticSpacedTranslationTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(bilingualSyntheticSpacedTranslationTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualSyntheticSpacedTranslationProgress = collectBrowserSmokeLyricState();
  const bilingualSyntheticWeightedTranslationTrack = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-synthetic-weighted-translation-lyric-track",
    name: "Browser Smoke Bilingual Synthetic Weighted Translation Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]<0.00>你<0.80>真<2.00>好",
      "[00:00.00]a synchronization",
      "[00:06.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = bilingualSyntheticWeightedTranslationTrack;
  state.queue = [bilingualSyntheticWeightedTranslationTrack];
  state.tracks = [bilingualSyntheticWeightedTranslationTrack];
  state.filteredTracks = [bilingualSyntheticWeightedTranslationTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(bilingualSyntheticWeightedTranslationTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualSyntheticWeightedTranslationProgress = collectBrowserSmokeLyricState();
  const bilingualSyntheticOriginalTrack = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-synthetic-original-lyric-track",
    name: "Browser Smoke Bilingual Synthetic Original Lyric Track",
    durationSeconds: 10,
    lyricsText: [
      "[00:00.00]Hello world",
      "[00:00.00]<0.00>你<0.60>好",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  state.currentTrack = bilingualSyntheticOriginalTrack;
  state.queue = [bilingualSyntheticOriginalTrack];
  state.tracks = [bilingualSyntheticOriginalTrack];
  state.filteredTracks = [bilingualSyntheticOriginalTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(bilingualSyntheticOriginalTrack);
  setPlayerEnabled(true);
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.75, true);
  const bilingualSyntheticOriginalProgress = collectBrowserSmokeLyricState();
  const denseWordPerformance = runBrowserSmokeDenseLyricPerformanceScenario();
  const bilingualDenseWordPerformance = runBrowserSmokeBilingualDenseLyricPerformanceScenario();
  const manualScrollGuard = runBrowserSmokeLyricManualScrollGuardScenario();
  const lyricJitterProtection = runBrowserSmokeLyricJitterProtectionScenario();
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
  const topLyricShard = collectBrowserSmokeTopLyricShardState();
  const immersiveIconButtons = collectBrowserSmokeImmersiveIconButtonState();
  const desktopImmersiveLayout = collectBrowserSmokeDesktopImmersiveState();
  const mobileImmersiveLayout = collectBrowserSmokeMobileImmersiveState();
  setLyricOffsetSeconds(originalOffsetSeconds);

  return {
    beforeOffset,
    afterOffset,
    afterResumeRefresh,
    longGapProgress,
    longGapLateProgress,
    longGapIdleResumeDelayMs,
    weightedFallbackProgress,
    enhancedMidWordProgress,
    enhancedLateWordProgress,
    enhancedTailWordProgress,
    repeatedTimestampProgress,
    relativeEnhancedProgress,
    bilingualEnhancedProgress,
    bilingualSurfaceProgress,
    bilingualSyntheticTranslationProgress,
    bilingualSyntheticSpacedTranslationProgress,
    bilingualSyntheticWeightedTranslationProgress,
    bilingualSyntheticOriginalProgress,
    denseWordPerformance,
    bilingualDenseWordPerformance,
    manualScrollGuard,
    lyricJitterProtection,
    endScrollLayout,
    topLyricShard,
    immersiveIconButtons,
    desktopImmersiveLayout,
    mobileImmersiveLayout,
    activeView: getActiveView(),
    mainHidden: mainView.hidden,
    loginHidden: loginView.hidden,
  };
}

function collectBrowserSmokeTopLyricShardState() {
  const track = createBrowserSmokeTrack({
    id: "browser-smoke-topbar-lyric-hidden-track",
    name: "Browser Smoke Topbar Lyric Hidden Track",
    durationSeconds: 12,
    lyricsText: [
      "[00:00.00]<0.00>满<0.30>世<0.60>界<0.90>嘻<1.20>嘻<1.50>哈<1.80>哈",
      "[00:04.00]下一句",
    ].join("\n"),
  });

  state.lyricOffsetSeconds = 0;
  state.currentTrack = track;
  state.queue = [track];
  state.tracks = [track];
  state.filteredTracks = [track];
  state.currentTrackIndex = 0;
  updatePlayerMeta(track);
  setPlayerEnabled(true);
  switchView("home", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.95, true);

  const homeDisplayHidden = Boolean(topLyricFocus?.hidden);
  const homeText = topLyricCurrent?.textContent?.trim() || "";
  const homeOriginalText = topLyricOriginal?.textContent?.trim() || "";
  const homeCharCount = topLyricCharacterSpans.length;
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.95, true);
  const immersiveDisplayHidden = Boolean(topLyricFocus?.hidden);
  const immersiveBodyClassActive = document.body.classList.contains("topbar-lyric-active");
  const immersiveText = topLyricCurrent?.textContent?.trim() || "";
  const immersiveOriginalText = topLyricOriginal?.textContent?.trim() || "";
  const immersiveCharCount = topLyricCharacterSpans.length;
  const immersiveCanvasCount = topLyricFocus?.querySelectorAll(".top-lyric-shard-canvas").length || 0;
  const immersiveAnimationFrame = topLyricShardAnimationFrame;
  cancelTopLyricShardEffects();

  return {
    enabled: TOPBAR_LYRIC_DISPLAY_ENABLED,
    homeDisplayHidden,
    homeText,
    homeOriginalText,
    homeCharCount,
    immersiveDisplayHidden,
    immersiveBodyClassActive,
    immersiveText,
    immersiveOriginalText,
    immersiveCharCount,
    immersiveCanvasCount,
    immersiveAnimationFrame,
  };
}

function collectBrowserSmokeImmersiveIconButtonState() {
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  renderQueue();
  const selectors = [
    "#immersiveLyricOffsetSlowerButton",
    "#immersiveLyricOffsetFasterButton",
    "#immersiveLyricOffsetResetButton",
    "#immersiveBackgroundButton",
    "#immersiveFullscreenButton",
    "#immersiveQualityButton",
    "#immersiveDownloadButton",
    "#immersiveMoreButton",
    "#immersiveMobileFavoriteButton",
    "#immersiveMobileZenButton",
    "#immersiveMobileQualityButton",
    "#immersiveMobileDownloadButton",
    "#immersiveMobileMoreButton",
    "#immersiveMobileFullscreenButton",
    "#immersiveCloseButton",
    "#immersiveShuffleStartButton",
    "#immersivePlayLibraryButton",
    "#immersiveOpenLibraryButton",
    "#immersiveQueueCloseButton",
    "#immersiveQueueLocateButton",
    "#immersiveQueueShuffleButton",
    "#immersiveQueueClearPlayedButton",
    "#immersiveQueueClearButton",
    "#immersiveModeButton",
    "#immersiveFavoriteButton",
    "#immersivePrevButton",
    "#immersivePlayButton",
    "#immersiveNextButton",
    "#immersiveZenButton",
    "#immersiveQueueButton",
  ];
  const visibleTextLabels = [];
  const missingAccessibleLabels = [];
  const missingTitles = [];
  const missingIcons = [];
  const smallTargets = [];
  const stateLabels = {};

  selectors.forEach((selector) => {
    const button = document.querySelector(selector);
    if (!(button instanceof HTMLElement)) {
      missingAccessibleLabels.push(`${selector}:missing`);
      return;
    }

    const style = window.getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    const isRendered = style.display !== "none"
      && style.visibility !== "hidden"
      && rect.width > 0
      && rect.height > 0;
    const visibleText = [...button.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join("")
      .trim();
    const visibleElementText = [...button.querySelectorAll("span:not(.sr-only):not(.immersive-queue-badge)")]
      .filter((element) => {
        const elementStyle = window.getComputedStyle(element);
        const elementRect = element.getBoundingClientRect();
        return elementStyle.display !== "none"
          && elementStyle.visibility !== "hidden"
          && elementRect.width > 1
          && elementRect.height > 1;
      })
      .map((element) => element.textContent.trim())
      .filter(Boolean);

    if (isRendered && (visibleText || visibleElementText.length || Number.parseFloat(style.fontSize) > 1)) {
      visibleTextLabels.push({
        selector,
        visibleText,
        visibleElementText,
        fontSize: style.fontSize,
      });
    }

    if (!button.querySelector("svg, .line-icon") && selector !== "#immersivePlayButton") {
      missingIcons.push(selector);
    }

    if (!button.getAttribute("aria-label")) {
      missingAccessibleLabels.push(selector);
    }

    if (!button.getAttribute("title")) {
      missingTitles.push(selector);
    }

    if (isRendered && (rect.width < 28 || rect.height < 28)) {
      smallTargets.push({
        selector,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  });

  openImmersiveQueue();
  stateLabels.queueOpenTitle = immersiveQueueButton?.getAttribute("title") || "";
  closeImmersiveQueue({ restoreFocus: false });
  stateLabels.queueClosedTitle = immersiveQueueButton?.getAttribute("title") || "";
  setImmersiveZenMode(true);
  stateLabels.zenOnTitle = immersiveZenButton?.getAttribute("title") || "";
  setImmersiveZenMode(false);
  stateLabels.zenOffTitle = immersiveZenButton?.getAttribute("title") || "";
  cycleImmersiveBackgroundMode();
  stateLabels.backgroundTitle = immersiveBackgroundButton?.getAttribute("title") || "";
  state.immersiveBackgroundMode = "original";
  state.immersivePlayerStyle = normalizeImmersivePlayerStyle({
    ...state.immersivePlayerStyle,
    theme: "original",
  });
  applyImmersivePlayerStyle();

  return {
    checkedCount: selectors.length,
    visibleTextLabels,
    missingAccessibleLabels,
    missingTitles,
    missingIcons,
    smallTargets,
    stateLabels,
  };
}

function collectBrowserSmokeLyricState() {
  const activeLine = immersiveLyricLineElements[state.activeLyricIndex] || null;
  const words = [...(immersiveLyricWordElements[state.activeLyricIndex] || [])];
  const wordGroups = collectBrowserSmokeLyricWordGroups(immersiveLyricWordGroups[state.activeLyricIndex] || []);
  const wordProgress = words.map((word) => Number(word._lyricProgress || 0));
  const cssWordProgress = words.map((word) => word.style.getPropertyValue("--word-progress"));
  const wordHighlightClipPath = words[1]
    ? window.getComputedStyle(words[1], "::after").clipPath
    : "";

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
    wordGroups,
    wordProgress,
    cssWordProgress,
    wordHighlightClipPath,
    offsetLabel: formatLyricOffsetLabel(state.lyricOffsetSeconds),
    scrollAllowedForced: shouldScrollLyricLine(true),
  };
}

function collectBrowserSmokeLyricWordGroups(groups) {
  return (groups || []).map((group) => ({
    role: group.role,
    wordCount: group.words.length,
    wordText: group.words.map((word) => word.textContent || ""),
    wordTimings: group.words.map((word) => {
      const time = Number(word.dataset.wordTime);
      return Number.isFinite(time) ? time : null;
    }),
    wordEndTimings: group.words.map((word) => {
      const time = Number(word.dataset.wordEndTime);
      return Number.isFinite(time) ? time : null;
    }),
    wordProgress: group.words.map((word) => Number(word._lyricProgress || 0)),
    cssWordProgress: group.words.map((word) => word.style.getPropertyValue("--word-progress")),
    progressFullWordCount: Number.isFinite(group.progressFullWordCount) ? group.progressFullWordCount : -1,
    progressPartialWordIndex: Number.isFinite(group.progressPartialWordIndex) ? group.progressPartialWordIndex : -1,
    timed: Boolean(group.hasUsableTimedWords),
  }));
}

function collectBrowserSmokeLyricSurfaceState(activeIndex = state.activeLyricIndex) {
  const listLine = lyricLineElements[activeIndex] || null;
  const immersiveLine = immersiveLyricLineElements[activeIndex] || null;

  return {
    activeIndex,
    list: {
      text: listLine?.textContent?.trim() || "",
      groups: collectBrowserSmokeLyricWordGroups(lyricLineWordGroups[activeIndex] || []),
    },
    focus: {
      text: nowLyricCurrent?.textContent?.trim() || "",
      groups: collectBrowserSmokeLyricWordGroups(nowLyricWordGroups || []),
    },
    immersive: {
      text: immersiveLine?.textContent?.trim() || "",
      groups: collectBrowserSmokeLyricWordGroups(immersiveLyricWordGroups[activeIndex] || []),
    },
  };
}

function runBrowserSmokeLyricManualScrollGuardScenario() {
  const previousManualScrollAt = lastManualLyricScrollAt;
  const previousAutoScrollAt = lastLyricAutoScrollAt;

  try {
    lastLyricAutoScrollAt = 0;
    markManualLyricScrollIntent();
    const suppressedAfterManualIntent = shouldScrollLyricLine(false) === false;
    const forcedStillAllowed = shouldScrollLyricLine(true) === true;
    lastManualLyricScrollAt = getMonotonicNowMs() - LYRIC_USER_SCROLL_SUPPRESS_MS - 1;
    lastLyricAutoScrollAt = 0;
    const restoredAfterSuppressWindow = shouldScrollLyricLine(false) === true;

    return {
      suppressMs: LYRIC_USER_SCROLL_SUPPRESS_MS,
      suppressedAfterManualIntent,
      forcedStillAllowed,
      restoredAfterSuppressWindow,
    };
  } finally {
    lastManualLyricScrollAt = previousManualScrollAt;
    lastLyricAutoScrollAt = previousAutoScrollAt;
  }
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
  let progressWriteCount = 0;
  const progressWriteValues = new Set();
  let progressFormattedWriteCount = 0;
  let denseProgressWriteCount = 0;
  let denseProgressUniqueWriteCount = 0;
  let denseProgressFormattedWriteCount = 0;
  let progressWriteCountBeforeTimeUpdate = 0;
  let progressWriteCountAfterRafTimeUpdate = 0;
  let progressWriteCountAfterRegularTimeUpdate = 0;
  let nowPlayingProgressWriteCountBeforeTimeUpdate = 0;
  let nowPlayingProgressWriteCountAfterRafTimeUpdate = 0;
  let lyricClockStartedAtBeforeStableTimeUpdate = 0;
  let lyricClockStartedAtAfterStableTimeUpdate = 0;
  let lyricClockAudioSecondsAtSoftDrift = 0;
  let lyricClockAudioSecondsBeforeSoftDrift = 0;
  let lyricClockAudioSecondsAfterSoftDrift = 0;
  let lyricClockStartedAtBeforeDriftTimeUpdate = 0;
  let lyricClockStartedAtAfterDriftTimeUpdate = 0;
  let bufferingStoppedLyricFrame = false;
  let bufferingPausedLyricClock = false;
  let bufferingBlockedLyricLoop = false;
  let hotPathFrameCount = 0;
  let nowPlayingHotPathFrameCount = 0;
  let fullHighlightFrameCount = 0;
  let finalState = null;
  let nowPlayingState = null;

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
    if (propertyName === "--word-progress") {
      const value = String(args[0] || "");
      progressWriteCount += 1;
      progressWriteValues.add(value);
      if (/^(?:0|100|\d{1,2}\.\d)%$/.test(value)) {
        progressFormattedWriteCount += 1;
      }
    }

    return originalSetProperty.call(this, propertyName, ...args);
  };

  const startedAt = getMonotonicNowMs();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const seconds = index * 0.075;
      if (updateActiveImmersiveLyricWordProgressFrame(seconds)) {
        hotPathFrameCount += 1;
      } else {
        fullHighlightFrameCount += 1;
        updateLyricsHighlight(seconds);
      }
    }
    denseProgressWriteCount = progressWriteCount;
    denseProgressUniqueWriteCount = progressWriteValues.size;
    denseProgressFormattedWriteCount = progressFormattedWriteCount;
    finalState = collectBrowserSmokeLyricState();
    progressWriteCountBeforeTimeUpdate = progressWriteCount;
    const existingLyricProgressFrame = lyricProgressFrame;
    const existingLyricClockRunning = lyricClockIsRunning;
    const existingLyricClockAudioSeconds = lyricClockAudioSeconds;
    const existingLyricClockStartedAtMs = lyricClockStartedAtMs;
    const existingLyricClockPlaybackRate = lyricClockPlaybackRate;
    lyricProgressFrame = lyricProgressFrame || 1;
    lyricClockIsRunning = true;
    lyricClockAudioSeconds = getAudioCurrentTimeSeconds();
    lyricClockStartedAtMs = getMonotonicNowMs();
    lyricClockPlaybackRate = 1;
    lyricClockStartedAtBeforeStableTimeUpdate = lyricClockStartedAtMs;
    handleAudioTimeUpdate();
    lyricClockStartedAtAfterStableTimeUpdate = lyricClockStartedAtMs;
    lyricClockAudioSecondsAtSoftDrift = getAudioCurrentTimeSeconds();
    lyricClockAudioSeconds = lyricClockAudioSecondsAtSoftDrift + 0.12;
    lyricClockStartedAtMs = getMonotonicNowMs();
    lyricClockAudioSecondsBeforeSoftDrift = lyricClockAudioSeconds;
    handleAudioTimeUpdate();
    lyricClockAudioSecondsAfterSoftDrift = lyricClockAudioSeconds;
    lyricClockAudioSeconds = getAudioCurrentTimeSeconds() + 1;
    lyricClockStartedAtMs = getMonotonicNowMs() - 1000;
    lyricClockStartedAtBeforeDriftTimeUpdate = lyricClockStartedAtMs;
    handleAudioTimeUpdate();
    lyricClockStartedAtAfterDriftTimeUpdate = lyricClockStartedAtMs;
    const existingBufferingState = state.isPlaybackBuffering;
    const existingAudioPausedDescriptor = Object.getOwnPropertyDescriptor(audioPlayer, "paused");
    const existingAudioEndedDescriptor = Object.getOwnPropertyDescriptor(audioPlayer, "ended");
    const existingAudioSrc = audioPlayer.getAttribute("src");
    try {
      Object.defineProperty(audioPlayer, "paused", { configurable: true, get: () => false });
      Object.defineProperty(audioPlayer, "ended", { configurable: true, get: () => false });
      audioPlayer.setAttribute("src", getSilentAudioDataUrl());
      lyricProgressFrame = 1;
      lyricClockIsRunning = true;
      handleAudioBufferingStart();
      bufferingStoppedLyricFrame = lyricProgressFrame === 0;
      bufferingPausedLyricClock = lyricClockIsRunning === false;
      lyricProgressFrame = 1;
      state.isPlaybackBuffering = true;
      bufferingBlockedLyricLoop = shouldRunLyricProgressLoop() === false;
    } finally {
      if (existingAudioPausedDescriptor) {
        Object.defineProperty(audioPlayer, "paused", existingAudioPausedDescriptor);
      } else {
        delete audioPlayer.paused;
      }
      if (existingAudioEndedDescriptor) {
        Object.defineProperty(audioPlayer, "ended", existingAudioEndedDescriptor);
      } else {
        delete audioPlayer.ended;
      }
      if (existingAudioSrc) {
        audioPlayer.setAttribute("src", existingAudioSrc);
      } else {
        audioPlayer.removeAttribute("src");
      }
      state.isPlaybackBuffering = existingBufferingState;
      document.body.classList.toggle("is-playback-buffering", existingBufferingState);
    }
    lyricProgressFrame = lyricProgressFrame || 1;
    lyricClockIsRunning = true;
    updateProgress();
    progressWriteCountAfterRafTimeUpdate = progressWriteCount;
    lyricProgressFrame = 0;
    lyricClockIsRunning = false;
    updateProgress();
    progressWriteCountAfterRegularTimeUpdate = progressWriteCount;
    lyricProgressFrame = existingLyricProgressFrame;
    lyricClockIsRunning = existingLyricClockRunning;
    lyricClockAudioSeconds = existingLyricClockAudioSeconds;
    lyricClockStartedAtMs = existingLyricClockStartedAtMs;
    lyricClockPlaybackRate = existingLyricClockPlaybackRate;
    switchView("nowPlaying", { updateHash: false, resetScroll: true });
    progressWriteValues.clear();
    for (let index = 0; index < 45; index += 1) {
      const seconds = 2.4 + (index * 0.05);
      if (updateActiveLyricWordProgressFrame(seconds)) {
        nowPlayingHotPathFrameCount += 1;
      } else {
        updateLyricsHighlight(seconds);
      }
    }
    nowPlayingState = collectBrowserSmokeLyricState();
    nowPlayingProgressWriteCountBeforeTimeUpdate = progressWriteCount;
    lyricProgressFrame = lyricProgressFrame || 1;
    lyricClockIsRunning = true;
    updateProgress();
    nowPlayingProgressWriteCountAfterRafTimeUpdate = progressWriteCount;
    lyricProgressFrame = existingLyricProgressFrame;
    lyricClockIsRunning = existingLyricClockRunning;
  } finally {
    CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
  }
  const durationMs = Math.round((getMonotonicNowMs() - startedAt) * 100) / 100;
  finalState = finalState || collectBrowserSmokeLyricState();
  const progressRatios = finalState.wordProgress.map((value) => Number(value || 0) / 100);

  return {
    wordCount: finalState.wordCount,
    sampleCount,
    durationMs,
    averageUpdateMs: Math.round((durationMs / sampleCount) * 1000) / 1000,
    progressWriteCount: denseProgressWriteCount,
    progressUniqueWriteCount: denseProgressUniqueWriteCount,
    progressFormattedWriteCount: denseProgressFormattedWriteCount,
    rafTimeUpdateProgressWriteCount: progressWriteCountAfterRafTimeUpdate - progressWriteCountBeforeTimeUpdate,
    regularTimeUpdateProgressWriteCount: progressWriteCountAfterRegularTimeUpdate - progressWriteCountAfterRafTimeUpdate,
    nowPlayingRafTimeUpdateProgressWriteCount: nowPlayingProgressWriteCountAfterRafTimeUpdate - nowPlayingProgressWriteCountBeforeTimeUpdate,
    stableTimeUpdateKeptLyricClock: lyricClockStartedAtAfterStableTimeUpdate === lyricClockStartedAtBeforeStableTimeUpdate,
    softDriftAdjustedLyricClock: lyricClockAudioSecondsAfterSoftDrift < lyricClockAudioSecondsBeforeSoftDrift,
    softDriftAvoidedHardResync: lyricClockAudioSecondsAfterSoftDrift > lyricClockAudioSecondsAtSoftDrift
      && lyricClockAudioSecondsAfterSoftDrift < lyricClockAudioSecondsBeforeSoftDrift,
    driftTimeUpdateResyncedLyricClock: lyricClockStartedAtAfterDriftTimeUpdate !== lyricClockStartedAtBeforeDriftTimeUpdate,
    bufferingStoppedLyricFrame,
    bufferingPausedLyricClock,
    bufferingBlockedLyricLoop,
    hotPathFrameCount,
    nowPlayingHotPathFrameCount,
    fullHighlightFrameCount,
    activeIndex: finalState.activeIndex,
    nowPlayingActiveIndex: nowPlayingState?.activeIndex,
    nowPlayingCurrentText: nowPlayingState?.currentText || "",
    maxWordProgress: Math.max(...finalState.wordProgress),
    partialWordCount: finalState.wordProgress.filter((progress) => progress > 0 && progress < 100).length,
    maxRatio: Math.max(...progressRatios),
  };
}

function runBrowserSmokeBilingualDenseLyricPerformanceScenario() {
  const wordCount = 48;
  const sampleCount = 120;
  const wordStepSeconds = 0.16;
  const originalWords = Array.from({ length: wordCount }, (_, index) => {
    const seconds = (index * wordStepSeconds).toFixed(2);
    return `<${seconds}>原${index + 1}`;
  }).join(" ");
  const translatedWords = Array.from({ length: wordCount }, (_, index) => {
    const seconds = (index * wordStepSeconds).toFixed(2);
    return `<${seconds}>译${index + 1}`;
  }).join(" ");
  const track = createBrowserSmokeTrack({
    id: "browser-smoke-bilingual-dense-lyric-track",
    name: "Browser Smoke Bilingual Dense Lyric Track",
    durationSeconds: 16,
    lyricsText: [
      `[00:00.00]${originalWords}`,
      `[00:00.00]${translatedWords}`,
      "[00:12.00]Next bilingual dense lyric line",
    ].join("\n"),
  });
  const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
  let progressWriteCount = 0;
  const progressWriteValues = new Set();
  let progressFormattedWriteCount = 0;
  let hotPathFrameCount = 0;
  let fullHighlightFrameCount = 0;
  let finalState = null;

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
    if (propertyName === "--word-progress") {
      const value = String(args[0] || "");
      progressWriteCount += 1;
      progressWriteValues.add(value);
      if (/^(?:0|100|\d{1,2}\.\d)%$/.test(value)) {
        progressFormattedWriteCount += 1;
      }
    }

    return originalSetProperty.call(this, propertyName, ...args);
  };

  const startedAt = getMonotonicNowMs();
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const seconds = index * 0.055;
      if (updateActiveImmersiveLyricWordProgressFrame(seconds)) {
        hotPathFrameCount += 1;
      } else {
        fullHighlightFrameCount += 1;
        updateLyricsHighlight(seconds);
      }
    }
    finalState = collectBrowserSmokeLyricState();
  } finally {
    CSSStyleDeclaration.prototype.setProperty = originalSetProperty;
  }

  const durationMs = Math.round((getMonotonicNowMs() - startedAt) * 100) / 100;
  finalState = finalState || collectBrowserSmokeLyricState();
  const groupPartialWordCounts = finalState.wordGroups.map((group) => (
    group.wordProgress.filter((progress) => progress > 0 && progress < 100).length
  ));

  return {
    wordCount,
    groupCount: finalState.wordGroups.length,
    groupWordCounts: finalState.wordGroups.map((group) => group.wordCount),
    groupRoles: finalState.wordGroups.map((group) => group.role),
    groupProgressFullWordCounts: finalState.wordGroups.map((group) => group.progressFullWordCount),
    groupProgressPartialWordIndexes: finalState.wordGroups.map((group) => group.progressPartialWordIndex),
    groupPartialWordCounts,
    sampleCount,
    durationMs,
    averageUpdateMs: Math.round((durationMs / sampleCount) * 1000) / 1000,
    progressWriteCount,
    progressUniqueWriteCount: progressWriteValues.size,
    progressFormattedWriteCount,
    hotPathFrameCount,
    fullHighlightFrameCount,
  };
}

function runBrowserSmokeLyricJitterProtectionScenario() {
  const track = createBrowserSmokeTrack({
    id: "browser-smoke-lyric-jitter-track",
    name: "Browser Smoke Lyric Jitter Track",
    durationSeconds: 8,
    lyricsText: [
      "[00:00.00]<0.00>一 <0.50>二 <1.00>三 <1.50>四",
      "[00:04.00]下一句",
    ].join("\n"),
  });
  const collectImmersiveProgress = () => (
    collectBrowserSmokeLyricState().wordGroups?.[0]?.wordProgress || []
  );
  const collectNowPlayingFocusProgress = () => (
    collectBrowserSmokeLyricSurfaceState().focus?.groups?.[0]?.wordProgress || []
  );

  state.lyricOffsetSeconds = 0;
  state.currentTrack = track;
  state.queue = [track];
  state.tracks = [track];
  state.filteredTracks = [track];
  state.currentTrackIndex = 0;
  updatePlayerMeta(track);
  setPlayerEnabled(true);

  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.55, true);

  const jitterTimes = [0.6, 0.7, 0.66, 0.78, 0.74, 0.92];
  const immersiveSecondWordProgressSequence = jitterTimes.map((seconds) => {
    updateActiveImmersiveLyricWordProgressFrame(seconds);
    return collectImmersiveProgress()[1] || 0;
  });

  const boundaryTimes = [0.95, 1.05, 0.98, 1.12];
  const boundaryProgressSequence = boundaryTimes.map((seconds) => {
    updateActiveImmersiveLyricWordProgressFrame(seconds);
    return collectImmersiveProgress();
  });
  const boundarySecondWordProgressSequence = boundaryProgressSequence.map((progress) => progress[1] || 0);
  const boundaryThirdWordProgressSequence = boundaryProgressSequence.map((progress) => progress[2] || 0);

  updateLyricsHighlight(0.2, true);
  const resetAfterForceRefreshProgress = collectImmersiveProgress();

  switchView("nowPlaying", { updateHash: false, resetScroll: true });
  updateLyricsHighlight(0.55, true);
  const nowPlayingTimes = [0.6, 0.7, 0.66, 0.78, 0.74, 0.92];
  const nowPlayingSecondWordProgressSequence = nowPlayingTimes.map((seconds) => {
    updateActiveLyricWordProgressFrame(seconds);
    return collectNowPlayingFocusProgress()[1] || 0;
  });

  return {
    jitterTimes,
    immersiveSecondWordProgressSequence,
    boundaryTimes,
    boundarySecondWordProgressSequence,
    boundaryThirdWordProgressSequence,
    resetAfterForceRefreshProgress,
    nowPlayingTimes,
    nowPlayingSecondWordProgressSequence,
  };
}

function collectBrowserSmokeImmersiveLayoutState() {
  const shell = document.querySelector(".immersive-player-shell");
  setMobileImmersiveStageView("lyrics", { animate: false });
  setDesktopImmersiveStageView("lyrics", { animate: false });
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

  const layoutState = {
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
  setMobileImmersiveStageView("cover", { animate: false });
  setDesktopImmersiveStageView("visualizer", { animate: false });
  return layoutState;
}

function collectBrowserSmokeDesktopImmersiveState() {
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  setDesktopImmersiveStageView("visualizer", { animate: false });
  const isVisibleElement = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const previousTrack = state.currentTrack;
  const previousTimeline = state.lyricTimeline;
  const previousLines = state.lyricLines;
  const previousSynced = state.isLyricSynced;
  const previousIndex = state.activeLyricIndex;
  const track = createBrowserSmokeTrack({
    id: "browser-smoke-desktop-current-bilingual-lyric-track",
    name: "Browser Smoke Desktop Current Bilingual Lyric Track",
    lyricsText: [
      "[00:00.00]I heard that you're settled down",
      "[00:00.01]听说你心有所属",
      "[00:04.00]That you found a girl",
      "[00:04.01]找到真命天女",
    ].join("\n"),
  });

  state.currentTrack = track;
  state.queue = [track];
  state.tracks = [track];
  state.filteredTracks = [track];
  state.currentTrackIndex = 0;
  updatePlayerMeta(track);
  updateLyricsHighlight(1, true);

  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const lyricFocus = immersivePlayerPanel?.querySelector(".immersive-lyric-focus");
  const original = immersiveDesktopCurrentLyric?.querySelector(".immersive-desktop-current-lyric-original");
  const translated = immersiveDesktopCurrentLyric?.querySelector(".immersive-desktop-current-lyric-translated");
  const originalStyle = original ? window.getComputedStyle(original) : null;
  const translatedStyle = translated ? window.getComputedStyle(translated) : null;
  const before = {
    view: shell?.getAttribute("data-desktop-view") || "",
    currentLyricVisible: isVisibleElement(immersiveDesktopCurrentLyric),
    fullLyricVisible: isVisibleElement(lyricFocus),
    currentLyricBilingual: immersiveDesktopCurrentLyric?.classList.contains("is-bilingual") || false,
    currentLyricLineCount: immersiveDesktopCurrentLyric?.querySelectorAll("span").length || 0,
    currentLyricOriginalText: original?.textContent?.trim() || "",
    currentLyricTranslatedText: translated?.textContent?.trim() || "",
    originalFontSizePx: Number.parseFloat(originalStyle?.fontSize || "0") || 0,
    translatedFontSizePx: Number.parseFloat(translatedStyle?.fontSize || "0") || 0,
    originalLineHeight: originalStyle?.lineHeight || "",
    translatedLineHeight: translatedStyle?.lineHeight || "",
  };

  immersiveDesktopStageToggle?.click();
  const afterToggle = {
    view: shell?.getAttribute("data-desktop-view") || "",
    currentLyricVisible: isVisibleElement(immersiveDesktopStageToggle),
    fullLyricVisible: isVisibleElement(lyricFocus),
    activeOriginalText: lyricFocus?.querySelector(".lyric-line.active .immersive-lyric-original")?.textContent?.trim() || "",
    activeTranslatedText: lyricFocus?.querySelector(".lyric-line.active .immersive-lyric-translated")?.textContent?.trim() || "",
  };

  state.currentTrack = previousTrack;
  state.lyricTimeline = previousTimeline;
  state.lyricLines = previousLines;
  state.isLyricSynced = previousSynced;
  state.activeLyricIndex = previousIndex;
  renderImmersiveDesktopCurrentLyric(getCurrentTopLyricLine());
  setDesktopImmersiveStageView("visualizer", { animate: false });

  return {
    before,
    afterToggle,
  };
}

function collectBrowserSmokeMobileImmersiveState() {
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  setMobileImmersiveStageView("cover", { animate: false });
  stopImmersiveVisualizer();

  const originalPlayMode = state.playMode;
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const coverToggle = immersiveMobileStageToggle;
  const lyricFocus = immersivePlayerPanel?.querySelector(".immersive-lyric-focus");
  const offsetValue = immersivePlayerPanel?.querySelector("#immersiveLyricOffsetValue");
  const getRect = (element) => {
    const rect = element?.getBoundingClientRect?.();
    return rect
      ? {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        centerX: Math.round(rect.left + (rect.width / 2)),
      }
      : null;
  };
  const isVisibleElement = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const getImmersiveModalLayerState = (modal, cardSelector) => {
    const card = modal?.querySelector?.(cardSelector);
    const modalStyle = modal ? window.getComputedStyle(modal) : null;
    const cardStyle = card ? window.getComputedStyle(card) : null;
    const panelStyle = immersivePlayerPanel ? window.getComputedStyle(immersivePlayerPanel) : null;

    return {
      visible: isVisibleElement(modal),
      zIndex: Number.parseInt(modalStyle?.zIndex || "0", 10) || 0,
      panelZIndex: Number.parseInt(panelStyle?.zIndex || "0", 10) || 0,
      cardBackgroundColor: cardStyle?.backgroundColor || "",
      cardColor: cardStyle?.color || "",
      backdropFilter: modalStyle?.backdropFilter || modalStyle?.webkitBackdropFilter || "",
    };
  };
  const resetDownloadOptionsSmokeModal = () => {
    if (downloadOptionsCloseTimer) {
      window.clearTimeout(downloadOptionsCloseTimer);
      downloadOptionsCloseTimer = 0;
    }
    if (downloadOptionsModal) {
      downloadOptionsModal.hidden = true;
      downloadOptionsModal.classList.remove("is-open", "is-closing");
      requestAnimationFrame(() => {
        if (downloadOptionsModal.hidden) {
          downloadOptionsModal.classList.remove("is-open", "is-closing");
        }
      });
    }
  };
  const resetAudioQualitySmokeModal = () => {
    if (audioQualityCloseTimer) {
      window.clearTimeout(audioQualityCloseTimer);
      audioQualityCloseTimer = 0;
    }
    if (audioQualityModal) {
      audioQualityModal.hidden = true;
      audioQualityModal.classList.remove("is-open", "is-closing");
      requestAnimationFrame(() => {
        if (audioQualityModal.hidden) {
          audioQualityModal.classList.remove("is-open", "is-closing");
        }
      });
    }
  };
  const getPlayButtonLoadingStyle = () => {
    if (!immersivePlayButton) {
      return {};
    }

    const hadBufferingClass = document.body.classList.contains("is-playback-buffering");
    document.body.classList.add("is-playback-buffering");
    const pseudoStyle = window.getComputedStyle(immersivePlayButton, "::before");
    const loadingStyle = {
      animationName: pseudoStyle.animationName || "",
      animationDuration: pseudoStyle.animationDuration || "",
      backgroundImage: pseudoStyle.backgroundImage || "",
      borderRadius: pseudoStyle.borderRadius || "",
      maskImage: pseudoStyle.maskImage || pseudoStyle.webkitMaskImage || "",
      transform: pseudoStyle.transform || "",
      width: pseudoStyle.width || "",
      height: pseudoStyle.height || "",
    };

    if (!hadBufferingClass) {
      document.body.classList.remove("is-playback-buffering");
    }

    return loadingStyle;
  };
  const previousMobileCurrentLyricTrack = state.currentTrack;
  const previousMobileCurrentLyricTimeline = state.lyricTimeline;
  const previousMobileCurrentLyricLines = state.lyricLines;
  const previousMobileCurrentLyricSynced = state.isLyricSynced;
  const previousMobileCurrentLyricIndex = state.activeLyricIndex;
  const mobileCurrentLyricTrack = createBrowserSmokeTrack({
    id: "browser-smoke-mobile-current-bilingual-lyric-track",
    name: "Browser Smoke Mobile Current Bilingual Lyric Track",
    lyricsText: [
      "[00:00.00]Long cover lyric original line",
      "[00:00.00]封面歌词翻译显示",
      "[00:04.00]Next line",
    ].join("\n"),
  });
  state.currentTrack = mobileCurrentLyricTrack;
  state.queue = [mobileCurrentLyricTrack];
  state.tracks = [mobileCurrentLyricTrack];
  state.filteredTracks = [mobileCurrentLyricTrack];
  state.currentTrackIndex = 0;
  updatePlayerMeta(mobileCurrentLyricTrack);
  updateLyricsHighlight(1, true);

  const playButtonLoadingStyle = getPlayButtonLoadingStyle();
  const before = {
    view: shell?.getAttribute("data-mobile-view") || "",
    coverVisible: isVisibleElement(coverToggle),
    lyricVisible: isVisibleElement(lyricFocus),
    desktopStageVisible: isVisibleElement(immersiveDesktopStageToggle),
    offsetValueVisible: isVisibleElement(offsetValue),
    waveformVisible: isVisibleElement(coverToggle?.querySelector(".immersive-waveform")),
    waveformRect: getRect(coverToggle?.querySelector(".immersive-waveform")),
    coverRect: getRect(coverToggle?.querySelector(".immersive-mobile-cover-proxy")),
    trackCopyRect: getRect(coverToggle?.querySelector(".immersive-mobile-track-copy")),
    topTitleVisible: isVisibleElement(immersiveMobileTitle),
    currentLyricVisible: isVisibleElement(immersiveMobileCurrentLyric),
    currentLyricText: immersiveMobileCurrentLyric?.textContent?.trim() || "",
    currentLyricTitle: immersiveMobileCurrentLyric?.getAttribute("title") || "",
    currentLyricLineCount: immersiveMobileCurrentLyric?.querySelectorAll("span").length || 0,
    currentLyricOriginalText: immersiveMobileCurrentLyric?.querySelector(".immersive-mobile-current-lyric-original")?.textContent?.trim() || "",
    currentLyricTranslatedText: immersiveMobileCurrentLyric?.querySelector(".immersive-mobile-current-lyric-translated")?.textContent?.trim() || "",
    currentLyricBilingual: immersiveMobileCurrentLyric?.classList.contains("is-bilingual") || false,
    viewportCenterX: Math.round(window.innerWidth / 2),
    waveformPathCount: coverToggle?.querySelectorAll(".immersive-waveform-line, .immersive-waveform-fill, .immersive-waveform-runner").length || 0,
    waveformLinePath: coverToggle?.querySelector(".immersive-waveform-line")?.getAttribute("d") || "",
    waveformHasCurvePath: /C/.test(coverToggle?.querySelector(".immersive-waveform-line")?.getAttribute("d") || ""),
    oldVisualizerBarCount: coverToggle?.querySelectorAll(".immersive-visualizer span").length || 0,
    titleText: immersiveMobileTitle?.textContent?.trim() || "",
    qualityText: immersiveMobileDeckQuality?.textContent?.trim() || "",
    topActionsCollapsed: shell?.classList.contains("is-top-actions-collapsed") || false,
    topRevealVisible: isVisibleElement(immersiveTopRevealButton),
    closeVisible: isVisibleElement(immersiveCloseButton),
    topFullscreenVisible: isVisibleElement(immersiveFullscreenButton),
    topFullscreenRect: getRect(immersiveFullscreenButton),
    mobileFullscreenVisible: isVisibleElement(immersiveMobileFullscreenButton),
    topFullscreenTitle: immersiveFullscreenButton?.getAttribute("title") || "",
    playButtonBackground: immersivePlayButton ? window.getComputedStyle(immersivePlayButton).backgroundColor : "",
    playButtonTapHighlight: immersivePlayButton ? window.getComputedStyle(immersivePlayButton).webkitTapHighlightColor : "",
    playButtonLoadingAnimationName: playButtonLoadingStyle.animationName || "",
    playButtonLoadingAnimationDuration: playButtonLoadingStyle.animationDuration || "",
    playButtonLoadingBackgroundImage: playButtonLoadingStyle.backgroundImage || "",
    playButtonLoadingBorderRadius: playButtonLoadingStyle.borderRadius || "",
    playButtonLoadingMaskImage: playButtonLoadingStyle.maskImage || "",
    playButtonLoadingTransform: playButtonLoadingStyle.transform || "",
    playButtonLoadingSize: `${playButtonLoadingStyle.width || ""} ${playButtonLoadingStyle.height || ""}`.trim(),
    controlDeckGapPx: parseFloat(window.getComputedStyle(immersivePlayerPanel?.querySelector(".immersive-control-deck") || document.body).rowGap) || 0,
    modeIconCount: immersiveModeButton?.querySelectorAll(".player-mode-icon").length || 0,
    visibleModeIconCount: [...(immersiveModeButton?.querySelectorAll(".player-mode-icon") || [])]
      .filter((icon) => window.getComputedStyle(icon).display !== "none").length,
    modeBefore: immersiveModeButton?.dataset.mode || "",
  };

  coverToggle?.click();
  const afterToggle = {
    view: shell?.getAttribute("data-mobile-view") || "",
    coverVisible: isVisibleElement(coverToggle),
    lyricVisible: isVisibleElement(lyricFocus),
    desktopStageVisible: isVisibleElement(immersiveDesktopStageToggle),
    ariaPressed: coverToggle?.getAttribute("aria-pressed") || "",
    topActionsCollapsed: shell?.classList.contains("is-top-actions-collapsed") || false,
    topRevealVisible: isVisibleElement(immersiveTopRevealButton),
    topTitleVisible: isVisibleElement(immersiveMobileTitle),
    topTitleRect: getRect(immersiveMobileTitle),
    topSongRect: getRect(immersiveMobileTitle?.querySelector("#immersiveMobileTitle")),
    topTitleFontSizePx: Number.parseFloat(window.getComputedStyle(immersiveMobileTitle || document.body).fontSize) || 0,
    topSongFontSizePx: Number.parseFloat(window.getComputedStyle(immersiveMobileTitle?.querySelector("#immersiveMobileTitle") || immersiveMobileTitle || document.body).fontSize) || 0,
    topArtistFontSizePx: Number.parseFloat(window.getComputedStyle(immersiveMobileArtist || document.body).fontSize) || 0,
    currentLyricVisible: isVisibleElement(immersiveMobileCurrentLyric),
    topTitleText: immersiveMobileTitle?.textContent?.trim() || "",
    topArtistText: immersiveMobileArtist?.textContent?.trim() || "",
    closeVisible: isVisibleElement(immersiveCloseButton),
    topFullscreenVisible: isVisibleElement(immersiveFullscreenButton),
    topFullscreenRect: getRect(immersiveFullscreenButton),
    mobileFullscreenVisible: isVisibleElement(immersiveMobileFullscreenButton),
    topFullscreenTitle: immersiveFullscreenButton?.getAttribute("title") || "",
  };

  immersiveMobileTitleGroup?.click();
  const afterTitleReturn = {
    view: shell?.getAttribute("data-mobile-view") || "",
    coverVisible: isVisibleElement(coverToggle),
    lyricVisible: isVisibleElement(lyricFocus),
    topTitleVisible: isVisibleElement(immersiveMobileTitle),
    topActionsCollapsed: shell?.classList.contains("is-top-actions-collapsed") || false,
    titleRole: immersiveMobileTitleGroup?.getAttribute("role") || "",
    titleTabIndex: immersiveMobileTitleGroup?.getAttribute("tabindex") || "",
  };

  setMobileImmersiveStageView("lyrics", { animate: false });
  immersiveTopRevealButton?.click();
  const afterReveal = {
    topActionsCollapsed: shell?.classList.contains("is-top-actions-collapsed") || false,
    topRevealVisible: isVisibleElement(immersiveTopRevealButton),
    backgroundVisible: isVisibleElement(immersiveBackgroundButton),
    fullscreenVisible: isVisibleElement(immersiveFullscreenButton),
    closeVisible: isVisibleElement(immersiveCloseButton),
    topFullscreenRect: getRect(immersiveFullscreenButton),
    mobileFullscreenVisible: isVisibleElement(immersiveMobileFullscreenButton),
  };

  immersiveModeButton?.click();
  const afterModeClick = {
    mode: immersiveModeButton?.dataset.mode || "",
    title: immersiveModeButton?.getAttribute("title") || "",
    ariaLabel: immersiveModeButton?.getAttribute("aria-label") || "",
  };
  state.playMode = originalPlayMode;
  storage.savePlayMode(state.playMode);
  updatePlayModeButton();

  const originalFavorite = isFavorite(state.currentTrack);
  if (state.currentTrack?.Id) {
    setFavoriteState(state.currentTrack.Id, true);
    renderPlaybackFavoriteButton(immersiveFavoriteButton, state.currentTrack);
    renderPlaybackFavoriteButton(immersiveMobileFavoriteButton, state.currentTrack);
  }
  const mobileFavoriteIcon = immersiveMobileFavoriteButton?.querySelector(".favorite-line-icon");
  const desktopFavoriteIcon = immersiveFavoriteButton?.querySelector(".favorite-line-icon");
  const favoriteState = {
    mobileActive: immersiveMobileFavoriteButton?.classList.contains("active") || false,
    desktopActive: immersiveFavoriteButton?.classList.contains("active") || false,
    mobileFill: mobileFavoriteIcon ? window.getComputedStyle(mobileFavoriteIcon).fill : "",
    desktopFill: desktopFavoriteIcon ? window.getComputedStyle(desktopFavoriteIcon).fill : "",
  };
  if (state.currentTrack?.Id) {
    setFavoriteState(state.currentTrack.Id, originalFavorite);
    renderPlaybackFavoriteButton(immersiveFavoriteButton, state.currentTrack);
    renderPlaybackFavoriteButton(immersiveMobileFavoriteButton, state.currentTrack);
  }

  const downloadTrigger = isVisibleElement(immersiveMobileDownloadButton)
    ? immersiveMobileDownloadButton
    : immersiveDownloadButton;
  downloadTrigger?.click();
  const downloadOptions = {
    exists: Boolean(downloadOptionsModal),
    opened: Boolean(downloadOptionsModal && !downloadOptionsModal.hidden),
    openedByClick: Boolean(downloadOptionsModal && !downloadOptionsModal.hidden),
    triggerId: downloadTrigger?.id || "",
    optionCount: downloadOptionsList?.querySelectorAll(".download-option").length || 0,
    subtitle: downloadOptionsSubtitle?.textContent?.trim() || "",
    layer: getImmersiveModalLayerState(downloadOptionsModal, ".download-options-card"),
  };
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  downloadOptions.closedByOutside = Boolean(downloadOptionsModal?.classList.contains("is-closing") || downloadOptionsModal?.hidden);
  resetDownloadOptionsSmokeModal();

  const qualityTrigger = isVisibleElement(immersiveMobileQualityButton)
    ? immersiveMobileQualityButton
    : immersiveQualityButton;
  qualityTrigger?.click();
  const audioQualityOptions = {
    exists: Boolean(audioQualityModal),
    opened: Boolean(audioQualityModal && !audioQualityModal.hidden),
    openedByClick: Boolean(audioQualityModal && !audioQualityModal.hidden),
    triggerId: qualityTrigger?.id || "",
    optionCount: audioQualityList?.querySelectorAll(".audio-quality-option").length || 0,
    subtitle: audioQualitySubtitle?.textContent?.trim() || "",
    layer: getImmersiveModalLayerState(audioQualityModal, ".audio-quality-card"),
  };
  document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  audioQualityOptions.closedByOutside = Boolean(audioQualityModal?.classList.contains("is-closing") || audioQualityModal?.hidden);
  resetAudioQualitySmokeModal();

  const moreTrigger = isVisibleElement(immersiveMobileMoreButton)
    ? immersiveMobileMoreButton
    : immersiveMoreButton;
  moreTrigger?.click();
  const firstActionSheetItem = trackActionSheetList?.querySelector(".action-sheet-item");
  firstActionSheetItem?.focus?.({ preventScroll: true });
  const firstActionSheetItemStyle = firstActionSheetItem ? window.getComputedStyle(firstActionSheetItem) : null;
  const moreActionSheet = {
    openedByClick: Boolean(trackActionSheet && !trackActionSheet.hidden),
    triggerId: moreTrigger?.id || "",
    labels: [...trackActionSheetList.querySelectorAll(".action-sheet-copy strong")].map((item) => item.textContent?.trim() || ""),
    layer: getImmersiveModalLayerState(trackActionSheet, ".action-sheet-card"),
    focusedItemBackground: firstActionSheetItemStyle?.backgroundColor || "",
    focusedItemOutline: firstActionSheetItemStyle?.outlineStyle || "",
    focusedItemBoxShadow: firstActionSheetItemStyle?.boxShadow || "",
    focusedItemTapHighlight: firstActionSheetItemStyle?.webkitTapHighlightColor || "",
  };
  const playerStyleItem = [...trackActionSheetList.querySelectorAll("button")]
    .find((button) => /播放器样式/.test(button.textContent || ""));
  const originalPlayerStyleForSmoke = normalizeImmersivePlayerStyle(state.immersivePlayerStyle);
  playerStyleItem?.click();
  const fluidThemeButton = playerStyleModal?.querySelector('[data-player-theme="fluid"]');
  const ribbonVisualizerButton = playerStyleModal?.querySelector('[data-visualizer-style="ribbon"]');
  fluidThemeButton?.click();
  ribbonVisualizerButton?.click();
  const playerStyleShell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const activePlayerThemeButton = playerStyleModal?.querySelector('[data-player-theme="fluid"]');
  const activeVisualizerButton = playerStyleModal?.querySelector('[data-visualizer-style="ribbon"]');
  const activeThemeStyle = activePlayerThemeButton ? window.getComputedStyle(activePlayerThemeButton) : null;
  const playerStyleCard = playerStyleModal?.querySelector(".player-style-card");
  const playerStyleCardStyle = playerStyleCard ? window.getComputedStyle(playerStyleCard) : null;
  const playerStyleStack = playerStyleModal?.querySelector(".player-style-stack");
  const playerStyleStackStyle = playerStyleStack ? window.getComputedStyle(playerStyleStack) : null;
  moreActionSheet.playerStyleOpened = Boolean(playerStyleModal && !playerStyleModal.hidden);
  moreActionSheet.playerThemeChoiceCount = playerStyleModal?.querySelectorAll("[data-player-theme]").length || 0;
  moreActionSheet.visualizerStyleChoiceCount = playerStyleModal?.querySelectorAll("[data-visualizer-style]").length || 0;
  moreActionSheet.playerStyleAppliedTheme = state.immersivePlayerStyle?.theme || "";
  moreActionSheet.playerStyleAppliedVisualizer = state.immersivePlayerStyle?.visualizer || "";
  moreActionSheet.playerStyleShellFluid = playerStyleShell?.classList.contains("is-fluid-bg") || false;
  moreActionSheet.playerStyleShellVisualizer = playerStyleShell?.getAttribute("data-visualizer-style") || "";
  moreActionSheet.playerStyleFluidPressed = activePlayerThemeButton?.getAttribute("aria-pressed") || "";
  moreActionSheet.playerStyleRibbonPressed = activeVisualizerButton?.getAttribute("aria-pressed") || "";
  moreActionSheet.playerStyleFluidCurrent = activePlayerThemeButton?.hasAttribute("data-current") || false;
  moreActionSheet.playerStyleRibbonCurrent = activeVisualizerButton?.hasAttribute("data-current") || false;
  moreActionSheet.playerStyleFluidAriaLabel = activePlayerThemeButton?.getAttribute("aria-label") || "";
  moreActionSheet.playerStyleRibbonAriaLabel = activeVisualizerButton?.getAttribute("aria-label") || "";
  moreActionSheet.playerStyleActiveBorderColor = activeThemeStyle?.borderColor || "";
  moreActionSheet.playerStyleCardMaxHeight = playerStyleCardStyle?.maxHeight || "";
  moreActionSheet.playerStyleCardMinHeight = playerStyleCardStyle?.minHeight || "";
  moreActionSheet.playerStyleCardOverflow = playerStyleCardStyle?.overflow || "";
  moreActionSheet.playerStyleCardRect = getRect(playerStyleCard);
  moreActionSheet.playerStyleStackOverflowY = playerStyleStackStyle?.overflowY || "";
  moreActionSheet.playerStyleStackScrollbarWidth = playerStyleStackStyle?.scrollbarWidth || "";
  moreActionSheet.viewportHeight = Math.round(window.innerHeight || 0);
  moreActionSheet.playerStyleLayer = getImmersiveModalLayerState(playerStyleModal, ".player-style-card");
  state.immersivePlayerStyle = originalPlayerStyleForSmoke;
  applyImmersivePlayerStyle({ save: true });
  closePlayerStyleModal();
  if (playerStyleCloseTimer) {
    window.clearTimeout(playerStyleCloseTimer);
    playerStyleCloseTimer = 0;
  }
  if (playerStyleModal) {
    playerStyleModal.hidden = true;
    playerStyleModal.classList.remove("is-open", "is-closing");
  }
  moreTrigger?.click();
  const lyricSettingsItem = [...trackActionSheetList.querySelectorAll("button")]
    .find((button) => /歌词设置/.test(button.textContent || ""));
  lyricSettingsItem?.click();
  const activeImmersiveLyricLine = immersiveLyricList?.querySelector(".lyric-line.active, p.active");
  const lyricFontSizeBeforeSetting = Number.parseFloat(window.getComputedStyle(activeImmersiveLyricLine || immersiveLyricList || document.body).fontSize) || 0;
  const originalLyricFontSizeRangeValue = lyricFontSizeRange?.value || "100";
  if (lyricFontSizeRange) {
    lyricFontSizeRange.value = "125";
    lyricFontSizeRange.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const lyricFontSizeAfterSetting = Number.parseFloat(window.getComputedStyle(activeImmersiveLyricLine || immersiveLyricList || document.body).fontSize) || 0;
  const lyricSettingsSavePendingBeforeClose = Boolean(lyricSettingsSaveTimer);
  moreActionSheet.lyricSettingsOpened = Boolean(lyricSettingsModal && !lyricSettingsModal.hidden);
  moreActionSheet.lyricSettingsAutoScrollChecked = Boolean(lyricAutoScrollToggle?.checked);
  moreActionSheet.lyricSettingsAutoImmersiveChecked = Boolean(lyricAutoImmersiveToggle?.checked);
  moreActionSheet.lyricSettingsLayer = getImmersiveModalLayerState(lyricSettingsModal, ".lyric-settings-card");
  moreActionSheet.lyricFontSizeBeforeSetting = lyricFontSizeBeforeSetting;
  moreActionSheet.lyricFontSizeAfterSetting = lyricFontSizeAfterSetting;
  moreActionSheet.lyricFontSizeRangeValue = lyricFontSizeRange?.value || "";
  closeLyricSettingsModal();
  moreActionSheet.lyricSettingsSavePendingBeforeClose = lyricSettingsSavePendingBeforeClose;
  moreActionSheet.lyricSettingsSavePendingAfterClose = Boolean(lyricSettingsSaveTimer);
  try {
    moreActionSheet.lyricSettingsStoredFontScaleAfterClose = JSON.parse(localStorage.getItem(LYRIC_SETTINGS_KEY) || "{}")?.fontScale;
  } catch {
    moreActionSheet.lyricSettingsStoredFontScaleAfterClose = null;
  }
  if (lyricFontSizeRange) {
    lyricFontSizeRange.value = originalLyricFontSizeRangeValue;
    lyricFontSizeRange.dispatchEvent(new Event("input", { bubbles: true }));
  }
  flushLyricSettingsSave();
  if (lyricSettingsCloseTimer) {
    window.clearTimeout(lyricSettingsCloseTimer);
    lyricSettingsCloseTimer = 0;
  }
  if (lyricSettingsModal) {
    lyricSettingsModal.hidden = true;
    lyricSettingsModal.classList.remove("is-open", "is-closing");
  }
  closeTrackActionSheet({ restoreFocus: false });
  setMobileImmersiveStageView("cover");
  state.currentTrack = previousMobileCurrentLyricTrack;
  state.lyricTimeline = previousMobileCurrentLyricTimeline;
  state.lyricLines = previousMobileCurrentLyricLines;
  state.isLyricSynced = previousMobileCurrentLyricSynced;
  state.activeLyricIndex = previousMobileCurrentLyricIndex;
  renderImmersiveMobileCurrentLyric(getCurrentTopLyricLine());

  return {
    before,
    afterToggle,
    afterTitleReturn,
    afterReveal,
    afterModeClick,
    favoriteState,
    downloadOptions,
    audioQualityOptions,
    moreActionSheet,
  };
}

function runImmersiveVisualizerScenario() {
  switchView("immersivePlayer", { updateHash: false, resetScroll: true });
  setMobileImmersiveStageView("cover");

  const pointCount = 72;
  const waveform = getImmersiveWaveformParts();
  const silentTimeData = new Uint8Array(2048);
  silentTimeData.fill(128);
  const silentFrequencyData = new Uint8Array(1024);
  const activeTimeData = new Uint8Array(2048);
  const activeFrequencyData = new Uint8Array(1024);

  activeTimeData.forEach((_, index) => {
    activeTimeData[index] = clamp(Math.round(128 + (Math.sin(index * 0.12) * 42) + (Math.sin(index * 0.031) * 18)), 0, 255);
  });
  activeFrequencyData.forEach((_, index) => {
    const ratio = index / Math.max(1, activeFrequencyData.length - 1);
    const bassBump = Math.exp(-Math.pow((ratio - 0.035) / 0.034, 2)) * 210;
    const midBump = Math.exp(-Math.pow((ratio - 0.22) / 0.08, 2)) * 132;
    const trebleBump = Math.exp(-Math.pow((ratio - 0.62) / 0.12, 2)) * 70;
    activeFrequencyData[index] = clamp(Math.round(bassBump + midBump + trebleBump), 0, 255);
  });

  const silentStats = getImmersiveVisualizerAudioStats(silentTimeData, silentFrequencyData);
  const activeStats = getImmersiveVisualizerAudioStats(activeTimeData, activeFrequencyData);
  immersiveVisualizerLevels = getImmersiveWaveformFallbackLevels(pointCount, 0, { idle: true });
  immersiveVisualizerPhase = 0;
  const quietLevels = getImmersiveVisualizerReactiveLevels(pointCount, 1, {
    ...activeStats,
    rms: activeStats.rms * 0.12,
    peak: activeStats.peak * 0.12,
    timePeak: activeStats.timePeak * 0.12,
    frequencyPeak: activeStats.frequencyPeak * 0.12,
    frequencyEnergy: activeStats.frequencyEnergy * 0.12,
    bass: activeStats.bass * 0.12,
    lowMid: activeStats.lowMid * 0.12,
    mid: activeStats.mid * 0.12,
    treble: activeStats.treble * 0.12,
    energy: activeStats.energy * 0.18,
  });
  immersiveVisualizerLevels = quietLevels;
  renderImmersiveWaveform(quietLevels, Math.max(...quietLevels.map(Math.abs)));
  const quietPath = waveform.line?.getAttribute("d") || "";
  const quietPeak = Math.max(...quietLevels.map(Math.abs));
  const quietGlow = Number.parseFloat(waveform.root?.style.getPropertyValue("--wave-glow") || "0") || 0;

  const loudLevels = getImmersiveVisualizerReactiveLevels(pointCount, 1.18, activeStats);
  immersiveVisualizerLevels = loudLevels;
  renderImmersiveWaveform(loudLevels, Math.max(...loudLevels.map(Math.abs)));
  const loudPath = waveform.line?.getAttribute("d") || "";
  const loudPeak = Math.max(...loudLevels.map(Math.abs));
  const loudGlow = Number.parseFloat(waveform.root?.style.getPropertyValue("--wave-glow") || "0") || 0;

  return {
    hasWaveform: Boolean(waveform.line && waveform.fill),
    silentStatsLive: isImmersiveVisualizerAudioStatsLive(silentStats),
    activeStatsLive: isImmersiveVisualizerAudioStatsLive(activeStats),
    activeEnergy: activeStats.energy,
    activeBass: activeStats.bass,
    activeTreble: activeStats.treble,
    quietPeak,
    loudPeak,
    quietGlow,
    loudGlow,
    pathChanged: quietPath !== loudPath,
    usesFrequencyData: Boolean(immersiveVisualizerFrequencyData === null || immersiveVisualizerLastStats?.frequencyEnergy >= 0),
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
  if (loginEntryVersion) {
    loginEntryVersion.textContent = `v${APP_VERSION}`;
  }
  bindLoginSheetEvents();
  bindLoginModeSwipe();
  syncLoginSourceMode();
  syncLoginActionButtons();
}

function openLoginSheet() {
  loginView.classList.add("login-sheet-open");
  document.body.classList.add("login-sheet-locked");
}

function closeLoginSheet() {
  loginView.classList.remove("login-sheet-open");
  document.body.classList.remove("login-sheet-locked");
}

function bindLoginSheetEvents() {
  if (openLoginSheetButton) {
    openLoginSheetButton.addEventListener("click", () => {
      openLoginSheet();
      renderSavedAccounts();
    });
  }

  loginSheetCloseTargets.forEach((target) => {
    target.addEventListener("click", closeLoginSheet);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && loginView.classList.contains("login-sheet-open")) {
      closeLoginSheet();
    }
  });
}

function bindLoginModeSwipe() {
  if (!loginModeSwipeArea) {
    return;
  }

  let startX = null;

  loginModeSwipeArea.addEventListener(
    "touchstart",
    (event) => {
      startX = event.changedTouches[0]?.clientX ?? null;
    },
    { passive: true }
  );

  loginModeSwipeArea.addEventListener(
    "touchend",
    (event) => {
      if (startX === null) {
        return;
      }
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      startX = null;
      if (Math.abs(delta) < 40) {
        return;
      }
      // 左滑 → Emby，右滑 → 音源桥
      setLoginSourceMode(delta < 0 ? "emby" : "external");
    },
    { passive: true }
  );
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

  if (loginModeSwipeArea) {
    loginModeSwipeArea.dataset.activeMode = mode;
  }

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
    const media = await externalSourceApi.fetchMediaSource(getExternalTrackApiUrl(track), track, {
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
    console.info(redact.redactText(diagnostics));
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
    const apiUrl = syncExternalSourceSessionApiUrl(session);
    const info = apiUrl
      ? await externalSourceApi.fetchHealth(apiUrl)
      : { name: "音源桥", version: "-", offline: true };
    const currentSession = state.session && isExternalSourceSession(state.session) ? state.session : session;
    const nextSession = {
      ...buildExternalSourceSession(apiUrl, info),
      savedAt: currentSession.savedAt || session.savedAt || new Date().toISOString(),
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
  state.totalPlaylistTracks = 0;
  state.hasMorePlaylistTracks = false;
  state.isLoadingMorePlaylistTracks = false;
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
    abortActiveServerSearch();
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
    abortActiveServerSearch();
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
  abortActiveServerSearch();
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
  currentServer.textContent = redact.redactServer(isBridge ? getSourceBridgeDisplayUrl(session) : (session.serverUrl || "")) || "-";
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
  accountMenuServer.textContent = isBridge
    ? (redact.redactServer(getSourceBridgeDisplayUrl(session)) || "-")
    : (session.serverName || redact.redactServer(session.serverUrl) || "-");
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

function loadListenTimeTotalSeconds() {
  const value = Number(localStorage.getItem(LISTEN_TIME_TOTAL_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function saveListenTimeTotalSeconds() {
  try {
    localStorage.setItem(LISTEN_TIME_TOTAL_KEY, String(Math.floor(Math.max(0, state.listenTimeTotalSeconds || 0))));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function formatListenTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const restHours = hours % 24;
    return restHours ? `${days}天${restHours}小时` : `${days}天`;
  }

  if (hours > 0) {
    const restMinutes = minutes % 60;
    return restMinutes ? `${hours}小时${restMinutes}分钟` : `${hours}小时`;
  }

  return `${Math.max(0, minutes)}分钟`;
}

function resetListenTimeTick() {
  state.listenTimeLastTickSeconds = getAudioCurrentTimeSeconds();
}

function flushListenTimeRecord(options = {}) {
  if (state.listenTimeUnsavedSeconds >= LISTEN_TIME_SAVE_INTERVAL_SECONDS || options.force) {
    state.listenTimeUnsavedSeconds = 0;
    saveListenTimeTotalSeconds();
    renderMobileProfilePage();
  }
}

function recordListenTimeFromProgress() {
  if (!state.currentTrack || audioPlayer.paused || audioPlayer.ended || state.isChangingTrack) {
    resetListenTimeTick();
    return;
  }

  const current = getAudioCurrentTimeSeconds();
  const previous = Number(state.listenTimeLastTickSeconds) || 0;
  state.listenTimeLastTickSeconds = current;

  if (current <= 0 || previous <= 0) {
    return;
  }

  const delta = current - previous;
  if (!Number.isFinite(delta) || delta <= 0 || delta > 3.5) {
    return;
  }

  state.listenTimeTotalSeconds += delta;
  state.listenTimeUnsavedSeconds += delta;
  flushListenTimeRecord();
}

function renderMobileProfilePage() {
  if (!mobileProfileName) {
    return;
  }

  const session = state.session || {};
  const hasSession = Boolean(state.session);
  const isBridge = hasSession && isExternalSourceSession(session);
  const sourceLabel = isBridge ? "音乐桥" : "Emby";
  const accountName = hasSession
    ? (
      isBridge
        ? (session.serverName || "音乐桥")
        : (session.userName || session.serverName || "Emby 用户")
    )
    : "Aurora Music";
  const libraryLabel = hasSession
    ? (isBridge ? getSourceBridgeLibraryLabel() : getLibraryViewLabel())
    : "私人音乐库";
  const isProfileOnline = hasSession && state.isBrowserOnline !== false;
  const statusLabel = isProfileOnline
    ? `在线 · ${sourceLabel}`
    : "离线";
  const trackTotal = state.totalTracks || state.tracks.length;
  const avatarInitial = getAvatarInitial(accountName);
  const avatarSeed = hasSession
    ? `${sourceLabel} ${accountName}`
    : "Aurora Music";

  setTextIfChanged(mobileProfileAvatarInitial, avatarInitial);
  setAttributeIfChanged(mobileProfileAvatarImage, "src", getMobileProfileAvatarUrl(avatarSeed));
  setTextIfChanged(mobileProfileName, accountName);
  setTextIfChanged(mobileProfileSourceBadge, sourceLabel);
  setTextIfChanged(mobileProfileSubtitle, hasSession
    ? `${sourceLabel} · ${libraryLabel}`
    : "登录后同步你的私人音乐库");
  setTextIfChanged(mobileProfileStatusText, statusLabel);
  mobileProfileStatusDot?.classList.toggle("online", isProfileOnline);
  mobileProfileStatusDot?.classList.toggle("offline", !isProfileOnline);
  setTextIfChanged(mobileProfileListenTime, formatListenTime(state.listenTimeTotalSeconds));
  renderMobileProfileTabs();
  renderMobileProfileContentList({
    sourceLabel,
    libraryLabel,
    trackTotal,
    isBridge,
    hasSession,
  });
}

function getMobileProfileAvatarUrl(seed) {
  const safeSeed = encodeURIComponent(String(seed || "Aurora Music").slice(0, 80));
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${safeSeed}&backgroundColor=ffccd5,ffd6de,fff1f2&radius=50`;
}

function bindMobileProfileTabs() {
  mobileProfileMainTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.profileMainTab;
      if (!tab || tab === state.mobileProfileMainTab) {
        return;
      }
      state.mobileProfileMainTab = tab;
      renderMobileProfilePage();
    });
  });

  mobileProfileSubTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.profileSubTab;
      if (!tab || tab === state.mobileProfileSubTab) {
        return;
      }
      state.mobileProfileSubTab = tab;
      renderMobileProfilePage();
    });
  });
}

function renderMobileProfileTabs() {
  mobileProfileMainTabButtons.forEach((button) => {
    const isActive = button.dataset.profileMainTab === state.mobileProfileMainTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  mobileProfileSubTabButtons.forEach((button) => {
    const isActive = button.dataset.profileSubTab === state.mobileProfileSubTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function renderMobileProfileContentList(context = {}) {
  if (!mobileProfileContentList) {
    return;
  }

  const items = getMobileProfileContentItems(context);
  mobileProfileContentList.replaceChildren();

  items.forEach((item) => {
    mobileProfileContentList.append(createMobileProfileContentButton(item));
  });
}

function getMobileProfileContentItems(context = {}) {
  const trackTotal = context.trackTotal ?? (state.totalTracks || state.tracks.length);
  const albumTotal = state.totalAlbums || state.albums.length;
  const playlistTotal = state.totalPlaylists || state.playlists.length;
  const favoriteTrackTotal = state.totalFavorites
    || state.favoriteTracks.length
    || state.filteredFavoriteTracks.length
    || getFilteredFavoriteCount();
  const favoriteAlbumTotal = state.filteredFavoriteAlbums.length;
  const favoritePlaylistTotal = state.filteredFavoritePlaylists.length;
  const recentTotal = state.recentTracks.length;
  const queueTotal = state.queue.length;
  const libraryLabel = context.libraryLabel || "音乐库";
  const qualityMeta = context.hasSession
    ? [getCurrentPlaybackSourceLabel(), getSettingsAudioQualityLabel()].filter(Boolean).join(" · ")
    : "登录后可管理音质、缓存与连接";
  const latestRecentName = state.recentTracks[0]?.Name || "听歌记录";
  const latestAlbumName = state.recentTracks.find((track) => track?.Album)?.Album || state.albums[0]?.Name || "专辑记录";
  const latestPlaylistName = state.playlists[0]?.Name || "歌单记录";

  const datasets = {
    music: {
      overview: [
        { title: "全部音乐", meta: `${formatCount(trackTotal)} 首 · ${libraryLabel}`, icon: "music", tone: "library", action: () => switchView("library") },
        { title: "我的收藏", meta: favoriteTrackTotal ? `${formatCount(favoriteTrackTotal)} 个收藏` : "0 个收藏", icon: "heart", tone: "liked", action: () => switchView("favorites") },
        { title: "最近播放", meta: recentTotal ? `${formatCount(recentTotal)} 首 · ${latestRecentName}` : "0 首 · 听歌记录", icon: "recent", tone: "recent", action: () => switchView("recent") },
        { title: "播放队列", meta: queueTotal ? getQueueMetaText() : "0 首 · 暂无待播", icon: "queue", tone: "queue", action: () => switchView("queue") },
        { title: context.isBridge ? "音乐桥与播放" : "Emby 与播放", meta: qualityMeta, icon: "sliders", tone: "source", action: () => openAudioQualityModal() },
      ],
      recent: [
        { title: "最近播放", meta: recentTotal ? `${formatCount(recentTotal)} 首 · ${latestRecentName}` : "还没有听歌记录", icon: "recent", tone: "recent", action: () => switchView("recent") },
        { title: "继续收听", meta: state.recentTracks[0] ? state.recentTracks[0].Name : "最近播放会显示在这里", icon: "play", tone: "play", action: () => playTrackCollection(state.recentTracks, "最近播放") },
        { title: "最近加入", meta: getTrackCollectionMeta(state.filteredTracks.slice(0, 16), "0 首歌曲"), icon: "music", tone: "library", action: () => switchView("library") },
      ],
      favorites: [
        { title: "收藏歌曲", meta: `${formatCount(state.filteredFavoriteTracks.length || state.favoriteTracks.length)} 首 · ${getTrackCollectionDuration(state.filteredFavoriteTracks) || "歌曲"}`, icon: "heart", tone: "liked", action: () => switchView("favorites") },
        { title: "收藏专辑", meta: `${formatCount(favoriteAlbumTotal)} 张专辑`, icon: "album", tone: "album", action: () => switchView("favorites") },
        { title: "收藏歌单", meta: `${formatCount(favoritePlaylistTotal)} 个歌单`, icon: "playlist", tone: "playlist", action: () => switchView("favorites") },
      ],
    },
    playlists: {
      overview: [
        { title: "全部歌单", meta: `${formatCount(playlistTotal)} 个歌单`, icon: "playlist", tone: "playlist", action: () => switchView("playlists") },
        { title: "收藏歌单", meta: `${formatCount(favoritePlaylistTotal)} 个收藏`, icon: "heart", tone: "liked", action: () => switchView("favorites") },
        { title: "新建歌单", meta: "整理私人播放清单", icon: "plus", tone: "queue", action: () => openCreatePlaylistModal() },
      ],
      recent: [
        { title: "最近相关歌单", meta: latestPlaylistName, icon: "recent", tone: "recent", action: () => switchView("playlists") },
        ...state.playlists.slice(0, 3).map((playlist) => ({
          title: playlist.Name || "未命名歌单",
          meta: getPlaylistSubtitle(playlist),
          icon: "playlist",
          tone: "playlist",
          action: () => openPlaylistDetail(playlist),
        })),
      ],
      favorites: [
        { title: "收藏歌单", meta: `${formatCount(favoritePlaylistTotal)} 个收藏`, icon: "heart", tone: "liked", action: () => switchView("favorites") },
        ...state.filteredFavoritePlaylists.slice(0, 3).map((playlist) => ({
          title: playlist.Name || "未命名歌单",
          meta: getPlaylistSubtitle(playlist),
          icon: "playlist",
          tone: "playlist",
          action: () => openPlaylistDetail(playlist),
        })),
      ],
    },
    albums: {
      overview: [
        { title: "全部专辑", meta: `${formatCount(albumTotal)} 张专辑`, icon: "album", tone: "album", action: () => switchView("albums") },
        { title: "收藏专辑", meta: `${formatCount(favoriteAlbumTotal)} 张收藏`, icon: "heart", tone: "liked", action: () => switchView("favorites") },
        { title: "最近专辑", meta: latestAlbumName, icon: "recent", tone: "recent", action: () => switchView("albums") },
      ],
      recent: [
        { title: "最近播放专辑", meta: latestAlbumName, icon: "recent", tone: "recent", action: () => switchView("recent") },
        ...getRecentAlbumsForMobileProfile().slice(0, 3).map((album) => ({
          title: album.Name || "未命名专辑",
          meta: getAlbumSubtitle(album),
          icon: "album",
          tone: "album",
          action: () => openAlbumDetail(album),
        })),
      ],
      favorites: [
        { title: "收藏专辑", meta: `${formatCount(favoriteAlbumTotal)} 张收藏`, icon: "heart", tone: "liked", action: () => switchView("favorites") },
        ...state.filteredFavoriteAlbums.slice(0, 3).map((album) => ({
          title: album.Name || "未命名专辑",
          meta: getAlbumSubtitle(album),
          icon: "album",
          tone: "album",
          action: () => openAlbumDetail(album),
        })),
      ],
    },
  };

  const selected = datasets[state.mobileProfileMainTab]?.[state.mobileProfileSubTab] || datasets.music.overview;
  return selected.length ? selected : [{
    title: "暂无内容",
    meta: "刷新音乐库后会显示更多项目",
    icon: "music",
    tone: "source",
    action: () => switchView("library"),
  }];
}

function getRecentAlbumsForMobileProfile() {
  const albums = [];
  const seen = new Set();

  state.recentTracks.forEach((track) => {
    const album = findAlbumForTrack(track);
    const key = album?.Id || album?.Name;
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    albums.push(album);
  });

  return albums;
}

function createMobileProfileContentButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mobile-profile-playlist";
  button.title = item.title || "";
  button.addEventListener("click", () => {
    if (typeof item.action === "function") {
      item.action();
    }
  });

  const cover = document.createElement("span");
  cover.className = `mobile-profile-playlist-cover ${item.tone || ""}`.trim();
  setStaticMarkup(cover, getMobileProfileIconMarkup(item.icon));

  const copy = document.createElement("span");
  copy.className = "mobile-profile-playlist-copy";

  const title = document.createElement("strong");
  title.textContent = item.title || "未命名";

  const meta = document.createElement("span");
  meta.textContent = item.meta || "";

  copy.append(title, meta);
  const dots = document.createElement("span");
  dots.className = "mobile-profile-more-dots";
  dots.setAttribute("aria-hidden", "true");
  setStaticMarkup(dots, "<i></i><i></i><i></i>");

  button.append(cover, copy, dots);
  return button;
}

function getMobileProfileIconMarkup(icon) {
  const icons = {
    music: '<path d="M9 18V6l10-2v12"></path><circle cx="6" cy="18" r="2.5"></circle><circle cx="16" cy="16" r="2.5"></circle>',
    heart: '<path d="M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 1 0-7.2 7.2l1 1L12 21l7.2-7 1-1a5.1 5.1 0 0 0 0-7.2Z"></path>',
    recent: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 5v5h5"></path><path d="M12 7v5l3 2"></path>',
    queue: '<path d="M5 6h14"></path><path d="M5 12h14"></path><path d="M5 18h9"></path>',
    sliders: '<path d="M4 7h10"></path><path d="M18 7h2"></path><circle cx="16" cy="7" r="2"></circle><path d="M4 17h3"></path><path d="M11 17h9"></path><circle cx="9" cy="17" r="2"></circle>',
    playlist: '<path d="M5 6h11"></path><path d="M5 12h14"></path><path d="M5 18h8"></path><path d="m17 16 3 2-3 2Z"></path>',
    album: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 4v3"></path>',
    play: '<path d="M8 5v14l11-7Z"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  };

  return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[icon] || icons.music}</svg>`;
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
  renderMobileProfilePage();
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
  return getSessionExternalSourceApiUrl(session) || state.externalSourceApiUrl || "";
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

  scrollElementIntoContainerView(libraryTrackList, targetRow, { block: "center", behavior: "smooth" });
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
  scrollElementIntoContainerView(quickQueueList, item, { behavior: "smooth", block: "center" });
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
  scrollElementIntoNearestContainerView(row, { behavior: "smooth", block: "center" });
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
    forceExternalResolve: isExternalSourceTrack(state.currentTrack),
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
  if (state.recentTracks.length) {
    setStaticMarkup(homeRecentPlayedList, homeTrackSkeletonMarkup("正在加载最近播放..."));
  } else {
    homeRecentPlayedList.replaceChildren();
  }
  appendLoading(homePlaylistGrid, "正在加载歌单...");
  appendLoading(homeFavoriteAlbumGrid, "正在加载收藏专辑...");
  appendLoading(allAlbumGrid, "正在加载专辑...");
  appendLoading(playlistGrid, "正在加载歌单...");
  appendLoading(favoritePlaylistGrid, "正在加载收藏歌单...");
  appendLoading(favoriteAlbumGrid, "正在加载收藏专辑...");
  appendLoading(favoriteArtistGrid, "正在加载收藏艺人...");
  setStaticMarkup(recentTrackList, homeTrackSkeletonMarkup("正在加载歌曲..."));
  appendLoading(libraryTrackList, "正在加载歌曲...");
  appendLoading(artistGrid, "正在加载艺人...");
  appendLoading(favoriteTrackList, "正在加载收藏...");
  renderRecent();
  appendEmpty(queueTrackList, { text: "播放队列为空。" });
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
  appendEmpty(homeRecentPlayedList, { text: message });
  appendEmpty(homePlaylistGrid, { text: message });
  appendEmpty(homeFavoriteAlbumGrid, { text: message });
  appendEmpty(allAlbumGrid, { text: message });
  appendEmpty(playlistGrid, { text: message });
  appendEmpty(favoritePlaylistGrid, { text: message });
  appendEmpty(favoriteAlbumGrid, { text: message });
  appendEmpty(favoriteArtistGrid, { text: message });
  appendEmpty(recentTrackList, { text: message });
  appendEmpty(libraryTrackList, { text: message });
  appendEmpty(favoriteTrackList, { text: message });
  appendEmpty(artistGrid, { text: message });
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

  setStaticMarkup(wrapper, `<svg class="line-icon action-icon-${iconName}" viewBox="0 0 24 24" aria-hidden="true">${ACTION_ICON_PATHS[iconName]}</svg>`);
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
  renderTrackActionSheetDetail(options.detailRenderer);

  enabledItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-sheet-item ${item.tone === "danger" ? "danger" : ""}`.trim();
    button.disabled = Boolean(item.disabled);
    if (item.id) {
      button.dataset.actionSheetItemId = item.id;
    }
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
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.disabled) {
        return;
      }

      if (item.keepOpen) {
        item.handler();
        if (!item.skipDetailRefresh) {
          renderTrackActionSheetDetail(options.detailRenderer, item);
        }
        button.classList.add("is-live-updated");
        window.setTimeout(() => button.classList.remove("is-live-updated"), 420);
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

function renderTrackActionSheetDetail(renderer, item = null) {
  if (!trackActionSheetDetail) {
    return;
  }

  trackActionSheetDetail.replaceChildren();
  if (typeof renderer !== "function") {
    trackActionSheetDetail.hidden = true;
    syncActionSheetNavigationButtons();
    return;
  }

  const content = renderer(item);
  if (!content) {
    trackActionSheetDetail.hidden = true;
    syncActionSheetNavigationButtons();
    return;
  }

  trackActionSheetDetail.hidden = false;
  trackActionSheetDetail.append(content);
  syncActionSheetNavigationButtons();
}

function openActionSheetPage(page, options = {}) {
  if (!trackActionSheet || trackActionSheet.hidden) {
    return;
  }

  if (!options.fromHistory && state.actionSheetPage && state.actionSheetPage !== page) {
    state.actionSheetHistory.push(state.actionSheetPage);
    state.actionSheetForward = [];
  }

  state.actionSheetPage = page;
  renderTrackActionSheetDetail(createActionSheetPageDetail);
}

function syncActionSheetNavigationButtons() {
  if (trackActionSheetBack) {
    trackActionSheetBack.disabled = !state.actionSheetHistory?.length;
  }
  if (trackActionSheetForward) {
    trackActionSheetForward.disabled = !state.actionSheetForward?.length;
  }
}

function goBackActionSheetPage() {
  if (!state.actionSheetHistory.length) {
    return;
  }

  const previous = state.actionSheetHistory.pop();
  state.actionSheetForward.push(state.actionSheetPage);
  state.actionSheetPage = previous || "main";
  renderTrackActionSheetDetail(createActionSheetPageDetail);
}

function goForwardActionSheetPage() {
  if (!state.actionSheetForward.length) {
    return;
  }

  const next = state.actionSheetForward.pop();
  state.actionSheetHistory.push(state.actionSheetPage);
  state.actionSheetPage = next || "main";
  renderTrackActionSheetDetail(createActionSheetPageDetail);
}

function createActionSheetPageDetail() {
  const page = state.actionSheetPage || "main";
  if (page === "sleep") {
    return createSleepTimerActionSheetPage();
  }
  if (page === "playback-display") {
    return createPlaybackDisplayActionSheetPage();
  }
  if (page === "sound-effect") {
    return createSoundEffectActionSheetPage();
  }
  if (page === "playback-rate") {
    return createPlaybackRateActionSheetPage();
  }
  return createImmersiveMoreActionDetail();
}

function createActionSheetPageShell(title, subtitle) {
  const panel = document.createElement("div");
  panel.className = "action-sheet-page";

  const heading = document.createElement("div");
  heading.className = "action-sheet-page-heading";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = subtitle;
  heading.append(strong, small);

  const body = document.createElement("div");
  body.className = "action-sheet-page-body";

  panel.append(heading, body);
  return { panel, body };
}

function createSleepTimerActionSheetPage() {
  const { panel, body } = createActionSheetPageShell("睡眠模式", "到点后自动暂停播放。");
  const remaining = getSleepTimerRemainingSeconds();

  body.append(createActionSheetStatusCard(
    remaining > 0 ? formatSleepTimerDetail(remaining) : "关闭",
    remaining > 0 ? "当前睡眠定时" : "未开启睡眠定时",
  ));

  const grid = document.createElement("div");
  grid.className = "action-sheet-choice-grid";
  SLEEP_TIMER_OPTIONS.forEach((minutes) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-sheet-choice";
    button.classList.toggle("active", state.sleepTimerPresetMinutes === minutes && (minutes === 0 || remaining > 0));
    button.textContent = minutes ? `${minutes} 分钟` : "关闭";
    button.addEventListener("click", () => {
      setSleepTimer(minutes);
      renderTrackActionSheetDetail(createActionSheetPageDetail);
    });
    grid.append(button);
  });
  body.append(grid);
  return panel;
}

function createPlaybackDisplayActionSheetPage() {
  const draft = state.actionSheetDraft || normalizePlaybackDisplaySettings(state.playbackDisplaySettings);
  state.actionSheetDraft = { ...draft };
  const { panel, body } = createActionSheetPageShell("播放与显示", "保存后应用播放偏好，倍速会立即作用于当前播放器。");

  const rows = [
    ["volumeLeveling", "音量均衡", "降低曲目之间的响度落差"],
    ["backgroundMix", "与其他应用同时播放", "保留并播偏好，系统是否支持取决于浏览器"],
    ["fadeInOut", "淡入淡出", "切歌和暂停时使用柔和过渡"],
    ["smartTransition", "智能过渡", "根据曲目状态优化切换体验"],
  ];

  rows.forEach(([key, label, detail]) => {
    body.append(createActionSheetToggleRow(label, detail, Boolean(draft[key]), (checked) => {
      state.actionSheetDraft = { ...state.actionSheetDraft, [key]: checked };
    }));
  });

  const save = document.createElement("button");
  save.type = "button";
  save.className = "action-sheet-save-button";
  save.textContent = "保存播放与显示";
  save.addEventListener("click", () => {
    savePlaybackDisplaySettings(state.actionSheetDraft);
    setLibraryStatus("播放与显示偏好已保存。");
    renderTrackActionSheetDetail(createActionSheetPageDetail);
  });
  body.append(save);
  return panel;
}

function createSoundEffectActionSheetPage() {
  const defaultLabel = getSoundEffectLabel(PLAYBACK_DISPLAY_DEFAULTS.soundEffect);
  const { panel, body } = createActionSheetPageShell("音效", `选择当前播放音效。默认：${defaultLabel}`);
  const currentValue = state.playbackDisplaySettings.soundEffect;

  body.append(createActionSheetStatusCard(getSoundEffectLabel(currentValue), "当前音效"));
  body.append(createActionSheetChoiceList(
    PLAYBACK_DISPLAY_SOUND_EFFECTS.map((option) => ({
      id: option.id,
      label: option.label,
      detail: option.id === PLAYBACK_DISPLAY_DEFAULTS.soundEffect ? "不改变原始声音走向" : getSoundEffectDetail(option.id),
      isDefault: option.id === PLAYBACK_DISPLAY_DEFAULTS.soundEffect,
    })),
    currentValue,
    (value) => {
      const nextSettings = normalizePlaybackDisplaySettings({
        ...state.playbackDisplaySettings,
        soundEffect: value,
      });
      state.actionSheetDraft = { ...nextSettings };
      savePlaybackDisplaySettings(nextSettings);
      refreshActionSheetMainItem("sound-effect");
      setLibraryStatus(`音效：${getSoundEffectLabel(value)}。`);
      renderTrackActionSheetDetail(createActionSheetPageDetail);
    },
  ));
  return panel;
}

function createPlaybackRateActionSheetPage() {
  const defaultRate = PLAYBACK_DISPLAY_DEFAULTS.playbackRate;
  const { panel, body } = createActionSheetPageShell("倍速", `选择播放速度。默认：${defaultRate}x`);
  const currentRate = Number(state.playbackDisplaySettings.playbackRate);

  body.append(createActionSheetStatusCard(`${currentRate}x`, "当前倍速"));
  body.append(createActionSheetChoiceList(
    PLAYBACK_DISPLAY_RATE_OPTIONS.map((rate) => ({
      id: rate,
      label: `${rate}x`,
      detail: rate === defaultRate ? "保持歌曲原速播放" : getPlaybackRateDetail(rate),
      isDefault: rate === defaultRate,
    })),
    currentRate,
    (value) => {
      const nextRate = Number(value);
      const nextSettings = normalizePlaybackDisplaySettings({
        ...state.playbackDisplaySettings,
        playbackRate: nextRate,
      });
      state.actionSheetDraft = { ...nextSettings };
      savePlaybackDisplaySettings(nextSettings);
      refreshActionSheetMainItem("playback-rate");
      setLibraryStatus(`倍速：${nextSettings.playbackRate}x。`);
      renderTrackActionSheetDetail(createActionSheetPageDetail);
    },
  ));
  return panel;
}

function createActionSheetChoiceList(options, value, onSelect) {
  const list = document.createElement("div");
  list.className = "action-sheet-choice-list";

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-sheet-choice-option";
    button.classList.toggle("active", String(option.id) === String(value));

    const copy = document.createElement("span");
    const titleRow = document.createElement("span");
    titleRow.className = "action-sheet-choice-title";
    const strong = document.createElement("strong");
    strong.textContent = option.label;
    titleRow.append(strong);
    if (option.isDefault) {
      const badge = document.createElement("em");
      badge.className = "action-sheet-default-badge";
      badge.textContent = "默认";
      titleRow.append(badge);
    }
    copy.append(titleRow);
    if (option.detail) {
      const detail = document.createElement("small");
      detail.textContent = option.detail;
      copy.append(detail);
    }

    const marker = document.createElement("i");
    marker.setAttribute("aria-hidden", "true");
    button.append(copy, marker);
    button.addEventListener("click", () => onSelect(option.id));
    list.append(button);
  });

  return list;
}

function createActionSheetStatusCard(value, label) {
  const card = document.createElement("div");
  card.className = "action-sheet-status-card";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function createActionSheetToggleRow(label, detail, checked, onChange) {
  const row = document.createElement("label");
  row.className = "action-sheet-setting-row";
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  const small = document.createElement("small");
  small.textContent = detail;
  copy.append(strong, small);
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  row.append(copy, input);
  return row;
}

function createActionSheetSelectRow(label, valueLabel, options, value, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-sheet-setting-row action-sheet-select-row";
  const copy = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  const small = document.createElement("small");
  small.textContent = valueLabel;
  copy.append(strong, small);
  const marker = document.createElement("em");
  marker.textContent = "选择";
  button.append(copy, marker);
  button.addEventListener("click", () => openActionSheetChoicePopover(label, options, value, onSelect));
  return button;
}

function openActionSheetInlineChoice(title, options, value, onSelect) {
  openActionSheetPage("main");
  openActionSheetChoicePopover(title, options, value, onSelect);
}

function refreshActionSheetMainItem(id) {
  const button = trackActionSheetList?.querySelector(`[data-action-sheet-item-id="${id}"]`);
  if (!button) {
    return;
  }

  let labelText = "";
  let detailText = "";
  if (id === "sound-effect") {
    labelText = `音效：${getSoundEffectLabel(state.playbackDisplaySettings.soundEffect)}`;
    detailText = "右侧选择音效";
  } else if (id === "playback-rate") {
    labelText = `倍速：${state.playbackDisplaySettings.playbackRate}x`;
    detailText = "右侧选择倍速，立即作用于当前播放器";
  } else {
    return;
  }

  const title = button.querySelector(".action-sheet-copy strong");
  const detail = button.querySelector(".action-sheet-copy small");
  if (title) {
    title.textContent = labelText;
  }
  if (detail) {
    detail.textContent = detailText;
  }
}

function removeActionSheetChoicePopover() {
  trackActionSheetDetail?.querySelector(".action-sheet-choice-popover")?.remove();
}

function openActionSheetChoicePopover(title, options, value, onSelect) {
  removeActionSheetChoicePopover();

  const popover = document.createElement("div");
  popover.className = "action-sheet-choice-popover";
  const card = document.createElement("div");
  card.className = "action-sheet-choice-card";
  const heading = document.createElement("div");
  heading.className = "action-sheet-choice-heading";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "关闭";
  close.addEventListener("click", () => popover.remove());
  heading.append(strong, close);
  card.append(heading);

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-sheet-choice-option";
    button.classList.toggle("active", String(option.id) === String(value));
    button.textContent = option.label;
    button.addEventListener("click", () => {
      onSelect(option.id);
      popover.remove();
    });
    card.append(button);
  });

  popover.append(card);
  trackActionSheetDetail?.append(popover);
}

function getSoundEffectLabel(value) {
  return PLAYBACK_DISPLAY_SOUND_EFFECTS.find((option) => option.id === value)?.label || "原始";
}

function getSoundEffectDetail(value) {
  switch (value) {
    case "warm":
      return "略微柔化高频，适合长时间听";
    case "vocal":
      return "突出人声轮廓";
    case "night":
      return "降低刺激感，适合低音量";
    case "bass":
      return "增强低频存在感";
    default:
      return "不改变原始声音走向";
  }
}

function getPlaybackRateDetail(value) {
  const rate = Number(value);
  if (rate < 1) {
    return "放慢播放速度";
  }
  if (rate > 1) {
    return "加快播放速度";
  }
  return "保持歌曲原速播放";
}

function createImmersiveMoreActionDetail(lastAction = null) {
  const panel = document.createElement("div");
  panel.className = "action-sheet-live-panel";

  const eyebrow = document.createElement("span");
  eyebrow.className = "action-sheet-live-eyebrow";
  eyebrow.textContent = lastAction ? "刚刚更新" : "实时状态";

  const title = document.createElement("strong");
  title.textContent = lastAction?.label || "沉浸播放";

  const status = document.createElement("p");
  status.textContent = lastAction
    ? getImmersiveMoreActionStatus(lastAction)
    : "点击左侧操作后，当前歌词、样式和播放状态会在这里同步更新。";

  const summary = document.createElement("dl");
  summary.className = "action-sheet-live-summary";
  [
    ["歌词同步", formatLyricOffsetLabel(state.lyricOffsetSeconds)],
    ["播放器样式", getImmersivePlayerStyleSummary()],
    ["纯享模式", immersiveZenButton?.getAttribute("aria-pressed") === "true" ? "已开启" : "未开启"],
    ["歌词滚动", state.lyricSettings?.autoScroll ? "自动跟随" : "手动浏览"],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    summary.append(row);
  });

  panel.append(eyebrow, title, status, summary);
  return panel;
}

function getImmersiveMoreActionStatus(action) {
  if (action?.id === "lyric-earlier" || action?.id === "lyric-later" || action?.id === "lyric-reset") {
    return `歌词同步已更新为 ${formatLyricOffsetLabel(state.lyricOffsetSeconds)}。`;
  }

  if (action?.id === "zen") {
    return immersiveZenButton?.getAttribute("aria-pressed") === "true"
      ? "纯享模式已开启，非必要信息会收起。"
      : "纯享模式已关闭，完整沉浸信息已恢复。";
  }

  return "操作已应用。";
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

function openImmersiveMoreActions() {
  state.actionSheetPage = "main";
  state.actionSheetHistory = [];
  state.actionSheetForward = [];
  state.actionSheetDraft = null;

  openTrackActionSheet(
    state.currentTrack,
    [
      {
        id: "artist",
        icon: "artist",
        label: "歌手",
        detail: getArtists(state.currentTrack) || "当前歌曲没有歌手信息",
        handler: () => {
          if (state.currentTrack) {
            openTrackArtist(state.currentTrack);
          }
        },
        disabled: !state.currentTrack,
      },
      {
        id: "album",
        icon: "album",
        label: "专辑",
        detail: state.currentTrack?.Album || "当前歌曲没有专辑信息",
        handler: () => {
          if (state.currentTrack) {
            openTrackAlbum(state.currentTrack);
          }
        },
        disabled: !state.currentTrack,
      },
      {
        id: "sound-effect",
        icon: "wave",
        label: `音效：${getSoundEffectLabel(state.playbackDisplaySettings.soundEffect)}`,
        detail: "右侧选择音效",
        handler: () => openActionSheetPage("sound-effect"),
        keepOpen: true,
        skipDetailRefresh: true,
      },
      {
        id: "playback-rate",
        icon: "playNext",
        label: `倍速：${state.playbackDisplaySettings.playbackRate}x`,
        detail: "右侧选择倍速，立即作用于当前播放器",
        handler: () => openActionSheetPage("playback-rate"),
        keepOpen: true,
        skipDetailRefresh: true,
      },
      {
        id: "style",
        icon: "palette",
        label: "播放器样式",
        detail: `主题与可视化：${getImmersivePlayerStyleSummary()}`,
        handler: openPlayerStyleModal,
      },
      {
        id: "lyrics",
        icon: "spark",
        label: "歌词设置",
        detail: "字体、同步时间、自动滚动和自动展示",
        handler: openLyricSettingsModal,
      },
      {
        id: "sleep",
        icon: "recent",
        label: "睡眠模式",
        detail: state.sleepTimerEndAt ? `${formatSleepTimerDetail(getSleepTimerRemainingSeconds())}后停止` : "定时暂停播放",
        handler: () => openActionSheetPage("sleep"),
        keepOpen: true,
      },
      {
        id: "playback-display",
        icon: "wave",
        label: "播放与显示",
        detail: "音量均衡、同时播放、淡入淡出和智能过渡",
        handler: () => openActionSheetPage("playback-display"),
        keepOpen: true,
      },
      {
        id: "zen",
        icon: "spark",
        label: immersiveZenButton?.getAttribute("aria-pressed") === "true" ? "关闭纯享模式" : "开启纯享模式",
        detail: "在播放与显示页也可以看到状态",
        handler: toggleImmersiveZenMode,
        keepOpen: true,
      },
    ],
    {
      title: "更多操作",
      subtitle: "控制沉浸播放、跳转当前音乐信息和保存播放偏好",
      emptyMessage: "暂无更多沉浸播放操作。",
      detailRenderer: createActionSheetPageDetail,
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
  state.actionSheetPage = "main";
  state.actionSheetHistory = [];
  state.actionSheetForward = [];
  state.actionSheetDraft = null;
  trackActionSheetTitle.textContent = "歌曲操作";
  trackActionSheetSubtitle.textContent = "";
  trackActionSheetList.replaceChildren();
  trackActionSheetDetail?.replaceChildren();
  if (trackActionSheetDetail) {
    trackActionSheetDetail.hidden = true;
  }
  state.actionSheetPage = "main";
  state.actionSheetHistory = [];
  state.actionSheetForward = [];
  state.actionSheetDraft = null;
  syncActionSheetNavigationButtons();
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
    appendEmpty(queueTrackList, { text: "播放队列为空。点一首歌曲或使用随机播放。" });
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
    appendEmpty(quickQueueList, { text: "播放队列为空。" });
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
  settingsServerUrl.textContent = redact.redactServer(isBridge ? getSourceBridgeDisplayUrl(session) : session.serverUrl) || "-";
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
  if (lyricsSourceBridgeApiUrlInput && document.activeElement !== lyricsSourceBridgeApiUrlInput) {
    lyricsSourceBridgeApiUrlInput.value = loadLyricsSourceBridgeApiUrl();
  }
  if (settingsLyricsSourceBridgeStatus) {
    settingsLyricsSourceBridgeStatus.textContent = loadLyricsSourceBridgeApiUrl() ? "已配置" : "未配置";
  }
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
  renderMobileProfilePage();
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
    forceExternalResolve: isExternalSourceTrack(state.currentTrack),
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
    nowPlayingArtist.textContent = "Aurora Music";
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
  if (!button) {
    return;
  }

  const isActive = isFavorite(track);

  button.disabled = !track;
  if (
    button.classList.contains("icon-favorite-button")
    || button.classList.contains("immersive-mobile-tool-button")
    || button.classList.contains("immersive-control-button")
    || button.classList.contains("playerbar-mobile-favorite")
  ) {
    button.classList.toggle("active", isActive);
    if (button.classList.contains("playerbar-mobile-favorite")) {
      ensureMiniPlayerFavoriteIcon(button);
    }
    const label = button.querySelector(".sr-only");
    if (label) {
      label.textContent = isActive ? "取消收藏" : "收藏";
    }
  } else {
    button.className = `favorite-button ${isActive ? "active" : ""}`.trim();
    button.replaceChildren(createActionIcon("heart"));
  }
  setIconButtonLabel(button, isActive ? "取消收藏" : "收藏");
}

function ensureMiniPlayerFavoriteIcon(button) {
  if (!button || button.querySelector(".favorite-line-icon")) {
    return;
  }

  button.replaceChildren();

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "line-icon favorite-line-icon mini-favorite-line-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 1 0-7.2 7.2l1 1L12 21l7.2-7 1-1a5.1 5.1 0 0 0 0-7.2Z");
  icon.append(path);

  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = "收藏";
  button.append(icon, label);
}

function setIconButtonLabel(button, label) {
  if (!button || !label) {
    return;
  }

  button.title = label;
  button.setAttribute("aria-label", label);

  const srOnlyLabel = button.querySelector(".sr-only");
  if (srOnlyLabel) {
    srOnlyLabel.textContent = label;
  }
}

function setMobileImmersiveStageView(view = "cover", options = {}) {
  const nextView = view === "lyrics" ? "lyrics" : "cover";
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const previousView = state.mobileImmersiveView;
  const shouldAnimate = options.animate !== false && previousView !== nextView;
  const transitionClass = nextView === "lyrics" ? "is-mobile-stage-entering-lyrics" : "is-mobile-stage-entering-cover";

  state.mobileImmersiveView = nextView;
  shell?.setAttribute("data-mobile-view", nextView);
  immersiveMobileStageToggle?.setAttribute("aria-pressed", nextView === "lyrics" ? "true" : "false");
  immersiveMobileStageToggle?.setAttribute("aria-label", nextView === "lyrics" ? "显示封面和音乐律动" : "显示歌词");
  setImmersiveTopActionsCollapsed(nextView === "lyrics");
  if (shell) {
    shell.classList.remove("is-title-docking", "is-title-undocking");
    shell.classList.remove("is-mobile-stage-entering-lyrics", "is-mobile-stage-entering-cover");
    if (shouldAnimate) {
      void shell.offsetWidth;
      shell.classList.add(transitionClass);
      window.setTimeout(() => {
        shell?.classList.remove(transitionClass);
      }, 420);
    }
  }
  if (nextView === "lyrics") {
    triggerImmersiveLyricExpansion(shouldAnimate);
    updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
    requestAnimationFrame(() => {
      updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
    });
  } else {
    shell?.classList.remove("is-lyrics-expanding");
    renderImmersiveVisualizerForCurrentPlaybackState();
  }
}

function setDesktopImmersiveStageView(view = "visualizer", options = {}) {
  const nextView = view === "lyrics" ? "lyrics" : "visualizer";
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const previousView = state.desktopImmersiveView;

  state.desktopImmersiveView = nextView;
  shell?.setAttribute("data-desktop-view", nextView);
  immersiveDesktopStageToggle?.setAttribute("aria-pressed", nextView === "lyrics" ? "true" : "false");
  immersiveDesktopStageToggle?.setAttribute("aria-label", nextView === "lyrics" ? "显示歌词和音乐律动" : "显示完整歌词");

  if (nextView === "lyrics") {
    triggerImmersiveLyricExpansion(options.animate !== false);
    updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
    requestAnimationFrame(() => {
      updateImmersiveLyricProgress(getVisibleLyricSyncTimeSeconds(), true, true);
    });
  } else if (shell && previousView !== nextView && options.animate !== false) {
    shell.classList.remove("is-lyrics-expanding");
  }
  if (nextView === "visualizer") {
    renderImmersiveVisualizerForCurrentPlaybackState();
  }
}

function triggerImmersiveLyricExpansion(shouldAnimate = true) {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  if (!shell || !shouldAnimate) {
    return;
  }

  shell.classList.remove("is-lyrics-expanding");
  // Force a reflow so repeated entries replay the downward expansion.
  void shell.offsetWidth;
  shell.classList.add("is-lyrics-expanding");
  window.setTimeout(() => {
    shell.classList.remove("is-lyrics-expanding");
  }, 520);
}

function setImmersiveTopActionsCollapsed(collapsed) {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const shouldCollapse = Boolean(collapsed && state.mobileImmersiveView === "lyrics");

  state.immersiveTopActionsCollapsed = shouldCollapse;
  shell?.classList.toggle("is-top-actions-collapsed", shouldCollapse);
  if (immersiveTopRevealButton) {
    immersiveTopRevealButton.hidden = !shouldCollapse;
  }
}

function toggleMobileImmersiveStageView() {
  setMobileImmersiveStageView(state.mobileImmersiveView === "lyrics" ? "cover" : "lyrics", { animate: true });
}

function isDesktopImmersiveLyricsViewActive() {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const isDesktopViewport = window.matchMedia?.("(min-width: 621px)")?.matches ?? window.innerWidth > 620;

  return Boolean(
    isDesktopViewport
    && state.desktopImmersiveView === "lyrics"
    && shell?.getAttribute("data-desktop-view") === "lyrics"
  );
}

function maybeAutoShowImmersiveLyrics(options = {}) {
  if (!state.lyricSettings?.autoImmersiveLyrics && !options.force) {
    return false;
  }

  if (getActiveView() !== "immersivePlayer" || !state.currentTrack || !state.lyricLines.length) {
    return false;
  }

  setMobileImmersiveStageView("lyrics", { animate: true });
  return true;
}

function isMobileImmersiveLyricsViewActive() {
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const isMobileViewport = window.matchMedia?.("(max-width: 620px)")?.matches ?? window.innerWidth <= 620;

  return Boolean(
    isMobileViewport
    && state.mobileImmersiveView === "lyrics"
    && shell?.getAttribute("data-mobile-view") === "lyrics"
  );
}

function returnMobileImmersiveLyricsToCover(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  setMobileImmersiveStageView("cover", { animate: true });
}

function handleImmersiveLyricReturnClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }

  if (isDesktopImmersiveLyricsViewActive()) {
    const clickedInsideLyricFocus = event.target.closest(".immersive-lyric-focus");
    const clickedInsideStage = event.target.closest(".immersive-stage");
    if (
      (clickedInsideLyricFocus || clickedInsideStage)
      && !event.target.closest(".lyric-line, button, a, input, select, textarea, .modal-backdrop, .immersive-queue-drawer")
    ) {
      event.preventDefault();
      event.stopPropagation();
      setDesktopImmersiveStageView("visualizer", { animate: true });
    }
    return;
  }

  if (!isMobileImmersiveLyricsViewActive()) {
    return;
  }

  const titleHit = event.target.closest(".immersive-mobile-title");
  if (titleHit) {
    returnMobileImmersiveLyricsToCover(event);
    return;
  }

  const clickedInsideLyricFocus = event.target.closest(".immersive-lyric-focus");
  const clickedInsideStage = event.target.closest(".immersive-stage");
  if (
    (clickedInsideLyricFocus || clickedInsideStage)
    && !event.target.closest(".lyric-line, button, a, input, select, textarea, .modal-backdrop, .immersive-queue-drawer")
  ) {
    returnMobileImmersiveLyricsToCover(event);
  }
}

function handleImmersiveMobileTitleKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  if (!isMobileImmersiveLyricsViewActive()) {
    return;
  }

  returnMobileImmersiveLyricsToCover(event);
}

function syncImmersiveMobileCover(imageUrl, track) {
  if (!immersiveMobileCoverProxy) {
    return;
  }

  immersiveMobileCoverProxy.replaceChildren();
  immersiveMobileCoverProxy.className = "immersive-mobile-cover-proxy cover-a";
  if (track) {
    appendImage(immersiveMobileCoverProxy, imageUrl, track.Name);
    return;
  }

  immersiveMobileCoverProxy.classList.add("is-empty");
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
    if (immersiveMobileTitle) {
      immersiveMobileTitle.textContent = "等待选择音乐";
    }
    if (immersiveMobileArtist) {
      immersiveMobileArtist.textContent = "Aurora Music";
    }
    if (immersiveMobileDeckTitle) {
      immersiveMobileDeckTitle.textContent = "等待选择音乐";
    }
    if (immersiveMobileDeckSubtitle) {
      immersiveMobileDeckSubtitle.textContent = "Aurora Music";
    }
    renderImmersiveMobileDeckQuality(null);
    immersiveArtist.textContent = "Aurora Music";
    immersiveAlbum.textContent = "-";
    immersiveArtist.disabled = true;
    immersiveAlbum.disabled = true;
    syncImmersiveMobileCover("", null);
    renderImmersivePlaybackMeta(null);
    renderPlaybackFavoriteButton(immersiveFavoriteButton, null);
    renderPlaybackFavoriteButton(immersiveMobileFavoriteButton, null);
    renderImmersiveMobileCurrentLyric(null);
    renderImmersiveLyricFocus();
    return;
  }

  const imageUrl = getTrackImageUrl(track, 1100);
  immersiveTitle.textContent = track.Name || "未命名歌曲";
  if (immersiveMobileTitle) {
    immersiveMobileTitle.textContent = track.Name || "未命名歌曲";
  }
  if (immersiveMobileArtist) {
    immersiveMobileArtist.textContent = getArtists(track) || "未知艺人";
  }
  if (immersiveMobileDeckTitle) {
    immersiveMobileDeckTitle.textContent = track.Name || "未命名歌曲";
  }
  if (immersiveMobileDeckSubtitle) {
    immersiveMobileDeckSubtitle.textContent = [
      getArtists(track) || "未知艺人",
      track.Album || "未知专辑",
    ].filter(Boolean).join(" / ");
  }
  renderImmersiveMobileDeckQuality(track);
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
  syncImmersiveMobileCover(imageUrl, track);
  renderImmersivePlaybackMeta(track);
  renderPlaybackFavoriteButton(immersiveFavoriteButton, track);
  renderPlaybackFavoriteButton(immersiveMobileFavoriteButton, track);
  renderImmersiveMobileCurrentLyric(getCurrentTopLyricLine());
  renderImmersiveLyricFocus();
  renderIdleImmersiveWaveform();
}

function renderImmersiveMobileDeckQuality(track = state.currentTrack) {
  if (!immersiveMobileDeckQuality) {
    return;
  }

  if (!track) {
    immersiveMobileDeckQuality.textContent = "-";
    immersiveMobileDeckQuality.hidden = true;
    return;
  }

  const summary = getTrackQualitySummary(track);
  const option = isExternalSourceTrack(track)
    ? getExternalPlaybackQualityOption(track)
    : getAudioQualityProfile();
  const label = summary?.shortLabel
    || (isExternalSourceTrack(track) ? option.shortLabel || option.label : getAudioQualityButtonLabel(option));
  const detail = summary?.detailLabel
    || (isExternalSourceTrack(track) ? option.quality : [option.codec, option.bitrateLabel || "原码率"].filter(Boolean).join(" · "));

  immersiveMobileDeckQuality.textContent = label;
  immersiveMobileDeckQuality.title = detail || immersiveMobileDeckQuality.textContent;
  immersiveMobileDeckQuality.hidden = false;
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
    lyricLineWordGroups[index] = appendLyricLineContent(item, line, {
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
  const groups = [];

  if (!originalText) {
    container.replaceChildren();
    groups.push(appendLyricWordSpans(container, line, text, {
      timeline: line?.wordTimeline,
      fallbackText: text,
      role: "single",
    }));
    return groups;
  }

  const original = document.createElement(options.originalTagName || "span");
  original.className = options.originalClassName || "lyric-original";
  groups.push(appendLyricWordSpans(original, line, originalText, {
    timeline: line?.wordTimeline,
    fallbackText: originalText,
    role: "original",
  }));

  const translated = document.createElement(options.translatedTagName || "span");
  translated.className = options.translatedClassName || "lyric-translated";
  groups.push(appendLyricWordSpans(translated, line, text, {
    timeline: line?.translatedWordTimeline,
    fallbackText: text,
    role: "translated",
  }));

  container.replaceChildren(original, translated);
  return groups;
}

function appendLyricWordSpans(container, line, text, options = {}) {
  const group = createLyricWordGroup(line, text, options);
  appendLyricWordParts(container, group.parts, group);
  return group;
}

function appendLyricWordParts(container, parts, group) {
  parts.forEach((part) => {
    if (part.type === "space") {
      container.append(document.createTextNode(part.value));
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
    word._lyricProgressCss = "0%";
    word.style.setProperty("--word-progress", "0%");
    container.append(word);
    group.words.push(word);
    group.timings.push(Number.isFinite(part.time) ? Number(part.time) : NaN);
    group.endTimings.push(Number.isFinite(part.endTime) ? Number(part.endTime) : NaN);
  });

  group.hasUsableTimedWords = group.timings.length === group.words.length
    && group.timings.length > 0
    && areTimedLyricWordTimingsUsable(group.timings);
  if (group.hasUsableTimedWords) {
    group.timings = normalizeTimedLyricWordTimings(group.timings);
    group.words.forEach((word, index) => {
      const normalizedTime = group.timings[index];
      if (Number.isFinite(normalizedTime)) {
        word.dataset.wordTime = String(normalizedTime);
      }
    });
  }
  syncLyricWordProgressWeights(group);
}

function createLyricWordGroup(line, text, options = {}) {
  const fallbackText = options.fallbackText || text || " ";
  const displayTimeline = getDisplayLyricWordTimeline(line, fallbackText, options);
  const parts = getLyricWordParts({ wordTimeline: displayTimeline }, fallbackText);

  return {
    role: options.role || "line",
    line,
    text: fallbackText,
    parts,
    words: [],
    timings: [],
    endTimings: [],
    wordWeights: [],
    wordWeightBoundaries: [],
    totalWordWeight: 0,
    progressFullWordCount: -1,
    progressPartialWordIndex: -1,
    hasUsableTimedWords: false,
  };
}

function getFallbackLyricWordTimeline(line, fallbackText, options = {}) {
  if (options.role === "translated" && Array.isArray(line?.wordTimeline) && line.wordTimeline.length) {
    return synthesizeTranslatedLyricWordTimeline(fallbackText, line.wordTimeline);
  }

  if (options.role === "original" && Array.isArray(line?.translatedWordTimeline) && line.translatedWordTimeline.length) {
    return synthesizeLyricWordTimelineFromSource(fallbackText, line.translatedWordTimeline);
  }

  return [];
}

function getDisplayLyricWordTimeline(line, fallbackText, options = {}) {
  const timeline = Array.isArray(options.timeline) ? options.timeline : [];
  return timeline.length ? timeline : getFallbackLyricWordTimeline(line, fallbackText, options);
}

function synthesizeTranslatedLyricWordTimeline(text, sourceTimeline) {
  return synthesizeLyricWordTimelineFromSource(text, sourceTimeline);
}

function synthesizeLyricWordTimelineFromSource(text, sourceTimeline) {
  const parts = segmentLyricWords(text);
  const wordParts = parts.filter((part) => part.type === "word");

  if (!wordParts.length || !sourceTimeline?.length) {
    return [];
  }

  const sourceWords = sourceTimeline.filter((word) => Number.isFinite(word?.time));
  if (!sourceWords.length) {
    return [];
  }

  const start = Number(sourceWords[0].time);
  const lastSourceWord = sourceWords[sourceWords.length - 1];
  const explicitEnd = Number(lastSourceWord.endTime);
  const sourceEnd = Number.isFinite(explicitEnd) && explicitEnd > start
    ? explicitEnd
    : Number.isFinite(Number(sourceWords[sourceWords.length - 1]?.time)) && sourceWords.length > 1
    ? Number(sourceWords[sourceWords.length - 1].time) + getEstimatedLyricWordDurationSeconds(lastSourceWord)
    : start + getEstimatedLyricLineDurationSeconds(wordParts.length, text);
  const duration = Math.max(0.18, sourceEnd - start);
  const canMapSourceWordsByIndex = sourceWords.length === wordParts.length;
  const wordWeights = canMapSourceWordsByIndex ? [] : getSyntheticLyricWordWeights(wordParts);
  const totalWeight = wordWeights.reduce((sum, weight) => sum + weight, 0) || wordParts.length || 1;
  let elapsedWeight = 0;
  let wordIndex = 0;

  return parts.map((part) => {
    if (part.type === "space") {
      return { value: part.value };
    }

    const sourceWord = canMapSourceWordsByIndex ? sourceWords[wordIndex] : null;
    const nextSourceWord = canMapSourceWordsByIndex ? sourceWords[wordIndex + 1] : null;
    const mappedStart = Number(sourceWord?.time);
    const mappedEnd = Number(sourceWord?.endTime);
    const mappedNextStart = Number(nextSourceWord?.time);
    const wordWeight = wordWeights[wordIndex] || 1;
    const wordStart = Number.isFinite(mappedStart)
      ? mappedStart
      : start + ((duration * elapsedWeight) / totalWeight);
    elapsedWeight += wordWeight;
    const wordEnd = Number.isFinite(mappedEnd) && mappedEnd > wordStart
      ? mappedEnd
      : Number.isFinite(mappedNextStart) && mappedNextStart > wordStart
      ? mappedNextStart
      : start + ((duration * elapsedWeight) / totalWeight);
    wordIndex += 1;
    return {
      value: part.value,
      time: wordStart,
      endTime: wordEnd,
    };
  });
}

function getSyntheticLyricWordWeights(wordParts) {
  return (wordParts || []).map((part) => getEstimatedLyricWordDurationSeconds(part));
}

function syncLyricWordProgressWeights(group) {
  if (!group) {
    return;
  }

  group.wordWeights = getLyricWordProgressWeights(group.words);
  group.wordWeightBoundaries = buildLyricWordWeightBoundaries(group.wordWeights);
  group.totalWordWeight = group.wordWeightBoundaries[group.wordWeightBoundaries.length - 1] || 0;
}

function getLyricWordProgressWeights(words) {
  return (words || []).map((word) => getEstimatedLyricWordDurationSeconds(word));
}

function buildLyricWordWeightBoundaries(weights) {
  const boundaries = [0];
  let total = 0;

  (weights || []).forEach((weight) => {
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : LYRIC_TIMED_WORD_MIN_DURATION_SECONDS;
    total += safeWeight;
    boundaries.push(total);
  });

  return boundaries;
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
  invalidateProgressRenderCache();
  updateProgress({ syncLyrics: false });
  syncLyricProgressLoop();
}

async function loadLyricsFromServer(track) {
  if (!state.session || !track?.Id) {
    return;
  }

  const requestId = ++state.lyricsLoadRequestId;
  state.lyricsSourceDiagnostics = null;
  state.lyricsStatus = isExternalSourceTrack(track)
    ? "正在从音源桥尝试读取歌词..."
    : "正在搜索歌词...";
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
      state.lyricsStatus = getLyricsNotFoundStatus(track);
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
    const apiUrl = getExternalTrackApiUrl(track);

    if (!apiUrl) {
      return "";
    }

    const text = await externalSourceApi.fetchLyric(apiUrl, track);
    setLyricsSourceDiagnostics({
      source: "external-source",
      apiUrl,
      hasText: Boolean(text.trim()),
      hasCjk: hasLikelyChineseText(text),
      hasBilingual: hasLikelyBilingualText(text),
      lineCount: countLyricLikeLines(text),
    });
    return text;
  }

  const sidecarText = await fetchEmbySidecarLyricsFromSourceBridge(track);
  if (sidecarText.trim()) {
    return sidecarText;
  }

  return fetchMatchedLyricsFromSourceBridge(track);
}

async function fetchEmbySidecarLyricsFromSourceBridge(track) {
  const apiUrl = getLyricsSourceBridgeApiUrl();
  if (!apiUrl || !track?.Path) {
    setLyricsSourceDiagnostics({
      source: "emby-sidecar",
      apiUrl: apiUrl || "",
      path: track?.Path || "",
      error: apiUrl ? "missing track path" : "missing source bridge url",
    });
    return "";
  }

  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/lyric-by-path?${toQueryString({
      path: track.Path,
    })}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      setLyricsSourceDiagnostics({
        source: "emby-sidecar",
        apiUrl,
        path: track.Path,
        status: response.status,
        error: "source bridge lyric-by-path failed",
      });
      return "";
    }

    const payload = await response.json();
    const text = extractLyricsTextFromResponse(payload);
    setLyricsSourceDiagnostics({
      source: "emby-sidecar",
      apiUrl,
      path: track.Path,
      mediaPath: payload?.mediaPath || "",
      lyricPath: payload?.lyricPath || "",
      status: response.status,
      hasText: Boolean(text.trim()),
      hasCjk: Boolean(payload?.hasCjk) || hasLikelyChineseText(text),
      hasBilingual: Boolean(payload?.hasBilingual) || hasLikelyBilingualText(text),
      lineCount: Number(payload?.lineCount || countLyricLikeLines(text)),
    });
    return text;
  } catch (error) {
    setLyricsSourceDiagnostics({
      source: "emby-sidecar",
      apiUrl,
      path: track.Path,
      error: readableError(error),
    });
    return "";
  }
}

async function fetchMatchedLyricsFromSourceBridge(track) {
  const apiUrl = getLyricsSourceBridgeApiUrl();
  if (!apiUrl || !track?.Name) {
    return "";
  }

  const query = buildLyricMatchQuery(track);
  if (!query) {
    return "";
  }

  let result;
  try {
    result = await externalSourceApi.fetchTracks(apiUrl, {
      query,
      limit: 8,
      localOnly: true,
      timeoutMs: 12000,
    });
  } catch {
    result = null;
  }

  let matchedTracks = findMatchedLyricTracks(track, result?.Items || []);
  if (!matchedTracks.length) {
    try {
      const pluginResult = await externalSourceApi.fetchTracks(apiUrl, {
        query,
        limit: 12,
        timeoutMs: 15000,
      });
      matchedTracks = findMatchedLyricTracks(track, pluginResult?.Items || []);
    } catch {
      matchedTracks = [];
    }
  }

  for (const matchedTrack of matchedTracks) {
    try {
      const lyric = await externalSourceApi.fetchLyric(apiUrl, matchedTrack);
      if (lyric.trim()) {
        setLyricsSourceDiagnostics({
          source: "matched-source-bridge",
          apiUrl,
          matchedName: matchedTrack?.Name || matchedTrack?.title || "",
          matchedArtist: getArtists(matchedTrack) || matchedTrack?.artist || "",
          hasText: true,
          hasCjk: hasLikelyChineseText(lyric),
          hasBilingual: hasLikelyBilingualText(lyric),
          lineCount: countLyricLikeLines(lyric),
        });
        return lyric;
      }
    } catch {
      // Try the next matched source; individual plugins can fail or have missing lyrics.
    }
  }

  return "";
}

function setLyricsSourceDiagnostics(details) {
  state.lyricsSourceDiagnostics = {
    at: new Date().toISOString(),
    ...(details || {}),
  };
}

function getLyricsSourceBridgeApiUrl() {
  if (!isExternalSourceSession()) {
    return getConfiguredEmbyLyricsSourceBridgeApiUrl();
  }

  return getConfiguredSourceBridgeApiUrl();
}

function getConfiguredEmbyLyricsSourceBridgeApiUrl() {
  return loadLyricsSourceBridgeApiUrl();
}

function getConfiguredSourceBridgeApiUrl() {
  return getSessionExternalSourceApiUrl(state.session)
    || normalizeExternalSourceApiUrl(state.externalSourceApiUrl || "")
    || loadExternalSourceApiUrl()
    || normalizeExternalSourceApiUrl(DEFAULT_EXTERNAL_SOURCE_API_URL || "");
}

function buildLyricMatchQuery(track) {
  return [
    track?.Name,
    getPrimaryTrackArtist(track)?.Name || getArtists(track),
  ].filter(Boolean).join(" ").trim();
}

function findBestMatchedLyricTrack(sourceTrack, candidates) {
  return findMatchedLyricTracks(sourceTrack, candidates)[0] || null;
}

function findMatchedLyricTracks(sourceTrack, candidates) {
  const sourceTitle = normalizeLyricMatchText(sourceTrack?.Name);
  if (!sourceTitle) {
    return [];
  }

  const sourceArtists = getLyricMatchArtistTokens(sourceTrack);
  const matches = [];

  (candidates || []).forEach((candidate) => {
    const candidateTitle = normalizeLyricMatchText(candidate?.Name);
    if (!candidateTitle) {
      return;
    }

    // 标题改为相似度匹配，容忍 feat./(Live)/标点/简繁等差异，不再要求完全相等。
    const titleScore = lyricTitleSimilarity(sourceTitle, candidateTitle);
    if (titleScore < LYRIC_TITLE_MATCH_THRESHOLD) {
      return;
    }

    const candidateArtists = getLyricMatchArtistTokens(candidate);
    const bothHaveArtists = sourceArtists.length > 0 && candidateArtists.length > 0;
    const artistOverlap = bothHaveArtists
      && sourceArtists.some((artist) => candidateArtists.includes(artist));

    // 双方都标注了艺人却完全不重叠：判为同名异曲，跳过以保持稳健。
    if (bothHaveArtists && !artistOverlap) {
      return;
    }

    const score = titleScore + (artistOverlap ? 0.3 : 0);
    matches.push({ candidate, score });
  });

  return matches
    .sort((left, right) => right.score - left.score)
    .map((item) => item.candidate);
}

const LYRIC_TITLE_MATCH_THRESHOLD = 0.6;

// 标题相似度：完全相等=1，互相包含=0.85，其余按二元组(bigram) Dice 系数计算(对中文按字符分组)。
function lyricTitleSimilarity(a, b) {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) {
    return 0.85;
  }
  if (a.length < 2 || b.length < 2) {
    return 0;
  }

  const bigrams = (text) => {
    const grams = new Map();
    for (let i = 0; i < text.length - 1; i += 1) {
      const gram = text.slice(i, i + 2);
      grams.set(gram, (grams.get(gram) || 0) + 1);
    }
    return grams;
  };

  const gramsA = bigrams(a);
  const gramsB = bigrams(b);
  let overlap = 0;
  gramsA.forEach((count, gram) => {
    if (gramsB.has(gram)) {
      overlap += Math.min(count, gramsB.get(gram));
    }
  });

  return (2 * overlap) / ((a.length - 1) + (b.length - 1));
}

function getLyricMatchArtistTokens(track) {
  return getArtists(track)
    .split(/\s*(?:\/|、|,|，|&)\s*/)
    .map(normalizeLyricMatchText)
    .filter(Boolean);
}

function normalizeLyricMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^\s*\[[^\]]+\]\s*/, "")
    .replace(/^\s*\d+\s*[.-]\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[《》<>()[\]【】{}"'“”‘’·.,，。:：;；!！?？_-]/g, "")
    .trim();
}

function getLyricsNotFoundStatus(track) {
  return isExternalSourceTrack(track)
    ? "外部音源暂未提供歌词。"
    : (getLyricsSourceBridgeApiUrl() ? "没有匹配到可用歌词。" : "未配置音源桥，无法联网搜索歌词。");
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
    response.lrc,
    response.lyric,
    response.lyrics,
    response.rawLrc,
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

function loadLyricSettings() {
  try {
    const raw = localStorage.getItem(LYRIC_SETTINGS_KEY);
    return normalizeLyricSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_LYRIC_SETTINGS };
  }
}

function saveLyricSettings() {
  if (lyricSettingsSaveTimer) {
    clearTimeout(lyricSettingsSaveTimer);
    lyricSettingsSaveTimer = 0;
  }

  localStorage.setItem(LYRIC_SETTINGS_KEY, JSON.stringify(normalizeLyricSettings(state.lyricSettings)));
}

function scheduleLyricSettingsSave() {
  if (lyricSettingsSaveTimer) {
    clearTimeout(lyricSettingsSaveTimer);
  }

  lyricSettingsSaveTimer = window.setTimeout(() => {
    saveLyricSettings();
  }, 220);
}

function flushLyricSettingsSave() {
  if (!lyricSettingsSaveTimer) {
    return;
  }

  clearTimeout(lyricSettingsSaveTimer);
  lyricSettingsSaveTimer = 0;
  saveLyricSettings();
}

function normalizeLyricSettings(settings = {}) {
  return settingsOps.normalizeLyricSettings(settings, {
    defaults: DEFAULT_LYRIC_SETTINGS,
    fontFamilies: LYRIC_FONT_FAMILY_MAP,
    clamp,
  });
}

function applyLyricSettings(options = {}) {
  state.lyricSettings = normalizeLyricSettings(state.lyricSettings);
  const lyricFontScale = state.lyricSettings.fontScale.toFixed(2);
  const lyricFontFamily = LYRIC_FONT_FAMILY_MAP[state.lyricSettings.fontFamily] || LYRIC_FONT_FAMILY_MAP.system;
  const lyricLetterSpacing = `${state.lyricSettings.letterSpacing.toFixed(1)}px`;
  const targets = [
    document.body,
    immersivePlayerPanel,
    immersivePlayerPanel?.querySelector(".immersive-player-shell"),
  ].filter(Boolean);

  targets.forEach((target) => {
    target.style?.setProperty("--immersive-lyric-font-scale", lyricFontScale);
    target.style?.setProperty("--immersive-lyric-font-family", lyricFontFamily);
    target.style?.setProperty("--immersive-lyric-letter-spacing", lyricLetterSpacing);
  });
  document.body.classList.toggle("lyric-auto-scroll-off", !state.lyricSettings.autoScroll);

  if (options.save) {
    saveLyricSettings();
  }

  renderLyricSettingsControls();
}

function renderLyricSettingsControls() {
  if (lyricFontSizeRange) {
    lyricFontSizeRange.value = String(Math.round(state.lyricSettings.fontScale * 100));
  }
  if (lyricFontSizeValue) {
    lyricFontSizeValue.textContent = `${Math.round(state.lyricSettings.fontScale * 100)}%`;
  }
  if (lyricFontFamilyValue) {
    lyricFontFamilyValue.textContent = getLyricFontFamilyLabel(state.lyricSettings.fontFamily);
  }
  if (lyricFontFamilyButton) {
    lyricFontFamilyButton.setAttribute("aria-expanded", "false");
  }
  if (lyricLetterSpacingRange) {
    lyricLetterSpacingRange.value = String(state.lyricSettings.letterSpacing);
  }
  if (lyricLetterSpacingValue) {
    lyricLetterSpacingValue.textContent = state.lyricSettings.letterSpacing
      ? `${state.lyricSettings.letterSpacing.toFixed(1)}px`
      : "标准";
  }
  if (lyricAutoScrollToggle) {
    lyricAutoScrollToggle.checked = state.lyricSettings.autoScroll;
  }
  if (lyricAutoImmersiveToggle) {
    lyricAutoImmersiveToggle.checked = state.lyricSettings.autoImmersiveLyrics;
  }
}

function updateLyricSetting(key, value) {
  state.lyricSettings = normalizeLyricSettings({
    ...state.lyricSettings,
    [key]: value,
  });

  const shouldCoalesceSave = key === "fontScale" || key === "letterSpacing";
  applyLyricSettings({ save: !shouldCoalesceSave });
  if (shouldCoalesceSave) {
    scheduleLyricSettingsSave();
  }

  if (key === "autoImmersiveLyrics" && state.lyricSettings.autoImmersiveLyrics) {
    maybeAutoShowImmersiveLyrics({ force: true });
  }
  if (key === "autoScroll" && state.lyricSettings.autoScroll) {
    updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  }
  if ((key === "fontScale" || key === "fontFamily" || key === "letterSpacing") && state.lyricSettings.autoScroll) {
    refreshLyricLayoutAfterSettingsChange();
  }
  if (key === "fontFamily" || key === "fontScale" || key === "letterSpacing") {
    renderImmersiveMobileCurrentLyric(getCurrentTopLyricLine());
    renderImmersiveDesktopCurrentLyric(getCurrentTopLyricLine());
  }
}

function getLyricFontFamilyLabel(value) {
  return LYRIC_FONT_FAMILY_OPTIONS.find((option) => option.id === value)?.label || "系统默认";
}

function openLyricFontChoicePopover() {
  if (!lyricSettingsModal || lyricSettingsModal.hidden) {
    return;
  }

  const existing = lyricSettingsModal.querySelector(".lyric-settings-choice-popover");
  existing?.remove();
  lyricFontFamilyButton?.setAttribute("aria-expanded", "true");

  const popover = document.createElement("div");
  popover.className = "lyric-settings-choice-popover";
  popover.addEventListener("click", (event) => {
    if (event.target === popover) {
      closeLyricFontChoicePopover();
    }
  });

  const card = document.createElement("div");
  card.className = "lyric-settings-choice-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "选择歌词字体");

  const heading = document.createElement("div");
  heading.className = "lyric-settings-choice-heading";
  const title = document.createElement("strong");
  title.textContent = "歌词字体";
  const close = document.createElement("button");
  close.type = "button";
  close.setAttribute("aria-label", "关闭字体选择");
  close.append(createActionIcon("check"));
  close.addEventListener("click", closeLyricFontChoicePopover);
  heading.append(title, close);
  card.append(heading);

  LYRIC_FONT_FAMILY_OPTIONS.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lyric-settings-choice-option";
    button.classList.toggle("active", option.id === state.lyricSettings.fontFamily);
    button.setAttribute("aria-pressed", option.id === state.lyricSettings.fontFamily ? "true" : "false");

    const copy = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = option.label;
    const detail = document.createElement("small");
    detail.textContent = option.detail;
    copy.append(label, detail);
    button.append(copy);

    button.addEventListener("click", () => {
      updateLyricSetting("fontFamily", option.id);
      closeLyricFontChoicePopover();
    });
    card.append(button);
  });

  popover.append(card);
  lyricSettingsModal.querySelector(".lyric-settings-card")?.append(popover);
  card.querySelector("button")?.focus({ preventScroll: true });
}

function closeLyricFontChoicePopover() {
  lyricSettingsModal?.querySelector(".lyric-settings-choice-popover")?.remove();
  lyricFontFamilyButton?.setAttribute("aria-expanded", "false");
}

function refreshLyricLayoutAfterSettingsChange() {
  const syncTime = getVisibleLyricSyncTimeSeconds();
  updateLyricsHighlight(syncTime, true);

  if (lyricSettingsLayoutFrame) {
    cancelAnimationFrame(lyricSettingsLayoutFrame);
  }

  lyricSettingsLayoutFrame = requestAnimationFrame(() => {
    lyricSettingsLayoutFrame = 0;
    updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  });
}

function openLyricSettingsModal() {
  if (!lyricSettingsModal) {
    return;
  }

  if (lyricSettingsCloseTimer) {
    clearTimeout(lyricSettingsCloseTimer);
    lyricSettingsCloseTimer = 0;
  }

  renderLyricSettingsControls();
  renderLyricOffsetControls();
  lyricSettingsModal.classList.remove("is-closing");
  lyricSettingsModal.hidden = false;
  requestAnimationFrame(() => {
    lyricSettingsModal.classList.add("is-open");
    lyricSettingsClose?.focus();
  });
}

function closeLyricSettingsModal() {
  if (!lyricSettingsModal || lyricSettingsModal.hidden || lyricSettingsCloseTimer) {
    return;
  }

  closeLyricFontChoicePopover();
  flushLyricSettingsSave();
  lyricSettingsModal.classList.remove("is-open");
  lyricSettingsModal.classList.add("is-closing");
  lyricSettingsCloseTimer = window.setTimeout(() => {
    lyricSettingsModal.hidden = true;
    lyricSettingsModal.classList.remove("is-closing");
    lyricSettingsCloseTimer = 0;
  }, 260);
}

function handleLyricSettingsDocumentClick(event) {
  if (!lyricSettingsModal || lyricSettingsModal.hidden || !(event.target instanceof Element)) {
    return;
  }

  if (
    lyricSettingsModal.querySelector(".lyric-settings-card")?.contains(event.target)
    || immersiveMoreButton?.contains(event.target)
    || immersiveMobileMoreButton?.contains(event.target)
  ) {
    return;
  }

  closeLyricSettingsModal();
}

function loadImmersivePlayerStyle() {
  try {
    const raw = localStorage.getItem(IMMERSIVE_PLAYER_STYLE_KEY);
    return normalizeImmersivePlayerStyle(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_IMMERSIVE_PLAYER_STYLE };
  }
}

function loadPlaybackDisplaySettings() {
  try {
    const raw = localStorage.getItem(IMMERSIVE_MORE_PLAYBACK_DISPLAY_KEY);
    return normalizePlaybackDisplaySettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...PLAYBACK_DISPLAY_DEFAULTS };
  }
}

function normalizePlaybackDisplaySettings(settings = {}) {
  return settingsOps.normalizePlaybackDisplaySettings(settings, {
    defaults: PLAYBACK_DISPLAY_DEFAULTS,
    rates: PLAYBACK_DISPLAY_RATE_OPTIONS,
    effects: PLAYBACK_DISPLAY_SOUND_EFFECTS,
  });
}

function savePlaybackDisplaySettings(settings = state.playbackDisplaySettings) {
  state.playbackDisplaySettings = normalizePlaybackDisplaySettings(settings);
  localStorage.setItem(IMMERSIVE_MORE_PLAYBACK_DISPLAY_KEY, JSON.stringify(state.playbackDisplaySettings));
  applyPlaybackDisplaySettings();
}

function applyPlaybackDisplaySettings() {
  const settings = normalizePlaybackDisplaySettings(state.playbackDisplaySettings);
  state.playbackDisplaySettings = settings;
  audioPlayer.playbackRate = settings.playbackRate;
  audioPlayer.preservesPitch = true;
  audioPlayer.mozPreservesPitch = true;
  audioPlayer.webkitPreservesPitch = true;
}

function saveImmersivePlayerStyle() {
  localStorage.setItem(IMMERSIVE_PLAYER_STYLE_KEY, JSON.stringify(normalizeImmersivePlayerStyle(state.immersivePlayerStyle)));
}

function normalizeImmersivePlayerStyle(style = {}) {
  const themeIds = new Set(IMMERSIVE_PLAYER_THEME_OPTIONS.map((option) => option.id));
  const visualizerIds = new Set(IMMERSIVE_VISUALIZER_STYLE_OPTIONS.map((option) => option.id));
  const theme = themeIds.has(style?.theme) ? style.theme : DEFAULT_IMMERSIVE_PLAYER_STYLE.theme;
  const visualizer = visualizerIds.has(style?.visualizer) ? style.visualizer : DEFAULT_IMMERSIVE_PLAYER_STYLE.visualizer;

  return { theme, visualizer };
}

function applyImmersivePlayerStyle(options = {}) {
  state.immersivePlayerStyle = normalizeImmersivePlayerStyle(state.immersivePlayerStyle);
  state.immersiveBackgroundMode = state.immersivePlayerStyle.theme;
  state.immersiveVisualizerStyle = state.immersivePlayerStyle.visualizer;
  applyImmersiveBackgroundMode({ syncStyle: false });
  applyImmersiveVisualizerStyle();
  renderPlayerStyleControls();

  if (options.save) {
    saveImmersivePlayerStyle();
  }
}

function applyImmersiveVisualizerStyle() {
  const style = IMMERSIVE_VISUALIZER_STYLE_OPTIONS.some((option) => option.id === state.immersiveVisualizerStyle)
    ? state.immersiveVisualizerStyle
    : DEFAULT_IMMERSIVE_PLAYER_STYLE.visualizer;
  const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
  const waveform = getImmersiveWaveformParts();

  shell?.setAttribute("data-visualizer-style", style);
  if (waveform.root) {
    waveform.root.dataset.visualizerStyle = style;
  }
  if (immersiveVisualizerLevels.length) {
    const peak = immersiveVisualizerLevels.reduce((max, level) => Math.max(max, Math.abs(level)), 0);
    renderImmersiveWaveform(immersiveVisualizerLevels, peak);
  }
}

function renderPlayerStyleControls() {
  const normalized = normalizeImmersivePlayerStyle(state.immersivePlayerStyle);

  playerThemeButtons.forEach((button) => {
    const active = button.dataset.playerTheme === normalized.theme;
    const label = getPlayerStyleChoiceLabel(button);
    button.classList.toggle("active", active);
    button.toggleAttribute("data-current", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", `${active ? "当前播放器主题" : "切换播放器主题"}：${label}`);
    button.setAttribute("title", `${active ? "当前" : "切换到"}：${label}`);
  });

  visualizerStyleButtons.forEach((button) => {
    const active = button.dataset.visualizerStyle === normalized.visualizer;
    const label = getPlayerStyleChoiceLabel(button);
    button.classList.toggle("active", active);
    button.toggleAttribute("data-current", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.setAttribute("aria-label", `${active ? "当前可视化音乐样式" : "切换可视化音乐样式"}：${label}`);
    button.setAttribute("title", `${active ? "当前" : "切换到"}：${label}`);
  });
}

function getPlayerStyleChoiceLabel(button) {
  return button?.querySelector("strong")?.textContent?.trim() || "样式";
}

function updateImmersivePlayerStyle(key, value) {
  const nextStyle = normalizeImmersivePlayerStyle({
    ...state.immersivePlayerStyle,
    [key]: value,
  });
  const previousStyle = normalizeImmersivePlayerStyle(state.immersivePlayerStyle);

  state.immersivePlayerStyle = nextStyle;
  applyImmersivePlayerStyle({ save: true });

  if (previousStyle.theme !== nextStyle.theme || previousStyle.visualizer !== nextStyle.visualizer) {
    setLibraryStatus(`播放器样式已更新：${getImmersivePlayerStyleSummary()}。`);
  }
}

function getImmersivePlayerStyleSummary() {
  const style = normalizeImmersivePlayerStyle(state.immersivePlayerStyle);
  const theme = IMMERSIVE_PLAYER_THEME_OPTIONS.find((option) => option.id === style.theme)?.label || "原始封面";
  const visualizer = IMMERSIVE_VISUALIZER_STYLE_OPTIONS.find((option) => option.id === style.visualizer)?.label || "暖白长波";
  return `${theme} / ${visualizer}`;
}

function openPlayerStyleModal() {
  if (!playerStyleModal) {
    return;
  }

  if (playerStyleCloseTimer) {
    clearTimeout(playerStyleCloseTimer);
    playerStyleCloseTimer = 0;
  }

  renderPlayerStyleControls();
  playerStyleModal.classList.remove("is-closing");
  playerStyleModal.hidden = false;
  requestAnimationFrame(() => {
    playerStyleModal.classList.add("is-open");
    playerStyleClose?.focus();
  });
}

function closePlayerStyleModal() {
  if (!playerStyleModal || playerStyleModal.hidden || playerStyleCloseTimer) {
    return;
  }

  playerStyleModal.classList.remove("is-open");
  playerStyleModal.classList.add("is-closing");
  playerStyleCloseTimer = window.setTimeout(() => {
    playerStyleModal.hidden = true;
    playerStyleModal.classList.remove("is-closing");
    playerStyleCloseTimer = 0;
  }, 260);
}

function handlePlayerStyleDocumentClick(event) {
  if (!playerStyleModal || playerStyleModal.hidden || !(event.target instanceof Element)) {
    return;
  }

  if (
    playerStyleModal.querySelector(".player-style-card")?.contains(event.target)
    || immersiveMoreButton?.contains(event.target)
    || immersiveMobileMoreButton?.contains(event.target)
  ) {
    return;
  }

  closePlayerStyleModal();
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
    updateInlineLyricProgress(activeIndex, currentSeconds);
    if (isImmersiveLyricsVisible()) {
      updateImmersiveLyricProgress(currentSeconds);
    }
    syncLyricProgressLoop();
    return;
  }

  state.activeLyricIndex = activeIndex;
  renderNowLyricFocus();
  updateInlineLyricProgress(activeIndex, currentSeconds);
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

function scrollElementIntoNearestContainerView(element, options = {}) {
  const container = getNearestScrollableContainer(element, options.fallback || content);

  if (!container) {
    return false;
  }

  return scrollElementIntoContainerView(container, element, options);
}

function getNearestScrollableContainer(element, fallback = content) {
  if (!element) {
    return fallback || null;
  }

  let current = element.parentElement;

  while (current && current !== document.body && current !== document.documentElement) {
    if (isScrollableContainer(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return fallback || null;
}

function isScrollableContainer(element) {
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const canScrollY = /(auto|scroll|overlay)/.test(overflowY);

  return canScrollY && element.scrollHeight > element.clientHeight + 1;
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

function bindLyricManualScrollGuards() {
  [lyricsList, immersiveLyricList].filter(Boolean).forEach((list) => {
    ["wheel", "touchstart", "pointerdown"].forEach((eventName) => {
      list.addEventListener(eventName, markManualLyricScrollIntent, { passive: true });
    });
  });
}

function markManualLyricScrollIntent() {
  lastManualLyricScrollAt = getMonotonicNowMs();
}

function isLyricAutoScrollSuppressedByUser(nowMs = getMonotonicNowMs()) {
  return nowMs - lastManualLyricScrollAt < LYRIC_USER_SCROLL_SUPPRESS_MS;
}

function shouldScrollLyricLine(isForced = false) {
  if (isForced) {
    lastLyricAutoScrollAt = getMonotonicNowMs();
    return true;
  }

  if (state.lyricSettings?.autoScroll === false) {
    return false;
  }

  const nowMs = getMonotonicNowMs();
  if (isLyricAutoScrollSuppressedByUser(nowMs)) {
    return false;
  }

  if (nowMs - lastLyricAutoScrollAt < LYRIC_AUTO_SCROLL_MIN_INTERVAL_MS) {
    return false;
  }

  lastLyricAutoScrollAt = nowMs;
  return true;
}

function resetLyricLineElementCache() {
  activeLyricListIndex = -1;
  lyricLineElements = [];
  lyricLineWordGroups = [];
}

function syncLyricListActiveClass(activeIndex) {
  if (activeLyricListIndex === activeIndex) {
    return;
  }

  lyricLineElements[activeLyricListIndex]?.classList.remove("active");
  resetLyricWordGroups(lyricLineWordGroups[activeLyricListIndex]);
  lyricLineElements[activeIndex]?.classList.add("active");
  activeLyricListIndex = activeIndex;
}

function updateInlineLyricProgress(activeIndex, currentSeconds, options = {}) {
  if (!state.isLyricSynced || activeIndex < 0) {
    return;
  }

  const shouldUpdateList = options.list ?? isNowPlayingLyricsVisible();
  const shouldUpdateFocus = options.focus ?? isNowPlayingLyricsVisible();
  const groups = [
    ...(shouldUpdateList ? lyricLineWordGroups[activeIndex] || [] : []),
    ...(shouldUpdateFocus ? nowLyricWordGroups : []),
  ];

  if (!groups.length) {
    return;
  }

  const currentLine = state.lyricLines[activeIndex];
  const start = Number(currentLine?.time);
  const nextEntry = getNextLyricTimelineEntry(activeIndex);
  const lyricSeconds = getAdjustedLyricSeconds(currentSeconds);

  if (!Number.isFinite(start)) {
    groups.forEach((group) => updateLyricWordProgressWindowForGroup(group, group?.words?.length || 0));
    return;
  }

  groups.forEach((group) => {
    updateLyricProgressGroup(group, {
      line: currentLine,
      start,
      lyricSeconds,
      nextEntry,
      monotonic: options.monotonic,
    });
  });
}

function updateLyricProgressGroup(group, options) {
  const words = group?.words || [];
  if (!words.length) {
    return;
  }

  if (group.hasUsableTimedWords) {
    updateTimedLyricWordProgress(-1, words, options.lyricSeconds, options.nextEntry, group, {
      monotonic: options.monotonic,
    });
    return;
  }

  const end = getLyricWordProgressEndSeconds(options.start, options.nextEntry, words.length, {
    line: group.line || options.line,
    text: group.text,
  });
  const lineRatio = end > options.start
    ? clamp((options.lyricSeconds - options.start) / (end - options.start), 0, 1)
    : 1;
  updateWeightedLyricWordProgressWindowForGroup(group, lineRatio, {
    monotonic: options.monotonic,
  });
}

function resetLyricWordGroups(groups) {
  (groups || []).forEach((group) => {
    resetLyricProgressGroupWindow(group);
    (group?.words || []).forEach((word) => setLyricWordProgress(word, 0));
  });
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
    updateMiniPlayerLyric(null);
    renderTopLyricFocus(null);
    renderImmersiveMobileCurrentLyric(null);
    return;
  }

  if (!state.lyricLines.length) {
    nowLyricStatus.textContent = state.lyricsStatus ? "读取中" : "暂无歌词";
    nowLyricCurrent.textContent = state.lyricsStatus || "没有读取到歌词。";
    nowLyricNext.textContent = "可在设置中配置音源桥以联网匹配歌词。";
    nowLyricFocus.disabled = true;
    nowLyricFocus.classList.remove("synced");
    updateMiniPlayerLyric(null);
    renderTopLyricFocus(null);
    renderImmersiveMobileCurrentLyric(null);
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
  updateMiniPlayerLyric(currentLine);
  renderTopLyricFocus(currentLine);
  renderImmersiveMobileCurrentLyric(currentLine);
  renderImmersiveDesktopCurrentLyric(currentLine);
}

function hasLikelyChineseText(value) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ""));
}

function hasLikelyBilingualText(value) {
  const linesByTime = new Map();
  const timePattern = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  String(value || "").split(/\r?\n/).forEach((rawLine) => {
    const matches = [...rawLine.matchAll(timePattern)];
    const text = rawLine.replace(timePattern, "").trim();
    if (!matches.length || !text) {
      return;
    }

    matches.forEach((match) => {
      const minutes = Number(match[2] || 0);
      const seconds = Number(match[3] || 0);
      const fraction = match[4] ? Number(`0.${match[4].padEnd(3, "0").slice(0, 3)}`) : 0;
      const key = String(Math.round((minutes * 60 + seconds + fraction) * 100));
      const group = linesByTime.get(key) || [];
      group.push(text);
      linesByTime.set(key, group);
    });
  });

  let bilingualLines = 0;
  linesByTime.forEach((group) => {
    const hasChinese = group.some(hasLikelyChineseText);
    const hasOther = group.some((line) => line && !hasLikelyChineseText(line));
    if (hasChinese && hasOther) {
      bilingualLines += 1;
    }
  });

  return bilingualLines >= 3;
}

function countLyricLikeLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter((line) => /\[\d{1,2}:\d{2}/.test(line) && line.replace(/\[[^\]]+\]/g, "").trim())
    .length;
}

function renderImmersiveMobileCurrentLyric(line) {
  if (!immersiveMobileCurrentLyric) {
    return;
  }

  const parts = getImmersiveMobileCurrentLyricParts(line);
  const text = parts.map((part) => part.text).join("\n");
  const previousSignature = immersiveMobileCurrentLyric.dataset.signature || "";
  immersiveMobileCurrentLyric.hidden = !text;

  if (!text) {
    immersiveMobileCurrentLyric.replaceChildren();
    immersiveMobileCurrentLyric.removeAttribute("title");
    immersiveMobileCurrentLyric.dataset.signature = "";
    immersiveMobileCurrentLyric.classList.remove("is-changing", "is-bilingual");
    clearImmersiveMobileCurrentLyricAnimationTimer();
    return;
  }

  immersiveMobileCurrentLyric.title = text;
  immersiveMobileCurrentLyric.classList.toggle("is-bilingual", parts.length > 1);
  if (previousSignature === text) {
    return;
  }

  immersiveMobileCurrentLyric.dataset.signature = text;
  immersiveMobileCurrentLyric.replaceChildren(...parts.map((part) => {
    const span = document.createElement("span");
    span.className = `immersive-mobile-current-lyric-${part.role}`;
    span.textContent = part.text;
    return span;
  }));
  clearImmersiveMobileCurrentLyricAnimationTimer();
  immersiveMobileCurrentLyric.classList.remove("is-changing");
  void immersiveMobileCurrentLyric.offsetWidth;
  immersiveMobileCurrentLyric.classList.add("is-changing");
  immersiveMobileCurrentLyricAnimationTimer = window.setTimeout(() => {
    immersiveMobileCurrentLyricAnimationTimer = 0;
    immersiveMobileCurrentLyric.classList.remove("is-changing");
  }, 360);
}

function renderImmersiveDesktopCurrentLyric(line) {
  if (!immersiveDesktopCurrentLyric) {
    return;
  }

  const parts = getImmersiveMobileCurrentLyricParts(line);
  const text = parts.map((part) => part.text).join("\n") || (state.currentTrack ? "没有读取到歌词。" : "播放歌曲后显示歌词。");
  immersiveDesktopCurrentLyric.title = text;
  immersiveDesktopCurrentLyric.classList.toggle("is-empty", !line);
  immersiveDesktopCurrentLyric.classList.toggle("is-bilingual", parts.length > 1);

  if (!parts.length) {
    immersiveDesktopCurrentLyric.textContent = text;
    return;
  }

  immersiveDesktopCurrentLyric.replaceChildren(...parts.map((part) => {
    const span = document.createElement("span");
    span.className = getImmersiveDesktopCurrentLyricClassName(part.role);
    span.textContent = part.text;
    return span;
  }));
}

function getImmersiveDesktopCurrentLyricClassName(role) {
  if (role === "original") {
    return "immersive-desktop-current-lyric-original";
  }

  if (role === "translated") {
    return "immersive-desktop-current-lyric-translated";
  }

  return "immersive-desktop-current-lyric-single";
}

function clearImmersiveMobileCurrentLyricAnimationTimer() {
  if (!immersiveMobileCurrentLyricAnimationTimer) {
    return;
  }

  clearTimeout(immersiveMobileCurrentLyricAnimationTimer);
  immersiveMobileCurrentLyricAnimationTimer = 0;
}

function getImmersiveMobileCurrentLyricParts(line) {
  if (!state.currentTrack || !line) {
    return [];
  }

  const originalText = normalizeImmersiveMobileCurrentLyricText(line.originalText || "");
  const translatedText = normalizeImmersiveMobileCurrentLyricText(line.originalText ? line.text : "");

  if (originalText && translatedText) {
    return [
      { role: "original", text: originalText },
      { role: "translated", text: translatedText },
    ];
  }

  const singleText = normalizeImmersiveMobileCurrentLyricText(line.originalText || line.text || "");
  return singleText ? [{ role: "single", text: singleText }] : [];
}

function getImmersiveMobileCurrentLyricText(line) {
  return getImmersiveMobileCurrentLyricParts(line).map((part) => part.text).join(" / ");
}

function getMiniPlayerLyricText(line) {
  const parts = getImmersiveMobileCurrentLyricParts(line);
  if (!parts.length) {
    return "";
  }

  const preferredPart = parts.find((part) => hasLikelyChineseText(part.text)) || parts[0];
  return normalizeImmersiveMobileCurrentLyricText(preferredPart.text);
}

function getMiniPlayerLyricMaxUnits() {
  const visibleWidth = Math.max(
    miniPlayerTitleViewport?.clientWidth || 0,
    miniPlayerLyric?.clientWidth || 0,
  );

  if (visibleWidth > 0) {
    return Math.max(16, Math.min(34, Math.floor(visibleWidth / 6.2)));
  }

  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 390;
  if (viewportWidth <= 360) {
    return 23;
  }
  if (viewportWidth <= 390) {
    return 26;
  }
  if (viewportWidth <= 430) {
    return 29;
  }
  return 32;
}

function getMiniPlayerLyricCharUnits(char) {
  if (!char) {
    return 0;
  }

  if (/[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7af\uff01-\uff60\uffe0-\uffef]/u.test(char)) {
    return 2;
  }

  if (/[A-Z0-9]/.test(char)) {
    return 1.08;
  }

  return 1;
}

function getStringVisualUnits(text) {
  return [...String(text || "")].reduce((total, char) => total + getMiniPlayerLyricCharUnits(char), 0);
}

function truncateMiniPlayerLyricText(text, maxUnits = getMiniPlayerLyricMaxUnits()) {
  const source = normalizeImmersiveMobileCurrentLyricText(text);
  if (!source || getStringVisualUnits(source) <= maxUnits) {
    return source;
  }

  const ellipsisUnits = 2;
  const targetUnits = Math.max(8, maxUnits - ellipsisUnits);
  let units = 0;
  let output = "";

  for (const char of source) {
    const nextUnits = units + getMiniPlayerLyricCharUnits(char);
    if (nextUnits > targetUnits) {
      break;
    }
    output += char;
    units = nextUnits;
  }

  return `${output.replace(/[\s，,。.!！?？、；;：:《“‘（(]+$/u, "")}…`;
}

function normalizeImmersiveMobileCurrentLyricText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function setMiniPlayerLyricVisible(isVisible) {
  if (!playerMetaButton) {
    return;
  }
  playerMetaButton.classList.toggle("is-lyric-visible", Boolean(isVisible));
}

function clearMiniPlayerLyricTimers() {
  if (miniPlayerLyricRevealTimer) {
    window.clearTimeout(miniPlayerLyricRevealTimer);
    miniPlayerLyricRevealTimer = 0;
  }
  if (miniPlayerLyricRefreshTimer) {
    window.clearTimeout(miniPlayerLyricRefreshTimer);
    miniPlayerLyricRefreshTimer = 0;
  }
}

function scheduleMiniPlayerLyricReveal() {
  if (!miniPlayerLyricText || !miniPlayerLyric || miniPlayerLyric.hidden || miniPlayerLyricRevealTimer) {
    return;
  }

  miniPlayerLyricRevealTimer = window.setTimeout(() => {
    miniPlayerLyricRevealTimer = 0;
    if (miniPlayerLyricText && !miniPlayerLyric?.hidden) {
      setMiniPlayerLyricVisible(true);
    }
  }, MINI_PLAYER_LYRIC_REVEAL_DELAY_MS);
}

function restartMiniPlayerLyricIdleCountdown() {
  if (!miniPlayerLyricText || !miniPlayerLyric || miniPlayerLyric.hidden) {
    return;
  }

  if (miniPlayerLyricRevealTimer) {
    window.clearTimeout(miniPlayerLyricRevealTimer);
    miniPlayerLyricRevealTimer = 0;
  }
  playerMetaButton?.classList.remove("is-lyric-refreshing");
  setMiniPlayerLyricVisible(false);
  scheduleMiniPlayerLyricReveal();
}

function handleMiniPlayerLyricUserActivity() {
  const now = Date.now();
  if (now - miniPlayerLyricLastIdleResetAt < 350) {
    return;
  }
  miniPlayerLyricLastIdleResetAt = now;
  restartMiniPlayerLyricIdleCountdown();
}

function bindMiniPlayerLyricIdleListeners() {
  if (miniPlayerLyricIdleListenersBound) {
    return;
  }

  miniPlayerLyricIdleListenersBound = true;
  [
    ["pointerdown", document],
    ["touchstart", document],
    ["keydown", document],
    ["wheel", window],
  ].forEach(([eventName, target]) => {
    target.addEventListener(eventName, handleMiniPlayerLyricUserActivity, { passive: true, capture: true });
  });
}

function triggerMobileNavItemAnimation(button) {
  if (!button?.classList?.contains("nav-item")) {
    return;
  }

  if (button._mobileNavAnimationTimer) {
    window.clearTimeout(button._mobileNavAnimationTimer);
  }
  button.classList.remove("is-nav-animating");
  void button.offsetWidth;
  button.classList.add("is-nav-animating");
  button._mobileNavAnimationTimer = window.setTimeout(() => {
    button.classList.remove("is-nav-animating");
    button._mobileNavAnimationTimer = 0;
  }, 460);
}

function updateMiniPlayerLyric(line) {
  if (!miniPlayerLyric && !playerMetaButton) {
    return;
  }

  const fullText = line ? getMiniPlayerLyricText(line) : "";
  if (!fullText) {
    clearMiniPlayerLyricTimers();
    miniPlayerLyricText = "";
    setMiniPlayerLyricVisible(false);
    playerMetaButton?.classList.remove("is-lyric-refreshing");
    if (miniPlayerLyric) {
      miniPlayerLyric.hidden = true;
      miniPlayerLyric.removeAttribute("title");
      setTextIfChanged(miniPlayerLyric, "");
    }
    return;
  }

  const text = truncateMiniPlayerLyricText(fullText);
  const wasVisible = Boolean(playerMetaButton?.classList.contains("is-lyric-visible"));
  const hasChanged = fullText !== miniPlayerLyricText;
  miniPlayerLyricText = fullText;

  if (miniPlayerLyric) {
    setTextIfChanged(miniPlayerLyric, text);
    miniPlayerLyric.hidden = false;
    miniPlayerLyric.title = fullText;
  }

  if (wasVisible) {
    if (hasChanged && playerMetaButton) {
      playerMetaButton.classList.remove("is-lyric-refreshing");
      // 强制重新触发单行动效，让新歌词轻微上浮接管，不闪回歌名区域。
      void playerMetaButton.offsetWidth;
      playerMetaButton.classList.add("is-lyric-refreshing");
      if (miniPlayerLyricRefreshTimer) {
        window.clearTimeout(miniPlayerLyricRefreshTimer);
      }
      miniPlayerLyricRefreshTimer = window.setTimeout(() => {
        playerMetaButton?.classList.remove("is-lyric-refreshing");
        miniPlayerLyricRefreshTimer = 0;
      }, 320);
    }
    return;
  }

  scheduleMiniPlayerLyricReveal();
}

function renderNowLyricFocusLine(line) {
  nowLyricCurrent.replaceChildren();
  nowLyricWordGroups = appendLyricLineContent(nowLyricCurrent, line, {
    originalClassName: "now-lyric-original",
    translatedClassName: "now-lyric-translated",
  });
}

function getCurrentTopLyricLine() {
  if (!state.currentTrack || !state.lyricLines.length) {
    return null;
  }

  const activeIndex = state.isLyricSynced && state.activeLyricIndex >= 0
    ? state.activeLyricIndex
    : 0;
  return state.lyricLines[activeIndex] || state.lyricLines[0] || null;
}

function renderTopLyricFocus(line) {
  if (!topLyricFocus || !topLyricOriginal || !topLyricCurrent) {
    return;
  }

  if (!shouldRenderTopbarLyricFocus()) {
    hideTopLyricFocus();
    return;
  }

  const shouldShow = Boolean(state.currentTrack && line?.text);
  topLyricFocus.hidden = !shouldShow;

  if (!shouldShow) {
    topLyricOriginal.textContent = "";
    topLyricCurrent.textContent = "播放歌曲后显示歌词。";
    resetTopLyricShardState();
    updateTopbarLyricState();
    return;
  }

  topLyricOriginal.hidden = !line.originalText;
  renderTopLyricCharacters(line);
  updateTopbarLyricState();
}

function shouldRenderTopbarLyricFocus() {
  return TOPBAR_LYRIC_DISPLAY_ENABLED && getActiveView() !== "immersivePlayer";
}

function hideTopLyricFocus() {
  topLyricFocus.hidden = true;
  topLyricOriginal.textContent = "";
  topLyricCurrent.textContent = "";
  resetTopLyricShardState();
  updateTopbarLyricState();
}

function updateTopbarLyricState() {
  const shouldShowLyric = Boolean(
    topLyricFocus
      && shouldRenderTopbarLyricFocus()
      && !topLyricFocus.hidden
      && state.currentTrack
      && audioPlayer.src
      && !audioPlayer.paused
      && !audioPlayer.ended
  );

  document.body.classList.toggle("topbar-lyric-active", shouldShowLyric);
  if (shouldShowLyric) {
    syncTopLyricShardLoop();
  } else {
    resetTopLyricShardState({ keepText: true, alignOnResume: true });
  }
}

// 顶栏歌词进入播放态时，将整句拆成单字 span，后续由时间轴逐字触发碎裂。
function renderTopLyricCharacters(line) {
  const text = line?.text || line?.originalText || "";
  const originalText = line?.originalText || "";
  const signature = [
    state.currentTrack?.Id || "",
    state.activeLyricIndex,
    line?.time ?? "",
    originalText,
    text,
    line?.wordTimeline?.map((word) => `${word.time}:${word.value}`).join("|") || "",
    line?.translatedWordTimeline?.map((word) => `${word.time}:${word.value}`).join("|") || "",
  ].join("::");

  if (signature === topLyricRenderedSignature) {
    return;
  }

  cancelTopLyricShardEffects();
  topLyricRenderedSignature = signature;
  topLyricTriggeredWordIndex = -1;
  topLyricAlignPastOnNextLoop = false;
  topLyricCharacterSpans = [];
  topLyricCharacterTimings = [];
  topLyricCharacterGroups = [];
  topLyricOriginal.replaceChildren();
  if (originalText) {
    topLyricOriginal.replaceChildren(buildTopLyricCharacterFragment(originalText, line, {
      role: "original",
      timeline: line?.wordTimeline,
      shard: true,
    }));
  }
  topLyricCurrent.replaceChildren(buildTopLyricCharacterFragment(text, line, {
    role: line?.originalText ? "translated" : "single",
    timeline: line?.originalText ? line?.translatedWordTimeline : line?.wordTimeline,
    shard: true,
    primary: true,
  }));
}

// DOM 拆分：每个字符一个 span，CSS 默认 opacity 0.6，触发后切到 is-sharded。
function buildTopLyricCharacterFragment(text, line, options = {}) {
  const wrapper = document.createElement("span");
  wrapper.className = "top-lyric-text";
  wrapper.setAttribute("aria-label", text);
  wrapper.dataset.topLyricText = text;
  wrapper.dataset.topLyricRole = options.role || "line";
  const group = {
    role: options.role || "line",
    spans: [],
    timings: buildTopLyricCharacterTimings(text, line, options),
    shard: options.shard !== false,
    primary: Boolean(options.primary),
    triggeredIndex: -1,
  };

  Array.from(text || " ").forEach((character, index) => {
    const span = document.createElement("span");
    span.className = "top-lyric-char";
    span.textContent = character;
    span.dataset.charIndex = String(index);
    span.setAttribute("aria-hidden", "true");
    wrapper.append(span);
    group.spans[index] = span;
  });

  topLyricCharacterGroups.push(group);
  if (group.primary) {
    topLyricCharacterSpans = group.spans;
    topLyricCharacterTimings = group.timings;
  }
  return wrapper;
}

// 优先使用增强 LRC 的逐字时间；没有逐字时间时按当前行时长均分。
function buildTopLyricCharacterTimings(text, line, options = {}) {
  const characters = Array.from(text || " ");
  if (!characters.length) {
    return [];
  }

  const wordTimeline = getDisplayLyricWordTimeline(line, text, options);
  if (wordTimeline.length && doesTopLyricWordTimelineMatchText(text, wordTimeline)) {
    return mapTopLyricWordTimelineToCharacters(characters, wordTimeline, Number(line?.time));
  }

  const start = Number(line?.time);
  const timelineIndex = state.lyricTimelineIndexByLineIndex[state.activeLyricIndex] ?? -1;
  const nextEntry = timelineIndex >= 0 ? state.lyricTimeline[timelineIndex + 1] : null;
  const end = getLyricWordProgressEndSeconds(start, nextEntry, characters.length);
  const duration = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? end - start
    : Math.max(1.2, characters.length * 0.12);

  return characters.map((character, index) => (
    character.trim()
      ? start + ((duration * index) / Math.max(1, characters.length))
      : NaN
  ));
}

// 双语歌词可能显示译文，但 wordTimeline 来自原文；不匹配时回退到均分，避免错位。
function doesTopLyricWordTimelineMatchText(text, wordTimeline) {
  const timelineText = wordTimeline.map((word) => String(word?.value || "")).join("");
  const normalize = (value) => String(value || "").replace(/\s+/g, "").trim();
  return normalize(timelineText) === normalize(text);
}

function mapTopLyricWordTimelineToCharacters(characters, wordTimeline, fallbackStart) {
  const timings = new Array(characters.length).fill(NaN);
  let cursor = 0;

  wordTimeline.forEach((word, wordIndex) => {
    const value = String(word?.value || "");
    if (!value.trim()) {
      return;
    }

    const wordCharacters = Array.from(value.trim() || value);
    const start = Number(word?.time);
    const nextStart = Number(wordTimeline[wordIndex + 1]?.time);
    const explicitEnd = Number(word?.endTime);
    const end = Number.isFinite(explicitEnd) && explicitEnd > start
      ? explicitEnd
      : Number.isFinite(nextStart) && nextStart > start
      ? nextStart
      : start + Math.max(0.16, wordCharacters.length * 0.08);

    while (cursor < characters.length && !characters[cursor].trim()) {
      cursor += 1;
    }

    wordCharacters.forEach((character, characterIndex) => {
      while (cursor < characters.length && characters[cursor] !== character && !characters[cursor].trim()) {
        cursor += 1;
      }

      if (cursor >= characters.length) {
        return;
      }

      timings[cursor] = Number.isFinite(start)
        ? start + (((end - start) * characterIndex) / Math.max(1, wordCharacters.length))
        : fallbackStart;
      cursor += 1;
    });
  });

  return timings.map((time, index) => (
    Number.isFinite(time)
      ? time
      : (characters[index].trim() ? fallbackStart : NaN)
  ));
}

// 顶栏专用轻量 RAF：只在播放、顶栏歌词可见、未开启 reduced-motion 时运行。
function syncTopLyricShardLoop() {
  if (!shouldRunTopLyricShardLoop()) {
    stopTopLyricShardLoop();
    return;
  }

  if (topLyricAlignPastOnNextLoop) {
    alignTopLyricShardStateToTime(getAdjustedLyricSeconds(getLyricPlaybackTimeSeconds()));
    topLyricAlignPastOnNextLoop = false;
  }

  if (!topLyricShardFrame) {
    topLyricShardFrame = requestAnimationFrame(updateTopLyricShardFrame);
  }
}

function shouldRunTopLyricShardLoop() {
  return Boolean(
    topLyricFocus
      && !topLyricFocus.hidden
      && document.body.classList.contains("topbar-lyric-active")
      && topLyricCharacterGroups.some((group) => group.spans.length && group.timings.length)
      && state.currentTrack
      && audioPlayer.src
      && !audioPlayer.paused
      && !audioPlayer.ended
      && document.visibilityState !== "hidden"
      && !isTopbarMenuInteractionActive()
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isTopbarMenuInteractionActive() {
  return Boolean(
    topTabs
      && (
        topTabs.matches(":hover")
        || topTabs.contains(document.activeElement)
      )
  );
}

function updateTopLyricShardFrame() {
  topLyricShardFrame = 0;

  if (!shouldRunTopLyricShardLoop()) {
    return;
  }

  const lyricSeconds = getAdjustedLyricSeconds(getLyricPlaybackTimeSeconds());
  getTopLyricShardGroups().forEach((group) => {
    const nextIndex = findTopLyricShardIndex(lyricSeconds, group);

    if (nextIndex < 0) {
      return;
    }

    if (shouldAlignTopLyricShardCatchup(nextIndex, lyricSeconds, group)) {
      alignTopLyricGroupStateToIndex(group, nextIndex);
      return;
    }

    const triggerEndIndex = Math.min(
      nextIndex,
      group.triggeredIndex + TOP_LYRIC_SHARD_MAX_FRAME_TRIGGERS
    );
    for (let index = group.triggeredIndex + 1; index <= triggerEndIndex; index += 1) {
      triggerTopLyricGroupCharacter(group, index, { shard: true });
    }
    group.triggeredIndex = Math.max(group.triggeredIndex, triggerEndIndex);
  });

  syncTopLyricLegacyProgressState();

  syncTopLyricProgressGroups(lyricSeconds);

  syncTopLyricShardLoop();
}

function shouldAlignTopLyricShardCatchup(nextIndex, lyricSeconds, group = getTopLyricShardGroup()) {
  if (nextIndex <= (group?.triggeredIndex ?? -1) + TOP_LYRIC_SHARD_MAX_FRAME_TRIGGERS) {
    return false;
  }

  const firstPendingIndex = (group?.triggeredIndex ?? -1) + 1;
  const firstPendingTime = group?.timings?.[firstPendingIndex];
  if (!Number.isFinite(firstPendingTime)) {
    return true;
  }

  return lyricSeconds - firstPendingTime > TOP_LYRIC_SHARD_CATCHUP_ALIGN_SECONDS;
}

function findTopLyricShardIndex(lyricSeconds, group = getTopLyricShardGroup()) {
  if (!Number.isFinite(lyricSeconds)) {
    return -1;
  }

  const timings = group?.timings || [];
  let result = group?.triggeredIndex ?? -1;
  for (let index = result + 1; index < timings.length; index += 1) {
    const time = timings[index];

    if (!Number.isFinite(time)) {
      continue;
    }

    if (time > lyricSeconds) {
      break;
    }

    result = index;
  }

  return result;
}

function getTopLyricShardGroup() {
  return topLyricCharacterGroups.find((group) => group.primary && group.shard)
    || topLyricCharacterGroups.find((group) => group.shard)
    || topLyricCharacterGroups[0]
    || null;
}

function getTopLyricShardGroups() {
  return topLyricCharacterGroups.filter((group) => group?.shard && group.spans.length && group.timings.length);
}

// Timeline Controller：外部传入字符索引时，隐藏该字符并在原位置触发 Canvas 碎裂。
function triggerNextWord(index) {
  const group = getTopLyricShardGroup();
  triggerTopLyricGroupCharacter(group, index, { shard: true });
  if (group) {
    group.triggeredIndex = Math.max(group.triggeredIndex, index);
  }
  syncTopLyricLegacyProgressState();
}

function triggerTopLyricGroupCharacter(group, index, options = {}) {
  const span = group?.spans?.[index];
  if (!span || span.classList.contains("is-sharded")) {
    return;
  }

  span.classList.add("is-sharded");
  if (options.shard && span.textContent?.trim()) {
    spawnTopLyricShardCanvas(span);
  }
}

function alignTopLyricShardStateToTime(lyricSeconds) {
  topLyricCharacterGroups.forEach((group) => {
    alignTopLyricGroupStateToIndex(group, findTopLyricShardIndex(lyricSeconds, group));
  });
  syncTopLyricLegacyProgressState();
}

function alignTopLyricShardStateToIndex(currentIndex, lyricSeconds = NaN) {
  const shardGroup = getTopLyricShardGroup();
  alignTopLyricGroupStateToIndex(shardGroup, currentIndex);
  syncTopLyricLegacyProgressState();
  syncTopLyricProgressGroupsToTime(
    Number.isFinite(lyricSeconds) ? lyricSeconds : shardGroup?.timings?.[currentIndex]
  );
}

function alignTopLyricGroupStateToIndex(group, currentIndex) {
  if (!group) {
    return;
  }

  group.spans.forEach((span, index) => {
    span?.classList.toggle("is-sharded", index <= currentIndex && Number.isFinite(group.timings[index]));
  });
  group.triggeredIndex = currentIndex;
}

function syncTopLyricLegacyProgressState() {
  topLyricTriggeredWordIndex = getTopLyricShardGroup()?.triggeredIndex ?? -1;
}

function syncTopLyricProgressGroups(lyricSeconds) {
  topLyricCharacterGroups.forEach((group) => {
    if (!group || group.shard) {
      return;
    }

    const nextIndex = findTopLyricShardIndex(lyricSeconds, group);
    if (nextIndex === group.triggeredIndex) {
      return;
    }

    alignTopLyricGroupStateToIndex(group, nextIndex);
  });
}

function syncTopLyricProgressGroupsToTime(lyricSeconds) {
  topLyricCharacterGroups.forEach((group) => {
    if (!group || group.shard) {
      return;
    }

    const currentIndex = findTopLyricShardIndex(lyricSeconds, group);
    alignTopLyricGroupStateToIndex(group, currentIndex);
  });
}

// 为当前字符创建一个微型 canvas，覆盖在字符原位上方，动画结束后销毁。
function spawnTopLyricShardCanvas(span) {
  if (!topLyricFocus || !topLyricFocus.isConnected || !span.isConnected) {
    return;
  }

  trimTopLyricShardEffects();

  const spanRect = span.getBoundingClientRect();
  const focusRect = topLyricFocus.getBoundingClientRect();
  if (!spanRect.width || !spanRect.height || !focusRect.width || !focusRect.height) {
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, TOP_LYRIC_SHARD_MAX_DPR);
  const canvas = document.createElement("canvas");
  const padding = getTopLyricShardPadding(spanRect, focusRect);
  const width = Math.ceil(spanRect.width + (padding.x * 2));
  const height = Math.ceil(spanRect.height + (padding.y * 2));
  const left = clamp(spanRect.left - focusRect.left - padding.x, 0, Math.max(0, focusRect.width - width));
  const top = clamp(spanRect.top - focusRect.top - padding.y, 0, Math.max(0, focusRect.height - height));
  canvas.className = "top-lyric-shard-canvas";
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.scale(dpr, dpr);
  const fontStyle = window.getComputedStyle(span);
  const shardColor = topLyricShardOptions.color || getTopLyricShardColor(span);
  const shardAccentColor = topLyricShardOptions.accentColor || getTopLyricShardAccentColor();
  const shardGlowColor = topLyricShardOptions.glowColor || getTopLyricShardGlowColor();
  const shards = createTopLyricShards(span.textContent || "", spanRect, fontStyle, {
    color: shardColor,
    accentColor: shardAccentColor,
    glowColor: shardGlowColor,
    width,
    height,
    originX: spanRect.left - focusRect.left - left,
    originY: spanRect.top - focusRect.top - top,
  });

  if (!shards.length) {
    return;
  }

  topLyricFocus.append(canvas);
  const effect = {
    canvas,
    ctx,
    shards,
    width,
    height,
    flash: {
      alpha: TOP_LYRIC_SHARD_FLASH_FADE,
      character: span.textContent || "",
      centerX: spanRect.left - focusRect.left - left + (spanRect.width / 2),
      centerY: spanRect.top - focusRect.top - top + (spanRect.height / 2),
      color: shardAccentColor,
      font: `${fontStyle.fontWeight || 800} ${parseFloat(fontStyle.fontSize) || spanRect.height || 16}px ${fontStyle.fontFamily || "system-ui"}`,
      glowColor: shardGlowColor,
      scale: 1.04,
    },
  };
  topLyricShardEffects.push(effect);
  syncTopLyricShardAnimationLoop();
}

function getTopLyricShardPadding(spanRect, focusRect) {
  return {
    x: Math.min(TOP_LYRIC_SHARD_PADDING, Math.max(6, focusRect.width / 24)),
    y: Math.min(TOP_LYRIC_SHARD_PADDING, Math.max(8, spanRect.height * 0.78)),
  };
}

function getTopLyricShardColor(span) {
  const accent = window.getComputedStyle(document.documentElement)
    .getPropertyValue("--now-accent")
    .trim();

  return accent || TOP_LYRIC_SHARD_DEFAULT_COLOR;
}

function getTopLyricShardAccentColor() {
  return "rgba(255, 126, 96, 0.82)";
}

function getTopLyricShardGlowColor() {
  const rgb = window.getComputedStyle(document.documentElement)
    .getPropertyValue("--now-accent-rgb")
    .trim();

  return rgb ? `rgba(${rgb}, 0.24)` : TOP_LYRIC_SHARD_GLOW_COLOR;
}

// Shard System：从字形像素中取样，生成少量带速度、旋转、寿命的不规则碎片。
function createTopLyricShards(character, rect, fontStyle, options) {
  const count = randomInteger(TOP_LYRIC_SHARD_MIN_COUNT, TOP_LYRIC_SHARD_MAX_COUNT);
  const originX = Number.isFinite(options.originX) ? options.originX : TOP_LYRIC_SHARD_PADDING;
  const originY = Number.isFinite(options.originY) ? options.originY : TOP_LYRIC_SHARD_PADDING;
  const centerX = originX + (rect.width / 2);
  const centerY = originY + (rect.height / 2);
  const fontSize = parseFloat(fontStyle.fontSize) || rect.height || 16;
  const color = options.color || TOP_LYRIC_SHARD_DEFAULT_COLOR;
  const accentColor = options.accentColor || TOP_LYRIC_SHARD_ACCENT_COLOR;
  const glowColor = options.glowColor || TOP_LYRIC_SHARD_GLOW_COLOR;
  const font = `${fontStyle.fontWeight || 800} ${fontSize}px ${fontStyle.fontFamily || "system-ui"}`;
  const points = sampleTopLyricGlyphPoints(character, {
    count,
    width: options.width,
    height: options.height,
    centerX,
    centerY,
    font,
  });

  return points.map((point) => {
    const glyphScale = Math.min(rect.width || fontSize, rect.height || fontSize);
    const size = Math.max(1.15, glyphScale * (0.075 + Math.random() * 0.095));
    const distanceFromCenter = (point.x - centerX) / Math.max(1, rect.width);
    const burst = 0.45 + Math.random() * 0.65;

    return {
      x: point.x,
      y: point.y,
      vx: 0.48 + (burst * 0.94) + Math.max(0, distanceFromCenter) * 0.26,
      vy: -((0.38 + (Math.random() * 0.68)) + Math.max(0, -distanceFromCenter) * 0.1),
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 0.11,
      alpha: 1,
      size,
      color,
      accentColor,
      glowColor,
      points: createTopLyricShardPolygon(size),
    };
  });
}

// 先把字符画到离屏 Canvas，再从不透明像素取样，让碎片起点贴合字形。
function sampleTopLyricGlyphPoints(character, options) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(options.width));
  canvas.height = Math.max(1, Math.ceil(options.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    return fallbackTopLyricShardPoints(options);
  }

  // 先把当前字符绘制到离屏 Canvas，再从不透明像素里取样，碎片就会贴合字形而不是随机散开。
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = options.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(character, options.centerX, options.centerY);

  const pixels = [];
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (imageData[((y * canvas.width) + x) * 4 + 3] > 48) {
        pixels.push({ x, y });
      }
    }
  }

  if (!pixels.length) {
    return fallbackTopLyricShardPoints(options);
  }

  const picked = [];
  const fallbackPoints = fallbackTopLyricShardPoints(options);
  const minDistance = Math.max(2, Math.min(canvas.width, canvas.height) / 7);
  while (picked.length < options.count && pixels.length) {
    const candidateIndex = Math.floor(Math.random() * pixels.length);
    const candidate = pixels.splice(candidateIndex, 1)[0];
    const overlaps = picked.some((point) => {
      const dx = point.x - candidate.x;
      const dy = point.y - candidate.y;
      return Math.sqrt((dx * dx) + (dy * dy)) < minDistance;
    });

    if (!overlaps || picked.length < 8) {
      picked.push(candidate);
    }
  }

  while (picked.length < options.count) {
    picked.push(
      pixels[Math.floor(Math.random() * pixels.length)]
        || fallbackPoints[picked.length % fallbackPoints.length]
        || { x: options.centerX, y: options.centerY }
    );
  }

  return picked.slice(0, options.count);
}

function fallbackTopLyricShardPoints(options) {
  return Array.from({ length: options.count || TOP_LYRIC_SHARD_MIN_COUNT }, () => ({
    x: options.centerX + ((Math.random() - 0.5) * Math.max(4, options.width * 0.48)),
    y: options.centerY + ((Math.random() - 0.5) * Math.max(4, options.height * 0.48)),
  }));
}

function createTopLyricShardPolygon(size) {
  const sides = randomInteger(3, 5);
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((Math.PI * 2) / sides) * index + ((Math.random() - 0.5) * 0.45);
    const radius = size * (0.42 + Math.random() * 0.45);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

// Canvas 动画循环：集中调度所有碎裂 canvas，避免每个字符单独开一条 RAF 链。
function syncTopLyricShardAnimationLoop() {
  if (topLyricShardAnimationFrame || !topLyricShardEffects.length) {
    return;
  }

  topLyricShardAnimationFrame = requestAnimationFrame(updateTopLyricShardEffectsFrame);
}

function trimTopLyricShardEffects() {
  while (topLyricShardEffects.length >= TOP_LYRIC_SHARD_MAX_ACTIVE_EFFECTS) {
    cleanupTopLyricShardEffect(topLyricShardEffects[0]);
  }
}

function updateTopLyricShardEffectsFrame() {
  topLyricShardAnimationFrame = 0;

  if (!topLyricShardEffects.length) {
    return;
  }

  for (let index = topLyricShardEffects.length - 1; index >= 0; index -= 1) {
    animateTopLyricShardEffect(topLyricShardEffects[index]);
  }

  if (topLyricShardEffects.length) {
    syncTopLyricShardAnimationLoop();
  }
}

// 单个 canvas 的物理步进：位置、空气阻力、重力、自转和透明度全部逐帧更新。
function animateTopLyricShardEffect(effect) {
  if (!effect || !effect.canvas.isConnected) {
    cleanupTopLyricShardEffect(effect);
    return;
  }

  const { ctx, shards, width, height } = effect;
  ctx.clearRect(0, 0, width, height);
  renderTopLyricShardFlash(ctx, effect.flash);

  for (let index = shards.length - 1; index >= 0; index -= 1) {
    const shard = shards[index];
    shard.x += shard.vx;
    shard.y += shard.vy;
    shard.vx *= TOP_LYRIC_SHARD_DRAG;
    shard.vy *= TOP_LYRIC_SHARD_DRAG;
    shard.vy += TOP_LYRIC_SHARD_GRAVITY;
    shard.angle += shard.vAngle;
    shard.alpha -= TOP_LYRIC_SHARD_FADE;

    if (shard.alpha <= 0) {
      shards.splice(index, 1);
      continue;
    }

    renderTopLyricShard(ctx, shard);
  }

  if (effect.flash) {
    effect.flash.alpha = Math.max(0, effect.flash.alpha - 0.09);
    effect.flash.scale += 0.008;
  }

  if (!shards.length) {
    cleanupTopLyricShardEffect(effect);
  }
}

function renderTopLyricShardFlash(ctx, flash) {
  if (!flash || flash.alpha <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = Math.min(0.34, flash.alpha);
  ctx.translate(flash.centerX, flash.centerY);
  ctx.scale(flash.scale, flash.scale);
  ctx.font = flash.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 8;
  ctx.shadowColor = flash.glowColor || TOP_LYRIC_SHARD_GLOW_COLOR;
  ctx.fillStyle = flash.color || TOP_LYRIC_SHARD_ACCENT_COLOR;
  ctx.fillText(flash.character, 0, 0);
  ctx.restore();
}

function renderTopLyricShard(ctx, shard) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, shard.alpha);
  ctx.translate(shard.x, shard.y);
  ctx.rotate(shard.angle);
  ctx.shadowBlur = 4;
  ctx.shadowColor = shard.glowColor || TOP_LYRIC_SHARD_GLOW_COLOR;

  const gradient = ctx.createLinearGradient(-shard.size, -shard.size, shard.size, shard.size);
  gradient.addColorStop(0, shard.color);
  gradient.addColorStop(0.62, shard.accentColor || TOP_LYRIC_SHARD_ACCENT_COLOR);
  gradient.addColorStop(1, "rgba(255, 218, 168, 0.74)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  shard.points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 动画结束或顶栏退出歌词态时，移除 canvas 并清空粒子数组，避免内存泄漏。
function cleanupTopLyricShardEffect(effect) {
  if (!effect) {
    return;
  }

  effect.canvas.remove();
  effect.shards.length = 0;
  topLyricShardEffects = topLyricShardEffects.filter((item) => item !== effect);
}

function stopTopLyricShardLoop() {
  if (topLyricShardFrame) {
    cancelAnimationFrame(topLyricShardFrame);
    topLyricShardFrame = 0;
  }
}

function stopTopLyricShardAnimationLoop() {
  if (topLyricShardAnimationFrame) {
    cancelAnimationFrame(topLyricShardAnimationFrame);
    topLyricShardAnimationFrame = 0;
  }
}

function resetTopLyricShardState(options = {}) {
  stopTopLyricShardLoop();
  cancelTopLyricShardEffects();
  topLyricTriggeredWordIndex = -1;
  topLyricAlignPastOnNextLoop = Boolean(options.alignOnResume);

  topLyricCharacterSpans.forEach((span) => {
    span?.classList?.remove("is-sharded");
  });

  if (!options.keepText) {
    topLyricRenderedSignature = "";
    topLyricCharacterSpans = [];
    topLyricCharacterTimings = [];
    topLyricCharacterGroups = [];
  } else {
    topLyricCharacterGroups.forEach((group) => {
      group.triggeredIndex = -1;
      group.spans.forEach((span) => {
        span?.classList?.remove("is-sharded");
      });
    });
  }
}

function cancelTopLyricShardEffects() {
  stopTopLyricShardAnimationLoop();
  topLyricShardEffects.forEach((effect) => {
    effect.canvas.remove();
    effect.shards.length = 0;
  });
  topLyricShardEffects = [];
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

function setTopLyricShardOptions(options = {}) {
  topLyricShardOptions = {
    ...topLyricShardOptions,
    ...options,
  };
}

function handleTopbarMenuInteractionStart() {
  if (!document.body.classList.contains("topbar-lyric-active")) {
    return;
  }

  resetTopLyricShardState({ keepText: true, alignOnResume: true });
}

function handleTopbarMenuInteractionEnd() {
  requestAnimationFrame(updateTopbarLyricState);
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
  immersiveLyricTimedWordUsable = [];
  immersiveLyricWordGroups = [];

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
    immersiveLyricTimedWordUsable[index] = lineContent.hasUsableTimedWords;
    immersiveLyricWordGroups[index] = lineContent.groups;
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
    appendLine("可在设置中配置音源桥以联网匹配歌词。");
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
  const groups = [];
  groups.push(appendLyricWordSpans(original, line, originalText, {
    timeline: line?.wordTimeline,
    fallbackText: originalText,
    role: line?.originalText ? "original" : "single",
  }));

  if (translatedText) {
    const translated = document.createElement("strong");
    translated.className = "immersive-lyric-translated";
    groups.push(appendLyricWordSpans(translated, line, translatedText, {
      timeline: line?.translatedWordTimeline,
      fallbackText: translatedText,
      role: "translated",
    }));
    container.replaceChildren(original, translated);
  } else {
    container.replaceChildren(original);
  }

  const words = groups.flatMap((group) => group.words);
  const primaryGroup = groups[0] || {
    timings: [],
    endTimings: [],
    hasUsableTimedWords: false,
  };

  return {
    groups,
    words,
    timings: primaryGroup.timings,
    endTimings: primaryGroup.endTimings,
    hasUsableTimedWords: primaryGroup.hasUsableTimedWords,
  };
}

function getLyricWordParts(line, fallbackText) {
  const timeline = Array.isArray(line?.wordTimeline) ? line.wordTimeline : [];

  if (!timeline.length) {
    return segmentLyricWords(fallbackText);
  }

  return timeline.flatMap((entry) => {
    const value = String(entry?.value || "");
    if (/^\s+$/.test(value)) {
      return [{ type: "space", value }];
    }

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

function isNowPlayingLyricsVisible() {
  return getActiveView() === "nowPlaying"
    && nowPlayingPanel?.classList.contains("active")
    && document.visibilityState !== "hidden";
}

function areSmoothLyricSurfacesVisible() {
  return isImmersiveLyricsVisible()
    || isNowPlayingLyricsVisible();
}

function shouldRunLyricProgressLoop() {
  return state.isLyricSynced
    && state.lyricLines.length > 0
    && state.activeLyricIndex >= 0
    && areSmoothLyricSurfacesVisible()
    && state.currentTrack
    && audioPlayer.src
    && !audioPlayer.paused
    && !audioPlayer.ended
    && !state.isPlaybackBuffering;
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

  const currentSeconds = getLyricPlaybackTimeSeconds();
  if (!updateActiveLyricWordProgressFrame(currentSeconds)) {
    updateLyricsHighlight(currentSeconds);
  }
}

function updateActiveLyricWordProgressFrame(currentSeconds) {
  const activeIndex = state.activeLyricIndex;

  if (activeIndex < 0 || !isCurrentLyricLineActiveAtTime(activeIndex, currentSeconds)) {
    return false;
  }

  updateInlineLyricProgress(activeIndex, currentSeconds, {
    list: isNowPlayingLyricsVisible(),
    focus: isNowPlayingLyricsVisible(),
    monotonic: true,
  });
  if (isImmersiveLyricsVisible()) {
    return updateActiveImmersiveLyricWordProgressFrame(currentSeconds);
  }

  syncLyricProgressLoop();
  return true;
}

function updateActiveImmersiveLyricWordProgressFrame(currentSeconds) {
  const activeIndex = state.activeLyricIndex;

  if (activeIndex < 0 || !isCurrentLyricLineActiveAtTime(activeIndex, currentSeconds)) {
    return false;
  }

  const activeItem = immersiveLyricLineElements[activeIndex];
  if (!activeItem) {
    return false;
  }

  updateImmersiveLineWordProgress(activeItem, activeIndex, currentSeconds, { monotonic: true });
  syncLyricProgressLoop();
  return true;
}

function isCurrentLyricLineActiveAtTime(activeIndex, currentSeconds) {
  const timelineIndex = state.activeLyricTimelineIndex;
  const currentEntry = state.lyricTimeline[timelineIndex];

  if (!currentEntry || currentEntry.index !== activeIndex) {
    return false;
  }

  const targetSeconds = getAdjustedLyricSeconds(currentSeconds);
  const nextEntry = state.lyricTimeline[timelineIndex + 1];

  return currentEntry.time <= targetSeconds && (!nextEntry || nextEntry.time > targetSeconds);
}

function updateImmersiveLineWordProgress(activeItem, activeIndex, currentSeconds, options = {}) {
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

  const groups = getLyricProgressGroupsForLine(activeIndex);
  const currentLine = state.lyricLines[activeIndex];
  const nextEntry = getNextLyricTimelineEntry(activeIndex);
  const start = Number(currentLine?.time);
  const lyricSeconds = getAdjustedLyricSeconds(currentSeconds);

  if (!Number.isFinite(start)) {
    updateLyricProgressGroupsByLineRatio(groups, words.length, {
      useCachedWindow: groups.length <= 1,
      monotonic: options.monotonic,
    });
    return;
  }

  if (groups.length > 1) {
    const progressState = updateLyricProgressGroups(activeIndex, groups, {
      line: currentLine,
      start,
      lyricSeconds,
      nextEntry,
      monotonic: options.monotonic,
    });
    scheduleLyricProgressResumeFromGroupState(progressState, lyricSeconds, nextEntry);
    return;
  }

  if (hasTimedLyricWords(activeIndex, words)) {
    updateTimedLyricWordProgress(activeIndex, words, lyricSeconds, nextEntry, null, {
      monotonic: options.monotonic,
    });
    return;
  }

  const end = getLyricWordProgressEndSeconds(start, nextEntry, words.length, {
    line: currentLine,
    text: currentLine?.originalText || currentLine?.text,
  });
  const lineRatio = end > start
    ? clamp((lyricSeconds - start) / (end - start), 0, 1)
    : 1;
  if (groups[0]) {
    updateWeightedLyricWordProgressWindowForGroup(groups[0], lineRatio, { monotonic: options.monotonic });
  } else {
    updateLyricWordProgressWindow(words, lineRatio * words.length, { monotonic: options.monotonic });
  }
  scheduleLyricProgressResumeIfIdle(lineRatio, lyricSeconds, nextEntry);
}

function getLyricProgressGroupsForLine(activeIndex) {
  const groups = immersiveLyricWordGroups[activeIndex];
  if (Array.isArray(groups) && groups.length) {
    return groups;
  }

  return [{
    role: "line",
    words: immersiveLyricWordElements[activeIndex] || [],
    timings: immersiveLyricWordTimings[activeIndex] || [],
    endTimings: immersiveLyricWordEndTimings[activeIndex] || [],
    hasUsableTimedWords: Boolean(immersiveLyricTimedWordUsable[activeIndex]),
  }];
}

function updateLyricProgressGroups(activeIndex, groups, options) {
  return groups.reduce((stateSummary, group) => {
    const words = group?.words || [];
    if (!words.length) {
      return stateSummary;
    }

    if (hasTimedLyricWords(activeIndex, words, group)) {
      const timedState = updateTimedLyricWordProgress(activeIndex, words, options.lyricSeconds, options.nextEntry, group, {
        monotonic: options.monotonic,
      });
      return mergeLyricProgressGroupState(stateSummary, timedState);
    }

    const end = getLyricWordProgressEndSeconds(options.start, options.nextEntry, words.length, {
      line: group.line || options.line,
      text: group.text,
    });
    const lineRatio = end > options.start
      ? clamp((options.lyricSeconds - options.start) / (end - options.start), 0, 1)
      : 1;
    updateWeightedLyricWordProgressWindowForGroup(group, lineRatio, {
      monotonic: options.monotonic,
    });
    return mergeLyricProgressGroupState(stateSummary, {
      ratio: lineRatio,
      complete: lineRatio >= 1,
    });
  }, { ratio: 1, complete: true });
}

function mergeLyricProgressGroupState(current, next) {
  return {
    ratio: Math.min(current.ratio, Number.isFinite(next?.ratio) ? next.ratio : 1),
    complete: current.complete && Boolean(next?.complete),
  };
}

function updateLyricProgressGroupsByLineRatio(groups, litWords, options = {}) {
  groups.forEach((group) => {
    const words = group?.words || [];
    if (!words.length) {
      return;
    }

    if (options.useCachedWindow && groups.length <= 1) {
      updateLyricWordProgressWindow(words, litWords, { monotonic: options.monotonic });
    } else {
      updateLyricWordProgressWindowForGroup(group, words.length, { monotonic: options.monotonic });
    }
  });
}

function scheduleLyricProgressResumeFromGroupState(progressState, lyricSeconds, nextEntry) {
  if (progressState?.complete) {
    scheduleLyricProgressResumeIfIdle(1, lyricSeconds, nextEntry);
  }
}

function hasTimedLyricWords(activeIndex, words, group = null) {
  if (group) {
    return Boolean(group.hasUsableTimedWords) && (group.timings || []).length === words.length;
  }

  return Boolean(immersiveLyricTimedWordUsable[activeIndex])
    && (immersiveLyricWordTimings[activeIndex] || []).length === words.length;
}

function updateTimedLyricWordProgress(activeIndex, words, lyricSeconds, nextEntry, group = null, options = {}) {
  const timings = group?.timings || getTimedLyricWordTimings(activeIndex, words);
  const endTimings = group?.endTimings || getTimedLyricWordEndTimings(activeIndex, words);
  const activeWordIndex = findTimedLyricWordIndex(timings, lyricSeconds);

  if (activeWordIndex < 0) {
    updateLyricWordProgressByGroup(words, 0, group, { monotonic: options.monotonic });
    return { ratio: 0, complete: false };
  }

  const start = timings[activeWordIndex];
  const nextWordStart = timings[activeWordIndex + 1];
  const explicitEnd = endTimings[activeWordIndex];
  const end = getTimedLyricWordEndSeconds({
    word: words[activeWordIndex],
    words,
    timings,
    start,
    explicitEnd,
    nextWordStart,
    nextEntry,
    isTailWord: activeWordIndex >= words.length - 1,
    line: group?.line || state.lyricLines[activeIndex],
    activeWordIndex,
  });
  const activeWordProgress = getTimedLyricWordProgress(lyricSeconds, start, end);
  const litWords = activeWordIndex + (activeWordProgress / 100);

  updateLyricWordProgressByGroup(words, litWords, group, { monotonic: options.monotonic });
  const isComplete = activeWordIndex >= words.length - 1 && activeWordProgress >= 100;
  if (!group) {
    scheduleTimedLyricProgressResumeIfIdle(isComplete, lyricSeconds, nextEntry);
  }
  return {
    ratio: words.length ? clamp(litWords / words.length, 0, 1) : 1,
    complete: isComplete,
  };
}

function updateLyricWordProgressByGroup(words, litWords, group = null, options = {}) {
  if (group) {
    updateLyricWordProgressWindowForGroup(group, litWords, { monotonic: options.monotonic });
    return;
  }

  updateLyricWordProgressWindow(words, litWords, { monotonic: options.monotonic });
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
    if (!Number.isFinite(time) || time + 0.001 < previous) {
      return false;
    }

    previous = time;
  }

  return true;
}

function normalizeTimedLyricWordTimings(timings) {
  let previous = -Infinity;
  let changed = false;
  const normalized = (timings || []).map((time) => {
    const numericTime = Number(time);

    if (!Number.isFinite(numericTime)) {
      return NaN;
    }

    if (!Number.isFinite(previous)) {
      previous = numericTime;
      return numericTime;
    }

    const minAllowedTime = previous + LYRIC_TIMED_WORD_MIN_STEP_SECONDS;
    if (numericTime < minAllowedTime) {
      changed = true;
      previous = minAllowedTime;
      return minAllowedTime;
    }

    previous = numericTime;
    return numericTime;
  });

  return changed ? normalized : timings;
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

function getTimedLyricWordEndSeconds({
  word,
  words = [],
  timings = [],
  start,
  explicitEnd,
  nextWordStart,
  nextEntry,
  isTailWord = false,
  line = null,
  activeWordIndex = -1,
}) {
  if (!Number.isFinite(start)) {
    return start;
  }

  if (Number.isFinite(explicitEnd) && explicitEnd > start) {
    return explicitEnd;
  }

  if (Number.isFinite(nextWordStart) && nextWordStart > start) {
    return nextWordStart;
  }

  if (isTailWord) {
    return getTimedLyricTailWordEndSeconds({
      word,
      words,
      timings,
      start,
      nextEntry,
      line,
      activeWordIndex,
    });
  }

  const preferredEnd = start + getTimedLyricWordPreferredDurationSeconds(word);

  if (Number.isFinite(nextEntry?.time) && nextEntry.time > start) {
    return Math.min(nextEntry.time, preferredEnd);
  }

  return preferredEnd;
}

function getTimedLyricWordPreferredDurationSeconds(word) {
  return getEstimatedLyricWordDurationSeconds(word);
}

function getTimedLyricTailWordEndSeconds({
  word,
  words = [],
  timings = [],
  start,
  nextEntry,
  line = null,
  activeWordIndex = -1,
}) {
  const lineStart = Number(line?.time);
  const lineEnd = getLyricLineProgressEndSeconds({
    line,
    start: Number.isFinite(lineStart) ? lineStart : start,
    nextEntry,
    wordCount: words.length,
    text: getLyricWordsText(words) || word?.textContent,
  });
  const previousStart = activeWordIndex > 0 ? Number(timings[activeWordIndex - 1]) : NaN;
  const recentStep = Number.isFinite(previousStart) && previousStart < start ? start - previousStart : NaN;
  const preferredDuration = Math.max(
    getEstimatedLyricWordDurationSeconds(word),
    Number.isFinite(recentStep) ? recentStep * 1.1 : 0
  );
  const preferredEnd = start + preferredDuration;

  if (Number.isFinite(lineEnd) && lineEnd > start) {
    return lineEnd;
  }

  return preferredEnd;
}

function getLyricWordsText(words) {
  return (words || []).map((word) => word?.textContent || "").join("");
}

function getEstimatedLyricWordDurationSeconds(word) {
  const value = word?.textContent ?? word?.value ?? "";
  const textLength = Array.from(String(value || "")).filter((char) => char.trim()).length || 1;
  return clamp(
    Math.max(LYRIC_TIMED_WORD_MIN_DURATION_SECONDS, textLength * LYRIC_WORD_CHARACTER_ESTIMATED_DURATION_SECONDS),
    LYRIC_TIMED_WORD_MIN_DURATION_SECONDS,
    LYRIC_TIMED_WORD_MAX_DURATION_SECONDS
  );
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

  return normalizeLyricWordProgressPercent(clamp((lyricSeconds - start) / (end - start), 0, 1) * 100);
}

function scheduleTimedLyricProgressResumeIfIdle(isComplete, lyricSeconds, nextEntry) {
  if (!isComplete) {
    return;
  }

  scheduleLyricProgressResumeIfIdle(1, lyricSeconds, nextEntry);
}

function getLyricWordProgressEndSeconds(start, nextEntry, wordCount, options = {}) {
  return getLyricLineProgressEndSeconds({
    line: options.line,
    start,
    nextEntry,
    wordCount,
    text: options.text,
  });
}

function getLyricLineProgressEndSeconds({ line = null, start, nextEntry = null, wordCount = 0, text = "" } = {}) {
  if (!Number.isFinite(start)) {
    return start;
  }

  const explicitEnd = Number(line?.endTime);
  if (Number.isFinite(explicitEnd) && explicitEnd > start) {
    return explicitEnd;
  }

  const nextLineStart = Number(nextEntry?.time);
  if (Number.isFinite(nextLineStart) && nextLineStart > start) {
    return nextLineStart;
  }

  return start + getEstimatedLyricLineDurationSeconds(wordCount, text || line?.originalText || line?.text);
}

function getEstimatedLyricLineDurationSeconds(wordCount, text = "") {
  const cleanText = String(text || "").replace(/\s+/g, "");
  const characterCount = Array.from(cleanText).filter((char) => char.trim()).length;
  const count = Math.max(1, Number(wordCount) || characterCount || 1);
  return clamp(
    Math.max(
      LYRIC_WORD_MIN_LINE_DURATION_SECONDS,
      count * LYRIC_WORD_ESTIMATED_DURATION_SECONDS,
      characterCount * LYRIC_WORD_CHARACTER_ESTIMATED_DURATION_SECONDS
    ),
    LYRIC_WORD_MIN_LINE_DURATION_SECONDS,
    LYRIC_WORD_MAX_LINE_DURATION_SECONDS
  );
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

function updateWeightedLyricWordProgressWindowForGroup(group, lineRatio, options = {}) {
  const words = group?.words || [];
  if (!words.length) {
    resetLyricProgressGroupWindow(group);
    return;
  }

  if (!Array.isArray(group.wordWeightBoundaries) || group.wordWeightBoundaries.length !== words.length + 1) {
    syncLyricWordProgressWeights(group);
  }

  const totalWeight = Number(group.totalWordWeight);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    updateLyricWordProgressWindowForGroup(group, clamp(lineRatio, 0, 1) * words.length, options);
    return;
  }

  const targetWeight = clamp(lineRatio, 0, 1) * totalWeight;
  updateLyricWordProgressWeightedWindowCached(words, targetWeight, group, options);
}

function updateLyricWordProgressWeightedWindowCached(words, targetWeight, cache, options = {}) {
  const boundaries = cache?.wordWeightBoundaries || [];
  const weights = cache?.wordWeights || [];
  const safeTargetWeight = clamp(Number(targetWeight) || 0, 0, cache?.totalWordWeight || 0);
  const nextFullWordCount = findLyricWeightedFullWordCount(boundaries, words.length, safeTargetWeight);
  const nextPartialWordIndex = nextFullWordCount < words.length ? nextFullWordCount : -1;
  const nextPartialProgress = nextPartialWordIndex >= 0
    ? normalizeLyricWordProgressPercent(
      clamp(
        (safeTargetWeight - (boundaries[nextPartialWordIndex] || 0))
          / Math.max(weights[nextPartialWordIndex] || 0, LYRIC_TIMED_WORD_MIN_DURATION_SECONDS),
        0,
        1
      ) * 100
    )
    : 0;
  const previousFullWordCount = Number.isFinite(cache?.progressFullWordCount)
    ? cache.progressFullWordCount
    : -1;
  const previousPartialWordIndex = Number.isFinite(cache?.progressPartialWordIndex)
    ? cache.progressPartialWordIndex
    : -1;

  if (previousFullWordCount < 0) {
    words.forEach((word, index) => {
      const progress = index < nextFullWordCount
        ? 100
        : (index === nextPartialWordIndex ? nextPartialProgress : 0);
      setLyricWordProgress(word, progress, options);
    });
    cache.progressFullWordCount = nextFullWordCount;
    cache.progressPartialWordIndex = nextPartialWordIndex;
    return;
  }

  if (nextFullWordCount > previousFullWordCount) {
    for (let index = previousFullWordCount; index < nextFullWordCount; index += 1) {
      setLyricWordProgress(words[index], 100, options);
    }
  } else if (nextFullWordCount < previousFullWordCount) {
    for (let index = nextFullWordCount; index < previousFullWordCount; index += 1) {
      if (index !== nextPartialWordIndex) {
        setLyricWordProgress(words[index], 0, options);
      }
    }
  }

  if (previousPartialWordIndex >= 0 && previousPartialWordIndex !== nextPartialWordIndex) {
    const previousProgress = previousPartialWordIndex < nextFullWordCount ? 100 : 0;
    setLyricWordProgress(words[previousPartialWordIndex], previousProgress, options);
  }

  if (nextPartialWordIndex >= 0) {
    setLyricWordProgress(words[nextPartialWordIndex], nextPartialProgress, options);
  }

  cache.progressFullWordCount = nextFullWordCount;
  cache.progressPartialWordIndex = nextPartialWordIndex;
}

function findLyricWeightedFullWordCount(boundaries, wordCount, targetWeight) {
  if (!Array.isArray(boundaries) || !wordCount || targetWeight <= 0) {
    return 0;
  }

  let low = 1;
  let high = wordCount;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const boundary = Number(boundaries[middle]);

    if (Number.isFinite(boundary) && boundary <= targetWeight + 0.000001) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

function updateLyricWordProgressWindow(words, litWords, options = {}) {
  const cache = {
    progressFullWordCount: lyricProgressFullWordCount,
    progressPartialWordIndex: lyricProgressPartialWordIndex,
  };
  updateLyricWordProgressWindowCached(words, litWords, cache, options);
  lyricProgressFullWordCount = cache.progressFullWordCount;
  lyricProgressPartialWordIndex = cache.progressPartialWordIndex;
}

function updateLyricWordProgressWindowForGroup(group, litWords, options = {}) {
  const words = group?.words || [];
  if (!words.length) {
    resetLyricProgressGroupWindow(group);
    return;
  }

  updateLyricWordProgressWindowCached(words, litWords, group, options);
}

function resetLyricProgressGroupWindow(group) {
  if (!group) {
    return;
  }

  group.progressFullWordCount = -1;
  group.progressPartialWordIndex = -1;
}

function updateLyricWordProgressWindowCached(words, litWords, cache, options = {}) {
  const nextFullWordCount = Math.min(words.length, Math.max(0, Math.floor(litWords)));
  const nextPartialWordIndex = nextFullWordCount < words.length ? nextFullWordCount : -1;
  const nextPartialProgress = nextPartialWordIndex >= 0
    ? normalizeLyricWordProgressPercent(clamp(litWords - nextPartialWordIndex, 0, 1) * 100)
    : 0;
  const previousFullWordCount = Number.isFinite(cache?.progressFullWordCount)
    ? cache.progressFullWordCount
    : -1;
  const previousPartialWordIndex = Number.isFinite(cache?.progressPartialWordIndex)
    ? cache.progressPartialWordIndex
    : -1;

  if (previousFullWordCount < 0) {
    words.forEach((word, index) => {
      const progress = index < nextFullWordCount
        ? 100
        : (index === nextPartialWordIndex ? nextPartialProgress : 0);
      setLyricWordProgress(word, progress, options);
    });
    cache.progressFullWordCount = nextFullWordCount;
    cache.progressPartialWordIndex = nextPartialWordIndex;
    return;
  }

  if (nextFullWordCount > previousFullWordCount) {
    for (let index = previousFullWordCount; index < nextFullWordCount; index += 1) {
      setLyricWordProgress(words[index], 100, options);
    }
  } else if (nextFullWordCount < previousFullWordCount) {
    for (let index = nextFullWordCount; index < previousFullWordCount; index += 1) {
      if (index !== nextPartialWordIndex) {
        setLyricWordProgress(words[index], 0, options);
      }
    }
  }

  if (previousPartialWordIndex >= 0 && previousPartialWordIndex !== nextPartialWordIndex) {
    const previousProgress = previousPartialWordIndex < nextFullWordCount ? 100 : 0;
    setLyricWordProgress(words[previousPartialWordIndex], previousProgress, options);
  }

  if (nextPartialWordIndex >= 0) {
    setLyricWordProgress(words[nextPartialWordIndex], nextPartialProgress, options);
  }

  cache.progressFullWordCount = nextFullWordCount;
  cache.progressPartialWordIndex = nextPartialWordIndex;
}

function updateLyricWordProgressWindowUncached(words, litWords) {
  const nextFullWordCount = Math.min(words.length, Math.max(0, Math.floor(litWords)));
  const nextPartialWordIndex = nextFullWordCount < words.length ? nextFullWordCount : -1;
  const nextPartialProgress = nextPartialWordIndex >= 0
    ? normalizeLyricWordProgressPercent(clamp(litWords - nextPartialWordIndex, 0, 1) * 100)
    : 0;

  words.forEach((word, index) => {
    const progress = index < nextFullWordCount
      ? 100
      : (index === nextPartialWordIndex ? nextPartialProgress : 0);
    setLyricWordProgress(word, progress);
  });
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
  if (Array.isArray(immersiveLyricWordGroups[previousActiveIndex])) {
    resetLyricWordGroups(immersiveLyricWordGroups[previousActiveIndex]);
  } else {
    (immersiveLyricWordElements[previousActiveIndex] || []).forEach((word) => {
      setLyricWordProgress(word, 0);
    });
  }
}

function setLyricWordProgress(word, percent, options = {}) {
  if (!word) {
    return;
  }

  const lastPercent = Number.isFinite(word._lyricProgress) ? word._lyricProgress : -1;
  let normalizedPercent = normalizeLyricWordProgressPercent(percent);

  if (options.monotonic && lastPercent >= 0 && normalizedPercent < lastPercent) {
    normalizedPercent = lastPercent;
  }

  if (Math.abs(lastPercent - normalizedPercent) < LYRIC_PROGRESS_EPSILON) {
    return;
  }

  word._lyricProgress = normalizedPercent;
  const cssValue = getLyricWordProgressCssValue(normalizedPercent);
  word._lyricProgressCss = cssValue;
  word.style.setProperty("--word-progress", cssValue);
}

function normalizeLyricWordProgressPercent(percent) {
  return Math.round(clamp(Number(percent) || 0, 0, 100) * 10) / 10;
}

function formatLyricWordProgressPercent(percent) {
  const normalizedPercent = normalizeLyricWordProgressPercent(percent);
  if (normalizedPercent === 0 || normalizedPercent === 100) {
    return `${normalizedPercent}%`;
  }

  return `${normalizedPercent.toFixed(1)}%`;
}

function getLyricWordProgressCssValue(normalizedPercent) {
  const cacheKey = Math.round(normalizedPercent * 10);
  const cached = lyricWordProgressCssCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const cssValue = formatLyricWordProgressPercent(normalizedPercent);
  lyricWordProgressCssCache.set(cacheKey, cssValue);
  return cssValue;
}

function renderUpNext() {
  renderUpNextList(upNextList, 6);
  renderImmersiveQueue();
}

function renderUpNextList(container, limit) {
  container.replaceChildren();

  if (!state.queue.length || state.currentTrackIndex < 0) {
    appendEmpty(container, { text: "暂无后续播放。" });
    return;
  }

  const nextItems = getUpcomingTracks(limit);

  if (!nextItems.length) {
    appendEmpty(container, { text: "当前已经是队列最后一首。" });
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
    appendEmpty(immersiveUpNextList, { text: "播放队列为空。" });
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
      scrollElementIntoContainerView(immersiveUpNextList, activeItem, { block: "nearest", behavior: "smooth" });
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

  scrollElementIntoContainerView(immersiveUpNextList, activeItem, { block: "center", behavior: "smooth" });
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
  const query = searchOps.normalizeQuery(rawQuery);

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
  const apiUrl = getExternalTrackApiUrl(track);
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
  const apiUrl = getExternalTrackApiUrl(track);

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
  const rawQuery = searchOps.normalizeQuery(searchInput.value);
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
  scrollElementIntoContainerView(searchSuggestList, item.closest(".search-suggest-item") || item, { block: "nearest", behavior: "auto" });
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
  const nextHistory = searchOps.addHistory(loadSearchHistory(), query, {
    minLength: SERVER_SEARCH_MIN_LENGTH,
    limit: MAX_SEARCH_HISTORY_ITEMS,
  });
  saveSearchHistory(nextHistory);
}

function removeSearchHistoryQuery(query) {
  saveSearchHistory(searchOps.removeHistory(loadSearchHistory(), query, MAX_SEARCH_HISTORY_ITEMS));
  renderSearchSuggestions();
}

function loadSearchHistory() {
  try {
    const raw = localStorage.getItem(getSearchHistoryStorageKey());
    const history = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(history)) {
      return [];
    }

    return searchOps.normalizeHistory(history, MAX_SEARCH_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function saveSearchHistory(history) {
  const normalizedHistory = searchOps.normalizeHistory(history, MAX_SEARCH_HISTORY_ITEMS);
  const key = getSearchHistoryStorageKey();

  if (normalizedHistory.length) {
    localStorage.setItem(key, JSON.stringify(normalizedHistory));
  } else {
    localStorage.removeItem(key);
  }
}

function getSearchHistoryStorageKey() {
  return searchOps.getScopedHistoryKey(SEARCH_HISTORY_KEY, storage.getAccountProfileKey(state.session));
}

function scheduleServerSearch(rawQuery) {
  clearTimeout(state.serverSearchTimer);
  abortActiveServerSearch();

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

function abortActiveServerSearch() {
  if (!state.serverSearchController) {
    return;
  }

  state.serverSearchController.abort();
  state.serverSearchController = null;
}

function createAbortController() {
  return typeof AbortController === "function" ? new AbortController() : null;
}

function isAbortError(error) {
  return error?.name === "AbortError"
    || /请求已取消|aborted|abort/i.test(String(error?.message || ""));
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
  abortActiveServerSearch();
  const controller = createAbortController();
  state.serverSearchController = controller;
  state.isServerSearching = true;
  renderSearchResults();
  setLibraryStatus(`正在从 Emby 搜索“${rawQuery}”...`);

  try {
    const response = await fetchPagedItems("Audio,MusicAlbum,MusicArtist,Playlist", 0, SERVER_SEARCH_LIMIT, {
      SearchTerm: rawQuery,
      SortBy: "SortName",
      SortOrder: "Ascending",
    }, {
      signal: controller?.signal,
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

    if (isAbortError(error)) {
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
      if (state.serverSearchController === controller) {
        state.serverSearchController = null;
      }
      state.isServerSearching = false;
    }
  }
}

async function runExternalSourceSearch(rawQuery) {
  const requestId = ++state.serverSearchRequestId;
  abortActiveServerSearch();
  const controller = createAbortController();
  state.serverSearchController = controller;
  const apiUrl = getSessionExternalSourceApiUrl(state.session);

  if (!apiUrl) {
    if (state.serverSearchController === controller) {
      state.serverSearchController = null;
    }
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
      signal: controller?.signal,
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

    if (isAbortError(error)) {
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
      if (state.serverSearchController === controller) {
        state.serverSearchController = null;
      }
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
  setMobileImmersiveStageView("cover");
  switchView("immersivePlayer");
}

function getRandomPlayableTrackPool() {
  const source = state.filteredTracks.length ? state.filteredTracks : state.tracks;
  return mergeUniqueItems([], normalizeItems(source).filter(isAudioItem));
}

function startRandomImmersivePlayback() {
  const pool = getRandomPlayableTrackPool();

  if (!pool.length) {
    setLibraryStatus("没有可随机播放的歌曲，请先加载音乐库。");
    switchView("library");
    return false;
  }

  shuffleTracks(pool);
  playTrack(pool[0], pool);
  return true;
}

function openRadarImmersivePlayer() {
  state.immersiveReturnView = getActiveView() === "immersivePlayer" ? "home" : getActiveView();
  setMobileImmersiveStageView("cover");

  if (!state.currentTrack && !startRandomImmersivePlayback()) {
    return;
  }

  switchView("immersivePlayer");
}

function closeImmersivePlayer(options = {}) {
  if (options.animate !== false && getActiveView() === "immersivePlayer") {
    const shell = immersivePlayerPanel?.querySelector(".immersive-player-shell");
    if (immersiveCloseAnimationTimer) {
      clearTimeout(immersiveCloseAnimationTimer);
    }
    shell?.classList.add("is-page-exiting");
    immersivePlayerPanel?.classList.add("is-page-exiting");
    immersiveCloseAnimationTimer = window.setTimeout(() => {
      immersiveCloseAnimationTimer = 0;
      finishCloseImmersivePlayer();
    }, 260);
    return;
  }

  finishCloseImmersivePlayer();
}

function finishCloseImmersivePlayer() {
  immersivePlayerPanel?.classList.remove("is-page-exiting");
  immersivePlayerPanel?.querySelector(".immersive-player-shell")?.classList.remove("is-page-exiting");
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
  immersiveMobileZenButton?.setAttribute("aria-pressed", isEnabled ? "true" : "false");
  setIconButtonLabel(immersiveZenButton, isEnabled ? "关闭纯享无干扰模式" : "开启纯享无干扰模式");
  setIconButtonLabel(immersiveMobileZenButton, isEnabled ? "关闭纯享无干扰模式" : "开启纯享无干扰模式");
  if (isEnabled) {
    closeImmersiveQueue({ restoreFocus: false });
  }
}

function cycleImmersiveBackgroundMode() {
  const modes = ["original", "fluid", "stage"];
  const currentIndex = modes.indexOf(state.immersiveBackgroundMode);
  state.immersivePlayerStyle = normalizeImmersivePlayerStyle({
    ...state.immersivePlayerStyle,
    theme: modes[(currentIndex + 1) % modes.length],
  });
  applyImmersivePlayerStyle({ save: true });
}

function applyImmersiveBackgroundMode(options = {}) {
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
  immersiveBackgroundButton?.setAttribute("aria-pressed", mode === "original" ? "false" : "true");
  setIconButtonLabel(immersiveBackgroundButton, `皮肤样式：${labelMap[mode]}`);
  if (options.syncStyle !== false) {
    state.immersivePlayerStyle = normalizeImmersivePlayerStyle({
      ...state.immersivePlayerStyle,
      theme: mode,
    });
    renderPlayerStyleControls();
  }
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
  setIconButtonLabel(immersiveQueueButton, "关闭播放队列");
}

function closeImmersiveQueue(options = {}) {
  if (!state.isImmersiveQueueOpen && immersiveQueueDrawer.hidden) {
    return;
  }

  state.isImmersiveQueueOpen = false;
  immersiveQueueDrawer.hidden = true;
  immersiveQueueButton.setAttribute("aria-expanded", "false");
  setIconButtonLabel(immersiveQueueButton, "打开播放队列");

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
  animateImmersiveFullscreenButtons();
  if (!document.fullscreenElement) {
    immersivePlayerPanel.requestFullscreen?.().catch(() => {
      setLibraryStatus("当前浏览器不允许进入全屏。");
    });
    return;
  }

  document.exitFullscreen?.();
}

function updateImmersiveFullscreenLabel() {
  const isFullscreen = Boolean(document.fullscreenElement);
  const label = isFullscreen ? "退出全屏" : "进入全屏";
  [immersiveFullscreenButton, immersiveMobileFullscreenButton].forEach((button) => {
    if (!button) {
      return;
    }
    button.dataset.fullscreen = isFullscreen ? "true" : "false";
    setIconButtonLabel(button, label);
  });

  if (immersiveFullscreenState !== isFullscreen) {
    animateImmersiveFullscreenButtons();
  }
  immersiveFullscreenState = isFullscreen;
}

function animateImmersiveFullscreenButtons() {
  [immersiveFullscreenButton, immersiveMobileFullscreenButton].forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.remove("is-fullscreen-pulse");
    void button.offsetWidth;
    button.classList.add("is-fullscreen-pulse");
    window.setTimeout(() => {
      button.classList.remove("is-fullscreen-pulse");
    }, 460);
  });
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
    || immersiveQualityButton?.contains(event.target)
    || immersiveMobileQualityButton?.contains(event.target)
  ) {
    return;
  }

  closeAudioQualityModal();
}

function openDownloadOptionsModal() {
  if (!state.currentTrack?.Id) {
    setLibraryStatus("当前没有可下载的音乐。");
    return;
  }

  if (downloadOptionsCloseTimer) {
    clearTimeout(downloadOptionsCloseTimer);
    downloadOptionsCloseTimer = 0;
  }

  renderDownloadOptions();
  downloadOptionsModal?.classList.remove("is-closing");
  if (downloadOptionsModal) {
    downloadOptionsModal.hidden = false;
    requestAnimationFrame(() => {
      downloadOptionsModal.classList.add("is-open");
      downloadOptionsClose?.focus();
    });
  }
}

function closeDownloadOptionsModal() {
  if (!downloadOptionsModal || downloadOptionsModal.hidden || downloadOptionsCloseTimer) {
    return;
  }

  downloadOptionsModal.classList.remove("is-open");
  downloadOptionsModal.classList.add("is-closing");
  downloadOptionsCloseTimer = window.setTimeout(() => {
    downloadOptionsModal.hidden = true;
    downloadOptionsModal.classList.remove("is-closing");
    downloadOptionsCloseTimer = 0;
  }, 260);
}

function handleDownloadOptionsDocumentClick(event) {
  if (!downloadOptionsModal || downloadOptionsModal.hidden || !(event.target instanceof Element)) {
    return;
  }

  if (
    downloadOptionsModal.querySelector(".download-options-card")?.contains(event.target)
    || immersiveDownloadButton?.contains(event.target)
    || immersiveMobileDownloadButton?.contains(event.target)
  ) {
    return;
  }

  closeDownloadOptionsModal();
}

function renderDownloadOptions() {
  if (!downloadOptionsList || !downloadOptionsSubtitle) {
    return;
  }

  const track = state.currentTrack;
  downloadOptionsSubtitle.textContent = track?.Name
    ? `选择 ${track.Name} 的下载音质。`
    : "选择下载音质后开始下载。";
  downloadOptionsList.replaceChildren();

  getDownloadQualityOptions(track).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `download-option ${option.tone || ""}`.trim();
    button.addEventListener("click", () => {
      closeDownloadOptionsModal();
      downloadCurrentTrack(option);
    });

    const icon = document.createElement("span");
    icon.className = "download-option-icon";
    icon.append(createActionIcon(option.icon || "download"));

    const content = document.createElement("span");
    content.className = "download-option-content";

    const title = document.createElement("strong");
    title.textContent = option.label;
    const detail = document.createElement("span");
    detail.textContent = option.detail;
    const note = document.createElement("small");
    note.textContent = option.note;

    content.append(title, detail, note);
    button.append(icon, content);
    downloadOptionsList.append(button);
  });
}

function getDownloadQualityOptions(track) {
  if (isExternalSourceTrack(track)) {
    const current = getExternalPlaybackQualityOption(track);
    const audioOptions = EXTERNAL_SOURCE_QUALITY_OPTIONS
      .filter((option) => option.id !== "video" || isVideoTrack(track))
      .map((option) => ({
        id: option.id,
        request: option.request,
        videoQuality: isVideoTrack(track) ? getExternalSourceVideoQuality() : "",
        label: option.id === current.id ? `${option.label}（当前）` : option.label,
        detail: option.quality,
        note: option.scene,
        icon: option.icon,
        tone: getAudioQualityToneClass(option.id),
      }));

    return audioOptions.length ? audioOptions : [{
      id: "current",
      label: "当前源站音质",
      detail: getTrackQualitySummary(track)?.detailLabel || "源站返回格式",
      note: "使用当前音乐桥返回的可下载地址。",
      icon: "download",
      tone: "tone-high",
    }];
  }

  const currentProfile = getAudioQualityProfile();
  return AUDIO_QUALITY_PROFILES.map((profile) => ({
    id: profile.id,
    profile,
    label: profile.id === currentProfile.id ? `${profile.label}（当前）` : profile.label,
    detail: [profile.codec, profile.bitrateLabel || "原码率", getEffectiveTranscodeMethodLabel(profile)].filter(Boolean).join(" · "),
    note: getAudioQualitySceneText(profile),
    icon: getAudioQualityMethodIcon(getAudioQualityMethodGroupId(profile)),
    tone: getAudioQualityToneClass(getAudioQualityMethodGroupId(profile)),
  }));
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
  } else if (activePanel === "playlistDetail") {
    loadMoreSelectedPlaylistTracks();
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
  abortActiveServerSearch();
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

function fetchPagedItems(includeItemTypes, startIndex, limit, extraParams = {}, requestOptions = {}) {
  return embyFetch(state.session, userItemsPath(state.session, {
    Recursive: true,
    IncludeItemTypes: includeItemTypes,
    StartIndex: startIndex,
    Limit: limit,
    Fields: itemFields,
    EnableUserData: true,
    ...getLibraryScopeParams(),
    ...extraParams,
  }), requestOptions);
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
    profile: "我的",
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
    appendLoading(albumTrackList, "正在加载专辑歌曲...");
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
    appendLoading(artistAlbumGrid, "正在加载艺人专辑...");
    appendLoading(artistTrackList, "正在加载艺人歌曲...");
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
  state.totalPlaylistTracks = getPlaylistKnownTrackCount(playlist);
  state.hasMorePlaylistTracks = false;
  state.isLoadingMorePlaylistTracks = false;
  renderPlaylistDetail(playlist, [], true);
  switchView("playlistDetail", { resetScroll: true });
  setLibraryStatus("正在加载歌单歌曲...");

  try {
    await loadPlaylistTrackPage(playlist, { reset: true });
  } catch (error) {
    state.playlistTracks = [];
    state.totalPlaylistTracks = 0;
    state.hasMorePlaylistTracks = false;
    setLibraryStatus(`歌单歌曲加载失败：${readableError(error)}`);
    renderPlaylistDetail(playlist, [], false);
  }

  if (state.playlistTracks.length) {
    setLibraryStatus("");
  }
}

async function fetchPlaylistTracks(playlist) {
  return fetchAllPlaylistTracks(playlist);
}

async function getPlayablePlaylistTracks(playlist) {
  if (!playlist?.Id) {
    return [];
  }

  if (
    state.selectedPlaylist?.Id === playlist.Id
    && state.playlistTracks.length
    && state.totalPlaylistTracks
    && state.playlistTracks.length >= state.totalPlaylistTracks
  ) {
    return state.playlistTracks;
  }

  const tracks = await fetchPlaylistTracks(playlist);
  state.tracks = mergeUniqueItems(state.tracks, tracks);
  state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, tracks.filter(isFavorite));
  if (state.selectedPlaylist?.Id === playlist.Id) {
    state.playlistTracks = tracks;
    state.totalPlaylistTracks = tracks.length;
    state.hasMorePlaylistTracks = false;
    renderPlaylistDetail(playlist, state.playlistTracks, false);
  }
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

async function loadMoreSelectedPlaylistTracks() {
  if (!state.selectedPlaylist?.Id || state.isLoadingMorePlaylistTracks) {
    return;
  }

  if (state.totalPlaylistTracks && state.playlistTracks.length >= state.totalPlaylistTracks) {
    updatePlaylistTrackLoadMoreButton();
    return;
  }

  if (!state.totalPlaylistTracks && !state.hasMorePlaylistTracks && state.playlistTracks.length) {
    updatePlaylistTrackLoadMoreButton();
    return;
  }

  try {
    await loadPlaylistTrackPage(state.selectedPlaylist);
  } catch (error) {
    showNotice(`加载更多歌单歌曲失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试", handler: loadMoreSelectedPlaylistTracks }],
    });
  }
}

async function loadPlaylistTrackPage(playlist, options = {}) {
  if (!playlist?.Id) {
    return [];
  }

  const reset = Boolean(options.reset);
  const startIndex = reset ? 0 : state.playlistTracks.length;

  state.isLoadingMorePlaylistTracks = true;
  updatePlaylistTrackLoadMoreButton();

  try {
    const page = await fetchPlaylistTrackPage(playlist, startIndex, PLAYLIST_TRACK_PAGE_SIZE);
    const nextTracks = reset ? page.tracks : [...state.playlistTracks, ...page.tracks];

    state.playlistTracks = nextTracks;
    state.totalPlaylistTracks = page.total || getPlaylistKnownTrackCount(playlist) || 0;
    state.hasMorePlaylistTracks = page.hasMore;
    state.tracks = mergeUniqueItems(state.tracks, page.tracks);
    state.favoriteTracks = mergeUniqueItems(state.favoriteTracks, page.tracks.filter(isFavorite));
    applyFilters();
    renderLibrary();
    renderPlaylistDetail(playlist, state.playlistTracks, false);

    return page.tracks;
  } finally {
    state.isLoadingMorePlaylistTracks = false;
    updatePlaylistTrackLoadMoreButton();
  }
}

async function fetchPlaylistTrackPage(playlist, startIndex, limit) {
  const response = await embyFetch(state.session, userItemsPath(state.session, {
    ParentId: playlist.Id,
    Recursive: true,
    IncludeItemTypes: "Audio",
    StartIndex: startIndex,
    Limit: limit,
    Fields: itemFields,
    EnableUserData: true,
  }));
  const items = normalizeItems(response.Items);
  const tracks = items.filter(isAudioItem);
  const total = Number.isFinite(response.TotalRecordCount) && response.TotalRecordCount > 0
    ? response.TotalRecordCount
    : 0;

  return { tracks, total, hasMore: total ? startIndex + items.length < total : items.length >= limit };
}

async function fetchAllPlaylistTracks(playlist) {
  const allTracks = [];
  let total = getPlaylistKnownTrackCount(playlist);
  let startIndex = 0;

  while (true) {
    const page = await fetchPlaylistTrackPage(playlist, startIndex, PLAYLIST_TRACK_PAGE_SIZE);
    allTracks.push(...page.tracks);
    total = page.total || total;

    if (!page.tracks.length || (total && allTracks.length >= total) || (!total && !page.hasMore)) {
      break;
    }

    startIndex += page.tracks.length;
  }

  return mergeUniqueItems([], allTracks);
}

function getPlaylistKnownTrackCount(playlist) {
  const count = Number(playlist?.ChildCount || playlist?.SongCount || playlist?.ItemCount || 0);

  return Number.isFinite(count) && count > 0 ? count : 0;
}

function updatePlaylistTrackLoadMoreButton() {
  if (!loadMorePlaylistTracksButton) {
    return;
  }

  const loaded = state.playlistTracks.length;
  const total = state.totalPlaylistTracks || loaded;
  const hasMore = state.isLoadingMorePlaylistTracks || total > loaded || state.hasMorePlaylistTracks;
  const totalLabel = state.totalPlaylistTracks ? formatCount(total) : "更多";

  loadMorePlaylistTracksButton.hidden = !state.selectedPlaylist?.Id || !hasMore;
  loadMorePlaylistTracksButton.disabled = state.isLoadingMorePlaylistTracks;
  loadMorePlaylistTracksButton.textContent = state.isLoadingMorePlaylistTracks
    ? "正在加载..."
    : `加载更多歌曲 (${formatCount(loaded)}/${totalLabel})`;
}

function renderPlaylistDetail(playlist, tracks, isLoading) {
  const total = state.selectedPlaylist?.Id === playlist?.Id
    ? state.totalPlaylistTracks
    : getPlaylistKnownTrackCount(playlist);
  const isPartial = total > tracks.length;
  const loadedMeta = isPartial ? `已加载 ${formatCount(tracks.length)}/${formatCount(total)} 首` : "";

  updateDetailBackButton(backToPlaylistsButton, "playlistDetail");
  playlistDetailCover.replaceChildren();
  playlistDetailCover.className = "album-detail-cover playlist-detail-cover cover-d";
  appendImage(playlistDetailCover, getImageUrl(playlist, 720), playlist.Name);
  playlistDetailTitle.textContent = playlist.Name || "未命名歌单";
  playlistDetailMeta.textContent = [
    getPlaylistSubtitle(playlist),
    loadedMeta,
    tracks.length ? getTrackCollectionMeta(tracks) : "",
    getCollectionQualitySummary(tracks),
  ].filter(Boolean).join(" · ");

  playPlaylistButton.textContent = isPartial ? "播放全部" : "播放歌单";
  shufflePlaylistButton.textContent = isPartial ? "随机全部" : "随机播放";
  nextPlaylistButton.textContent = isPartial ? "下一首全部" : "下一首";
  queuePlaylistButton.textContent = isPartial ? "全部入队" : "加入队列";
  playPlaylistButton.disabled = !tracks.length;
  shufflePlaylistButton.disabled = !tracks.length;
  nextPlaylistButton.disabled = !tracks.length;
  queuePlaylistButton.disabled = !tracks.length;
  updateFavoriteButton(favoritePlaylistButton, playlist, "收藏歌单");

  if (isLoading) {
    if (loadMorePlaylistTracksButton) {
      loadMorePlaylistTracksButton.hidden = true;
    }
    appendLoading(playlistTrackList, "正在加载歌单歌曲...");
    return;
  }

  renderTrackList(playlistTrackList, tracks, {
    context: "playlist",
    emptyText: "这个歌单里没有读取到可播放歌曲。",
  });
  updatePlaylistTrackLoadMoreButton();
  updateActiveRows();
}

async function playSelectedPlaylist() {
  if (!state.selectedPlaylist?.Id && !state.playlistTracks.length) {
    return;
  }

  const tracks = state.selectedPlaylist?.Id
    ? await getPlayablePlaylistTracks(state.selectedPlaylist)
    : state.playlistTracks;

  if (tracks.length) {
    playTrack(tracks[0], tracks);
  }
}

async function shuffleSelectedPlaylist() {
  if (!state.selectedPlaylist?.Id && !state.playlistTracks.length) {
    return;
  }

  const tracks = state.selectedPlaylist?.Id
    ? await getPlayablePlaylistTracks(state.selectedPlaylist)
    : state.playlistTracks;
  const shuffled = [...tracks];
  shuffleTracks(shuffled);

  if (shuffled.length) {
    playTrack(shuffled[0], shuffled);
  }
}

async function queueSelectedPlaylist() {
  const tracks = state.selectedPlaylist?.Id
    ? await getPlayablePlaylistTracks(state.selectedPlaylist)
    : state.playlistTracks;
  queueTrackCollection(tracks, "歌单");
}

async function playSelectedPlaylistNext() {
  const tracks = state.selectedPlaylist?.Id
    ? await getPlayablePlaylistTracks(state.selectedPlaylist)
    : state.playlistTracks;
  playTrackCollectionNext(tracks, "歌单");
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

  const shuffled = queueOps.shuffle(range);
  const startIndex = getQueueShuffleStartIndex();
  state.queue = queueOps.replaceRemainder(state.queue, startIndex, shuffled);

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
  state.queue = queueOps.replaceRemainder(state.queue, startIndex, organized);

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
  return queueOps.findCurrentIndex(state.queue, state.currentTrack, state.currentTrackIndex);
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

  state.queue = queueOps.removeAt(state.queue, index);
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

  state.queue = queueOps.move(state.queue, fromIndex, toIndex);
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
  const filterDeps = [query, genre, year, quality, favorite, state.sortKey, state.sortOrder];
  store.set({
    availableGenres: getAvailableGenres(),
    availableYears: getAvailableYears(),
    availableQualities: getAvailableQualities(),
    filteredAlbums: store.derive("filteredAlbums", [state.albums, ...filterDeps], () => sortAlbums(state.albums.filter((album) => matchesQuery(album, query) && matchesGenre(album, genre) && matchesYear(album, year) && matchesAlbumQuality(album, quality) && matchesFavoriteFilter(album, favorite)))),
    filteredArtists: store.derive("filteredArtists", [state.artists, query, favorite, state.sortKey, state.sortOrder], () => sortArtists(state.artists.filter((artist) => matchesQuery(artist, query) && matchesFavoriteFilter(artist, favorite)))),
    filteredPlaylists: store.derive("filteredPlaylists", [state.playlists, query, favorite, state.sortKey, state.sortOrder], () => sortPlaylists(state.playlists.filter((playlist) => matchesQuery(playlist, query) && matchesFavoriteFilter(playlist, favorite)))),
    filteredFavoriteAlbums: store.derive("filteredFavoriteAlbums", [state.albums, ...filterDeps], () => sortAlbums(state.albums.filter((album) => isFavorite(album) && matchesQuery(album, query) && matchesGenre(album, genre) && matchesYear(album, year) && matchesAlbumQuality(album, quality) && matchesFavoriteFilter(album, favorite)))),
    filteredFavoriteArtists: store.derive("filteredFavoriteArtists", [state.artists, query, favorite, state.sortKey, state.sortOrder], () => sortArtists(state.artists.filter((artist) => isFavorite(artist) && matchesQuery(artist, query) && matchesFavoriteFilter(artist, favorite)))),
    filteredFavoritePlaylists: store.derive("filteredFavoritePlaylists", [state.playlists, query, favorite, state.sortKey, state.sortOrder], () => sortPlaylists(state.playlists.filter((playlist) => isFavorite(playlist) && matchesQuery(playlist, query) && matchesFavoriteFilter(playlist, favorite)))),
    filteredFavoriteTracks: store.derive("filteredFavoriteTracks", [state.favoriteTracks, ...filterDeps], () => sortTracks(state.favoriteTracks.filter((track) => matchesQuery(track, query) && matchesGenre(track, genre) && matchesYear(track, year) && matchesQuality(track, quality) && matchesFavoriteFilter(track, favorite)))),
    filteredTracks: store.derive("filteredTracks", [state.tracks, state.albumFilter, state.artistFilter, ...filterDeps], () => sortTracks(state.tracks.filter((track) => matchesTrackFilters(track)))),
  });
}

function getAvailableGenres() {
  return libraryOps.collectGenres(
    [...state.tracks, ...state.albums, ...state.favoriteTracks],
    getGenres,
    compareText
  );
}

function getAvailableYears() {
  return libraryOps.collectYears(
    [...state.tracks, ...state.albums, ...state.favoriteTracks],
    getProductionYear
  );
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
  return libraryOps.matchesQuery(item, query);
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
  return libraryOps.normalizeSearchText(value);
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
  renderPlaybackFavoriteButton(playerFavoriteButton, state.currentTrack);

  if (isExternalSourceSession()) {
    setLibraryStatus(nextValue ? "已收藏。" : "已取消收藏。");
    return;
  }

  try {
    await setFavoriteOnServer(item.Id, nextValue);
    setLibraryStatus(nextValue ? "已收藏。" : "已取消收藏。");
  } catch (error) {
    setFavoriteState(item.Id, !nextValue);
    syncFavoriteCollections(item, !nextValue);
    applyFilters();
    renderLibrary();
    renderPlaybackFavoriteButton(playerFavoriteButton, state.currentTrack);
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
  return libraryOps.sortTracks(tracks, {
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    compareText,
    compareNumber,
    compareDate,
    getArtists,
  });
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
  return libraryOps.sortCollections(albums, {
    kind: "album",
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    compareText,
    compareDate,
    getArtists,
  });
}

function sortArtists(artists) {
  return libraryOps.sortCollections(artists, {
    kind: "artist",
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    compareText,
    compareDate,
    getArtists,
  });
}

function sortPlaylists(playlists) {
  return libraryOps.sortCollections(playlists, {
    kind: "playlist",
    sortKey: state.sortKey,
    sortOrder: state.sortOrder,
    compareText,
    compareDate,
    getArtists,
  });
}

function getSortDirection() {
  return libraryOps.getSortDirection(state.sortKey, state.sortOrder);
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
  const playbackOptions = {
    ...options,
    forceExternalResolve: shouldForceResolveExternalTrack(track, options, nextQueue),
  };
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
  if (!playbackOptions.forceExternalResolve) {
    state.externalResolveRetryTrackId = "";
  }
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

  const playbackSession = takePreloadedPlaybackSession(track, mode, playbackOptions) || await preparePlaybackSession(track, mode, requestId, playbackOptions);

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

  saveQueueState(playbackOptions.positionSeconds);
  applyStartPosition(playbackOptions.positionSeconds, requestId);

  audioPlayer.play()
    .then(() => {
      if (requestId === state.playRequestId) {
        state.isChangingTrack = false;
        setPlaybackBuffering(false);
        state.externalResolveRetryTrackId = "";
        clearPlaybackErrorState();
        if (isExternalSourceTrack(track)) {
          saveQueueState(getQueuePositionSeconds());
        }
        scheduleImmersiveVisualizerSync();
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

async function downloadCurrentTrack(options = {}) {
  const track = state.currentTrack;

  if (!track?.Id) {
    setLibraryStatus("当前没有可下载的音乐。");
    return;
  }

  const previousDisabled = Boolean(immersiveDownloadButton?.disabled);
  const previousMobileDisabled = Boolean(immersiveMobileDownloadButton?.disabled);
  if (immersiveDownloadButton) {
    immersiveDownloadButton.disabled = true;
  }
  if (immersiveMobileDownloadButton) {
    immersiveMobileDownloadButton.disabled = true;
  }

  try {
    const qualityLabel = options.label ? `（${String(options.label).replace(/（当前）/g, "")}）` : "";
    setLibraryStatus(`正在准备下载${qualityLabel}：${track.Name || "当前音乐"}...`);
    const source = await resolveTrackDownloadSource(track, options);
    if (!source) {
      throw new Error("没有获取到可下载的播放源");
    }

    triggerBrowserDownload(source, buildTrackDownloadFilename(track, source));
    setLibraryStatus(`已开始下载：${track.Name || "当前音乐"}。`);
  } catch (error) {
    showNotice(`下载失败：${readableError(error)}`, {
      type: "error",
      actions: [{ label: "重试下载", handler: () => downloadCurrentTrack(options) }],
    });
  } finally {
    if (immersiveDownloadButton) {
      immersiveDownloadButton.disabled = previousDisabled || !state.currentTrack;
    }
    if (immersiveMobileDownloadButton) {
      immersiveMobileDownloadButton.disabled = previousMobileDisabled || !state.currentTrack;
    }
  }
}

async function resolveTrackDownloadSource(track, options = {}) {
  if (isExternalSourceTrack(track)) {
    const option = options.request ? options : getExternalPlaybackQualityOption(track);
    const media = await externalSourceApi.fetchMediaSource(getExternalTrackApiUrl(track), track, {
      quality: option.request || getExternalPlaybackQuality(track),
      videoQuality: option.videoQuality || (isVideoTrack(track) ? getExternalSourceVideoQuality() : ""),
      forceResolve: false,
    });
    applyExternalMediaMetadata(track, media, { qualityState: "resolved" });
    syncExternalTrackReference(track);
    return media.downloadUrl || media.streamUrl || media.directUrl || track.ExternalSource?.mediaUrl || "";
  }

  const currentSource = state.currentTrack?.Id === track.Id ? (audioPlayer.currentSrc || audioPlayer.src || "") : "";
  const requestedProfile = options.profile || null;
  const currentProfile = getAudioQualityProfile();
  if (!requestedProfile && currentSource && !/\.m3u8(?:[?#].*)?$/i.test(currentSource)) {
    return currentSource;
  }

  const playSessionId = ensurePlaybackSessionId(track);
  const mediaSourceId = getMediaSourceId(track);
  if (requestedProfile) {
    const mode = requestedProfile.mode === "direct" ? "direct" : "universal";
    return embyApi.getAudioStreamUrl(state.session, track, mode, requestedProfile, playSessionId, mediaSourceId);
  }

  return getAudioStreamUrl(track, currentProfile.mode === "direct" ? "direct" : "universal", playSessionId, mediaSourceId);
}

function triggerBrowserDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.target = "_blank";
  document.body.append(link);
  link.click();
  link.remove();
}

function buildTrackDownloadFilename(track, url) {
  const title = sanitizeDownloadFilename(track?.Name || "music");
  const artist = sanitizeDownloadFilename(getArtists(track) || "");
  const baseName = [artist, title].filter(Boolean).join(" - ") || "music";
  const extension = getDownloadExtension(track, url);

  return `${baseName.slice(0, 140)}.${extension}`;
}

function sanitizeDownloadFilename(value) {
  return String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDownloadExtension(track, url) {
  try {
    const parsed = new URL(url, location.href);
    const match = parsed.pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match) {
      return match[1].toLowerCase();
    }
  } catch {
    // Fall through to metadata-based extension.
  }

  const mediaSource = getPrimaryMediaSource(track);
  const stream = getPrimaryAudioStream(mediaSource);
  const codec = normalizeCodecLabel(stream?.Codec || mediaSource?.Container || track?.ExternalSource?.codec).toLowerCase();
  if (/flac/.test(codec)) {
    return "flac";
  }
  if (/aac|m4a/.test(codec)) {
    return "m4a";
  }
  if (/opus/.test(codec)) {
    return "opus";
  }
  if (/ogg|vorbis/.test(codec)) {
    return "ogg";
  }
  if (/wav/.test(codec)) {
    return "wav";
  }
  return "mp3";
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
  const mediaRaw = media.raw && typeof media.raw === "object" ? media.raw : null;
  const mediaRestore = media.restore && typeof media.restore === "object" ? media.restore : null;
  const mediaPluginMeta = mediaRaw?.pluginKey
    ? mediaRaw
    : (mediaRaw?.raw && typeof mediaRaw.raw === "object" && mediaRaw.raw.pluginKey ? mediaRaw.raw : {});
  const bridgeStreamUrl = media.bridgeStreamUrl || (isSourceBridgeStreamUrl(media.streamUrl) ? media.streamUrl : "");
  const nextStream = {
    ...(currentStream || {}),
    Type: mediaKind === "video" ? "Video" : "Audio",
    Codec: codec,
    BitRate: bitrate,
  };

  track.ExternalSource = {
    ...(track.ExternalSource || {}),
    mediaUrl: bridgeStreamUrl || media.streamUrl || track.ExternalSource?.mediaUrl || "",
    resolvedAt: (bridgeStreamUrl || media.streamUrl) ? Date.now() : (track.ExternalSource?.resolvedAt || 0),
    bridgeStreamUrl,
    directUrl: media.directUrl || track.ExternalSource?.directUrl || "",
    pluginKey: mediaRestore?.pluginKey || mediaPluginMeta.pluginKey || track.ExternalSource?.pluginKey,
    pluginName: mediaRestore?.pluginName || mediaPluginMeta.pluginName || track.ExternalSource?.pluginName,
    pluginUrl: mediaRestore?.pluginUrl || mediaPluginMeta.pluginUrl || track.ExternalSource?.pluginUrl,
    pluginPlatform: mediaRestore?.pluginPlatform || mediaPluginMeta.pluginPlatform || track.ExternalSource?.pluginPlatform,
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
    restore: media.restore || track.ExternalSource?.restore,
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

function markRestoredQueueTrackForFreshResolve(track) {
  if (isExternalSourceTrack(track)) {
    track._restoredQueueNeedsFreshResolve = true;
  }
}

function clearRestoredQueueFreshResolveMarker(track) {
  if (!track) {
    return;
  }

  delete track._restoredQueueNeedsFreshResolve;
}

// 插件流地址新鲜期：超过该时长的地址在重播前会重新解析（毫秒）。
const EXTERNAL_PLUGIN_URL_FRESH_TTL_MS = 5 * 60 * 1000;

function shouldForceResolveExternalTrack(track, options = {}, queue = []) {
  if (!isExternalSourceTrack(track)) {
    return false;
  }

  const restoredQueueTrack = Array.isArray(queue)
    ? queue.find((item) => item?.Id && item.Id === track?.Id)
    : null;

  if (
    options.forceExternalResolve
    || track._restoredQueueNeedsFreshResolve
    || restoredQueueTrack?._restoredQueueNeedsFreshResolve
  ) {
    return true;
  }

  // 插件来源的流地址是临时的、会过期：缺地址或超过新鲜期时，重播前先重新解析，
  // 避免“之前听过的歌重新听就报 no supported sources”。
  return isExternalPluginStreamUrlStale(track);
}

// 插件流地址是否已失效/过期，需要重新解析。
function isExternalPluginStreamUrlStale(track) {
  const external = track?.ExternalSource;
  if (!external || !isRestorableExternalSourcePlugin(external, external.restore)) {
    return false;
  }

  if (!external.mediaUrl) {
    return true;
  }

  const resolvedAt = Number(external.resolvedAt || 0);
  if (!resolvedAt) {
    return true;
  }

  return (Date.now() - resolvedAt) > EXTERNAL_PLUGIN_URL_FRESH_TTL_MS;
}

async function preparePlaybackSession(track, mode, requestId, options = {}) {
  if (isExternalSourceTrack(track)) {
    try {
      const media = await externalSourceApi.fetchMediaSource(getExternalTrackApiUrl(track), track, {
        quality: getExternalPlaybackQuality(track),
        videoQuality: isVideoTrack(track) ? getExternalSourceVideoQuality() : "",
        forceResolve: Boolean(options.forceExternalResolve),
      });

      if (requestId !== state.playRequestId) {
        return null;
      }

      applyExternalMediaMetadata(track, media);
      clearRestoredQueueFreshResolveMarker(track);
      syncExternalTrackReference(track);
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
    console.warn("Emby PlaybackInfo failed; falling back to generated play session.", redact.redactText(readableError(error)));
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

  const shouldUseCors = shouldEnableAudioElementCors(source);
  if (shouldUseCors) {
    audioPlayer.crossOrigin = "anonymous";
  } else {
    audioPlayer.removeAttribute("crossorigin");
  }

  if (audioPlayer.src !== source) {
    releaseImmersiveVisualizerAnalyser();
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

function shouldEnableAudioElementCors(source) {
  if (!source) {
    return false;
  }

  if (isSourceBridgeStreamUrl(source)) {
    return true;
  }

  try {
    const parsed = new URL(String(source), location.href);
    return parsed.origin === location.origin;
  } catch {
    return false;
  }
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

  if (retryExternalPlaybackWithFreshMedia(state.currentTrack, "HLS 播放失败，正在重新解析音源...")) {
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
        forceExternalResolve: isExternalSourceTrack(state.currentTrack),
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
    if (shouldReloadExternalPlaybackBeforeResume(state.currentTrack)) {
      playTrack(state.currentTrack, getPlaybackRetryQueue(state.currentTrack), {
        positionSeconds: getRetryPositionSeconds(),
        forceExternalResolve: true,
      });
      return;
    }

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

  if (retryExternalPlaybackWithFreshMedia(track, "恢复播放失败，正在重新解析音源...")) {
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

  const position = playerOps.seekPlayer(audioPlayer, nextPosition, duration, options);
  if (position === false) {
    return false;
  }

  pauseLyricPlaybackClock();
  updateProgress({ syncLyrics: false });
  state.activeLyricTimelineIndex = -1;
  updateLyricsHighlight(position, true);
  syncLyricProgressLoop();

  if (options.report !== false) {
    reportPlaybackProgress(true, options.eventName || "Seek");
  }

  return true;
}

function getAudioDurationSeconds() {
  const duration = Number(audioPlayer.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getReliableProgressDurationSeconds(current = getAudioCurrentTimeSeconds(), duration = getAudioDurationSeconds()) {
  const currentValue = Number(current);
  const durationValue = Number(duration);
  const candidates = [
    durationValue,
    state.currentTrack ? getTrackDurationSeconds(state.currentTrack) : 0,
    state.currentTrack ? getLyricTimelineDurationHintSeconds() : 0,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const reliableDuration = candidates.length ? Math.max(...candidates) : 0;
  const safeCurrent = Number.isFinite(currentValue) && currentValue > 0 ? currentValue : 0;

  return Math.max(reliableDuration, safeCurrent);
}

function getLyricTimelineDurationHintSeconds() {
  if (!state.isLyricSynced || !Array.isArray(state.lyricLines) || !state.lyricLines.length) {
    return 0;
  }

  let latestSeconds = 0;

  state.lyricLines.forEach((line, index) => {
    const start = Number(line?.time);
    if (Number.isFinite(start) && start > latestSeconds) {
      latestSeconds = start;
    }

    const explicitEnd = Number(line?.endTime);
    if (Number.isFinite(explicitEnd) && explicitEnd > latestSeconds) {
      latestSeconds = explicitEnd;
    }

    [line?.wordTimeline, line?.translatedWordTimeline].forEach((timeline) => {
      if (!Array.isArray(timeline)) {
        return;
      }

      timeline.forEach((word) => {
        const end = Number(word?.endTime);
        if (Number.isFinite(end) && end > latestSeconds) {
          latestSeconds = end;
          return;
        }

        const wordStart = Number(word?.time);
        if (Number.isFinite(wordStart)) {
          latestSeconds = Math.max(latestSeconds, wordStart + getEstimatedLyricWordDurationSeconds(word));
        }
      });
    });

    if (Number.isFinite(start)) {
      const timelineIndex = state.lyricTimelineIndexByLineIndex[index] ?? -1;
      const nextEntry = timelineIndex >= 0 ? state.lyricTimeline[timelineIndex + 1] : null;
      const estimatedEnd = getLyricLineProgressEndSeconds({
        line,
        start,
        nextEntry,
        wordCount: getLyricLineDurationHintWordCount(line),
        text: line?.originalText || line?.text,
      });
      if (Number.isFinite(estimatedEnd) && estimatedEnd > latestSeconds) {
        latestSeconds = estimatedEnd;
      }
    }
  });

  return latestSeconds > 0 ? latestSeconds + MINI_PLAYER_PROGRESS_LYRIC_TAIL_GUARD_SECONDS : 0;
}

function getLyricLineDurationHintWordCount(line) {
  const timelineCount = Math.max(
    Array.isArray(line?.wordTimeline) ? line.wordTimeline.length : 0,
    Array.isArray(line?.translatedWordTimeline) ? line.translatedWordTimeline.length : 0
  );

  if (timelineCount > 0) {
    return timelineCount;
  }

  const text = String(line?.originalText || line?.text || "").replace(/\s+/g, "");
  return Array.from(text).filter((char) => char.trim()).length || 1;
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

function maybeSyncLyricPlaybackClock(options = {}) {
  const shouldKeepRafHandoff = shouldDeferLyricClockSync();
  if (options.force || !shouldKeepRafHandoff) {
    syncLyricPlaybackClock(options);
    return true;
  }

  const audioSeconds = getAudioCurrentTimeSeconds();
  const lyricSeconds = getLyricPlaybackTimeSeconds();
  const driftSeconds = audioSeconds - lyricSeconds;
  const absoluteDriftSeconds = Math.abs(driftSeconds);

  if (absoluteDriftSeconds >= LYRIC_CLOCK_HARD_RESYNC_THRESHOLD_SECONDS) {
    syncLyricPlaybackClock({ ...options, running: true });
    return true;
  }

  if (absoluteDriftSeconds >= LYRIC_CLOCK_RESYNC_THRESHOLD_SECONDS) {
    nudgeLyricPlaybackClock(driftSeconds);
    return false;
  }

  lyricClockPlaybackRate = Number(audioPlayer.playbackRate) || 1;
  return false;
}

function nudgeLyricPlaybackClock(driftSeconds) {
  const playbackRate = Number(audioPlayer.playbackRate) || 1;
  const correctedSeconds = getLyricPlaybackTimeSeconds() + (driftSeconds * LYRIC_CLOCK_DRIFT_CORRECTION_RATIO);

  lyricClockAudioSeconds = Math.max(0, correctedSeconds);
  lyricClockStartedAtMs = getMonotonicNowMs();
  lyricClockPlaybackRate = playbackRate;
  lyricClockIsRunning = true;
}

function shouldDeferLyricClockSync() {
  return areSmoothLyricSurfacesVisible()
    && lyricClockIsRunning
    && (lyricProgressFrame || lyricProgressResumeTimer);
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
  const durationSeconds = getReliableProgressDurationSeconds(estimatedSeconds, getAudioDurationSeconds());
  return durationSeconds ? clamp(estimatedSeconds, 0, durationSeconds) : Math.max(0, estimatedSeconds);
}

function getVisibleLyricSyncTimeSeconds(fallbackSeconds = getAudioCurrentTimeSeconds()) {
  return areSmoothLyricSurfacesVisible() && shouldEstimateLyricPlaybackClock()
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
  flushListenTimeRecord({ force: true });
  resetListenTimeTick();
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

  const label = button.querySelector(".sr-only") || button.querySelector("span");
  if (label) {
    label.textContent = modeLabel;
  } else {
    button.textContent = modeLabel;
  }

  button.setAttribute("aria-label", `播放模式：${modeLabel}`);
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
      album: track.Album || "Aurora Music",
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

  const diagnostics = [
    "本诊断已经隐藏服务器/账号敏感信息，可用于问题排查。",
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
    `External fresh resolve retry: ${state.externalResolveRetryTrackId || "-"}`,
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
    `Lyrics source: ${state.lyricsSourceDiagnostics?.source || "-"}`,
    `Lyrics source API: ${state.lyricsSourceDiagnostics?.apiUrl || "-"}`,
    `Lyrics source path: ${state.lyricsSourceDiagnostics?.path || "-"}`,
    `Lyrics media path: ${state.lyricsSourceDiagnostics?.mediaPath || "-"}`,
    `Lyrics file path: ${state.lyricsSourceDiagnostics?.lyricPath || "-"}`,
    `Lyrics source status: ${state.lyricsSourceDiagnostics?.status || "-"}`,
    `Lyrics has CJK: ${state.lyricsSourceDiagnostics?.hasCjk ? "yes" : "no"}`,
    `Lyrics has bilingual: ${state.lyricsSourceDiagnostics?.hasBilingual ? "yes" : "no"}`,
    `Lyrics source lines: ${state.lyricsSourceDiagnostics?.lineCount || "-"}`,
    `Lyrics source error: ${state.lyricsSourceDiagnostics?.error || "-"}`,
  ].join("\n");

  return redact.redactText(diagnostics);
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
  const diagnostics = [
    "本诊断已经隐藏服务器/账号敏感信息，可用于问题排查。",
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

  return redact.redactText(diagnostics);
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
  audioPlayer.volume = playerOps.normalizeVolume(state.volume);
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
    setIconButtonLabel(immersiveQualityButton, audioQualityButton.title);
    setIconButtonLabel(immersiveMobileQualityButton, audioQualityButton.title);
    renderImmersiveMobileDeckQuality(state.currentTrack);
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
  setIconButtonLabel(immersiveQualityButton, audioQualityButton.title);
  setIconButtonLabel(immersiveMobileQualityButton, audioQualityButton.title);
  renderImmersiveMobileDeckQuality(state.currentTrack);
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
  const nextVolume = playerOps.normalizeVolume(Number(volumeSlider.value) / 100);
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

function takePreloadedPlaybackSession(track, mode, options = {}) {
  if (options.forceExternalResolve) {
    if (track?.Id && track.Id === state.preloadTrackId) {
      clearPreload();
    }
    return null;
  }

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
  releaseImmersiveVisualizerAnalyser();
  destroyHlsPlayer();
  audioPlayer.removeAttribute("crossorigin");
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
      forceExternalResolve: true,
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

function retryExternalPlaybackWithFreshMedia(track = state.currentTrack, reason = "") {
  if (!isExternalSourceTrack(track) || !track?.Id) {
    return false;
  }

  if (state.externalResolveRetryTrackId === track.Id) {
    return false;
  }

  state.externalResolveRetryTrackId = track.Id;
  setLibraryStatus(reason || "播放地址失效，正在重新解析音源...");
  playTrack(track, getPlaybackRetryQueue(track), {
    positionSeconds: getRetryPositionSeconds(),
    forceExternalResolve: true,
  });
  return true;
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

function shouldReloadExternalPlaybackBeforeResume(track) {
  if (!isExternalSourceTrack(track) || !audioPlayer.src) {
    return false;
  }

  const source = audioPlayer.currentSrc || audioPlayer.src;
  const isRestorablePlugin = isRestorableExternalSourcePlugin(track.ExternalSource, track.ExternalSource?.restore);

  return Boolean(
    track._restoredQueueNeedsFreshResolve
      || (isAnySourceBridgePlaybackUrl(source) && !isSourceBridgeStreamUrl(source))
      || (isRestorablePlugin && !isSourceBridgeStreamUrl(source))
  );
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

  if (retryExternalPlaybackWithFreshMedia(track)) {
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
      forceExternalResolve: isExternalSourceTrack(track || state.currentTrack),
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

  if (retryExternalPlaybackWithFreshMedia(state.currentTrack)) {
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

function applyPlayerMetaMarquee(titleText, subtitleText) {
  if (!playerMetaButton) {
    return;
  }

  if (playerTitle) {
    playerTitle.dataset.text = titleText || "";
  }
  if (playerSubtitle) {
    playerSubtitle.dataset.text = subtitleText || "";
  }

  const syncTitleMarquee = () => {
    const viewportWidth = miniPlayerTitleViewport?.clientWidth || 0;
    const titleWidth = Math.max(
      playerTitle?.scrollWidth || 0,
      miniPlayerTitleScroll?.scrollWidth || 0,
    );
    const subtitleViewportWidth = playerSubtitle?.clientWidth || viewportWidth;
    const subtitleWidth = playerSubtitle?.scrollWidth || 0;
    const titleMarquee = Boolean(
      titleText
      && (
        (viewportWidth > 0 && titleWidth > viewportWidth + 4)
        || (titleText || "").length > 14
      ),
    );
    const subtitleMarquee = Boolean(
      subtitleText
      && (
        (subtitleViewportWidth > 0 && subtitleWidth > subtitleViewportWidth + 4)
        || (subtitleText || "").length > 20
      ),
    );
    const titleDurationSeconds = Math.max(9, Math.min(18, Math.round((titleText || "").length * 0.38) + 7));
    const subtitleDurationSeconds = Math.max(10, Math.min(22, Math.round((subtitleText || "").length * 0.32) + 8));

    setCssVariableIfChanged(playerMetaButton, "--mini-title-marquee-duration", `${titleDurationSeconds}s`);
    setCssVariableIfChanged(playerMetaButton, "--mini-subtitle-marquee-duration", `${subtitleDurationSeconds}s`);
    playerMetaButton.classList.toggle("is-title-marquee", titleMarquee);
    playerMetaButton.classList.toggle("is-subtitle-marquee", subtitleMarquee);
  };

  playerMetaButton.classList.remove("is-title-marquee", "is-subtitle-marquee");
  syncTitleMarquee();
  window.requestAnimationFrame?.(syncTitleMarquee);
}

function renderMiniPlayerCover(track) {
  if (!playerCover) {
    return;
  }

  playerCover.className = "mini-cover mini-player-cover";
  if (playerCover instanceof HTMLImageElement) {
    const transparentCoverPixel = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
    const imageUrl = track ? getTrackImageUrl(track, 180) : "";
    playerCover.alt = track?.Name || "封面";
    playerCover.src = imageUrl || transparentCoverPixel;
    playerCover.classList.remove("is-image-loading");
    return;
  }

  playerCover.replaceChildren();
  if (track) {
    appendImage(playerCover, getTrackImageUrl(track, 180), track.Name);
  }
}

function updatePlayerMeta(track) {
  applyTrackAccent(track);
  document.body.classList.toggle("has-current-track", Boolean(track));
  updateMediaElementPresentation(track);
  const playerTitleText = track.Name || "未命名歌曲";
  const playerSubtitleText = [getArtists(track), track.Album].filter(Boolean).join(" · ") || "Aurora Music";
  playerTitle.textContent = playerTitleText;
  playerSubtitle.textContent = playerSubtitleText;
  applyPlayerMetaMarquee(playerTitleText, playerSubtitleText);
  renderPlayerPlaybackMeta(track);
  renderMiniPlayerCover(track);
  renderPlaybackFavoriteButton(playerFavoriteButton, track);
  updateMiniPlayerLyric(null);
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
  setStaticMarkup(floatingVideoMinimizeButton, '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H6.8A1.8 1.8 0 0 0 5 6.8V9"></path><path d="M15 5h2.2A1.8 1.8 0 0 1 19 6.8V9"></path><path d="M19 15v2.2a1.8 1.8 0 0 1-1.8 1.8H15"></path><path d="M9 19H6.8A1.8 1.8 0 0 1 5 17.2V15"></path></svg>');

  floatingVideoHideButton = document.createElement("button");
  floatingVideoHideButton.type = "button";
  floatingVideoHideButton.className = "floating-video-control";
  floatingVideoHideButton.setAttribute("aria-label", "隐藏视频窗口");
  floatingVideoHideButton.title = "隐藏视频窗口";
  setStaticMarkup(floatingVideoHideButton, '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10"></path><path d="M17 7 7 17"></path></svg>');

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
  playerSubtitle.textContent = "Aurora Music";
  applyPlayerMetaMarquee("等待选择音乐", "Aurora Music");
  renderPlayerPlaybackMeta(null);
  renderMiniPlayerCover(null);
  renderPlaybackFavoriteButton(playerFavoriteButton, null);
  updateMiniPlayerLyric(null);
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
  settingsAccentColor.replaceChildren();
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
  if (playerQualityBadge) {
    const qualityBadge = getMiniPlayerQualityBadgeInfo(track);
    setTextIfChanged(playerQualityBadge, qualityBadge.label);
    playerQualityBadge.title = qualityBadge.title;
    playerQualityBadge.hidden = !track;
  }

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

function getMiniPlayerQualityBadgeInfo(track) {
  if (!track) {
    return {
      label: "HQ",
      title: "当前音质",
    };
  }

  const quality = getTrackQualitySummary(track);
  if (quality?.shortLabel) {
    return {
      label: normalizeMiniPlayerQualityBadgeLabel(quality.shortLabel, track),
      title: quality.detailLabel || quality.shortLabel,
    };
  }

  if (isExternalSourceTrack(track)) {
    const fallbackLabel = getExternalMissingQualityBadgeLabel(track);
    return {
      label: fallbackLabel,
      title: fallbackLabel === "CHK" ? "正在获取源站音质" : "未获取到源站音质",
    };
  }

  return {
    label: "NA",
    title: "未获取到音源信息",
  };
}

function getExternalMissingQualityBadgeLabel(track) {
  const source = getPrimaryMediaSource(track);
  const stream = getPrimaryAudioStream(source);
  const external = track?.ExternalSource || {};
  const mediaKind = normalizeExternalMediaKind(external.mediaKind || source.MediaKind || stream.Type);

  if (external.qualityState === "resolving") {
    return "CHK";
  }

  return mediaKind === "video" ? "MV" : "NA";
}

function normalizeMiniPlayerQualityBadgeLabel(label, track) {
  const text = String(label || "").trim();
  const replacements = new Map([
    ["检测中", "CHK"],
    ["源站未标注", "NA"],
    ["MV 未标注", "MV"],
    ["未标注", "NA"],
    ["高品质", "HQ"],
    ["高品", "HQ"],
    ["高音质", "HQ"],
    ["标准", "STD"],
    ["普通", "STD"],
    ["无损", "SQ"],
    ["无损优先", "SQ"],
    ["省流", "LOW"],
    ["视频", "MV"],
  ]);

  if (replacements.has(text)) {
    return replacements.get(text);
  }

  if (/[\u3400-\u9fff]/.test(text)) {
    return isVideoTrack(track) ? "MV" : "NA";
  }

  const normalized = text
    .replace(/\s+/g, "")
    .replace(/^MV(\d+P)$/i, "MV$1")
    .replace(/^Hi-?Res$/i, "Hi-Res");

  return normalized || (isVideoTrack(track) ? "MV" : "NA");
}

function setPlayerEnabled(isEnabled) {
  playerMetaButton.disabled = !isEnabled;
  if (playerFavoriteButton) {
    playerFavoriteButton.disabled = !isEnabled || !state.currentTrack;
  }
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
  if (immersiveQualityButton) {
    immersiveQualityButton.disabled = !state.session;
  }
  if (immersiveDownloadButton) {
    immersiveDownloadButton.disabled = !isEnabled || !state.currentTrack;
  }
  if (immersiveMobileFavoriteButton) {
    immersiveMobileFavoriteButton.disabled = !isEnabled || !state.currentTrack;
  }
  if (immersiveMobileZenButton) {
    immersiveMobileZenButton.disabled = !state.currentTrack;
  }
  if (immersiveMobileQualityButton) {
    immersiveMobileQualityButton.disabled = !state.session;
  }
  if (immersiveMobileDownloadButton) {
    immersiveMobileDownloadButton.disabled = !isEnabled || !state.currentTrack;
  }
  if (immersiveMobileMoreButton) {
    immersiveMobileMoreButton.disabled = !state.session;
  }
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
  updateTopbarLyricState();
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
  setIconButtonLabel(immersivePlayButton, label);
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
  resetListenTimeTick();
  syncLyricPlaybackClock({ running: true });
  updatePlaybackState();
  scheduleImmersiveVisualizerSync();
  refreshLyricsForPlaybackResume();

  if (state.currentTrack && !state.isChangingTrack) {
    reportPlaybackProgress(true, "Unpause");
  }
}

function handleAudioPause() {
  flushListenTimeRecord({ force: true });
  resetListenTimeTick();
  setPlaybackBuffering(false);
  pauseLyricPlaybackClock();
  updatePlaybackState();
  syncImmersiveVisualizer();
  stopLyricProgressLoop();
  persistPlaybackPosition({ force: true });

  if (state.currentTrack && !state.isChangingTrack && audioPlayer.currentTime > 0 && !audioPlayer.ended) {
    reportPlaybackProgress(true, "Pause");
  }
}

function handleAudioTimeUpdate() {
  maybeSyncLyricPlaybackClock();
  updateProgress();
  recordListenTimeFromProgress();
  persistPlaybackPosition();
  if (isImmersiveVisualizerPlaybackActive() && !immersiveVisualizerFrame) {
    scheduleImmersiveVisualizerSync({ followUp: false });
  }

  if (Date.now() - state.lastProgressReportAt > 15000) {
    reportPlaybackProgress();
  }
}

function handleAudioSeeked() {
  flushListenTimeRecord({ force: true });
  resetListenTimeTick();
  setPlaybackBuffering(false);
  syncLyricPlaybackClock();
  updateProgress({ syncLyrics: false });
  state.activeLyricTimelineIndex = -1;
  updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  syncLyricProgressLoop();
  scheduleImmersiveVisualizerSync();

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
  stopLyricProgressLoop();
}

function handleAudioBufferingEnd() {
  setPlaybackBuffering(false);
  syncLyricPlaybackClock();
  scheduleImmersiveVisualizerSync();
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
  if (shouldSyncLyrics && shouldSyncLyricsFromProgressUpdate()) {
    updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(current));
  }
  updateMediaSessionPosition();
  renderPlayerNextPreview();
}

function shouldSyncLyricsFromProgressUpdate() {
  return !shouldDeferLyricClockSync();
}

function getMiniPlayerProgressRingLength() {
  const radius = Number(miniPlayerProgress?.getAttribute("r"));
  if (Number.isFinite(radius) && radius > 0) {
    return 2 * Math.PI * radius;
  }
  return 289.03;
}

function setProgressDisplay(current, duration) {
  const currentValue = Number(current);
  const durationValue = Number(duration);
  const safeCurrent = Number.isFinite(currentValue) ? Math.max(0, currentValue) : 0;
  const safeDuration = Number.isFinite(durationValue) ? Math.max(0, durationValue) : 0;
  const displayDuration = state.currentTrack
    ? getReliableProgressDurationSeconds(safeCurrent, safeDuration)
    : safeDuration;
  const progressRatio = displayDuration > 0
    ? Math.max(0, Math.min(safeCurrent / displayDuration, 1))
    : 0;
  const percent = progressRatio * 100;
  const ratio = String(progressRatio);
  const width = `${percent}%`;
  const miniProgressDegrees = `${(progressRatio * 360).toFixed(3)}deg`;
  const miniRingLength = getMiniPlayerProgressRingLength();
  const miniRingVisibleLength = Math.max(0, Math.min(miniRingLength, miniRingLength * progressRatio));
  const miniRingDashArray = `${miniRingVisibleLength} ${miniRingLength}`;
  const miniRingOffset = "0";
  const currentLabel = formatSeconds(safeCurrent);
  const durationLabel = formatSeconds(displayDuration);
  const progressLabel = displayDuration
    ? `播放进度：${currentLabel} / ${durationLabel}`
    : "播放进度";
  const signature = [
    currentLabel,
    durationLabel,
    width,
    miniProgressDegrees,
    miniRingLength,
    miniRingDashArray,
    miniRingOffset,
    ratio,
    progressLabel,
  ].join("|");

  if (signature === progressRenderSignature) {
    renderHomeStartProgress(safeCurrent, displayDuration);
    return;
  }

  progressRenderSignature = signature;
  setStylePropertyIfChanged(progressFill, "width", width);
  setAttributeIfChanged(miniPlayerProgress, "stroke-dasharray", miniRingDashArray);
  setAttributeIfChanged(miniPlayerProgress, "stroke-dashoffset", miniRingOffset);
  setCssVariableIfChanged(miniPlayerProgress, "--mini-progress-length", miniRingDashArray);
  setCssVariableIfChanged(miniPlayerProgress, "--mini-progress-offset", miniRingOffset);
  setCssVariableIfChanged(miniPlayerCoverContainer, "--mini-progress-deg", miniProgressDegrees);
  setCssVariableIfChanged(progressFill, "--progress-ratio", ratio);
  setCssVariableIfChanged(playButton, "--progress-ratio", ratio);
  setStylePropertyIfChanged(nowPlayingProgressFill, "width", width);
  setStylePropertyIfChanged(immersiveProgressFill, "width", width);
  setTextIfChanged(currentTime, currentLabel);
  setTextIfChanged(nowPlayingCurrentTime, currentLabel);
  setTextIfChanged(immersiveCurrentTime, currentLabel);
  setTextIfChanged(durationTime, durationLabel);
  setTextIfChanged(nowPlayingDurationTime, durationLabel);
  setTextIfChanged(immersiveDurationTime, durationLabel);
  renderHomeStartProgress(safeCurrent, displayDuration);
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

function getImmersiveWaveformParts() {
  const root = getActiveImmersiveWaveformRoot();
  return getImmersiveWaveformPartsFromRoot(root);
}

function getImmersiveWaveformPartsFromRoot(root) {
  return {
    root,
    aura: root?.querySelector(".immersive-waveform-aura") || null,
    line: root?.querySelector(".immersive-waveform-line") || null,
    fill: root?.querySelector(".immersive-waveform-fill") || null,
    runner: root?.querySelector(".immersive-waveform-runner") || null,
  };
}

function getImmersiveWaveformRoots() {
  return [
    immersivePlayerPanel?.querySelector(".immersive-desktop-stage-toggle .immersive-waveform"),
    immersivePlayerPanel?.querySelector(".immersive-mobile-stage-toggle .immersive-waveform"),
  ].filter(Boolean);
}

function getActiveImmersiveWaveformRoot() {
  const roots = [
    ...getImmersiveWaveformRoots(),
    document.querySelector(".immersive-waveform"),
  ].filter(Boolean);

  return roots.find((root) => {
    const style = window.getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }) || roots[0] || null;
}

function ensureImmersiveVisualizerAnalyser() {
  if (immersiveVisualizerAnalyser && immersiveVisualizerData && immersiveVisualizerSourceElement === audioPlayer) {
    return true;
  }

  releaseImmersiveVisualizerAnalyser();

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const captureStream = audioPlayer?.captureStream || audioPlayer?.mozCaptureStream;
  if (!AudioContextClass || !audioPlayer || typeof captureStream !== "function") {
    return false;
  }

  try {
    immersiveVisualizerStream = captureStream.call(audioPlayer);
    if (!immersiveVisualizerStream?.getAudioTracks?.().length) {
      releaseImmersiveVisualizerAnalyser();
      return false;
    }

    immersiveVisualizerAudioContext = new AudioContextClass();
    immersiveVisualizerSource = immersiveVisualizerAudioContext.createMediaStreamSource(immersiveVisualizerStream);
    immersiveVisualizerAnalyser = immersiveVisualizerAudioContext.createAnalyser();
    configureImmersiveVisualizerAnalyser();
    immersiveVisualizerSource.connect(immersiveVisualizerAnalyser);
    immersiveVisualizerData = new Uint8Array(immersiveVisualizerAnalyser.fftSize);
    immersiveVisualizerFrequencyData = new Uint8Array(immersiveVisualizerAnalyser.frequencyBinCount);
    immersiveVisualizerSourceElement = audioPlayer;
    return true;
  } catch (error) {
    releaseImmersiveVisualizerAnalyser();
    return false;
  }
}

function configureImmersiveVisualizerAnalyser() {
  if (!immersiveVisualizerAnalyser) {
    return;
  }
  immersiveVisualizerAnalyser.fftSize = 2048;
  immersiveVisualizerAnalyser.smoothingTimeConstant = 0.3;
  immersiveVisualizerAnalyser.minDecibels = -92;
  immersiveVisualizerAnalyser.maxDecibels = -18;
}

function releaseImmersiveVisualizerAnalyser() {
  try {
    immersiveVisualizerSource?.disconnect?.();
  } catch {
    // Nothing to release.
  }

  try {
    immersiveVisualizerAudioContext?.close?.();
  } catch {
    // Closing is best-effort; playback must not depend on the analyser.
  }

  immersiveVisualizerAudioContext = null;
  immersiveVisualizerSource = null;
  immersiveVisualizerAnalyser = null;
  immersiveVisualizerData = null;
  immersiveVisualizerFrequencyData = null;
  immersiveVisualizerStream = null;
  immersiveVisualizerSourceElement = null;
  immersiveVisualizerLastStats = null;
}

function isImmersiveVisualizerPlaybackActive() {
  return Boolean(state.currentTrack && !audioPlayer.paused && !audioPlayer.ended);
}

function scheduleImmersiveVisualizerSync(options = {}) {
  if (!immersiveVisualizerSyncFrame) {
    immersiveVisualizerSyncFrame = requestAnimationFrame(() => {
      immersiveVisualizerSyncFrame = 0;
      syncImmersiveVisualizer();
    });
  }

  if (options.followUp === false) {
    return;
  }

  if (immersiveVisualizerSyncTimer) {
    window.clearTimeout(immersiveVisualizerSyncTimer);
  }
  immersiveVisualizerSyncTimer = window.setTimeout(() => {
    immersiveVisualizerSyncTimer = 0;
    syncImmersiveVisualizer();
  }, Number(options.delayMs) || 180);
}

function renderImmersiveVisualizerForCurrentPlaybackState() {
  if (isImmersiveVisualizerPlaybackActive()) {
    scheduleImmersiveVisualizerSync();
    return;
  }

  renderIdleImmersiveWaveform();
}

function syncImmersiveVisualizer() {
  const isPlaying = isImmersiveVisualizerPlaybackActive();
  if (!isPlaying) {
    stopImmersiveVisualizer();
    return;
  }

  startImmersiveVisualizer();
}

function startImmersiveVisualizer() {
  const waveform = getImmersiveWaveformParts();
  if (!waveform.line || !waveform.fill) {
    return;
  }

  const hasAnalyser = ensureImmersiveVisualizerAnalyser();
  if (hasAnalyser && immersiveVisualizerAudioContext?.state === "suspended") {
    immersiveVisualizerAudioContext.resume?.().catch(() => {
      releaseImmersiveVisualizerAnalyser();
    });
  }

  document.body.classList.toggle("is-immersive-visualizer-live", true);
  document.body.classList.toggle("is-immersive-visualizer-sampled", hasAnalyser);
  if (!immersiveVisualizerFrame) {
    immersiveVisualizerFrame = requestAnimationFrame(updateImmersiveVisualizerFrame);
  }
}

function stopImmersiveVisualizer() {
  if (immersiveVisualizerFrame) {
    cancelAnimationFrame(immersiveVisualizerFrame);
    immersiveVisualizerFrame = 0;
  }

  document.body.classList.remove("is-immersive-visualizer-live");
  document.body.classList.remove("is-immersive-visualizer-sampled");
  renderImmersiveWaveform(getImmersiveWaveformFallbackLevels(72, getMonotonicNowMs() / 1000, { idle: true }), 0.18);
  immersiveVisualizerLevels = [];
  immersiveVisualizerLastStats = null;
}

function renderIdleImmersiveWaveform() {
  renderImmersiveWaveform(getImmersiveWaveformFallbackLevels(72, getMonotonicNowMs() / 1000, { idle: true }), 0.18);
}

function updateImmersiveVisualizerFrame() {
  immersiveVisualizerFrame = 0;

  const waveform = getImmersiveWaveformParts();
  const isPlaying = isImmersiveVisualizerPlaybackActive();
  if (!waveform.line || !waveform.fill || !isPlaying) {
    stopImmersiveVisualizer();
    return;
  }

  let audioStats = null;
  let hasLiveData = false;
  if (immersiveVisualizerAudioContext?.state === "suspended") {
    immersiveVisualizerAudioContext.resume?.().catch(() => {
      releaseImmersiveVisualizerAnalyser();
    });
  }

  if (
    immersiveVisualizerAnalyser
    && immersiveVisualizerData
    && immersiveVisualizerFrequencyData
    && immersiveVisualizerAudioContext?.state !== "suspended"
  ) {
    immersiveVisualizerAnalyser.getByteTimeDomainData(immersiveVisualizerData);
    immersiveVisualizerAnalyser.getByteFrequencyData(immersiveVisualizerFrequencyData);
    audioStats = getImmersiveVisualizerAudioStats(immersiveVisualizerData, immersiveVisualizerFrequencyData);
    hasLiveData = isImmersiveVisualizerAudioStatsLive(audioStats);
  }

  document.body.classList.toggle("is-immersive-visualizer-sampled", hasLiveData);

  const pointCount = 72;
  if (immersiveVisualizerLevels.length !== pointCount) {
    immersiveVisualizerLevels = getImmersiveWaveformFallbackLevels(pointCount, getMonotonicNowMs() / 1000);
  }

  const flowTime = getAudioCurrentTimeSeconds() || (getMonotonicNowMs() / 1000);
  let peak = 0;
  const reactiveLevels = hasLiveData && audioStats
    ? getImmersiveVisualizerReactiveLevels(pointCount, flowTime, audioStats)
    : null;
  const levels = immersiveVisualizerLevels.map((previousLevel, index) => {
    const rawLevel = reactiveLevels
      ? reactiveLevels[index]
      : getImmersiveVisualizerFallbackLevel(index, pointCount, flowTime);
    const response = reactiveLevels ? 0.5 : 0.16;
    const level = previousLevel + ((rawLevel - previousLevel) * response);
    peak = Math.max(peak, Math.abs(level));
    return level;
  });
  immersiveVisualizerLevels = levels;
  renderImmersiveWaveform(levels, peak);

  immersiveVisualizerFrame = requestAnimationFrame(updateImmersiveVisualizerFrame);
}

function renderImmersiveWaveform(levels, peak = 0.4) {
  const roots = getImmersiveWaveformRoots();
  if (!roots.length || !levels.length) {
    return;
  }

  const width = 360;
  const height = 108;
  const centerY = height / 2;
  const style = state.immersiveVisualizerStyle || DEFAULT_IMMERSIVE_PLAYER_STYLE.visualizer;
  const amplitude = style === "pulse" ? 50 : (style === "ribbon" ? 40 : 44);
  const points = levels.map((level, index) => {
    const x = (index / Math.max(1, levels.length - 1)) * width;
    const styledLevel = style === "pulse"
      ? (level * (0.78 + (Math.abs(level) * 0.38)))
      : level;
    const y = clamp(centerY - (styledLevel * amplitude), 8, height - 8);
    return { x, y };
  });
  const path = buildSmoothWaveformPath(points);
  const fillPath = `${path} L${width.toFixed(1)} ${height.toFixed(1)} L0 ${height.toFixed(1)} Z`;
  const glow = clamp((peak - 0.1) / 0.9, 0, 1).toFixed(3);

  roots.forEach((root) => {
    const waveform = getImmersiveWaveformPartsFromRoot(root);
    if (!waveform.line || !waveform.fill) {
      return;
    }

    waveform.line.setAttribute("d", path);
    waveform.aura?.setAttribute("d", path);
    waveform.runner?.setAttribute("d", path);
    waveform.fill.setAttribute("d", fillPath);
    waveform.root?.style.setProperty("--wave-glow", glow);
  });
}

function buildSmoothWaveformPath(points) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];
    return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }

  const commands = [`M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const cp1x = current.x + ((next.x - previous.x) / 6);
    const cp1y = current.y + ((next.y - previous.y) / 6);
    const cp2x = next.x - ((afterNext.x - current.x) / 6);
    const cp2y = next.y - ((afterNext.y - current.y) / 6);
    commands.push(
      `C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`,
    );
  }

  return commands.join(" ");
}

function getImmersiveWaveformFallbackLevels(pointCount, time, options = {}) {
  return Array.from({ length: pointCount }, (_, index) => getImmersiveVisualizerFallbackLevel(index, pointCount, time, options));
}

function getImmersiveVisualizerAudioStats(timeDomainData = immersiveVisualizerData, frequencyData = immersiveVisualizerFrequencyData) {
  const timeData = timeDomainData || [];
  const freqData = frequencyData || [];
  let sumSquares = 0;
  let signedSum = 0;
  let timePeak = 0;

  for (let index = 0; index < timeData.length; index += 1) {
    const value = ((timeData[index] || 128) - 128) / 128;
    sumSquares += value * value;
    signedSum += value;
    timePeak = Math.max(timePeak, Math.abs(value));
  }

  const rms = timeData.length ? Math.sqrt(sumSquares / timeData.length) : 0;
  let frequencySum = 0;
  let frequencyPeak = 0;

  for (let index = 0; index < freqData.length; index += 1) {
    const value = (freqData[index] || 0) / 255;
    const weighted = Math.pow(value, 1.35);
    frequencySum += weighted;
    frequencyPeak = Math.max(frequencyPeak, value);
  }

  const frequencyEnergy = freqData.length ? frequencySum / freqData.length : 0;
  const bass = getImmersiveVisualizerFrequencyBandEnergy(freqData, 0.004, 0.055);
  const lowMid = getImmersiveVisualizerFrequencyBandEnergy(freqData, 0.055, 0.16);
  const mid = getImmersiveVisualizerFrequencyBandEnergy(freqData, 0.16, 0.38);
  const treble = getImmersiveVisualizerFrequencyBandEnergy(freqData, 0.38, 0.82);
  const energy = clamp(
    Math.pow(
      (rms * 4.2)
        + (timePeak * 0.95)
        + (frequencyEnergy * 2.1)
        + (bass * 0.86)
        + (lowMid * 0.48),
      0.72
    ),
    0,
    1
  );

  immersiveVisualizerLastStats = {
    rms,
    peak: Math.max(timePeak, frequencyPeak),
    timePeak,
    frequencyPeak,
    frequencyEnergy,
    bass,
    lowMid,
    mid,
    treble,
    energy,
    polarity: signedSum >= 0 ? 1 : -1,
  };

  return immersiveVisualizerLastStats;
}

function getImmersiveVisualizerFrequencyBandEnergy(frequencyData, startRatio, endRatio) {
  const data = frequencyData || [];
  if (!data.length) {
    return 0;
  }

  const start = clamp(startRatio, 0, 1);
  const end = clamp(endRatio, start, 1);
  const from = Math.max(0, Math.floor(start * (data.length - 1)));
  const to = Math.max(from + 1, Math.ceil(end * (data.length - 1)));
  let sum = 0;
  let count = 0;

  for (let index = from; index <= Math.min(to, data.length - 1); index += 1) {
    sum += Math.pow((data[index] || 0) / 255, 1.18);
    count += 1;
  }

  return count ? clamp(sum / count, 0, 1) : 0;
}

function isImmersiveVisualizerAudioStatsLive(stats) {
  return Boolean(stats)
    && (
      stats.rms > 0.0045
      || stats.timePeak > 0.018
      || stats.frequencyPeak > 0.035
      || stats.frequencyEnergy > 0.006
    );
}

function getImmersiveVisualizerReactiveLevels(pointCount, time, stats) {
  const data = immersiveVisualizerData;
  const sampleCount = data ? data.length : 0;
  if (!sampleCount) {
    return getImmersiveWaveformFallbackLevels(pointCount, time);
  }

  const window = Math.max(1, Math.floor(sampleCount / pointCount));
  const gain = 0.55 + (stats.energy * 0.95);

  return Array.from({ length: pointCount }, (_, index) => {
    const position = index / Math.max(1, pointCount - 1);
    // 中心高两端柔和收束。
    const envelope = Math.pow(Math.sin(position * Math.PI), 1.2);
    // 对该点附近的时域采样取均值降噪，避免逐采样抖动产生的锯齿。
    const start = Math.floor(position * (sampleCount - window));
    let sum = 0;
    for (let offset = 0; offset < window; offset += 1) {
      sum += (data[start + offset] - 128) / 128;
    }
    const sample = sum / window;
    return clamp(sample * gain * envelope, -1, 1);
  });
}

function getImmersiveVisualizerIncomingLevel(stats, time, offset = 0) {
  const pulse = Math.sin(immersiveVisualizerPhase + (offset * 0.9));
  const subPulse = Math.sin((immersiveVisualizerPhase * 0.47) + (time * 0.84) + offset);
  const punch = Math.pow(clamp((stats.energy * 0.72) + (stats.bass * 0.72) + (stats.lowMid * 0.34), 0, 1), 0.72);
  const air = Math.pow(clamp((stats.mid * 0.48) + (stats.treble * 0.7), 0, 1), 0.8) * 0.28;
  return clamp(((pulse * punch) + (subPulse * air)) * 0.95, -1, 1);
}

function getImmersiveVisualizerDisplayBandEnergy(position, stats) {
  const lowWeight = Math.max(0, 1 - Math.abs(position - 0.22) / 0.32);
  const midWeight = Math.max(0, 1 - Math.abs(position - 0.5) / 0.34);
  const highWeight = Math.max(0, 1 - Math.abs(position - 0.78) / 0.28);
  const weighted = (stats.bass * lowWeight)
    + (stats.lowMid * Math.max(lowWeight, midWeight) * 0.72)
    + (stats.mid * midWeight)
    + (stats.treble * highWeight);
  const weightTotal = lowWeight + (Math.max(lowWeight, midWeight) * 0.72) + midWeight + highWeight;

  return weightTotal ? clamp(weighted / weightTotal, 0, 1) : stats.energy;
}

function getImmersiveVisualizerFallbackLevel(index, pointCount, time = getAudioCurrentTimeSeconds(), options = {}) {
  const position = index / Math.max(1, pointCount - 1);
  // 中心高、两端柔和收束，避免末端突兀。
  const envelope = Math.pow(Math.sin(position * Math.PI), 1.35);
  const idleScale = options.idle ? 0.32 : 0.6;
  // 多层不同速度/波长的正弦缓慢漂移叠加，形成柔和、不重复的流动感。
  const swell = Math.sin((time * 0.6) + (position * Math.PI * 1.4));
  const drift = Math.sin((position * Math.PI * 3.2) - (time * 1.6)) * 0.5;
  const ripple = Math.sin((position * Math.PI * 6.4) - (time * 2.7) + 1.2) * 0.22;
  const shimmer = Math.sin((position * Math.PI * 11.0) - (time * 3.4)) * 0.1;
  // 整体随时间缓慢呼吸，强弱有致。
  const breath = 0.72 + (Math.sin(time * 0.9) * 0.28);
  const wave = ((swell * 0.5) + drift + ripple + shimmer) * envelope * breath;

  return clamp(wave * idleScale, -0.82, 0.82);
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
  syncImmersiveVisualizer();
}

function switchView(view, options = {}) {
  const nextView = viewPanels.some((panel) => panel.dataset.panel === view) ? view : "home";
  const previousView = getActiveView();
  const activeNavigationView = getNavigationView(nextView);
  const isMoreNavigationActive = isMobileMoreNavigationView(activeNavigationView);
  const shouldAutoHideVideo = previousView && previousView !== nextView && !["nowPlaying", "immersivePlayer"].includes(nextView);
  const immersiveShell = immersivePlayerPanel?.querySelector(".immersive-player-shell");

  if (immersiveCloseAnimationTimer) {
    clearTimeout(immersiveCloseAnimationTimer);
    immersiveCloseAnimationTimer = 0;
  }

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
  mobileMoreNavigationButtons.forEach((button) => {
    button.classList.toggle("active", isMoreNavigationActive);
    button.toggleAttribute("aria-current", isMoreNavigationActive);
  });
  document.body.classList.toggle("immersive-player-open", nextView === "immersivePlayer");
  if (previousView === "immersivePlayer" && nextView !== "immersivePlayer") {
    setImmersiveZenMode(false);
    immersivePlayerPanel?.classList.remove("is-page-entering", "is-page-exiting");
    immersiveShell?.classList.remove("is-page-entering", "is-page-exiting");
  }
  if (previousView !== "immersivePlayer" && nextView === "immersivePlayer") {
    immersivePlayerPanel?.classList.remove("is-page-exiting");
    immersiveShell?.classList.remove("is-page-exiting");
    immersivePlayerPanel?.classList.add("is-page-entering");
    immersiveShell?.classList.add("is-page-entering");
    window.setTimeout(() => {
      immersivePlayerPanel?.classList.remove("is-page-entering");
      immersiveShell?.classList.remove("is-page-entering");
    }, 520);
    setMobileImmersiveStageView("cover", { animate: false });
    renderImmersiveVisualizerForCurrentPlaybackState();
    updateImmersiveFullscreenLabel();
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
  if (nextView === "nowPlaying" && state.isLyricSynced) {
    updateLyricsHighlight(getVisibleLyricSyncTimeSeconds(), true);
  }
  renderTopLyricFocus(getCurrentTopLyricLine());
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
  return bridgeOps.normalizeApiUrl(value, externalSourceApi.normalizeApiUrl);
}

function looksLikeSourceBridgeManifestUrl(value) {
  return bridgeOps.looksLikeManifestUrl(value);
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
  serverUrlInput.placeholder = configuredServerUrl ? redact.redactServer(configuredServerUrl) : "http://HOST:PORT";

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

function isSourceBridgeStreamUrl(value) {
  try {
    const parsed = new URL(String(value || ""), location.href);
    if (!isAnySourceBridgePlaybackUrl(parsed)) {
      return false;
    }

    const bridgeUrl = getSessionExternalSourceApiUrl(state.session) || state.externalSourceApiUrl || "";
    if (!bridgeUrl) {
      return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    }

    const bridgeOrigin = new URL(bridgeUrl, location.href).origin;
    return parsed.origin === bridgeOrigin;
  } catch {
    return false;
  }
}

function isAnySourceBridgePlaybackUrl(value) {
  try {
    const parsed = value instanceof URL ? value : new URL(String(value || ""), location.href);
    return ["/plugin-stream", "/remote-stream"].includes(parsed.pathname);
  } catch {
    return false;
  }
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
  // 没有历史选择的新用户默认进入「音源桥」模式
  return normalizeSourceMode(localStorage.getItem(SOURCE_MODE_KEY) || "external");
}

function saveSourceMode(mode) {
  localStorage.setItem(SOURCE_MODE_KEY, normalizeSourceMode(mode));
}

function normalizeLyricsSourceBridgeApiUrl(value) {
  return bridgeOps.normalizeHttpUrl(value, externalSourceApi.normalizeApiUrl);
}

function loadLyricsSourceBridgeApiUrl() {
  return normalizeLyricsSourceBridgeApiUrl(localStorage.getItem(LYRICS_SOURCE_BRIDGE_API_KEY) || "");
}

function saveLyricsSourceBridgeApiUrl(apiUrl) {
  const normalizedApiUrl = normalizeLyricsSourceBridgeApiUrl(apiUrl);

  if (normalizedApiUrl) {
    localStorage.setItem(LYRICS_SOURCE_BRIDGE_API_KEY, normalizedApiUrl);
  } else {
    localStorage.removeItem(LYRICS_SOURCE_BRIDGE_API_KEY);
  }
}

function saveLyricsSourceBridgeApiUrlFromSettings() {
  const rawApiUrl = String(lyricsSourceBridgeApiUrlInput?.value || "").trim();
  const apiUrl = normalizeLyricsSourceBridgeApiUrl(rawApiUrl);

  if (rawApiUrl && !apiUrl) {
    showNotice("歌词源桥地址无效，请填写完整的 http:// 或 https:// 地址。", { type: "warning" });
    lyricsSourceBridgeApiUrlInput?.focus();
    return;
  }

  saveLyricsSourceBridgeApiUrl(apiUrl);
  if (lyricsSourceBridgeApiUrlInput) {
    lyricsSourceBridgeApiUrlInput.value = apiUrl;
  }
  if (settingsLyricsSourceBridgeStatus) {
    settingsLyricsSourceBridgeStatus.textContent = apiUrl ? "已配置" : "未配置";
  }
  showNotice(apiUrl ? "歌词源桥地址已保存。" : "歌词源桥地址已清除。", { type: "success" });
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
  const sessionApiUrl = getExternalSourceApiUrlFromSession(session);

  if (looksLikeSourceBridgeManifestUrl(sessionApiUrl)) {
    saveSourceBridgeManifestUrl(sessionApiUrl);
    return loadExternalSourceApiUrl();
  }

  return isUnconfiguredSourceBridgeUrl(sessionApiUrl)
    ? loadExternalSourceApiUrl()
    : (sessionApiUrl || loadExternalSourceApiUrl());
}

function getResolvedExternalSourceApiUrl(session = state.session) {
  return getSessionExternalSourceApiUrl(session)
    || normalizeExternalSourceApiUrl(state.externalSourceApiUrl || "")
    || loadExternalSourceApiUrl();
}

function syncExternalSourceSessionApiUrl(session = state.session) {
  if (!session || !isExternalSourceSession(session)) {
    return "";
  }

  const apiUrl = getResolvedExternalSourceApiUrl(session);

  if (!apiUrl) {
    return "";
  }

  state.externalSourceApiUrl = apiUrl;

  if (session.serverUrl === apiUrl && session.externalSourceApiUrl === apiUrl) {
    return apiUrl;
  }

  const nextSession = {
    ...session,
    serverUrl: apiUrl,
    externalSourceApiUrl: apiUrl,
  };

  if (state.session === session || state.session?.userId === session.userId) {
    state.session = nextSession;
  }

  return apiUrl;
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
  const value = getExternalSourceApiUrlFromSession(session);
  if (isUnconfiguredSourceBridgeUrl(value) || looksLikeSourceBridgeManifestUrl(value)) {
    return "";
  }

  return normalizeExternalSourceApiUrl(value);
}

function getExternalTrackApiUrl(track, session = state.session) {
  const sessionApiUrl = getSessionExternalSourceApiUrl(session)
    || normalizeExternalSourceApiUrl(state.externalSourceApiUrl || "")
    || loadExternalSourceApiUrl();

  if (sessionApiUrl) {
    return sessionApiUrl;
  }

  const trackApiUrl = track?.ExternalSource?.apiUrl;

  if (!trackApiUrl || isUnconfiguredSourceBridgeUrl(trackApiUrl) || looksLikeSourceBridgeManifestUrl(trackApiUrl)) {
    return "";
  }

  return normalizeExternalSourceApiUrl(trackApiUrl);
}

function getExternalSourceApiUrlFromSession(session) {
  if (!session || !isExternalSourceSession(session)) {
    return "";
  }

  return session.externalSourceApiUrl || session.serverUrl || "";
}

function isUnconfiguredSourceBridgeUrl(value) {
  return bridgeOps.isUnconfiguredUrl(value);
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
      shortLabel: "CHK",
      detailLabel: "正在向音源桥解析真实音质",
    };
  }

  if (qualityState === "unknown") {
    return {
      codec: "",
      isLossless: false,
      isVideo: mediaKind === "video",
      qualityTier: "unknown",
      shortLabel: mediaKind === "video" ? "MV" : "NA",
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
  const safeText = redact.redactText(text);
  message.textContent = safeText;
  message.className = `message ${type}`.trim();
}

function setLibraryStatus(text) {
  const safeText = redact.redactText(text);
  clearStatusDismissTimer();
  libraryStatus.textContent = safeText;

  if (!safeText) {
    hideNotice();
    return;
  }

  if (shouldAutoDismissStatus(safeText)) {
    scheduleStatusDismiss(safeText);
  }
}

function showNotice(text, options = {}) {
  const safeText = redact.redactText(text);
  clearNoticeDismissTimer();
  clearStatusDismissTimer();
  appNoticeText.textContent = safeText;
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
  libraryStatus.textContent = safeText;

  if (!actions.length && options.autoDismiss !== false && shouldAutoDismissNotice(options)) {
    noticeDismissTimer = window.setTimeout(() => {
      if (appNoticeText.textContent === safeText) {
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
  const tracks = storage.loadRecentTracks(session);
  tracks.forEach(markRestoredQueueTrackForFreshResolve);
  return tracks;
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
  const queueState = storage.loadQueueState(session);

  if (Array.isArray(queueState.queue)) {
    queueState.queue.forEach(markRestoredQueueTrackForFreshResolve);
  }

  if (queueState.currentTrack) {
    markRestoredQueueTrackForFreshResolve(queueState.currentTrack);
  }

  return queueState;
}

async function hydrateQueueStateFromIndexedDb(session, initialSavedAt = "") {
  if (!session || !storage.loadQueueStateAsync) {
    return;
  }

  const expectedUserId = session.userId;
  const expectedMode = getSessionSourceMode(session);
  const queueState = await storage.loadQueueStateAsync(session);
  if (
    state.session?.userId !== expectedUserId
    || getSessionSourceMode(state.session) !== expectedMode
    || state.queueSavedAt !== initialSavedAt
    || !queueState.queue.length
  ) {
    return;
  }

  queueState.queue.forEach(markRestoredQueueTrackForFreshResolve);
  if (queueState.currentTrack) {
    markRestoredQueueTrackForFreshResolve(queueState.currentTrack);
  }

  state.queue = queueState.queue;
  state.currentTrackIndex = queueState.currentTrackIndex;
  state.currentTrack = queueState.currentTrack;
  state.savedPlaybackPositionSeconds = queueState.positionSeconds;
  state.queueSavedAt = queueState.savedAt;
  state.lastQueuePositionSaveSeconds = queueState.positionSeconds || 0;
  setPlayerEnabled(Boolean(state.queue.length));
  renderQueue();
  renderNowPlaying();
  renderPlayerNextPreview();
  renderRestoredPlaybackProgress(state.currentTrack);
  if (state.currentTrack) {
    updatePlayerMeta(state.currentTrack);
  }
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
  return playerOps.getPlaybackPosition(audioPlayer, state.savedPlaybackPositionSeconds);
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
    ExternalSource: sanitizeExternalSourceForPersistence(track.ExternalSource, track),
  };
}

function sanitizeExternalSourceForPersistence(external, track = null) {
  if (!external || typeof external !== "object") {
    return external;
  }

  const restore = createExternalRestoreSnapshotForPersistence(external, track);
  const isRestorablePlugin = isRestorableExternalSourcePlugin(external, restore);
  return {
    apiUrl: external.apiUrl,
    id: external.id,
    platform: external.platform,
    pluginKey: restore?.pluginKey || external.pluginKey,
    pluginName: restore?.pluginName || external.pluginName,
    pluginUrl: restore?.pluginUrl || external.pluginUrl,
    pluginPlatform: restore?.pluginPlatform || external.pluginPlatform,
    sourceId: restore?.sourceId || external.sourceId,
    mediaKind: external.mediaKind || restore?.mediaKind,
    isVideo: external.isVideo,
    codec: external.codec,
    bitrate: external.bitrate,
    sourceQuality: external.sourceQuality || restore?.sourceQuality,
    qualityLabel: external.qualityLabel || restore?.qualityLabel,
    resolution: external.resolution || restore?.resolution,
    qualityState: external.qualityState,
    qualityVerified: Boolean(external.qualityVerified || restore?.qualityVerified),
    contentType: external.contentType,
    artwork: external.artwork,
    mediaUrl: isRestorablePlugin ? "" : external.mediaUrl,
    bridgeStreamUrl: "",
    directUrl: "",
    lyric: external.lyric,
    lyrics: external.lyrics,
    raw: getExternalSourceRawForPersistence(external.raw, restore),
    restore,
  };
}

function createExternalRestoreSnapshotForPersistence(external, track = null) {
  if (!external || typeof external !== "object") {
    return null;
  }

  const restore = sanitizeExternalRestoreSnapshot(external.restore);
  const pluginIdParts = getExternalPluginIdPartsForPersistence(external, track);
  const pluginMeta = getExternalPluginMetaForPersistence(external.raw);
  const raw = getExternalPluginRestoreRawForPersistence(external.raw, restore)
    || createExternalPluginFallbackRawForPersistence(external, restore, pluginIdParts, track);
  const sourceId = restore?.sourceId
    || pluginMeta.sourceId
    || external.sourceId
    || pluginIdParts.sourceId
    || getExternalPluginRawSourceIdForPersistence(raw)
    || "";
  const pluginKey = restore?.pluginKey
    || pluginMeta.pluginKey
    || external.pluginKey
    || pluginIdParts.pluginKey
    || "";
  const pluginUrl = restore?.pluginUrl || pluginMeta.pluginUrl || external.pluginUrl || "";
  const pluginName = restore?.pluginName || pluginMeta.pluginName || external.pluginName || external.platform || "";
  const pluginPlatform = restore?.pluginPlatform || pluginMeta.pluginPlatform || external.pluginPlatform || external.platform || "";

  if ((!pluginKey && !pluginUrl && !pluginName && !pluginPlatform) || !raw) {
    return restore;
  }

  return {
    id: restore?.id || sourceId || external.id || "",
    pluginKey,
    pluginName,
    pluginUrl,
    pluginPlatform,
    sourceId,
    mediaKind: restore?.mediaKind || pluginMeta.mediaKind || external.mediaKind || "",
    sourceQuality: restore?.sourceQuality || pluginMeta.sourceQuality || external.sourceQuality || "",
    qualityLabel: restore?.qualityLabel || pluginMeta.qualityLabel || external.qualityLabel || "",
    resolution: restore?.resolution || pluginMeta.resolution || external.resolution || "",
    qualityVerified: Boolean(restore?.qualityVerified || pluginMeta.qualityVerified || external.qualityVerified),
    raw,
  };
}

function isRestorableExternalSourcePlugin(external, restore = null) {
  return Boolean(
    String(external?.id || "").startsWith("plugin:")
      || external?.pluginKey
      || external?.pluginUrl
      || restore?.pluginKey
      || restore?.pluginUrl
      || external?.raw?.pluginKey
      || external?.raw?.pluginUrl
      || external?.raw?.raw?.pluginKey
      || external?.raw?.raw?.pluginUrl
      || external?.raw?.restore?.pluginKey
      || external?.raw?.restore?.pluginUrl
      || external?.raw?.data?.restore?.pluginKey
      || external?.raw?.data?.restore?.pluginUrl
  );
}

function sanitizeExternalRestoreSnapshot(restore) {
  if (!restore || typeof restore !== "object" || !restore.raw || typeof restore.raw !== "object") {
    return null;
  }

  return {
    id: restore.id || restore.sourceId || "",
    pluginKey: restore.pluginKey || "",
    pluginName: restore.pluginName || "",
    pluginUrl: restore.pluginUrl || "",
    pluginPlatform: restore.pluginPlatform || "",
    sourceId: restore.sourceId || restore.id || "",
    mediaKind: restore.mediaKind || "",
    sourceQuality: restore.sourceQuality || "",
    qualityLabel: restore.qualityLabel || "",
    resolution: restore.resolution || "",
    qualityVerified: Boolean(restore.qualityVerified),
    raw: restore.raw,
  };
}

function getExternalSourceRawForPersistence(raw, restore) {
  if (restore?.raw) {
    return {
      pluginKey: restore.pluginKey,
      pluginName: restore.pluginName,
      pluginUrl: restore.pluginUrl,
      pluginPlatform: restore.pluginPlatform,
      sourceId: restore.sourceId,
      mediaKind: restore.mediaKind,
      sourceQuality: restore.sourceQuality,
      qualityLabel: restore.qualityLabel,
      resolution: restore.resolution,
      qualityVerified: Boolean(restore.qualityVerified),
      raw: restore.raw,
    };
  }

  return raw;
}

function getExternalPluginMetaForPersistence(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  if (raw.pluginKey) {
    return raw;
  }

  if (raw.raw && typeof raw.raw === "object" && raw.raw.pluginKey) {
    return raw.raw;
  }

  if (raw.restore && typeof raw.restore === "object" && raw.restore.pluginKey) {
    return raw.restore;
  }

  if (raw.data?.restore && typeof raw.data.restore === "object" && raw.data.restore.pluginKey) {
    return raw.data.restore;
  }

  return {};
}

function getExternalPluginRestoreRawForPersistence(raw, restore = {}) {
  if (restore?.raw && typeof restore.raw === "object" && !looksLikeMediaPayloadOnlyForPersistence(restore.raw)) {
    return restore.raw;
  }

  if (!raw || typeof raw !== "object") {
    return null;
  }

  if (raw.restore?.raw && typeof raw.restore.raw === "object" && !looksLikeMediaPayloadOnlyForPersistence(raw.restore.raw)) {
    return raw.restore.raw;
  }

  if (raw.data?.restore?.raw && typeof raw.data.restore.raw === "object" && !looksLikeMediaPayloadOnlyForPersistence(raw.data.restore.raw)) {
    return raw.data.restore.raw;
  }

  if (raw.raw && typeof raw.raw === "object" && raw.raw.pluginKey && raw.raw.raw && typeof raw.raw.raw === "object") {
    return raw.raw.raw;
  }

  if (raw.raw && typeof raw.raw === "object" && !raw.raw.pluginKey && !looksLikeMediaPayloadOnlyForPersistence(raw.raw)) {
    return raw.raw;
  }

  if (raw.track && typeof raw.track === "object") {
    return raw.track;
  }

  if (raw.originalTrack && typeof raw.originalTrack === "object") {
    return raw.originalTrack;
  }

  if (raw.sourceTrack && typeof raw.sourceTrack === "object") {
    return raw.sourceTrack;
  }

  if (raw.item && typeof raw.item === "object") {
    return raw.item;
  }

  if (raw.song && typeof raw.song === "object") {
    return raw.song;
  }

  if (raw.media && typeof raw.media === "object" && !looksLikeMediaPayloadOnlyForPersistence(raw.media)) {
    return raw.media;
  }

  return looksLikeMediaPayloadOnlyForPersistence(raw) ? null : raw;
}

function createExternalPluginFallbackRawForPersistence(external, restore = {}, pluginIdParts = {}, track = null) {
  const sourceId = restore?.sourceId
    || external?.sourceId
    || pluginIdParts.sourceId
    || getExternalPluginRawSourceIdForPersistence(external?.raw)
    || "";

  if (!sourceId) {
    return null;
  }

  const title = pickExternalPersistenceString(
    track?.Name,
    external.title,
    external.name,
    external.raw?.title,
    external.raw?.name,
    external.raw?.songName,
  );
  const artist = pickExternalPersistenceString(
    Array.isArray(track?.Artists) ? track.Artists.join(", ") : "",
    track?.AlbumArtist,
    external.artist,
    external.singer,
    external.raw?.artist,
    external.raw?.singer,
    external.raw?.author,
  );

  return {
    id: sourceId,
    Id: sourceId,
    sourceId,
    mid: sourceId,
    songmid: sourceId,
    hash: sourceId,
    rid: sourceId,
    songId: sourceId,
    title,
    name: title,
    songName: title,
    artist,
    singer: artist,
    author: artist,
  };
}

function getExternalPluginRawSourceIdForPersistence(raw) {
  if (!raw || typeof raw !== "object") {
    return "";
  }

  return pickExternalPersistenceString(
    raw.sourceId,
    raw.id,
    raw.Id,
    raw.mid,
    raw.songmid,
    raw.hash,
    raw.rid,
    raw.songId,
    raw.raw?.sourceId,
    raw.raw?.id,
    raw.raw?.Id,
    raw.raw?.mid,
    raw.raw?.songmid,
    raw.raw?.hash,
    raw.raw?.rid,
    raw.raw?.songId,
    raw.restore?.sourceId,
    raw.restore?.id,
    raw.data?.restore?.sourceId,
    raw.data?.restore?.id,
  );
}

function getExternalPluginIdPartsForPersistence(external = {}, track = null) {
  const candidates = [
    external.id,
    external.sourceId,
    external.restore?.id,
    external.restore?.sourceId,
    external.raw?.id,
    external.raw?.sourceId,
    external.raw?.raw?.id,
    external.raw?.raw?.sourceId,
    stripExternalTrackPrefixForPersistence(track?.Id),
  ].map((item) => String(item || "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    const match = candidate.match(/^plugin:([^:]+):(.+)$/);

    if (match) {
      return {
        pluginKey: match[1],
        sourceId: decodeURIComponentSafe(match[2]),
      };
    }
  }

  return {
    pluginKey: "",
    sourceId: "",
  };
}

function looksLikeMediaPayloadOnlyForPersistence(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const playableUrl = pickExternalPersistenceString(value.url, value.streamUrl, value.src, value.playUrl, value.play_url, value.location, value.link);
  const trackText = pickExternalPersistenceString(value.name, value.title, value.songName, value.artist, value.singer, value.author, value.album, value.albumName);

  return Boolean(
    playableUrl
      && !trackText
      && !value.restore
      && !value.data?.restore
      && !value.track
      && !value.originalTrack
      && !value.sourceTrack
      && !value.item
      && !value.song
  );
}

function pickExternalPersistenceString(...values) {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim());
  return value === undefined ? "" : String(value).trim();
}

function stripExternalTrackPrefixForPersistence(id) {
  const value = String(id || "");

  if (value.startsWith("external:plugin:")) {
    return value.slice("external:".length);
  }

  return value.replace(/^external:[^:]+:/, "");
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
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
  state.totalPlaylistTracks = 0;
  state.hasMorePlaylistTracks = false;
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
  return redact.redactText(error instanceof Error ? error.message : "操作失败，请稍后重试。");
}
