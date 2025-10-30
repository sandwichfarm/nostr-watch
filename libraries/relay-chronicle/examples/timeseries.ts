/**
 * Time Series example for relay-chronicle
 *
 * Demonstrates generating various time series data for charting and visualization.
 *
 * Run with: deno run --allow-net examples/timeseries.ts
 */

import {
  generateUptimeSeries,
  generateRttSeries,
  generateChangeTimeline,
  generateAggregatedSeries,
  generateFieldSeries,
  type EventStorage,
  type DeltaEvent,
  type QueryOptions,
} from "../mod.ts";

/**
 * Mock storage with realistic relay history
 */
class MockStorage implements EventStorage {
  async query(options: QueryOptions): Promise<DeltaEvent[]> {
    const now = Math.floor(Date.now() / 1000);
    const baseTime = now - 86400 * 30; // 30 days ago

    const mockEvents: DeltaEvent[] = [
      // Day 1: Initial detection
      {
        id: "event1",
        pubkey: "monitor-pubkey",
        created_at: baseTime,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["O", "init"],
          ["rtt-open", "145"],
          ["+name", "Example Relay"],
          ["+software", "strfry"],
          ["+version", "0.9.6"],
          ["+dns.address", "1.2.3.4"],
          ["+dns.asn", "13335"],
          ["+geo.city", "San Francisco"],
          ["+geo.country", "US"],
        ],
        content: "",
        sig: "sig1",
      },

      // Day 5: Minor software update
      {
        id: "event2",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 5,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "152"],
          ["version", "1.0.0"], // Version updated
        ],
        content: "",
        sig: "sig2",
      },

      // Day 10: Went offline
      {
        id: "event3",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 10,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["O", "down"],
          ["retry", "1"],
        ],
        content: "",
        sig: "sig3",
      },

      // Day 10 (2 hours later): Recovered
      {
        id: "event4",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 10 + 7200,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["O", "up"],
          ["rtt-open", "180"],
        ],
        content: "",
        sig: "sig4",
      },

      // Day 15: Infrastructure change (CDN migration)
      {
        id: "event5",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 15,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "95"], // Improved latency
          ["dns.address", "5.6.7.8"], // New IP
          ["dns.asn", "15169"], // New ASN (Google)
          ["geo.city", "Los Angeles"], // Different datacenter
        ],
        content: "",
        sig: "sig5",
      },

      // Day 20: Major version update
      {
        id: "event6",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 20,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "100"],
          ["version", "1.1.0"], // Version bump
          ["+supported_nips", "42"], // New NIP support
        ],
        content: "",
        sig: "sig6",
      },

      // Day 25: Performance improvement
      {
        id: "event7",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 25,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "75"], // Even better latency
          ["version", "1.2.0"], // Another update
        ],
        content: "",
        sig: "sig7",
      },
    ];

    // Filter and sort events
    return mockEvents
      .filter((e) => {
        if (options.since && e.created_at < options.since) return false;
        if (options.until && e.created_at > options.until) return false;
        return true;
      })
      .sort((a, b) => a.created_at - b.created_at);
  }
}

// Main example
async function main() {
  const storage = new MockStorage();
  const relayUrl = "wss://relay.example.com";

  console.log("=== Time Series Examples ===\n");

  // 1. Uptime Series
  console.log("📊 1. Uptime Series (for availability charts):");
  const uptimeSeries = await generateUptimeSeries({
    storage,
    relay: relayUrl,
  });

  console.log(`  Generated ${uptimeSeries.length} data points`);
  uptimeSeries.forEach((point, i) => {
    if (point.operationalStatus) {
      const status = point.value === "online" ? "🟢" : "🔴";
      console.log(
        `    ${status} ${new Date(point.timestamp * 1000).toLocaleDateString()}: ${point.operationalStatus} (RTT: ${point.rtt || "N/A"}ms)`
      );
    }
  });

  // 2. RTT Series
  console.log("\n📈 2. RTT Series (for performance charts):");
  const rttSeries = await generateRttSeries({
    storage,
    relay: relayUrl,
  });

  console.log(`  Generated ${rttSeries.length} RTT measurements`);
  const avgRtt =
    rttSeries.reduce((sum, p) => sum + p.value, 0) / rttSeries.length;
  const minRtt = Math.min(...rttSeries.map((p) => p.value));
  const maxRtt = Math.max(...rttSeries.map((p) => p.value));

  console.log(`    Average RTT: ${avgRtt.toFixed(1)}ms`);
  console.log(`    Min RTT: ${minRtt}ms`);
  console.log(`    Max RTT: ${maxRtt}ms`);

  // Show RTT trend
  console.log("\n    RTT Trend:");
  rttSeries.forEach((point) => {
    const date = new Date(point.timestamp * 1000).toLocaleDateString();
    const bar = "█".repeat(Math.floor(point.value / 10));
    console.log(`      ${date}: ${bar} ${point.value}ms`);
  });

  // 3. Change Timeline
  console.log("\n📅 3. Change Timeline (for event annotations):");
  const timeline = await generateChangeTimeline({
    storage,
    relay: relayUrl,
  });

  console.log(`  Generated ${timeline.length} significant events`);
  timeline.forEach((event) => {
    const date = new Date(event.timestamp * 1000).toLocaleDateString();
    const icon =
      event.type === "operational" ? "⚡" : event.type === "infrastructure"
        ? "🌐"
        : "🔧";
    console.log(`    ${icon} ${date}: ${event.description}`);
    if (event.fields.length > 0 && event.type !== "operational") {
      event.fields.forEach((field) => {
        console.log(`       - ${field.key}: ${field.newValue}`);
      });
    }
  });

  // 4. Aggregated Series
  console.log("\n📊 4. Aggregated Series (for overview charts):");
  const aggregated = await generateAggregatedSeries({
    storage,
    relay: relayUrl,
    bucketSize: 86400 * 7, // Weekly buckets
  });

  console.log(`  Generated ${aggregated.length} weekly buckets`);
  aggregated.forEach((bucket, i) => {
    const date = new Date(bucket.timestamp * 1000).toLocaleDateString();
    console.log(`\n    Week ${i + 1} (${date}):`);
    console.log(`      Uptime: ${bucket.uptimePercent.toFixed(1)}%`);
    console.log(
      `      Avg RTT: ${bucket.avgRtt ? bucket.avgRtt.toFixed(1) : "N/A"}ms`
    );
    console.log(
      `      Min RTT: ${bucket.minRtt ? bucket.minRtt : "N/A"}ms`
    );
    console.log(
      `      Max RTT: ${bucket.maxRtt ? bucket.maxRtt : "N/A"}ms`
    );
    console.log(`      State changes: ${bucket.transitionCount}`);
    console.log(`      Field changes: ${bucket.changeCount}`);
    console.log(`      Total events: ${bucket.eventCount}`);
  });

  // 5. Field Tracking
  console.log("\n🔍 5. Field Tracking (version history):");
  const versionSeries = await generateFieldSeries(
    {
      storage,
      relay: relayUrl,
    },
    "version"
  );

  console.log(`  Version history (${versionSeries.length} updates):`);
  versionSeries.forEach((point) => {
    const date = new Date(point.timestamp * 1000).toLocaleDateString();
    console.log(`    ${date}: v${point.value}`);
  });

  // Track location changes
  console.log("\n🌍 6. Field Tracking (location history):");
  const citySeries = await generateFieldSeries(
    {
      storage,
      relay: relayUrl,
    },
    "geo.city"
  );

  console.log(`  Location history (${citySeries.length} changes):`);
  citySeries.forEach((point) => {
    const date = new Date(point.timestamp * 1000).toLocaleDateString();
    console.log(`    ${date}: ${point.value}`);
  });

  // Example: Using with Chart.js (pseudo-code)
  console.log("\n\n💡 Usage with Chart.js:");
  console.log(`
// Uptime Chart
const uptimeChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: uptimeSeries.map(p => p.date),
    datasets: [{
      label: 'Uptime',
      data: uptimeSeries.map(p => p.value === 'online' ? 1 : 0),
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderColor: 'rgba(75, 192, 192, 1)',
    }]
  },
  options: {
    scales: {
      y: {
        ticks: {
          callback: (value) => value === 1 ? 'Online' : 'Offline'
        }
      }
    }
  }
});

// RTT Chart
const rttChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: rttSeries.map(p => p.date),
    datasets: [{
      label: 'RTT (ms)',
      data: rttSeries.map(p => p.value),
      borderColor: 'rgba(255, 99, 132, 1)',
    }]
  }
});

// Aggregated Chart
const aggregatedChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: aggregated.map(p => p.date.split('T')[0]),
    datasets: [
      {
        label: 'Uptime %',
        data: aggregated.map(p => p.uptimePercent),
        yAxisID: 'y',
      },
      {
        label: 'Avg RTT (ms)',
        data: aggregated.map(p => p.avgRtt),
        yAxisID: 'y1',
      }
    ]
  },
  options: {
    scales: {
      y: { type: 'linear', position: 'left' },
      y1: { type: 'linear', position: 'right' }
    }
  }
});
  `.trim());
}

// Run example
main().catch(console.error);
