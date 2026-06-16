/**
 * Offline-inclusive dedup remediation: re-dedups all unignored rows (online +
 * offline) from stored NIP-11 so the offline backlog clears at boot.
 * No-NIP-11 spam path with a root sibling => ignored onto root; distinct-NIP-11
 * path => kept; root => never ignored; sentinel-guarded idempotent.
 */

import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { rerunDedupAllUnignoredMigration } from "../../src/utils/remediation.ts";
import { createInfoHash } from "../../src/utils/hostnames.ts";
import { db, initializeDB, storeRelayInfo } from "../../src/db/db.ts";

initializeDB(":memory:", false);

function info(name: string) {
  return { name, description: name, supported_nips: [1, 11], software: "strfry", version: "1" };
}

function seed(rows: Array<{ url: string; online: boolean; ignore?: boolean; info?: any }>) {
  db.query("DELETE FROM relay_status");
  db.query("DELETE FROM relay_info");
  db.query("DELETE FROM relaymon_migrations WHERE name = 'rerun_dedup_all_unignored_v1'");
  for (const r of rows) {
    db.query(
      `INSERT OR REPLACE INTO relay_status (url, online, ignore, parent, checked_at, network)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r.url, r.online ? 1 : 0, r.ignore ? 1 : 0, null, Date.now(), "clearnet"],
    );
    if (r.info) {
      const h = createInfoHash(r.info);
      if (h) storeRelayInfo(r.url, r.info, h);
    }
  }
}

function ignoreOf(url: string): number {
  const rows = db.query("SELECT ignore FROM relay_status WHERE url = ?", [url]);
  return rows.length ? (rows[0][0] as number) : -1;
}
function parentOf(url: string): string {
  const rows = db.query("SELECT parent FROM relay_status WHERE url = ?", [url]);
  return rows.length ? ((rows[0][0] as string) || "") : "";
}

function migTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({ name, sanitizeResources: false, sanitizeOps: false, fn });
}

migTest("offline remediation: offline no-NIP-11 spam paths are ignored onto the offline root", async () => {
  seed([
    { url: "wss://relay.29t.com/", online: false, info: info("root") },
    { url: "wss://relay.29t.com/sierra-yonder", online: false },
    { url: "wss://relay.29t.com/zulu", online: false },
    { url: "wss://relay.29t.com/prism-quebec-lima", online: false },
  ]);

  await rerunDedupAllUnignoredMigration();

  assertEquals(ignoreOf("wss://relay.29t.com/"), 0, "root stays unignored");
  for (const spam of [
    "wss://relay.29t.com/sierra-yonder",
    "wss://relay.29t.com/zulu",
    "wss://relay.29t.com/prism-quebec-lima",
  ]) {
    assertEquals(ignoreOf(spam), 1, `${spam} must be ignored`);
    assertEquals(parentOf(spam), "wss://relay.29t.com/", `${spam} parent=root`);
  }
});

migTest("offline remediation: offline path with DISTINCT cached NIP-11 is kept", async () => {
  seed([
    { url: "wss://lang.relays.land/", online: false, info: info("router") },
    { url: "wss://lang.relays.land/en", online: false, info: info("english-relay") },
  ]);

  await rerunDedupAllUnignoredMigration();

  assertEquals(ignoreOf("wss://lang.relays.land/en"), 0, "distinct-NIP-11 path kept");
  assertEquals(ignoreOf("wss://lang.relays.land/"), 0, "root kept");
});

migTest("offline remediation: queues kind:5 deletions for newly-ignored spam", async () => {
  seed([
    { url: "wss://relay.29t.com/", online: false, info: info("root") },
    { url: "wss://relay.29t.com/victor", online: false },
  ]);
  db.query("DELETE FROM remediation_deletion_queue");

  await rerunDedupAllUnignoredMigration();

  const q = db.query(
    "SELECT url FROM remediation_deletion_queue WHERE url = ?",
    ["wss://relay.29t.com/victor"],
  );
  assert(q.length === 1, "newly-ignored spam must be queued for deletion");
});

migTest("offline remediation: idempotent — second run is a sentinel-guarded no-op", async () => {
  seed([
    { url: "wss://relay.29t.com/", online: false, info: info("root") },
    { url: "wss://relay.29t.com/sierra-yonder", online: false },
  ]);

  await rerunDedupAllUnignoredMigration();
  assertEquals(ignoreOf("wss://relay.29t.com/sierra-yonder"), 1);

  // Manually un-ignore, then re-run: sentinel present => no change.
  db.query("UPDATE relay_status SET ignore = 0, parent = '' WHERE url = ?", [
    "wss://relay.29t.com/sierra-yonder",
  ]);
  await rerunDedupAllUnignoredMigration();
  assertEquals(
    ignoreOf("wss://relay.29t.com/sierra-yonder"),
    0,
    "second run must be a no-op (sentinel guards re-run)",
  );
});
