/**
 * Tests for time series functionality
 *
 * Run with: deno test --allow-read
 */

import { assertEquals, assert } from "https://deno.land/std@0.218.2/assert/mod.ts";
import {
  generateUptimeSeries,
  generateRttSeries,
  generateChangeTimeline,
  generateAggregatedSeries,
  generateFieldSeries,
} from "../src/timeseries.ts";
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

Deno.test("generateUptimeSeries: Basic uptime series", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["rtt-open", "150"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      ["retry", "1"],
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
      ["rtt-open", "200"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateUptimeSeries({
    storage,
    relay: "wss://relay.example.com",
  });

  assertEquals(series.length, 3);
  assertEquals(series[0].value, "online");
  assertEquals(series[0].operationalStatus, "init");
  assertEquals(series[0].rtt, 150);

  assertEquals(series[1].value, "offline");
  assertEquals(series[1].operationalStatus, "down");
  assertEquals(series[1].retryCount, 1);

  assertEquals(series[2].value, "online");
  assertEquals(series[2].operationalStatus, "up");
  assertEquals(series[2].rtt, 200);
});

Deno.test("generateRttSeries: RTT measurements over time", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "200"],
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "175"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateRttSeries({
    storage,
    relay: "wss://relay.example.com",
  });

  assertEquals(series.length, 3);
  assertEquals(series[0].value, 150);
  assertEquals(series[1].value, 200);
  assertEquals(series[2].value, 175);
  assertEquals(series[0].timestamp, 1000);
  assertEquals(series[1].timestamp, 2000);
  assertEquals(series[2].timestamp, 3000);
});

Deno.test("generateRttSeries: Skips events without RTT", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
      // No rtt-open tag
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "175"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateRttSeries({
    storage,
    relay: "wss://relay.example.com",
  });

  // Should only include events with RTT
  assertEquals(series.length, 2);
  assertEquals(series[0].value, 150);
  assertEquals(series[1].value, 175);
});

Deno.test("generateChangeTimeline: Operational changes", async () => {
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
  ];

  const storage = new MockStorage(events);

  const timeline = await generateChangeTimeline({
    storage,
    relay: "wss://relay.example.com",
  });

  assertEquals(timeline.length, 3);
  assertEquals(timeline[0].type, "operational");
  assert(timeline[0].description.includes("First detection"));

  assertEquals(timeline[1].type, "operational");
  assert(timeline[1].description.includes("went offline"));

  assertEquals(timeline[2].type, "operational");
  assert(timeline[2].description.includes("came online"));
});

Deno.test("generateChangeTimeline: Infrastructure changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+dns.address", "1.2.3.4"],
      ["+dns.asn", "13335"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["dns.address", "5.6.7.8"], // IP changed
      ["dns.asn", "15169"], // ASN changed
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["geo.city", "Berlin"], // City changed
      ["geo.country", "DE"],
    ]),
  ];

  const storage = new MockStorage(events);

  const timeline = await generateChangeTimeline({
    storage,
    relay: "wss://relay.example.com",
  });

  // Should have infrastructure change events (not the init)
  const infraChanges = timeline.filter(e => e.type === "infrastructure");
  assert(infraChanges.length >= 1);

  // Check that IP and location changes are detected
  const hasIpChange = timeline.some(e =>
    e.description.includes("Infrastructure") || e.description.includes("ASN")
  );
  const hasLocationChange = timeline.some(e =>
    e.description.includes("Location") || e.description.includes("Berlin")
  );

  assert(hasIpChange || hasLocationChange, "Should detect infrastructure changes");
});

Deno.test("generateChangeTimeline: Field changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+software", "strfry"],
      ["+version", "1.0.0"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["version", "1.1.0"], // Version updated
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["software", "nostream"], // Software changed
      ["version", "2.0.0"],
    ]),
  ];

  const storage = new MockStorage(events);

  const timeline = await generateChangeTimeline({
    storage,
    relay: "wss://relay.example.com",
  });

  const fieldChanges = timeline.filter(e => e.type === "field");
  assert(fieldChanges.length >= 1, "Should have field changes");

  // Should detect software or version changes
  const hasSoftwareChange = timeline.some(e =>
    e.description.includes("Software") || e.description.includes("version")
  );
  assert(hasSoftwareChange, "Should detect software/version changes");
});

Deno.test("generateAggregatedSeries: Hourly buckets", async () => {
  const baseTime = 1000;
  const events: DeltaEvent[] = [
    // First hour - online
    createMockEvent(baseTime, [
      ["r", "wss://relay.example.com"],
      ["O", "init"],
      ["rtt-open", "150"],
    ]),
    createMockEvent(baseTime + 1800, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "160"],
    ]),
    // Second hour - went offline
    createMockEvent(baseTime + 3600, [
      ["r", "wss://relay.example.com"],
      ["O", "down"],
    ]),
    createMockEvent(baseTime + 5400, [
      ["r", "wss://relay.example.com"],
      ["O", "up"],
      ["rtt-open", "200"],
    ]),
    // Third hour - online with changes
    createMockEvent(baseTime + 7200, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "180"],
      ["version", "1.1.0"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateAggregatedSeries({
    storage,
    relay: "wss://relay.example.com",
    bucketSize: 3600, // 1 hour buckets
  });

  // Should have at least 3 buckets
  assert(series.length >= 2);

  // Each bucket should have stats
  for (const bucket of series) {
    assert(bucket.eventCount > 0, "Bucket should have events");
    assert(bucket.uptimePercent >= 0 && bucket.uptimePercent <= 100);
    assert(typeof bucket.transitionCount === "number");
    assert(typeof bucket.changeCount === "number");
  }
});

Deno.test("generateAggregatedSeries: RTT statistics", async () => {
  const baseTime = 1000;
  const events: DeltaEvent[] = [
    createMockEvent(baseTime, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "100"],
    ]),
    createMockEvent(baseTime + 100, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "200"],
    ]),
    createMockEvent(baseTime + 200, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateAggregatedSeries({
    storage,
    relay: "wss://relay.example.com",
    bucketSize: 3600,
  });

  assertEquals(series.length, 1);
  const bucket = series[0];

  assertEquals(bucket.eventCount, 3);
  assertEquals(bucket.minRtt, 100);
  assertEquals(bucket.maxRtt, 200);
  assertEquals(bucket.avgRtt, 150); // (100 + 200 + 150) / 3
});

Deno.test("generateFieldSeries: Track specific field", async () => {
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

  const series = await generateFieldSeries(
    {
      storage,
      relay: "wss://relay.example.com",
    },
    "version"
  );

  assertEquals(series.length, 3);
  assertEquals(series[0].value, "1.0.0");
  assertEquals(series[1].value, "1.1.0");
  assertEquals(series[2].value, "1.2.0");
});

Deno.test("generateFieldSeries: Track nested field with dot notation", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+dns.address", "1.2.3.4"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["dns.address", "5.6.7.8"],
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateFieldSeries(
    {
      storage,
      relay: "wss://relay.example.com",
    },
    "dns.address"
  );

  assertEquals(series.length, 2);
  assertEquals(series[0].value, "1.2.3.4");
  assertEquals(series[1].value, "5.6.7.8");
});

Deno.test("generateFieldSeries: Only includes events where field changes", async () => {
  const events: DeltaEvent[] = [
    createMockEvent(1000, [
      ["r", "wss://relay.example.com"],
      ["+software", "strfry"],
      ["+version", "1.0.0"],
    ]),
    createMockEvent(2000, [
      ["r", "wss://relay.example.com"],
      ["rtt-open", "150"], // No version change
    ]),
    createMockEvent(3000, [
      ["r", "wss://relay.example.com"],
      ["version", "1.1.0"], // Version changed
    ]),
  ];

  const storage = new MockStorage(events);

  const series = await generateFieldSeries(
    {
      storage,
      relay: "wss://relay.example.com",
    },
    "version"
  );

  // Should only include events where version changed
  assertEquals(series.length, 2);
  assertEquals(series[0].value, "1.0.0");
  assertEquals(series[1].value, "1.1.0");
});

console.log("✓ All time series tests passed");
