# RelayMon VPN Stack

Runs RelayMon in clearnet mode, routed through a VPN via [Gluetun](https://github.com/qdm12/gluetun).

## Setup

1. Create `.env` with your nostr-watch environment variables
2. Create `config.yaml` with your RelayMon configuration
3. Create `.env.gluetun` with your VPN provider credentials (see [Gluetun docs](https://github.com/qdm12/gluetun-wiki))
4. Run:

```bash
docker compose up -d
```

## Files

- `.env` — Environment variables
- `.env.gluetun` — VPN provider configuration
- `config.yaml` — RelayMon configuration
- `data/` — Persistent data directory (created automatically)

## VPN Providers

By default this stack uses Mullvad. Change `VPN_SERVICE_PROVIDER` in `docker-compose.yaml` and set the appropriate variables in `.env.gluetun` for your provider.
