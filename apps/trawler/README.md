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
| `trawler.seed.options.allowedNetworks` | `["clearnet"]` | Network types to crawl (`clearnet`, `tor`, `i2p`) |

Environment variables `TRAWLER_DB_PATH` and `TRAWLER_DB_WAL` override the corresponding `trawler.db.*` config values.

## Known Limitations

- **Alpha status:** Trawler is in early development. The original README noted incomplete `nostrawl` library integration; some crawl behaviors may change without notice.
- **No automated test coverage:** The `deno task test` scaffold exists but test coverage is minimal. Crawl correctness relies on manual verification against known relay sets.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`nostrawl`](https://github.com/sandwichfarm/nostrawl) — the crawling engine used internally by trawler
- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — low-level relay check primitives
- [`@nostrwatch/db`](../../internal/db/README.md) — database abstraction layer for SQLite persistence
- [`@nostrwatch/logger`](../../internal/logger/README.md) — structured logging
- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — NIP-66 event publishing
- [`@nostrwatch/announce`](../../internal/announce/README.md) — monitor announcement publishing

## License

[MIT](../../LICENSE)
