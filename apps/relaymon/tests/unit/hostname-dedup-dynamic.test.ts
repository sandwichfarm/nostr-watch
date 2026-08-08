/**
 * Dynamic hostname deduplication contract (no static allow/deny lists):
 * canonical = root else shortest; family = all siblings (online + offline) so
 * an offline root still wins; a path is kept only if its NIP-11 proves distinct
 * functionality, else ignored onto the canonical; NIP-11 reads are O(family).
 */

import { assert, assertEquals } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { relayHostnameDedup, setConfig } from "../../src/utils/hostnames.ts";
import { db, initializeDB, storeRelayInfo } from "../../src/db/db.ts";
import { createInfoHash } from "../../src/utils/hostnames.ts";
import type { Config } from "../../src/types/config.ts";
import { mockConfig } from "../helpers/fixtures.ts";

initializeDB(":memory:", false);
// No appConfig => relayHostnameDedup will not attempt deletion publishing.
// (setConfig is intentionally NOT called with a full config here so the dedup
// decision is exercised in isolation without network side effects.)

function infoFor(name: string) {
  return {
    name,
    description: `relay ${name}`,
    supported_nips: [1, 11],
    software: "strfry",
    version: "1.0.0",
  };
}

interface SeedRow {
  url: string;
  online: boolean;
  ignore?: boolean;
  info?: Record<string, unknown> | null;
}

function seed(rows: SeedRow[]) {
  db.query("DELETE FROM relay_status");
  db.query("DELETE FROM relay_info");
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

function resultFor(
  url: string,
  opts: { online: boolean; info?: Record<string, unknown> | null } = {
    online: false,
  },
) {
  const u = new URL(url);
  return {
    url,
    hostname: u.hostname,
    protocol: u.protocol,
    network: "clearnet",
    parent: "",
    ignore: false,
    online: opts.online,
    checked_at: Date.now(),
    open: { data: opts.online, duration: opts.online ? 5 : -1 },
    info: opts.info ? { data: opts.info } : undefined,
  } as any;
}

function dynTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({ name, sanitizeResources: false, sanitizeOps: false, fn });
}

// A distinct-NIP-11 path must survive even when its only sibling (the root) is
// offline — the case the old online-only/shortest-wins logic got wrong.
dynTest("dynamic: distinct-NIP-11 path is KEPT when root is offline (no static override)", async () => {
  seed([
    { url: "wss://multi.example.com/", online: false, info: infoFor("root-relay") },
    { url: "wss://multi.example.com/teamx", online: true, info: infoFor("teamx-relay") },
  ]);
  const result = resultFor("wss://multi.example.com/teamx", {
    online: true,
    info: infoFor("teamx-relay"),
  });
  const out = await relayHostnameDedup(result);
  assertEquals(out.ignore, false, "distinct-functionality path must survive");
});

dynTest("dynamic: offline no-NIP-11 spam path is IGNORED in favor of offline root", async () => {
  seed([
    { url: "wss://relay.29t.com/", online: false, info: null },
    { url: "wss://relay.29t.com/sierra-yonder", online: false, info: null },
  ]);
  const result = resultFor("wss://relay.29t.com/sierra-yonder", { online: false });
  const out = await relayHostnameDedup(result);
  assertEquals(out.ignore, true, "no-NIP-11 path cannot prove distinct functionality");
  assertEquals(out.parent, "wss://relay.29t.com/", "parent should be the canonical root");
});

dynTest("dynamic: path with same NIP-11 as root is IGNORED", async () => {
  seed([
    { url: "wss://mirror.example.com/", online: false, info: infoFor("same") },
    { url: "wss://mirror.example.com/copy", online: true, info: infoFor("same") },
  ]);
  const result = resultFor("wss://mirror.example.com/copy", {
    online: true,
    info: infoFor("same"),
  });
  const out = await relayHostnameDedup(result);
  assertEquals(out.ignore, true, "identical NIP-11 means same functionality => dedupe");
  assertEquals(out.parent, "wss://mirror.example.com/");
});

dynTest("dynamic: root URL is never ignored even amid many spam paths", async () => {
  seed([
    { url: "wss://relay.29t.com/", online: true, info: infoFor("root") },
    { url: "wss://relay.29t.com/zulu", online: false, info: null },
    { url: "wss://relay.29t.com/sierra-yonder", online: false, info: null },
  ]);
  const result = resultFor("wss://relay.29t.com/", { online: true, info: infoFor("root") });
  const out = await relayHostnameDedup(result);
  assertEquals(out.ignore, false, "root is the canonical and must never be ignored");
});

dynTest("dynamic: all offline spam paths converge onto the offline root", async () => {
  const paths = [
    "wss://qubestr.zenon.red/victor",
    "wss://qubestr.zenon.red/november",
    "wss://qubestr.zenon.red/prism-quebec-lima",
    "wss://qubestr.zenon.red/xray",
  ];
  seed([
    { url: "wss://qubestr.zenon.red/", online: false, info: null },
    ...paths.map((p) => ({ url: p, online: false, info: null })),
  ]);
  for (const p of paths) {
    const out = await relayHostnameDedup(resultFor(p, { online: false }));
    assertEquals(out.ignore, true, `${p} should be ignored`);
    assertEquals(out.parent, "wss://qubestr.zenon.red/", `${p} parent should be root`);
  }
});

// Many unrelated online relays + a tiny target family: relay_info reads must
// stay bounded by family size, not the whole online set.
dynTest("dynamic: dedup reads NIP-11 O(family), not O(all online relays)", async () => {
  const unrelated: SeedRow[] = [];
  for (let i = 0; i < 60; i++) {
    unrelated.push({ url: `wss://unrelated-${i}.example.net/`, online: true, info: infoFor(`u${i}`) });
  }
  seed([
    { url: "wss://target.example.com/", online: false, info: infoFor("t-root") },
    { url: "wss://target.example.com/alpha", online: false, info: null },
    ...unrelated,
  ]);

  // Count relay_info reads by wrapping db.query (Phase 20 monkey-patch pattern).
  const originalQuery = db.query.bind(db);
  let infoReads = 0;
  (db as any).query = (sql: string, params?: unknown[]) => {
    if (typeof sql === "string" && /FROM\s+relay_info\s+WHERE\s+url/i.test(sql)) {
      infoReads++;
    }
    return originalQuery(sql as any, params as any);
  };
  try {
    await relayHostnameDedup(resultFor("wss://target.example.com/alpha", { online: false }));
  } finally {
    (db as any).query = originalQuery;
  }

  assert(
    infoReads <= 5,
    `expected O(family) relay_info reads (<=5), got ${infoReads} (legacy O(N) sweep reads ~62)`,
  );
});
