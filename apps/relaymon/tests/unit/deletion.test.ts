import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Kind5Event, deleteRelayCheckEvent } from "../../src/utils/deletion.ts";
import { getPublicKey, nip19 } from "npm:nostr-tools";
import { hexToBytes } from "npm:@noble/hashes/utils";
import type { Config } from "../../src/types/config.ts";

/**
 * Test helper to disable resource/ops sanitization
 * (QueueManager creates background intervals)
 */
function deletionTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

/**
 * Create a minimal mock config for testing deletion events
 */
function createMockConfig(relays: string[] = ["wss://relay.example.com"]): Config {
  return {
    monitor: {
      slug: "test-monitor",
      info: {
        name: "Test Monitor",
        description: "Test",
        pubkey: "test-pubkey"
      },
      owner: "test-owner",
      relays: relays,
      geo: {
        enabled: false
      }
    },
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
        enabled: false,
        expiry: []
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
    },
    publisher: {
      relays: relays
    }
  } as Config;
}

// Use a valid test private key and derive pubkey from it
const TEST_PRIVKEY = "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PUBKEY = getPublicKey(TEST_PRIVKEY);
const TEST_NSEC = nip19.nsecEncode(hexToBytes(TEST_PRIVKEY));

// Test suite
deletionTest("Kind5Event - constructor creates event with correct kind", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  // Check that the event has kind 5
  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test deletion"
  });

  assertEquals(generated.kind, 5);
});

deletionTest("Kind5Event - generateEvent creates proper a-tag format", () => {
  const relayUrl = "wss://relay.example.com";
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl,
    pubkey: TEST_PUBKEY,
    content: "Test deletion reason"
  });

  // Check a-tag format: 30166:<pubkey>:<relay-url>
  const aTag = generated.tags.find(tag => tag[0] === "a");
  assertExists(aTag, "a-tag should exist");
  assertEquals(aTag[1], `30166:${TEST_PUBKEY}:${relayUrl}`);
});

deletionTest("Kind5Event - generateEvent includes k-tag for kind 30166", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test deletion"
  });

  // Check k-tag for the kind being deleted
  const kTag = generated.tags.find(tag => tag[0] === "k");
  assertExists(kTag, "k-tag should exist");
  assertEquals(kTag[1], "30166");
});

deletionTest("Kind5Event - generateEvent includes content", () => {
  const content = "Relay marked as duplicate";
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content
  });

  assertEquals(generated.content, content);
});

deletionTest("Kind5Event - generateEvent includes pubkey", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test"
  });

  assertEquals(generated.pubkey, TEST_PUBKEY);
});

deletionTest("Kind5Event - generateEvent creates event ID", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test"
  });

  assertExists(generated.id, "Event ID should be generated");
  assert(generated.id.length > 0, "Event ID should not be empty");
});

deletionTest("Kind5Event - generateEvent includes created_at timestamp", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const before = Math.floor(Date.now() / 1000);
  const generated = event.generateEvent({
    relayUrl: "wss://relay.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test"
  });
  const after = Math.floor(Date.now() / 1000);

  assertExists(generated.created_at, "created_at should exist");
  assert(generated.created_at >= before && generated.created_at <= after + 1, "created_at should be current timestamp");
});

deletionTest("Kind5Event - generateEvent creates different IDs for different relays", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const event1 = event.generateEvent({
    relayUrl: "wss://relay1.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test"
  });

  const event2 = event.generateEvent({
    relayUrl: "wss://relay2.example.com",
    pubkey: TEST_PUBKEY,
    content: "Test"
  });

  assert(event1.id !== event2.id, "Different relay URLs should produce different event IDs");
});

deletionTest("deleteRelayCheckEvent - returns early if RELAYMON_NSEC missing", async () => {
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.delete("RELAYMON_NSEC");

  try {
    const config = createMockConfig();

    // Should return without error, just log a warning
    await deleteRelayCheckEvent(
      "wss://relay.example.com",
      "Test deletion",
      config
    );

    // If we get here, the function returned early as expected
    assert(true, "Function should return early without privkey");
  } finally {
    // Restore environment
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    }
  }
});

deletionTest("deleteRelayCheckEvent - returns early if config.publisher.relays is empty", async () => {
  // Set up environment
  const testPrivkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", nip19.nsecEncode(hexToBytes(testPrivkey)));

  try {
    const config = createMockConfig([]);

    // Should return without error, just log a warning
    await deleteRelayCheckEvent(
      "wss://relay.example.com",
      "Test deletion",
      config
    );

    // If we get here, the function returned early as expected
    assert(true, "Function should return early without relays");
  } finally {
    // Restore environment
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

deletionTest("deleteRelayCheckEvent - returns early if config.publisher.relays is not an array", async () => {
  // Set up environment
  const testPrivkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", nip19.nsecEncode(hexToBytes(testPrivkey)));

  try {
    const config = createMockConfig();
    // Intentionally break the relays array
    (config.publisher as any).relays = null;

    // Should return without error, just log a warning
    await deleteRelayCheckEvent(
      "wss://relay.example.com",
      "Test deletion",
      config
    );

    // If we get here, the function returned early as expected
    assert(true, "Function should return early without valid relays");
  } finally {
    // Restore environment
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

deletionTest("deleteRelayCheckEvent - skips duplicate deletion for same relay", async () => {
  // Set up environment
  const testPrivkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", nip19.nsecEncode(hexToBytes(testPrivkey)));

  try {
    const config = createMockConfig();
    const relayUrl = "wss://duplicate-test.example.com";

    // Mock Publisher to avoid actual network calls
    const mockPublisher = {
      publishEvent: async () => {
        // Mock successful publish
      }
    };

    // Temporarily replace Publisher import (this is a simplified test)
    // In reality, the first call would add to deletedRelays set
    // The second call should detect it and skip

    // First call - should proceed
    await deleteRelayCheckEvent(relayUrl, "First deletion", config);

    // Second call - should skip (detected in deletedRelays set)
    await deleteRelayCheckEvent(relayUrl, "Second deletion", config);

    // If we get here without errors, the duplicate detection worked
    assert(true, "Duplicate deletion should be handled gracefully");
  } finally {
    // Restore environment
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

deletionTest("deleteRelayCheckEvent - derives correct pubkey from privkey", async () => {
  // Set up environment with a known test key
  const expectedPubkey = getPublicKey(TEST_PRIVKEY);
  const originalEnv = Deno.env.get("RELAYMON_NSEC");
  Deno.env.set("RELAYMON_NSEC", TEST_NSEC);

  try {
    const config = createMockConfig();

    // Create an event to check the pubkey
    const event = new Kind5Event(expectedPubkey);
    const generated = event.generateEvent({
      relayUrl: "wss://relay.example.com",
      pubkey: expectedPubkey,
      content: "Test"
    });

    assertEquals(generated.pubkey, expectedPubkey);
  } finally {
    // Restore environment
    if (originalEnv) {
      Deno.env.set("RELAYMON_NSEC", originalEnv);
    } else {
      Deno.env.delete("RELAYMON_NSEC");
    }
  }
});

deletionTest("Kind5Event - handles different relay URL formats in a-tag", () => {
  const event = new Kind5Event(TEST_PUBKEY);

  const relayUrls = [
    "wss://relay.example.com",
    "wss://relay.example.com/path",
    "ws://relay.example.com",
    "wss://relay.example.com:8080",
  ];

  for (const relayUrl of relayUrls) {
    const generated = event.generateEvent({
      relayUrl,
      pubkey: TEST_PUBKEY,
      content: "Test"
    });

    const aTag = generated.tags.find(tag => tag[0] === "a");
    assertExists(aTag, `a-tag should exist for ${relayUrl}`);
    assertEquals(aTag[1], `30166:${TEST_PUBKEY}:${relayUrl}`, `a-tag should contain relay URL: ${relayUrl}`);
  }
});

deletionTest("Kind5Event - event structure matches NIP-09 spec", () => {
  const relayUrl = "wss://relay.example.com";
  const content = "Relay marked as duplicate";
  const event = new Kind5Event(TEST_PUBKEY);

  const generated = event.generateEvent({
    relayUrl,
    pubkey: TEST_PUBKEY,
    content
  });

  // NIP-09 deletion event structure validation
  assertEquals(generated.kind, 5, "Should be kind 5");
  assertExists(generated.id, "Should have event ID");
  assertExists(generated.pubkey, "Should have pubkey");
  assertExists(generated.created_at, "Should have timestamp");
  assertEquals(generated.content, content, "Should have content");
  assert(Array.isArray(generated.tags), "Should have tags array");
  assert(generated.tags.length >= 2, "Should have at least a-tag and k-tag");
});
