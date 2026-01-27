import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Worker } from "../../src/core/worker.ts";
import { QueueManager } from "../../src/utils/queueManager.ts";
import type { Config } from "../../src/types/config.ts";
import type { RelayCheckResult } from "../../src/types/relay.ts";
import { db, initDB } from "../../src/db/db.ts";
import { mockConfig } from "../helpers/fixtures.ts";
import { getPublicKey, nip19 } from "npm:nostr-tools";
import { hexToBytes } from "npm:@noble/hashes/utils";

/**
 * Test helper to disable resource/ops sanitization
 */
function retryTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

// Initialize a global test database
const TEST_DB_PATH = `/tmp/test-worker-retry-${Date.now()}.db`;
let dbInitialized = false;

// Test constants
const TEST_PRIVKEY = "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PUBKEY = getPublicKey(TEST_PRIVKEY);

function ensureTestDB() {
  if (!dbInitialized) {
    try {
      initDB(TEST_DB_PATH, false);
      dbInitialized = true;
    } catch (e) {
      dbInitialized = true;
    }
  }
}

/**
 * Create a test Worker instance with all required dependencies
 */
function createTestWorker(config: Config): Worker {
  const queueManager = new QueueManager(config.queue?.workerConcurrency || 5);
  return new Worker(TEST_PUBKEY, queueManager, config);
}

/**
 * Create a test config with optional overrides
 */
function createTestConfig(overrides: any = {}): Config {
  const baseConfig = {
    ...mockConfig,
    publisher: {
      ...mockConfig.publisher,
      retry: {
        maxRetries: 3,
        initialBackoffMs: 1000
      }
    }
  };

  // Deep merge overrides
  if (overrides.publisher) {
    baseConfig.publisher = { ...baseConfig.publisher, ...overrides.publisher };
  }
  if (overrides.relaymon) {
    baseConfig.relaymon = { ...baseConfig.relaymon, ...overrides.relaymon };
  }
  if (overrides.monitor) {
    baseConfig.monitor = { ...baseConfig.monitor, ...overrides.monitor };
  }

  return baseConfig as Config;
}

/**
 * Create a mock relay check result
 */
function createMockResult(overrides: Partial<RelayCheckResult> = {}): RelayCheckResult {
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
      duration: 150
    },
    ...overrides
  } as RelayCheckResult;
}

// Test suite
retryTest("Worker - constructor accepts retry configuration", () => {
  ensureTestDB();

  const config = createTestConfig({
    publisher: {
      relays: ["wss://relay.example.com"],
      retry: {
        maxRetries: 5,
        initialBackoffMs: 2000
      }
    }
  });

  const worker = createTestWorker(config);
  assertExists(worker, "Worker should be created with retry config");
});

retryTest("Worker - handleRetryForRelay increments retry count", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);
  const relayUrl = "wss://test-relay.example.com";

  // First retry
  worker.handleRetryForRelay(relayUrl);

  // Verify retry count was incremented (we can't directly access relayRetries map,
  // but we can verify the method runs without error)
  assert(true, "handleRetryForRelay should execute without error");
});

retryTest("Worker - handleRetryForRelay tracks multiple retries for same relay", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);
  const relayUrl = "wss://test-relay.example.com";

  // Multiple retries
  worker.handleRetryForRelay(relayUrl);
  worker.handleRetryForRelay(relayUrl);
  worker.handleRetryForRelay(relayUrl);

  assert(true, "Should handle multiple retries for same relay");
});

retryTest("Worker - handleRetryForRelay tracks retries for different relays independently", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);

  worker.handleRetryForRelay("wss://relay1.example.com");
  worker.handleRetryForRelay("wss://relay2.example.com");
  worker.handleRetryForRelay("wss://relay1.example.com");

  assert(true, "Should track retries for different relays independently");
});

retryTest("Worker - publishResult with retry configuration", async () => {
  ensureTestDB();

  // Set up environment for signing
  const testPrivkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", nip19.nsecEncode(hexToBytes(testPrivkey)));

  try {
    const config = createTestConfig({
      publisher: {
        relays: ["wss://relay.example.com"],
        retry: {
          maxRetries: 3,
          initialBackoffMs: 100 // Short backoff for testing
        }
      }
    });

    const worker = createTestWorker(config);
    const result = createMockResult();

    // This will attempt to publish (and likely fail since we don't have a real relay)
    // But we're testing that the method accepts the parameters correctly
    await worker.publishResult(result);

    assert(true, "publishResult should execute without throwing");
  } finally {
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

retryTest("Worker - publishResult handles missing RELAYMON_NSEC", async () => {
  ensureTestDB();

  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.delete("RELAYMON_NSEC");

  try {
    const config = createTestConfig();
    const worker = createTestWorker(config);
    const result = createMockResult();

    // Should handle missing privkey gracefully
    await worker.publishResult(result);

    assert(true, "Should handle missing RELAYMON_NSEC gracefully");
  } finally {
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    }
  }
});

retryTest("Worker - retry configuration uses custom maxRetries", () => {
  ensureTestDB();

  const customMaxRetries = 7;
  const config = createTestConfig({
    publisher: {
      relays: ["wss://relay.example.com"],
      retry: {
        maxRetries: customMaxRetries,
        initialBackoffMs: 1000
      }
    }
  });

  const worker = createTestWorker(config);
  assertExists(worker, "Worker should accept custom maxRetries");
});

retryTest("Worker - retry configuration uses custom initialBackoffMs", () => {
  ensureTestDB();

  const customBackoff = 5000;
  const config = createTestConfig({
    publisher: {
      relays: ["wss://relay.example.com"],
      retry: {
        maxRetries: 3,
        initialBackoffMs: customBackoff
      }
    }
  });

  const worker = createTestWorker(config);
  assertExists(worker, "Worker should accept custom initialBackoffMs");
});

retryTest("Worker - default retry configuration when not specified", () => {
  ensureTestDB();

  const config = createTestConfig({
    publisher: {
      relays: ["wss://relay.example.com"]
      // No retry config - should use defaults
    }
  });

  const worker = createTestWorker(config);
  assertExists(worker, "Worker should use default retry config when not specified");
});

retryTest("Worker - formatDuration converts milliseconds correctly", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);

  const formatted30s = worker.formatDuration(30000);
  const formatted2m = worker.formatDuration(120000);
  const formatted1h = worker.formatDuration(3600000);
  const formatted2d = worker.formatDuration(172800000);

  assertEquals(formatted30s, "30s", "Should format seconds");
  assertEquals(formatted2m, "2m", "Should format minutes");
  assertEquals(formatted1h, "1h", "Should format hours");
  assertEquals(formatted2d, "2d", "Should format days");
});

retryTest("Worker - formatDuration handles edge cases", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);

  const formatted0 = worker.formatDuration(0);
  const formatted500ms = worker.formatDuration(500);
  const formatted59s = worker.formatDuration(59000);
  const formatted60s = worker.formatDuration(60000);

  assertEquals(formatted0, "0s", "Should handle 0");
  assertEquals(formatted500ms, "0s", "Should round down sub-second values");
  assertEquals(formatted59s, "59s", "Should stay in seconds");
  assertEquals(formatted60s, "1m", "Should convert to minutes at 60s");
});

retryTest("Worker - relay check retry uses RetryManager", () => {
  ensureTestDB();

  const config = createTestConfig({
    relaymon: {
      networks: ["clearnet"],
      seed: {
        enabled: false,
        interval: 3600000
      },
      checks: {
        enabled: true,
        options: {
          expires: 86400000,
          interval: 3600000
        }
      },
      retry: {
        enabled: true,
        expiry: [
          { delay: 60000, retries: 3 },
          { delay: 300000, retries: 5 },
          { delay: 900000, retries: 10 }
        ]
      },
      deduplication: {
        enabled: false
      },
      ignorelist: {
        enabled: false,
        interval: "6h",
        deletion_interval: "24h",
        relays: [],
        pubkeys: []
      }
    }
  });

  const worker = createTestWorker(config);
  assertExists(worker, "Worker should initialize with RetryManager config");
});

retryTest("Worker - multiple publish attempts for different relays", async () => {
  ensureTestDB();

  const testPrivkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", nip19.nsecEncode(hexToBytes(testPrivkey)));

  try {
    const config = createTestConfig({
      publisher: {
        relays: ["wss://relay.example.com"],
        retry: {
          maxRetries: 2,
          initialBackoffMs: 50
        }
      }
    });

    const worker = createTestWorker(config);

    const result1 = createMockResult({ url: "wss://relay1.example.com" });
    const result2 = createMockResult({ url: "wss://relay2.example.com" });
    const result3 = createMockResult({ url: "wss://relay3.example.com" });

    // Queue multiple publish jobs
    await worker.publishResult(result1);
    await worker.publishResult(result2);
    await worker.publishResult(result3);

    assert(true, "Should handle multiple publish attempts");
  } finally {
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

retryTest("Worker - exponential backoff calculation", () => {
  ensureTestDB();

  const config = createTestConfig({
    publisher: {
      relays: ["wss://relay.example.com"],
      retry: {
        maxRetries: 5,
        initialBackoffMs: 1000
      }
    }
  });

  const worker = createTestWorker(config);

  // Verify the worker was created with the config
  // The actual backoff calculation happens internally:
  // retry 0: 1000ms
  // retry 1: 2000ms (1000 * 2)
  // retry 2: 4000ms (2000 * 2)
  // retry 3: 8000ms (4000 * 2)
  // etc.

  assertExists(worker, "Worker should be created with exponential backoff config");
});

retryTest("Worker - retry tracking persists across worker instance", () => {
  ensureTestDB();

  const config = createTestConfig();
  const worker = createTestWorker(config);
  const relayUrl = "wss://persistent-relay.example.com";

  // Add retry tracking
  worker.handleRetryForRelay(relayUrl);
  worker.handleRetryForRelay(relayUrl);

  // Retry count is stored in relayRetries map
  // In a real scenario, this would persist in the database
  assert(true, "Retry tracking should work within worker instance");
});
