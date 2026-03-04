# @nostrwatch/worker-relay

In-browser Nostr relay running in a Web Worker with SQLite-wasm storage and OPFS persistence.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/worker-relay?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/worker-relay)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/worker-relay` runs a full Nostr relay (a WebSocket server that stores and forwards signed JSON events) inside a browser Web Worker — an isolated background thread that keeps the relay off the main UI thread. Event storage is handled by `sqlite-wasm`, a WebAssembly build of SQLite, with persistence backed by OPFS (Origin Private File System), a browser-native file system API that survives page reloads. The package also adds [NIP-119](https://github.com/nostr-protocol/nips/blob/master/119.md) (AND-filter tag queries) support on top of the standard relay functionality.

`WorkerRelayInterface` is the main class callers use. It communicates with the worker via a message-passing RPC layer, so all methods are async and return Promises.

## Prerequisites

Node.js >=20 and pnpm >=9. This package runs in browser environments only — it requires Web Worker support, WebAssembly, and OPFS, which are not available in Node.js.

## Installation

```sh
pnpm add @nostrwatch/worker-relay
```

Or with npm:

```sh
npm install @nostrwatch/worker-relay
```

## Quick Start

```ts
import {WorkerRelayInterface} from '@nostrwatch/worker-relay'

// Create the interface — defaults to the bundled worker script
const relay = new WorkerRelayInterface()

// Open the SQLite database at the given OPFS path and run migrations
await relay.init({databasePath: 'relay.db', insertBatchSize: 10})

// Query events using a standard Nostr REQ command
const events = await relay.query(['REQ', 'sub-1', {kinds: [1], limit: 10}])
console.log(events)
// Array of NostrEvent objects matching the filter

// Publish a new event to the relay
const published = await relay.event({
  id: 'abc123...',
  pubkey: 'def456...',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'hello nostr',
  sig: 'ghi789...'
})
console.log(published.ok) // true
```

## API

### `WorkerRelayInterface`

```ts
class WorkerRelayInterface {
  timeout: number
  constructor(scriptPath?: string | URL | Worker | SharedWorker, channelPort?: MessagePort)
  get worker(): Worker | SharedWorker
  setup(opts?: {timeoutMs?: number}): Promise<boolean>
  init(args: InitArgs): Promise<boolean>
  status(): Promise<RelayStorageStatus>
  query(req: ReqCommand): Promise<NostrEvent[]>
  event(ev: NostrEvent): Promise<OkResponse>
  count(req: ReqCommand): Promise<number>
  delete(req: ReqCommand): Promise<string[]>
  summary(): Promise<Record<string, number>>
  close(id: string): Promise<boolean>
  dump(): Promise<Uint8Array>
  wipe(): Promise<boolean>
  abort(): void
  forYouFeed(pubkey: string): Promise<NostrEvent[]>
  setEventMetadata(id: string, meta: EventMetadata): Promise<void>
  setLogLevel(level: LogLevel): Promise<boolean>
  countNip11s(): Promise<number>
  countUniqueNip11s(): Promise<number>
  dumpNip11s(): Promise<any[]>
  upsertNip11(args: Nip11Args): Promise<boolean>
  batchUpsertNip11(relayNip11s: Nip11Args[]): Promise<boolean>
  getNip11(relay: string): Promise<any>
}
```

**`constructor(scriptPath?, channelPort?)`**

Creates a `WorkerRelayInterface`. If `scriptPath` is omitted, the bundled worker script at `@nostrwatch/worker-relay/dist/esm/worker.mjs` is used. Pass a pre-created `Worker` or `SharedWorker` instance to reuse an existing worker. `channelPort` is used for `SharedWorker` message channel setup.

**`init(args)`**

Opens the SQLite database and runs schema migrations. Must be called before any query or event operations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `databasePath` | `string` | Yes | OPFS file path for the SQLite database |
| `insertBatchSize` | `number` | No | Events inserted per batch (default: unset) |

**`query(req)`**

Executes a standard Nostr `REQ` command against the local database. Returns matching `NostrEvent` objects. `req` is a tuple: `['REQ', subscriptionId, ...filters]`.

**`event(ev)`**

Publishes a Nostr event to the relay. Returns an `OkResponse` with `ok: true` on success.

**`count(req)` / `delete(req)`**

`count` returns the number of events matching the filter. `delete` removes matching events and returns their IDs.

**`status()`**

Returns a `RelayStorageStatus` object describing the current storage backend (`sqlite`, `memory`, or `unknown`) and any error state.

**`summary()`**

Returns a record mapping event kind numbers to their counts in the database.

**`dump()`**

Exports the full SQLite database as a `Uint8Array`. Useful for backup or inspection.

**`wipe()`**

Deletes all data from the database.

**`abort()`**

Terminates the worker and rejects all pending commands. Call this to clean up when the relay is no longer needed.

**`timeout`**

Command timeout in milliseconds. Defaults to `30000`. Increase for slow environments or large batch operations.

### Types

```ts
interface InitArgs {
  databasePath: string
  insertBatchSize?: number
}

interface RelayStorageStatus {
  kind: 'sqlite' | 'memory' | 'unknown'
  reason?: string
  errorMessage?: string
}

interface OkResponse {
  ok: boolean
  id: string
  relay: string
  message?: string
  event: NostrEvent
}

type ReqCommand = ['REQ', id: string, ...filters: ReqFilter[]]
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/utils`](../../internal/utils/README.md) — utility functions used internally by worker-relay
- [`@nostrwatch/negentropy-utils`](../../libraries/negentropy/README.md) — NIP-77 set reconciliation for syncing events between client and relay

## License

[MIT](../../LICENSE)
