# nostrawl

Queue-based Nostr relay web crawler with PQueue and BullMQ adapters.

[![npm version](https://img.shields.io/npm/v/nostrawl?style=flat-square&label=npm)](https://www.npmjs.com/package/nostrawl)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`nostrawl` wraps `nostr-fetch` with pluggable queue adapters for controlled, rate-limited crawling of Nostr relay (a WebSocket server that stores and forwards events) data. Given a list of relay URLs and a Nostr filter (a query object specifying event kinds, authors, or time ranges), `nostrawl` distributes fetch jobs across in-memory (PQueue) or Redis-backed (BullMQ) queues, deduplicates events via LMDB cache, and emits each new event to registered listeners. It is designed for persistent, long-running crawl processes that must survive restarts without reprocessing previously seen events.

## Prerequisites

Node.js >=20 and pnpm >=9.

For BullMQ adapter: a running Redis instance (tested with Redis 7+).

## Installation

```sh
pnpm add nostrawl
```

Or with npm:

```sh
npm install nostrawl
```

## Quick Start

```ts
import {nostrawl} from 'nostrawl'

const trawler = nostrawl(
  ['wss://relay.damus.io', 'wss://nos.lol'],
  {
    filters: {kinds: [1]},
    cache: {enabled: true, path: './cache'},
    logLevel: 'info'
  }
)

trawler.on('event', (event) => {
  console.log('received event:', event.id)
})

trawler.on('progress', (progress) => {
  console.log(`relay ${progress.relay}: found=${progress.found} rejected=${progress.rejected}`)
})

await trawler.run()
```

## API

### `nostrawl(relays, options?)`

```ts
function nostrawl(relays: string[], options?: Partial<TrawlerOptions>): PQueueAdapter
```

Creates and initializes a trawler using the PQueue adapter. Returns the adapter instance, which extends `EventEmitter`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relays` | `string[]` | Array of relay WebSocket URLs to crawl |
| `options` | `Partial<TrawlerOptions>` | Optional configuration — see options table below |

### `TrawlerOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filters` | `Record<string, any>` | `{}` | Nostr filter object passed to `nostr-fetch` |
| `since` | `number \| Record<string, number>` | `0` | Unix timestamp; per-relay timestamps accepted |
| `adapter` | `'pqueue' \| 'bullmq'` | `'pqueue'` | Queue backend. BullMQ requires Redis |
| `relaysPerBatch` | `number` | `3` | Number of relays processed concurrently per job |
| `repeatWhenComplete` | `boolean` | `true` | Restart crawl after all relays finish |
| `restDuration` | `number` | `1000` | Milliseconds to wait before restarting (if repeat enabled) |
| `progressEvery` | `number` | `5000` | Minimum ms between progress events per relay |
| `cache.enabled` | `boolean` | `true` | Deduplicate events using LMDB cache |
| `cache.path` | `string` | `'./cache'` | Directory path for LMDB cache |
| `logLevel` | `LogLevel` | `'info'` | Logging verbosity |
| `validator` | `(trawler, event) => boolean` | — | Return `false` to reject an event before emitting |
| `parser` | `(trawler, event, job) => Promise<void>` | — | Legacy per-event callback; prefer `on('event', ...)` |

### Events

The returned adapter extends `EventEmitter`. Register listeners before calling `run()`.

| Event | Payload | Description |
|-------|---------|-------------|
| `'event'` | `Event` | Emitted for each new, validated event |
| `'progress'` | `Progress` | Emitted periodically with per-relay counters |
| `'error'` | `Error` | Emitted when a relay fetch fails |

### `Progress`

```ts
interface Progress {
  relay: string
  found: number
  rejected: number
  total: number
  last_timestamp: number
  highest_timestamp: number
  lowest_timestamp: number
}
```

### `PQueueAdapterOptions`

Extends `TrawlerOptions` with PQueue-specific settings:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `1` | Maximum concurrent jobs |
| `timeout` | `number` | `undefined` | Per-job timeout in ms; `undefined` disables timeout |
| `intervalCap` | `number` | — | Maximum jobs per interval |
| `interval` | `number` | `0` | Rate-limiting interval in ms |

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/route66`](../route66/README.md) — persistent relay state management; the primary consumer of crawled events
- [`apps/trawler`](../../apps/trawler/README.md) — reference application that uses `nostrawl` for continuous relay crawling

## License

[MIT](../../LICENSE)
