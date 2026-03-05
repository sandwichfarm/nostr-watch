# @nostrwatch/docker-stacks

Pre-configured Docker Compose stacks for nostr-watch services.

[![Scope](https://img.shields.io/badge/scope-app-lightgrey?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![License](https://img.shields.io/github/license/sandwichfarm/nostr-watch?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)
[![Runtime](https://img.shields.io/badge/runtime-cli-blue?style=flat-square)](https://github.com/sandwichfarm/nostr-watch)

## Overview

A collection of Docker Compose configurations for deploying nostr-watch services. Each stack directory is self-contained with a `docker-compose.yml` and all necessary service definitions. Stacks range from simple clearnet relay monitoring to multi-network setups that route traffic through Tor and I2P via Gluetun VPN.

## Prerequisites

- Docker Engine >=24
- Docker Compose v2 (the `docker compose` subcommand — not the legacy standalone `docker-compose` binary)

## Installation

No package manager installation is needed. Clone the monorepo and navigate to the stack directory you want to deploy.

```sh
cd apps/docker-stacks
ls  # View available stacks
```

## Quick Start

```sh
# Choose a stack (example: relaymon-clearnet)
cd apps/docker-stacks/relaymon-clearnet

# Configure environment and application settings
cp .env.example .env
# Edit .env with your keys and network settings

cp config.yaml.example config.yaml
# Edit config.yaml with your monitor configuration

# Start the stack
docker compose up -d

# View logs
docker compose logs -f
```

## Available Stacks

| Stack | Services | Description |
|-------|----------|-------------|
| `relaymon-clearnet/` | RelayMon | Standard clearnet relay monitoring |
| `relaymon-vpn/` | RelayMon, Gluetun | Relay monitoring routed through a VPN |
| `relaymon-multinet/` | RelayMon, Tor, I2P | Multi-network monitoring (clearnet + Tor + I2P) |
| `trawler-relaymon-clearnet/` | Trawler, RelayMon | Relay crawler and monitor on clearnet |
| `trawler-relaymon-multinet/` | Trawler, RelayMon, Tor, I2P | Relay crawler and monitor with multi-network routing |

Each stack directory contains its own README with detailed configuration instructions.

## Configuration

Each stack is configured through two files in the stack directory:

- `.env` — Docker environment variables (nsec keys, ports, network settings)
- `config.yaml` — Application-level configuration (monitor slug, relay lists, check types)

Copy the example files and edit them before running `docker compose up`:

```sh
cp .env.example .env
cp config.yaml.example config.yaml
```

## Known Limitations

- **Multinet stacks require Tor and I2P routing infrastructure:** The `relaymon-multinet` and `trawler-relaymon-multinet` stacks route traffic through Tor and I2P via Gluetun. Firewall and network configuration may be required depending on your host environment.
- **Images pulled from Docker Hub on first run:** All stacks use Docker Hub images (`nostrwatch/relaymon`, `nostrwatch/trawler`). An internet connection is required during the first `docker compose up` to pull the images.

## Agent Skills

No agent skills defined yet for this package.

## Related Packages

- [`apps/relaymon`](../relaymon/README.md) — the primary relay monitoring service deployed by these stacks
- [`apps/trawler`](../trawler/README.md) — the relay crawler service deployed by the trawler stacks

## License

[MIT](../../LICENSE)
