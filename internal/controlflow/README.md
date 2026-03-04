# @nostrwatch/controlflow

Queue management and retry utilities for application control flow.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/controlflow` provides BullMQ-backed job queues and a cache-based retry manager for use across the nostr-watch monorepo. It solves two recurring problems: distributing relay-check work across workers with guaranteed delivery, and backing off automatically when a relay consistently fails to respond. Queues connect to Redis for persistence; the retry manager uses `@nostrwatch/nwcache` to track per-relay retry counts with exponential delay steps.

## Prerequisites

Node.js >=20 and pnpm >=9.

A running Redis instance is required for the queue utilities. Set `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` (if applicable) in the consuming application's environment. The retry manager requires a `@nostrwatch/nwcache` cache instance.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/controlflow --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import {NocapdQueue, RetryManager} from '@nostrwatch/controlflow'

// Initialize a named BullMQ queue
const {$Queue, $QueueEvents, Worker} = NocapdQueue('my-worker')

// Add a relay-check job to the queue
await $Queue.add('check', {url: 'wss://relay.damus.io'})

// Process jobs in a worker
new Worker('my-worker', async (job) => {
  console.log('Checking:', job.data.url)
  // run your check here
})
```

## API

### Queue utilities

All queue factory functions return a `{ $Queue, $QueueEvents, Worker }` triple. Calls with the same name return the same cached instance — queues are singletons within the process.

#### `TrawlQueue(qopts?)`

```ts
function TrawlQueue(qopts?: Partial<QueueOptions>): QueueBundle
```

Returns the singleton BullMQ queue used for relay trawling jobs. `qopts` overrides default queue options.

#### `NocapdQueue(name?, qopts?)`

```ts
function NocapdQueue(name?: string | null, qopts?: Partial<QueueOptions>): QueueBundle
```

Returns a BullMQ queue for nocap relay-check jobs. `name` defaults to `'NocapdQueue'`. Pass a custom name to create a named queue variant.

#### `PersistQueue(name?, qopts?)`

```ts
function PersistQueue(name?: string | null, qopts?: Partial<QueueOptions>): QueueBundle
```

Returns a BullMQ queue for database persistence jobs. `name` defaults to `'PersistQueue'`.

#### `QueueInit(key, qopts?)`

```ts
function QueueInit(key: string, qopts?: Partial<QueueOptions>): QueueBundle
```

Low-level queue factory. Creates and caches a `Queue`, `QueueEvents`, and `Worker` constructor under `key`. Call this directly to create a queue that does not have a named factory above.

#### `BullMQ`

```ts
const BullMQ: {Queue, QueueEvents, Worker}
```

Re-exports the raw BullMQ classes for consumers that need direct access.

---

### `RetryManager`

```ts
class RetryManager {
  constructor(caller: string, config?: RetryConfig, rcache?: RelayCache)
  cacheId(url: string): string
  expiry(retries: number | null): number
  getRetries(url: string): Promise<number | null>
  getExpiry(url: string): Promise<number>
  setRetries(url: string, success: boolean): Promise<string | null>
}
```

Tracks per-relay retry counts in cache and maps them to exponential delay intervals. The retry escalation ladder (default):

| Retries | Delay |
|---------|-------|
| 1–3 | 1 hour |
| 4–6 | 24 hours |
| 7–13 | 7 days |
| 14–17 | 28 days |
| 18–29 | 90 days |

**`constructor(caller, config?, rcache?)`**

| Parameter | Type | Description |
|-----------|------|-------------|
| `caller` | `string` | Required. Used as a namespace prefix in cache keys |
| `config` | `object` | Optional. Override `config.expiry` array to customize delay steps |
| `rcache` | `RelayCache` | A `@nostrwatch/nwcache` instance with `retry.get`, `retry.set`, `retry.increment` |

**`setRetries(url, success)`**

Call after each relay check. Pass `success: true` to reset the relay's retry counter to 0. Pass `success: false` to increment it. Returns the cache operation result.

**`getExpiry(url)`**

Returns the current delay in milliseconds for `url` based on its accumulated retry count. Use this to decide how long to wait before re-queuing the relay.

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/utils`](../utils/README.md) — provides `RedisConnectionDetails()` used by the queue factories
- [`@nostrwatch/nwcache`](../nwcache/README.md) — provides the cache backend used by `RetryManager`
- [`@nostrwatch/logger`](../logger/README.md) — logging dependency

## License

[MIT](../../LICENSE)
