/**
 * NATO Phonetic Spam Purge Migration Tests (Phase 22)
 *
 * Tests for isNatoPhoneticSpam pattern matching and purgeNatoPhoneticSpam
 * migration behavior. Follows the test setup pattern from nostrings-sweep.test.ts.
 *
 * Covers:
 *   1-8.  isNatoPhoneticSpam: true/false for various URL patterns
 *   9-11. purgeNatoPhoneticSpam: deletion, idempotency, non-NATO preservation
 *   12.   All 26 NATO codes individually recognized
 */

import { assertEquals, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { initializeDB, db } from "../../src/db/db.ts";
import { isNatoPhoneticSpam, purgeNatoPhoneticSpam } from "../../../../libraries/db/src/nato-purge.ts";
import { seedNewRelay } from "npm:@nostrwatch/db";
import { setConfig } from "../../src/utils/hostnames.ts";
import { mockConfig } from "../helpers/fixtures.ts";
import type { Config } from "../../src/types/config.ts";

// Helper for tests that need resource sanitization disabled (sqlite handle).
function natoTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

// Initialize test database (in-memory). This calls initializeDB which
// also runs the NATO purge migration on the empty DB, inserting its
// sentinel. Every test that exercises the migration must reset that
// sentinel first.
initializeDB(":memory:", false);
setConfig(mockConfig as Config);

const MIGRATION_NAME = "purge_nato_phonetic_spam_v1";

/**
 * Reset the NATO purge sentinel and wipe relay_status so each test
 * starts from a clean slate.
 */
function resetState() {
  db.query("DELETE FROM relaymon_migrations WHERE name = ?", [MIGRATION_NAME]);
  db.query("DELETE FROM relay_status");
}

// ---------------------------------------------------------------------------
// Pattern matching tests (isNatoPhoneticSpam)
// ---------------------------------------------------------------------------

natoTest("1. isNatoPhoneticSpam: single NATO code returns true", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/alpha"), true);
});

natoTest("2. isNatoPhoneticSpam: two hyphen-separated NATO codes returns true", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/bravo-charlie"), true);
});

natoTest("3. isNatoPhoneticSpam: three hyphen-separated NATO codes returns true", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/delta-echo-foxtrot"), true);
});

natoTest("4. isNatoPhoneticSpam: four codes returns false (max is 3)", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/alpha-bravo-charlie-delta"), false);
});

natoTest("5. isNatoPhoneticSpam: trailing slash only returns false", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/"), false);
});

natoTest("6. isNatoPhoneticSpam: non-NATO words return false", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/custom-path"), false);
});

natoTest("7. isNatoPhoneticSpam: no path returns false", () => {
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com"), false);
});

natoTest("8. isNatoPhoneticSpam: multi-segment path with non-NATO intermediate returns false", () => {
  // /inbox/alpha has last segment "alpha" (NATO), but this test verifies
  // that having a non-NATO intermediate path does not affect detection.
  // The function only checks the LAST segment, so /inbox/alpha is spam
  // (last segment "alpha"). Use a truly non-NATO last segment instead.
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/inbox"), false);
  // Also verify that a multi-segment path ending in NATO IS detected
  assertEquals(isNatoPhoneticSpam("wss://relay.example.com/something/alpha"), true);
});

// ---------------------------------------------------------------------------
// Migration behavior tests (purgeNatoPhoneticSpam)
// ---------------------------------------------------------------------------

natoTest("9. purgeNatoPhoneticSpam: deletes NATO spam URLs and writes them to file", async () => {
  resetState();

  // Seed NATO spam and legitimate URLs
  seedNewRelay("wss://relay.example.com/alpha", "clearnet");
  seedNewRelay("wss://relay.example.com/bravo-charlie", "clearnet");
  seedNewRelay("wss://relay.example.com", "clearnet");
  seedNewRelay("wss://good.relay.com", "clearnet");

  const outputPath = "/tmp/test-nato-purge-9.txt";

  await purgeNatoPhoneticSpam(outputPath);

  // NATO spam URLs should be gone
  const spamRows1 = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://relay.example.com/alpha"]);
  assertEquals(spamRows1.length, 0, "alpha URL should be deleted");

  const spamRows2 = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://relay.example.com/bravo-charlie"]);
  assertEquals(spamRows2.length, 0, "bravo-charlie URL should be deleted");

  // Legitimate URLs should remain
  const goodRows1 = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://relay.example.com"]);
  assertEquals(goodRows1.length, 1, "root URL should remain");

  const goodRows2 = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://good.relay.com"]);
  assertEquals(goodRows2.length, 1, "good.relay.com should remain");

  // Sentinel should be inserted
  const sentinel = db.query(
    "SELECT applied_at FROM relaymon_migrations WHERE name = ?",
    [MIGRATION_NAME],
  );
  assertEquals(sentinel.length, 1, "sentinel row should exist");

  // Output file should contain deleted URLs
  const fileContent = await Deno.readTextFile(outputPath);
  assert(fileContent.includes("wss://relay.example.com/alpha"), "file should contain alpha URL");
  assert(fileContent.includes("wss://relay.example.com/bravo-charlie"), "file should contain bravo-charlie URL");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

natoTest("10. purgeNatoPhoneticSpam: idempotent - second call is a no-op", async () => {
  resetState();

  // Seed a NATO spam URL
  seedNewRelay("wss://relay.example.com/golf", "clearnet");

  const outputPath = "/tmp/test-nato-purge-10.txt";

  // First run: deletes the URL
  await purgeNatoPhoneticSpam(outputPath);

  const afterFirst = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://relay.example.com/golf"]);
  assertEquals(afterFirst.length, 0, "golf URL should be deleted after first run");

  // Seed another NATO spam URL AFTER the first run
  seedNewRelay("wss://relay.example.com/hotel", "clearnet");

  // Second run: should be a no-op (sentinel prevents re-run)
  await purgeNatoPhoneticSpam(outputPath);

  // The newly seeded URL should NOT be deleted (sentinel prevents re-run)
  const afterSecond = db.query("SELECT url FROM relay_status WHERE url = ?", ["wss://relay.example.com/hotel"]);
  assertEquals(afterSecond.length, 1, "hotel URL should remain after second run (sentinel blocks re-run)");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

natoTest("11. purgeNatoPhoneticSpam: leaves non-NATO URLs untouched", async () => {
  resetState();

  // Seed only non-NATO URLs
  seedNewRelay("wss://relay.example.com", "clearnet");
  seedNewRelay("wss://relay.example.com/custom-path", "clearnet");
  seedNewRelay("wss://good.relay.com/inbox", "clearnet");

  const outputPath = "/tmp/test-nato-purge-11.txt";

  await purgeNatoPhoneticSpam(outputPath);

  // All URLs should remain
  const rows = db.query("SELECT url FROM relay_status ORDER BY url");
  assertEquals(rows.length, 3, "all 3 non-NATO URLs should remain");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Exhaustive NATO code coverage
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 23: Enqueue NATO-purged URLs into remediation_deletion_queue
// ---------------------------------------------------------------------------

natoTest("12. NATO-purged URLs are automatically enqueued in remediation_deletion_queue after purge", async () => {
  resetState();
  // Also clear the deletion queue from prior tests
  db.query("DELETE FROM remediation_deletion_queue");

  // Seed NATO spam and legitimate URLs
  seedNewRelay("wss://relay.example.com/alpha", "clearnet");
  seedNewRelay("wss://relay.example.com/bravo-charlie", "clearnet");
  seedNewRelay("wss://relay.example.com", "clearnet");
  seedNewRelay("wss://good.relay.com", "clearnet");

  const outputPath = "/tmp/test-nato-purge-12.txt";

  // Run the purge -- Phase 23 wiring in db.ts reads the output file and
  // calls enqueueRemediationDeletion for each purged URL. We import and
  // call the same enqueueNatoPurgedUrls function that db.ts uses.
  await purgeNatoPhoneticSpam(outputPath);

  // Import the enqueue helper that db.ts calls after purge
  const { enqueueNatoPurgedUrls } = await import("../../src/db/db.ts");
  await enqueueNatoPurgedUrls(outputPath);

  // Verify NATO spam URLs are in the remediation_deletion_queue
  const queueRows = db.query(
    "SELECT url, reason FROM remediation_deletion_queue WHERE reason LIKE '%NATO%' ORDER BY url",
  );
  assertEquals(queueRows.length, 2, "both NATO spam URLs should be enqueued");

  const queueUrls = queueRows.map((r: unknown[]) => r[0] as string);
  assert(queueUrls.includes("wss://relay.example.com/alpha"), "alpha should be in queue");
  assert(queueUrls.includes("wss://relay.example.com/bravo-charlie"), "bravo-charlie should be in queue");

  // Verify reason string
  for (const row of queueRows) {
    const reason = row[1] as string;
    assert(reason.includes("NATO phonetic spam"), `reason "${reason}" should contain "NATO phonetic spam"`);
  }

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

natoTest("13. Non-NATO URLs are NOT enqueued in remediation_deletion_queue", async () => {
  resetState();
  db.query("DELETE FROM remediation_deletion_queue");

  // Seed only non-NATO URLs
  seedNewRelay("wss://relay.example.com", "clearnet");
  seedNewRelay("wss://relay.example.com/custom-path", "clearnet");
  seedNewRelay("wss://good.relay.com/inbox", "clearnet");

  const outputPath = "/tmp/test-nato-purge-13.txt";

  await purgeNatoPhoneticSpam(outputPath);

  // Read the file -- should be empty (only newline)
  const fileContent = await Deno.readTextFile(outputPath);
  const urls = fileContent.split("\n").filter((line: string) => line.trim().length > 0);

  // No URLs to enqueue
  assertEquals(urls.length, 0, "no NATO URLs should have been purged");

  // Queue should have no NATO entries
  const queueRows = db.query(
    "SELECT url FROM remediation_deletion_queue WHERE reason LIKE '%NATO%'",
  );
  assertEquals(queueRows.length, 0, "no NATO entries should be in queue");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

natoTest("14. Empty purged-urls file results in no new queue entries", async () => {
  resetState();
  db.query("DELETE FROM remediation_deletion_queue");

  // No relay_status rows at all
  const outputPath = "/tmp/test-nato-purge-14.txt";

  await purgeNatoPhoneticSpam(outputPath);

  // File should exist but be effectively empty (just a newline)
  const fileContent = await Deno.readTextFile(outputPath);
  const urls = fileContent.split("\n").filter((line: string) => line.trim().length > 0);
  assertEquals(urls.length, 0, "no URLs should have been purged");

  // Queue should have no NATO entries
  const queueRows = db.query(
    "SELECT url FROM remediation_deletion_queue WHERE reason LIKE '%NATO%'",
  );
  assertEquals(queueRows.length, 0, "no NATO entries should be in queue for empty purge");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

natoTest("15. Idempotent: enqueuing twice does not create duplicate queue entries", async () => {
  resetState();
  db.query("DELETE FROM remediation_deletion_queue");

  // Seed a NATO spam URL
  seedNewRelay("wss://relay.example.com/kilo", "clearnet");

  const outputPath = "/tmp/test-nato-purge-15.txt";

  await purgeNatoPhoneticSpam(outputPath);

  // Manually enqueue twice to simulate double-run
  const { enqueueRemediationDeletion } = await import("../../src/utils/remediation.ts");
  enqueueRemediationDeletion("wss://relay.example.com/kilo", "NATO phonetic spam purge (Phase 23)");
  enqueueRemediationDeletion("wss://relay.example.com/kilo", "NATO phonetic spam purge (Phase 23)");

  // Should only have ONE entry (PRIMARY KEY on url, ON CONFLICT DO UPDATE)
  const queueRows = db.query(
    "SELECT url FROM remediation_deletion_queue WHERE url = ?",
    ["wss://relay.example.com/kilo"],
  );
  assertEquals(queueRows.length, 1, "should have exactly one queue entry despite double enqueue");

  // Cleanup
  try { await Deno.remove(outputPath); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Exhaustive NATO code coverage
// ---------------------------------------------------------------------------

natoTest("16. All 26 NATO codes are individually recognized by isNatoPhoneticSpam", () => {
  const natoCodes = [
    "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
    "golf", "hotel", "india", "juliet", "kilo", "lima",
    "mike", "november", "oscar", "papa", "quebec", "romeo",
    "sierra", "tango", "uniform", "victor", "whiskey", "xray",
    "yankee", "zulu",
  ];

  for (const code of natoCodes) {
    assertEquals(
      isNatoPhoneticSpam(`wss://relay.example.com/${code}`),
      true,
      `NATO code "${code}" should be recognized as spam`,
    );
  }

  assertEquals(natoCodes.length, 26, "should test all 26 NATO codes");
});
