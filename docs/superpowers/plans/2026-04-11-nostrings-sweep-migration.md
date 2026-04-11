# Nostrings Sweep Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give relaymon a one-shot, version-gated migration that re-runs `@nostrwatch/nostrings` qualification over every `relay_status` row, hard-deleting unparseable garbage and soft-ignoring parseable-but-disqualified URLs, so that nostrings fixes propagate retroactively to existing databases.

**Architecture:** Nostrings stays a pure predicate library and gains only one new export — a `VERSION` constant hand-bumped per release. Relaymon gains a sentinel-gated sweep function in `utils/remediation.ts` that follows the exact shape of the existing `rerunDedupForAllRowsMigration`, wired into `initializeDB` after the dedup migration so `IgnoreListSync` sees the post-sweep view. The sentinel name embeds the nostrings version (`nostrings_sweep_v${VERSION}`), which causes the sweep to re-trigger exactly once per database per nostrings version bump.

**Tech Stack:** TypeScript / Deno for relaymon (uses `deno.land/x/sqlite`, `deno test`). TypeScript / Node for nostrings (vitest, tsc). The two apps communicate via a Deno import-map alias `@nostrwatch/nostrings` → `../../libraries/nostrings/src/index.ts`.

**Spec reference:** `docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md`

---

## File Structure

| File | Role | Status |
|------|------|--------|
| `libraries/nostrings/src/index.ts` | Add `VERSION` named export | Modify |
| `apps/relaymon/src/utils/remediation.ts` | Add `rerunNostringsSweepMigration`, `hardDeleteRow`, `softIgnoreRow` | Modify |
| `apps/relaymon/src/db/db.ts` | Call the sweep after `rerunDedupForAllRowsMigration()` in `initializeDB` | Modify |
| `apps/relaymon/tests/unit/nostrings-sweep.test.ts` | New test file with all sweep unit tests | Create |

No schema changes. `relaymon_migrations` already has the `(name TEXT PRIMARY KEY, applied_at INTEGER)` shape required.

---

## Task 1: Export `VERSION` constant from nostrings

**Files:**
- Modify: `libraries/nostrings/src/index.ts`

**Why:** The sweep migration in relaymon uses `VERSION` as part of the sentinel name. A hand-bumped constant in `index.ts` is the simplest Deno-compatible mechanism — no runtime `package.json` read, no build-time codegen.

- [ ] **Step 1: Read the current `index.ts`**

Run: inspect the file to confirm it contains the re-export and default object, nothing more.

Expected current content:
```ts
export * from "./relay-urls.js";
import relayUrls from "./relay-urls.js";

export default {
  sanitize: { relayUrls }
}
```

- [ ] **Step 2: Add the `VERSION` export**

Modify `libraries/nostrings/src/index.ts` so the final content is:

```ts
export * from "./relay-urls.js";
import relayUrls from "./relay-urls.js";

/**
 * Current version of @nostrwatch/nostrings. MUST be kept in sync with
 * package.json on every release. Consumers (notably apps/relaymon) use
 * this to version-gate retroactive sanitization sweeps — bumping this
 * constant triggers a one-shot re-evaluation of every row in the
 * consumer database under the new rules. If you change sanitization
 * logic, bump package.json AND this constant in the same PR.
 */
export const VERSION = "0.4.0";

export default {
  sanitize: { relayUrls }
}
```

The value `"0.4.0"` matches the current `package.json` version.

- [ ] **Step 3: Verify the library still builds**

Run: `pnpm -C libraries/nostrings build`
Expected: `tsc` exits 0, `libraries/nostrings/dist/index.js` contains the new export.

- [ ] **Step 4: Verify the nostrings test suite still passes**

Run: `pnpm -C libraries/nostrings test`
Expected: all existing tests pass. No new tests for `VERSION` — the load-bearing contract ("VERSION matches package.json") is enforced at PR review, not runtime.

- [ ] **Step 5: Commit**

```bash
git add libraries/nostrings/src/index.ts
git commit -m "$(cat <<'EOF'
feat(nostrings): export VERSION constant for consumer sweep migrations

Consumers version-gate retroactive sanitization sweeps against this
constant. Must be kept in sync with package.json on every release.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Stub `rerunNostringsSweepMigration` and helpers in `remediation.ts`

**Files:**
- Modify: `apps/relaymon/src/utils/remediation.ts`

**Why:** Create the function signatures and stubs so Task 3's test file can import them and fail on assertions rather than import errors. This is the TDD "write the skeleton" step.

- [ ] **Step 1: Add imports**

Open `apps/relaymon/src/utils/remediation.ts`. The existing first import at line 34 is:

```ts
import { db, getRelayInfo } from "../db/db.ts";
```

Replace it with (adding two items from the same module, plus a new `@nostrwatch/nostrings` import line immediately after):

```ts
import { db, getRelayInfo, clearDeltaState, clearPeriodSnapshots } from "../db/db.ts";
import { VERSION, qualifyRelayUrl } from "@nostrwatch/nostrings";
```

`clearDeltaState` and `clearPeriodSnapshots` already exist in `apps/relaymon/src/db/db.ts` (lines 429 and 513). `VERSION` was added in Task 1. `qualifyRelayUrl` is re-exported from `libraries/nostrings/src/index.ts` via `export * from "./relay-urls.js"`.

- [ ] **Step 2: Add the sentinel constant**

Below the existing `const MIGRATION_NAME = "rerun_dedup_all_rows_v2";` line (~line 48), add:

```ts
// Sentinel for the nostrings sweep. Embeds the current nostrings
// VERSION so each library bump creates a fresh sentinel row and
// re-triggers the sweep exactly once per DB per version. See the spec
// at docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md
const NOSTRINGS_SWEEP_MIGRATION_NAME = `nostrings_sweep_v${VERSION}`;
```

- [ ] **Step 3: Add stub implementations**

At the bottom of `apps/relaymon/src/utils/remediation.ts`, append:

```ts
/**
 * Hard-delete a row from relay_status and all satellite tables in a
 * single SQLite transaction. Used by the nostrings sweep for rows
 * whose url is unparseable by `new URL()`. Satellite deletes must be
 * atomic with the relay_status delete so a crash mid-row cannot leave
 * orphaned rows in relay_info / relay_delta_state / relay_period_snapshots.
 *
 * The deno.land/x/sqlite binding does NOT expose a callback-style
 * `db.transaction(fn)` — BEGIN / COMMIT / ROLLBACK must be emitted via
 * `db.query(...)`. See the precedent at apps/relaymon/src/core/main.ts:196.
 *
 * `enqueueRemediationDeletion` is called AFTER the transaction commits:
 * it writes to a separate logical queue, is already idempotent on url,
 * and should not block the row-removal atomicity if the deletion
 * publisher subsystem is unavailable.
 */
function hardDeleteRow(url: string, reason: string): void {
  db.query("BEGIN TRANSACTION");
  try {
    db.query(`DELETE FROM relay_status WHERE url = ?`, [url]);
    db.query(`DELETE FROM relay_info   WHERE url = ?`, [url]);
    clearDeltaState(url);
    clearPeriodSnapshots(url);
    db.query("COMMIT");
  } catch (e) {
    db.query("ROLLBACK");
    throw e;
  }
  enqueueRemediationDeletion(url, reason);
  logger.info(`Nostrings sweep: hard-deleted ${url}`);
}

/**
 * Soft-ignore a row: keep it in relay_status as a tombstone so
 * IgnoreListSync will use it to short-circuit future re-ingestion of
 * the same URL string, but mark it ignored with a sweep-scoped reason.
 * Satellite tables are intentionally left intact — the row is still a
 * known entity, just one we refuse to check. A kind:5 deletion for any
 * previously-published relay-check event is queued for the daemon to
 * drain after wiring.
 */
function softIgnoreRow(url: string, reason: string): void {
  db.query(
    `UPDATE relay_status SET ignore = 1, ignore_reason = ? WHERE url = ?`,
    [reason, url],
  );
  enqueueRemediationDeletion(url, reason);
  logger.info(`Nostrings sweep: soft-ignored ${url}`);
}

/**
 * Re-run @nostrwatch/nostrings qualification over every row in
 * relay_status. Hard-deletes unparseable garbage, soft-ignores
 * parseable-but-disqualified URLs, leaves valid URLs alone. Idempotent
 * per nostrings VERSION via a sentinel row in relaymon_migrations.
 *
 * Ordering: MUST run AFTER rerunDedupForAllRowsMigration in initializeDB
 * because dedup operates on row identity and walks every row — adding
 * rows underneath it is unsafe, but this sweep only removes/ignores, so
 * appending it at the end is fine.
 *
 * Contract: never throws. Per-row errors are caught inside the loop so
 * one bad row cannot abort the sweep. Top-level try/catch swallows any
 * unexpected failure and logs it. Same "never crash startup" contract
 * as the existing migrations.
 */
export async function rerunNostringsSweepMigration(): Promise<void> {
  throw new Error("rerunNostringsSweepMigration: not yet implemented");
}
```

- [ ] **Step 4: Verify the module still compiles**

Run: `cd apps/relaymon && deno check src/utils/remediation.ts`
Expected: zero errors. The stub throws at runtime but the module imports cleanly.

- [ ] **Step 5: Commit**

```bash
git add apps/relaymon/src/utils/remediation.ts
git commit -m "$(cat <<'EOF'
feat(relaymon): stub rerunNostringsSweepMigration + helpers

Add signatures and helper bodies for the nostrings sweep migration.
The sweep function itself is a throwing stub — implementation follows
in the next commit after the tests are in place. Helpers are complete
because they have no nostrings dependency and the test file will
exercise them via the public sweep function.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Write failing unit tests for the sweep

**Files:**
- Create: `apps/relaymon/tests/unit/nostrings-sweep.test.ts`

**Why:** Lock in every behavioral contract from the spec as a test before implementing the body. All tests in this file will fail at first (the stub throws) — that's correct red state.

The test file follows the exact pattern of `apps/relaymon/tests/unit/hostname-dedup.test.ts`: module-level `initializeDB(":memory:", false)` at file load, a `dedupTest` helper with resource sanitization disabled, and a `setupDatabase` helper that seeds rows directly via `db.query`.

- [ ] **Step 1: Create the test file**

Create `apps/relaymon/tests/unit/nostrings-sweep.test.ts` with the following content:

```ts
/**
 * Nostrings Sweep Migration Tests
 *
 * Tests for rerunNostringsSweepMigration — the one-shot, version-gated
 * migration that re-runs @nostrwatch/nostrings qualification over every
 * row in relay_status. See the spec at
 * docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md
 *
 * Covers 8 behavioral cases:
 *   1. Garbage URL (unparseable hostname like wss://https/catbox.moe)
 *      → hard-deleted from relay_status + all satellite tables
 *   2. Unparseable URL (throws on `new URL()`)
 *      → hard-deleted
 *   3. Parseable-but-disqualified URL (blocklist hit)
 *      → soft-ignored, satellite tables untouched, queued for kind:5
 *   4. Valid URL → unchanged
 *   5. Mixed DB: garbage + disqualified + valid in one run
 *      → each row processed per its branch, loop iterates all rows
 *   6. Idempotency: second call is a no-op (sentinel-guarded)
 *   7. Version bump: old sentinel present does NOT prevent a run
 *      for a new VERSION — this encodes the core "sweep re-triggers on
 *      nostrings bump" contract
 *   8. Zero-row DB: no errors, sentinel inserted, structured log line
 */

import { assertEquals, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { VERSION } from "@nostrwatch/nostrings";
import { initializeDB, db, storeRelayInfo, storeDeltaState, storePeriodSnapshot } from "../../src/db/db.ts";
import { rerunNostringsSweepMigration } from "../../src/utils/remediation.ts";
import { setConfig } from "../../src/utils/hostnames.ts";
import { mockConfig } from "../helpers/fixtures.ts";
import type { Config } from "../../src/types/config.ts";
import type { RelayInfo } from "../../src/types/relay.ts";

// Helper for async tests that need resource sanitization disabled —
// the initializeDB call holds open a sqlite handle for the lifetime of
// the test process, which trips Deno's default resource sanitizer.
function sweepTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

// Initialize test database. This call itself runs the sweep once on an
// empty DB, which inserts a `nostrings_sweep_v${VERSION}` sentinel row.
// Every test below must reset that sentinel before calling the sweep,
// identical to the dedup test pattern in hostname-dedup.test.ts.
initializeDB(":memory:", false);
setConfig(mockConfig as Config);

const SENTINEL = `nostrings_sweep_v${VERSION}`;

// Reset the sentinel and wipe all tables the sweep touches. Call this
// at the top of every test to guarantee isolation.
function resetSweepState() {
  db.query("DELETE FROM relaymon_migrations WHERE name = ?", [SENTINEL]);
  db.query("DELETE FROM relay_status");
  db.query("DELETE FROM relay_info");
  db.query("DELETE FROM relay_delta_state");
  db.query("DELETE FROM relay_period_snapshots");
  db.query("DELETE FROM remediation_deletion_queue");
}

// Seed a row in relay_status plus any satellite tables that the
// caller cares about. Each satellite table is optional so individual
// tests can seed only what they need.
interface SeedRow {
  url: string;
  online?: boolean;
  ignore?: boolean;
  info?: RelayInfo;
  deltaState?: boolean;
  periodSnapshot?: boolean;
}
function seedRow(row: SeedRow) {
  db.query(
    `INSERT OR REPLACE INTO relay_status
     (url, online, ignore, ignore_reason, parent, checked_at, rtt, network, retries)
     VALUES (?, ?, ?, '', '', ?, 0, 'clearnet', 0)`,
    [
      row.url,
      row.online === false ? 0 : 1,
      row.ignore ? 1 : 0,
      Math.floor(Date.now() / 1000),
    ],
  );
  if (row.info) {
    storeRelayInfo(row.url, row.info, "test_hash_" + row.url);
  }
  if (row.deltaState) {
    storeDeltaState(row.url, {
      state: row.info ?? ({} as RelayInfo),
      rttOpen: 100,
      rttRead: 100,
      rttWrite: 100,
    });
  }
  if (row.periodSnapshot) {
    storePeriodSnapshot(row.url, "1d", row.info ?? ({} as RelayInfo));
  }
}

// Count rows matching a url across all four tables. Used by hard-delete
// tests to prove the satellite tables were cleared atomically.
function countAcrossTables(url: string): {
  status: number;
  info: number;
  delta: number;
  snapshot: number;
} {
  return {
    status: db.query("SELECT COUNT(*) FROM relay_status WHERE url = ?", [url])[0][0] as number,
    info: db.query("SELECT COUNT(*) FROM relay_info WHERE url = ?", [url])[0][0] as number,
    delta: db.query("SELECT COUNT(*) FROM relay_delta_state WHERE url = ?", [url])[0][0] as number,
    snapshot: db.query("SELECT COUNT(*) FROM relay_period_snapshots WHERE url = ?", [url])[0][0] as number,
  };
}

function queueEntriesFor(url: string): number {
  return db.query(
    "SELECT COUNT(*) FROM remediation_deletion_queue WHERE url = ?",
    [url],
  )[0][0] as number;
}

// ============================================================================
// Case 1: Garbage URL → hard-deleted + all satellite tables cleared
// ============================================================================
sweepTest("Case 1: garbage URL is hard-deleted from all tables and queued for kind:5", async () => {
  resetSweepState();

  const url = "wss://https/catbox.moe"; // nostrings v0.4.0 rejects this
  seedRow({
    url,
    info: { name: "garbage", description: "", software: "strfry", version: "1" },
    deltaState: true,
    periodSnapshot: true,
  });

  // Sanity: all four tables have the row before the sweep.
  const before = countAcrossTables(url);
  assertEquals(before.status, 1);
  assertEquals(before.info, 1);
  assertEquals(before.delta, 1);
  assertEquals(before.snapshot, 1);

  await rerunNostringsSweepMigration();

  // After: all four tables must have zero rows for this url.
  const after = countAcrossTables(url);
  assertEquals(after.status, 0, "relay_status row must be deleted");
  assertEquals(after.info, 0, "relay_info row must be deleted");
  assertEquals(after.delta, 0, "relay_delta_state row must be cleared");
  assertEquals(after.snapshot, 0, "relay_period_snapshots row must be cleared");

  // And the deletion queue has exactly one entry for the URL.
  assertEquals(queueEntriesFor(url), 1, "deletion must be queued for kind:5");
});

// ============================================================================
// Case 2: Unparseable URL → hard-deleted
// ============================================================================
// Note: qualifyRelayUrl already catches URL parse errors and returns false
// internally, so we need a URL that also makes `new URL(url)` in the sweep
// itself throw. An empty string throws; a whitespace-containing string also
// throws (at least in current V8). Use whitespace so the row is visibly
// distinct from an empty string in the seeded DB.
sweepTest("Case 2: unparseable URL (whitespace) is hard-deleted", async () => {
  resetSweepState();

  const url = "wss:// has spaces";
  seedRow({ url });

  // Sanity: new URL() really does throw on this input.
  let threw = false;
  try { new URL(url); } catch { threw = true; }
  assert(threw, "test precondition: new URL() must throw on whitespace input");

  await rerunNostringsSweepMigration();

  const after = countAcrossTables(url);
  assertEquals(after.status, 0, "unparseable row must be hard-deleted");
  assertEquals(queueEntriesFor(url), 1);
});

// ============================================================================
// Case 3: Disqualified-but-parseable URL → soft-ignored, row stays
// ============================================================================
sweepTest("Case 3: disqualified-but-parseable URL is soft-ignored, row stays, satellites untouched", async () => {
  resetSweepState();

  // nostrings ships a blocklist that rejects echo.websocket.org.
  // The URL parses fine; qualifyRelayUrl returns false on the hostname match.
  const url = "wss://echo.websocket.org";
  seedRow({
    url,
    info: { name: "echo", description: "", software: "strfry", version: "1" },
    deltaState: true,
    periodSnapshot: true,
  });

  await rerunNostringsSweepMigration();

  // relay_status row still present, now ignored
  const statusRow = db.query(
    "SELECT ignore, ignore_reason FROM relay_status WHERE url = ?",
    [url],
  );
  assertEquals(statusRow.length, 1, "relay_status row must still exist (tombstone)");
  assertEquals(statusRow[0][0], 1, "row must now be ignore=1");
  assert(
    (statusRow[0][1] as string).startsWith("Rejected by nostrings"),
    "ignore_reason must be the sweep-scoped reason",
  );

  // Satellite tables untouched: this is the tombstone contract.
  const counts = countAcrossTables(url);
  assertEquals(counts.info, 1, "relay_info must be untouched for soft-ignored rows");
  assertEquals(counts.delta, 1, "relay_delta_state must be untouched for soft-ignored rows");
  assertEquals(counts.snapshot, 1, "relay_period_snapshots must be untouched for soft-ignored rows");

  // Kind:5 deletion is queued.
  assertEquals(queueEntriesFor(url), 1);
});

// ============================================================================
// Case 4: Valid URL → unchanged
// ============================================================================
sweepTest("Case 4: valid URL is left entirely alone (unchanged counter)", async () => {
  resetSweepState();

  const url = "wss://relay.example.com/";
  seedRow({
    url,
    info: { name: "ok", description: "", software: "strfry", version: "1" },
    deltaState: true,
    periodSnapshot: true,
  });

  await rerunNostringsSweepMigration();

  // relay_status row unchanged, ignore still 0
  const statusRow = db.query(
    "SELECT ignore, ignore_reason FROM relay_status WHERE url = ?",
    [url],
  );
  assertEquals(statusRow.length, 1);
  assertEquals(statusRow[0][0], 0, "valid URL must remain ignore=0");
  assertEquals(statusRow[0][1], "", "valid URL must have empty ignore_reason");

  // All satellite tables intact.
  const counts = countAcrossTables(url);
  assertEquals(counts.info, 1);
  assertEquals(counts.delta, 1);
  assertEquals(counts.snapshot, 1);

  // No deletion queued.
  assertEquals(queueEntriesFor(url), 0);
});

// ============================================================================
// Case 5: Mixed DB → each row processed per its branch in one pass
// ============================================================================
// This test loosely stands in for a "per-row error does not abort" test
// by proving the loop iterates ALL rows in a single pass. If any row
// aborted the loop, subsequent rows would be unprocessed and the
// assertions below would fail.
sweepTest("Case 5: mixed DB — one garbage + one disqualified + one valid row in one run", async () => {
  resetSweepState();

  const garbage = "wss://https/catbox.moe";
  const disqualified = "wss://echo.websocket.org";
  const valid = "wss://relay.example.com/";

  seedRow({ url: garbage });
  seedRow({ url: disqualified });
  seedRow({ url: valid });

  await rerunNostringsSweepMigration();

  // Garbage: gone from relay_status.
  assertEquals(
    db.query("SELECT COUNT(*) FROM relay_status WHERE url = ?", [garbage])[0][0],
    0,
    "garbage row must be hard-deleted",
  );
  // Disqualified: still present, but ignored.
  const disqRow = db.query(
    "SELECT ignore FROM relay_status WHERE url = ?",
    [disqualified],
  );
  assertEquals(disqRow.length, 1);
  assertEquals(disqRow[0][0], 1, "disqualified row must be soft-ignored");
  // Valid: untouched.
  const validRow = db.query(
    "SELECT ignore FROM relay_status WHERE url = ?",
    [valid],
  );
  assertEquals(validRow.length, 1);
  assertEquals(validRow[0][0], 0, "valid row must be unchanged");
});

// ============================================================================
// Case 6: Idempotency — second call is a no-op (sentinel-guarded)
// ============================================================================
sweepTest("Case 6: second call is a no-op — sentinel blocks re-execution", async () => {
  resetSweepState();

  const disqualified = "wss://echo.websocket.org";
  seedRow({ url: disqualified });

  // First run: soft-ignores the row and inserts the sentinel.
  await rerunNostringsSweepMigration();

  const sentinelAfterFirst = db.query(
    "SELECT COUNT(*) FROM relaymon_migrations WHERE name = ?",
    [SENTINEL],
  );
  assertEquals(sentinelAfterFirst[0][0], 1, "sentinel must be present after first run");

  // Witness: un-ignore the row manually. If the sweep ran again, it
  // would re-ignore it. If the sentinel works, the row stays ignore=0.
  db.query(
    "UPDATE relay_status SET ignore = 0, ignore_reason = '' WHERE url = ?",
    [disqualified],
  );

  // Second run: MUST be a no-op.
  await rerunNostringsSweepMigration();

  const witnessRow = db.query(
    "SELECT ignore FROM relay_status WHERE url = ?",
    [disqualified],
  );
  assertEquals(
    witnessRow[0][0],
    0,
    "second run must not touch the row — sentinel guards it",
  );

  // Sentinel row count is still exactly 1 (no duplicate insert).
  const sentinelAfterSecond = db.query(
    "SELECT COUNT(*) FROM relaymon_migrations WHERE name = ?",
    [SENTINEL],
  );
  assertEquals(sentinelAfterSecond[0][0], 1);
});

// ============================================================================
// Case 7: Version bump → old sentinel does NOT prevent a new-version run
// ============================================================================
// We can't mutate VERSION at runtime (it's a const import from nostrings),
// so we simulate the "old version" state by injecting an old sentinel row.
// The sweep must notice that the CURRENT-version sentinel is absent and
// run anyway, leaving the old sentinel in place alongside the new one.
sweepTest("Case 7: old-version sentinel does NOT prevent a new-version sweep", async () => {
  resetSweepState();

  const oldSentinel = "nostrings_sweep_v0.3.0"; // pretend a prior run existed
  db.query(
    "INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)",
    [oldSentinel, Math.floor(Date.now() / 1000) - 86400],
  );

  const disqualified = "wss://echo.websocket.org";
  seedRow({ url: disqualified });

  // Current-version sentinel is absent → sweep MUST run.
  await rerunNostringsSweepMigration();

  // The disqualified row was soft-ignored by the sweep.
  const row = db.query(
    "SELECT ignore FROM relay_status WHERE url = ?",
    [disqualified],
  );
  assertEquals(row[0][0], 1, "sweep must have run under new VERSION");

  // Both sentinels present: the old one untouched, the new one inserted.
  const old = db.query(
    "SELECT COUNT(*) FROM relaymon_migrations WHERE name = ?",
    [oldSentinel],
  );
  assertEquals(old[0][0], 1, "old-version sentinel must be left in place");
  const current = db.query(
    "SELECT COUNT(*) FROM relaymon_migrations WHERE name = ?",
    [SENTINEL],
  );
  assertEquals(current[0][0], 1, "current-version sentinel must be inserted");
});

// ============================================================================
// Case 8: Zero-row DB → sentinel still inserted, no errors
// ============================================================================
sweepTest("Case 8: zero-row DB is handled cleanly — sentinel still inserted", async () => {
  resetSweepState();

  // relay_status is empty. The sweep has nothing to iterate, but must
  // still insert its sentinel on successful completion.
  await rerunNostringsSweepMigration();

  const sentinel = db.query(
    "SELECT COUNT(*) FROM relaymon_migrations WHERE name = ?",
    [SENTINEL],
  );
  assertEquals(sentinel[0][0], 1, "sentinel must be inserted even on empty DB");
});
```

- [ ] **Step 2: Verify all tests fail with the stub**

Run: `cd apps/relaymon && deno test --allow-all tests/unit/nostrings-sweep.test.ts`
Expected: all 8 tests fail. They should fail because the stub `rerunNostringsSweepMigration` throws `"not yet implemented"` — NOT because of import errors, NOT because of missing types.

If you see import errors, fix them before moving on. If you see `TS2307` or missing-export errors from the stub file, revisit Task 2.

- [ ] **Step 3: Commit**

```bash
git add apps/relaymon/tests/unit/nostrings-sweep.test.ts
git commit -m "$(cat <<'EOF'
test(relaymon): failing unit tests for nostrings sweep migration

Covers 8 behavioral cases from the spec:
  1. garbage URL hard-deleted across all four tables
  2. unparseable URL (whitespace) hard-deleted
  3. disqualified URL soft-ignored, satellites untouched
  4. valid URL unchanged
  5. mixed DB processed in one pass
  6. second call is a no-op (sentinel-guarded)
  7. old-version sentinel does NOT prevent a new-version run
  8. zero-row DB handled cleanly

All tests currently fail — sweep implementation follows in next commit.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement `rerunNostringsSweepMigration` body

**Files:**
- Modify: `apps/relaymon/src/utils/remediation.ts`

**Why:** Replace the throwing stub with the real sweep so all 8 tests go green.

- [ ] **Step 1: Replace the stub body**

In `apps/relaymon/src/utils/remediation.ts`, replace the entire `rerunNostringsSweepMigration` function body (the one that throws) with:

```ts
export async function rerunNostringsSweepMigration(): Promise<void> {
  // Top-level try: never let this migration crash startup.
  try {
    // Idempotency guard: sentinel row in relaymon_migrations means we
    // already ran on this DB for the current nostrings VERSION. Return
    // silently. A nostrings version bump changes the sentinel name and
    // naturally re-triggers the sweep.
    const existing = db.query(
      `SELECT applied_at FROM relaymon_migrations WHERE name = ?`,
      [NOSTRINGS_SWEEP_MIGRATION_NAME],
    );
    if (existing.length > 0) {
      logger.debug(
        `Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} already applied, skipping`,
      );
      return;
    }

    logger.info(`Running migration: ${NOSTRINGS_SWEEP_MIGRATION_NAME}`);
    const startTime = Date.now();

    // Pull just the url column — we don't need anything else to decide.
    const rows = db.query(`SELECT url FROM relay_status`);

    let evaluated = 0;
    let hardDeleted = 0;
    let softIgnored = 0;
    let unchanged = 0;

    for (const [urlRaw] of rows) {
      const url = urlRaw as string;
      evaluated++;

      try {
        // Garbage-URL branch: unparseable → hard delete. qualifyRelayUrl
        // would also return false here, but we want the distinct
        // hard-delete action for "row should never have existed".
        let parseable = true;
        try {
          new URL(url);
        } catch {
          parseable = false;
        }

        if (!parseable) {
          hardDeleteRow(
            url,
            `Garbage URL rejected by nostrings v${VERSION}`,
          );
          hardDeleted++;
          continue;
        }

        // Disqualified-but-parseable branch: soft-ignore tombstone.
        // Keeps the row around so IgnoreListSync can short-circuit
        // future re-ingestion of the same string.
        if (!qualifyRelayUrl(url)) {
          softIgnoreRow(
            url,
            `Rejected by nostrings v${VERSION}: disqualified`,
          );
          softIgnored++;
          continue;
        }

        // Still valid under the current rules — leave alone.
        unchanged++;
      } catch (e) {
        // Per-row defensive catch: one bad row must not abort the
        // sweep. The specific failure mode we care about is a
        // transaction failure inside hardDeleteRow — rollback already
        // happened there, we just need to log and continue.
        logger.error(
          `Nostrings sweep: failed to evaluate ${url}: ${e}`,
        );
      }
    }

    const durationMs = Date.now() - startTime;

    // Structured JSON summary — single greppable line. Field names
    // stable for post-rollout grep.
    logger.info(
      JSON.stringify({
        migration: NOSTRINGS_SWEEP_MIGRATION_NAME,
        rows_evaluated: evaluated,
        hard_deleted: hardDeleted,
        soft_ignored: softIgnored,
        unchanged: unchanged,
        duration_ms: durationMs,
      }),
    );

    // Insert sentinel ONLY after successful completion so a partial
    // run (crash, SIGKILL) is retried on the next startup.
    db.query(
      `INSERT INTO relaymon_migrations (name, applied_at) VALUES (?, ?)`,
      [NOSTRINGS_SWEEP_MIGRATION_NAME, Math.floor(Date.now() / 1000)],
    );

    logger.info(
      `Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} complete: ${evaluated} evaluated, ${hardDeleted} hard-deleted, ${softIgnored} soft-ignored, ${unchanged} unchanged, ${durationMs}ms`,
    );
  } catch (e) {
    // Top-level: never crash startup.
    logger.error(`Migration ${NOSTRINGS_SWEEP_MIGRATION_NAME} failed: ${e}`);
  }
}
```

- [ ] **Step 2: Run the new test file to confirm green**

Run: `cd apps/relaymon && deno test --allow-all tests/unit/nostrings-sweep.test.ts`
Expected: all 8 tests pass.

If any fail, read the failure carefully — the most likely culprits are:
- Case 2 (whitespace URL): if Deno/V8 accepts the whitespace as a valid URL, the test precondition `assert(threw)` will flag it, not the sweep. Adjust the URL to something that definitely throws (empty string, `"not a url at all"`, etc.)
- Case 3 (echo.websocket.org): confirm `qualifyRelayUrl("wss://echo.websocket.org")` returns `false` in the current nostrings source. If it's still returning true, the blocklist matching may have changed — update the URL to a different disqualified form.
- Case 7 (version bump): if `VERSION` is something other than `"0.4.0"`, the `oldSentinel` literal `"nostrings_sweep_v0.3.0"` is still valid (it just needs to be a DIFFERENT version from current).

- [ ] **Step 3: Run the existing dedup tests to confirm no regression**

Run: `cd apps/relaymon && deno test --allow-all tests/unit/hostname-dedup.test.ts`
Expected: all existing dedup tests still pass. They import from the same `remediation.ts` file we just modified; adding exports is backwards-compatible but worth confirming.

- [ ] **Step 4: Commit**

```bash
git add apps/relaymon/src/utils/remediation.ts
git commit -m "$(cat <<'EOF'
feat(relaymon): implement rerunNostringsSweepMigration body

Replace the throwing stub with the real sweep. Turns all 8 unit tests
from the previous commit green. Behavior:

  - iterate every row in relay_status
  - unparseable URL → hardDeleteRow (all four tables + kind:5 queue)
  - parseable but !qualifyRelayUrl → softIgnoreRow (tombstone + queue)
  - otherwise → unchanged
  - sentinel-gate on nostrings_sweep_v${VERSION}
  - never throws (per-row + top-level defensive catches)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire the sweep into `initializeDB`

**Files:**
- Modify: `apps/relaymon/src/db/db.ts`

**Why:** The sweep must run on every relaymon startup so the version-gated sentinel check fires. Ordering: AFTER `rerunDedupForAllRowsMigration` because dedup walks every row and removing rows underneath it is fine but adding is not. The sweep only removes/ignores, so appending at the end is safe.

- [ ] **Step 1: Update the imports in `db.ts`**

Open `apps/relaymon/src/db/db.ts`. At line 5, the existing import is:

```ts
import { rerunDedupForAllRowsMigration } from "../utils/remediation.ts";
```

Change it to:

```ts
import {
  rerunDedupForAllRowsMigration,
  rerunNostringsSweepMigration,
} from "../utils/remediation.ts";
```

- [ ] **Step 2: Add the call in `initializeDB`**

In the same file, find the end of the `rerunDedupForAllRowsMigration` block inside `initializeDB` (around line 143, just after the `try { await rerunDedupForAllRowsMigration(); } catch (e) { ... }` block). Directly after that block, add:

```ts
  // Nostrings sweep: re-run @nostrwatch/nostrings qualification over
  // every row in relay_status, hard-deleting unparseable garbage and
  // soft-ignoring parseable-but-disqualified URLs. Sentinel-gated per
  // nostrings VERSION so each library bump re-triggers the sweep
  // exactly once per DB. MUST run AFTER rerunDedupForAllRowsMigration
  // because dedup walks every row and should not have rows added
  // underneath it — the sweep only removes/ignores, so appending here
  // is safe. Spec: docs/superpowers/specs/2026-04-11-nostrings-sweep-migration-design.md
  try {
    await rerunNostringsSweepMigration();
  } catch (e) {
    logger.error(`rerunNostringsSweepMigration threw: ${e}`);
  }
```

Note: the `try/catch` here is belt-and-suspenders — the sweep's own top-level catch already guarantees it never throws — but it matches the pattern of the other migration calls above it and costs nothing.

- [ ] **Step 3: Verify `db.ts` still type-checks**

Run: `cd apps/relaymon && deno check src/db/db.ts`
Expected: zero errors.

- [ ] **Step 4: Run the full unit test suite**

Run: `cd apps/relaymon && deno test --allow-all tests/unit/`
Expected: all tests pass, including both `hostname-dedup.test.ts` and the new `nostrings-sweep.test.ts`.

Any existing test that calls `initializeDB` will now implicitly trigger the sweep on its in-memory DB. This is harmless because the sweep is idempotent and the DB is empty at init time, so it just inserts the sentinel and returns. But if any existing test was relying on an empty `relaymon_migrations` table, it may need to adjust its cleanup. Watch the output carefully.

If an existing test breaks because it now sees an extra row in `relaymon_migrations`, the fix is usually: add `db.query("DELETE FROM relaymon_migrations WHERE name LIKE 'nostrings_sweep_%'")` to that test's setup. Do NOT adjust the sweep itself to work around it.

- [ ] **Step 5: Run the integration tests for safety**

Run: `cd apps/relaymon && deno test --allow-all tests/integration/`
Expected: existing integration tests still pass. The sweep has no external dependencies, so this should be a no-op, but run it as a smoke test.

- [ ] **Step 6: Commit**

```bash
git add apps/relaymon/src/db/db.ts
git commit -m "$(cat <<'EOF'
feat(relaymon): wire rerunNostringsSweepMigration into initializeDB

Runs after rerunDedupForAllRowsMigration so dedup's row-walk sees a
stable relay_status, then the sweep evicts garbage / ignores
disqualified URLs. Sentinel-gated per nostrings VERSION — no-op until
the next library bump on an already-swept DB.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: End-to-end verification

**Files:** (no changes; verification only)

**Why:** The spec contract has three layers — nostrings export, relaymon sweep, initializeDB wiring. Each task above verified its own layer, but a single end-to-end check catches any integration issue between them.

- [ ] **Step 1: Run the full relaymon test suite**

Run: `cd apps/relaymon && deno test --allow-all`
Expected: every test in both `tests/unit/` and `tests/integration/` passes. If any existing test now fails because it didn't previously reset `relaymon_migrations`, fix that test's setup (see Task 5 Step 4 guidance).

- [ ] **Step 2: Run the full nostrings test suite**

Run: `pnpm -C libraries/nostrings test`
Expected: all nostrings tests pass. The only change to nostrings was the new `VERSION` export; nothing should regress.

- [ ] **Step 3: Spot-check the structured log line format**

Grep for the migration name in the sweep function to confirm the JSON fields are exactly `migration`, `rows_evaluated`, `hard_deleted`, `soft_ignored`, `unchanged`, `duration_ms` — in that order, with those names. Operators will grep for these fields post-rollout, so they must match the spec.

Run: `grep -A 10 "nostrings_sweep_" apps/relaymon/src/utils/remediation.ts | head -40`
Expected: a JSON.stringify block containing exactly those six field names.

- [ ] **Step 4: Confirm the file-touched list matches the spec**

Run: `git diff --stat main...HEAD`
Expected: exactly four files changed —
- `libraries/nostrings/src/index.ts` (small)
- `apps/relaymon/src/utils/remediation.ts` (moderate)
- `apps/relaymon/src/db/db.ts` (small)
- `apps/relaymon/tests/unit/nostrings-sweep.test.ts` (large — mostly test fixtures)

Plus the two docs files (`docs/superpowers/specs/...` and `docs/superpowers/plans/...`) if they aren't already on `main`.

If any OTHER file was touched — stop and investigate. The sweep has no business modifying anything outside those four paths.

- [ ] **Step 5: Sanity-check the sentinel format**

Run: a quick one-off script or REPL check:
```bash
cd apps/relaymon && deno eval 'import { VERSION } from "@nostrwatch/nostrings"; console.log(`nostrings_sweep_v${VERSION}`);'
```
Expected output: `nostrings_sweep_v0.4.0`

This confirms the import map resolves nostrings correctly and the sentinel name is well-formed — both of which are load-bearing for the sweep to ever fire in production.

- [ ] **Step 6: No final commit needed**

This task is verification only. If any step found a bug, fix it inline and commit the fix with a `fix(relaymon):` or `fix(nostrings):` prefix. Otherwise, the branch is ready for PR.

---

## Post-implementation

The branch can now go up as a PR. The PR description should mention:

- **What ships:** a version-gated migration that retroactively applies nostrings sanitization fixes to relaymon DBs on startup.
- **Why:** existing databases accumulated rows like `wss://https/catbox.moe` under old nostrings versions; current nostrings rejects these but the rows never got re-evaluated.
- **How to verify in a real DB:** bump nostrings, restart relaymon, grep the logs for a line containing `"migration":"nostrings_sweep_v..."` — that's the structured summary. Count fields should match the size of the cleanup.
- **How to regress it:** roll back the PR; the sentinel rows stay in the table (no reverse migration) but the sweep function stops being called. Safe to re-apply.
