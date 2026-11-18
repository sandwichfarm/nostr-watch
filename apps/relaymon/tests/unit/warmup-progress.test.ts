// deno-lint-ignore-file no-import-prefix -- Reuse the existing versioned offline assertion fixture.
/**
 * Warmup must make progress past relays whose first check fails.
 *
 * Regression for the fisherman outage (nostr.watch-ops#21): the row
 * wss://.well-known/nip50/is:rising/sort:top/language:en (hostname
 * ".well-known") was accepted, every check child spawned for it was refused
 * --allow-net by Deno, the pool's failure breaker latched, every check then
 * failed, and warmup re-selected the same checked_at = -1 row ~100 times a
 * second with no delay, starving /healthz.
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { getPublicKey } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { Worker } from "../../src/core/worker.ts";
import {
  runWarmupPasses,
  WARMUP_PASS_DELAY_MS,
} from "../../src/core/warmup.ts";
import { QueueManager } from "../../src/utils/queueManager.ts";
import { CheckProcesses } from "../../src/utils/checkTransport.ts";
import { db, initializeDB, seedNewRelay } from "../../src/db/db.ts";
import { setConfig } from "../../src/utils/hostnames.ts";
import { mockConfig } from "../helpers/fixtures.ts";
import type { Config } from "../../src/types/config.ts";

const WELL_KNOWN = "wss://.well-known/nip50/is:rising/sort:top/language:en";
// An IP literal from TEST-NET-3: public, so the target guard needs no DNS.
const FAILING = "wss://203.0.113.7/";
const TEST_PUBKEY = getPublicKey(hexToBytes("01".padStart(64, "0")));

function warmupTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({ name, sanitizeResources: false, sanitizeOps: false, fn });
}

await initializeDB(":memory:", false);
setConfig(mockConfig as Config);

function reset() {
  db.query("DELETE FROM relay_status");
}

function row(url: string): { checkedAt: number; retries: number } | undefined {
  const rows = db.query(
    "SELECT checked_at, retries FROM relay_status WHERE url = ?",
    [url],
  );
  if (rows.length === 0) return undefined;
  return { checkedAt: rows[0][0] as number, retries: rows[0][1] as number };
}

const uncheckedQuery = () =>
  db.query("SELECT url FROM relay_status WHERE checked_at = -1")
    .map(([url]) => url as string);

/** A transport whose breaker has already tripped: every check is refused,
 * exactly what fisherman's pool did once .well-known exhausted it. */
function latchedTransport(): CheckProcesses {
  return {
    stopping: false,
    check: () => Promise.reject(new Error("Check child failure limit reached")),
  } as unknown as CheckProcesses;
}

/** Drive real warmup passes against the real DB and Worker, and fail
 * instead of spinning if warmup keeps re-selecting the same rows. */
async function warmup(worker: Worker, maxSelects = 10) {
  const pending: Promise<void>[] = [];
  let selects = 0;
  const waits: number[] = [];
  const outcome = await runWarmupPasses({
    selectUnchecked: () => {
      if (++selects > maxSelects) {
        throw new Error(`warmup re-selected unchecked rows ${selects} times`);
      }
      return uncheckedQuery();
    },
    enqueue: (url) => {
      pending.push(worker.processRelay(url));
    },
    waitIdle: async () => {
      await Promise.allSettled(pending.splice(0));
    },
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    running: () => true,
  });
  return { outcome, selects, waits };
}

function createWorker(transport: CheckProcesses): Worker {
  const config = structuredClone(mockConfig) as unknown as Config;
  const queueManager = new QueueManager(1);
  return new Worker(
    TEST_PUBKEY,
    queueManager,
    config,
    undefined,
    undefined,
    transport,
  );
}

warmupTest(
  "regression: .well-known row and a failing check do not hot-loop warmup",
  async () => {
    reset();
    seedNewRelay(WELL_KNOWN, "clearnet");
    seedNewRelay(FAILING, "clearnet");
    const worker = createWorker(latchedTransport());
    try {
      const { outcome, selects, waits } = await warmup(worker);
      // One pass checks both rows; the second select finds nothing unchecked.
      assertEquals(outcome.passes, 1);
      assertEquals(selects, 2);
      assertEquals(outcome.leftUnchecked, 0);
      assertEquals(waits, [WARMUP_PASS_DELAY_MS]);
      // The uncheckable URL is removed on encounter...
      assertEquals(row(WELL_KNOWN), undefined);
      // ...and the failed first check leaves the unchecked set with backoff.
      const failed = row(FAILING)!;
      assert(failed.checkedAt > 0, `checked_at is ${failed.checkedAt}`);
      assertEquals(failed.retries, 1);
    } finally {
      worker.stopPublicationProducers();
    }
  },
);

warmupTest(
  "regression: warmup stops re-selecting a row whose failure was not recorded",
  async () => {
    // A worker (or DB write) that cannot record the failure must not make the
    // warmup loop forever: each URL is attempted once per warmup.
    const attempts: string[] = [];
    let selects = 0;
    const waits: number[] = [];
    const outcome = await runWarmupPasses({
      selectUnchecked: () => {
        if (++selects > 10) throw new Error("warmup hot-looped");
        return [WELL_KNOWN];
      },
      enqueue: (url) => attempts.push(url),
      waitIdle: () => Promise.resolve(),
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      running: () => true,
    });
    assertEquals(attempts, [WELL_KNOWN]);
    assertEquals(outcome, { passes: 1, attempted: 1, leftUnchecked: 1 });
    assertEquals(selects, 2);
    assertEquals(waits, [WARMUP_PASS_DELAY_MS]);
  },
);

warmupTest("warmup still picks up relays added between passes", async () => {
  const batches = [["wss://a.example.com/"], [
    "wss://a.example.com/",
    "wss://b.example.com/",
  ], []];
  const attempts: string[] = [];
  const outcome = await runWarmupPasses({
    selectUnchecked: () => batches.shift() ?? [],
    enqueue: (url) => attempts.push(url),
    waitIdle: () => Promise.resolve(),
    wait: () => Promise.resolve(),
    running: () => true,
  });
  assertEquals(attempts, ["wss://a.example.com/", "wss://b.example.com/"]);
  assertEquals(outcome.passes, 2);
});

warmupTest("warmup exits without waiting when stopped", async () => {
  let live = true;
  const waits: number[] = [];
  await runWarmupPasses({
    selectUnchecked: () => ["wss://a.example.com/"],
    enqueue: () => {},
    waitIdle: () => {
      live = false;
      return Promise.resolve();
    },
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    running: () => live,
  });
  assertEquals(waits, []);
});

warmupTest("shutdown rejection leaves a first check unchecked", async () => {
  reset();
  seedNewRelay(FAILING, "clearnet");
  const transport = {
    stopping: true,
    check: () => Promise.reject(new Error("Network checks are closing")),
  } as unknown as CheckProcesses;
  const worker = createWorker(transport);
  try {
    await worker.processRelay(FAILING);
    assertEquals(row(FAILING), { checkedAt: -1, retries: 0 });
  } finally {
    worker.stopPublicationProducers();
  }
});
