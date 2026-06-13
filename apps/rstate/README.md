# @nostr-watch/rstate

ContextVM relay state machine with REST API for aggregated relay intelligence.

[![npm version](https://img.shields.io/npm/v/@nostr-watch%2Frstate?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostr-watch/rstate)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

Relay state aggregation engine for the nostr-watch system. Ingests [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) relay check events (relay monitoring events published to Nostr relays) plus Trusted Relay Assertion events (kind `30385`), computes aggregated scores and state across multiple independent publishers, and serves the results as a REST API. Built on the ContextVM SDK for decentralized computation with MCP-over-Nostr integration — allowing AI agents to query relay intelligence via 21 MCP tools. OpenAPI documentation is available at `/docs` when the REST API is enabled.

## Prerequisites

- Node.js >=20
- A `config.yaml` file (copy from `config.sample.yaml`)

**Environment variables** (override YAML config values):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CVM_RELAYS` | Yes (if CVM enabled) | Comma-separated relay URLs for ContextVM transport | `wss://relay.damus.io` |
| `INGEST_RELAYS` | Yes | Comma-separated relay URLs for NIP-66 ingestion | `wss://history.nostr.watch` |
| `TRA_ENABLED` | No | Enable Trusted Relay Assertion ingestion | `true` |
| `TRA_RELAYS` | No | Comma-separated relay URLs for kind `30385` ingestion. Defaults to `INGEST_RELAYS` when omitted. | `wss://nos.lol,wss://relay.damus.io` |
| `TRA_PUBKEYS` | No | Comma-separated assertion publisher pubkeys. Empty accepts any publisher. | `ad3cdbe9...` |
| `STATE_DB_PATH` | No | Persistent state snapshot path | `/data/rstate-state.json` |
| `STATE_BACKUP_DIR` | No | Backup directory for automatic pre-migration and pre-restore backups | `/backups` |
| `STATE_BACKUP_RETENTION` | No | Maximum retained backups | `10` |
| `CVM_SERVER_NSEC` | Yes (if CVM enabled) | Server private key for signing | `nsec1...` |
| `REST_ENABLED` | No | Enable REST API | `true` |
| `REST_PORT` | No | REST API port | `3000` |
| `LOG_LEVEL` | No | Logging verbosity | `info` |

## Installation

```sh
# From monorepo root
pnpm install

# Or from app directory
cd apps/rstate
npm install
```

## Quick Start

```sh
# Copy and edit configuration
cp config.sample.yaml config.yaml
# Edit config.yaml with your relay URLs and server key

# Build and start
npm run build
npm start
```

The REST API (if enabled) is available at `http://localhost:3000`. OpenAPI documentation at `http://localhost:3000/docs`.

## API

When `REST_ENABLED=true`, the server exposes the following endpoint groups:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health/ping` | Server health with cache stats |
| `GET` | `/relays` | List relays with pagination and sorting |
| `GET` | `/relays/state` | Get state for a specific relay URL |
| `POST` | `/relays/search` | Filter relays by network, NIPs, software, labels, latency |
| `GET` | `/relays/nearby` | Find relays near coordinates (lat/lon/radius) |
| `GET` | `/relays/by/software` | Group relays by software family |
| `GET` | `/relays/by/network` | Group relays by network type (clearnet, Tor, I2P) |
| `GET` | `/relays/by/nip` | Group relays by NIP support |
| `GET` | `/relays/by/country` | Group relays by country |
| `POST` | `/relays/compare` | Side-by-side comparison of multiple relays |
| `GET` | `/monitors` | List known monitors with reliability scores |
| `GET` | `/policy` | Get current aggregation policy |
| `POST` | `/subscriptions` | Create a subscription |
| `GET` | `/subscriptions/events` | Server-Sent Events (SSE) stream for real-time updates |

Full endpoint reference is available in the OpenAPI documentation at `/docs`.

Trusted Relay Assertion data is exposed through the existing relay state objects as `trustedRelay`; no dedicated TRA endpoints are added. Full relay responses include assertion publisher attribution in `trustedRelay.contributingAuthors`. Detailed/compact relay responses retain the aggregate values but omit publisher attribution. When a relay has no assertions, `trustedRelay` contains null aggregate fields and `note: "no_trusted_relay_assertions"`.

## Configuration

Configuration uses YAML as the primary format with environment variable overrides. Set the config file path via `CONFIG_FILE` env var or `--config` CLI flag (defaults to `config.yaml`).

Key configuration sections:

```yaml
cvm:
  enabled: true
  relays:
    - wss://relay.damus.io
  serverKey: 'nsec1...'

rest:
  enabled: true
  host: 127.0.0.1
  port: 3000

ingestRelays:
  - wss://history.nostr.watch

trustedRelayAssertions:
  enabled: true
  relays:
    - wss://nos.lol
    - wss://relay.damus.io
    - wss://relay.primal.net
  pubkeys:
    - ad3cdbe9fb09b8edf7b3e0e5286d66e58b58eaa64d061bbcf3a935edf8abf421

stateDatabase:
  enabled: true
  path: /data/rstate-state.json
  backupDir: /backups
  backupRetention: 10

cache:
  maxSize: 10000
  ttlSeconds: 60

aggregation:
  quorum: 0.5
  labelQuorum: 0.3
  madScale: 3.0

log:
  enabled: true
  level: info
  destination: stdout
```

See `config.sample.yaml` for a complete example with all available options.

## State Database and Backups

rstate persists the current monitor, observation, and Trusted Relay Assertion inputs in a versioned JSON state database. On startup, schema migrations automatically create a backup in `STATE_BACKUP_DIR` before rewriting the state file. Backups are rotated to `STATE_BACKUP_RETENTION` files to avoid unbounded disk growth.

Docker Compose mounts `/data` and `/backups` as named volumes, so the state database and backups survive container replacement:

```sh
docker compose exec cvm relayvm state:backups
docker compose exec cvm relayvm state:restore /backups/<backup-file>.json
```

`state:restore` creates a pre-restore backup of the current database before replacing it with the selected backup.

## Known Limitations

- **SDK Stub Dependencies:** `sdk-stubs.ts` contains `MockRelayPool` and `MockSigner` with fake signatures — `MockSigner` returns a hardcoded `'mock_signature'` instead of real cryptographic output. Production deployments must replace these stubs with real ContextVM SDK classes (`ApplesauceRelayPool` and `PrivateKeySigner`). See [CONCERNS.md — SDK Stub Dependencies](../../.planning/codebase/CONCERNS.md#sdk-stub-dependencies).

- **Outdated Development Utilities:** `dev-tools.ts` uses `@ts-nocheck` and references the old `RelayState` structure that no longer matches the current `AggregatedValue` shape. Dev utilities cannot be reliably used for debugging current data shapes. See [CONCERNS.md — Outdated Development Utilities](../../.planning/codebase/CONCERNS.md#outdated-development-utilities).

- **Console.log in Scoring:** `monitor-scoring.ts` has unconditional `console.log` calls at lines 38, 47, and 52 that fire on every `computeAllScores()` invocation. These will spam production logs at any log level. Replace with a gated logger as a workaround. See [CONCERNS.md — Monitor Coverage Calculation Debug Logging](../../.planning/codebase/CONCERNS.md#monitor-coverage-calculation-debug-logging).

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`@nostrwatch/logger`](../../internal/logger/README.md) — structured logging used throughout rstate
- [`@nostrwatch/publisher`](../../internal/publisher/README.md) — NIP-66 event publishing utilities
- [`@nostrwatch/utils`](../../internal/utils/README.md) — shared utilities used across the monorepo

## License

[MIT](../../LICENSE)
