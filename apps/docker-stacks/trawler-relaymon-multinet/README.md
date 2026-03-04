# Trawler + RelayMon Multinet Stack

Runs Trawler and RelayMon with Tor and I2P proxy support. RelayMon uses hedproxy to multiplex connections across clearnet, Tor, and I2P. Trawler runs on the same network in clearnet mode.

## Setup

1. Create `relaymon.env` and `trawler.env` with respective environment variables
2. Create `relaymon-config.yaml` and `trawler-config.yaml` with respective configurations
3. Review/edit proxy configs in `config/` if needed
4. Run:

```bash
docker compose up -d
```

## Files

- `relaymon.env` / `trawler.env` — Environment variables for each service
- `relaymon-config.yaml` / `trawler-config.yaml` — Configuration for each service
- `config/danted.conf` — Dante SOCKS proxy configuration
- `config/proxychains.conf` — Proxychains configuration
- `config/torrc` — Tor configuration
- `data/` — Shared persistent data directory (contains relays.db)
