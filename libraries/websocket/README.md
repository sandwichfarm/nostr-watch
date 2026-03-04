# @nostrwatch/websocket

Cross-platform WebSocket client with a unified event-driven API for Node.js, browser, and Deno.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/websocket?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/websocket)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser%20%7C%20deno-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/websocket` wraps platform-specific WebSocket implementations behind the `UniversalWebSocket` class, providing a consistent `on`/`once`/`off` event API and connection lifecycle management across Node.js, browser, and Deno environments. The class detects the runtime automatically and selects the appropriate underlying implementation (`ws` in Node.js, native `WebSocket` in browser/Deno). It is the WebSocket foundation used by the relay check adapters in `@nostrwatch/nocap`.

A **relay** in Nostr is a WebSocket server (identified by a `wss://` URL) that stores and forwards signed protocol messages (events). `UniversalWebSocket` connects to these endpoints and handles connection state, message dispatch, and graceful teardown regardless of the JavaScript runtime.

## Installation

```sh
pnpm add @nostrwatch/websocket
```

Or with npm:

```sh
npm install @nostrwatch/websocket
```

## Quick Start

```ts
import {UniversalWebSocket} from '@nostrwatch/websocket'

const ws = new UniversalWebSocket('wss://relay.damus.io')
ws.on('open', () => console.log('connected'))
ws.on('message', (ev) => console.log('received:', ev.data))
await ws.connect()

ws.send(JSON.stringify(['REQ', 'sub1', {kinds: [1], limit: 1}]))
// received: ["EVENT","sub1",{"id":"...","kind":1,...}]
```

## API

### `UniversalWebSocket`

```ts
class UniversalWebSocket {
  constructor(relay: string, protocols?: string | string[], options?: UniversalWebSocketOptions)
  static create(relay: string, protocols?: string | string[], options?: UniversalWebSocketOptions): Promise<UniversalWebSocket>
}
```

#### Constructor

```ts
new UniversalWebSocket(relay: string, protocols?, options?)
```

Creates a new cross-platform WebSocket instance. By default (`autoConnect: true`), begins connecting immediately in the background. To control connection timing manually, set `autoConnect: false` and call `connect()` when ready.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relay` | `string` | WebSocket URL of the relay (e.g. `wss://relay.damus.io`) |
| `protocols` | `string \| string[]` | Optional WebSocket subprotocols |
| `options` | `UniversalWebSocketOptions` | Optional configuration object |

#### `UniversalWebSocketOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoConnect` | `boolean` | `true` | Connect automatically on construction |
| `connectTimeout` | `number` | `10000` | Timeout in milliseconds before `connect()` rejects |
| `agent` | `unknown` | `undefined` | HTTP agent for Node.js proxy support |
| `wsOptions` | `Record<string, unknown>` | `undefined` | Additional options forwarded to the underlying `ws` constructor in Node.js |

---

#### `UniversalWebSocket.create()`

```ts
static async create(relay: string, protocols?, options?): Promise<UniversalWebSocket>
```

Factory method that creates an instance with `autoConnect: false`, calls `connect()`, and resolves when the connection is open. Use this when you need to await a fully connected socket before proceeding.

---

### Event methods

#### `on(type, listener)`

```ts
on<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void
```

Registers a persistent event listener. Fires on every occurrence of the event.

#### `once(type, listener)`

```ts
once<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void
```

Registers a one-shot event listener. Automatically removed after the first invocation.

#### `off(type?, listener?)`

```ts
off<K extends WebSocketEventType>(type?: K, listener?: WebSocketListener<K>): void
```

Removes event listeners. With no arguments, clears all listeners for all event types. With only `type`, clears all listeners for that type. With both arguments, removes the specific listener.

#### `addEventListener(type, listener)` / `removeEventListener(type, listener)`

DOM-compatible aliases for `on` and `off`. Useful when passing a `UniversalWebSocket` to code that expects a native `WebSocket`.

---

### Lifecycle methods

#### `connect()`

```ts
async connect(): Promise<boolean>
```

Initiates the WebSocket connection. Resolves `true` when the connection opens, `false` if the connection fails or times out. Safe to call multiple times — concurrent calls share the same promise.

#### `ready()`

```ts
async ready(): Promise<void>
```

Awaits a successful connection. Throws if the connection fails. Use this when you want to ensure the socket is open before sending.

#### `closed()`

```ts
async closed(): Promise<void>
```

Resolves when the socket transitions to the `CLOSED` state.

#### `close(code?, reason?)`

```ts
close(code?: number, reason?: string): void
```

Initiates a graceful WebSocket close handshake with an optional close code and reason string.

#### `terminate()`

```ts
terminate(): void
```

Forcefully destroys the connection without completing the close handshake. In browser environments where `terminate()` is not available on native `WebSocket`, falls back to `close()`.

---

### Communication

#### `send(data)`

```ts
send(data: unknown): void
```

Sends data over the open WebSocket. Accepts strings, `Blob`, `ArrayBuffer`, `ArrayBufferView`, plain objects (JSON-serialized automatically), or arrays (JSON-serialized automatically). Throws if the socket is not connected.

---

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `readyState` | `number` | Current connection state: `0` CONNECTING, `1` OPEN, `2` CLOSING, `3` CLOSED |
| `url` | `string` | The relay URL this socket was constructed with |
| `CONNECTED` | `boolean` | Alias for `readyState === 1` |
| `CONNECTING` | `boolean` | Alias for `readyState === 0` |
| `CLOSING` | `boolean` | Alias for `readyState === 2` |
| `CLOSED` | `boolean` | Alias for `readyState === 3` |
| `BUSY` | `boolean` | True while CONNECTING or CLOSING |
| `OPEN` | `boolean` | Alias for `CONNECTED` |

Convenience state-check methods: `isConnecting()`, `isConnected()`, `isOpen()`, `isClosing()`, `isClosed()`.

---

### Events

| Event | Payload type | Description |
|-------|-------------|-------------|
| `open` | `Event` | Connection established |
| `message` | `MessageEvent<string \| Buffer \| ArrayBuffer \| Blob>` | Message received from the relay |
| `close` | `CloseEvent` | Connection closed; inspect `ev.code` and `ev.reason` |
| `error` | `Event` | Connection error occurred |

---

### Types

```ts
type WebSocketEventType = 'open' | 'close' | 'error' | 'message'
type Sendable = string | ArrayBufferLike | Blob | ArrayBufferView
type WebSocketData = Sendable | Buffer

interface UniversalWebSocketOptions {
  agent?: unknown
  connectTimeout?: number
  autoConnect?: boolean
  wsOptions?: Record<string, unknown>
}
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../nocap/README.md) — relay capability checker; uses `@nostrwatch/websocket` as its underlying WebSocket transport via the websocket adapter
- [`@nostrwatch/route66`](../route66/README.md) — relay aggregation layer; websocket adapter wraps `UniversalWebSocket` for connection pooling
- [`@nostrwatch/memory-relay`](../memory-relay/README.md) — in-memory relay for testing; pairs with `UniversalWebSocket` in integration test scenarios

## License

[MIT](../../LICENSE)
