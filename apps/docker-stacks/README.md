# @nostrwatch/docker-stacks

Pre-configured Docker Compose stacks for nostr-watch services.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-cli-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

A collection of Docker Compose configurations for deploying nostr-watch services. Each stack directory is self-contained with a `docker-compose.yaml`, sample configuration files, and all necessary service definitions. Stacks range from simple clearnet relay monitoring to multi-network setups that route traffic through Tor and I2P.

### How It Works

nostr-watch monitors nostr relays and publishes the results as nostr events ([NIP-66](https://github.com/nostr-protocol/nips/blob/master/66.md)). There are two core services:

- **RelayMon** — Continuously checks relays for connectivity (WebSocket open, read, NIP-11 info, DNS) and publishes the results. Supports clearnet, Tor, and I2P networks.
- **Trawler** — Crawls nostr relay lists to discover new relays and writes them to a SQLite database. When paired with RelayMon, trawler feeds discovered relays into the monitor automatically.

Each stack composes these services (and optional network proxies) into a ready-to-run deployment. You configure two things per service:

1. **`.env`** — Secrets and environment overrides (signing keys, Uptime Kuma URLs)
2. **`config.yaml`** — Application behavior (which relays to seed from, check intervals, networks to monitor)

## Prerequisites

- Docker Engine >=24
- Docker Compose v2 (the `docker compose` subcommand — not the legacy standalone `docker-compose` binary)

## Available Stacks

| Stack | Services | Description |
|-------|----------|-------------|
| [`relaymon-clearnet/`](relaymon-clearnet/) | RelayMon | Standard clearnet relay monitoring |
| [`relaymon-vpn/`](relaymon-vpn/) | RelayMon, Gluetun | Relay monitoring routed through a VPN |
| [`relaymon-multinet/`](relaymon-multinet/) | RelayMon, Tor, I2P | Multi-network monitoring (clearnet + Tor + I2P) |
| [`trawler-relaymon-clearnet/`](trawler-relaymon-clearnet/) | Trawler, RelayMon | Relay crawler and monitor on clearnet |
| [`trawler-relaymon-multinet/`](trawler-relaymon-multinet/) | Trawler, RelayMon, Tor, I2P | Relay crawler and monitor with multi-network routing |

Each stack directory contains its own README with detailed setup instructions.

## Quick Start

```sh
# 1. Choose a stack
cd apps/docker-stacks/relaymon-clearnet

# 2. Copy sample files and edit with your values
cp .env.example .env
cp config.yaml.example config.yaml

# 3. Edit .env — at minimum, set RELAYMON_NSEC
#    Edit config.yaml — set your monitor slug, owner pubkey, and seed relays

# 4. Start the stack
docker compose up -d

# 5. View logs
docker compose logs -f
```

## Configuration Reference

### Environment Variables (`.env`)

These are secrets and runtime overrides. Never commit `.env` files — only `.env.example` templates.

#### RelayMon

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAYMON_NSEC` | Yes | Signing key (nsec1... or hex) for publishing check results |
| `RELAYMON_KUMA_PUSH_URL` | No | Full Uptime Kuma push URL |
| `RELAYMON_KUMA_BASE_URL` | No | Uptime Kuma base URL (used with `RELAYMON_KUMA_TOKEN`) |
| `RELAYMON_KUMA_TOKEN` | No | Uptime Kuma push token |
| `RELAYMON_HEALTH_AUTH_TOKEN` | No | Token for authenticating health endpoint requests |

All variables support `_FILE` suffix variants for Docker/Kubernetes secrets (e.g., `RELAYMON_NSEC_FILE=/run/secrets/nsec`).

#### Trawler

| Variable | Required | Description |
|----------|----------|-------------|
| `DEAMON_PUBKEY` | No | Daemon public key for publishing relay lists |
| `DEAMON_PRIVKEY` | No | Daemon private key for signing |
| `REDIS_HOST` | No | Redis host (default: localhost) |
| `REDIS_PORT` | No | Redis port (default: 6379) |
| `REDIS_DB` | No | Redis database number (default: 0) |
| `REDIS_PASSWORD` | No | Redis password |

#### Gluetun (VPN stacks only)

See the [Gluetun wiki](https://github.com/qdm12/gluetun-wiki) for provider-specific variables. A `.env.gluetun.example` is provided in the `relaymon-vpn` stack.

### Application Config (`config.yaml`)

Controls application behavior — monitor identity, seed sources, check types, and intervals. See the `config.yaml.example` in each stack directory for a fully commented template.

Key sections:

- **`monitor`** — Your monitor's identity: slug, name, owner pubkey, and announcement relays
- **`publisher`** — Which relays receive check result events (Kind 1066, Kind 20166)
- **`relaymon.networks`** — Which networks to monitor (`clearnet`, `tor`, `i2pd`)
- **`relaymon.seed`** — How the relay list is populated (`events`, `config`, `db`)
- **`relaymon.checks`** — Which checks to run (`open`, `read`, `info`, `dns`) and their intervals/timeouts
- **`relaymon.retry`** — Backoff strategy for failed relay connections

### Docker Compose Environment (set in `docker-compose.yaml`)

These are set directly in the compose file and generally don't need changing:

| Variable | Default | Description |
|----------|---------|-------------|
| `RELAYMON_MODE` | varies | `clearnet` or `multinet` — determines proxy setup |
| `RELAYMON_CONFIG_PATH` | `/opt/config.yaml` | Path to config file inside container |
| `RELAYMON_DB_PATH` | `/opt/data/relays.db` | Path to RelayMon's SQLite database inside container |
| `RELAYMON_SKIP_PID_CHECK` | `true` | Skip PID file check (needed in containers) |
| `TRAWLER_CONFIG_PATH` | `/opt/trawler-config.yaml` | Trawler config path inside container |
| `TRAWLER_DB_PATH` | `/opt/data/trawler.db` | Trawler database path inside container |

## Data Persistence

All stacks mount `./data:/opt/data` for persistent storage. In relaymon-only stacks, the database is `relays.db`. In trawler+relaymon stacks, each service has its own database (`trawler.db` and `relaymon.db`) on the same volume to avoid SQLite locking conflicts — RelayMon reads trawler's database as a read-only seed source.

The `data/` directory is created automatically on first run.

## Multi-Network Stacks

The `multinet` stacks route relay connections through multiple overlay networks using [hedproxy](https://github.com/sandwichfarm/hedproxy):

- **Clearnet** — Direct connections (no proxy)
- **Tor** — `.onion` relay URLs routed through the `tor-proxy` container (SOCKS5 on port 9050)
- **I2P** — `.i2p` relay URLs routed through the `i2pd` container

hedproxy runs inside the RelayMon container and automatically routes traffic based on the relay URL. The proxy configuration files in `config/` (`danted.conf`, `proxychains.conf`, `torrc`) are pre-configured and generally don't need modification.

## Stopping and Cleanup

```sh
# Stop the stack
docker compose down

# Stop and remove volumes (deletes relay database)
docker compose down -v
```

## Known Limitations

- **Multinet stacks require Tor and I2P routing infrastructure:** The multinet stacks include Tor and I2P containers, but firewall and network configuration may be required depending on your host environment.
- **Images pulled from Docker Hub on first run:** All stacks use Docker Hub images (`nostrwatch/relaymon`, `nostrwatch/trawler`). An internet connection is required during the first `docker compose up`.
- **Separate databases in trawler stacks:** Trawler and RelayMon use separate SQLite databases to avoid locking conflicts. RelayMon reads trawler's database as a seed source only.

## Related Packages

- [`apps/relaymon`](../relaymon/README.md) — the relay monitoring service
- [`apps/trawler`](../trawler/README.md) — the relay crawler service

## License

[MIT](../../LICENSE)
