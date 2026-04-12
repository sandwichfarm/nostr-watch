import type { DedupOverrideRule } from "./types.ts";
import { rule as allowKnownPaths } from "./allow-known-paths.ts";
import { rule as langRelaysLand } from "./lang-relays-land.ts";

/**
 * Phase 20 OVERRIDE-01: ordered rules list.
 *
 * First-match-wins in array order per 20-CONTEXT.md Area 1. Rule ordering is
 * controlled entirely by the order of entries in this array. Adding a new
 * override = create one new file + add one line here. No priority field, no
 * deny-beats-allow global rule — if ordering matters, the author must place
 * the rule deliberately.
 */
export const rules: DedupOverrideRule[] = [
  allowKnownPaths,
  langRelaysLand,
];

export type { DedupOverrideRule } from "./types.ts";
