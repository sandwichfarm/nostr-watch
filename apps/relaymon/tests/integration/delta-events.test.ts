import { assertEquals, assertExists, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  initializeDB,
  getLastDeltaState,
  storeDeltaState,
  getPeriodSnapshot,
  storePeriodSnapshot,
  clearDeltaState,
  clearPeriodSnapshots
} from "../../src/db/db.ts";
import { detectDeltas } from "../../src/delta/detector.ts";
import { Kind1066 } from "../../src/delta/kind1066.ts";
import { getPeriodsToEmit } from "../../src/delta/periods.ts";
import type { RelayInfo } from "../../src/types/relay.ts";

/**
 * Integration test helper
 */
function integrationTest(name: string, fn: () => void | Promise<void>) {
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn
  });
}

// Test database
const TEST_DB_PATH = `/tmp/test-delta-integration-${Date.now()}.db`;
let dbInitialized = false;

function ensureTestDB() {
  if (!dbInitialized) {
    initializeDB(TEST_DB_PATH, false);
    dbInitialized = true;
  }
}

/**
 * Mock NIP-11 relay info
 */
function createMockRelayInfo(overrides: Partial<RelayInfo> = {}): RelayInfo {
  return {
    name: "Test Relay",
    description: "A test relay for delta events",
    pubkey: "test-pubkey-abc123",
    supported_nips: [1, 2, 11, 42],
    software: "test-software",
    version: "1.0.0",
    limitation: {
      max_message_length: 16384,
      max_subscriptions: 20,
      auth_required: false,
      payment_required: false
    },
    ...overrides
  };
}

integrationTest("Delta Events Integration: First check flow", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-first.example.com";
  const currentInfo = createMockRelayInfo();

  // Clean state
  clearDeltaState(relayUrl);
  clearPeriodSnapshots(relayUrl);

  // 1. Get last state (should be null for first check)
  const lastState = getLastDeltaState(relayUrl);
  assertEquals(lastState, null, "First check should have no previous state");

  // 2. Detect deltas
  const deltas = detectDeltas(null, currentInfo);
  assert(deltas.length > 0, "First check should have deltas (all additions)");
  assert(deltas.every(d => d.key.startsWith("+")), "All deltas should be additions");

  // 3. Generate Kind 1066 event
  const testPubkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const eventBuilder = new Kind1066(testPubkey);
  const event = eventBuilder.generateEvent({
    url: relayUrl,
    online: true,
    rttOpen: 123,
    deltas: deltas
  });

  assertEquals(event.kind, 1066, "Should be Kind 1066");
  assert(event.tags.some(t => t[0] === "d" && t[1] === relayUrl), "Should have d tag with URL");
  assert(event.tags.some(t => t[0] === "rtt-open"), "Should have rtt-open tag");
  assert(event.tags.some(t => t[0].startsWith("+")), "Should have addition tags");

  // 4. Store state
  storeDeltaState(relayUrl, {
    state: currentInfo,
    rttOpen: 123
  });

  // 5. Verify state was stored
  const storedState = getLastDeltaState(relayUrl);
  assertExists(storedState, "State should be stored");
  assertEquals(storedState.state.name, currentInfo.name, "Stored name should match");
});

integrationTest("Delta Events Integration: Subsequent check with changes", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-changes.example.com";

  // Setup: Store initial state
  const initialInfo = createMockRelayInfo({
    name: "Old Name",
    supported_nips: [1, 2, 11]
  });
  storeDeltaState(relayUrl, {
    state: initialInfo,
    rttOpen: 100
  });

  // New state with changes
  const currentInfo = createMockRelayInfo({
    name: "New Name", // changed
    supported_nips: [1, 2, 11, 42] // added 42
  });

  // 1. Get last state
  const lastState = getLastDeltaState(relayUrl);
  assertExists(lastState, "Should have previous state");

  // 2. Detect deltas (only changes)
  const deltas = detectDeltas(lastState.state, currentInfo);
  assert(deltas.length > 0, "Should detect changes");
  assert(deltas.some(d => d.key === "name"), "Should detect name change");
  assert(deltas.some(d => d.key === "+supported_nips" && d.value === "42"), "Should detect NIP addition");

  // 3. Generate event
  const testPubkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const eventBuilder = new Kind1066(testPubkey);
  const event = eventBuilder.generateEvent({
    url: relayUrl,
    online: true,
    rttOpen: 110,
    deltas: deltas
  });

  assert(event.tags.some(t => t[0] === "name"), "Should have name change tag");
  assert(event.tags.some(t => t[0] === "+supported_nips"), "Should have NIP addition tag");

  // 4. Update state
  storeDeltaState(relayUrl, {
    state: currentInfo,
    rttOpen: 110
  });
});

integrationTest("Delta Events Integration: Offline relay with retry count", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-offline.example.com";
  const retryCount = 5;

  // Generate offline event
  const testPubkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const eventBuilder = new Kind1066(testPubkey);
  const event = eventBuilder.generateEvent({
    url: relayUrl,
    online: false,
    retryCount: retryCount,
    deltas: [] // Should be ignored for offline
  });

  assertEquals(event.kind, 1066);
  assert(event.tags.some(t => t[0] === "d" && t[1] === relayUrl), "Should have d tag");
  assert(event.tags.some(t => t[0] === "retry" && t[1] === "5"), "Should have retry tag");
  assert(!event.tags.some(t => t[0] === "rtt-open"), "Should NOT have rtt-open when offline");
  assert(!event.tags.some(t => t[0].startsWith("+")), "Should NOT have delta tags when offline");
});

integrationTest("Delta Events Integration: Period aggregates with cascading T tags", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-periods.example.com";
  const currentInfo = createMockRelayInfo();

  // Clean state
  clearDeltaState(relayUrl);
  clearPeriodSnapshots(relayUrl);

  const checkIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
  const configuredPeriods = ["6h", "1d", "7d"];
  const nowTs = Math.floor(Date.now() / 1000);

  // First check - all periods should emit (never emitted before)
  const periodSnapshotTimes = new Map<string, number>();
  configuredPeriods.forEach(p => periodSnapshotTimes.set(p, 0));

  const periodsToEmit = getPeriodsToEmit(
    configuredPeriods,
    checkIntervalMs,
    periodSnapshotTimes,
    nowTs
  );

  assertEquals(periodsToEmit.length, 3, "All periods should emit on first check");
  assert(periodsToEmit.includes("6h"), "Should emit 6h");
  assert(periodsToEmit.includes("1d"), "Should emit 1d");
  assert(periodsToEmit.includes("7d"), "Should emit 7d");

  // Generate event with cascading T tags
  const testPubkey = "0000000000000000000000000000000000000000000000000000000000000001";
  const eventBuilder = new Kind1066(testPubkey);
  const deltas = detectDeltas(null, currentInfo); // First check

  const event = eventBuilder.generateEvent({
    url: relayUrl,
    online: true,
    rttOpen: 150,
    deltas: deltas,
    periods: periodsToEmit
  });

  // Verify cascading T tags
  const tTags = event.tags.filter(t => t[0] === "T");
  assertEquals(tTags.length, 3, "Should have 3 T tags");
  assert(tTags.some(t => t[1] === "6h"), "Should have T tag for 6h");
  assert(tTags.some(t => t[1] === "1d"), "Should have T tag for 1d");
  assert(tTags.some(t => t[1] === "7d"), "Should have T tag for 7d");

  // Store period snapshots
  periodsToEmit.forEach(period => {
    storePeriodSnapshot(relayUrl, period, currentInfo);
  });

  // Verify snapshots were stored
  const snapshot6h = getPeriodSnapshot(relayUrl, "6h");
  const snapshot1d = getPeriodSnapshot(relayUrl, "1d");
  const snapshot7d = getPeriodSnapshot(relayUrl, "7d");

  assertExists(snapshot6h, "6h snapshot should exist");
  assertExists(snapshot1d, "1d snapshot should exist");
  assertExists(snapshot7d, "7d snapshot should exist");
  assertEquals(snapshot6h.state.name, currentInfo.name, "Snapshot should have correct state");
});

integrationTest("Delta Events Integration: Period selective emission", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-selective.example.com";
  const checkIntervalMs = 6 * 60 * 60 * 1000; // 6 hours
  const configuredPeriods = ["6h", "1d", "7d"];
  const nowTs = Math.floor(Date.now() / 1000);

  // Simulate: 6h emitted 7h ago (should emit), 1d emitted 12h ago (should NOT emit), 7d never emitted (should emit)
  const periodSnapshotTimes = new Map<string, number>();
  periodSnapshotTimes.set("6h", nowTs - (7 * 3600)); // 7 hours ago
  periodSnapshotTimes.set("1d", nowTs - (12 * 3600)); // 12 hours ago (< 1 day)
  periodSnapshotTimes.set("7d", 0); // Never emitted

  const periodsToEmit = getPeriodsToEmit(
    configuredPeriods,
    checkIntervalMs,
    periodSnapshotTimes,
    nowTs
  );

  assertEquals(periodsToEmit.length, 2, "Should emit 2 periods");
  assert(periodsToEmit.includes("6h"), "Should emit 6h (elapsed)");
  assert(!periodsToEmit.includes("1d"), "Should NOT emit 1d (not elapsed)");
  assert(periodsToEmit.includes("7d"), "Should emit 7d (never emitted)");
});

integrationTest("Delta Events Integration: Complex array handling", async () => {
  ensureTestDB();

  const relayUrl = "wss://test-relay-complex.example.com";

  // Initial state with retention
  const initialInfo = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1], time: 3600 }]
    ],
    fees: {
      subscription: [{ amount: 1000, unit: "msats", period: 2592000 }]
    }
  });
  storeDeltaState(relayUrl, { state: initialInfo });

  // Updated state with changed retention and fees
  const currentInfo = createMockRelayInfo({
    retention: [
      [{ kinds: [0, 1, 2], time: 7200 }] // Changed
    ],
    fees: {
      subscription: [{ amount: 2000, unit: "msats", period: 2592000 }] // Changed
    }
  });

  // Detect deltas
  const lastState = getLastDeltaState(relayUrl);
  const deltas = detectDeltas(lastState!.state, currentInfo);

  // Should detect retention and fees.subscription as atomic changes
  const retentionDelta = deltas.find(d => d.key === "retention");
  const feesDelta = deltas.find(d => d.key === "fees.subscription");

  assertExists(retentionDelta, "Should detect retention change");
  assertExists(feesDelta, "Should detect fees.subscription change");
  assertEquals(retentionDelta.type, "change", "Retention should be a change");
  assertEquals(feesDelta.type, "change", "Fees should be a change");

  // Values should be JSON strings
  assert(retentionDelta.value.includes("kinds"), "Retention value should be JSON");
  assert(feesDelta.value.includes("amount"), "Fees value should be JSON");
  assert(feesDelta.value.includes("2000"), "Fees value should have new amount");
});

console.log("Delta events integration tests completed");
