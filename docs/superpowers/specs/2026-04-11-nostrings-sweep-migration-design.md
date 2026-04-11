# Nostrings Sweep Migration — Design

**Date:** 2026-04-11
**Status:** Design approved, pending implementation plan
**Scope:** `libraries/nostrings`, `apps/relaymon`

## Problem

`@nostrwatch/nostrings` is the URL-sanitization library used at ingress time by relaymon, nocapd, trawler, and others. When nostrings fixes a bug in its qualification rules (e.g. the v0.4.0 fix that rejects `wss://https/catbox.moe`), the fix only applies to *future* ingress. Rows that were already written to relaymon's `relay_status` table under an older, buggier nostrings version stay in the database indefinitely.

Observed symptom: `wss://https/catbox.moe` still present in `relay_status`, still being processed by `IgnoreListSync` and the remediation flow, despite current nostrings correctly rejecting that string.

## Goal

Give relaymon a mechanism to retroactively re-evaluate every row in `relay_status` against the current nostrings rules, every time nostrings ships a sanitization fix, with zero manual operator intervention.

## Non-goals

- **Nocapd / trawler.** Not in scope. If the pattern proves out, porting is a separate spec.
- **Mutation / rewrite.** Rows that still qualify but whose sanitized form differs cosmetically (casing, trailing slashes) are left alone. Cross-table URL rename is a multi-table migration with PK-collision hazards, and the pain is cosmetic.
- **A nostrings migrations manifest.** Nostrings stays a pure predicate library with no per-bug migration metadata.
- **Richer qualify return type.** `qualifyRelayUrl` keeps its boolean signature.
- **On-demand CLI subcommand.** Startup-driven is the single path.

## Design decisions (settled during brainstorming)

| # | Question | Decision |
|---|----------|----------|
| 1 | Where does the migration logic live? | **B — nostrings as rules, relaymon as sweep.** The fix-carrier is the existing predicate itself. |
| 2 | What happens to rows that now fail `qualifyRelayUrl`? | **C — two-tier.** Hard-delete unparseable garbage; soft-ignore parseable-but-disqualified. |
| 2b | How is garbage vs. disqualified distinguished? | **A — heuristic in relaymon.** `try { new URL(url) } catch { garbage }`. No new nostrings API. |
| 3 | Does the sweep also rewrite rows? | **A — drop only.** No mutation of row identity, no cross-table renames. |
| 4 | What triggers the sweep? | **A — version-bumped sentinel.** `nostrings_sweep_v${VERSION}` row in `relaymon_migrations`. |

## Architecture

The design has two moving parts.

### 1. `libraries/nostrings/src/index.ts`

Add one export:

```ts
export const VERSION = "0.4.0";
```

Hand-bumped in the same PR as any sanitization fix. Simpler than a build-time codegen step, Deno-compatible (no runtime `package.json` read), and impossible to forget at PR review time because a sanitization fix without a version bump is obviously incomplete.

No other changes to nostrings. The library stays a pure URL-quality predicate.

### 2. `apps/relaymon/src/utils/remediation.ts`

Add a new async function `rerunNostringsSweepMigration()` that mirrors the existing `rerunDedupForAllRowsMigration`. Guarded by a sentinel name embedding the current nostrings version: `nostrings_sweep_v${VERSION}`. Each nostrings bump creates a fresh sentinel row and re-triggers the sweep exactly once per database per version.

### Call site

`apps/relaymon/src/db/db.ts` → `initializeDB()`. The new call is appended after the existing dedup migration:

```
rehashRelayInfoMigration()
  → rerunDedupForAllRowsMigration()
    → rerunNostringsSweepMigration()     // new
```

`initializeDB` is already `async` for the same dedup-ordering reason, so `main.ts` continues to `await` it before `IgnoreListSync` is constructed. The sweep inherits that ordering contract for free.

## The sweep function

Structural shape, mirroring `rerunDedupForAllRowsMigration`:

```ts
import { VERSION, qualifyRelayUrl } from "@nostrwatch/nostrings";

const MIGRATION_NAME = `nostrings_sweep_v${VERSION}`;

export async function rerunNostringsSweepMigration(): Promise<void> {
  try {
    // Idempotency guard — sentinel in relaymon_migrations.
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [MIGRATION_NAME],
    );
    if (existing.length > 0) {
      logger.debug(`Migration ${MIGRATION_NAME} already applied, skipping`);
      return;
    }

    logger.info(`Running migration: ${MIGRATION_NAME}`);
    const startTime = Date.now();

    const rows = db.query(`SELECT url FROM relay_status`);

    let evaluated = 0;
    let hardDeleted = 0;
    let softIgnored = 0;
    let unchanged = 0;

    for (const [urlRaw] of rows) {
      const url = urlRaw as string;
      evaluated++;

      try {
        // Garbage-URL path: unparseable → hard delete.
        let parseable = true;
        try { new URL(url); } catch { parseable = false; }

        if (!parseable) {
          hardDeleteRow(url, `Garbage URL rejected by nostrings v${VERSION}`);
          hardDeleted++;
          continue;
        }

        // Disqualified-but-parseable path: soft-ignore tombstone.
        if (!qualifyRelayUrl(url)) {
          softIgnoreRow(url, `Rejected by nostrings v${VERSION}: disqualified`);
          softIgnored++;
          continue;
        }

        unchanged++;
      } catch (e) {
        // Per-row failure must not abort the sweep — log and continue.
        logger.error(`Nostrings sweep: failed to evaluate ${url}: ${e}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Structured greppable summary line.
    logger.info(JSON.stringify({
      migration: MIGRATION_NAME,
      rows_evaluated: evaluated,
      hard_deleted: hardDeleted,
      soft_ignored: softIgnored,
      unchanged: unchanged,
      duration_ms: durationMs,
    }));

    // Insert sentinel ONLY after successful completion so a partial
    // run can be retried on next restart.
    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [MIGRATION_NAME, Math.floor(Date.now() / 1000)],
    );

    logger.info(
      `Migration ${MIGRATION_NAME} complete: ${evaluated} evaluated, ${hardDeleted} hard-deleted, ${softIgnored} soft-ignored, ${unchanged} unchanged, ${durationMs}ms`,
    );
  } catch (e) {
    // Top-level: never crash startup.
    logger.error(`Migration ${MIGRATION_NAME} failed: ${e}`);
  }
}
```

### Action helpers

**Hard delete** — wrap the four writes in a single SQLite transaction so a crash mid-row leaves no orphaned satellite state. The Deno sqlite binding (`deno.land/x/sqlite`) uses explicit `BEGIN/COMMIT/ROLLBACK` via `db.query(...)` — it does **not** expose a callback-style `db.transaction(fn)`. The helper must therefore emit the statements directly and roll back on any error:

```ts
function hardDeleteRow(url: string, reason: string): void {
  db.query("BEGIN TRANSACTION");
  try {
    db.query(`DELETE FROM relay_status WHERE url = ?`, [url]);
    db.query(`DELETE FROM relay_info   WHERE url = ?`, [url]);
    clearDeltaState(url);         // already exists in db.ts
    clearPeriodSnapshots(url);    // already exists in db.ts
    db.query("COMMIT");
  } catch (e) {
    db.query("ROLLBACK");
    throw e;  // re-throw so the per-row catch in the sweep logs it
  }
  enqueueRemediationDeletion(url, reason);  // already exists in remediation.ts
  logger.info(`Nostrings sweep: hard-deleted ${url}`);
}
```

`enqueueRemediationDeletion` is intentionally outside the transaction: it writes to `remediation_deletion_queue`, which is logically separate from the row-removal atomicity, and is already idempotent on `url`.

**Soft ignore** — tombstone behavior; row stays, satellite tables untouched. `IgnoreListSync` will use the ignored row to short-circuit future re-ingestion of the same string:

```ts
function softIgnoreRow(url: string, reason: string): void {
  db.query(
    `UPDATE relay_status SET ignore = 1, ignore_reason = ? WHERE url = ?`,
    [reason, url],
  );
  enqueueRemediationDeletion(url, reason);
  logger.info(`Nostrings sweep: soft-ignored ${url}`);
}
```

### Error handling

- **Top-level try/catch** swallows any unexpected failure and logs it. Same "never crash startup" contract as the existing migrations.
- **Per-row try/catch** inside the loop means one bad row cannot abort the sweep.
- **Sentinel inserted only on successful completion** — a partial run (crash, forced kill) is retried on the next startup because the sentinel is absent.

## Interaction with existing migrations and sync

Three interactions that matter:

### 1. Ordering vs. `rerunDedupForAllRowsMigration`

Dedup must run first. Dedup walks every row and mutates `(ignore, parent)` in place based on row identity; removing rows underneath it is harmless, but adding rows is not. The sweep never adds rows, so appending it at the end of `initializeDB` is safe. Final ordering in `initializeDB`:

```
rehashRelayInfoMigration()
  → rerunDedupForAllRowsMigration()
    → rerunNostringsSweepMigration()
```

### 2. `IgnoreListSync` snapshot timing

`db.ts` comments at the dedup migration call explain that `initializeDB` is async specifically so `main.ts` can `await` it before `IgnoreListSync` is constructed — otherwise the sync would snapshot a pre-migration view of `relay_status`. The sweep inherits that contract by running inside the same awaited function. **No changes to `main.ts` needed.**

### 3. `remediation_deletion_queue` collisions

Both the dedup migration and the new sweep `INSERT ... ON CONFLICT(url) DO UPDATE SET reason = excluded.reason` via `enqueueRemediationDeletion`. If the same URL is touched by both on a first-ever run, the later writer wins the `reason` field — harmless because the deletion is idempotent on URL and whichever reason lands is human-readable. No extra logic needed.

## Testing

New test file: `apps/relaymon/tests/unit/nostrings-sweep.test.ts`. Mirrors the structure of `hostname-dedup.test.ts`. Reuses `setupDatabase` and `mockConfig` from `tests/helpers/fixtures.ts`.

### Required cases

1. **Garbage URL → hard-deleted + all satellite tables cleared + queued for kind:5.**
   Seed `wss://https/catbox.moe` into `relay_status`, plus matching rows in `relay_info`, `relay_delta_state`, `relay_period_snapshots`. Run sweep. Assert: all four tables return zero rows for that URL, and `remediation_deletion_queue` has exactly one entry for it.

2. **Unparseable URL → hard-deleted.**
   Seed a row whose `url` throws on `new URL()` (e.g. `"wss:// spaces are bad"`). Same assertions as case 1.

3. **Disqualified-but-parseable URL → soft-ignored, row stays.**
   Seed a row where `new URL(url)` succeeds but `qualifyRelayUrl` returns false (e.g. `wss://echo.websocket.org`, present in nostrings' blocklist). Assert: row still in `relay_status` with `ignore=1` and `ignore_reason LIKE 'Rejected by nostrings%'`. `remediation_deletion_queue` has one entry. Satellite tables untouched — this is the tombstone behavior.

4. **Valid URL → unchanged.**
   Seed a well-formed relay URL. Run sweep. Assert: row unchanged, no queue entry added, counted as `unchanged`.

5. **Per-row error does not abort the sweep.**
   Seed three rows: `[valid, throws-mid-processing, valid]`. The middle row's failure must log but the two valid rows must still be evaluated. Encodes the "never crash startup" contract explicitly.

6. **Idempotency via sentinel.**
   Run sweep twice with no DB changes in between. Assert: second run is a no-op (use a side-effect witness — e.g. a row that would be mutated if the sweep re-ran, which it won't because sentinel is present). Sentinel row count is exactly 1.

7. **Version bump creates a fresh sentinel and re-runs.**
   Simulate by running the sweep, then `UPDATE relaymon_migrations SET name = 'nostrings_sweep_v0.3.0' WHERE name = 'nostrings_sweep_v${VERSION}'`, then running again. Assert: sweep re-executed (a previously-disqualified seeded row is now soft-ignored) and a new sentinel row for the current `VERSION` exists alongside the old `v0.3.0` one. This test encodes the key behavioral contract of the whole design: the sweep re-triggers exactly when nostrings bumps.

8. **Zero-row DB.**
   Run sweep on an empty `relay_status`. Assert: no errors, sentinel inserted, structured log line shows `rows_evaluated: 0`.

### Out of scope for this test file

- `drainRemediationDeletionQueue` publishing — already covered in `deletion.test.ts`.
- `IgnoreListSync` snapshot ordering — already covered in `ignorelist-sync.test.ts`; the sweep inherits the contract by running inside the same awaited `initializeDB`.
- Real nostrings predicate correctness — `libraries/nostrings`' own test suite owns this.
- `initializeDB` ordering (rehash → dedup → sweep) — implicitly exercised by every existing test that calls `initializeDB`; a regression in the call site will break those tests.

## Files touched

| File | Change |
|------|--------|
| `libraries/nostrings/src/index.ts` | Add `export const VERSION = "0.4.0";` |
| `apps/relaymon/src/utils/remediation.ts` | Add `rerunNostringsSweepMigration`, `hardDeleteRow`, `softIgnoreRow` |
| `apps/relaymon/src/db/db.ts` | Call `rerunNostringsSweepMigration()` after `rerunDedupForAllRowsMigration()` in `initializeDB` |
| `apps/relaymon/tests/unit/nostrings-sweep.test.ts` | New test file with the eight cases above |

No schema changes. `relaymon_migrations` already has the `(name, applied_at)` shape we need.

## Version-bump protocol

When a sanitization fix ships in nostrings:

1. Change the rule in `libraries/nostrings/src/relay-urls.ts`.
2. Update `CHANGELOG.md` (changesets flow already handles this).
3. **Bump `VERSION` in `libraries/nostrings/src/index.ts` to match the new `package.json` version.** This is the load-bearing step — without it the sweep will not re-trigger on consumer restart.
4. Add unit tests for the rule in `libraries/nostrings/src/relay-urls.test.ts`.
5. On next relaymon restart, the sweep automatically picks up the new version and re-evaluates every row.

No action required from consumers beyond a dependency bump.
