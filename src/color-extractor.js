window.EmbyMusicColorExtractor = (function () {
  "use strict";

  const CACHE_KEY_PREFIX = "emby-music-web/cover-colors/";
  const CACHE_MAX_SIZE = 100;

  const colorCache = new Map();

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function isColorVibrant(r, g, b) {
    const hsl = rgbToHsl(r, g, b);
    return hsl.s > 40 && hsl.l > 20 && hsl.l < 80;
  }

  async function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => resolve(img);
      img.onerror = reject;

      img.src = url;
    });
  }

  async function extractColorsFromImage(imageUrl) {
    const cacheKey = CACHE_KEY_PREFIX + imageUrl;

    if (colorCache.has(cacheKey)) {
      return colorCache.get(cacheKey);
    }

    const cachedColors = localStorage.getItem(cacheKey);
    if (cachedColors) {
      try {
        const colors = JSON.parse(cachedColors);
        colorCache.set(cacheKey, colors);
        return colors;
      } catch (e) {
        console.warn("[ColorExtractor] 缓存解析失败:", e);
      }
    }

    try {
      const img = await loadImage(imageUrl);
      const colors = await analyzeImage(img);

      cacheColors(cacheKey, colors);

      return colors;
    } catch (error) {
      console.error("[ColorExtractor] 提取颜色失败:", error);
      return getDefaultColors();
    }
  }

  function analyzeImage(img) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const size = 100;
      canvas.width = size;
      canvas.height = size;

      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      const colorMap = new Map();

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 128) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 250 || brightness < 10) continue;

        const key = `${Math.floor(r / 10)}-${Math.floor(g / 10)}-${Math.floor(b / 10)}`;

        if (!colorMap.has(key)) {
          colorMap.set(key, { r, g, b, count: 0 });
        }

        colorMap.get(key).count++;
      }

      const sortedColors = Array.from(colorMap.values()).sort(
        (a, b) => b.count - a.count
      );

      const vibrantColors = sortedColors.filter((c) =>
        isColorVibrant(c.r, c.g, c.b)
      );

      const primary = vibrantColors[0] || sortedColors[0] || { r: 236, g: 65, b: 65 };
      const secondary = vibrantColors[1] || sortedColors[1] || { r: 255, g: 126, b: 96 };
      const accent = vibrantColors[2] || sortedColors[2] || { r: 255, g: 77, b: 94 };

      const colors = {
        primary: rgbToHex(primary.r, primary.g, primary.b),
        primaryRgb: `${primary.r}, ${primary.g}, ${primary.b}`,
        secondary: rgbToHex(secondary.r, secondary.g, secondary.b),
        secondaryRgb: `${secondary.r}, ${secondary.g}, ${secondary.b}`,
        accent: rgbToHex(accent.r, accent.g, accent.b),
        accentRgb: `${accent.r}, ${accent.g}, ${accent.b}`,
        isDark: getLuminance(primary.r, primary.g, primary.b) < 0.5,
      };

      resolve(colors);
    });
  }

  function cacheColors(key, colors) {
    colorCache.set(key, colors);

    if (colorCache.size > CACHE_MAX_SIZE) {
      const firstKey = colorCache.keys().next().value;
      colorCache.delete(firstKey);
      localStorage.removeItem(firstKey);
    }

    try {
      localStorage.setItem(key, JSON.stringify(colors));
    } catch (e) {
      console.warn("[ColorExtractor] 缓存保存失败:", e);
    }
  }

  function getDefaultColors() {
    return {
      primary: "#ec4141",
      primaryRgb: "236, 65, 65",
      secondary: "#ff7e60",
      secondaryRgb: "255, 126, 96",
      accent: "#ff4d5e",
      accentRgb: "255, 77, 94",
      isDark: false,
    };
  }

  function applyColorsToTheme(colors) {
    const root = document.documentElement;

    root.style.setProperty("--now-accent", colors.primary);
    root.style.setProperty("--now-accent-deep", colors.accent);
    root.style.setProperty("--now-accent-rgb", colors.primaryRgb);
    root.style.setProperty("--accent-color", colors.primary);
    root.style.setProperty("--accent-color-rgb", colors.primaryRgb);
    root.style.setProperty("--album-ambient-rgb", colors.primaryRgb);
    root.style.setProperty("--album-ambient-rgb-alt", colors.secondaryRgb);
  }

  function resetThemeColors() {
    const defaultColors = getDefaultColors();
    applyColorsToTheme(defaultColors);
  }

  async function extractAndApply(imageUrl) {
    try {
      const colors = await extractColorsFromImage(imageUrl);
      applyColorsToTheme(colors);

      console.log("[ColorExtractor] 已应用主题色:", colors.primary);

      return colors;
    } catch (error) {
      console.error("[ColorExtractor] 应用主题色失败:", error);
      resetThemeColors();
      return getDefaultColors();
    }
  }

  function createGradientBackground(colors) {
    return `
      radial-gradient(circle at 20% 30%, rgba(${colors.primaryRgb}, 0.15), transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(${colors.secondaryRgb}, 0.1), transparent 50%),
      var(--page)
    `;
  }

  function getContrastTextColor(colors) {
    const rgb = hexToRgb(colors.primary);
    if (!rgb) return "#ffffff";

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  function clearCache() {
    colorCache.clear();

    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    console.log("[ColorExtractor] 缓存已清空");
  }

  return {
    extractColorsFromImage,
    applyColorsToTheme,
    resetThemeColors,
    extractAndApply,
    createGradientBackground,
    getContrastTextColor,
    getDefaultColors,
    clearCache,
  };
})();
