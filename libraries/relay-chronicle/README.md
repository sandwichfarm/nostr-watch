# @nostrwatch/relay-chronicle

Historical relay event management from NIP-66 delta events.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/relay-chronicle?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/relay-chronicle)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/relay-chronicle` stores, aggregates, and queries relay (a WebSocket server that stores and forwards Nostr events) monitoring history. It reconstructs relay state by replaying [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) kind 1066 delta events (signed JSON objects that record relay state changes) in chronological order. Each delta captures a transition — a relay coming online, going offline, changing its software version, or shifting its network location. The library is storage-agnostic: callers implement the `EventStorage` interface against any backend (Nostr relays, REST API, SQLite, browser IndexedDB). All functions are pure and stateless. No dependencies.

## Prerequisites

Node.js >=18 and pnpm >=9. Node.js is required only for server-side use — the browser build has no Node.js requirements.

## Installation

```sh
pnpm add @nostrwatch/relay-chronicle
```

Or with npm:

```sh
npm install @nostrwatch/relay-chronicle
```

## Quick Start

```ts
import {composeState, type EventStorage} from '@nostrwatch/relay-chronicle'
import {SimplePool} from 'nostr-tools/pool'

const pool = new SimplePool()

const storage: EventStorage = {
  async query(options) {
    const events = await pool.querySync(
      ['wss://relay.damus.io'],
      {kinds: [1066], '#r': [options.relay], since: options.since}
    )
    return events.sort((a, b) => a.created_at - b.created_at)
  }
}

const result = await composeState({
  storage,
  relay: 'wss://nos.lol',
  since: Date.now() / 1000 - 86400  // last 24 hours
})

console.log(result.state.online)       // true
console.log(result.state.info.name)    // relay's NIP-11 name
console.log(result.state.geo.city)     // relay's city
```

## API

### `composeState(options)`

```ts
async function composeState(options: ComposeOptions): Promise<ComposedState | ComposedSnapshots>
```

Reconstructs complete relay state by applying delta events sequentially. Returns the final state snapshot, or an array of per-event snapshots when `snapshots: true`.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `storage` | `EventStorage` | — | Storage implementation for querying kind 1066 events |
| `relay` | `string` | — | Relay WebSocket URL |
| `since` | `number` | — | Start Unix timestamp |
| `until` | `number` | — | End Unix timestamp |
| `statusOnly` | `boolean` | `false` | Include only state-transition events (O tag) |
| `snapshots` | `boolean` | `false` | Return per-event state snapshots instead of final state |

### `calculateUptime(options)`

```ts
async function calculateUptime(options: TimeSeriesOptions): Promise<UptimeStats>
```

Calculates uptime statistics over the given time range.

```ts
const stats = await calculateUptime({
  storage,
  relay: 'wss://nos.lol',
  since: Date.now() / 1000 - 2592000  // last 30 days
})

console.log(stats.uptimePercent)   // 99.5
console.log(stats.outageCount)     // 2
console.log(stats.currentStatus)   // 'online'
```

### `getLatestState(storage, relay)`

```ts
async function getLatestState(storage: EventStorage, relay: string): Promise<RelayState | null>
```

Returns the most recent state snapshot for a relay, or `null` if no events are found.

### `liveness(storage, relay)`

```ts
async function liveness(storage: EventStorage, relay: string): Promise<LivenessInfo | null>
```

Returns current liveness status: whether the relay is live, when it was first detected, and when it was last checked.

### `lastDowntime(storage, relay)`

```ts
async function lastDowntime(storage: EventStorage, relay: string): Promise<DowntimeInfo | null>
```

Returns information about the most recent downtime period. `down_now: true` indicates the relay is currently offline.

### `uptimeHistory(storage, relay, options?)`

```ts
async function uptimeHistory(
  storage: EventStorage,
  relay: string,
  options?: {since?: number; until?: number}
): Promise<Period[]>
```

Returns the full sequence of uptime and downtime periods over the requested time range. Each `Period` has `type` (`'up'` or `'down'`), `duration` in milliseconds, and `ongoing` flag.

### `whenInit(storage, relay)`

```ts
async function whenInit(storage: EventStorage, relay: string): Promise<InitInfo | null>
```

Returns the timestamp and event ID of the first time the relay was detected.

### `lastChange(storage, relay, field)`

```ts
async function lastChange(
  storage: EventStorage,
  relay: string,
  field: string
): Promise<ChangeInfo | null>
```

Returns when a specific relay field last changed. Field names support dot notation: `'version'`, `'dns.asn'`, `'geo.city'`.

### `changeHistory(storage, relay, field, options?)`

```ts
async function changeHistory(
  storage: EventStorage,
  relay: string,
  field: string,
  options?: {since?: number; until?: number}
): Promise<ChangeInfo[]>
```

Returns the complete change history for a field. Each entry contains `oldValue`, `newValue`, `timestamp`, and `date`.

### Time series functions

Generate time series data for use with `@nostrwatch/relay-charts` or custom visualizations:

| Function | Returns | Description |
|----------|---------|-------------|
| `generateUptimeSeries(options)` | `Promise<UptimePoint[]>` | Uptime/downtime series for availability charts |
| `generateRttSeries(options)` | `Promise<TimeSeriesPoint<number>[]>` | RTT latency series |
| `generateChangeTimeline(options)` | `Promise<ChangeEvent[]>` | Significant relay changes (software, infrastructure) |
| `generateAggregatedSeries(options)` | `Promise<AggregatedStats[]>` | Bucketed statistics (hourly, daily) |
| `generateFieldSeries(options, field)` | `Promise<TimeSeriesPoint<any>[]>` | Track any field value over time |

```ts
const series = await generateRttSeries({
  storage,
  relay: 'wss://nos.lol',
  since: Date.now() / 1000 - 86400
})
// [{timestamp: 1699000000, value: 145}, ...]
```

### `EventStorage` interface

Implement this interface to connect any storage backend:

```ts
interface EventStorage {
  query(options: QueryOptions): Promise<DeltaEvent[]>
}

interface QueryOptions {
  relay: string
  since?: number
  until?: number
  limit?: number
  statusOnly?: boolean
  periods?: string[]
}
```

Results must be sorted by `created_at` ascending. The library replays events in the order returned.

### Core types

```ts
interface RelayState {
  url: string
  operationalStatus?: 'init' | 'down' | 'up'
  online: boolean
  rttOpen?: number
  retryCount?: number
  info: Record<string, any>    // NIP-11 relay document fields
  dns: Record<string, any>     // DNS data: asn, address, etc.
  geo: Record<string, any>     // Geo data: city, country, geohash, etc.
  timestamp: number
  eventId: string
}

interface UptimeStats {
  uptimeMs: number
  downtimeMs: number
  uptimePercent: number
  outageCount: number
  avgOutageDurationMs?: number
  maxOutageDurationMs?: number
  currentStatus: 'online' | 'offline' | 'unknown'
}
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/relay-charts`](../relay-charts/README.md) — visualization layer; consumes `UptimePeriod[]` and `ChangeInfo[]` from relay-chronicle to render charts
- [`@nostrwatch/route66`](../route66/README.md) — persistent relay state management; `ChronicleService` wraps relay-chronicle for use in the monitoring pipeline
- [`@nostrwatch/nip66`](../nip66/README.md) — NIP-66 event kind definitions and type helpers; relay-chronicle consumes kind 1066 events
- [`apps/gui`](../../apps/gui/README.md) — primary consumer; displays relay history and uptime charts sourced from relay-chronicle

## License

[MIT](../../LICENSE)
