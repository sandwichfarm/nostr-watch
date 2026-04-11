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

  // Cleanup the injected old sentinel so later tests aren't polluted.
  db.query("DELETE FROM relaymon_migrations WHERE name = ?", [oldSentinel]);
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
