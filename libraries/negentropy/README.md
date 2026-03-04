# @nostrwatch/negentropy-utils

Utilities for [NIP-77](https://github.com/nostr-protocol/nips/blob/master/77.md) Negentropy set reconciliation between Nostr clients and relays.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/negentropy-utils?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/negentropy-utils)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/negentropy-utils` implements the [NIP-77](https://github.com/nostr-protocol/nips/blob/master/77.md) Negentropy protocol — a set reconciliation algorithm that efficiently identifies which Nostr events (signed JSON objects that are the fundamental unit of the Nostr protocol) a client and relay do not have in common. Instead of transferring full event lists, Negentropy uses fingerprint-based range comparisons to minimize data transferred during sync. The package provides `ClientHandler` for use in Nostr clients and `ServerHandler` for use in relay implementations, both operating over a pluggable `Transport` interface.

## Prerequisites

Node.js >=20 and pnpm >=9.

## Installation

```sh
pnpm add @nostrwatch/negentropy-utils
```

Or with npm:

```sh
npm install @nostrwatch/negentropy-utils
```

## Quick Start

```ts
import {ClientHandler} from '@nostrwatch/negentropy-utils'
import {WebSocketTransport} from '@nostrwatch/negentropy-utils/transports/WebSocket'
import type {RecordItem} from '@nostrwatch/negentropy-utils'

// Local event records (timestamp + 32-byte ID)
const localRecords: RecordItem[] = [
  {timestamp: BigInt(1700000000), id: new Uint8Array(32).fill(1)},
  {timestamp: BigInt(1700000001), id: new Uint8Array(32).fill(2)}
]

const ws = new WebSocket('wss://relay.damus.io')
const transport = new WebSocketTransport(ws)

// Subscribe to kind 1 events and start sync
const client = new ClientHandler(localRecords, transport, {kinds: [1]}, 'sync-1')

ws.onopen = () => {
  client.startSync()
  // Sends NEG-OPEN to the relay and begins reconciliation
}
```

## API

### `ClientHandler`

Used on the client side to synchronize a local event set with a relay.

```ts
class ClientHandler {
  constructor(
    records: RecordItem[],
    transport: Transport,
    filter: object,
    subscriptionId: string
  )
  startSync(): void
  handleMessage(message: string): void
}
```

**`constructor(records, transport, filter, subscriptionId)`**

| Parameter | Type | Description |
|-----------|------|-------------|
| `records` | `RecordItem[]` | Local event records to synchronize |
| `transport` | `Transport` | Message transport (e.g., `WebSocketTransport`) |
| `filter` | `object` | Nostr filter (e.g., `{kinds: [1]}`) scoping which events to sync |
| `subscriptionId` | `string` | Unique identifier for this sync session |

**`startSync()`**

Initiates the NIP-77 handshake by sending a `NEG-OPEN` message to the relay. Call this after the transport connection is open.

**`handleMessage(message: string)`**

Processes an incoming relay message (`NEG-MSG`, `NEG-ERR`, or `NEG-CLOSE`). The `Transport` implementation calls this automatically via `onMessage`.

### `ServerHandler`

Used on the relay side to respond to client sync requests.

```ts
class ServerHandler {
  constructor(
    records: RecordItem[],
    transport: Transport,
    applyFilter: (records: RecordItem[], filter: object) => Promise<RecordItem[]>
  )
  handleMessage(message: string): Promise<void>
}
```

**`constructor(records, transport, applyFilter)`**

| Parameter | Type | Description |
|-----------|------|-------------|
| `records` | `RecordItem[]` | All event records stored on the relay |
| `transport` | `Transport` | Message transport connected to the client |
| `applyFilter` | `function` | Async function that filters `records` by a Nostr filter object |

**`handleMessage(message: string)`**

Handles incoming client messages (`NEG-OPEN`, `NEG-MSG`, `NEG-CLOSE`). The `Transport` implementation calls this automatically.

### `Transport`

An abstract interface that both handlers communicate through. Implement it for any transport layer (WebSocket, stdio, etc.).

```ts
abstract class Transport {
  abstract send(message: string): void
  abstract onMessage(handler: (message: string) => void): void
}
```

### Types

```ts
type RecordItem = {timestamp: bigint; id: Uint8Array}

type RangeMode = 0 | 1 | 2

interface Range {
  upperBound: Bound
  mode: RangeMode
  payload: Uint8Array
}

interface Bound {
  timestampOffset: bigint
  idPrefix: Uint8Array
}
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/worker-relay`](../../libraries/worker-relay/README.md) — in-browser relay; negentropy-utils can be used with it for client-side event sync
- [`@nostrwatch/route66`](../../libraries/route66/README.md) — relay monitoring library that uses negentropy for event set synchronization

## License

[MIT](../../LICENSE)
