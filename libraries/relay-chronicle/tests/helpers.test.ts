/**
 * Tests for helper functions
 *
 * Run with: deno test --allow-read
 */

import { assertEquals, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  whenInit,
  liveness,
  lastDowntime,
  uptimeHistory,
  lastChange,
  changeHistory,
} from "../src/helpers.ts";
import type { EventStorage, DeltaEvent } from "../src/types.ts";

// Mock storage with predefined events
class MockStorage implements EventStorage {
  constructor(private events: DeltaEvent[]) {}

  async query(): Promise<DeltaEvent[]> {
    // Return events sorted by timestamp
    return [...this.events].sort((a, b) => a.created_at - b.created_at);
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

Deno.test("whenInit: Find initial detection", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["+name", "Test Relay"],
    ], "init-event"),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const init = await whenInit(storage, "wss://relay.example.com");

  assert(init !== null, "Should find init event");
  assertEquals(init.timestamp, 1000);
  assertEquals(init.eventId, "init-event");
});

Deno.test("whenInit: No init tag returns first event", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+name", "Test Relay"],
    ], "first-event"),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const init = await whenInit(storage, "wss://relay.example.com");

  assert(init !== null, "Should return first event");
  assertEquals(init.timestamp, 1000);
  assertEquals(init.eventId, "first-event");
});

Deno.test("whenInit: No events returns null", async () => {
  const storage = new MockStorage([]);

  const init = await whenInit(storage, "wss://relay.example.com");

  assertEquals(init, null);
});

Deno.test("liveness: Relay currently online", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const status = await liveness(storage, "wss://relay.example.com");

  assert(status !== null);
  assertEquals(status.live, true);
  assertEquals(status.detected_at, 1000);
  assertEquals(status.last_check, 2000);
  assertEquals(status.operationalStatus, undefined);
});

Deno.test("liveness: Relay currently offline", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "1"],
    ]),
  ];

  const storage = new MockStorage(events);

  const status = await liveness(storage, "wss://relay.example.com");

  assert(status !== null);
  assertEquals(status.live, false);
  assertEquals(status.detected_at, 2000);
  assertEquals(status.operationalStatus, "down");
});

Deno.test("liveness: Status change detection", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
    ]),
    createMockEvent(4000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const status = await liveness(storage, "wss://relay.example.com");

  assert(status !== null);
  assertEquals(status.live, true);
  assertEquals(status.detected_at, 3000); // When it came back up
  assertEquals(status.last_check, 4000);
});

Deno.test("lastDowntime: Current downtime", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "3"],
    ], "down-event"),
  ];

  const storage = new MockStorage(events);

  const downtime = await lastDowntime(storage, "wss://relay.example.com");

  assert(downtime !== null);
  assertEquals(downtime.down_at, 2000);
  assertEquals(downtime.down_now, true);
  assertEquals(downtime.retries, 3);
  assertEquals(downtime.up_at, undefined);
  assertEquals(downtime.length, undefined);
  assertEquals(downtime.eventId, "down-event");
});

Deno.test("lastDowntime: Recovered downtime", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "1"],
    ], "down-event"),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
    ], "up-event"),
  ];

  const storage = new MockStorage(events);

  const downtime = await lastDowntime(storage, "wss://relay.example.com");

  assert(downtime !== null);
  assertEquals(downtime.down_at, 2000);
  assertEquals(downtime.up_at, 3000);
  assertEquals(downtime.down_now, false);
  assertEquals(downtime.length, 1_000_000); // 1000 seconds in ms
  assertEquals(downtime.eventId, "down-event");
  assertEquals(downtime.upEventId, "up-event");
});

Deno.test("lastDowntime: No downtime returns null", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const downtime = await lastDowntime(storage, "wss://relay.example.com");

  assertEquals(downtime, null);
});

Deno.test("uptimeHistory: Multiple periods", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
    ]),
    createMockEvent(4000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
    ]),
  ];

  const storage = new MockStorage(events);

  const history = await uptimeHistory(storage, "wss://relay.example.com");

  assertEquals(history.length, 4);

  // First uptime period
  assertEquals(history[0].type, "uptime");
  assertEquals(history[0].start, 1000);
  assertEquals(history[0].end, 2000);
  assertEquals(history[0].duration, 1_000_000);
  assertEquals(history[0].ongoing, false);

  // First downtime period
  assertEquals(history[1].type, "downtime");
  assertEquals(history[1].start, 2000);
  assertEquals(history[1].end, 3000);
  assertEquals(history[1].duration, 1_000_000);
  assertEquals(history[1].ongoing, false);

  // Second uptime period
  assertEquals(history[2].type, "uptime");
  assertEquals(history[2].start, 3000);
  assertEquals(history[2].end, 4000);

  // Second downtime period (ongoing)
  assertEquals(history[3].type, "downtime");
  assertEquals(history[3].start, 4000);
  assertEquals(history[3].ongoing, true);
  assertEquals(history[3].end, undefined);
});

Deno.test("lastChange: Find most recent field change", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+version", "1.0.0"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["version", "1.1.0"],
    ], "latest-change"),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const change = await lastChange(storage, "wss://relay.example.com", "version");

  assert(change !== null);
  assertEquals(change.timestamp, 2000);
  assertEquals(change.newValue, "1.1.0");
  assertEquals(change.changeType, "change");
  assertEquals(change.eventId, "latest-change");
});

Deno.test("lastChange: Field never changed returns null", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+name", "Test Relay"],
    ]),
  ];

  const storage = new MockStorage(events);

  const change = await lastChange(storage, "wss://relay.example.com", "version");

  assertEquals(change, null);
});

Deno.test("lastChange: DNS field change", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+dns.asn", "13335"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["dns.asn", "15169"],
    ], "asn-change"),
  ];

  const storage = new MockStorage(events);

  const change = await lastChange(storage, "wss://relay.example.com", "dns.asn");

  assert(change !== null);
  assertEquals(change.newValue, 15169); // Parsed as number
  assertEquals(change.eventId, "asn-change");
});

Deno.test("changeHistory: Track all changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+version", "1.0.0"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["version", "1.1.0"],
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["version", "1.2.0"],
    ]),
  ];

  const storage = new MockStorage(events);

  const history = await changeHistory(
    storage,
    "wss://relay.example.com",
    "version"
  );

  assertEquals(history.length, 3);

  assertEquals(history[0].timestamp, 1000);
  assertEquals(history[0].newValue, "1.0.0");
  assertEquals(history[0].changeType, "add");
  assertEquals(history[0].oldValue, undefined);

  assertEquals(history[1].timestamp, 2000);
  assertEquals(history[1].newValue, "1.1.0");
  assertEquals(history[1].changeType, "change");
  assertEquals(history[1].oldValue, "1.0.0");

  assertEquals(history[2].timestamp, 3000);
  assertEquals(history[2].newValue, "1.2.0");
  assertEquals(history[2].changeType, "change");
  assertEquals(history[2].oldValue, "1.1.0");
});

Deno.test("changeHistory: Geo field changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+geo.city", "San Francisco"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["geo.city", "Los Angeles"],
    ]),
  ];

  const storage = new MockStorage(events);

  const history = await changeHistory(
    storage,
    "wss://relay.example.com",
    "geo.city"
  );

  assertEquals(history.length, 2);
  assertEquals(history[0].newValue, "San Francisco");
  assertEquals(history[1].newValue, "Los Angeles");
});

Deno.test("changeHistory: Empty history", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+name", "Test Relay"],
    ]),
  ];

  const storage = new MockStorage(events);

  const history = await changeHistory(
    storage,
    "wss://relay.example.com",
    "version"
  );

  assertEquals(history.length, 0);
});

console.log("✓ All helper tests passed");
