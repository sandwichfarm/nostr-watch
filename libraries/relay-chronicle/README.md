# relay-chronicle

> Chronicle relay history from [NIP-66](https://github.com/nostr-protocol/nips) delta events

A lightweight, framework-agnostic TypeScript library for reconstructing relay state and tracking changes over time. Like a time-traveling historian for Nostr relays.

**Works everywhere:** Browser, Node.js, Deno | **Framework agnostic:** React, Vue, Svelte, SolidJS, etc.

## Features

- ✅ **Zero dependencies** - Pure TypeScript
- ✅ **Framework agnostic** - Works with React, Vue, Svelte, SolidJS, etc.
- ✅ **Storage agnostic** - Bring your own storage backend (Nostr relays, database, API, etc.)
- ✅ **Platform agnostic** - Browser, Node.js, Deno
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Immutable** - Pure functions, no side effects
- ✅ **Time Series** - Generate data for charts and visualizations
- ✅ **Helper Functions** - Query specific data points (liveness, downtime, field changes)
- ✅ **Small** - ~5KB minified

## Installation

### npm (Node.js / Browser with bundler)
```bash
npm install @nostrwatch/relay-chronicle
```

### Deno
```typescript
import { composeState } from "https://deno.land/x/relay_chronicle/mod.ts";
```

### Browser (CDN)
```html
<script type="module">
  import { composeState, liveness } from 'https://cdn.jsdelivr.net/npm/@nostrwatch/relay-chronicle/dist/browser.js';

  // Your code here...
</script>
```

### Build Formats

The library provides multiple build formats for maximum compatibility:

- **ESM** (`dist/index.js`) - For modern bundlers (Vite, Webpack 5, Rollup) and Node.js
- **CommonJS** (`dist/index.cjs`) - For Node.js `require()` compatibility
- **Browser** (`dist/browser.js`) - Minified ESM bundle for direct browser use
- **TypeScript** (`dist/*.d.ts`) - Full TypeScript type definitions

All builds include source maps for debugging.

## Quick Start

```typescript
import { composeState, type EventStorage, type DeltaEvent } from '@nostrwatch/relay-chronicle';

// 1. Implement storage interface (example with nostr-tools)
const storage: EventStorage = {
  async query(options) {
    const filter = {
      kinds: [1066],
      "#r": [options.relay],
      since: options.since,
      until: options.until,
      limit: options.limit,
    };

    // Add operational status filter if requested
    if (options.statusOnly) {
      filter["#O"] = ["init", "down", "up"];
    }

    const events = await pool.querySync(relays, filter);
    return events.sort((a, b) => a.created_at - b.created_at);
  }
};

// 2. Compose relay state
const result = await composeState({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 86400, // Last 24 hours
});

console.log(result.state.online); // true/false
console.log(result.state.info.name); // "Example Relay"
console.log(result.state.dns.asn); // "13335"
console.log(result.state.geo.city); // "San Francisco"
```

## Core Concepts

### Delta Events (Kind 1066)

Kind 1066 events track **changes** in relay state over time:

```json
{
  "kind": 1066,
  "tags": [
    ["r", "wss://relay.example.com"],
    ["O", "up"],
    ["rtt-open", "123"],
    ["name", "New Relay Name"],
    ["dns.asn", "13335"],
    ["geo.city", "Berlin"]
  ]
}
```

### State Composition

The library reconstructs complete relay state by:
1. Fetching delta events in chronological order
2. Applying each delta (addition, removal, change) sequentially
3. Producing a final state snapshot

## API

### `composeState(options)`

Compose relay state from delta events.

**Parameters:**
- `storage: EventStorage` - Storage implementation for fetching events
- `relay: string` - Relay URL
- `since?: number` - Start timestamp (unix)
- `until?: number` - End timestamp (unix)
- `statusOnly?: boolean` - Only include state transition events (O tag)
- `periods?: string[]` - Filter by time periods (e.g., ["1d", "7d"])
- `snapshots?: boolean` - Return state snapshot for each event

**Returns:** `Promise<ComposedState | ComposedSnapshots>`

**Example:**
```typescript
const result = await composeState({
  storage: myStorage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 86400,
  snapshots: false, // Get final state
});

console.log(result.state);
console.log(result.eventCount);
console.log(result.timeRange);
```

### `calculateUptime(options)`

Calculate uptime statistics from state transition events.

**Returns:** `Promise<UptimeStats>`

**Example:**
```typescript
const stats = await calculateUptime({
  storage: myStorage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 2592000, // Last 30 days
});

console.log(stats.uptimePercent); // 99.5
console.log(stats.outageCount); // 2
console.log(stats.currentStatus); // "online"
```

### `getLatestState(storage, relay)`

Get the most recent state for a relay.

**Returns:** `Promise<RelayState | null>`

## Time Series API

Generate time series data from delta events for charting and visualization.

### `generateUptimeSeries(options)`

Generate uptime/downtime time series for availability charts.

**Returns:** `Promise<UptimePoint[]>`

**Example:**
```typescript
const series = await generateUptimeSeries({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 86400 * 7, // Last 7 days
});

// Use with Chart.js
new Chart(ctx, {
  type: 'line',
  data: {
    labels: series.map(p => p.date),
    datasets: [{
      label: 'Status',
      data: series.map(p => p.value === 'online' ? 1 : 0),
    }]
  }
});
```

### `generateRttSeries(options)`

Generate RTT (latency) time series for performance monitoring.

**Returns:** `Promise<TimeSeriesPoint<number>[]>`

**Example:**
```typescript
const series = await generateRttSeries({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 86400, // Last 24 hours
});

// Create latency chart
const data = series.map(p => ({
  x: new Date(p.timestamp * 1000),
  y: p.value
}));
```

### `generateChangeTimeline(options)`

Generate timeline of significant changes (software updates, infrastructure changes, etc.).

**Returns:** `Promise<ChangeEvent[]>`

**Example:**
```typescript
const timeline = await generateChangeTimeline({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 2592000, // Last 30 days
});

// Display timeline
timeline.forEach(event => {
  console.log(`${event.date}: ${event.description}`);
  // "First detection - Relay came online"
  // "Software updated to nostream 2.0.0"
  // "Location changed to Berlin, DE"
});
```

### `generateAggregatedSeries(options)`

Generate aggregated statistics in time buckets (hourly, daily, etc.).

**Parameters:**
- All `TimeSeriesOptions` parameters
- `bucketSize: number` - Bucket size in seconds (e.g., 3600 for hourly, 86400 for daily)

**Returns:** `Promise<AggregatedStats[]>`

**Example:**
```typescript
const series = await generateAggregatedSeries({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 2592000, // Last 30 days
  bucketSize: 86400, // Daily buckets
});

// Create overview chart
series.forEach(bucket => {
  console.log(`${bucket.date}: ${bucket.uptimePercent.toFixed(2)}% uptime`);
  console.log(`  Avg RTT: ${bucket.avgRtt}ms`);
  console.log(`  Events: ${bucket.eventCount}`);
});
```

### `generateFieldSeries(options, field)`

Track specific field value over time using dot notation.

**Parameters:**
- `options: TimeSeriesOptions`
- `field: string` - Field to track (e.g., "version", "dns.asn", "geo.city")

**Returns:** `Promise<TimeSeriesPoint<any>[]>`

**Example:**
```typescript
// Track software version changes
const versions = await generateFieldSeries(
  { storage, relay: 'wss://relay.example.com' },
  'version'
);

// Track infrastructure changes
const asn = await generateFieldSeries(
  { storage, relay: 'wss://relay.example.com' },
  'dns.asn'
);

// Track location changes
const city = await generateFieldSeries(
  { storage, relay: 'wss://relay.example.com' },
  'geo.city'
);
```

## Helper Functions

Convenience functions for querying specific relay data points.

### `whenInit(storage, relay)`

Find when a relay was first detected.

**Returns:** `Promise<InitInfo | null>`

**Example:**
```typescript
const init = await whenInit(storage, 'wss://relay.example.com');
console.log(`First seen: ${init.date}`);
```

### `liveness(storage, relay)`

Get current liveness status.

**Returns:** `Promise<LivenessInfo | null>`

**Example:**
```typescript
const status = await liveness(storage, 'wss://relay.example.com');
console.log(`Live: ${status.live}, detected at: ${status.detected_at}`);
console.log(`Last check: ${status.last_check}`);
```

### `lastDowntime(storage, relay)`

Get information about the last downtime period.

**Returns:** `Promise<DowntimeInfo | null>`

**Example:**
```typescript
const downtime = await lastDowntime(storage, 'wss://relay.example.com');

if (downtime?.down_now) {
  console.log(`Down since ${new Date(downtime.down_at * 1000)}`);
  console.log(`Retries: ${downtime.retries}`);
} else if (downtime) {
  console.log(`Last outage: ${downtime.length}ms`);
}
```

### `uptimeHistory(storage, relay, options?)`

Get full uptime/downtime history.

**Parameters:**
- `storage: EventStorage`
- `relay: string`
- `options?: { since?: number; until?: number }`

**Returns:** `Promise<Period[]>`

**Example:**
```typescript
const history = await uptimeHistory(storage, 'wss://relay.example.com', {
  since: Date.now() / 1000 - 86400 * 30 // Last 30 days
});

history.forEach(period => {
  const hours = period.duration ? period.duration / 1000 / 3600 : '?';
  console.log(`${period.type}: ${hours}h ${period.ongoing ? '(ongoing)' : ''}`);
});
```

### `lastChange(storage, relay, field)`

Find when a specific field last changed.

**Parameters:**
- `storage: EventStorage`
- `relay: string`
- `field: string` - Field name (supports dot notation: "version", "dns.asn", "geo.city")

**Returns:** `Promise<ChangeInfo | null>`

**Example:**
```typescript
const change = await lastChange(storage, 'wss://relay.example.com', 'version');
console.log(`Version: ${change.newValue}, updated: ${change.date}`);

// Track infrastructure
const asn = await lastChange(storage, 'wss://relay.example.com', 'dns.asn');
console.log(`ASN: ${asn.newValue}`);
```

### `changeHistory(storage, relay, field, options?)`

Get complete change history for a field.

**Parameters:**
- `storage: EventStorage`
- `relay: string`
- `field: string` - Field name (supports dot notation)
- `options?: { since?: number; until?: number }`

**Returns:** `Promise<ChangeInfo[]>`

**Example:**
```typescript
// Version history
const versions = await changeHistory(
  storage,
  'wss://relay.example.com',
  'version'
);

versions.forEach(change => {
  console.log(`${change.date}: ${change.oldValue} → ${change.newValue}`);
});

// Location migrations
const locations = await changeHistory(
  storage,
  'wss://relay.example.com',
  'geo.city',
  { since: Date.now() / 1000 - 2592000 } // Last 30 days
);
```

## Storage Interface

Implement the `EventStorage` interface to connect to your backend:

```typescript
interface EventStorage {
  query(options: QueryOptions): Promise<DeltaEvent[]>;
}
```

### Examples

#### Nostr Relays (nostr-tools)

```typescript
import { SimplePool } from 'nostr-tools/pool';

const pool = new SimplePool();
const relays = ['wss://relay.damus.io'];

const storage: EventStorage = {
  async query(options) {
    const filter: any = {
      kinds: [1066],
      "#r": [options.relay],
    };

    if (options.since) filter.since = options.since;
    if (options.until) filter.until = options.until;
    if (options.limit) filter.limit = options.limit;
    if (options.statusOnly) filter["#O"] = ["init", "down", "up"];
    if (options.periods) filter["#T"] = options.periods;

    const events = await pool.querySync(relays, filter);
    return events.sort((a, b) => a.created_at - b.created_at);
  }
};
```

#### REST API

```typescript
const storage: EventStorage = {
  async query(options) {
    const params = new URLSearchParams({
      relay: options.relay,
      ...(options.since && { since: options.since.toString() }),
      ...(options.until && { until: options.until.toString() }),
    });

    const response = await fetch(`/api/delta-events?${params}`);
    const events = await response.json();
    return events.sort((a, b) => a.created_at - b.created_at);
  }
};
```

#### SQLite Database (Deno)

```typescript
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const db = new DB("events.db");

const storage: EventStorage = {
  async query(options) {
    let sql = `
      SELECT * FROM delta_events
      WHERE relay_url = ?
    `;
    const params: any[] = [options.relay];

    if (options.since) {
      sql += ` AND created_at >= ?`;
      params.push(options.since);
    }

    if (options.until) {
      sql += ` AND created_at <= ?`;
      params.push(options.until);
    }

    sql += ` ORDER BY created_at ASC`;

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = db.query(sql, params);
    return rows.map(row => JSON.parse(row[1])); // Assuming event JSON in column 1
  }
};
```

## Framework Examples

### React

```typescript
import { useState, useEffect } from 'react';
import { composeState } from 'relay-state-composer';

function RelayStatus({ relay, storage }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    composeState({ storage, relay })
      .then(result => {
        setState(result.state);
        setLoading(false);
      });
  }, [relay]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>{state.info.name}</h2>
      <p>Status: {state.online ? '🟢 Online' : '🔴 Offline'}</p>
      <p>RTT: {state.rttOpen}ms</p>
      <p>Location: {state.geo.city}, {state.geo.country}</p>
    </div>
  );
}
```

### Svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import { composeState } from 'relay-state-composer';

  export let relay;
  export let storage;

  let state = null;
  let loading = true;

  onMount(async () => {
    const result = await composeState({ storage, relay });
    state = result.state;
    loading = false;
  });
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  <div>
    <h2>{state.info.name}</h2>
    <p>Status: {state.online ? '🟢 Online' : '🔴 Offline'}</p>
  </div>
{/if}
```

### SolidJS

```typescript
import { createResource } from 'solid-js';
import { composeState } from 'relay-state-composer';

function RelayStatus(props) {
  const [state] = createResource(
    () => ({ relay: props.relay, storage: props.storage }),
    async ({ relay, storage }) => {
      const result = await composeState({ storage, relay });
      return result.state;
    }
  );

  return (
    <div>
      <Show when={!state.loading} fallback={<p>Loading...</p>}>
        <h2>{state().info.name}</h2>
        <p>Status: {state().online ? '🟢 Online' : '🔴 Offline'}</p>
      </Show>
    </div>
  );
}
```

### Vue

```vue
<template>
  <div v-if="loading">Loading...</div>
  <div v-else>
    <h2>{{ state.info.name }}</h2>
    <p>Status: {{ state.online ? '🟢 Online' : '🔴 Offline' }}</p>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { composeState } from 'relay-state-composer';

export default {
  props: ['relay', 'storage'],
  setup(props) {
    const state = ref(null);
    const loading = ref(true);

    onMounted(async () => {
      const result = await composeState({
        storage: props.storage,
        relay: props.relay
      });
      state.value = result.state;
      loading.value = false;
    });

    return { state, loading };
  }
};
</script>
```

## Advanced Usage

### State Snapshots

Get a snapshot for each event (useful for timeline visualizations):

```typescript
const result = await composeState({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 86400,
  snapshots: true, // Get array of snapshots
});

// result.snapshots is an array of RelayState objects
for (const snapshot of result.snapshots) {
  console.log(snapshot.timestamp, snapshot.online);
}
```

### Uptime Monitoring

```typescript
const stats = await calculateUptime({
  storage,
  relay: 'wss://relay.example.com',
  since: Date.now() / 1000 - 2592000, // Last 30 days
});

console.log(`Uptime: ${stats.uptimePercent.toFixed(2)}%`);
console.log(`Outages: ${stats.outageCount}`);
console.log(`Avg outage: ${(stats.avgOutageDurationMs / 1000 / 60).toFixed(0)} minutes`);
```

### Filter by Periods

Only process events with specific time period tags:

```typescript
const result = await composeState({
  storage,
  relay: 'wss://relay.example.com',
  periods: ['1d', '7d'], // Only daily and weekly aggregates
});
```

## Types

```typescript
interface RelayState {
  url: string;
  operationalStatus?: 'init' | 'down' | 'up';
  online: boolean;
  rttOpen?: number;
  retryCount?: number;
  periods?: string[];
  info: Record<string, any>;     // NIP-11 data
  dns: Record<string, any>;      // DNS data (asn, address, etc.)
  geo: Record<string, any>;      // Geo data (city, country, geohash, etc.)
  timestamp: number;
  eventId: string;
}

interface UptimeStats {
  uptimeMs: number;
  downtimeMs: number;
  uptimePercent: number;
  outageCount: number;
  avgOutageDurationMs?: number;
  maxOutageDurationMs?: number;
  currentStatus: 'online' | 'offline' | 'unknown';
}
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Related

- [NIP-66](https://github.com/nostr-protocol/nips) - Relay Discovery and Liveness Monitoring
- [relaymon](https://github.com/nostr-watch/relaymon) - Reference implementation

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build all formats
npm run build

# Build specific format
node build.js

# Generate types only
npm run build:types

# Clean build artifacts
npm run clean
```

### Testing

```bash
# Run tests (Deno)
npm test

# Or directly with Deno
deno test --allow-read
```

### Bundle Sizes

- Browser bundle (minified): ~12KB
- ESM bundle: ~28KB
- CommonJS bundle: ~28KB

All bundles include comprehensive TypeScript type definitions and source maps.

## Examples

- [`examples/basic.ts`](examples/basic.ts) - Basic usage with state composition and uptime calculation
- [`examples/timeseries.ts`](examples/timeseries.ts) - Generating time series data for charts
- [`examples/helpers.ts`](examples/helpers.ts) - Using helper functions for specific queries
- [`examples/browser.html`](examples/browser.html) - Browser usage example

## License

MIT - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
