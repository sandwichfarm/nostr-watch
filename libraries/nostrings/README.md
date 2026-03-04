# @nostrwatch/nostrings

Relay URL sanitization, validation, normalization, and deduplication for the Nostr protocol.

[![npm version](https://img.shields.io/npm/v/@nostrwatch/nostrings?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostrwatch/nostrings)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20browser-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/nostrings` cleans, validates, normalizes, and deduplicates relay URLs for the Nostr protocol. A relay is a WebSocket server that stores and forwards Nostr events; relay URLs must conform to `wss://` or `ws://` format and must not point to local or reserved IP ranges. This library provides four composable operations — sanitize, qualify, normalize, and dedup — that handle messy real-world relay URL inputs from user input, scraped lists, and network data.

The `sanitize` function runs all four operations in a single call and is the recommended entry point for most use cases.

## Installation

```sh
pnpm add @nostrwatch/nostrings
```

Or with npm:

```sh
npm install @nostrwatch/nostrings
```

## Quick Start

```ts
import {sanitize, normalize} from '@nostrwatch/nostrings'

const raw = [
  '  WSS://RELAY.DAMUS.IO/#fragment  ',
  'wss://nos.lol',
  'ws://localhost',
  'wss://nos.lol'
]

const clean = sanitize(raw)
console.log(clean)
// ['wss://relay.damus.io/', 'wss://nos.lol/']
```

## API

### `sanitize(relays, rules?)`

```ts
sanitize(relays: string[], rules?: RuleSet): string[] | void
```

Runs the full pipeline on an array of relay URLs: splits comma-separated entries, sanitizes each URL, filters with `qualifyRelayUrl`, applies optional custom discriminators and mutators, normalizes, and deduplicates. Returns the cleaned array, or `void` if the input is empty.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relays` | `string[]` | Raw relay URLs to process |
| `rules` | `RuleSet` (optional) | Custom discriminators (filter functions) and mutators (transform functions) |

### `qualify(relay)`

```ts
qualifyRelayUrl(relay: string): boolean
```

Returns `true` if the URL passes all qualification checks: starts with `wss://` or `ws://`, is not a local or reserved IP, is not localhost, and has no embedded protocol strings. Returns `false` otherwise. Uses a pessimistic invalidation pattern — any failure disqualifies the URL.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relay` | `string` | A single relay URL string |

### `normalize(relay)`

```ts
normalizeRelayUrl(relay: string): string
```

Strips the `hash`, `search`, and `username` components from a relay URL using the browser-native `URL` API. Returns the canonical form, or an empty string if the URL cannot be parsed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relay` | `string` | A single relay URL string |

### `dedup(relays)`

```ts
dedup(relays: string[]): string[]
```

Removes duplicate URLs from an array using a `Set`. Returns a new array with unique entries only.

| Parameter | Type | Description |
|-----------|------|-------------|
| `relays` | `string[]` | Array of relay URLs, possibly with duplicates |

### Additional exports

- `sanitizeRelayUrl(relay: string): string` — sanitizes a single URL (lowercase, trim, remove fragments, trailing slashes, and blob hashes)
- `maybeSplitRelayList(relays: string[]): string[]` — splits comma-separated relay strings into individual entries
- `normalizeRelayUrls(relays: string[]): string[]` — normalizes an array of relay URLs
- `normalizeRelayUrlAcc(acc: string[], relay: string): string[]` — reducer form of `normalizeRelayUrl` for use with `Array.reduce`
- `isLocal(url: string): boolean` — returns `true` if the URL is a local file path or network path
- `isLocalNet(url: string): boolean` — returns `true` if the URL hostname is in a reserved IP range (127.x, 10.x, 192.168.x, 172.16-31.x)

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../nocap/README.md) — relay capability checker that uses nostrings for URL validation before connecting
- [`@nostrwatch/route66`](../route66/README.md) — relay aggregation and state management; passes relay URLs through nostrings before storage

## License

[MIT](../../LICENSE)
