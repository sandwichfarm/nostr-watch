/**
 * Dynamic hostname deduplication tests (M1)
 *
 * Encodes the intended, PURELY DYNAMIC dedup contract (no static allow/deny
 * override lists):
 *
 *   - The canonical relay for a hostname is its root ("/"), weighted to win.
 *     When no root is known, the shortest sibling is the canonical.
 *   - A path-bearing relay survives as DISTINCT iff its NIP-11 proves different
 *     functionality from the canonical (different normalized NIP-11 hash).
 *   - A path relay that cannot prove different functionality — no NIP-11, or
 *     NIP-11 identical to the canonical — loses to the canonical and is ignored
 *     (parent = canonical). This is the spam case (NATO-word path segments on a
 *     real hostname that the relay does not actually serve distinctly).
 *   - The family is derived from ALL known siblings in relay_status
 *     (online AND offline) — NOT online-only — so an offline/unseeded root still
 *     wins. This is the production failure: relay.29t.com root + dozens of
 *     /<nato-word> paths were all offline and none were ever deduped.
 *   - Dedup is O(family): it must not read NIP-11 for every online relay in the
 *     DB (the O(N) per-check event-loop staller).
 *
 * These tests are written RED-first against the legacy online-only +
 * shortest-wins-without-NIP-11 + static-override implementation.
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

// ---------------------------------------------------------------------------
// T1 — CORE BUG: a path relay with DISTINCT NIP-11 must be KEPT even when its
// root sibling is offline and there are no online siblings. Legacy code hits
// the online-empty "defensive-deny" branch and ignores it purely because the
// root is a shorter sibling — without comparing NIP-11. That is the
// "root-always-wins shortcut" the redesign must remove.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// T2 — spam path with NO NIP-11 loses to an OFFLINE root (production case).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// T3 — path whose NIP-11 is IDENTICAL to the root loses to the root.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// T4 — the root itself is NEVER ignored by hostname dedup.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// T5 — many offline spam paths on one offline hostname ALL get ignored,
// converging onto the single root canonical.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// T6 — O(family): dedup must not read NIP-11 for every online relay in the DB.
// Seed many unrelated online relays + a tiny target family and assert the
// number of relay_info reads stays bounded by the family size, not the whole
// online set. Legacy `online.map(getRelayInfo)` reads N => fails here.
// ---------------------------------------------------------------------------
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
