import type { DedupOverrideRule } from "./types.ts";

/**
 * Phase 20 OVERRIDE-03: lang-relays-land
 *
 * Allows each `lang.relays.land/<two-letter-code>` path to be treated as its
 * own independent relay rather than a dedup child of a shorter sibling root.
 *
 * Locked semantics per 20-CONTEXT.md Area 3:
 *   - hostname MUST be exactly "lang.relays.land".
 *   - pathname MUST match /^\/[a-z]{2}\/?$/ — exactly two lowercase ASCII
 *     letters as the only path segment, trailing slash tolerated.
 *   - Matches: /en, /en/, /fr, /fr/, /de, /ja
 *   - Does NOT match: /english, /EN, /e1, /, /dashboard, /en/dashboard
 *   - Does NOT match other hostnames (e.g. wss://other.host/en).
 */
const TWO_LETTER_CODE = /^\/[a-z]{2}\/?$/;

export const rule: DedupOverrideRule = {
  name: "lang-relays-land",
  test(url: URL): boolean {
    return url.hostname === "lang.relays.land" && TWO_LETTER_CODE.test(url.pathname);
  },
  action: "allow",
  reason: "lang.relays.land two-letter code",
};
