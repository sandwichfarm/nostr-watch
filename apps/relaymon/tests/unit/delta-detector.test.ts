import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { detectDeltas, deltasToTags } from "../../src/delta/detector.ts";
import type { RelayInfo } from "../../src/types/relay.ts";

/**
 * Test helper to disable resource/ops sanitization
 */
function deltaTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

/**
 * Create mock NIP-11 relay info
 */
function createMockRelayInfo(overrides: Partial<RelayInfo> = {}): RelayInfo {
  return {
    name: "Test Relay",
    description: "A test relay",
    pubkey: "test-pubkey-abc123",
    contact: "test@example.com",
    supported_nips: [1, 2, 11],
    software: "test-software",
    version: "1.0.0",
    ...overrides
  };
}

deltaTest("Delta Detector: First check should mark all fields as additions", () => {
  const currentState = createMockRelayInfo();
  const deltas = detectDeltas(null, currentState);

  // All fields should be additions (prefixed with +)
  assert(deltas.length > 0, "Should have detected deltas");
  assert(deltas.every(d => d.key.startsWith("+")), "All deltas should be additions on first check");
  assert(deltas.some(d => d.key === "+name"), "Should detect name as addition");
  assert(deltas.some(d => d.key === "+description"), "Should detect description as addition");
});

deltaTest("Delta Detector: No changes should produce no deltas", () => {
  const previousState = createMockRelayInfo();
  const currentState = createMockRelayInfo();

  const deltas = detectDeltas(previousState, currentState);

  assertEquals(deltas.length, 0, "Identical states should produce no deltas");
});

deltaTest("Delta Detector: Simple field change should be detected", () => {
  const previousState = createMockRelayInfo({ name: "Old Name" });
  const currentState = createMockRelayInfo({ name: "New Name" });

  const deltas = detectDeltas(previousState, currentState);

  assertEquals(deltas.length, 1, "Should detect one change");
  assertEquals(deltas[0].key, "name", "Should detect name change");
  assertEquals(deltas[0].value, "New Name", "Should have new value");
  assertEquals(deltas[0].type, "change", "Should be a change type");
});

deltaTest("Delta Detector: Field removal should be detected", () => {
  const previousState = createMockRelayInfo({ contact: "old@example.com" });
  const currentState = createMockRelayInfo();
  delete currentState.contact;

  const deltas = detectDeltas(previousState, currentState);

  assert(deltas.some(d => d.key === "-contact"), "Should detect contact removal");
  const removedDelta = deltas.find(d => d.key === "-contact");
  assertEquals(removedDelta?.type, "remove", "Should be a remove type");
});

deltaTest("Delta Detector: Field addition should be detected", () => {
  const previousState = createMockRelayInfo();
  delete previousState.contact;
  const currentState = createMockRelayInfo({ contact: "new@example.com" });

  const deltas = detectDeltas(previousState, currentState);

  assert(deltas.some(d => d.key === "+contact"), "Should detect contact addition");
  const addedDelta = deltas.find(d => d.key === "+contact");
  assertEquals(addedDelta?.value, "new@example.com", "Should have new value");
  assertEquals(addedDelta?.type, "add", "Should be an add type");
});

deltaTest("Delta Detector: Array changes should detect additions and removals", () => {
  const previousState = createMockRelayInfo({ supported_nips: [1, 2, 3] });
  const currentState = createMockRelayInfo({ supported_nips: [1, 3, 4] });

  const deltas = detectDeltas(previousState, currentState);

  // Should detect removal of 2 and addition of 4
  assert(deltas.some(d => d.key === "-supported_nips" && d.value === "2"), "Should detect NIP 2 removal");
  assert(deltas.some(d => d.key === "+supported_nips" && d.value === "4"), "Should detect NIP 4 addition");
  assert(!deltas.some(d => d.value === "1" || d.value === "3"), "Should not include unchanged NIPs");
});

deltaTest("Delta Detector: Nested object changes should use dot notation", () => {
  const previousState = createMockRelayInfo({
    limitation: {
      max_message_length: 1000,
      auth_required: false
    }
  });
  const currentState = createMockRelayInfo({
    limitation: {
      max_message_length: 2000,
      auth_required: true
    }
  });

  const deltas = detectDeltas(previousState, currentState);

  assert(deltas.some(d => d.key === "limitation.max_message_length"), "Should detect nested max_message_length change");
  assert(deltas.some(d => d.key === "limitation.auth_required"), "Should detect nested auth_required change");

  const maxMsgDelta = deltas.find(d => d.key === "limitation.max_message_length");
  assertEquals(maxMsgDelta?.value, "2000", "Should have new value for max_message_length");

  const authDelta = deltas.find(d => d.key === "limitation.auth_required");
  assertEquals(authDelta?.value, "true", "Should have new value for auth_required");
});

deltaTest("Delta Detector: Complex arrays should be JSON stringified", () => {
  const previousState = createMockRelayInfo({
    retention: [[{ kinds: [0, 1], time: 3600 }]]
  });
  const currentState = createMockRelayInfo({
    retention: [[{ kinds: [0, 1, 2], time: 3600 }]]
  });

  const deltas = detectDeltas(previousState, currentState);

  // Retention should be detected as a change with JSON stringified value
  assert(deltas.some(d => d.key === "retention"), "Should detect retention change");
  const retentionDelta = deltas.find(d => d.key === "retention");
  assertExists(retentionDelta, "Retention delta should exist");
  assertEquals(retentionDelta.type, "change", "Should be a change type");
  // The value should be a JSON string
  assert(retentionDelta.value.includes("kinds"), "Should contain JSON representation");
});

deltaTest("Delta Detector: deltasToTags should convert to tag format", () => {
  const previousState = createMockRelayInfo({ name: "Old" });
  const currentState = createMockRelayInfo({ name: "New" });

  const deltas = detectDeltas(previousState, currentState);
  const tags = deltasToTags(deltas);

  assertEquals(tags.length, 1, "Should have one tag");
  assertEquals(tags[0][0], "name", "Tag should have name as first element");
  assertEquals(tags[0][1], "New", "Tag should have new value as second element");
});

deltaTest("Delta Detector: Multiple changes should all be detected", () => {
  const previousState = createMockRelayInfo({
    name: "Old Name",
    description: "Old Description",
    supported_nips: [1, 2],
    software: "old-software"
  });
  const currentState = createMockRelayInfo({
    name: "New Name",
    description: "Old Description", // unchanged
    supported_nips: [1, 3], // changed: removed 2, added 3
    software: "new-software"
  });

  const deltas = detectDeltas(previousState, currentState);

  // Should detect:
  // - name change
  // - software change
  // - supported_nips removal of 2
  // - supported_nips addition of 3
  assert(deltas.some(d => d.key === "name"), "Should detect name change");
  assert(deltas.some(d => d.key === "software"), "Should detect software change");
  assert(deltas.some(d => d.key === "-supported_nips" && d.value === "2"), "Should detect NIP 2 removal");
  assert(deltas.some(d => d.key === "+supported_nips" && d.value === "3"), "Should detect NIP 3 addition");
  assert(!deltas.some(d => d.key === "description"), "Should not detect unchanged description");
});

deltaTest("Delta Detector: Complex array - retention should be JSON stringified", () => {
  const previousState = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1], time: 3600 }]
    ]
  });
  const currentState = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1, 2], time: 3600 }]
    ]
  });

  const deltas = detectDeltas(previousState, currentState);

  // Should detect retention as a single change with JSON value
  const retentionDelta = deltas.find(d => d.key === "retention");
  assertExists(retentionDelta, "Should detect retention change");
  assertEquals(retentionDelta.type, "change", "Should be a change type");
  assert(retentionDelta.value.includes("kinds"), "Value should be JSON string containing 'kinds'");
  assert(retentionDelta.value.includes("time"), "Value should be JSON string containing 'time'");
});

deltaTest("Delta Detector: Complex array - fees.subscription should be JSON stringified", () => {
  const previousState = createMockRelayInfo({
    fees: {
      subscription: [{ amount: 1000, unit: "msats" }]
    }
  });
  const currentState = createMockRelayInfo({
    fees: {
      subscription: [{ amount: 2000, unit: "msats" }]
    }
  });

  const deltas = detectDeltas(previousState, currentState);

  // Should detect fees.subscription as a single change
  const feesDelta = deltas.find(d => d.key === "fees.subscription");
  assertExists(feesDelta, "Should detect fees.subscription change");
  assertEquals(feesDelta.type, "change", "Should be a change type");
  assert(feesDelta.value.includes("amount"), "Value should contain amount");
  assert(feesDelta.value.includes("2000"), "Value should contain new amount");
});

deltaTest("Delta Detector: Complex array - no change should not emit delta", () => {
  const previousState = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1], time: 3600 }]
    ]
  });
  const currentState = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1], time: 3600 }]
    ]
  });

  const deltas = detectDeltas(previousState, currentState);

  // Should not detect any retention changes
  const retentionDelta = deltas.find(d => d.key === "retention");
  assertEquals(retentionDelta, undefined, "Should not detect unchanged retention");
});

deltaTest("Delta Detector: Complex array - fees with multiple types", () => {
  const previousState = createMockRelayInfo({
    fees: {
      admission: [{ amount: 5000, unit: "msats" }],
      subscription: [{ amount: 1000, unit: "msats", period: 2592000 }]
    }
  });
  const currentState = createMockRelayInfo({
    fees: {
      admission: [{ amount: 5000, unit: "msats" }], // unchanged
      subscription: [{ amount: 1500, unit: "msats", period: 2592000 }] // changed
    }
  });

  const deltas = detectDeltas(previousState, currentState);

  // Should only detect subscription change, not admission
  assert(!deltas.some(d => d.key.includes("admission")), "Should not detect unchanged admission");
  assert(deltas.some(d => d.key === "fees.subscription"), "Should detect subscription change");

  const subDelta = deltas.find(d => d.key === "fees.subscription");
  assert(subDelta!.value.includes("1500"), "Should have new subscription amount");
});

deltaTest("Delta Detector: Complex array - retention removal", () => {
  const previousState = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1], time: 3600 }]
    ]
  });
  const currentState = createMockRelayInfo({});
  delete currentState.retention;

  const deltas = detectDeltas(previousState, currentState);

  // Should detect retention removal
  const retentionDelta = deltas.find(d => d.key === "-retention");
  assertExists(retentionDelta, "Should detect retention removal");
  assertEquals(retentionDelta.type, "remove", "Should be a remove type");
});

deltaTest("Delta Detector: DNS changes should be detected with dns prefix", () => {
  const previousState = {
    ...createMockRelayInfo(),
    "dns.address": "1.2.3.4",
  } as any;

  const currentState = {
    ...createMockRelayInfo(),
    "dns.address": "5.6.7.8",
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  const dnsDelta = deltas.find(d => d.key === "dns.address");
  assertExists(dnsDelta, "Should detect DNS address change");
  assertEquals(dnsDelta.value, "5.6.7.8", "Should have new DNS address");
  assertEquals(dnsDelta.type, "change", "Should be a change type");
});

deltaTest("Delta Detector: DNS addition should be detected", () => {
  const previousState = createMockRelayInfo();

  const currentState = {
    ...createMockRelayInfo(),
    "dns.address": "1.2.3.4",
    "dns.addresses": ["1.2.3.4", "5.6.7.8"],
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  const addressDelta = deltas.find(d => d.key === "+dns.address");
  assertExists(addressDelta, "Should detect DNS address addition");
  assertEquals(addressDelta.value, "1.2.3.4", "Should have DNS address value");

  const addressesDelta = deltas.find(d => d.key === "+dns.addresses");
  assertExists(addressesDelta, "Should detect DNS addresses addition");
});

deltaTest("Delta Detector: Geo changes should be detected with geo prefix", () => {
  const previousState = {
    ...createMockRelayInfo(),
    "geo.country": "US",
    "geo.city": "New York",
  } as any;

  const currentState = {
    ...createMockRelayInfo(),
    "geo.country": "US",
    "geo.city": "San Francisco",
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  const cityDelta = deltas.find(d => d.key === "geo.city");
  assertExists(cityDelta, "Should detect city change");
  assertEquals(cityDelta.value, "San Francisco", "Should have new city");
  assertEquals(cityDelta.type, "change", "Should be a change type");

  // Country should not change
  const countryDelta = deltas.find(d => d.key === "geo.country");
  assertEquals(countryDelta, undefined, "Should not detect country change when it's the same");
});

deltaTest("Delta Detector: Geo addition with geohash", () => {
  const previousState = createMockRelayInfo();

  const currentState = {
    ...createMockRelayInfo(),
    "geo.country": "DE",
    "geo.city": "Berlin",
    "geo.lat": 52.52,
    "geo.lon": 13.405,
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  assert(deltas.some(d => d.key === "+geo.country"), "Should detect country addition");
  assert(deltas.some(d => d.key === "+geo.city"), "Should detect city addition");
  assert(deltas.some(d => d.key === "+geo.lat"), "Should detect latitude addition");
  assert(deltas.some(d => d.key === "+geo.lon"), "Should detect longitude addition");
});

deltaTest("Delta Detector: Combined NIP-11, DNS, and geo changes", () => {
  const previousState = {
    ...createMockRelayInfo(),
    "dns.address": "1.2.3.4",
    "geo.country": "US",
  } as any;

  const currentState = {
    ...createMockRelayInfo({ name: "Updated Relay" }),
    "dns.address": "5.6.7.8",
    "geo.country": "US",
    "geo.city": "Seattle",
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  // NIP-11 change
  const nameDelta = deltas.find(d => d.key === "name");
  assertExists(nameDelta, "Should detect name change");
  assertEquals(nameDelta.value, "Updated Relay");

  // DNS change
  const dnsDelta = deltas.find(d => d.key === "dns.address");
  assertExists(dnsDelta, "Should detect DNS change");
  assertEquals(dnsDelta.value, "5.6.7.8");

  // Geo addition
  const geoDelta = deltas.find(d => d.key === "+geo.city");
  assertExists(geoDelta, "Should detect geo city addition");
  assertEquals(geoDelta.value, "Seattle");
});

deltaTest("Delta Detector: ASN and geohash tracking", () => {
  const previousState = {
    ...createMockRelayInfo(),
    "dns.asn": "15169",
    "dns.as": "GOOGLE",
    "geo.isp": "Google LLC",
  } as any;

  const currentState = {
    ...createMockRelayInfo(),
    "dns.asn": "13335",
    "dns.as": "CLOUDFLARE",
    "geo.isp": "Cloudflare Inc",
    "geo.geohash": "9q8yy",
  } as any;

  const deltas = detectDeltas(previousState, currentState);

  // ASN change in DNS
  const asnDelta = deltas.find(d => d.key === "dns.asn");
  assertExists(asnDelta, "Should detect ASN change");
  assertEquals(asnDelta.value, "13335");

  // AS name change
  const asDelta = deltas.find(d => d.key === "dns.as");
  assertExists(asDelta, "Should detect AS name change");
  assertEquals(asDelta.value, "CLOUDFLARE");

  // ISP change
  const ispDelta = deltas.find(d => d.key === "geo.isp");
  assertExists(ispDelta, "Should detect ISP change");
  assertEquals(ispDelta.value, "Cloudflare Inc");

  // Geohash addition
  const geohashDelta = deltas.find(d => d.key === "+geo.geohash");
  assertExists(geohashDelta, "Should detect geohash addition");
  assertEquals(geohashDelta.value, "9q8yy");
});

console.log("Delta detector tests completed");
