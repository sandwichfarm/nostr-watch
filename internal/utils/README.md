# @nostrwatch/utils

Shared utility functions used across the nostr-watch monorepo.

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](../../LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/utils` provides a collection of utility modules shared across the monorepo. It covers key management and conversion (nsec/hex), array helpers, environment file access, event signing, browser/runtime detection, URL parsing and normalization, string helpers, object utilities, control flow helpers, and network utilities. Each module is independently importable — import only what you need. The package builds for both Node.js and browser environments.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/utils --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import {nsecToHex, tryNsecToHex} from '@nostrwatch/utils'
import {shuffleArray, chunkArray} from '@nostrwatch/utils'
import {isBrowser} from '@nostrwatch/utils'

// Convert an nsec private key to hex (throws on invalid input)
const hexKey = nsecToHex('nsec1...')

// Safe version — returns empty string on failure
const safeHex = tryNsecToHex(process.env.NOSTR_KEY)

// Shuffle an array in place, then split into chunks of 10
const relays = ['wss://relay.damus.io', 'wss://nos.lol']
chunkArray(relays, 10) // => [['wss://relay.damus.io', 'wss://nos.lol']]

// Detect runtime environment
if (isBrowser()) {
  console.log('running in browser')
}
```

## API

The package exports roughly 15 modules. The most commonly used are:

### Keys (`keys.ts`)

```ts
function nsecToBytes(key: string): Uint8Array
function nsecToHex(key: string): string
function tryNsecToHex(key: string | undefined): string
```

Converts Nostr private keys between formats. Accepts `nsec1…` bech32 strings or 64-character hex strings. `nsecToBytes` and `nsecToHex` throw `Error` on invalid input; `tryNsecToHex` returns an empty string instead of throwing — use this when reading from environment variables.

### Signing (`signing.ts`)

```ts
interface EventSigner {
  pubkey: string
  sign(event: UnsignedEvent): VerifiedEvent
}

function createSigner(key: string): EventSigner
```

Creates an `EventSigner` from an nsec or hex private key. The returned signer holds the derived public key and can sign any unsigned Nostr event (a signed JSON object — the fundamental unit of the Nostr protocol). Internally wraps `nostr-tools/pure`.

### Arrays (`array.ts`)

```ts
function shuffleArray<T>(array: T[]): void
function chunkArray<T>(arr: T[], chunkSize: number): T[][]
```

`shuffleArray` shuffles an array in place using Fisher-Yates. `chunkArray` shuffles the array first, then splits it into chunks of the given size. Throws if `chunkSize <= 0`.

### URL (`url.ts`)

```ts
function parseUrl(url: string): URL | null
function normalizeUrl(url: string): string
```

`parseUrl` wraps the `URL` constructor and returns `null` on invalid input instead of throwing. `normalizeUrl` returns the canonical string form of a URL, or the original input if parsing fails.

### Browser detection (`browser.ts`)

```ts
function isBrowser(): boolean
```

Returns `true` when running in a browser or Web Worker context. Correctly identifies Node.js, Deno, and browser environments. Safe to call in any context.

For the full export list, see [`src/index.ts`](src/index.ts).

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/logger`](../logger/README.md) — logger package that re-exports utilities from this package
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — relay connection library that consumes key and URL utilities
- [`@nostrwatch/route66`](../../libraries/route66/README.md) — relay monitoring library that consumes array and URL utilities

## License

[MIT](../../LICENSE)
