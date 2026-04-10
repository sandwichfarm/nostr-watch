// apps/relaymon/src/utils/nip11.ts
//
// Phase 18 Fix 2: normalize NIP-11 info to strip volatile fields before
// hashing. Phase 17 Hypothesis B confirmed that createInfoHash() produces
// different hashes for the same server across check cycles when volatile
// fields (timestamps, counters, last_*, current_*) are present — defeating
// the case1/case2/case8 dedup logic.
//
// This helper is pure and dependency-free for ease of unit testing.

/** Exact keys (case-insensitive) to strip before hashing. */
const VOLATILE_KEYS = new Set<string>([
  "time",
  "timestamp",
  "now",
  "server_time",
  "current_time",
  "started_at",
  "last_updated",
  "updated_at",
  "uptime",
  "now_iso",
  "url", // nostr-tools may reflect the requesting URL into info — strip it
]);

/** Key prefixes (case-insensitive) to strip before hashing. */
const VOLATILE_PREFIXES: string[] = [
  "last_",
  "current_",
  "counter_",
  "count_",
];

/**
 * Substring patterns (case-insensitive) to strip before hashing.
 *
 * KNOWN over-match: the substring "count" also strips benign keys like
 * "account" and "discount". These are not standard NIP-11 fields for relay
 * metadata, so the over-match is acceptable for Phase 18. If a future
 * relay implementation starts exposing such a key as a persistent
 * identifier, this list can be tightened.
 */
const VOLATILE_SUBSTRINGS: string[] = [
  "count",
];

/**
 * Strip volatile fields from a NIP-11 info object so that two check cycles
 * of the same server produce the same hash.
 *
 * Returns a new object — never mutates the input.
 * Null-safe: returns {} for null/undefined/non-object input.
 *
 * Matching rules (all case-insensitive):
 *   1. Exact key in VOLATILE_KEYS → stripped
 *   2. Key starts with any VOLATILE_PREFIXES entry → stripped
 *   3. Key contains any VOLATILE_SUBSTRINGS entry → stripped
 *
 * Idempotent: normalizeNip11(normalizeNip11(x)) === normalizeNip11(x).
 */
export function normalizeNip11(
  info: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!info || typeof info !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(info)) {
    const k = key.toLowerCase();
    if (VOLATILE_KEYS.has(k)) continue;
    let matched = false;
    for (const prefix of VOLATILE_PREFIXES) {
      if (k.startsWith(prefix)) { matched = true; break; }
    }
    if (matched) continue;
    for (const sub of VOLATILE_SUBSTRINGS) {
      if (k.includes(sub)) { matched = true; break; }
    }
    if (matched) continue;
    out[key] = info[key];
  }
  return out;
}
