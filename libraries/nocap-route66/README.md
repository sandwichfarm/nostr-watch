# @nostrwatch/nocap-route66

Transforms nocap relay check results into NIP-66 Nostr events.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/nocap-route66?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/nocap-route66)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/nocap-route66` converts the structured check results produced by `@nostrwatch/nocap` into [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) Nostr events (a protocol for relay monitoring using signed, verifiable event records). It acts as a bridge between the nocap capability-checking system and the NIP-66 relay monitoring protocol, producing kind 30166 (relay status) and kind 10166 (monitor announcement) events.

For new projects, `@nostrwatch/publisher` (internal) has superseded this package's role. It provides a more complete and maintained implementation of the same event-building functionality. This package remains available for projects that depend on it.

## Installation

```sh
pnpm add @nostrwatch/nocap-route66
```

Or with npm:

```sh
npm install @nostrwatch/nocap-route66
```

## Quick Start

```ts
import {Kind30166} from '@nostrwatch/nocap-route66'
import Nocap from '@nostrwatch/nocap'
import {WebsocketAdapterDefault} from '@nostrwatch/nocap/adapters/default'

const nocap = new Nocap('wss://relay.damus.io')
await nocap.useAdapters([WebsocketAdapterDefault])
const checkResult = await nocap.check(['open', 'read', 'write'])

const builder = new Kind30166('your-hex-pubkey')
const event = builder.generateEvent(checkResult)
console.log(event)
// { id: '...', kind: 30166, tags: [['d', 'wss://relay.damus.io'], ...], content: '{}' }
```

## API

### `Transform`

Abstract base class for all event builders. Extend this class to build a new NIP-66 event kind.

```ts
abstract class Transform {
  constructor(kind: number, pubkey: string)
  generateEvent(data: IResult): any
  json(): any
  dedupLabels(tags: string[][]): string[][]
  removeLabels(tags: string[][]): string[][]
  abstract generateTags(check: IResult): string[][]
}
```

**`constructor(kind, pubkey)`**

Initializes the event builder for a given Nostr event kind and monitor pubkey. Both `kind` and `pubkey` are required; an error is thrown if either is missing.

**`generateEvent(data)`**

Builds a complete Nostr event object from a nocap `IResult` check result. Computes and sets the `id` field using `getEventHash`. Returns the event object.

**`json()`**

Returns the last event object produced by `generateEvent()`.

**`dedupLabels(tags)`**

Removes duplicate label tags (`L` and `l`) from a tag array. Label namespaces are deduplicated by key; label values within a namespace are deduplicated by value.

**`removeLabels(tags)`**

Filters out all `L` and `l` label tags from a tag array.

### `Kind30166`

Builds a kind 30166 relay status event (NIP-66 parameterized replaceable event, one per relay URL).

```ts
class Kind30166 extends Transform {
  constructor(pubkey: string)
  generateTags(check: IResult): string[][]
}
```

**`constructor(pubkey)`**

Creates a Kind30166 builder for the given monitor pubkey.

**`generateTags(check)`**

Generates the full NIP-66 tag set from a nocap check result. Tags produced include:

| Tag | Value example | Source |
|-----|---------------|--------|
| `d` | `wss://relay.damus.io` | `check.url` — relay URL (addressable identifier) |
| `rtt-open` | `120` | Round-trip time in ms for the `open` check |
| `rtt-read` | `95` | Round-trip time in ms for the `read` check |
| `rtt-write` | `110` | Round-trip time in ms for the `write` check |
| `n` | `clearnet` | Network type from `check.network` |
| `N` | `1` | Supported NIP numbers from NIP-11 info |
| `p` | `abc123...` | Relay operator pubkey from NIP-11 info |
| `R` | `ssl` | SSL validity flag (`ssl` or `!ssl`) |
| `R` | `!auth` | Auth requirement flag from NIP-11 limitation |
| `s` | `strfry` | Relay software from NIP-11 info |
| `l` | `1.2.3.4` | DNS-resolved IPv4 address |

### `Kind10166`

Builds a kind 10166 monitor announcement event (NIP-66 replaceable event declaring monitor capabilities and configuration). This class is implemented in source but not exported from the main package index.

```ts
class Kind10166 extends Transform {
  constructor(pubkey: string)
  generateTags(data: MonitorData): string[][]
}
```

Tags produced by `Kind10166.generateTags()` include `frequency`, `k` (event kinds), `n` (network counts), `c` (check types), and `timeout` entries.

## Known Limitations

- **Superseded by `@nostrwatch/publisher`:** For new projects, use `internal/publisher` instead. The publisher package provides a more complete and actively maintained implementation of NIP-66 event building, including language tag validation and additional event kinds. This package receives no further feature development.

- **Kind0 not implemented:** The `Kind0` event builder (kind 0 metadata events) is present in source as a fully commented-out stub and produces no output. No workaround is available.

- **`Kind10166` not exported:** The `Kind10166` monitor announcement builder is implemented but not exported from the package index. Import it directly from the build output if needed, or use `internal/publisher` for full NIP-66 event support.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../nocap/README.md) — provides the `IResult` check output that this package transforms into events
- [`internal/publisher`](../../internal/publisher/README.md) — supersedes this package; provides complete NIP-66 event building for new projects
- [`@nostrwatch/nip66`](../nip66/README.md) — NIP-66 protocol reference for relay monitoring event kinds and tags
- [`@nostrwatch/route66`](../route66/README.md) — relay state management; consumes NIP-66 events produced by event builders

## License

[MIT](../../LICENSE)
