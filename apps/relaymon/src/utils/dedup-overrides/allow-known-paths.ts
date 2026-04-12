import type { DedupOverrideRule } from "./types.ts";

/**
 * Phase 20 OVERRIDE-03: allow-known-paths
 *
 * Always allows /inbox, /inbox/, /outbox, /outbox/ to win regardless of the
 * dedup philosophy's shortest-URL-wins or matching-NIP-11 branches. This is
 * a deliberate inversion of the Phase 19 note that said /inbox/ with a
 * matching-NIP-11 root sibling would be correctly ignored by case2.
 *
 * Locked semantics per 20-CONTEXT.md Area 3:
 *   - EXACT match only. ['/inbox', '/inbox/', '/outbox', '/outbox/'].includes(url.pathname).
 *   - Does NOT match /inbox/flint-november or other multi-segment mutations.
 *   - Case-sensitive — /INBOX does NOT match.
 */
const KNOWN_PATHS = new Set<string>(["/inbox", "/inbox/", "/outbox", "/outbox/"]);

export const rule: DedupOverrideRule = {
  name: "allow-known-paths",
  test(url: URL): boolean {
    return KNOWN_PATHS.has(url.pathname);
  },
  action: "allow",
  reason: "known-good path",
};
