# @nostrwatch/trawler

Deno-based relay data crawler for the nostr-watch network.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20deno-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/trawler` crawls Nostr relays (WebSocket servers that store and forward events) to collect metadata, capabilities, and health data. It uses the `nostrawl` library as its crawling engine with SQLite for local state persistence. Configurable batch sizes, concurrency limits, and seed relay sources allow the crawl to be tuned for network conditions. Dependencies are vendored and committed, so the app runs offline after the initial clone.

## Prerequisites

- Deno >=1.40

**Environment variables** (all optional — override `config.yaml` values):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `TRAWLER_DB_PATH` | No | Override the SQLite database file path | `./data/trawler.db` |
| `TRAWLER_DB_WAL` | No | Enable WAL mode for SQLite | `true` |

## Installation

`@nostrwatch/trawler` is a Deno application — no npm install step is required. Clone the monorepo and navigate to the app directory. The `vendor/` directory is committed, so Deno dependencies are available offline.

```sh
# Ensure Deno is installed: https://deno.land
cd apps/trawler
```

## Quick Start

```sh
# Copy and edit the configuration file
cp config.yaml config.local.yaml
# Edit config.local.yaml with your seed relays and settings

# Start crawling
deno task start

# Or compile to a standalone binary
deno task compile
```

Additional tasks:

| Task | Description |
|------|-------------|
| `deno task start` | Run the trawler |
| `deno task compile` | Compile to a standalone binary in `dist/` |
| `deno task test` | Run the test suite |
| `deno task force-refresh` | Clear all caches and restart |

## Configuration

Trawler is configured via `config.yaml`. Copy the file and edit as needed:

```yaml
logLevel: info

trawler:
  db:
    path: ./trawler.db
    enableWAL: true
  relaysPerBatch: 5
  concurrency: 2
  seed:
    interval: 60000
    sources: ["config"]
    options:
      allowedNetworks: ["clearnet"]
      config:
        - 'wss://relay.nostr.watch'
```

**Key configuration options:**

| Key | Default | Description |
|-----|---------|-------------|
| `logLevel` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `trawler.db.path` | `./trawler.db` | SQLite database file path |
| `trawler.db.enableWAL` | `true` | Enable Write-Ahead Logging for better concurrent access |
| `trawler.relaysPerBatch` | `5` | Number of relays processed per crawl batch |
| `trawler.concurrency` | `2` | Maximum concurrent relay checks |
| `trawler.seed.interval` | `60000` | Seed list refresh interval in milliseconds |
| `trawler.seed.sources` | `["config"]` | Seed sources (e.g., `config`, `api`, `events`) |
| `trawler.seed.options.allowedNetworks` | `["clearnet"]` | Network types accepted from seed sources (`clearnet`, `tor`, `i2p`, `fips`) |

Environment variables `TRAWLER_DB_PATH` and `TRAWLER_DB_WAL` override the corresponding `trawler.db.*` config values.

### FIPS discovery

Trawler discovers relay URLs advertised in event kinds 2, 3, 10002, and 30002.
It accepts `ws://<npub>.fips:7777` and persists these relays with `network=fips`.
The `npub` exception applies only to a hostname ending in `.fips`, ignoring
hostname case and one trailing DNS root dot. Paths containing `npub` remain
rejected, as do non-FIPS npub hostnames and suffix lookalikes such as
`<npub>.fips.example.com`. Existing spam protections still apply.

To include FIPS addresses in initial seed sources, merge this into your config:

```yaml
trawler:
  seed:
    interval: 60000
    sources: [config]
    options:
      allowedNetworks: [clearnet, fips]
      config:
        - wss://relay.nostr.watch
        - ws://<npub>.fips:7777
```

Replace `<npub>` with the relay's public FIPS identity. A local alias such as
`relay.fips` also works when the process resolver knows that alias. Set
`TRAWLER_CONFIG_PATH` to select a config file other than `./config.yaml`.

Seed filtering applies to initial seed sources. Relay-list discovery records
all accepted network types and adds newly discovered URLs to the crawl pool
for a subsequent cycle. It can learn a FIPS address advertised on a clearnet
relay without mesh access. Actually crawling a FIPS relay requires working
`.fips` DNS resolution and IPv6 mesh routing inside Trawler's own process or
container network namespace. Trawler does not start FIPS or configure a proxy.

See the [isolated live fixture](../../docs/fips-support.md#secure-live-fixture)
and [discovery verification](../../docs/proofs/fips/discovery.md).

## Known Limitations

- **Alpha status:** Trawler is in early development. The original README noted incomplete `nostrawl` library integration; some crawl behaviors may change without notice.
- **Test tooling:** `deno task test` retains the repository's existing remote
  dependency hash and type-check failures. Run the discovery regression suite
  independently with `deno test --no-lock --no-check --unstable-sloppy-imports
  --allow-net --allow-env --allow-read --allow-write --allow-run src/`.
  The live fixture also exercises the actual entrypoint, persistence, and crawl
  scheduling. See the verification report for baseline failures.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`nostrawl`](https://github.com/sandwichfarm/nostrawl) — the crawling engine used internally by trawler
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — low-level relay check primitives
- [`@nostrwatch/db`](../../libraries/db/README.md) — database abstraction layer for SQLite persistence
- [`@nostrwatch/logger`](../../internal/logger/README.md) — structured logging
- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — NIP-66 event publishing
- [`@nostrwatch/announce`](../../internal/announce/README.md) — monitor announcement publishing

## License

[MIT](../../LICENSE)
