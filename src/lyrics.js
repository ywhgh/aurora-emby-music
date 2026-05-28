(() => {
function extractLyricsText(track) {
  const directText = [
    track?.Lyrics,
    track?.Lyric,
    track?.LyricsText,
    track?.UserData?.Lyrics,
  ].find((value) => typeof value === "string" && value.trim());

  if (directText) {
    return directText;
  }

  const candidates = [];

  (track?.MediaSources || []).forEach((source) => {
    [
      ...(source.MediaStreams || []),
      ...(source.Attachments || []),
      ...(source.MediaAttachments || []),
    ].forEach((entry) => {
      candidates.push(entry);
    });
  });

  const lyricsEntry = candidates.find((entry) => {
    const title = String(entry?.Title || entry?.DisplayTitle || entry?.FileName || entry?.Path || "").toLowerCase();
    const codec = String(entry?.Codec || entry?.MimeType || "").toLowerCase();
    const type = String(entry?.Type || "").toLowerCase();
    const hasText = typeof entry?.Extradata === "string" || typeof entry?.Data === "string" || typeof entry?.Text === "string";

    return hasText && (
      title.includes("lyric")
      || title.includes("lrc")
      || codec === "text"
      || codec.includes("lrc")
      || type === "attachment"
    );
  });

  return [
    lyricsEntry?.Extradata,
    lyricsEntry?.Data,
    lyricsEntry?.Text,
  ].find((value) => typeof value === "string" && value.trim()) || "";
}

function parseLyrics(text) {
  const rawLines = String(text || "").split(/\r?\n/);
  const timedLines = [];
  const plainLines = [];
  const timePattern = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const metadataPattern = /^\[[a-z]+:.+\]$/i;

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line || metadataPattern.test(line)) {
      return;
    }

    const matches = [...line.matchAll(timePattern)];
    const textPart = line.replace(timePattern, "").trim();
    const lyricText = parseLyricTextPart(textPart);

    if (!matches.length) {
      plainLines.push({ time: null, ...parseLyricTextPart(line) });
      return;
    }

    matches.forEach((match) => {
      const hours = Number(match[1] || 0);
      const minutes = Number(match[2] || 0);
      const seconds = Number(match[3] || 0);
      const fraction = match[4] ? Number(`0.${match[4].padEnd(3, "0").slice(0, 3)}`) : 0;
      timedLines.push({
        time: hours * 3600 + minutes * 60 + seconds + fraction,
        ...lyricText,
      });
    });
  });

  if (timedLines.length) {
    return {
      isSynced: true,
      lines: mergeBilingualTimedLines(timedLines),
    };
  }

  return {
    isSynced: false,
    lines: plainLines,
  };
}

function parseLyricTextPart(text) {
  return splitInlineBilingualText(text) || { text: String(text || "").trim() };
}

function splitInlineBilingualText(text) {
  const value = String(text || "").trim();

  if (!value) {
    return null;
  }

  const separators = [
    /\s*\/\/\s*/,
    /\s*[|｜]\s*/,
    /\s+\/\s+/,
  ];

  for (const separator of separators) {
    const parts = value.split(separator).map((part) => part.trim()).filter(Boolean);

    if (parts.length === 2) {
      const result = buildBilingualLine(parts);

      if (result) {
        return result;
      }
    }
  }

  return null;
}

function buildBilingualLine(parts) {
  const hasChineseTranslation = parts.some((part) => isLikelyChineseText(part));
  const allChinese = parts.every((part) => isLikelyChineseText(part));

  if (!hasChineseTranslation || allChinese) {
    return null;
  }

  const translatedText = findTranslatedText(parts);
  const originalText = parts
    .filter((part) => part !== translatedText)
    .join(" / ");

  if (!translatedText || !originalText) {
    return null;
  }

  return {
    text: translatedText,
    originalText,
  };
}

function mergeBilingualTimedLines(lines) {
  const groups = new Map();

  lines
    .filter((line) => line.text)
    .sort((left, right) => left.time - right.time)
    .forEach((line) => {
      const key = String(Math.round(line.time * 100));
      const group = groups.get(key) || [];
      group.push(line);
      groups.set(key, group);
    });

  return [...groups.values()].map((group) => {
    const texts = [];

    group.forEach((line) => {
      appendUniqueText(texts, line.originalText);
      appendUniqueText(texts, line.text);
    });

    if (texts.length <= 1) {
      return { time: group[0].time, text: texts[0] || "" };
    }

    const translatedText = findTranslatedText(texts);
    const originalText = texts
      .filter((value) => value !== translatedText)
      .join(" / ");

    return {
      time: group[0].time,
      text: translatedText,
      originalText,
    };
  }).filter((line) => line.text);
}

function appendUniqueText(texts, value) {
  const text = String(value || "").trim();

  if (text && !texts.includes(text)) {
    texts.push(text);
  }
}

function hasCjkText(value) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ""));
}

function findTranslatedText(texts) {
  const chineseCandidates = texts.filter((value) => isLikelyChineseText(value));

  if (chineseCandidates.length) {
    return chineseCandidates[chineseCandidates.length - 1];
  }

  return texts[texts.length - 1] || texts[0] || "";
}

function isLikelyChineseText(value) {
  const text = String(value || "");

  return hasCjkText(text) && !hasJapaneseKana(text) && !hasHangul(text);
}

function hasJapaneseKana(value) {
  return /[\u3040-\u30ff]/.test(String(value || ""));
}

function hasHangul(value) {
  return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(String(value || ""));
}

window.EmbyMusicLyrics = {
  extractLyricsText,
  parseLyrics,
};
})();
