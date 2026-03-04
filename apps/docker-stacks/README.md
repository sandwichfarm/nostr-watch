# nostr-watch Docker Stacks

Pre-configured Docker Compose stacks for running nostr-watch services.

## Stacks

| Stack | Description |
|-------|-------------|
| [relaymon-clearnet](./relaymon-clearnet/) | RelayMon only, clearnet mode |
| [relaymon-vpn](./relaymon-vpn/) | RelayMon behind a VPN (via Gluetun) |
| [relaymon-multinet](./relaymon-multinet/) | RelayMon with Tor + I2P proxy support |
| [trawler-relaymon-clearnet](./trawler-relaymon-clearnet/) | Trawler + RelayMon, clearnet mode |
| [trawler-relaymon-multinet](./trawler-relaymon-multinet/) | Trawler + RelayMon with Tor + I2P |

## Quick Start

1. Copy the stack directory you want to use
2. Add your `.env` and `config.yaml` files
3. Run `docker compose up -d`

Each stack directory contains its own README with specific setup instructions.

## Images

All stacks use Docker Hub images:
- `nostrwatch/relaymon:latest`
- `nostrwatch/trawler:latest`
