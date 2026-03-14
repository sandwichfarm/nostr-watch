# Trawler + RelayMon Clearnet Stack

Runs both Trawler and RelayMon in clearnet mode with a shared relay database.

## How It Works

This stack combines two services:

- **Trawler** — Crawls nostr relay lists (Kind 10002 events) to discover new relay URLs and writes them to a shared SQLite database
- **RelayMon** — Reads the relay list from the shared database and runs connectivity checks against each relay, publishing results as nostr events

Both services mount the same `./data` volume, sharing `relays.db`. Trawler continuously discovers new relays, and RelayMon picks them up on its next seed cycle. The default `relaymon-config.yaml.example` has both `db` and `events` seed sources enabled so RelayMon reads from trawler's database as well as from 30166 events on the network.

## Setup

```bash
# 1. Copy sample configuration files
cp relaymon.env.example relaymon.env
cp relaymon-config.yaml.example relaymon-config.yaml
cp trawler-config.yaml.example trawler-config.yaml

# 2. Edit relaymon.env — set RELAYMON_NSEC
# 3. Edit relaymon-config.yaml — set monitor.slug, monitor.owner
# 4. Edit trawler-config.yaml — adjust seed relays and concurrency

# 5. Start
docker compose up -d

# 6. View logs
docker compose logs -f
```

## Files

| File | Purpose |
|------|---------|
| `relaymon.env.example` | Sample RelayMon environment variables — copy to `relaymon.env` |
| `trawler.env.example` | Sample Trawler environment variables (see notes) |
| `relaymon-config.yaml.example` | Sample RelayMon config — copy to `relaymon-config.yaml` |
| `trawler-config.yaml.example` | Sample Trawler config — copy to `trawler-config.yaml` |
| `docker-compose.yaml` | Docker Compose service definition |
| `data/` | Shared persistent data directory (created automatically) |

## Configuration

### `relaymon.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAYMON_NSEC` | Yes | Signing key (nsec1... or hex) for publishing events |
| `RELAYMON_KUMA_PUSH_URL` | No | Uptime Kuma push URL for health monitoring |
| `RELAYMON_HEALTH_AUTH_TOKEN` | No | Auth token for the health HTTP endpoint |

### `trawler.env` (optional)

The default `docker-compose.yaml` does not mount a trawler `.env` file. If you need to set trawler environment variables (daemon keys, Redis connection), copy `trawler.env.example` to `trawler.env` and add an `env_file` entry to the trawler service in `docker-compose.yaml`.

### `relaymon-config.yaml` / `trawler-config.yaml`

See the `.example` files for fully commented templates. The relaymon config in this stack is pre-configured to seed from both the shared database and network events.
