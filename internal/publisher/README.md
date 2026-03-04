# @nostrwatch/publisher

Library for publishing nostr.watch relay status and monitor registration events.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/publisher` builds and publishes [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) relay monitoring events (a Nostr Implementation Possibility that standardizes how relay monitors announce themselves and publish relay health data). It implements the **adapter pattern**: a base `Publisher` class handles transport (connecting to relays and calling `pool.publish`), while event-kind classes — `Kind0`, `Kind10002`, `Kind10166`, `Kind30166` — each know how to assemble one specific event type from raw check data. Callers never construct raw Nostr events (signed JSON objects that are the fundamental unit of the Nostr protocol) by hand; they instantiate the appropriate kind class, call `generateEvent()`, then `signEvent()`, then hand the signed event to `Publisher`.

The primary consumer is [`@nostrwatch/announce`](../announce/README.md), which calls this package during app boot to declare a monitor's capabilities and relay list to the network.

## Prerequisites

Node.js >=14 and pnpm >=9.

**Peer dependency:** `nostr-tools@2.11.0` must be installed in the consuming package.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/publisher --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import {Publisher, Kind30166} from '@nostrwatch/publisher'

const pubkey = 'abc123...' // 64-char hex public key
const relays = ['wss://relay.damus.io', 'wss://nos.lol']
const sk = 'deadbeef...' // 64-char hex secret key

// Build a kind 30166 relay status event from nocap check results
const $kind = new Kind30166(pubkey)
$kind.generateEvent({
  url: 'wss://relay.damus.io',
  open: {duration: 120},
  info: {data: {supported_nips: [1, 11, 42]}}
})
const signed = await $kind.signEvent(sk)

// Publish to one or more relays
const publisher = new Publisher(pubkey, relays)
await publisher.publishEvent(signed)
```

## API

### `Publisher`

```ts
class Publisher {
  constructor(pubkey: string, relays: string[], config?: Config)
  publishEvent(signedEvent: NostrEvent): Promise<any>
  publishEvents(signedEvents: AsyncIterable<NostrEvent>): Promise<any[]>
}
```

**`constructor(pubkey, relays, config?)`**

Creates a publisher scoped to `pubkey`. All events published by this instance are sent to the `relays` array via a `nostr-tools` `SimplePool`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pubkey` | `string` | 64-char hex public key of the signing identity |
| `relays` | `string[]` | WebSocket relay URLs to publish to |
| `config` | `Config` | Optional — unused in current implementation |

**`publishEvent(signedEvent)`**

Publishes one signed Nostr event to all configured relays using `Promise.any`. Resolves as soon as any one relay accepts the event. Throws if all relays reject.

**`publishEvents(signedEvents)`**

Publishes each event in the async iterable in sequence. Returns an array of results, one per event.

---

### `Event`

```ts
class Event {
  constructor(kind: number, pubkey: string)
  generateEvent(data: any): NostrEvent
  signEvent(sk: string): Promise<SignedEvent>
}
```

Base class for all event-kind classes. Subclass it to implement a new event type — override `_generateEvent(data)` to assemble the `tags` and `content` fields.

**`generateEvent(data)`**

Calls `_generateEvent(data)` internally and stores the result. Must be called before `signEvent`.

**`signEvent(sk)`**

Signs the event using the 64-char hex secret key `sk`. Calls `finalizeEvent` and `verifyEvent` from `nostr-tools`. Resolves with the signed event object. Throws if `generateEvent` has not been called first or if signature verification fails.

---

### Event Kinds

All kind classes extend `Event` and accept `pubkey: string` in their constructor.

#### `Kind0` — NIP-01 user metadata

```ts
class Kind0 extends Event {
  generateEvent(data: object): NostrEvent
  static generateContent(data: object): string
  static parse(event: {content: string}): any
}
```

Publishes a kind 0 user metadata event (NIP-01 profile). `data` is a profile object (e.g., `{name, about, picture}`). Used by `@nostrwatch/announce` to publish a monitor's profile.

#### `Kind10002` — NIP-65 relay list

```ts
class Kind10002 extends Event {
  generateEvent(relays: string[]): NostrEvent
  static generateTags(relays: string[]): NostrEventTags
  parse(event: NostrEvent): {relays: string[]}
}
```

Publishes a [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) relay list event (kind 10002). `relays` is an array of WebSocket relay URLs. Used to announce which relays a monitor publishes to.

#### `Kind10166` — NIP-66 monitor registration

```ts
class Kind10166 extends Event {
  generateEvent(data: Kind10166Data): NostrEvent
  static generateTags(data: Kind10166Data): NostrEventTags
}
```

Publishes a kind 10166 monitor announcement event per [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md). Encodes the monitor's `frequency`, `networks`, `checks`, `timeouts`, and `geo` metadata as NIP-66 tags.

#### `Kind30166` — NIP-66 relay status

```ts
class Kind30166 extends Event {
  generateEvent(check: CheckData): NostrEvent
  generateTags(check: CheckData): NostrEventTags
}
```

Publishes a kind 30166 relay status event per [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md). The `check` parameter is a `CheckData` object assembled from nocap check results. It maps relay health data — RTT timings, NIP-11 info, SSL validity, DNS records, geo data — into the NIP-66 event tag structure.

---

### Builder helpers

```ts
function buildBaseEvent(opts: BaseEventOptions): UnsignedEvent
function relayTag(url: string): string[]
function statusTag(status: string): string[]
function rttOpenTag(ms: number): string[]
```

Low-level helpers for constructing NIP-66 event fields manually. Used internally by the kind classes. `buildBaseEvent` is the recommended starting point for custom event kinds not covered by the built-in classes.

## Configuration

The `Publisher` constructor accepts a `Config` object as a third argument. No configuration properties are currently active — the pool uses its defaults. Pass an empty object or omit `config` entirely.

## Known Limitations

- **Unfinished language tag validation:** Language tag validation in `Kind30166` is not implemented. Invalid ISO-639-1 language tags sourced from a relay's NIP-11 `language_tags` field may be published in kind 30166 events without transformation or rejection. Relays with malformed language tags will produce non-conforming NIP-66 events. No workaround is available at this time. See [CONCERNS.md — Unfinished Language Tag Validation](../../.planning/codebase/CONCERNS.md).

- **Console.log in production code:** `Publisher.ts`, `Event.ts`, and `Kind30166.ts` contain unconditional `console.log`, `console.warn`, and `console.error` calls for error paths and publish failures. These emit to stdout in production. See [CONCERNS.md — Console.log Statements in Production Code](../../.planning/codebase/CONCERNS.md).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/announce`](../announce/README.md) — primary consumer; calls publisher during monitor boot to publish kind 0, 10002, and 10166 events
- [`@nostrwatch/nip66`](../../libraries/nip66/README.md) — NIP-66 protocol types and spec reference
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — produces the `CheckData` objects that `Kind30166` consumes
- [`@nostrwatch/logger`](../logger/README.md) — logging dependency used by Publisher

## License

[MIT](../../LICENSE)
