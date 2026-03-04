# relaymon Docker Configuration

This directory contains Docker configurations for running relaymon in two variants:

- **Clearnet** — monitors relays over the regular internet
- **Multinet** — monitors relays across clearnet, Tor (`.onion`), and I2P (`.i2p`) with transparent proxy routing

## Compose Files

| File | Variant | Image Source |
|---|---|---|
| `docker-compose.yml` | Clearnet | Docker Hub (`nostrwatch/relaymon:clearnet`) |
| `docker-compose.multinet.yml` | Multinet | Docker Hub (`nostrwatch/relaymon:multinet`) |
| `docker-compose.build.yml` | Clearnet | Local build (`Dockerfile.clearnet`) |
| `docker-compose.build-multinet.yml` | Multinet | Local build (`Dockerfile.multinet`) |

## Dockerfiles

| File | Description |
|---|---|
| `Dockerfile.clearnet` | Lightweight image with Deno and basic networking tools |
| `Dockerfile.multinet` | Full image with Deno, dante, proxychains, hedproxy, and network routing |

## Quick Start

### Clearnet (Docker Hub)

```bash
docker compose -f apps/relaymon/.docker/docker-compose.yml up -d
```

### Multinet (Docker Hub)

```bash
docker compose -f apps/relaymon/.docker/docker-compose.multinet.yml up -d
```

### Clearnet (local build)

```bash
docker compose -f apps/relaymon/.docker/docker-compose.build.yml up -d
```

### Multinet (local build)

```bash
docker compose -f apps/relaymon/.docker/docker-compose.build-multinet.yml up -d
```

## Multinet Network Routing

The multinet variant routes traffic transparently based on the relay domain:

- `.onion` domains → Tor proxy (SOCKS5)
- `.i2p` domains → I2P router (HTTP proxy)
- Regular domains → direct clearnet connection

### Multinet Container Services

- **relaymon** — main monitoring container with transparent proxy routing
- **tor-proxy** — Tor SOCKS proxy for `.onion` addresses
- **i2pd** — I2P router for `.i2p` addresses

## Configuration

Both variants mount the same core volumes:

- `data/` — persistent data directory
- `.docker.env` — environment variables
- `config.docker.yaml` — relaymon configuration
- `data/relays.db` — relay database

The multinet variant additionally mounts:

- `config/danted.conf` — dante SOCKS proxy config
- `config/proxychains.conf` — proxychains routing config
- `config/torrc` — Tor configuration

## Building Manually

```bash
# Clearnet
docker build -t relaymon:clearnet -f apps/relaymon/.docker/Dockerfile.clearnet .

# Multinet
docker build -t relaymon:multinet -f apps/relaymon/.docker/Dockerfile.multinet .
```

## Troubleshooting

- **Tor connectivity issues**: Ensure `tor-proxy` container is running and port 9050 is accessible
- **I2P connectivity issues**: Check that `i2pd` has bootstrapped — initial sync can take several minutes
- **Build issues**: Ensure you're building from the project root where `libraries/` and `internal/` directories are located
