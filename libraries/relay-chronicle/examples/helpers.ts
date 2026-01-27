/**
 * Helper functions example for relay-chronicle
 *
 * Demonstrates querying specific relay data points.
 *
 * Run with: deno run --allow-net examples/helpers.ts
 */

import {
  whenInit,
  liveness,
  lastDowntime,
  uptimeHistory,
  lastChange,
  changeHistory,
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
      // Initial detection
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
          ["+dns.asn", "13335"],
          ["+geo.city", "San Francisco"],
          ["+geo.country", "US"],
        ],
        content: "",
        sig: "sig1",
      },

      // Day 5: Version update
      {
        id: "event2",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 5,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "150"],
          ["version", "1.0.0"],
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
          ["retry", "3"],
        ],
        content: "",
        sig: "sig3",
      },

      // Day 10 (4 hours later): Recovered
      {
        id: "event4",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 10 + 14400,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["O", "up"],
          ["rtt-open", "180"],
        ],
        content: "",
        sig: "sig4",
      },

      // Day 15: Infrastructure change
      {
        id: "event5",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 15,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "95"],
          ["dns.asn", "15169"], // Changed to Google Cloud
          ["geo.city", "Los Angeles"], // Moved datacenter
        ],
        content: "",
        sig: "sig5",
      },

      // Day 20: Another version update
      {
        id: "event6",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 20,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "100"],
          ["version", "1.1.0"],
        ],
        content: "",
        sig: "sig6",
      },

      // Day 25: Latest check
      {
        id: "event7",
        pubkey: "monitor-pubkey",
        created_at: baseTime + 86400 * 25,
        kind: 1066,
        tags: [
          ["r", options.relay],
          ["rtt-open", "90"],
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
        if (options.statusOnly) {
          // Only return events with O tag
          return e.tags.some((t) => t[0] === "O");
        }
        return true;
      })
      .sort((a, b) => a.created_at - b.created_at);
  }
}

// Main example
async function main() {
  const storage = new MockStorage();
  const relayUrl = "wss://relay.example.com";

  console.log("=== Helper Functions Examples ===\n");

  // 1. When was the relay first detected?
  console.log("🔍 1. When was relay first detected (whenInit)?");
  const init = await whenInit(storage, relayUrl);

  if (init) {
    const date = new Date(init.timestamp * 1000);
    console.log(`  First detected: ${date.toLocaleString()}`);
    console.log(`  Event ID: ${init.eventId}`);
  }

  // 2. What's the current liveness status?
  console.log("\n💓 2. Current liveness status (liveness)?");
  const status = await liveness(storage, relayUrl);

  if (status) {
    const statusIcon = status.live ? "🟢" : "🔴";
    const detectedDate = new Date(status.detected_at * 1000);
    const lastCheckDate = new Date((status.last_check || 0) * 1000);

    console.log(`  ${statusIcon} Status: ${status.live ? "Online" : "Offline"}`);
    console.log(`  Current state since: ${detectedDate.toLocaleString()}`);
    console.log(`  Last checked: ${lastCheckDate.toLocaleString()}`);
    if (status.operationalStatus) {
      console.log(`  Operational status: ${status.operationalStatus}`);
    }
  }

  // 3. What was the last downtime?
  console.log("\n⏱️  3. Last downtime period (lastDowntime)?");
  const downtime = await lastDowntime(storage, relayUrl);

  if (downtime) {
    const downDate = new Date(downtime.down_at * 1000);
    console.log(`  Went down: ${downDate.toLocaleString()}`);

    if (downtime.down_now) {
      console.log(`  Status: 🔴 Still down`);
      if (downtime.retries) {
        console.log(`  Retries: ${downtime.retries}`);
      }
    } else {
      const upDate = new Date((downtime.up_at || 0) * 1000);
      const hours = ((downtime.length || 0) / 1000 / 3600).toFixed(1);
      console.log(`  Came back up: ${upDate.toLocaleString()}`);
      console.log(`  Duration: ${hours} hours`);
    }
  } else {
    console.log("  No downtime recorded");
  }

  // 4. Full uptime/downtime history
  console.log("\n📊 4. Uptime/downtime history (uptimeHistory)?");
  const history = await uptimeHistory(storage, relayUrl);

  console.log(`  Total periods: ${history.length}`);
  history.forEach((period, i) => {
    const icon = period.type === "uptime" ? "🟢" : "🔴";
    const startDate = new Date(period.start * 1000);
    const status = period.ongoing ? "(ongoing)" : "";

    if (period.duration) {
      const hours = (period.duration / 1000 / 3600).toFixed(1);
      console.log(
        `  ${i + 1}. ${icon} ${period.type}: ${hours}h ${status}`
      );
    } else {
      console.log(
        `  ${i + 1}. ${icon} ${period.type}: started ${startDate.toLocaleDateString()} ${status}`
      );
    }
  });

  // 5. When did version last change?
  console.log("\n🔧 5. Last version change (lastChange)?");
  const versionChange = await lastChange(storage, relayUrl, "version");

  if (versionChange) {
    const date = new Date(versionChange.timestamp * 1000);
    console.log(`  Changed to: v${versionChange.newValue}`);
    console.log(`  When: ${date.toLocaleString()}`);
    console.log(`  Change type: ${versionChange.changeType}`);
  }

  // 6. Full version history
  console.log("\n📜 6. Complete version history (changeHistory)?");
  const versionHistory = await changeHistory(storage, relayUrl, "version");

  console.log(`  ${versionHistory.length} version updates:`);
  versionHistory.forEach((change) => {
    const date = new Date(change.timestamp * 1000);
    const arrow = change.oldValue ? `${change.oldValue} → ` : "";
    console.log(
      `    ${date.toLocaleDateString()}: ${arrow}${change.newValue}`
    );
  });

  // 7. Infrastructure changes (ASN)
  console.log("\n🌐 7. Infrastructure changes (changeHistory for dns.asn)?");
  const asnHistory = await changeHistory(storage, relayUrl, "dns.asn");

  console.log(`  ${asnHistory.length} ASN changes:`);
  asnHistory.forEach((change) => {
    const date = new Date(change.timestamp * 1000);
    const providers: Record<string, string> = {
      "13335": "Cloudflare",
      "15169": "Google Cloud",
    };
    const provider = providers[String(change.newValue)] || "Unknown";

    console.log(
      `    ${date.toLocaleDateString()}: ASN ${change.newValue} (${provider})`
    );
  });

  // 8. Location changes
  console.log("\n📍 8. Location changes (changeHistory for geo.city)?");
  const locationHistory = await changeHistory(storage, relayUrl, "geo.city");

  console.log(`  ${locationHistory.length} location changes:`);
  locationHistory.forEach((change) => {
    const date = new Date(change.timestamp * 1000);
    const arrow = change.oldValue ? `${change.oldValue} → ` : "";
    console.log(
      `    ${date.toLocaleDateString()}: ${arrow}${change.newValue}`
    );
  });

  // Summary
  console.log("\n\n📝 Summary:");
  console.log("  These helper functions make it easy to query specific");
  console.log("  data points without manually parsing all delta events.");
  console.log("\n  Use cases:");
  console.log("  - whenInit(): Display relay age");
  console.log("  - liveness(): Show current status badge");
  console.log("  - lastDowntime(): Alert on recent outages");
  console.log("  - uptimeHistory(): Calculate reliability metrics");
  console.log("  - lastChange(): Track when field was updated");
  console.log("  - changeHistory(): Audit trail for any field");
}

// Run example
main().catch(console.error);
