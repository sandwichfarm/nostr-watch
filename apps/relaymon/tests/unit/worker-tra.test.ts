import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.218.2/assert/mod.ts";
import { getPublicKey } from "npm:nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";
import { Worker } from "../../src/core/worker.ts";
import { QueueManager } from "../../src/utils/queueManager.ts";
import { db, initializeDB } from "../../src/db/db.ts";
import type { Config } from "../../src/types/config.ts";
import type { RelayCheckResult } from "../../src/types/relay.ts";
import { mockConfig } from "../helpers/fixtures.ts";

function traWorkerTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn,
  });
}

const TEST_PRIVKEY =
  "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PUBKEY = getPublicKey(hexToBytes(TEST_PRIVKEY));
const TEST_DB_PATH = `/tmp/test-worker-tra-${Date.now()}.db`;
let dbInitialized = false;

async function ensureTestDB() {
  if (!dbInitialized) {
    await initializeDB(TEST_DB_PATH, false);
    dbInitialized = true;
  }
}

function createTestConfig(): Config {
  return {
    ...mockConfig,
    publisher: {
      relays: [],
      retry: {
        maxRetries: 0,
        initialBackoffMs: 1,
      },
    },
    relaymon: {
      ...mockConfig.relaymon,
      trustedRelayAssertions: {
        enabled: true,
        relays: ["wss://relaypag.es", "wss://relay.nostr.watch"],
        min_observations: 1,
        material_change_threshold: 3,
        refresh_interval: 60 * 60 * 1000,
        history_retention: 30 * 24 * 60 * 60 * 1000,
        max_observations_per_relay: 1000,
        publish_unreachable: true,
        publish_blocked: false,
        algorithm: {
          version: "relaymon-local-v2",
          url:
            "https://github.com/Letdown2491/trustedrelays/blob/main/ALGORITHM.md",
        },
      },
    },
    logLevel: "error",
  } as Config;
}

function createResult(
  overrides: Partial<RelayCheckResult> = {},
): RelayCheckResult {
  return {
    url: "wss://relay.example.com",
    hostname: "relay.example.com",
    protocol: "wss:",
    network: "clearnet",
    checked_at: Math.floor(Date.now() / 1000),
    online: true,
    ignore: false,
    parent: "",
    open: {
      data: true,
      duration: 150,
    },
    read: {
      data: true,
      duration: 200,
    },
    info: {
      data: {
        name: "Test Relay",
        pubkey: TEST_PUBKEY,
        supported_nips: [1, 11],
        software: "test-relay",
        version: "1.0.0",
      },
      duration: 100,
    },
    ...overrides,
  } as RelayCheckResult;
}

traWorkerTest(
  "enqueueTrustedRelayObservation defers work off the check hot path",
  async () => {
    await ensureTestDB();

    const originalNsec = Deno.env.get("RELAYMON_NSEC");
    Deno.env.set("RELAYMON_NSEC", TEST_PRIVKEY);

    try {
      const config = createTestConfig();
      const queueManager = new QueueManager(
        config.queue?.workerConcurrency || 1,
      );
      const worker = new Worker(TEST_PUBKEY, queueManager, config);
      const published: Array<{ kind: number; tags: string[][] }> = [];

      (worker as unknown as {
        trustedRelayPublisher: {
          publishEvent: (
            event: { kind: number; tags: string[][] },
          ) => Promise<void>;
        };
      }).trustedRelayPublisher = {
        publishEvent: async (event) => {
          published.push(event);
        },
      };

      const result = createResult({ url: "wss://relay.deferred.example" });
      worker.enqueueTrustedRelayObservation(result);
      // Prevent the lazily-started background loop from racing this test.
      worker.stopTrustedRelayProcessor();

      // Hot path must not publish synchronously: the work is queued, not run.
      assertEquals(published.length, 0);
      assertEquals(
        (worker as unknown as { traQueue: unknown[] }).traQueue.length,
        1,
      );

      // Draining the queue performs exactly the same publish as before.
      const processed = await worker.processTrustedRelayQueueOnce();
      assertEquals(processed, true);
      await queueManager.waitEmpty([queueManager.publishQueue]);

      assertEquals(published.length, 1);
      assertEquals(published[0].kind, 30385);
      assertEquals(
        (worker as unknown as { traQueue: unknown[] }).traQueue.length,
        0,
      );
    } finally {
      if (originalNsec) {
        Deno.env.set("RELAYMON_NSEC", originalNsec);
      } else {
        Deno.env.delete("RELAYMON_NSEC");
      }
    }
  },
);

traWorkerTest(
  "enqueueTrustedRelayObservation is a no-op when TRA is disabled",
  async () => {
    await ensureTestDB();

    const config = createTestConfig();
    config.relaymon.trustedRelayAssertions!.enabled = false;
    const queueManager = new QueueManager(config.queue?.workerConcurrency || 1);
    const worker = new Worker(TEST_PUBKEY, queueManager, config);

    worker.enqueueTrustedRelayObservation(createResult());
    worker.stopTrustedRelayProcessor();

    assertEquals(
      (worker as unknown as { traQueue: unknown[] }).traQueue.length,
      0,
    );
  },
);

traWorkerTest(
  "TRA queue caps memory by dropping oldest observations",
  async () => {
    await ensureTestDB();

    const config = createTestConfig();
    const queueManager = new QueueManager(config.queue?.workerConcurrency || 1);
    const worker = new Worker(TEST_PUBKEY, queueManager, config);
    // Keep the background loop from draining while we fill the queue.
    worker.stopTrustedRelayProcessor();
    (worker as unknown as { traProcessorActive: boolean }).traProcessorActive =
      true;

    const internals = worker as unknown as {
      traQueue: RelayCheckResult[];
      traQueueMax: number;
    };
    internals.traQueueMax = 5;

    for (let i = 0; i < 12; i++) {
      worker.enqueueTrustedRelayObservation(
        createResult({ url: `wss://relay-${i}.example` }),
      );
    }

    assertEquals(internals.traQueue.length, 5);
    // Oldest dropped: the queue should hold the most recent 5 urls.
    assertEquals(internals.traQueue[0].url, "wss://relay-7.example");
    assertEquals(internals.traQueue[4].url, "wss://relay-11.example");
  },
);

traWorkerTest(
  "Worker TRA publishing is not suppressed during warmup",
  async () => {
    await ensureTestDB();

    const originalNsec = Deno.env.get("RELAYMON_NSEC");
    Deno.env.set("RELAYMON_NSEC", TEST_PRIVKEY);

    try {
      const config = createTestConfig();
      const queueManager = new QueueManager(
        config.queue?.workerConcurrency || 1,
      );
      const worker = new Worker(TEST_PUBKEY, queueManager, config);
      const published: Array<{ kind: number; tags: string[][] }> = [];

      (worker as unknown as {
        trustedRelayPublisher: {
          publishEvent: (
            event: { kind: number; tags: string[][] },
          ) => Promise<void>;
        };
      }).trustedRelayPublisher = {
        publishEvent: async (event) => {
          published.push(event);
        },
      };

      worker.setWarmupMode(true);
      await worker.publishTrustedRelayAssertion(createResult());
      await queueManager.waitEmpty([queueManager.publishQueue]);

      assertEquals(published.length, 1);
      assertEquals(published[0].kind, 30385);
      assertExists(published[0].tags.find((tag) => tag[0] === "d"));

      const rows = db.query(
        "SELECT observations, last_event_id, last_published_at FROM relay_trust_assertion_state WHERE url = ?",
        ["wss://relay.example.com"],
      );
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], 1);
      assertExists(rows[0][1]);
      assertExists(rows[0][2]);
    } finally {
      if (originalNsec) {
        Deno.env.set("RELAYMON_NSEC", originalNsec);
      } else {
        Deno.env.delete("RELAYMON_NSEC");
      }
    }
  },
);
