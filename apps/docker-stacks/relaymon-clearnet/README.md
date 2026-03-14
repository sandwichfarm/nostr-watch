# RelayMon Clearnet Stack

Runs RelayMon in clearnet mode — direct connections to relays with no proxy or VPN.

## How It Works

RelayMon connects directly to nostr relays over the public internet, runs connectivity checks (WebSocket open, read, NIP-11 info, DNS), and publishes the results as nostr events. This is the simplest stack — a single container with no network routing.

## Setup

```bash
# 1. Copy sample configuration files
cp .env.example .env
cp config.yaml.example config.yaml

# 2. Edit .env — set RELAYMON_NSEC (your signing key)
# 3. Edit config.yaml — set monitor.slug, monitor.owner, and seed sources

# 4. Start
docker compose up -d

# 5. View logs
docker compose logs -f relaymon
```

## Files

| File | Purpose |
|------|---------|
| `.env.example` | Sample environment variables — copy to `.env` |
| `config.yaml.example` | Sample application config — copy to `config.yaml` |
| `docker-compose.yaml` | Docker Compose service definition |
| `data/` | Persistent data directory (created automatically) |

## Configuration

### `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAYMON_NSEC` | Yes | Signing key (nsec1... or hex) for publishing events |
| `RELAYMON_KUMA_PUSH_URL` | No | Uptime Kuma push URL for health monitoring |
| `RELAYMON_HEALTH_AUTH_TOKEN` | No | Auth token for the health HTTP endpoint |

### `config.yaml`

See `config.yaml.example` for a fully commented template. Key settings to customize:

- **`monitor.slug`** — Unique identifier for your monitor instance
- **`monitor.owner`** — Your nostr public key (hex format)
- **`relaymon.seed`** — Where to get the list of relays to monitor
- **`relaymon.checks`** — Which checks to run and how often
