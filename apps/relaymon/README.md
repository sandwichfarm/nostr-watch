# @nostrwatch/relaymon

Deno-based relay health monitor with NIP-66 event publishing.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node%20%7C%20deno-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

`@nostrwatch/relaymon` monitors Nostr relay (WebSocket server) health through automated check cycles. It runs configurable check suites — DNS, connectivity, SSL, info document retrieval, and geo-location — against a seeded relay list, then publishes results as [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) relay status events to the Nostr network. Relays are discovered from multiple seed sources including static configuration, API endpoints, and existing NIP-66 events. Supports clearnet, Tor (`.onion`), and I2P (`.i2p`) relay monitoring via configurable network routing.

## Prerequisites

- Deno >=1.40
- SQLite is created automatically at the path specified in `config.yaml`

**Environment variables:**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RELAYMON_NSEC` | Yes | Private key for signing NIP-66 events and monitor announcements | `nsec1...` |

## Installation

`@nostrwatch/relaymon` is a Deno application — no npm install step is required. Clone the monorepo and navigate to the app directory.

```sh
# Ensure Deno is installed: https://deno.land
cd apps/relaymon
```

## Quick Start

```sh
# Copy and edit the configuration file
cp config.sample.yaml config.yaml
# Edit config.yaml: set monitor.slug, publisher.relays, and relaymon network options

# Start monitoring
RELAYMON_NSEC=nsec1... deno task start
```

Additional tasks:

| Task | Description |
|------|-------------|
| `deno task start` | Start the monitoring loop |
| `deno task interactive` | Launch the interactive CLI |
| `deno task status` | Print a status report |
| `deno task dbcheck` | Run the database integrity check utility |
| `deno task compile:linux-x64` | Compile a standalone binary for Linux (x64) |

## Docker

Relaymon ships two Docker image variants:

| Image | Description |
|-------|-------------|
| `nostrwatch/relaymon:clearnet` | Monitors clearnet relays only |
| `nostrwatch/relaymon:multinet` | Monitors clearnet, Tor (`.onion`), and I2P (`.i2p`) via Gluetun routing |
| `nostrwatch/relaymon:latest` | Alias for `clearnet` |

Production Docker Compose configurations are available in [`apps/docker-stacks`](../docker-stacks/README.md).

```sh
# Clearnet (from Docker Hub)
docker compose -f apps/relaymon/.docker/docker-compose.yml up -d

# Multinet (from Docker Hub)
docker compose -f apps/relaymon/.docker/docker-compose.multinet.yml up -d
```

The multinet variant includes supplementary containers for network routing:

- `tor-proxy` — Tor SOCKS proxy for `.onion` addresses
- `i2pd` — I2P router for `.i2p` addresses

Traffic is routed transparently based on domain type with no application code changes needed.

## Configuration

Relaymon is configured via `config.yaml`. Copy `config.sample.yaml` as a starting point.

```yaml
monitor:
  slug: tor-i2p-clearnet-monitor
  info:
    name: "tor i2p clearnet relay monitor"
    about: ""
    nip05: ""
  owner: ""
  geo:
    city: "Frankfurt am Main"
    country: "Germany"
    countryCode: "DE"
    lat: 50.1169
    lon: 8.6821
    region: "Hesse"
    continent: "Europe"

publisher:
  relays:
    - "wss://relay.nostr.watch"
    - "wss://relaypag.es"

relaymon:
  networks:
    - clearnet
    - tor
    - i2p
  retry:
    expiry:
      - { max: 3, delay: "1m" }
      - { max: 5, delay: "20m" }
      - { max: 7, delay: "1h" }
      - { max: 22, delay: "24h" }
      - { max: 107, delay: "7d" }
  seed:
    interval: "1m"
    sources:
      - config
      - static
      - api
      - events
      - db
    options:
      db:
        path: "./relay.db"
        enableWAL: true
      static:
        path: "./seed.yaml"
      api:
        remote: ""
  checks:
    enabled:
      - open
      - read
    options:
      expires: "6h"
      interval: "5m"
      timeout:
        open: 30000
        read: 5000
      max: "100"
      statusInterval: 20

queue:
  workerConcurrency: 10
```

**Key configuration sections:**

| Key | Description |
|-----|-------------|
| `monitor.slug` | Unique identifier for this monitor instance |
| `publisher.relays` | Array of relay URLs for publishing NIP-66 events |
| `relaymon.networks` | Network types to monitor: `clearnet`, `tor`, `i2p` |
| `relaymon.retry.expiry` | Stepped retry backoff rules (max retries + delay per step) |
| `relaymon.seed.sources` | Where to discover relays: `config`, `static`, `api`, `events`, `db` |
| `relaymon.checks.enabled` | Which check types to run (e.g., `open`, `read`) |
| `queue.workerConcurrency` | Maximum parallel relay checks |

## Known Limitations

- **Relay URL filtering with pipe character:** `daemon.ts` (lines 234–239) logs relay URLs containing the `|` character but does not properly clean or reject them. This is a hotfix-level workaround for a structural URL validation gap at ingestion. As a workaround, remove malformed relay entries from the database directly via the SQLite CLI. See [CONCERNS.md — Relay URL Filtering with Pipe Character](.planning/codebase/CONCERNS.md#known-bugs).

- **Database inspection function incomplete:** `interactive/index.ts` (lines 31–88) has a `debugInspectDatabase` function that logs start and end markers but contains no actual SQL inspection queries — they are missing or commented out. Use the SQLite CLI directly to inspect the database. See [CONCERNS.md — Database Inspection Function Incomplete](.planning/codebase/CONCERNS.md#known-bugs).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/nocap`](../../libraries/nocap/README.md) — relay check primitives used for all health checks
- [`@nostrwatch/db`](../../internal/db/README.md) — SQLite database abstraction layer
- [`@nostrwatch/logger`](../../internal/logger/README.md) — structured logging
- [`@nostrwatch/announce`](../../internal/announce/README.md) — monitor profile and relay list announcement
- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — NIP-66 event publishing
- [`apps/docker-stacks`](../docker-stacks/README.md) — pre-configured Docker Compose stacks for relaymon

## License

[MIT](../../LICENSE)
