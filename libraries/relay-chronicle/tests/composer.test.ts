/**
 * Tests for relay-state-composer
 *
 * Run with: deno test --allow-read
 */

import { assertEquals, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import { composeState, calculateUptime } from "../src/index.ts";
import type { EventStorage, DeltaEvent } from "../src/types.ts";

// Mock storage with predefined events
class MockStorage implements EventStorage {
  constructor(private events: DeltaEvent[]) {}

  async query(options: any = {}): Promise<DeltaEvent[]> {
    let results = [...this.events];

    if (options.relay) {
      results = results.filter((e) =>
        e.tags.some((t) => t[0] === "r" && t[1] === options.relay)
      );
    }

    if (options.statusOnly) {
      results = results.filter((e) => e.tags.some((t) => t[0] === "O" && t[1]));
    }

    if (options.periods && Array.isArray(options.periods) && options.periods.length > 0) {
      const set = new Set<string>(options.periods);
      results = results.filter((e) => e.tags.some((t) => t[0] === "T" && set.has(t[1])));
    }

    if (options.since !== undefined) {
      results = results.filter((e) => e.created_at >= options.since);
    }

    if (options.until !== undefined) {
      results = results.filter((e) => e.created_at <= options.until);
    }

    // Mimic typical relay behavior: limits apply to most-recent events.
    if (options.limit !== undefined) {
      results = results
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, options.limit);
    }

    return results.sort((a, b) => a.created_at - b.created_at);
  }
}

// Helper to create mock delta events
function createMockEvent(
  timestamp: number,
  tags: string[][],
  id?: string
): DeltaEvent {
  return {
    id: id || `mock-${timestamp}`,
    pubkey: "test-pubkey",
    created_at: timestamp,
    kind: 1066,
    tags,
    content: "",
    sig: "test-sig",
  };
}

Deno.test("composeState: Initial relay detection", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["rtt-open", "150"],
      ["+name", "Test Relay"],
      ["+supported_nips", "1"],
      ["+dns.address", "1.2.3.4"],
      ["+geo.city", "Berlin"],
    ]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
  });

  assert("state" in result, "Should return ComposedState");
  assertEquals(result.state.operationalStatus, "init");
  assertEquals(result.state.online, true);
  assertEquals(result.state.rttOpen, 150);
  assertEquals(result.state.info.name, "Test Relay");
  assertEquals(result.state.info.supported_nips, 1); // Parsed as number
  assertEquals(result.state.dns.address, "1.2.3.4");
  assertEquals(result.state.geo.city, "Berlin");
});

Deno.test("composeState: Relay goes offline", async () => {
  const events: DeltaEvent[] = [
    // First detection - online
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["rtt-open", "150"],
      ["+name", "Test Relay"],
    ]),
    // Goes offline
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "1"],
    ]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
  });

  assert("state" in result, "Should return ComposedState");
  assertEquals(result.state.operationalStatus, "down");
  assertEquals(result.state.online, false);
  assertEquals(result.state.retryCount, 1);
  assertEquals(result.eventCount, 2);
});

Deno.test("composeState: Relay recovers", async () => {
  const events: DeltaEvent[] = [
    // Init
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["rtt-open", "150"],
      ["+name", "Test Relay"],
    ]),
    // Goes offline
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "1"],
    ]),
    // Recovers
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
      ["rtt-open", "200"],
      ["name", "Updated Name"], // Name changed
    ]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
  });

  assert("state" in result, "Should return ComposedState");
  assertEquals(result.state.operationalStatus, "up");
  assertEquals(result.state.online, true);
  assertEquals(result.state.rttOpen, 200);
  assertEquals(result.state.info.name, "Updated Name");
});

Deno.test("composeState: Field additions, changes, and removals", async () => {
  const events: DeltaEvent[] = [
    // Initial state
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
      ["+name", "Test Relay"],
      ["+software", "strfry"],
      ["+version", "1.0.0"],
    ]),
    // Field change and addition
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "160"],
      ["version", "1.1.0"], // Changed
      ["+description", "A test relay"], // Added
    ]),
    // Field removal
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "155"],
      ["-software", "strfry"], // Removed
    ]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
  });

  assert("state" in result, "Should return ComposedState");
  assertEquals(result.state.info.name, "Test Relay");
  assertEquals(result.state.info.version, "1.1.0"); // Updated
  assertEquals(result.state.info.description, "A test relay"); // Added
  assertEquals(result.state.info.software, undefined); // Removed
});

Deno.test("composeState: DNS and geo changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
      ["+dns.address", "1.2.3.4"],
      ["+dns.asn", "15169"],
      ["+geo.city", "New York"],
      ["+geo.country", "US"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "160"],
      ["dns.address", "5.6.7.8"], // IP changed
      ["dns.asn", "13335"], // ASN changed
      ["geo.city", "San Francisco"], // City changed
      ["+geo.geohash", "9q8yy"], // Geohash added
    ]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
  });

  assert("state" in result, "Should return ComposedState");
  assertEquals(result.state.dns.address, "5.6.7.8");
  assertEquals(result.state.dns.asn, 13335); // Parsed as number
  assertEquals(result.state.geo.city, "San Francisco");
  assertEquals(result.state.geo.country, "US");
  assertEquals(result.state.geo.geohash, "9q8yy");
});

Deno.test("composeState: Snapshots mode", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [["r", "wss://relay.example.com"], ["+name", "Relay 1"]]),
    createMockEvent(2000, [["r", "wss://relay.example.com"], ["name", "Relay 2"]]),
    createMockEvent(3000, [["r", "wss://relay.example.com"], ["name", "Relay 3"]]),
  ];

  const storage = new MockStorage(events);

  const result = await composeState({
    storage,
    relay: "wss://relay.example.com",
    snapshots: true,
  });

  assert("snapshots" in result, "Should return ComposedSnapshots");
  assertEquals(result.snapshots.length, 3);
  assertEquals(result.snapshots[0].info.name, "Relay 1");
  assertEquals(result.snapshots[1].info.name, "Relay 2");
  assertEquals(result.snapshots[2].info.name, "Relay 3");
});

Deno.test("calculateUptime: Basic uptime calculation", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [["r", "wss://relay.example.com"], ["O", "init"]]),
    createMockEvent(2000, [["r", "wss://relay.example.com"], ["O", "down"]]),
    createMockEvent(3000, [["r", "wss://relay.example.com"], ["O", "up"]]),
  ];

  const storage = new MockStorage(events);

  const stats = await calculateUptime({
    storage,
    relay: "wss://relay.example.com",
    until: 4000,
  });

  // Online: 1000-2000 (1000s) + 3000-4000 (1000s) = 2000s = 2,000,000ms
  // Offline: 2000-3000 (1000s) = 1,000,000ms
  // Total: 3000s
  // Uptime: 2000/3000 = 66.67%

  assertEquals(stats.uptimeMs, 2_000_000);
  assertEquals(stats.downtimeMs, 1_000_000);
  assertEquals(Math.round(stats.uptimePercent * 100) / 100, 66.67);
  assertEquals(stats.outageCount, 1);
  assertEquals(stats.currentStatus, "online");
});

Deno.test("calculateUptime: Multiple outages", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [["r", "wss://relay.example.com"], ["O", "init"]]),
    createMockEvent(2000, [["r", "wss://relay.example.com"], ["O", "down"]]),
    createMockEvent(3000, [["r", "wss://relay.example.com"], ["O", "up"]]),
    createMockEvent(4000, [["r", "wss://relay.example.com"], ["O", "down"]]),
    createMockEvent(5000, [["r", "wss://relay.example.com"], ["O", "up"]]),
  ];

  const storage = new MockStorage(events);

  const stats = await calculateUptime({
    storage,
    relay: "wss://relay.example.com",
    until: 6000,
  });

  assertEquals(stats.outageCount, 2);
  assertEquals(stats.avgOutageDurationMs, 1_000_000); // Average of 1000s each
  assertEquals(stats.maxOutageDurationMs, 1_000_000);
});

console.log("✓ All tests passed");
