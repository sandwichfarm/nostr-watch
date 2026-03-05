# @nostrwatch/announce

Publishes monitor announcement events on every boot.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/announce` generates and publishes three Nostr events each time a monitor starts: a [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) kind 10166 monitor registration event (a standardized announcement that declares this monitor's capabilities, relay list, and check frequency to the network), a [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) kind 10002 relay list event (listing the relays the monitor publishes to), and a NIP-01 kind 0 user metadata event (the monitor's public profile). Together these three events allow other clients and monitors to discover this monitor's identity and capabilities automatically at boot. The primary consumer is [`@nostrwatch/relaymon`](../../apps/relaymon/README.md).

## Prerequisites

Node.js >=20 and pnpm >=9.

**Peer dependency:** `nostr-tools@2.1.4` must be installed in the consuming package.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/announce --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import {AnnounceMonitor} from '@nostrwatch/announce'

const pubkey = 'abc123...' // 64-char hex public key
const sk = 'deadbeef...' // 64-char hex secret key

const monitor = new AnnounceMonitor(pubkey, {
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  userDataRelays: ['wss://purplepag.es'],
  frequency: '3600',
  networks: ['clearnet'],
  checks: ['websocket', 'info', 'dns', 'geo', 'ssl'],
  profile: {name: 'my-monitor', about: 'nostr-watch relay monitor'}
})

monitor.generate()
await monitor.sign(sk)
const publishedIds = await monitor.publish()
// ['<event-id-10166>', '<event-id-10002>', '<event-id-0>']
```

## API

### `AnnounceMonitor`

```ts
class AnnounceMonitor {
  constructor(pubkey: string, options: AnnounceMonitorOptions)
  generate(): Record<string, Event>
  sign(sk: string): Promise<void>
  publish(): Promise<string[]>
  static formatChecks(checks: string[]): string[]
  static verify(ev: any): boolean
}
```

**`constructor(pubkey, options)`**

Creates an `AnnounceMonitor` instance. Validates all options and throws descriptive errors for invalid inputs (wrong types, empty relay array).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `relays` | `string[]` | Yes | Relays the monitor publishes NIP-66 events to |
| `userDataRelays` | `string[]` | No | Relays for kind 0 and 10002 events; defaults to `['wss://purplepag.es', 'wss://user.kindpag.es']` |
| `frequency` | `string` | No | Check interval in seconds as a string (e.g., `'3600'`) |
| `networks` | `string[]` | No | Network types the monitor covers (e.g., `['clearnet', 'tor']`) |
| `checks` | `string[]` | No | Check types to declare; pass `['all']` to expand to all supported checks |
| `timeouts` | `object` | No | Per-check timeout configuration |
| `geo` | `object` | No | Monitor geolocation data |
| `owner` | `string` | No | Monitor owner pubkey |
| `profile` | `object` | No | NIP-01 profile fields for the kind 0 event (e.g., `{name, about, picture}`) |
| `clientTag` | `string` | No | Optional client tag appended to all generated events |

**`generate()`**

Builds the kind 10166, 10002, and kind 0 event objects using `@nostrwatch/publisher`. Returns a record keyed by kind number (`'10166'`, `'10002'`, `'0'`). Does not sign or publish.

**`sign(sk)`**

Signs all generated events using the 64-char hex secret key `sk`. Must be called after `generate()`.

**`publish()`**

Publishes all signed events to the appropriate relays — kind 0 and 10002 go to `userDataRelays`; kind 10166 goes to `relays`. Returns an array of published event IDs. Logs each successful publish; catches and logs individual publish failures without stopping the loop.

**`static formatChecks(checks)`**

Expands `['all']` to the full check list `['websocket', 'ws', 'info', 'dns', 'geo', 'ssl']`. Pass-through for any other value.

**`static verify(ev)`**

Verifies the cryptographic signature of a Nostr event using `nostr-tools`. Returns `true` if valid.

## Known Limitations

- **Console.log in production code:** `AnnounceMonitor` contains unconditional `console.log` calls (in `setup()` and `publish()`) that emit to stdout in production environments. See [CONCERNS.md — Console.log Statements in Production Code](../../.planning/codebase/CONCERNS.md).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/publisher`](../publisher/README.md) — used internally to construct and sign kind 0, 10002, 10166 events
- [`@nostrwatch/relaymon`](../../apps/relaymon/README.md) — primary consumer; calls `AnnounceMonitor` during daemon startup
- [`@nostrwatch/nip66`](../../libraries/nip66/README.md) — NIP-66 protocol types and spec reference
- [`@nostrwatch/logger`](../logger/README.md) — logging dependency

## License

[MIT](../../LICENSE)
