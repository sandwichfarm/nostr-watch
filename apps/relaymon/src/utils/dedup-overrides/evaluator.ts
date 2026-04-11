import { rules } from "./index.ts";
import { getLogger } from "../logger.ts";

const logger = getLogger("DedupOverrides");

/**
 * Phase 20 OVERRIDE-01: verdict returned by evaluateOverrides.
 *
 * Discriminated union so callers can narrow on `matched` and then read the
 * action/rule/reason fields without optional chaining.
 */
export type OverrideVerdict =
  | { matched: true; action: "allow" | "deny"; rule: string; reason: string }
  | { matched: false };

/**
 * Phase 20 OVERRIDE-01: first-match-wins evaluator.
 *
 * Parses `urlString` exactly once at the top of the function. Iterates
 * rules[] in barrel order and returns on the first rule whose test() returns
 * true. Each rule invocation is wrapped in its own try/catch so a single
 * buggy rule can never throw out of the dedup pipeline — a throwing rule is
 * logged at warn level and treated as no-match (never silent allow or deny).
 *
 * Locked behavior per 20-CONTEXT.md Area 1:
 *   - First-match-wins in barrel array order.
 *   - Per-rule try/catch — throwing rule = no-match, continue to next rule.
 *   - No priority field, no deny-beats-allow.
 *   - URL parsed once, URL object passed to every rule — rules must not re-parse.
 */
export function evaluateOverrides(urlString: string): OverrideVerdict {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch (e) {
    logger.warn(
      `evaluateOverrides: could not parse URL ${urlString}: ${(e as Error).message}`,
    );
    return { matched: false };
  }

  for (const rule of rules) {
    try {
      if (rule.test(parsed)) {
        logger.info(
          `Override '${rule.name}' matched ${urlString}: action=${rule.action} reason="${rule.reason}"`,
        );
        return {
          matched: true,
          action: rule.action,
          rule: rule.name,
          reason: rule.reason,
        };
      }
    } catch (e) {
      logger.warn(
        `Override rule '${rule.name}' threw on ${urlString}: ${(e as Error).message}`,
      );
      // Intentional: continue to next rule. A throwing rule is treated as
      // no-match, never as a silent allow or deny.
    }
  }

  return { matched: false };
}
