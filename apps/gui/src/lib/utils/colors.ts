/**
 * Deterministic pastel color pair from an arbitrary string.
 * Returns two pastels: one for light UI, one for dark UI.
 */

export interface PastelPair {
  light: string; // hex color
  dark: string;  // hex color
}

export function pastelPairFromString(input: string): PastelPair {
  const bytes: Uint8Array = utf8Bytes(input);
  const seed: number = fnv1a32(bytes);
  const rand: () => number = mulberry32(seed);

  // Stable color identity
  const hue: number = Math.floor(rand() * 360);

  // Pastel normalization
  const baseSat: number = 45 + rand() * 20; // 45–65%
  const lightL: number = 82 + rand() * 8;   // 82–90%
  const darkL: number = 62 + rand() * 10;   // 62–72%
  const darkSat: number = Math.max(35, baseSat - 10);

  return {
    light: hslToHex(hue, baseSat, lightL),
    dark: hslToHex(hue, darkSat, darkL),
  };
}

function utf8Bytes(str: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }

  // UTF‑8 fallback (full Unicode)
  const out: number[] = [];
  for (const ch of str) {
    const cp: number = ch.codePointAt(0)!;

    if (cp <= 0x7f) {
      out.push(cp);
    } else if (cp <= 0x7ff) {
      out.push(
        0xc0 | (cp >> 6),
        0x80 | (cp & 0x3f)
      );
    } else if (cp <= 0xffff) {
      out.push(
        0xe0 | (cp >> 12),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    }
  }

  return Uint8Array.from(out);
}

// FNV‑1a 32‑bit hash
function fnv1a32(bytes: Uint8Array): number {
  let hash: number = 0x811c9dc5;

  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

// Deterministic PRNG
function mulberry32(seed: number): () => number {
  let a: number = seed;

  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t: number = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// HSL → hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const k = (n: number): number => (n + h / 30) % 12;
  const a: number = s * Math.min(l, 1 - l);

  const f = (n: number): number =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  const r: number = Math.round(255 * f(0));
  const g: number = Math.round(255 * f(8));
  const b: number = Math.round(255 * f(4));

  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/*
Usage:
const colors = pastelPairFromString("alice");
colors.light; // "#f0bbca"
colors.dark;  // "#da8199"
*/
