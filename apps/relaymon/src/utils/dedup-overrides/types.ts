/**
 * Phase 20 OVERRIDE-01: type definition for a single dedup override rule.
 *
 * Each rule lives in its own file under `dedup-overrides/` and is registered
 * in `index.ts` in the desired first-match-wins order. The evaluator parses
 * the URL string exactly once and passes the resulting URL object to every
 * rule's test() — rules must NOT re-parse the URL themselves.
 *
 * Locked shape per .planning/phases/20-dedup-performance-overrides/20-CONTEXT.md
 * Area 2. Do NOT add optional fields (priority, description, version) — future
 * extensions can add them as optional without breaking existing rules, but
 * Phase 20 ships with exactly these four fields.
 */
export interface DedupOverrideRule {
  /** Stable, human-readable name used in log lines. */
  name: string;
  /** Returns true when this rule matches the URL. Called with a pre-parsed URL object. */
  test(url: URL): boolean;
  /** Verdict when test() returns true. */
  action: 'allow' | 'deny';
  /** Short human-readable reason used in the ignore_reason column and logs. */
  reason: string;
}
