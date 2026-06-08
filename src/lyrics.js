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
  const rawText = String(text || "");
  const ttmlLyrics = parseTtmlLyrics(rawText);

  if (ttmlLyrics) {
    return ttmlLyrics;
  }

  const rawLines = rawText.split(/\r?\n/);
  const yrcLyrics = parseYrcLyrics(rawLines);

  if (yrcLyrics) {
    return yrcLyrics;
  }

  const timedLines = [];
  const plainLines = [];
  const timePattern = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const inlineTimePattern = /<((?:(?:\d{1,2}:){1,2})?\d{1,2}(?:[.:]\d{1,3})?)>/g;
  const metadataPattern = /^\[[a-z]+:.+\]$/i;
  const offsetSeconds = findLyricOffsetSeconds(rawLines);

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      return;
    }

    if (isLyricOffsetLine(line)) {
      return;
    }

    if (metadataPattern.test(line)) {
      return;
    }

    const matches = [...line.matchAll(timePattern)];
    const textPart = line.replace(timePattern, "").trim();
    const wordTimeline = parseInlineLyricWordTimeline(textPart, inlineTimePattern);
    const lyricText = parseLyricTextPart(wordTimeline.text);

    if (!matches.length) {
      plainLines.push({ time: null, ...parseLyricTextPart(line.replace(inlineTimePattern, "")) });
      return;
    }

    matches.forEach((match) => {
      const hours = Number(match[1] || 0);
      const minutes = Number(match[2] || 0);
      const seconds = Number(match[3] || 0);
      const fraction = match[4] ? Number(`0.${match[4].padEnd(3, "0").slice(0, 3)}`) : 0;
      const baseTime = hours * 3600 + minutes * 60 + seconds + fraction;
      const words = normalizeInlineLyricWordTimeline(wordTimeline.words, baseTime);
      const lyricPayload = words.length
        ? { ...lyricText, wordTimeline: words }
        : lyricText;
      timedLines.push({
        time: applySourceLyricOffsetSeconds(baseTime, offsetSeconds),
        ...applyLyricPayloadSourceOffset(lyricPayload, offsetSeconds),
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

function parseYrcLyrics(rawLines) {
  const lines = [];
  const linePattern = /^\[(\d+),(\d+)\](.+)$/;

  rawLines.forEach((rawLine) => {
    const line = String(rawLine || "").trim();
    const match = line.match(linePattern);

    if (!match) {
      return;
    }

    const lineStartMs = Number(match[1]);
    const lineDurationMs = Number(match[2]);
    const body = match[3] || "";
    const parsedLine = parseYrcLineBody(body, lineStartMs, lineDurationMs);

    if (!parsedLine.text || !parsedLine.wordTimeline.length) {
      return;
    }

    lines.push({
      time: lineStartMs / 1000,
      text: parsedLine.text,
      wordTimeline: parsedLine.wordTimeline,
      ...(Number.isFinite(lineDurationMs) && lineDurationMs > 0 ? { endTime: (lineStartMs + lineDurationMs) / 1000 } : {}),
    });
  });

  if (!lines.length) {
    return null;
  }

  return {
    isSynced: true,
    lines: mergeBilingualTimedLines(lines),
  };
}

function parseYrcLineBody(body, lineStartMs, lineDurationMs) {
  const wordPattern = /\((\d+),(\d+)(?:,\d+)?\)([^(]*)/g;
  const rawWords = [];
  let match;

  while ((match = wordPattern.exec(String(body || "")))) {
    const startMs = Number(match[1]);
    const wordValue = String(match[3] || "");

    if (!wordValue.trim()) {
      continue;
    }

    rawWords.push({
      startMs,
      durationMs: Number(match[2]),
      value: wordValue,
    });
  }

  const useAbsoluteWordTimes = shouldUseAbsoluteYrcWordTimes(rawWords, lineStartMs, lineDurationMs);
  const words = rawWords.map((word) => ({
    time: (useAbsoluteWordTimes ? word.startMs : lineStartMs + word.startMs) / 1000,
    ...(Number.isFinite(word.durationMs) && word.durationMs > 0
      ? { endTime: ((useAbsoluteWordTimes ? word.startMs : lineStartMs + word.startMs) + word.durationMs) / 1000 }
      : {}),
    value: word.value,
  }));

  return {
    text: words.map((word) => word.value).join("").trim(),
    wordTimeline: words,
  };
}

function shouldUseAbsoluteYrcWordTimes(words, lineStartMs, lineDurationMs) {
  if (!words.length || !Number.isFinite(lineStartMs) || lineStartMs <= 0) {
    return false;
  }

  const starts = words.map((word) => Number(word.startMs)).filter(Number.isFinite);
  const minStart = Math.min(...starts);
  const maxStart = Math.max(...starts);

  return minStart >= lineStartMs
    && Number.isFinite(lineDurationMs)
    && lineDurationMs > 0
    && maxStart > lineDurationMs;
}

function parseTtmlLyrics(text) {
  const value = String(text || "").trim();

  if (!/<(?:tt|p|span)\b/i.test(value) || !/<p\b/i.test(value)) {
    return null;
  }

  const lines = [];
  const paragraphPattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;

  while ((match = paragraphPattern.exec(value))) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    const lineStart = parseTtmlTime(readXmlAttribute(attrs, "begin") || readXmlAttribute(attrs, "start"));
    const lineEnd = parseTtmlTime(readXmlAttribute(attrs, "end"));
    const parsedLine = parseTtmlParagraph(body, lineStart, lineEnd);

    if (parsedLine?.text) {
      lines.push(parsedLine);
    }
  }

  if (!lines.length) {
    return null;
  }

  return {
    isSynced: true,
    lines: mergeBilingualTimedLines(lines),
  };
}

function parseTtmlParagraph(body, lineStart, lineEnd) {
  const spans = [];
  const spanPattern = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
  let match;

  while ((match = spanPattern.exec(body))) {
    const attrs = match[1] || "";
    const text = decodeXmlEntities(stripXmlTags(match[2] || "")).trim();
    const start = parseTtmlTime(readXmlAttribute(attrs, "begin") || readXmlAttribute(attrs, "start"));
    const end = parseTtmlTime(readXmlAttribute(attrs, "end"));

    if (!text) {
      continue;
    }

    spans.push({
      value: text,
      time: Number.isFinite(start) ? start : NaN,
      endTime: Number.isFinite(end) ? end : NaN,
    });
  }

  const text = spans.length
    ? spans.map((span) => span.value).join("")
    : decodeXmlEntities(stripXmlTags(body)).trim();
  const firstWordTime = spans.find((span) => Number.isFinite(span.time))?.time;
  const time = Number.isFinite(lineStart)
    ? lineStart
    : (Number.isFinite(firstWordTime) ? firstWordTime : NaN);

  if (!text || !Number.isFinite(time)) {
    return null;
  }

  const wordTimeline = spans
    .filter((span) => Number.isFinite(span.time))
    .map((span) => ({
      time: span.time,
      value: span.value,
      ...(Number.isFinite(span.endTime) ? { endTime: span.endTime } : {}),
    }));

  return {
    time,
    text,
    ...(wordTimeline.length ? { wordTimeline } : {}),
    ...(Number.isFinite(lineEnd) ? { endTime: lineEnd } : {}),
  };
}

function readXmlAttribute(attrs, name) {
  const match = String(attrs || "").match(new RegExp(`(?:^|\\s)(?:[\\w:-]+:)?${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeXmlEntities(match[1]) : "";
}

function stripXmlTags(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

function decodeXmlEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
  };

  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token) => {
    const key = String(token || "").toLowerCase();

    if (key[0] === "#") {
      const code = key[1] === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }

    return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : entity;
  });
}

function parseTtmlTime(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return NaN;
  }

  const clock = raw.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (clock) {
    const hours = Number(clock[1] || 0);
    const minutes = Number(clock[2] || 0);
    const seconds = Number(clock[3] || 0);
    const fraction = clock[4] ? Number(`0.${clock[4].padEnd(3, "0").slice(0, 3)}`) : 0;
    return hours * 3600 + minutes * 60 + seconds + fraction;
  }

  const shortClock = raw.match(/^(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))$/);
  if (shortClock) {
    const minutes = Number(shortClock[1] || 0);
    const seconds = Number(shortClock[2] || 0);
    const fraction = Number(`0.${shortClock[3].padEnd(3, "0").slice(0, 3)}`);
    return minutes * 60 + seconds + fraction;
  }

  const unit = raw.match(/^([+-]?\d+(?:\.\d+)?)(ms|s)?$/i);
  if (unit) {
    const number = Number(unit[1]);
    return unit[2]?.toLowerCase() === "ms" ? number / 1000 : number;
  }

  return NaN;
}

function findLyricOffsetSeconds(lines) {
  return lines.reduce((offsetSeconds, line) => {
    const offsetMatch = String(line || "").trim().match(/^\[offset:\s*([+-]?\d+(?:\.\d+)?)\s*\]$/i);
    return offsetMatch ? Number(offsetMatch[1]) / 1000 : offsetSeconds;
  }, 0);
}

function isLyricOffsetLine(line) {
  return /^\[offset:\s*[+-]?\d+(?:\.\d+)?\s*\]$/i.test(line);
}

function applySourceLyricOffsetSeconds(seconds, offsetSeconds) {
  return Math.max(0, seconds - offsetSeconds);
}

function applyLyricPayloadSourceOffset(payload, offsetSeconds) {
  if ((!payload?.wordTimeline?.length && !payload?.translatedWordTimeline?.length) || !offsetSeconds) {
    return payload;
  }

  return {
    ...payload,
    ...(payload.wordTimeline?.length
      ? { wordTimeline: shiftLyricWordTimelineBySourceOffset(payload.wordTimeline, offsetSeconds) }
      : {}),
    ...(payload.translatedWordTimeline?.length
      ? { translatedWordTimeline: shiftLyricWordTimelineBySourceOffset(payload.translatedWordTimeline, offsetSeconds) }
      : {}),
  };
}

function shiftLyricWordTimelineBySourceOffset(timeline, offsetSeconds) {
  return timeline.map((word) => ({
    ...word,
    time: applySourceLyricOffsetSeconds(word.time, offsetSeconds),
    ...(Number.isFinite(word.endTime) ? { endTime: applySourceLyricOffsetSeconds(word.endTime, offsetSeconds) } : {}),
  }));
}

function parseInlineLyricWordTimeline(text, inlineTimePattern) {
  const value = String(text || "");
  const matches = [...value.matchAll(inlineTimePattern)];

  if (!matches.length) {
    return { text: value.trim(), words: [] };
  }

  const words = [];
  let cleanText = "";
  let cursor = 0;

  matches.forEach((match, index) => {
    cleanText += value.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    const nextMatch = matches[index + 1];
    const rawValue = value.slice(cursor, nextMatch?.index ?? value.length);
    const wordValue = rawValue;

    if (!wordValue.trim()) {
      return;
    }

    words.push({
      time: parseInlineTimeMatch(match),
      value: wordValue,
    });
  });

  cleanText += value.slice(cursor);

  const textValue = words.map((word) => word.value).join("");
  return {
    text: (cleanText.trim() || textValue).trim(),
    words: words.filter((word) => Number.isFinite(word.time)),
  };
}

function normalizeInlineLyricWordTimeline(words, lineTime) {
  const items = Array.isArray(words)
    ? words.filter((word) => Number.isFinite(word?.time))
    : [];

  if (!items.length) {
    return [];
  }

  const useLineRelativeTime = shouldUseLineRelativeInlineTimes(items, lineTime);
  return items.map((word) => ({
    value: word.value,
    time: useLineRelativeTime ? lineTime + word.time : word.time,
    ...(Number.isFinite(word.endTime)
      ? { endTime: useLineRelativeTime ? lineTime + word.endTime : word.endTime }
      : {}),
  }));
}

function shouldUseLineRelativeInlineTimes(words, lineTime) {
  if (!Number.isFinite(lineTime) || lineTime <= 0 || !words.length) {
    return false;
  }

  const times = words.map((word) => Number(word.time)).filter(Number.isFinite);
  if (!times.length) {
    return false;
  }

  const firstTime = times[0];
  const maxTime = Math.max(...times);

  return firstTime < lineTime - 0.25 && maxTime < lineTime + 8;
}

function parseInlineTimeMatch(match) {
  const parts = String(match[1] || "")
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);
  const secondsPart = parts.pop() || "0";
  const minutesPart = parts.pop() || "0";
  const hoursPart = parts.pop() || "0";
  const secondMatch = secondsPart.match(/^(\d{1,2})(?:[.:](\d{1,3}))?$/);

  if (!secondMatch) {
    return NaN;
  }

  const hours = Number(hoursPart || 0);
  const minutes = Number(minutesPart || 0);
  const seconds = Number(secondMatch[1] || 0);
  const fraction = secondMatch[2] ? Number(`0.${secondMatch[2].padEnd(3, "0").slice(0, 3)}`) : 0;
  return hours * 3600 + minutes * 60 + seconds + fraction;
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

    const timedWordLine = group.find((line) => Array.isArray(line.wordTimeline) && line.wordTimeline.length);

    if (texts.length <= 1) {
      return {
        time: group[0].time,
        text: texts[0] || "",
        ...(timedWordLine ? { wordTimeline: timedWordLine.wordTimeline } : {}),
        ...(timedWordLine?.translatedWordTimeline ? { translatedWordTimeline: timedWordLine.translatedWordTimeline } : {}),
      };
    }

    const translatedText = findTranslatedText(texts);
    const originalText = texts
      .filter((value) => value !== translatedText)
      .join(" / ");
    const originalTimeline = findTimedWordTimelineForText(group, originalText)
      || findTimedWordTimelineForText(group, originalText.split(" / ")[0])
      || (!findTimedWordTimelineForText(group, translatedText) ? timedWordLine?.wordTimeline : null);
    const translatedTimeline = findTimedWordTimelineForText(group, translatedText, "translatedWordTimeline")
      || findTimedWordTimelineForText(group, translatedText);

    return {
      time: group[0].time,
      text: translatedText,
      originalText,
      ...(originalTimeline?.length ? { wordTimeline: originalTimeline } : {}),
      ...(translatedTimeline?.length ? { translatedWordTimeline: translatedTimeline } : {}),
    };
  }).filter((line) => line.text);
}

function findTimedWordTimelineForText(lines, text, timelineKey = "wordTimeline") {
  const targetText = String(text || "").trim();

  if (!targetText) {
    return null;
  }

  const matchingLine = lines.find((line) => {
    const timeline = line?.[timelineKey];
    return Array.isArray(timeline)
      && timeline.length
      && normalizeLyricTextForTimeline(timeline.map((word) => word?.value || "").join("")) === normalizeLyricTextForTimeline(targetText);
  });

  if (matchingLine) {
    return matchingLine[timelineKey];
  }

  const directLine = lines.find((line) => {
    const timeline = line?.[timelineKey];
    return Array.isArray(timeline)
      && timeline.length
      && !line.originalText
      && normalizeLyricTextForTimeline(line.text) === normalizeLyricTextForTimeline(targetText);
  });

  return directLine?.[timelineKey] || null;
}

function normalizeLyricTextForTimeline(value) {
  return String(value || "").replace(/\s+/g, "").trim();
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
