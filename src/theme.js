window.EmbyMusicTheme = (function () {
  "use strict";

  const THEME_KEY = "emby-music-web/theme";
  const THEME_TRANSITION_CLASS = "theme-transitioning";

  const themes = {
    light: {
      page: "#f9fafb",
      surface: "#ffffff",
      "surface-solid": "#ffffff",
      sidebar: "#f8fafc",
      "soft-panel": "#ffffff",
      line: "rgba(31, 31, 36, 0.08)",
      text: "#111827",
      muted: "#6b7280",
      soft: "#9ca3af",
      red: "#ff2f3d",
      "red-deep": "#e92531",
      orange: "#ff9d42",
      yellow: "#f6c453",
      green: "#38c978",
      blue: "#2563eb",
      purple: "#8b5cf6",
      teal: "#14b8a6",
      danger: "#ff4d5e",
    },
    dark: {
      page: "#0f172a",
      surface: "#1e293b",
      "surface-solid": "#1e293b",
      sidebar: "#1e293b",
      "soft-panel": "#334155",
      line: "rgba(255, 255, 255, 0.1)",
      text: "#f1f5f9",
      muted: "#94a3b8",
      soft: "#64748b",
      red: "#ff4d5e",
      "red-deep": "#ff3344",
      orange: "#fb923c",
      yellow: "#fbbf24",
      green: "#4ade80",
      blue: "#3b82f6",
      purple: "#a78bfa",
      teal: "#2dd4bf",
      danger: "#ff5566",
    },
  };

  let currentTheme = "light";
  let systemThemeListener = null;

  function init() {
    const savedTheme = loadTheme();
    applyTheme(savedTheme);
    setupSystemThemeListener();

    console.log("[Theme] 主题系统已初始化，当前主题:", savedTheme);
  }

  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);

    if (saved === "auto") {
      return getSystemTheme();
    }

    return saved || "light";
  }

  function saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme, withTransition = false) {
    if (theme === "auto") {
      theme = getSystemTheme();
    }

    if (theme !== "light" && theme !== "dark") {
      console.warn("[Theme] 无效的主题:", theme);
      theme = "light";
    }

    currentTheme = theme;
    const root = document.documentElement;

    if (withTransition) {
      root.classList.add(THEME_TRANSITION_CLASS);
    }

    root.setAttribute("data-theme", theme);

    const colors = themes[theme];
    Object.keys(colors).forEach((key) => {
      root.style.setProperty(`--${key}`, colors[key]);
    });

    if (withTransition) {
      setTimeout(() => {
        root.classList.remove(THEME_TRANSITION_CLASS);
      }, 300);
    }

    document.body.className = document.body.className.replace(/theme-\w+/g, "");
    document.body.classList.add(`theme-${theme}`);

    dispatchThemeChangeEvent(theme);
  }

  function setTheme(theme) {
    saveTheme(theme);
    applyTheme(theme === "auto" ? getSystemTheme() : theme, true);

    console.log("[Theme] 切换主题:", theme);
  }

  function getCurrentTheme() {
    return currentTheme;
  }

  function getSavedThemePreference() {
    return localStorage.getItem(THEME_KEY) || "light";
  }

  function setupSystemThemeListener() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const listener = (e) => {
      const saved = getSavedThemePreference();
      if (saved === "auto") {
        const newTheme = e.matches ? "dark" : "light";
        applyTheme(newTheme, true);
        console.log("[Theme] 系统主题变化，切换到:", newTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", listener);
    } else {
      mediaQuery.addListener(listener);
    }

    systemThemeListener = listener;
  }

  function dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent("themechange", {
      detail: { theme },
    });
    window.dispatchEvent(event);
  }

  function onThemeChange(callback) {
    window.addEventListener("themechange", (e) => {
      callback(e.detail.theme);
    });
  }

  function toggleTheme() {
    const current = getSavedThemePreference();
    const next = current === "light" ? "dark" : "light";
    setTheme(next);
  }

  function getThemeColors(theme) {
    if (theme === "auto") {
      theme = getSystemTheme();
    }
    return themes[theme] || themes.light;
  }

  function isDarkMode() {
    return currentTheme === "dark";
  }

  return {
    init,
    setTheme,
    toggleTheme,
    getCurrentTheme,
    getSavedThemePreference,
    onThemeChange,
    getThemeColors,
    isDarkMode,
  };
})();
