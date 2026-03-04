# RelayMon Clearnet Stack

Runs RelayMon in clearnet mode (direct connections, no proxy).

## Setup

1. Create `.env` with your nostr-watch environment variables
2. Create `config.yaml` with your RelayMon configuration
3. Run:

```bash
docker compose up -d
```

## Files

- `.env` — Environment variables
- `config.yaml` — RelayMon configuration
- `data/` — Persistent data directory (created automatically)
