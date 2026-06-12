# RelayMon Multinet Stack

Runs RelayMon in multinet mode with Tor and I2P proxy support via [hedproxy](https://github.com/sandwichfarm/hedproxy).

## How It Works

This stack runs three containers:

- **relaymon** — The relay monitor, running in `multinet` mode. It publishes NIP-66 results and can optionally publish Trusted Relay Assertions (kind `30385`). hedproxy runs inside this container and automatically routes connections based on the relay URL scheme:
  - `wss://` / `ws://` — direct clearnet connection
  - `.onion` URLs — routed through the Tor SOCKS5 proxy
  - `.i2p` URLs — routed through the I2P HTTP proxy
- **tor-proxy** — Tor daemon exposing a SOCKS5 proxy on port 9050
- **i2pd** — I2P daemon with SAM bridge

All three containers share a Docker bridge network (`relaymon-net`). RelayMon has `NET_ADMIN` and `NET_RAW` capabilities for network routing. The proxy configs in `config/` are pre-configured and generally don't need changes.

## Setup

```bash
# 1. Copy sample configuration files
cp .env.example .env
cp config.yaml.example config.yaml

# 2. Edit .env — set RELAYMON_NSEC
# 3. Edit config.yaml — set monitor.slug, monitor.owner, and seed sources
#    The default config.yaml.example already has all three networks enabled

# 4. Start
docker compose up -d

# 5. Wait for Tor and I2P to establish circuits (may take 30-60 seconds)
docker compose logs -f tor-proxy i2pd

# 6. View RelayMon logs
docker compose logs -f relaymon
```

## Files

| File | Purpose |
|------|---------|
| `.env.example` | Sample environment variables — copy to `.env` |
| `config.yaml.example` | Sample application config — copy to `config.yaml` |
| `docker-compose.yaml` | Docker Compose service definition |
| `config/danted.conf` | Dante SOCKS proxy config (routes through hedproxy) |
| `config/proxychains.conf` | Proxychains config (routes through hedproxy) |
| `config/torrc` | Tor daemon configuration |
| `data/` | Persistent data directory (created automatically) |

## Configuration

### `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `RELAYMON_NSEC` | Yes | Signing key (nsec1... or hex) for publishing events |
| `RELAYMON_KUMA_PUSH_URL` | No | Uptime Kuma push URL for health monitoring |
| `RELAYMON_HEALTH_AUTH_TOKEN` | No | Auth token for the health HTTP endpoint |

### `config.yaml`

See `config.yaml.example` for a fully commented template. The key difference from the clearnet stack is the `relaymon.networks` list:

```yaml
relaymon:
  networks:
    - clearnet
    - tor
    - i2pd
```

Set `relaymon.trustedRelayAssertions.enabled` to `true` to publish optional kind `30385` trust assertions.

### Proxy Configuration (`config/`)

The proxy config files are pre-configured for the default setup:

- **`torrc`** — Tor SOCKS on `0.0.0.0:9050`, DNS on `0.0.0.0:5353`, allows Docker network subnets
- **`danted.conf`** — Dante SOCKS5 proxy on port 12346, routes through hedproxy at `127.0.0.1:12345`
- **`proxychains.conf`** — Strict chain mode, routes through hedproxy at `127.0.0.1:12345`

These files generally don't need modification unless you have custom network requirements.
