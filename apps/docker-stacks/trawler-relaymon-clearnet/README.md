# Trawler + RelayMon Clearnet Stack

Runs both Trawler and RelayMon in clearnet mode with a shared relay database.

## Setup

1. Create `relaymon.env` and `trawler.env` with respective environment variables
2. Create `relaymon-config.yaml` and `trawler-config.yaml` with respective configurations
3. Run:

```bash
docker compose up -d
```

## Files

- `relaymon.env` / `trawler.env` — Environment variables for each service
- `relaymon-config.yaml` / `trawler-config.yaml` — Configuration for each service
- `data/` — Shared persistent data directory (contains relays.db)
