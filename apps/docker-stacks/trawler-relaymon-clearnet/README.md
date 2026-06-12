# Trawler + RelayMon Clearnet Stack

Runs both Trawler and RelayMon in clearnet mode with separate databases.

## How It Works

This stack combines two services:

- **Trawler** — Crawls nostr relay lists (Kind 10002 events) to discover new relay URLs and writes them to its own SQLite database (`trawler.db`)
- **RelayMon** — Maintains its own database (`relaymon.db`) for check state, seeds its relay list by reading from trawler's database as a read-only source, and can optionally publish Trusted Relay Assertions (kind `30385`)

Both services mount the same `./data` volume so RelayMon can read trawler's database, but each service writes to its own database file to avoid SQLite locking conflicts. Trawler continuously discovers new relays, and RelayMon picks them up on its next seed cycle via the `db` seed source.

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
| `data/` | Persistent data directory containing both databases (created automatically) |

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

See the `.example` files for fully commented templates. Key points:

- Trawler writes to `/opt/data/trawler.db`
- RelayMon writes to `/opt/data/relaymon.db`
- RelayMon's `seed.options.db.path` points to `/opt/data/trawler.db` (read-only seed source)
- Set `relaymon.trustedRelayAssertions.enabled` to `true` to publish optional kind `30385` trust assertions

### Database Architecture

```
./data/
├── trawler.db      # Written by trawler, read by relaymon (seed source)
└── relaymon.db     # Written and read by relaymon (check state)
```

SQLite does not handle concurrent writers well, so each service has its own database. RelayMon reads trawler's database only during seed cycles to import discovered relay URLs.
