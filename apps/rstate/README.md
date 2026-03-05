# @nostr-watch/rstate

ContextVM relay state machine with REST API for aggregated relay intelligence.

[![npm version](https://img.shields.io/npm/v/@nostr-watch%2Frstate?style=flat-square&label=npm)](https://www.npmjs.com/package/@nostr-watch/rstate)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-node-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

Relay state aggregation engine for the nostr-watch system. Ingests [NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md) relay check events (relay monitoring events published to Nostr relays), computes aggregated scores and state across multiple independent monitors, and serves the results as a REST API. Built on the ContextVM SDK for decentralized computation with MCP-over-Nostr integration — allowing AI agents to query relay intelligence via 21 MCP tools. OpenAPI documentation is available at `/docs` when the REST API is enabled.

## Prerequisites

- Node.js >=20
- A `config.yaml` file (copy from `config.sample.yaml`)

**Environment variables** (override YAML config values):

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CVM_RELAYS` | Yes (if CVM enabled) | Comma-separated relay URLs for ContextVM transport | `wss://relay.damus.io` |
| `INGEST_RELAYS` | Yes | Comma-separated relay URLs for NIP-66 ingestion | `wss://history.nostr.watch` |
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

## Configuration

Configuration uses YAML as the primary format with environment variable overrides. Set the config file path via `CONFIG_FILE` env var or `--config` CLI flag (defaults to `config.yaml`).

Key configuration sections:

```yaml
server:
  host: 127.0.0.1
  port: 3000

cvm:
  relays:
    - wss://relay.damus.io
  nsec: 'nsec1...'

ingest:
  relays:
    - wss://history.nostr.watch

cache:
  maxSize: 10000
  ttlSeconds: 60

aggregation:
  lookbackSeconds: 21600  # 6 hours
  quorum: 0.5

logging:
  level: info
```

See `config.sample.yaml` for a complete example with all available options.

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
