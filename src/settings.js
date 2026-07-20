export function normalizeLyricSettings(settings = {}, options = {}) {
  const defaults = options.defaults || {};
  const fontFamilies = options.fontFamilies || {};
  const clamp = options.clamp || ((value, min, max) => Math.min(max, Math.max(min, value)));
  const fontScale = Number(settings?.fontScale);
  const letterSpacing = Number(settings?.letterSpacing);

  return {
    fontScale: Math.round(clamp(Number.isFinite(fontScale) ? fontScale : defaults.fontScale, 0.85, 1.25) * 100) / 100,
    fontFamily: fontFamilies[settings?.fontFamily] ? settings.fontFamily : defaults.fontFamily,
    letterSpacing: Math.round(clamp(Number.isFinite(letterSpacing) ? letterSpacing : defaults.letterSpacing, 0, 12) * 10) / 10,
    autoScroll: settings?.autoScroll !== false,
    autoImmersiveLyrics: settings?.autoImmersiveLyrics === true,
  };
}

export function normalizePlaybackDisplaySettings(settings = {}, options = {}) {
  const defaults = options.defaults || {};
  const rates = options.rates || [];
  const effects = options.effects || [];
  const playbackRate = rates.includes(Number(settings?.playbackRate))
    ? Number(settings.playbackRate)
    : defaults.playbackRate;
  const soundEffect = effects.some((option) => option.id === settings?.soundEffect)
    ? settings.soundEffect
    : defaults.soundEffect;

  return {
    volumeLeveling: Boolean(settings?.volumeLeveling),
    backgroundMix: Boolean(settings?.backgroundMix),
    fadeInOut: Boolean(settings?.fadeInOut),
    smartTransition: settings?.smartTransition === undefined ? defaults.smartTransition : Boolean(settings.smartTransition),
    soundEffect,
    playbackRate,
  };
}

export function normalizeThemePreference(value, fallback = "system") {
  return ["light", "dark", "system"].includes(value) ? value : fallback;
}

export function normalizeSleepFadeSeconds(value, fallback = 30) {
  const numeric = Number(value);
  return [30, 60, 90].includes(numeric) ? numeric : fallback;
}
