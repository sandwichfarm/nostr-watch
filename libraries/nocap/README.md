# @nostrwatch/nocap

Adapter-based relay capability discovery — check WebSocket connectivity, DNS, SSL, NIP-11 info, and geolocation for any Nostr relay.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/nocap?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/nocap)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/nocap` checks the health of Nostr relays (WebSocket servers that store and forward Nostr events) across multiple dimensions: WebSocket open/read/write connectivity, DNS resolution, TLS certificate validity, [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) info document retrieval, and geolocation. It is the primary relay-probing engine in the nostr-watch monorepo.

nocap uses a **pluggable adapter architecture**: the `Nocap` class handles check orchestration, result collection, and timeout management, while adapters supply the actual check implementations. This means you can swap how DNS is resolved, how SSL is checked, or how WebSocket connections are managed without changing any application code. Five adapter types are supported out of the box; you can implement custom adapters for all of them.

nocap ships with five default adapter implementations in `libraries/nocap/adapters/default/`. For most use cases, importing and registering the default adapters is sufficient.

## Prerequisites

Node.js >=18 and pnpm >=9.

**Peer dependency:** `@nostrwatch/websocket` must be available in the consuming package.

## Installation

```sh
pnpm add @nostrwatch/nocap
```

Or with npm:

```sh
npm install @nostrwatch/nocap
```

## Quick Start

```ts
import Nocap from '@nostrwatch/nocap'
import WebsocketAdapterDefault from '@nostrwatch/nocap/adapters/default/WebsocketAdapterDefault'
import DnsAdapterDefault from '@nostrwatch/nocap/adapters/default/DnsAdapterDefault'

const nocap = new Nocap('wss://relay.damus.io')
await nocap.useAdapters([WebsocketAdapterDefault, DnsAdapterDefault])

const result = await nocap.check(['open', 'read', 'dns'])
console.log(result)
// {
//   url: 'wss://relay.damus.io',
//   open: { data: true, duration: 120, status: 'success' },
//   read: { data: true, duration: 80, status: 'success' },
//   dns: { data: { ipv4: ['104.21.x.x'] }, duration: 40, status: 'success' }
// }
```

To run all checks at once:

```ts
const result = await nocap.check('all')
```

## API

### `Nocap`

```ts
class Nocap {
  constructor(url: string, config?: object)
  useAdapter(Adapter: IAdapterConstructor): Promise<void>
  useAdapters(Adapters: IAdapterConstructor[] | Record<string, IAdapterConstructor>): Promise<void>
  check(keys: CheckKey | CheckKey[] | 'all'): Promise<IResult>
  checkAll(): Promise<IResult>
  static checksSupported(): CheckKey[]
  static translateCheckKeys(checks: string[]): string[]
}
```

**`constructor(url, config?)`**

Creates a new nocap instance scoped to the given relay URL. The URL must be a valid `wss://` or `ws://` WebSocket URL. `config` is optional and may include timeout settings and logging configuration.

**`useAdapter(Adapter)`**

Registers a single adapter class. The adapter's `static type` property determines which check dimension it handles. Throws if an adapter of that type has already been registered.

**`useAdapters(Adapters)`**

Registers multiple adapter classes in one call. Accepts either an array of adapter classes or a plain object mapping type names to adapter classes. Throws if any adapter type has already been registered.

**`check(keys)`**

Runs one or more checks against the relay. `keys` can be:

- A single check key string: `'open'`, `'read'`, `'write'`, `'dns'`, `'ssl'`, `'info'`, `'geo'`
- An array of check keys: `['open', 'dns', 'ssl']`
- The string `'all'` to run every supported check

Returns an `IResult` object containing the check outcomes, timing data, and relay metadata. Rejects if a required adapter is missing for the requested check.

**`checkAll()`**

Convenience wrapper for `check('all')`.

**`static checksSupported()`**

Returns the full list of supported check keys: `['open', 'read', 'write', 'ssl', 'dns', 'geo', 'info']`.

**`static translateCheckKeys(checks)`**

Translates check key aliases to their canonical form. For example, `'websocket'` and `'ws'` expand to `['open', 'read', 'write']`; `'nip11'` expands to `['info']`; `'tls'` expands to `['ssl']`.

---

### `IResult`

The object returned by `check()` has this shape:

```ts
interface IResult {
  url: string
  network?: string        // 'clearnet' | 'tor' | 'i2p'
  hostname?: string
  protocol?: string
  adapters?: string[]     // slugs of adapters used
  checked_at?: number     // unix timestamp ms
  checked_by?: string     // optional monitor identifier
  open?: IResultData
  read?: IResultData
  write?: IResultData
  dns?: IResultData
  ssl?: IResultData
  geo?: IResultData
  info?: IResultData
}

interface IResultData {
  data: boolean | object | null
  duration: number        // milliseconds; -1 if timed out or errored
  status?: string         // 'success' | 'error'
  message?: string        // error message if status is 'error'
}
```

---

### `AbstractAdapter`

```ts
abstract class AbstractAdapter implements IAdapter {
  static type: AdapterType             // one of: 'websocket'|'dns'|'geo'|'info'|'ssl'
  readonly slug: string                // human-readable adapter identifier
  protected _base: Base                // the Nocap instance this adapter belongs to
  get base(): Base                     // accessor for _base

  constructor(base: Base)
  abstract initialize(): void          // called automatically on construction
}
```

All custom adapters must extend `AbstractAdapter`. The `static type` property is the dispatch key — nocap reads it to determine which checks the adapter handles. The `base` getter exposes the parent `Nocap` instance, including `base.finish()` which resolves a check.

## Adapter Pattern

nocap separates check orchestration from check implementation. The `Nocap` class knows when to run checks, how to manage timeouts, and how to aggregate results. Adapters know how to actually perform checks — making HTTP requests, opening WebSocket connections, querying DNS servers. This means different adapters can serve different environments (Node.js vs browser), different network topologies (clearnet vs Tor), or different underlying service providers (Cloudflare DNS vs custom resolver) without modifying the core nocap logic.

### Base class to extend

Every adapter must extend `AbstractAdapter`:

```ts
import {AbstractAdapter, type IAdapter, type AdapterType} from '@nostrwatch/nocap'

export class MyAdapter extends AbstractAdapter implements IAdapter {
  static type: AdapterType = 'dns'   // declares what check dimension this adapter handles
  readonly slug: string = 'MyAdapter'

  constructor(base: any) {
    super(base)               // registers this.base and calls initialize()
  }

  initialize(): void {
    // optional setup logic — called automatically by super(base)
  }
}
```

### Interface to implement

All adapters must implement `IAdapter`:

```ts
interface IAdapter {
  readonly base: Base        // the Nocap instance (provided by AbstractAdapter)
  readonly slug: string      // human-readable adapter name
  initialize(): void         // called on construction

  // optional lifecycle hooks
  count?: TAdapterCount
}
```

### Per-type interfaces

Each adapter type has its own interface specifying which check method(s) it must implement. Choose the interface that matches your adapter's `static type`:

| Type | Interface | Required methods |
|------|-----------|-----------------|
| `websocket` | `IWebsocketAdapter` | `check_open()`, `check_read()`, `check_write()` |
| `dns` | `IDnsAdapter` | `check_dns()` |
| `info` | `IInfoAdapter` | `check_info()` |
| `ssl` | `ISslAdapter` | `check_ssl()` |
| `geo` | `IGeoAdapter` | `check_geo()` |

All check methods have the signature `(): Promise<void>`. They do not return values directly — instead, they call `this.base.finish(key, result)` to resolve the check.

### Registration

Register adapters before calling `check()`:

```ts
// Register a single adapter
await nocap.useAdapter(MyDnsAdapter)

// Register multiple adapters at once
await nocap.useAdapters([MyDnsAdapter, MyWebsocketAdapter])

// Or using an object (type names map to adapter classes)
await nocap.useAdapters({dns: MyDnsAdapter, websocket: MyWebsocketAdapter})
```

### Creating a custom adapter

The following is a complete, minimal DNS adapter:

```ts
import {AbstractAdapter, type IAdapter, type AdapterType} from '@nostrwatch/nocap'

export class MyDnsAdapter extends AbstractAdapter implements IAdapter {
  static type: AdapterType = 'dns'
  readonly slug: string = 'MyDnsAdapter'

  constructor(base: any) {
    super(base)
  }

  initialize(): void {}

  async check_dns(): Promise<void> {
    // Perform your DNS lookup here
    const host = new URL(this.base.url).hostname
    const ipv4 = ['1.2.3.4'] // your actual lookup result

    // Call base.finish() to resolve the check.
    // First argument: the check key.
    // Second argument: IResultData with data, duration, and status.
    this.base.finish('dns', {
      data: {ipv4},
      duration: 50,
      status: 'success'
    })
  }
}
```

Then register and use it:

```ts
import Nocap from '@nostrwatch/nocap'
import {MyDnsAdapter} from './MyDnsAdapter'

const nocap = new Nocap('wss://relay.damus.io')
await nocap.useAdapter(MyDnsAdapter)

const result = await nocap.check('dns')
console.log(result.dns)
// { data: { ipv4: ['1.2.3.4'] }, duration: 50, status: 'success' }
```

### Existing default adapters

Five adapter implementations ship with nocap in `libraries/nocap/adapters/default/`. Use these as-is or as reference implementations for custom adapters:

- [`DnsAdapterDefault`](adapters/default/DnsAdapterDefault/) — DNS lookup via Cloudflare DNS-over-HTTPS (1.1.1.1); handles both clearnet and IP-addressed relays
- [`GeoAdapterDefault`](adapters/default/GeoAdapterDefault/) — geographic IP lookup; depends on DNS check result for the relay's resolved IP
- [`InfoAdapterDefault`](adapters/default/InfoAdapterDefault/) — fetches the NIP-11 relay information document from the relay's HTTP endpoint
- [`SslAdapterDefault`](adapters/default/SslAdapterDefault/) — TLS certificate validation; retrieves and validates the relay's SSL certificate chain
- [`WebsocketAdapterDefault`](adapters/default/WebsocketAdapterDefault/) — WebSocket open/read/write checks; establishes a connection, sends a REQ and EVENT, and verifies protocol-level responses

## Known Limitations

- **SSL check not available in browser:** The `ssl` check uses Node.js TLS APIs and cannot run in a browser environment. If `check('ssl')` is called from a browser context, nocap logs a warning and skips the check rather than throwing. Use nocap in a Node.js environment for full SSL checking capability.

- **Geo check depends on DNS:** The `geo` check requires a resolved IP address from the `dns` check. If `check('geo')` is requested without `'dns'` in the check list, nocap automatically prepends `'dns'` as a dependency. The DNS result is excluded from the returned result if it was added automatically (controlled by `autoDepsIgnoredInResult` config option).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap-route66`](../nocap-route66/README.md) — transforms nocap check results into NIP-66 kind 30166 relay status events
- [`@nostrwatch/auditor`](../auditor/README.md) — NIP conformance testing; uses nocap WebSocket adapters for relay connectivity
- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — publishes NIP-66 events built from nocap check results
- [`@nostrwatch/route66`](../route66/README.md) — relay monitoring orchestration; uses nocap as its check engine
- [`@nostrwatch/websocket`](../websocket/README.md) — cross-platform WebSocket implementation used by `WebsocketAdapterDefault`

## License

[MIT](../../LICENSE)
