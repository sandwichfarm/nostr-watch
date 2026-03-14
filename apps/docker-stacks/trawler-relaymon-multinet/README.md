# Trawler + RelayMon Multinet Stack

Runs Trawler and RelayMon with Tor and I2P proxy support. RelayMon uses [hedproxy](https://github.com/sandwichfarm/hedproxy) to multiplex connections across clearnet, Tor, and I2P. Trawler runs on the same network in clearnet mode.

## How It Works

This stack runs four containers on a shared Docker bridge network (`relaymon-net`):

- **Trawler** — Crawls relay lists over clearnet to discover new relays, writes them to the shared SQLite database
- **RelayMon** — Runs in `multinet` mode, monitoring relays across all three networks. hedproxy routes connections based on URL scheme (`.onion` to Tor, `.i2p` to I2P, everything else direct)
- **tor-proxy** — Tor daemon exposing SOCKS5 on port 9050
- **i2pd** — I2P daemon with SAM bridge

Trawler and RelayMon share the `./data` volume so discovered relays are immediately available for monitoring.

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

# 6. Wait for Tor and I2P to establish circuits
docker compose logs -f tor-proxy i2pd

# 7. View all logs
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
| `config/danted.conf` | Dante SOCKS proxy config (routes through hedproxy) |
| `config/proxychains.conf` | Proxychains config (routes through hedproxy) |
| `config/torrc` | Tor daemon configuration |
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

See the `.example` files for fully commented templates. The relaymon config enables all three networks (`clearnet`, `tor`, `i2pd`) and seeds from both the shared database and network events.

### Proxy Configuration (`config/`)

Pre-configured for the default setup. See the [relaymon-multinet README](../relaymon-multinet/README.md#proxy-configuration-config) for details on each file.
