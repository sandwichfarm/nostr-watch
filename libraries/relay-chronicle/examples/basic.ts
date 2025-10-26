/**
 * Basic example of relay-chronicle
 *
 * Run with: deno run --allow-net examples/basic.ts
 */

import {
  composeState,
  calculateUptime,
  type EventStorage,
  type DeltaEvent,
  type QueryOptions,
} from "../mod.ts";

/**
 * Example: Mock storage for demonstration
 *
 * In a real app, this would fetch from Nostr relays, a database, or an API
 */
class MockStorage implements EventStorage {
  async query(options: QueryOptions): Promise<DeltaEvent[]> {
    // Simulate fetching events from storage
    // In production, this would query Nostr relays, database, etc.

    const mockEvents: DeltaEvent[] = [
      // Initial detection
      {
        id: "event1",
        pubkey: "monitor-pubkey",
        created_at: Math.floor(Date.now() / 1000) - 86400,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["O", "init"],
          ["rtt-open", "145"],
          ["+name", "Example Relay"],
          ["+description", "A Nostr relay for testing"],
          ["+software", "strfry"],
          ["+version", "1.0.0"],
          ["+dns.address", "1.2.3.4"],
          ["+dns.asn", "13335"],
          ["+geo.city", "San Francisco"],
          ["+geo.country", "US"],
          ["+geo.geohash", "9q8yy"],
        ],
        content: "",
        sig: "signature1",
      },
      // Software update
      {
        id: "event2",
        pubkey: "monitor-pubkey",
        created_at: Math.floor(Date.now() / 1000) - 43200,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "138"],
          ["version", "1.1.0"], // Version changed
          ["+supported_nips", "50"], // Added NIP support
        ],
        content: "",
        sig: "signature2",
      },
      // Infrastructure change
      {
        id: "event3",
        pubkey: "monitor-pubkey",
        created_at: Math.floor(Date.now() / 1000) - 21600,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "152"],
          ["dns.address", "5.6.7.8"], // IP changed
          ["geo.city", "Berlin"], // Moved to different datacenter
          ["geo.country", "DE"],
          ["+geo.isp", "Cloudflare"],
        ],
        content: "",
        sig: "signature3",
      },
    ];

    // Return filtered and sorted events
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

  console.log("=== Relay Chronicle Example ===\n");

  // 1. Get current state
  console.log("📊 Current State:");
  const result = await composeState({
    storage,
    relay: relayUrl,
  });

  if ("state" in result) {
    const { state } = result;
    console.log(`  Relay: ${state.url}`);
    console.log(`  Status: ${state.online ? "🟢 Online" : "🔴 Offline"}`);
    console.log(`  RTT: ${state.rttOpen}ms`);
    console.log(`  Events processed: ${result.eventCount}`);
    console.log(`\n  NIP-11 Info:`);
    console.log(`    Name: ${state.info.name}`);
    console.log(`    Software: ${state.info.software} v${state.info.version}`);
    console.log(`    Description: ${state.info.description}`);
    console.log(`\n  Infrastructure:`);
    console.log(`    IP: ${state.dns.address}`);
    console.log(`    ASN: ${state.dns.asn}`);
    console.log(`    Location: ${state.geo.city}, ${state.geo.country}`);
    console.log(`    ISP: ${state.geo.isp}`);
    console.log(`    Geohash: ${state.geo.geohash}`);
  }

  // 2. Get state snapshots (timeline)
  console.log("\n\n📈 State Timeline:");
  const snapshots = await composeState({
    storage,
    relay: relayUrl,
    snapshots: true,
  });

  if ("snapshots" in snapshots) {
    for (const snap of snapshots.snapshots) {
      const date = new Date(snap.timestamp * 1000);
      console.log(
        `\n  ${date.toISOString()} - ${snap.info.software} v${snap.info.version} @ ${snap.geo.city}`
      );
    }
  }

  // 3. Calculate uptime
  console.log("\n\n⏱️  Uptime Statistics:");
  const stats = await calculateUptime({
    storage,
    relay: relayUrl,
    since: Math.floor(Date.now() / 1000) - 86400 * 30, // Last 30 days
  });

  console.log(`  Uptime: ${stats.uptimePercent.toFixed(2)}%`);
  console.log(`  Total uptime: ${(stats.uptimeMs / 1000 / 3600).toFixed(1)}h`);
  console.log(`  Total downtime: ${(stats.downtimeMs / 1000 / 3600).toFixed(1)}h`);
  console.log(`  Outages: ${stats.outageCount}`);
  console.log(`  Current status: ${stats.currentStatus}`);
}

// Run example
main().catch(console.error);
