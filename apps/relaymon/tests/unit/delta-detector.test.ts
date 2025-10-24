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

console.log("Delta detector tests completed");
