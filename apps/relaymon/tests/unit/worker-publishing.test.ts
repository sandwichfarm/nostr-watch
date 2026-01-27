import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { Kind30166 } from "npm:@nostrwatch/publisher";
import { getPublicKey, getEventHash, verifyEvent } from "npm:nostr-tools";
import type { RelayCheckResult } from "../../src/types/relay.ts";

/**
 * Test helper to disable resource/ops sanitization
 */
function publishTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

// Use a valid test private key
const TEST_PRIVKEY = "0000000000000000000000000000000000000000000000000000000000000001";
const TEST_PUBKEY = getPublicKey(TEST_PRIVKEY);

/**
 * Create a mock relay check result for testing
 */
function createMockRelayCheckResult(overrides: Partial<RelayCheckResult> = {}): RelayCheckResult {
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
    read: {
      data: true,
      duration: 200
    },
    write: {
      data: true,
      duration: 180
    },
    info: {
      data: {
        name: "Test Relay",
        description: "A test relay",
        pubkey: TEST_PUBKEY,
        supported_nips: [1, 2, 9, 11],
        software: "nostr-relay",
        version: "1.0.0"
      },
      duration: 100
    },
    ...overrides
  } as RelayCheckResult;
}

// Test suite for Kind30166 event generation
publishTest("Kind30166 - constructor creates event with correct kind", () => {
  const event = new Kind30166(TEST_PUBKEY);
  assertExists(event, "Event should be created");
  assertEquals(event.kind, 30166, "Event kind should be 30166");
});

publishTest("Kind30166 - generateEvent creates valid event structure", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult();

  const generated = event.generateEvent(checkResult);

  assertExists(generated, "Generated event should exist");
  assertEquals(generated.kind, 30166, "Kind should be 30166");
  assertEquals(generated.pubkey, TEST_PUBKEY, "Pubkey should match");
  assertExists(generated.tags, "Tags should exist");
  assert(Array.isArray(generated.tags), "Tags should be an array");
  assertExists(generated.content, "Content should exist");
  assertExists(generated.created_at, "Timestamp should exist");
});

publishTest("Kind30166 - event includes d-tag with relay URL", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const relayUrl = "wss://test-relay.example.com";
  const checkResult = createMockRelayCheckResult({ url: relayUrl });

  const generated = event.generateEvent(checkResult);

  const dTag = generated.tags.find(tag => tag[0] === "d");
  assertExists(dTag, "d-tag should exist");
  assertEquals(dTag[1], relayUrl, "d-tag should contain relay URL");
});

publishTest("Kind30166 - event includes network tag", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({ network: "clearnet" });

  const generated = event.generateEvent(checkResult);

  const nTag = generated.tags.find(tag => tag[0] === "n");
  assertExists(nTag, "n-tag should exist");
  assertEquals(nTag[1], "clearnet", "n-tag should contain network type");
});

publishTest("Kind30166 - event includes RTT tags for timing data", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    open: { data: true, duration: 150 },
    read: { data: true, duration: 200 },
    write: { data: true, duration: 180 }
  });

  const generated = event.generateEvent(checkResult);

  const rttOpenTag = generated.tags.find(tag => tag[0] === "rtt-open");
  const rttReadTag = generated.tags.find(tag => tag[0] === "rtt-read");
  const rttWriteTag = generated.tags.find(tag => tag[0] === "rtt-write");

  assertExists(rttOpenTag, "rtt-open tag should exist");
  assertExists(rttReadTag, "rtt-read tag should exist");
  assertExists(rttWriteTag, "rtt-write tag should exist");

  assertEquals(rttOpenTag[1], "150", "rtt-open should be rounded");
  assertEquals(rttReadTag[1], "200", "rtt-read should be rounded");
  assertEquals(rttWriteTag[1], "180", "rtt-write should be rounded");
});

publishTest("Kind30166 - event includes NIP-11 info in content", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        name: "Test Relay",
        description: "A test relay",
        pubkey: TEST_PUBKEY,
        supported_nips: [1, 2, 9, 11]
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  assertExists(generated.content, "Content should exist");
  assert(generated.content.length > 2, "Content should not be empty JSON");

  const parsedContent = JSON.parse(generated.content);
  assertEquals(parsedContent.name, "Test Relay", "Content should include relay name");
  assertEquals(parsedContent.description, "A test relay", "Content should include description");
});

publishTest("Kind30166 - event includes supported NIPs as N tags", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        supported_nips: [1, 2, 9, 11, 50]
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const nTags = generated.tags.filter(tag => tag[0] === "N");
  assert(nTags.length >= 5, "Should have N tags for NIPs");

  const nipNumbers = nTags.map(tag => parseInt(tag[1]));
  assert(nipNumbers.includes(1), "Should include NIP-1");
  assert(nipNumbers.includes(2), "Should include NIP-2");
  assert(nipNumbers.includes(9), "Should include NIP-9");
  assert(nipNumbers.includes(11), "Should include NIP-11");
  assert(nipNumbers.includes(50), "Should include NIP-50");
});

publishTest("Kind30166 - event includes relay pubkey as p-tag", () => {
  const relayPubkey = "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798";
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        pubkey: relayPubkey
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const pTag = generated.tags.find(tag => tag[0] === "p");
  assertExists(pTag, "p-tag should exist");
  assertEquals(pTag[1], relayPubkey, "p-tag should contain relay pubkey");
});

publishTest("Kind30166 - event includes software and version tags", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        software: "nostr-rs-relay",
        version: "0.8.9"
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const sTag = generated.tags.find(tag => tag[0] === "s");
  assertExists(sTag, "s-tag (software) should exist");
  assertEquals(sTag[1], "nostr-rs-relay", "Software should match");

  const versionTags = generated.tags.filter(tag => tag[0] === "l" && tag[2] === "nip11.version");
  assert(versionTags.length > 0, "Version label tag should exist");
  assertEquals(versionTags[0][1], "0.8.9", "Version should match");
});

publishTest("Kind30166 - event includes limitation/restriction tags", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        limitation: {
          auth_required: true,
          payment_required: false,
          pow_required: false
        }
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const rTags = generated.tags.filter(tag => tag[0] === "R");

  const authTag = rTags.find(tag => tag[1] === "auth");
  const noPaymentTag = rTags.find(tag => tag[1] === "!payment");
  const noPowTag = rTags.find(tag => tag[1] === "!pow");

  assertExists(authTag, "Should have 'auth' R tag when auth required");
  assertExists(noPaymentTag, "Should have '!payment' R tag when payment not required");
  assertExists(noPowTag, "Should have '!pow' R tag when pow not required");
});

publishTest("Kind30166 - event includes draft version tag", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult();

  const generated = event.generateEvent(checkResult);

  const draftTag = generated.tags.find(tag => tag[0] === "l" && tag[2] === "nip66.draft");
  assertExists(draftTag, "Draft version tag should exist");
  assertEquals(draftTag[1], "draft7", "Should be draft7");
});

publishTest("Kind30166 - signEvent creates valid signed event", async () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult();

  event.generateEvent(checkResult);
  const signedEvent = await event.signEvent(TEST_PRIVKEY);

  assertExists(signedEvent, "Signed event should exist");
  assertExists(signedEvent.id, "Event ID should exist");
  assertExists(signedEvent.sig, "Signature should exist");
  assertEquals(signedEvent.pubkey, TEST_PUBKEY, "Pubkey should match");

  // Verify the signature is valid
  const isValid = verifyEvent(signedEvent);
  assert(isValid, "Event signature should be valid");
});

publishTest("Kind30166 - signed event has correct ID", async () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult();

  const generated = event.generateEvent(checkResult);
  const signedEvent = await event.signEvent(TEST_PRIVKEY);

  // Compute expected ID manually
  const expectedId = getEventHash(generated);

  assertEquals(signedEvent.id, expectedId, "Event ID should match computed hash");
});

publishTest("Kind30166 - event with minimal check result", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const minimalResult = createMockRelayCheckResult({
    open: undefined,
    read: undefined,
    write: undefined,
    info: undefined
  });

  const generated = event.generateEvent(minimalResult);

  assertExists(generated, "Should generate event with minimal data");
  assertEquals(generated.content, "{}", "Content should be empty JSON");

  const dTag = generated.tags.find(tag => tag[0] === "d");
  assertExists(dTag, "Should still have d-tag");
});

publishTest("Kind30166 - event with tor network", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    url: "ws://somerelayabc123xyz.onion",
    network: "tor"
  });

  const generated = event.generateEvent(checkResult);

  const nTag = generated.tags.find(tag => tag[0] === "n");
  assertExists(nTag, "Network tag should exist");
  assertEquals(nTag[1], "tor", "Network should be tor");
});

publishTest("Kind30166 - event with SSL certificate info", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    protocol: "wss:",
    ssl: {
      data: {
        valid_from: "2024-01-01T00:00:00Z",
        valid_to: "2025-12-31T23:59:59Z"
      },
      duration: 50
    }
  });

  const generated = event.generateEvent(checkResult);

  const sslTag = generated.tags.find(tag => tag[0] === "R" && (tag[1] === "ssl" || tag[1] === "!ssl"));
  assertExists(sslTag, "SSL R tag should exist");
  // Should be 'ssl' since dates are valid
  assertEquals(sslTag[1], "ssl", "Should indicate valid SSL");
});

publishTest("Kind30166 - event with DNS info (IPv4 and IPv6)", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    dns: {
      data: {
        ipv4: ["192.0.2.1", "192.0.2.2"],
        ipv6: ["2001:db8::1", "2001:db8::2"]
      },
      duration: 30
    }
  });

  const generated = event.generateEvent(checkResult);

  const ipv4LabelTag = generated.tags.find(tag => tag[0] === "L" && tag[1] === "dns.ipv4");
  const ipv6LabelTag = generated.tags.find(tag => tag[0] === "L" && tag[1] === "dns.ipv6");

  assertExists(ipv4LabelTag, "IPv4 label tag should exist");
  assertExists(ipv6LabelTag, "IPv6 label tag should exist");

  const ipv4Tags = generated.tags.filter(tag => tag[0] === "l" && tag[2] === "dns.ipv4");
  const ipv6Tags = generated.tags.filter(tag => tag[0] === "l" && tag[2] === "dns.ipv6");

  assertEquals(ipv4Tags.length, 2, "Should have 2 IPv4 addresses");
  assertEquals(ipv6Tags.length, 2, "Should have 2 IPv6 addresses");
});

publishTest("Kind30166 - event with language tags", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        language_tags: ["en", "es", "ja"]
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const iso6391Label = generated.tags.find(tag => tag[0] === "L" && tag[1] === "ISO-639-1");
  assertExists(iso6391Label, "ISO-639-1 label should exist");

  const langTags = generated.tags.filter(tag => tag[0] === "l" && tag[2] === "ISO-639-1");
  assert(langTags.length >= 3, "Should have language tags");

  const langs = langTags.map(tag => tag[1]);
  assert(langs.includes("en"), "Should include English");
  assert(langs.includes("es"), "Should include Spanish");
  assert(langs.includes("ja"), "Should include Japanese");
});

publishTest("Kind30166 - event with relay tags", () => {
  const event = new Kind30166(TEST_PUBKEY);
  const checkResult = createMockRelayCheckResult({
    info: {
      data: {
        tags: ["bitcoin", "lightning", "nsfw"]
      },
      duration: 100
    }
  });

  const generated = event.generateEvent(checkResult);

  const tTags = generated.tags.filter(tag => tag[0] === "t");
  assert(tTags.length >= 3, "Should have t-tags");

  const tagValues = tTags.map(tag => tag[1]);
  assert(tagValues.includes("bitcoin"), "Should include bitcoin tag");
  assert(tagValues.includes("lightning"), "Should include lightning tag");
  assert(tagValues.includes("nsfw"), "Should include nsfw tag");
});

publishTest("Kind30166 - multiple events have unique IDs", async () => {
  const event1 = new Kind30166(TEST_PUBKEY);
  const event2 = new Kind30166(TEST_PUBKEY);

  const result1 = createMockRelayCheckResult({ url: "wss://relay1.example.com" });
  const result2 = createMockRelayCheckResult({ url: "wss://relay2.example.com" });

  event1.generateEvent(result1);
  event2.generateEvent(result2);

  const signed1 = await event1.signEvent(TEST_PRIVKEY);
  const signed2 = await event2.signEvent(TEST_PRIVKEY);

  assert(signed1.id !== signed2.id, "Different relays should have different event IDs");
});

publishTest("Kind30166 - event is replaceable (d-tag makes it unique per relay)", () => {
  const event1 = new Kind30166(TEST_PUBKEY);
  const event2 = new Kind30166(TEST_PUBKEY);
  const relayUrl = "wss://relay.example.com";

  const result1 = createMockRelayCheckResult({ url: relayUrl, checked_at: 1000 });
  const result2 = createMockRelayCheckResult({ url: relayUrl, checked_at: 2000 });

  const generated1 = event1.generateEvent(result1);
  const generated2 = event2.generateEvent(result2);

  // Both should have same d-tag (same relay URL)
  const dTag1 = generated1.tags.find(tag => tag[0] === "d");
  const dTag2 = generated2.tags.find(tag => tag[0] === "d");

  assertEquals(dTag1?.[1], dTag2?.[1], "Both events should have same d-tag (same relay)");
  assertEquals(dTag1?.[1], relayUrl, "d-tag should be relay URL");

  // d-tag makes it a parameterized replaceable event (NIP-33)
  // Newer events with same d-tag replace older ones
  assert(dTag1 !== undefined && dTag2 !== undefined, "Both should have d-tags for replaceability");
});
