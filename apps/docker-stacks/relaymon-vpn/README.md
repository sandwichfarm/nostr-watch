# RelayMon VPN Stack

Runs RelayMon in clearnet mode, with all traffic routed through a VPN via [Gluetun](https://github.com/qdm12/gluetun).

## How It Works

This stack adds a Gluetun VPN container in front of RelayMon. RelayMon uses Gluetun's network (`network_mode: container:gluetun`), so all outbound traffic — relay connections, DNS lookups, event publishing — goes through the VPN tunnel. The relay monitoring behavior is identical to the clearnet stack, just routed differently.

## Setup

```bash
# 1. Copy sample configuration files
cp .env.example .env
cp .env.gluetun.example .env.gluetun
cp config.yaml.example config.yaml

# 2. Edit .env — set RELAYMON_NSEC
# 3. Edit .env.gluetun — set your VPN provider credentials
# 4. Edit config.yaml — set monitor.slug, monitor.owner, and seed sources

# 5. Start
docker compose up -d

# 6. Verify VPN is working
docker compose logs gluetun

# 7. View RelayMon logs
docker compose logs -f relaymon
```

## Files

| File | Purpose |
|------|---------|
| `.env.example` | Sample RelayMon environment variables — copy to `.env` |
| `.env.gluetun.example` | Sample VPN provider credentials — copy to `.env.gluetun` |
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

### `.env.gluetun`

VPN provider credentials. The default provider is Mullvad (WireGuard). See `.env.gluetun.example` for examples of other providers, or consult the [Gluetun wiki](https://github.com/qdm12/gluetun-wiki).

To change the VPN provider, also update `VPN_SERVICE_PROVIDER` in `docker-compose.yaml`.

### `config.yaml`

See `config.yaml.example` for a fully commented template. Configuration is the same as the clearnet stack.
