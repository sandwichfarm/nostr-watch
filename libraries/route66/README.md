# @nostrwatch/route66

Relay aggregation and state management system for NIP-66 monitor data.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/route66?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/route66)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/route66` aggregates relay (a WebSocket server that stores and forwards Nostr events) status data from NIP-66 (the [Nostr Implementation Possibility](https://github.com/nostr-protocol/nips/blob/master/66.md) for relay monitoring) monitors and exposes it through a consistent querying API. It sits between raw relay checks (performed by `@nostrwatch/nocap`) and the application layer — the GUI and REST API consume route66, not raw check events.

route66 uses a pluggable adapter architecture for both data caching and WebSocket connections. A cache adapter stores and queries relay state locally; a WebSocket adapter handles connections to monitoring relays that publish NIP-66 events. Both dimensions are independently swappable, allowing route66 to work in browser, Node.js, or worker thread environments.

`StateManager` provides shared singleton state, lifecycle events, and local storage access. `ChronicleService` provides time-series relay history from Kind 1066 delta events. `MonitorService` tracks which monitors are active and manages subscription filters.

## Installation

```sh
pnpm add @nostrwatch/route66
```

Or with npm:

```sh
npm install @nostrwatch/route66
```

## Quick Start

```ts
import {Route66} from '@nostrwatch/route66'
import {NostrSqliteAdapter} from '@nostrwatch/route66-cacheadapter-nostrsqlite'
import {NostrToolsAdapter} from '@nostrwatch/route66-wsadapter-nostrtools'

const cacheAdapter = new NostrSqliteAdapter()
const websocketAdapter = new NostrToolsAdapter()

const r66 = new Route66({cacheAdapter, websocketAdapter})
await r66.boot()
await r66.ready()

const relays = await r66.relays?.getRelays({network: 'clearnet'})
console.log(relays)
// { 'wss://relay.damus.io': { record: { url: '...', network: 'clearnet', ... } }, ... }
```

## API

### `Route66`

The main entry point. Wraps the cache and WebSocket adapters and exposes `RelayService`, `MonitorService`, and `StateManager` through a unified interface.

```ts
class Route66 {
  constructor(adapters: IAdaptersArgument)
  boot(): Promise<void>
  ready(): Promise<Route66>
  shutdown(): Promise<void>
  restart(): Promise<void>
  on(event: string, listener: (...args: any[]) => void): void
  once(event: string, listener: (...args: any[]) => void): void
  off(event: string, listener: (...args: any[]) => void): void
  destroy(): void
  get relays(): RelayService | undefined
  get monitors(): MonitorService | undefined
  get cache(): ICacheAdapter | undefined
  get websocket(): IWebsocketAdapter | undefined
  get state(): typeof StateManager
  get initialized(): boolean
}
```

**`constructor(adapters)`**

Creates a Route66 instance. `adapters` must implement `IAdaptersArgument`:

| Field | Type | Description |
|-------|------|-------------|
| `cacheAdapter` | `ICacheAdapter` | Stores and queries relay state locally |
| `websocketAdapter` | `IWebsocketAdapter` | Handles WebSocket connections to monitoring relays |

**`boot()`**

Initializes workers, services, and waits for adapters to signal readiness. Call once after construction. Equivalent to calling `init()` followed by `ready()`.

**`ready()`**

Resolves when initialization is complete. Safe to call multiple times; resolves immediately if already initialized.

**`shutdown()`**

Gracefully shuts down all adapters and workers.

**`relays`**

Returns the `RelayService` instance, which provides relay state queries. Available after `boot()`.

**`monitors`**

Returns the `MonitorService` instance, which manages active monitor subscriptions. Available after `boot()`.

---

### `StateManager`

A static singleton that provides shared state, event emission, and local storage access across all route66 services.

```ts
class StateManager {
  static get abortController(): AbortController
  static get abortSignal(): AbortSignal
  static abort(): void
  static aborted(): boolean
  static resetAbort(): void
  static emit(event: string, ...args: any[]): void
  static on(event: string, listener: (...args: any[]) => void): void
  static once(event: string, listener: (...args: any[]) => void): void
  static off(event: string, listener?: (...args: any[]) => void): void
  static set(key: string, value: any): void
  static get(key: string): any
  static remove(key: string): void
  static clear(): void
  static size(): number
}
```

**`abort()`**

Cancels all in-flight async operations that respect `StateManager.abortSignal`. Emits an `'abort'` event.

**`resetAbort()`**

Creates a new `AbortController`, re-enabling operations after a previous `abort()` call.

**`emit(event, ...args)`**

Emits a named event to all listeners registered with `on()` and `once()`.

**`set(key, value)` / `get(key)` / `remove(key)` / `clear()`**

Local storage operations, namespaced to the `'state'` prefix. Used internally by services to persist lightweight state across page reloads.

---

### `ChronicleService`

Provides relay history and time series data from Kind 1066 delta events (NIP-66 append-only history log).

```ts
class ChronicleService {
  constructor(adapters: IAdaptersArgument, options?: ChronicleServiceOptions)
  syncRelay(relay: string): Promise<void>
  getTimeSeriesData(options: TimeSeriesOptions): Promise<TimeSeriesPoint[]>
  getUptimePeriods(relay: string, since?: number, until?: number): Promise<UptimePeriod[]>
}
```

**`ChronicleServiceOptions`**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoSync` | `boolean` | `false` | Automatically subscribe to Kind 1066 events for queried relays |
| `syncRelays` | `string[]` | `[]` | Relay URLs to fetch Kind 1066 events from |

**`TimeSeriesOptions`**

| Option | Type | Description |
|--------|------|-------------|
| `relay` | `string` | Relay URL to query |
| `since` | `number` | Start of time range (unix timestamp in seconds) |
| `until` | `number` | End of time range (unix timestamp in seconds) |
| `type` | `'rtt' \| 'uptime' \| 'changes'` | Type of time series data |
| `aggregate.bucketSize` | `number` | Bucket size in seconds for aggregation |
| `aggregate.fn` | `'avg' \| 'min' \| 'max' \| 'sum'` | Aggregation function |

**`UptimePeriod`**

| Field | Type | Description |
|-------|------|-------------|
| `start` | `number` | Period start timestamp |
| `end` | `number \| null` | Period end timestamp (`null` if ongoing) |
| `online` | `boolean` | Whether relay was online during this period |
| `rtt` | `number` (optional) | Round-trip time in milliseconds |

**Example:**

```ts
import {ChronicleService} from '@nostrwatch/route66'

const chronicle = new ChronicleService(r66.adapters, {
  autoSync: true,
  syncRelays: ['wss://relay.nostr.watch']
})

await chronicle.syncRelay('wss://relay.damus.io')

const rttData = await chronicle.getTimeSeriesData({
  relay: 'wss://relay.damus.io',
  type: 'rtt',
  since: Math.floor(Date.now() / 1000) - 86400
})
console.log(rttData)
// [{ timestamp: 1709000000, value: 120 }, ...]
```

---

### `MonitorService`

Manages subscriptions to NIP-66 monitors (Kind 10166 announcements) and tracks which monitors are currently active.

```ts
class MonitorService {
  get array(): Monitor[]
  get map(): Map<string, Monitor>
  get enabledMonitors(): Monitor[]
  get activeEnabledMonitors(): Monitor[]
  get disabledMonitors(): Monitor[]
  ready(): Promise<void>
}
```

`MonitorService` is created automatically when `Route66` is initialized with both a cache and WebSocket adapter. Access it via `r66.monitors`.

## Adapter Pattern

route66 has two independent adapter dimensions: **cache adapters** store and query relay state data, and **WebSocket adapters** connect to monitoring relays over Nostr. Both are provided at construction time via `IAdaptersArgument`.

### Cache Adapters

Cache adapters implement `ICacheAdapter` and extend the `CacheAdapter` base class. They store NIP-66 relay check events locally and answer queries from `RelayService`.

**Interface to implement:**

```ts
import {CacheAdapter, type ICacheAdapter} from '@nostrwatch/route66'
import type {IEvent} from '@nostrwatch/route66'

export class MyCacheAdapter extends CacheAdapter implements ICacheAdapter {
  readonly slug = 'MyCacheAdapter'

  async ready(): Promise<void> {
    // Signal that the adapter is initialized and ready to serve queries
  }

  async REQ(filters: any[]): Promise<IEvent[]> {
    // Execute a Nostr REQ query and return matching events
    return []
  }

  async COUNT(filters: any[]): Promise<number> {
    // Return the count of events matching the given filters
    return 0
  }

  async DELETE(filters: any[]): Promise<string[]> {
    // Delete events matching the given filters; return deleted event IDs
    return []
  }

  async DUMP(): Promise<Uint8Array> {
    // Export the full event store as a binary blob
    return new Uint8Array()
  }

  async CLOSE(subId: string): Promise<boolean> {
    // Close a subscription by ID; return true if closed successfully
    return true
  }

  async WIPE(): Promise<boolean> {
    // Clear all stored events; return true if successful
    return true
  }

  async addEvent(event: IEvent): Promise<void> {
    // Insert a single event; no-op if already present
  }

  async addEvents(events: IEvent[]): Promise<void> {
    // Batch insert events
  }

  async putEvent(event: IEvent): Promise<void> {
    // Upsert a single event (insert or replace)
  }
}
```

**Registration:**

```ts
import {Route66} from '@nostrwatch/route66'

const cacheAdapter = new MyCacheAdapter()
const r66 = new Route66({cacheAdapter, websocketAdapter})
```

**Existing cache adapters:**

- [`@nostrwatch/route66-cacheadapter-nostrsqlite`](./adapters/cache/NostrSqliteAdapter/) — SQLite-backed storage using `@nostrwatch/worker-relay` in a web worker; works in browser and Node.js

### WebSocket Adapters

WebSocket adapters implement `IWebsocketAdapter` and extend the `WebsocketAdapter` base class. They open connections to Nostr monitoring relays and deliver incoming NIP-66 events to the rest of route66.

**Registration:**

```ts
import {Route66} from '@nostrwatch/route66'

const websocketAdapter = new MyWebsocketAdapter()
const r66 = new Route66({cacheAdapter, websocketAdapter})
```

**Existing WebSocket adapters:**

- [`@nostrwatch/route66-wsadapter-nostrtools`](./adapters/websocket/NostrToolsAdapter/) — WebSocket implementation using `nostr-tools` and `nostr-fetch`

Reference implementations for both adapter types are in [`libraries/route66/adapters/`](./adapters/).

## Known Limitations

- **Hardcoded filter limit:** `MonitorService` caps subscriptions at 10 filters (`MAX_FILTERS = 10`) regardless of what the relay actually supports. Relays that allow more filters will not be fully utilized; relays that allow fewer may reject subscriptions silently. Split subscriptions across multiple `MonitorService` instances as a workaround. See [CONCERNS.md — Hardcoded Filter Limits](../../.planning/codebase/CONCERNS.md#hardcoded-filter-limits).

- **Default relays hardcoded in source:** Default relay URLs in `RelayService` and `MonitorService` are set in the constructor rather than loaded from configuration. Changing the default relay list requires a code change. Pass an explicit relay list to the respective service constructor as a workaround. See [CONCERNS.md — Default Relay Configuration](../../.planning/codebase/CONCERNS.md#default-relay-configuration).

- **Incomplete RTT extraction:** RTT values are not extracted from chronicle period metadata in `ChronicleService`. Uptime and downtime records may be missing RTT data. No workaround is available at this time. See [CONCERNS.md — Incomplete RTT Extraction](../../.planning/codebase/CONCERNS.md#incomplete-rtt-extraction).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — performs the raw relay capability checks that produce the NIP-66 events route66 aggregates
- [`@nostrwatch/auditor`](../../libraries/auditor/README.md) — NIP conformance testing; auditor results can be published as NIP-66 events
- [`@nostrwatch/relay-chronicle`](../../libraries/relay-chronicle/README.md) — historical relay data library used internally by `ChronicleService`
- [`@nostrwatch/route66-cacheadapter-nostrsqlite`](./adapters/cache/NostrSqliteAdapter/) — SQLite cache adapter reference implementation
- [`@nostrwatch/route66-wsadapter-nostrtools`](./adapters/websocket/NostrToolsAdapter/) — nostr-tools WebSocket adapter reference implementation

## License

[MIT](../../LICENSE)
