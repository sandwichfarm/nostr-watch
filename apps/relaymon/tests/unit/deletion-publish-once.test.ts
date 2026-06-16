/**
 * Deletions must be published once per ignore episode, not on every boot.
 *
 * The durable marker is relay_status.deletion_published_at: ignored relays with
 * 0 are pending; once a deletion is published the marker is set and survives
 * restarts; it is cleared when the relay becomes unignored so a later re-ignore
 * republishes exactly once.
 */

import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  db,
  getIgnoredRelaysPendingDeletion,
  initializeDB,
  isDeletionPublished,
  markDeletionPublished,
  markRelayUnignored,
  persistResult,
} from "../../src/db/db.ts";

initializeDB(":memory:", false);

function seed(rows: Array<{ url: string; ignore: boolean; published?: number }>) {
  db.query("DELETE FROM relay_status");
  for (const r of rows) {
    db.query(
      `INSERT OR REPLACE INTO relay_status (url, online, ignore, ignore_reason, parent, checked_at, network, deletion_published_at)
       VALUES (?, 0, ?, '', '', ?, 'clearnet', ?)`,
      [r.url, r.ignore ? 1 : 0, Date.now(), r.published ?? 0],
    );
  }
}

function publishedAt(url: string): number {
  const rows = db.query("SELECT deletion_published_at FROM relay_status WHERE url = ?", [url]);
  return rows.length ? (rows[0][0] as number) || 0 : -1;
}

function t(name: string, fn: () => void) {
  Deno.test({ name, sanitizeResources: false, sanitizeOps: false, fn });
}

t("pending = ignored relays whose deletion has not been published", () => {
  seed([
    { url: "wss://a.example/", ignore: true, published: 0 },
    { url: "wss://b.example/", ignore: true, published: 0 },
    { url: "wss://c.example/", ignore: true, published: 1781000000000 }, // already published
    { url: "wss://d.example/", ignore: false, published: 0 }, // not ignored
  ]);
  const pending = getIgnoredRelaysPendingDeletion().map((p) => p.url).sort();
  assertEquals(pending, ["wss://a.example/", "wss://b.example/"]);
});

t("markDeletionPublished / isDeletionPublished round-trip and removes from pending", () => {
  seed([{ url: "wss://a.example/", ignore: true, published: 0 }]);
  assertEquals(isDeletionPublished("wss://a.example/"), false);
  markDeletionPublished("wss://a.example/");
  assertEquals(isDeletionPublished("wss://a.example/"), true);
  assertEquals(getIgnoredRelaysPendingDeletion().length, 0);
});

t("boot idempotency: each deletion is pending only once across boots", () => {
  seed([
    { url: "wss://a.example/", ignore: true, published: 0 },
    { url: "wss://b.example/", ignore: true, published: 0 },
    { url: "wss://c.example/", ignore: true, published: 0 },
  ]);
  // First boot: all pending; simulate successful publishes.
  const firstBoot = getIgnoredRelaysPendingDeletion();
  assertEquals(firstBoot.length, 3);
  for (const { url } of firstBoot) markDeletionPublished(url);
  // Second boot (no state lost): nothing left to publish.
  assertEquals(getIgnoredRelaysPendingDeletion().length, 0);
});

t("unignore clears the marker so a later re-ignore republishes once", () => {
  seed([{ url: "wss://a.example/", ignore: true, published: 0 }]);
  markDeletionPublished("wss://a.example/");
  assert(publishedAt("wss://a.example/") > 0);
  markRelayUnignored("wss://a.example/");
  assertEquals(publishedAt("wss://a.example/"), 0, "marker cleared on unignore");
});

t("persistResult clears the marker when not ignored, preserves it when ignored", () => {
  seed([{ url: "wss://a.example/", ignore: true, published: 0 }]);
  markDeletionPublished("wss://a.example/");
  const stamped = publishedAt("wss://a.example/");
  assert(stamped > 0);

  // Persist as still-ignored: marker preserved.
  persistResult({
    url: "wss://a.example/",
    online: false,
    ignore: true,
    ignore_reason: "dup",
    parent: "wss://a.example/",
    network: "clearnet",
  });
  assertEquals(publishedAt("wss://a.example/"), stamped, "marker preserved while ignored");

  // Persist as recovered (not ignored): marker cleared.
  persistResult({
    url: "wss://a.example/",
    online: true,
    ignore: false,
    ignore_reason: "",
    parent: "",
    network: "clearnet",
    open: { data: true, duration: 5 },
  });
  assertEquals(publishedAt("wss://a.example/"), 0, "marker cleared when no longer ignored");
});
