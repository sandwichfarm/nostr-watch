# Phase 20: Dedup Performance & Overrides - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Smart discuss (4 grey areas, Area 1 interactive)

<domain>
## Phase Boundary

Scale relaymon dedup to 30k+ relays and introduce an explicit, modular override system so known-good paths (`/inbox`, `/outbox`) and hostname patterns (`lang.relays.land/<code>`) can short-circuit the shortest-URL-wins philosophy where that philosophy produces wrong answers at scale. Every override lives in its own file with its own isolated unit test so new overrides can ship one-at-a-time without touching core dedup logic.

**In scope:**

- **Migration scope narrowing.** `rerunDedupForAllRowsMigration` (in `apps/relaymon/src/utils/remediation.ts`) gets a new SQL layer `WHERE online = 1 AND ignore = 0` filter and a NEW sentinel name (e.g. `rerun_dedup_online_unignored_v3`) so existing DBs re-run under the new scope. Unit test seeds mixed online/offline/ignored/unignored rows and asserts the migration touches only online+unignored rows.
- **`getOnlineRelays` call-count reduction.** `relayHostnameDedup` gains an optional second parameter `ctx?: DedupContext` where `ctx = { onlineUrls?: string[] }`. When `onlineUrls` is passed, the function uses it in place of an internal `getOnlineRelays()` call. When `ctx` is undefined, the function falls back to current behavior (back-compat for existing callers). `rerunDedupForAllRowsMigration` calls `getOnlineRelays()` exactly once and passes the result into every per-row dedup call. Unit test uses a mocked DB-query counter to assert exactly one `getOnlineRelays()` call per migration run over a multi-row fixture.
- **Periodic re-eval stale-skip.** `reevaluateAllDeduplication` (in `apps/relaymon/src/utils/hostnames.ts`) gains two skip conditions before any `nocap.check` invocation:
  1. Skip rows where `checked_at` is older than a configurable stale threshold.
  2. Skip rows already marked `ignore = 1`.
  Threshold is configurable via a new Config field `dedup.nip11StaleSkipMs` with default 7 days (`604_800_000`). Unit test asserts zero `nocap.check` invocations for rows matching either skip condition.
- **Modular override system.** New directory `apps/relaymon/src/utils/dedup-overrides/` containing:
  - `types.ts` — exports `DedupOverrideRule` type matching the spec shape exactly: `{ name: string; test(url: URL): boolean; action: 'allow' | 'deny'; reason: string }`.
  - `index.ts` — static import barrel that re-exports an ordered `rules: DedupOverrideRule[]` array.
  - `allow-known-paths.ts` — matches `/inbox`, `/inbox/`, `/outbox`, `/outbox/` exactly (no prefix matching); `action: 'allow'`; `reason: 'known-good path'`.
  - `lang-relays-land.ts` — matches `hostname === 'lang.relays.land'` AND `pathname` matches `/^\/[a-z]{2}\/?$/` (exact two-letter code as the only path segment, trailing slash tolerated); `action: 'allow'`; `reason: 'lang.relays.land two-letter code'`.
- **Override evaluator integration.** `relayHostnameDedup` consults the override list before its existing case1–case8 branches. First-match-wins in barrel array order. Each rule runs inside a per-rule `try / catch` — if `test()` throws, log at `warn` level with the rule name and the error, and continue evaluating the next rule (the throwing rule is treated as no-match, never as a silent allow or deny). An `'allow'` match short-circuits the function and an `'deny'` match short-circuits the function; exact short-circuit semantics (return early directly vs set flag then fall through) are Claude's discretion provided the final behavior is equivalent to "the override verdict wins and cases 1–8 are skipped". The exact placement of the override check inside `relayHostnameDedup` (very top / after canonicalMURL / before cases 1–8) is Claude's discretion, constrained only by success criterion #5 ("consults overrides before any of cases 1–8").
- **Isolated unit tests per override.** New test files:
  - `apps/relaymon/tests/unit/dedup-overrides/allow-known-paths.test.ts` — exercises only `allow-known-paths` rule with its own fixtures (match + non-match cases, trailing-slash variant, prefix-match non-fire assertion).
  - `apps/relaymon/tests/unit/dedup-overrides/lang-relays-land.test.ts` — exercises only `lang-relays-land` rule with its own fixtures (matching two-letter codes, non-two-letter rejection, other-hostname rejection, trailing slash).
  - `apps/relaymon/tests/unit/dedup-overrides/evaluator.test.ts` (optional — Claude's discretion) — exercises the override-evaluator itself: first-match-wins order, throw-in-test recovery, allow short-circuit, deny short-circuit, no-match fall-through.
- **Regression coverage.** The existing `hostname-dedup.test.ts` `wss://haven.nostrfreedom.net/inbox/` test and all Phase 18 failing-sample tests must still pass after the override system is introduced — no pre-existing dedup behavior is broken. The override system is additive; cases 1–8 remain the default when no rule matches.

**Out of scope — CRITICAL CONSTRAINTS:**

- **No new cases in the existing case1–case8 logic.** Phase 20 does NOT extend the existing branches; it only wraps them with the override layer and the new parameter.
- **No changes to Phase 17/18/19 dedup philosophy outside of the override system.** The shortest-URL-wins, NIP-11-bias, and pessimistic-on-missing-NIP-11 rules remain the default for every URL that does NOT match an override rule.
- **No changes to `apps/relaymon/src/utils/hostnames.ts` case logic.** The only edits inside that file are: (a) signature change to accept `ctx`, (b) use `ctx.onlineUrls` when present, (c) call the override evaluator before cases 1–8, (d) `reevaluateAllDeduplication` gains the stale-skip logic.
- **No config file auto-reload.** `dedup.nip11StaleSkipMs` is read once at daemon boot; changing it requires a restart.
- **No dynamic override loading / hot reload / filesystem glob.** Static barrel only. Adding a new override = 1 new file + 1 line in `dedup-overrides/index.ts`.
- **No priority field on override rules.** First-match-wins in barrel order. If ordering matters, change the barrel.
- **No deny-beats-allow global rule.** First-match-wins means whichever rule is earlier in the barrel wins. Authors must order the barrel deliberately.
- **No metrics export for override hit counts.** Structured log lines only (warn level for throws, info level for hits). Metrics collection is deferred.
- **No protection for `lang.relays.land/dashboard` or other non-two-letter paths.** The rule is intentionally strict.
- **No prefix matching for `/inbox` and `/outbox`.** `/inbox/flint-november` is NOT protected; it continues to be treated as a mutation by cases 1–8.
- **No changes to Phase 19's `rerunDedupForAllRowsMigration` flow outside of the SQL scope + sentinel name + ctx-passing.** The migration still routes every decision through `relayHostnameDedup`; it still logs per-mutation lines and the structured JSON summary; it still queues deletion events via `enqueueRemediationDeletion`.
- **No changes to the `remediation_deletion_queue` schema or drain logic.**
- **No changes to the `relaymon_migrations` sentinel table schema.**

## Dedup Philosophy — Phase 20 Extension

Phase 19 established the dedup philosophy: shortest URL wins when NIP-11 matches; both URLs coexist when NIP-11 differs; pessimistic-ignore when NIP-11 is absent.

Phase 20 accepts that the philosophy is correct as a default but insufficient at scale for a small set of known-good paths. The override system is the explicit escape valve: it operates BEFORE cases 1–8, so an `allow` rule means "this URL is a first-class relay, publish it regardless of what the philosophy would say." This is a deliberate inversion of the Phase 19 note that said `/inbox/` with a matching-NIP-11 root sibling would be correctly ignored by case2 — in Phase 20, `/inbox/` is always allowed even in that case, because the user has decided at the product level that `/inbox` and `/outbox` are canonical known-good paths.

Future override rules can extend this protection pattern one file at a time.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Override Rule Mechanics

- **Override check placement inside `relayHostnameDedup`:** Claude's discretion. Constraint: must fire before any of cases 1–8. Acceptable placements include (a) very top after input validation, (b) after `canonicalMURL` normalization but before the NIP-11 hash branch, or (c) right before the case1 entry point. Any placement that preserves the "overrides run before cases" invariant is acceptable.
- **Precedence when multiple rules match:** First-match-wins in barrel array order. The override evaluator iterates `rules[]` in order and returns on the first rule whose `test(url)` returns true. Rule order is controlled entirely by the order in `dedup-overrides/index.ts`.
- **Rule failure handling:** Per-rule `try / catch`. If a rule's `test()` throws, the evaluator logs at `warn` level with `{ rule: rule.name, error: err.message }`, treats the rule as no-match, and continues to the next rule. A single buggy rule cannot fail the entire dedup call or poison downstream rules.
- **`allow` and `deny` verdict semantics:** Claude's discretion, bounded by the following requirement: when a rule returns a match, the final `result.ignore` and `result.parent` must equal what the rule demands (allow → `ignore=false, parent=""`; deny → `ignore=true, parent=rule.reason`), and cases 1–8 must NOT have a chance to flip that decision afterward. Simplest path: the evaluator directly mutates `result` and `relayHostnameDedup` returns immediately. Also acceptable: set a "protected" flag and have cases 1–8 honor it. Pick whichever is least intrusive to the existing code.

### Area 2: Override Rule Contract & Loading

- **`test()` signature:** `test(url: URL): boolean`. The override evaluator parses the URL string exactly once per dedup call (outside the rule loop) and passes the resulting `URL` object to every rule. Rules do not re-parse.
- **Loading mechanism:** Static import barrel at `apps/relaymon/src/utils/dedup-overrides/index.ts`. The barrel imports each rule file explicitly and re-exports an ordered `rules: DedupOverrideRule[]`. Adding a new override = create one new file + add one line to the barrel. No filesystem glob, no dynamic import, no runtime registration.
- **Exported rule shape (exact):**
  ```ts
  export interface DedupOverrideRule {
    name: string;
    test(url: URL): boolean;
    action: 'allow' | 'deny';
    reason: string;
  }
  ```
  No optional fields at this phase (no `priority`, no `description`, no `version`). Future additions can be added as optional without breaking existing rules.
- **Type location:** New file `apps/relaymon/src/utils/dedup-overrides/types.ts` exporting `DedupOverrideRule`. Self-contained within the `dedup-overrides/` directory.

### Area 3: Initial Override Semantics

- **`allow-known-paths.ts`:** Literal exact match on `/inbox`, `/inbox/`, `/outbox`, `/outbox/` (i.e., `['/inbox', '/inbox/', '/outbox', '/outbox/'].includes(url.pathname)`). Does NOT match `/inbox/flint-november` or other multi-segment paths. Action: `'allow'`. Reason: `'known-good path'` (or equivalent short human-readable string). Test fixtures must cover: matching paths (with and without trailing slash), non-matching multi-segment mutation (`/inbox/flint-november`), non-matching unrelated path (`/foo`), and the root `/`.
- **`lang-relays-land.ts`:** Match when `url.hostname === 'lang.relays.land'` AND `url.pathname` matches `/^\/[a-z]{2}\/?$/` (exact two-letter lowercase code, trailing slash tolerated). Matches `/en`, `/en/`, `/fr`, `/fr/`; does NOT match `/english`, `/EN`, `/e1`, `/`, `/dashboard`, or any multi-segment path. Action: `'allow'`. Reason: `'lang.relays.land two-letter code'`. Test fixtures must cover: matching two-letter codes (with and without trailing slash), non-matching three-letter code, non-matching uppercase, non-matching root, non-matching multi-segment, non-matching wrong hostname.
- **Applicability:** Both rules fire regardless of the current NIP-11 state of the URL or its siblings. That is the whole point: override the NIP-11-match case.

### Area 4: Performance & Migration Scope

- **Migration row scan SQL:** Replace the existing row-enumerating SELECT in `rerunDedupForAllRowsMigration` with a SELECT that includes `WHERE online = 1 AND ignore = 0`. This restriction happens at the SQL layer, not in a post-SELECT JavaScript filter. A new migration sentinel (`rerun_dedup_online_unignored_v1` or similar — Claude's discretion on exact name, but it MUST differ from the Phase 19 `rerun_dedup_all_rows_v2` sentinel) is used so existing deployed DBs re-run the migration exactly once under the new scope.
- **`getOnlineRelays` call-count:** New optional parameter on `relayHostnameDedup`: `ctx?: { onlineUrls?: string[] }`. When `ctx.onlineUrls` is provided, the function uses it in place of calling `getOnlineRelays()`. When `ctx` is undefined or `ctx.onlineUrls` is undefined, the function calls `getOnlineRelays()` itself (back-compat for existing callers). `rerunDedupForAllRowsMigration` calls `getOnlineRelays()` exactly once per run, stashes the result in a local const, and passes it as `{ onlineUrls: cachedOnline }` to every per-row call. Unit test: mock the DB-query layer with a counter, seed ≥5 rows, assert the `getOnlineRelays`-producing query fires exactly once.
- **Stale skip threshold in `reevaluateAllDeduplication`:** New Config field `dedup.nip11StaleSkipMs: number` with default `604_800_000` (7 days). Read once at daemon boot. `reevaluateAllDeduplication` accepts a threshold parameter (or reads from appConfig) and, for each candidate relay, skips the `nocap.check` call when either:
  1. The row's `checked_at` is older than `Date.now() - nip11StaleSkipMs`, OR
  2. The row is already marked `ignore = 1`.
  Unit test: seed a fixture with one row matching neither condition (check fires), one row stale (check skipped), one row ignored (check skipped). Assert the mocked `nocap.check` was called exactly once.
- **`onlineUrls` shape passed into dedup:** `string[]`. No Set, no pre-grouped Map. At 30k scale the O(N) hostname includes filter already inside `relayHostnameDedup` is acceptable; profiling a follow-up can replace with a Map if this becomes the hot spot.

### Claude's Discretion

- Exact placement of the override evaluator call inside `relayHostnameDedup` (see Area 1 Q1).
- Exact `allow`/`deny` short-circuit mechanism (direct mutate + return vs flag + respect in cases, see Area 1 Q4).
- Exact sentinel name for the new migration (constraint: differs from Phase 19's `rerun_dedup_all_rows_v2`).
- Exact reason strings on each override rule (constraint: short, human-readable, stable for logs).
- Whether the override evaluator lives in `dedup-overrides/evaluator.ts` or `dedup-overrides/index.ts` or inlined in `hostnames.ts`. Preference: `dedup-overrides/evaluator.ts` for testability.
- Whether to write a dedicated `evaluator.test.ts` for first-match-wins / throw-recovery coverage, or fold those assertions into the existing `hostname-dedup.test.ts`. Preference: dedicated file for isolation.
- The exact field / structure of the new `dedup.nip11StaleSkipMs` config (must be a numeric ms value, default 604800000, surfaced through existing Config shape).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/relaymon/src/utils/hostnames.ts`** — contains `relayHostnameDedup` (lines 143+), `reevaluateAllDeduplication` (lines 513+), and the NIP-11 hash logic. Phase 20 edits this file to: add `ctx` parameter, call override evaluator before cases 1–8, add stale-skip to `reevaluateAllDeduplication`. Case1–case8 bodies are NOT modified.
- **`apps/relaymon/src/utils/remediation.ts`** — contains `rerunDedupForAllRowsMigration` (lines 57+) with the current unconstrained `SELECT ... FROM relay_status`. Phase 20 edits the SQL to add `WHERE online = 1 AND ignore = 0` and changes the sentinel name. The per-row loop that constructs `RelayCheckResult` and calls `relayHostnameDedup` is updated to pass `{ onlineUrls: cachedOnline }` as the second argument.
- **`getOnlineRelays()` in `apps/relaymon/src/db/db.ts`** — returns `string[]` of URLs where `online = 1`. Phase 20 calls it once per migration run instead of per row.
- **`apps/relaymon/src/db/db.ts` `initializeDB()`** — already contains the Phase 19 + nostrings-sweep migration calls. Phase 20 does NOT add a new migration call; it reuses `rerunDedupForAllRowsMigration` with the new sentinel.
- **`@nostrwatch/logger`** — reused for override-evaluator warn logs and migration summary logs.
- **`Config` type in `apps/relaymon/src/types/config.ts`** — extended with the new optional `dedup` subsection containing `nip11StaleSkipMs`.
- **Existing unit test infrastructure in `apps/relaymon/tests/unit/`** — `setupDatabase()` helper, `:memory:` SQLite, `mockRelayInfo()`, `captureDedupSnapshot()`. Phase 20 test files reuse these.

### Established Patterns

- **Idempotent startup migrations via sentinel rows** (Phase 18/19): check for sentinel, return early if present, do work, insert sentinel on success. Phase 20's new-sentinel-name pattern fits cleanly.
- **Deno test with `:memory:` SQLite** (Phase 17/18/19): every test file imports `setupDatabase`, seeds rows, calls the function under test, asserts on the result.
- **Structured JSON summary log line** (Phase 19): one greppable line with stable field names. Phase 20's migration summary retains the same field names plus (optionally) `scope: 'online_unignored'` for clarity.
- **Defensive per-row `try / catch`** (Phase 19 `remediation.ts`): Phase 20's override evaluator follows the same shape — one try/catch per rule so one bug cannot take down the whole pass.

### Integration Points

- **Override evaluator wiring:** `apps/relaymon/src/utils/hostnames.ts` imports from `./dedup-overrides/index.ts` (or `./dedup-overrides/evaluator.ts`) and calls it inside `relayHostnameDedup` before cases 1–8.
- **`ctx` parameter plumbing:** `relayHostnameDedup` signature changes from `(result)` to `(result, ctx?)`. All existing callers (`reevaluateAllDeduplication`, live-check path, Phase 19 remediation) continue to compile because `ctx` is optional. Phase 19 remediation is updated to pass the cached `onlineUrls`.
- **Config threading:** `reevaluateAllDeduplication` either (a) accepts the stale-skip threshold as a parameter, or (b) reads `appConfig.dedup.nip11StaleSkipMs` via the existing `appConfig` module global in `hostnames.ts`. Claude's discretion.
- **Test directory:** new `apps/relaymon/tests/unit/dedup-overrides/` created to house per-override test files.

</code_context>

<specifics>
## Specific Ideas

### Rule type (`apps/relaymon/src/utils/dedup-overrides/types.ts`)

```ts
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
```

### Rule — `allow-known-paths.ts` (illustrative)

```ts
import type { DedupOverrideRule } from "./types.ts";

const KNOWN_PATHS = new Set(["/inbox", "/inbox/", "/outbox", "/outbox/"]);

export const rule: DedupOverrideRule = {
  name: "allow-known-paths",
  test(url) {
    return KNOWN_PATHS.has(url.pathname);
  },
  action: "allow",
  reason: "known-good path",
};
```

### Rule — `lang-relays-land.ts` (illustrative)

```ts
import type { DedupOverrideRule } from "./types.ts";

const TWO_LETTER_CODE = /^\/[a-z]{2}\/?$/;

export const rule: DedupOverrideRule = {
  name: "lang-relays-land",
  test(url) {
    return url.hostname === "lang.relays.land" && TWO_LETTER_CODE.test(url.pathname);
  },
  action: "allow",
  reason: "lang.relays.land two-letter code",
};
```

### Barrel — `index.ts` (illustrative)

```ts
import type { DedupOverrideRule } from "./types.ts";
import { rule as allowKnownPaths } from "./allow-known-paths.ts";
import { rule as langRelaysLand } from "./lang-relays-land.ts";

export const rules: DedupOverrideRule[] = [
  allowKnownPaths,
  langRelaysLand,
];

export type { DedupOverrideRule } from "./types.ts";
```

### Evaluator — `evaluator.ts` (illustrative shape, final form is Claude's discretion)

```ts
import { rules } from "./index.ts";
import type { DedupOverrideRule } from "./types.ts";
import { getLogger } from "../logger.ts";

const logger = getLogger("DedupOverrides");

export type OverrideVerdict =
  | { matched: true; action: 'allow' | 'deny'; rule: string; reason: string }
  | { matched: false };

export function evaluateOverrides(urlString: string): OverrideVerdict {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch (e) {
    logger.warn(`evaluateOverrides: could not parse URL ${urlString}: ${e}`);
    return { matched: false };
  }

  for (const rule of rules) {
    try {
      if (rule.test(parsed)) {
        return { matched: true, action: rule.action, rule: rule.name, reason: rule.reason };
      }
    } catch (e) {
      logger.warn(
        `Override rule '${rule.name}' threw on ${urlString}: ${(e as Error).message}`,
      );
      // continue to next rule
    }
  }

  return { matched: false };
}
```

### `relayHostnameDedup` signature + integration (illustrative)

```ts
export interface DedupContext {
  onlineUrls?: string[];
}

export const relayHostnameDedup = async (
  result: RelayCheckResult,
  ctx?: DedupContext,
): Promise<RelayCheckResult> => {
  // ... existing mURL / HOSTNAME / PROTOCOL destructure + validation ...

  // Phase 20: override check before cases 1-8
  const verdict = evaluateOverrides(mURL);
  if (verdict.matched) {
    if (verdict.action === 'allow') {
      result.ignore = false;
      result.parent = "";
      logger.info(`Override '${verdict.rule}' allowed ${mURL}: ${verdict.reason}`);
      return result;
    } else {
      result.ignore = true;
      result.parent = verdict.reason;
      logger.warn(`Override '${verdict.rule}' denied ${mURL}: ${verdict.reason}`);
      return result;
    }
  }

  // Phase 20: prefer ctx.onlineUrls when provided, else fall back
  const onlineUrls = ctx?.onlineUrls ?? getOnlineRelays();

  // ... existing case1-case8 logic unchanged, using `onlineUrls` instead of re-calling getOnlineRelays ...
};
```

### Migration — `remediation.ts` SQL scope change (illustrative)

```ts
// Phase 20: new sentinel so deployed DBs re-run under the new scope
const MIGRATION_NAME = "rerun_dedup_online_unignored_v1";

// ... inside rerunDedupForAllRowsMigration ...

const cachedOnline = getOnlineRelays(); // ONCE per run
const rows = db.query(
  `SELECT url, ignore, parent, online, ignore_reason, network, checked_at
   FROM relay_status
   WHERE online = 1 AND ignore = 0`,
);

for (const row of rows) {
  // ... existing per-row body ...
  const deduped = await relayHostnameDedup(result, { onlineUrls: cachedOnline });
  // ... existing compare / update / log ...
}
```

### `reevaluateAllDeduplication` stale-skip (illustrative)

```ts
export const reevaluateAllDeduplication = async (
  nip11CacheTtl: number = 24 * 60 * 60 * 1000,
  nip11StaleSkipMs?: number,
): Promise<any[]> => {
  const staleSkipMs = nip11StaleSkipMs ?? appConfig?.dedup?.nip11StaleSkipMs ?? 604_800_000;
  const now = Date.now();

  const onlineRelays = getOnlineRelays();
  // ... existing grouping by hostname ...

  for (const [hostnameKey, relaysInGroup] of relaysByHostname.entries()) {
    // Skip entire group if every relay in it matches a skip condition
    // ... or: skip per-relay by checking `ignore=1` or `now - checked_at > staleSkipMs`
    // Claude's discretion on per-relay vs per-group granularity.
    // Invariant: for any relay matching either skip condition, `nocap.check`
    // is NOT called on that relay's behalf in this run.
  }
};
```

### Test fixtures

- **`allow-known-paths.test.ts`:**
  - `new URL("wss://haven.nostrfreedom.net/inbox/")` → rule.test returns true
  - `new URL("wss://haven.nostrfreedom.net/inbox")` → rule.test returns true
  - `new URL("wss://haven.nostrfreedom.net/outbox/")` → rule.test returns true
  - `new URL("wss://haven.nostrfreedom.net/inbox/flint-november-alpha")` → rule.test returns false
  - `new URL("wss://haven.nostrfreedom.net/")` → rule.test returns false
  - `new URL("wss://haven.nostrfreedom.net/foo")` → rule.test returns false
  - Assertions on `rule.action === 'allow'` and `rule.name === 'allow-known-paths'`.
- **`lang-relays-land.test.ts`:**
  - `new URL("wss://lang.relays.land/en")` → true
  - `new URL("wss://lang.relays.land/en/")` → true
  - `new URL("wss://lang.relays.land/fr")` → true
  - `new URL("wss://lang.relays.land/english")` → false
  - `new URL("wss://lang.relays.land/EN")` → false
  - `new URL("wss://lang.relays.land/")` → false
  - `new URL("wss://lang.relays.land/en/dashboard")` → false
  - `new URL("wss://other.host/en")` → false
- **Migration SQL scope unit test** (seed mixed fixture; assert only online+unignored rows were touched; assert idempotency on second run; assert new sentinel inserted).
- **`getOnlineRelays` call-count test** (mock DB query counter; seed ≥5 rows; assert exactly 1 invocation of the query that `getOnlineRelays` runs).
- **`reevaluateAllDeduplication` stale-skip test** (mock `nocap.check`; seed fresh row, stale row, ignored row; assert 1 invocation).
- **Regression: `hostname-dedup.test.ts`** — existing `wss://haven.nostrfreedom.net/inbox/` and all Phase 18 failing-sample tests must still pass.

### Requirements coverage

- **PERF-01** — `rerunDedupForAllRowsMigration` scope narrowing (SQL WHERE clause).
- **PERF-02** — `getOnlineRelays()` call-count reduction via `ctx.onlineUrls`.
- **OVERRIDE-01** — modular override system scaffold + types + barrel.
- **OVERRIDE-02** — `allow-known-paths` rule with isolated test.
- **OVERRIDE-03** — `lang-relays-land` rule with isolated test.

Planner should thread these into each plan's frontmatter.

</specifics>

<deferred>
## Deferred Ideas

- **Metrics export for override hit counts.** Structured log lines only in this phase. Metrics collection deferred.
- **Config hot-reload for `dedup.nip11StaleSkipMs`.** Daemon-restart-to-change is acceptable.
- **Dynamic override loading / hot reload.** Static barrel only. Adding/removing a rule requires a deploy.
- **Prefix matching for `/inbox/*` and `/outbox/*`.** Explicitly rejected — would protect spam mutations.
- **Priority field on override rules.** First-match-wins in barrel order is sufficient at this phase.
- **`deny` override examples.** Only `allow` rules ship in Phase 20. The `deny` pathway is implemented and tested but no deny rule files are shipped yet.
- **Pre-grouped `Map<string, string[]>` for `onlineUrls`.** `string[]` is sufficient at 30k scale; Map grouping is a profiling-driven follow-up.
- **Stricter ISO-639-1 whitelist for `lang-relays-land`.** `/^[a-z]{2}$/` is sufficient; a whitelist of ~180 codes is more code for dubious upside.
- **Case-insensitive or unicode two-letter codes for `lang-relays-land`.** Lowercase ASCII only.
- **Per-override config toggles to disable a rule without removing the file.** Out of scope; restart-to-disable is acceptable.
- **Cross-monitor override synchronization.** Out of scope.
- **Broader profiling of `reevaluateAllDeduplication` beyond the stale-skip.** Deferred until the stale-skip lands and re-runs are measurable.
- **Changes to `remediation.ts` `drainRemediationDeletionQueue` logic.** Out of scope.

</deferred>
