# RelayMon Multinet Stack

Runs RelayMon in multinet mode with Tor and I2P proxy support via hedproxy.

## Setup

1. Create `.env` with your nostr-watch environment variables
2. Create `config.yaml` with your RelayMon configuration
3. Review/edit proxy configs in `config/` if needed
4. Run:

```bash
docker compose up -d
```

## Files

- `.env` — Environment variables
- `config.yaml` — RelayMon configuration
- `config/danted.conf` — Dante SOCKS proxy configuration
- `config/proxychains.conf` — Proxychains configuration
- `config/torrc` — Tor configuration
- `data/` — Persistent data directory (created automatically)

## Architecture

- **relaymon** — Runs with `RELAYMON_MODE=multinet`, starts hedproxy internally to multiplex connections across clearnet, Tor, and I2P
- **tor-proxy** — Tor SOCKS5 proxy
- **i2pd** — I2P daemon with SAM bridge
