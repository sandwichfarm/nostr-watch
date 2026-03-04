# @nostrwatch/db

SQLite-backed database client for storing and querying relay monitoring data.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/db?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/db)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/db` provides a SQLite-backed persistence layer for relay monitoring state. It stores relay status records, check results, retry metadata, and seeder timestamps used by the relay monitoring pipeline. The package exposes a module-level `db` instance plus a set of typed helper functions for common query patterns — no ORM, no migrations framework, raw SQLite via WAL mode for concurrent read performance.

A **relay** in this context is a WebSocket server (identified by `wss://` URL) whose availability and protocol conformance is tracked over time. Each relay entry records online/offline state, last checked timestamp, round-trip time, network type, and retry count.

## Installation

```sh
pnpm add @nostrwatch/db
```

Or with npm:

```sh
npm install @nostrwatch/db
```

## Quick Start

```ts
import {initDB, db, seedNewRelay, getOnlineRelays} from '@nostrwatch/db'

// Initialize (creates file if absent, enables WAL mode by default)
initDB('relaymon.db')

// Seed a relay for first-time tracking
seedNewRelay('wss://relay.damus.io', 'clearnet')

// Query online relays
const online = getOnlineRelays()
console.log(online)
// ['wss://relay.damus.io']
```

## API

### `initDB(dbPath?, enableWAL?)`

```ts
function initDB(dbPath?: string, enableWAL?: boolean): DB
```

Initializes the database at the given file path. Creates the `relay_status` and `seeder_timestamps` tables if they do not exist. Enables WAL (Write-Ahead Logging) mode by default for improved read concurrency.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dbPath` | `string` | `'relaymon.db'` | Path to the SQLite file |
| `enableWAL` | `boolean` | `true` | Enable WAL mode and related PRAGMAs |

Returns the underlying `DB` instance. Also sets the module-level `db` export.

---

### `db`

```ts
export let db: DB
```

Module-level SQLite database instance. Set by `initDB()`. Use directly for raw queries not covered by the helper functions.

---

### `seedNewRelay(url, network)`

```ts
function seedNewRelay(url: string, network: string): boolean
```

Inserts a relay into `relay_status` with `online = 0`, `checked_at = -1`, and `retries = 0`. If the relay already exists, does nothing (`ON CONFLICT DO NOTHING`). Returns `true` if the row was inserted.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | WebSocket URL of the relay (e.g. `wss://relay.damus.io`) |
| `network` | `string` | Network type: `'clearnet'`, `'tor'`, `'i2p'` |

---

### `getOnlineRelays()`

```ts
function getOnlineRelays(): string[]
```

Returns the URLs of all relays currently marked `online = 1`.

---

### `getAllRelays()`

```ts
function getAllRelays(): Set<string>
```

Returns a `Set` of all relay URLs regardless of online status.

---

### `persistResult(result)`

```ts
function persistResult(result: any): void
```

Upserts a relay check result. Sets `online`, `rtt`, `network`, `ignore`, and `checked_at` from the result object. Resets `retries` to `0` if the relay is online; leaves retry count unchanged otherwise.

---

### `incrementRetryCount(url)`

```ts
function incrementRetryCount(url: string): void
```

Increments the `retries` column by 1 for the given relay URL. Called by the worker when a check fails and a retry is scheduled.

---

### `getRetryCount(url)`

```ts
function getRetryCount(url: string): number
```

Returns the current retry count for the given relay. Returns `0` if the relay is not found.

---

### `isReadyToCheck(checkedAt, retries, expirySeconds, retryManager)`

```ts
function isReadyToCheck(
  checkedAt: number,
  retries: number,
  expirySeconds: number,
  retryManager: any
): boolean
```

Returns `true` if a relay is due for a new check. Relays with `checkedAt === -1` are always ready. Relays with active retries use exponential backoff delay from `retryManager.getDelay(retries)` instead of the normal expiry interval.

---

### `getExpiredRelays(expires, allowedNetworks, retryManager)`

```ts
function getExpiredRelays(
  expires: number,
  allowedNetworks: string[],
  retryManager: any
): string[]
```

Returns the URLs of all relays that are due for a check, filtered by `allowedNetworks` and excluding ignored relays. Applies `isReadyToCheck` per relay to handle both normal expiry and retry backoff.

---

### `saveSeederTimestamp(method, timestamp)`

```ts
function saveSeederTimestamp(method: string, timestamp: number): void
```

Upserts a seeder method's last-run timestamp. Used by `internal/seed` to avoid redundant seeding.

---

### `getSeederTimestamps()`

```ts
function getSeederTimestamps(): Record<string, number>
```

Returns all seeder method timestamps as a `{ methodName: unixTimestamp }` map.

---

### Types

#### `RelayStatus`

```ts
interface RelayStatus {
  url: string
  online: number       // 1 = online, 0 = offline
  ignore: number       // 1 = excluded from checks
  parent: string
  checked_at: number   // Unix timestamp of last check
  rtt: number          // Round-trip time in ms (-1 = not yet checked)
  network: string      // 'clearnet' | 'tor' | 'i2p'
  retries: number
}
```

#### `SeederTimestamp`

```ts
interface SeederTimestamp {
  method: string
  timestamp: number
}
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/route66`](../route66/README.md) — relay aggregation and state management; uses `@nostrwatch/db` for persistent relay state storage
- [`internal/seed`](../../internal/seed/README.md) — seeds the database with relay URLs from multiple discovery sources
- [`apps/relaymon`](../../apps/relaymon/README.md) — relay monitoring daemon; stores all check results via this package

## License

[MIT](../../LICENSE)
