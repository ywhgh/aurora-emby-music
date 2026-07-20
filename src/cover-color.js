const DEFAULT_SAMPLE_SIZE = 28;

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function parseRgb(value) {
  const channels = String(value || "").split(",").map((part) => Number(part.trim()));
  return channels.length === 3 && channels.every(Number.isFinite) ? channels.map(clampChannel) : null;
}

function toRgb(channels) {
  return channels.map(clampChannel).join(", ");
}

function toHex(channels) {
  return `#${channels.map(clampChannel).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function createCoverAccent(primaryRgb, secondaryRgb = primaryRgb) {
  const primary = parseRgb(primaryRgb);
  if (!primary) return null;
  const secondary = parseRgb(secondaryRgb) || primary;
  const deep = primary.map((channel) => channel * 0.82);
  return {
    name: "封面",
    color: toHex(primary),
    deep: toHex(deep),
    rgb: toRgb(primary),
    secondaryRgb: toRgb(secondary),
  };
}

export function sampleCoverColors(src, options = {}) {
  if (!src) return Promise.resolve(null);
  const ImageCtor = options.ImageCtor || Image;
  const documentRef = options.documentRef || document;
  const sampleSize = options.sampleSize || DEFAULT_SAMPLE_SIZE;

  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.addEventListener("load", () => {
      try {
        const canvas = documentRef.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        context.drawImage(image, 0, 0, sampleSize, sampleSize);
        const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
        const buckets = new Map();
        for (let index = 0; index < data.length; index += 4) {
          const alpha = data[index + 3];
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
          if (alpha < 180 || lightness < 26 || lightness > 238) continue;
          const key = [r, g, b].map((channel) => Math.round(channel / 36)).join("-");
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
            rgb: toRgb([bucket.red, bucket.green, bucket.blue].map((value) => value / bucket.count)),
            count: bucket.count,
          }))
          .sort((first, second) => second.count - first.count);
        resolve(colors.length ? { primary: colors[0].rgb, secondary: colors[1]?.rgb || colors[0].rgb } : null);
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}
