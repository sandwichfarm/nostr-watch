/**
 * Deterministic pastel color pair from an arbitrary string.
 * Returns two pastels: one tuned for light UI, one for dark UI.
 */
export function pastelPairFromString(input) {
  const str = String(input);
  const bytes = utf8Bytes(str);
  const seed = fnv1a32(bytes);
  const rand = mulberry32(seed);

  // Base "color identity" from the string
  const hue = Math.floor(rand() * 360);

  // Normalize into pastel territory (muted saturation + high-ish lightness)
  const baseSat = 45 + rand() * 20;        // 45–65%
  const lightL  = 82 + rand() * 8;         // 82–90% (very light pastel)
  const darkL   = 62 + rand() * 10;        // 62–72% (still pastel, works on dark UI)
  const darkSat = Math.max(35, baseSat - 10); // 35–55% (slightly more muted)

  return {
    light: hslToHex(hue, baseSat, lightL),
    dark:  hslToHex(hue, darkSat, darkL),
  };
}

function utf8Bytes(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);

  // Fallback UTF‑8 encoder (covers full Unicode)
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f) out.push(cp);
    else if (cp <= 0x7ff) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp <= 0xffff)
      out.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
  }
  return Uint8Array.from(out);
}

// FNV-1a 32-bit hash
function fnv1a32(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Deterministic PRNG from a 32-bit seed
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// HSL (degrees, %, %) -> #RRGGBB
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const r = Math.round(255 * f(0));
  const g = Math.round(255 * f(8));
  const b = Math.round(255 * f(4));

  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}