# @nostrwatch/seed

[![Scope](https://img.shields.io/badge/scope-internal-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/seed` collects relay URLs from multiple sources to bootstrap the relay monitoring pipeline. Relay monitors (such as `@nostrwatch/relaymon`) need an initial list of relays (WebSocket servers that store and forward Nostr events) to check — seed provides that bootstrap by querying config values, static files, databases, REST APIs, and Nostr events. Results are deduplicated, sanitized, and filtered by network type (clearnet, Tor, I2P) before being handed off to the monitor.

## Prerequisites

Node.js >=20 and pnpm >=9.

## Installation

This is an internal monorepo package. Add it as a workspace dependency:

```sh
pnpm add @nostrwatch/seed --filter @nostrwatch/your-package
```

It is not published to npm.

## Quick Start

```ts
import {RelaySeeder} from '@nostrwatch/seed'

const seeder = new RelaySeeder({
  interval: 3600000, // re-seed every hour
  sources: ['config', 'static', 'api'],
  options: {
    allowedNetworks: ['clearnet'],
    config: ['wss://relay.damus.io', 'wss://nos.lol'],
    static: {path: './relays.yaml'},
    api: {rest_api: 'https://api.nostr.watch/v1'}
  }
})

await seeder.start()

const relays = seeder.getRelays()
console.log(`Seeded ${relays.length} relays`)
// Seeded 247 relays
```

## API

### `RelaySeeder`

```ts
class RelaySeeder {
  constructor(options: SeederOptions)
  start(): Promise<void>
  stop(): void
  seed(): Promise<string[]>
  getRelays(): string[]
  getLastSeedTimestamps(): Record<string, number>
}
```

**`constructor(options)`**

Creates a new seeder. Loads last seed timestamps from the database and sets up the relay block function.

**`start()`**

Runs `seed()` in a loop, waiting `interval` milliseconds between runs. Resolves only when `stop()` is called.

**`stop()`**

Signals the seeding loop to exit after the current iteration completes.

**`seed()`**

Runs all configured source strategies once, deduplicates results, sanitizes URLs, and filters by `allowedNetworks`. Returns the filtered relay list.

**`getRelays()`**

Returns the current deduplicated relay list as an array of URL strings.

**`getLastSeedTimestamps()`**

Returns a map of source name to Unix timestamp indicating when each source was last queried.

### `SeederOptions`

```ts
interface SeederOptions {
  interval: number
  sources: string[]
  options: {
    db?: {path: string; enableWAL?: boolean}
    static?: {path: string}
    config?: string[]
    api?: {rest_api: string}
    events?: {pubkeys: string[]; relays: string[]}
    allowedNetworks?: string[]
    logLevel?: LogLevel
    isRelayBlocked?: (relay: string) => boolean
  }
}
```

## Configuration

### Source types

| Source | Description |
|--------|-------------|
| `config` | Relay URLs passed directly as an array in `options.config` |
| `static` | Relay URLs read from a YAML or JSON file at `options.static.path` |
| `db` | Relay URLs queried from a SQLite database at `options.db.path` (filters by `allowedNetworks`) |
| `api` | Relay URLs fetched from a REST API at `options.api.rest_api/online` |
| `events` | Relay URLs extracted from [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) kind 30166 events published by the authors in `options.events.pubkeys`, fetched from `options.events.relays` |
| `cache` | Relay URLs queried from the local `@nostrwatch/db` relay status table |

### Network filtering

Set `allowedNetworks` to restrict which relay URLs are returned. Supported values:

- `clearnet` — standard `wss://` relay URLs
- `tor` — `.onion` relay URLs
- `i2p` — I2P relay URLs

If `allowedNetworks` is empty or omitted, the seeder defaults to `['clearnet']`.

### Custom relay blocking

Pass `isRelayBlocked` to exclude specific relays:

```ts
const seeder = new RelaySeeder({
  interval: 3600000,
  sources: ['config'],
  options: {
    allowedNetworks: ['clearnet'],
    config: ['wss://relay.damus.io'],
    isRelayBlocked: (relay) => relay.includes('blocked-relay.com')
  }
})
```

### Static seed file format

The static source expects a YAML or JSON file with a `relays` array:

```yaml
relays:
  - wss://relay.damus.io
  - wss://nos.lol
  - wss://relay.nostr.band
```

## Known Limitations

No known limitations at this time.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/relaymon`](../../apps/relaymon/README.md) — primary consumer of `RelaySeeder`; uses it to bootstrap the relay list before starting health checks
- [`@nostrwatch/db`](../../libraries/db/README.md) — provides the SQLite database that the `db` and `cache` seed sources read from
- [`@nostrwatch/utils`](../../internal/utils/README.md) — provides `parseRelayNetwork` used to detect relay network type during filtering

## License

[MIT](../../LICENSE)
