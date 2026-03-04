# relaymon Docker Configuration

This directory contains Docker configurations for running relaymon in two variants:

<<<<<<< Updated upstream
- **Basic**: Clearnet-only relaymon instance
- **Unified**: Full-stack relaymon with transparent Tor and I2P routing

Each variant is available as a Docker Hub pull or a local build.

## Compose Files

| File | Variant | Source |
|---|---|---|
| `docker-compose.yml` | Basic | Docker Hub (`nostrwatch/relaymon:basic`) |
| `docker-compose.unified.yml` | Unified (tor, i2p) | Docker Hub (`nostrwatch/relaymon:unified`) |
| `docker-compose.build.yml` | Basic | Local build (`Dockerfile.basic`) |
| `docker-compose.build-unified.yml` | Unified (tor, i2p) | Local build (`Dockerfile.unified`) |

## Quick Start

### Basic (Docker Hub)
=======
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
>>>>>>> Stashed changes

```bash
docker compose -f apps/relaymon/.docker/docker-compose.yml up -d
```

<<<<<<< Updated upstream
### Unified with Tor/I2P (Docker Hub)

```bash
cd apps/relaymon
docker compose -f .docker/docker-compose.unified.yml up -d
```

### Local Build (Basic)

```bash
cd apps/relaymon
docker compose -f .docker/docker-compose.build.yml up -d --build
```

### Local Build (Unified)

```bash
cd apps/relaymon
docker compose -f .docker/docker-compose.build-unified.yml up -d --build
```

## Network Routing (Unified Variant)

The unified variant routes traffic transparently based on the domain:

- `.onion` domains are routed through Tor
- `.i2p` domains are routed through I2P
- Regular domains go through clearnet

This is achieved through transparent proxying at the container level, without requiring any modifications to the relaymon application code.

## Container Services

### Basic
- **relaymon**: The main container running relaymon for clearnet relays

### Unified
- **relaymon**: The main container with transparent network routing
- **tor-proxy**: Tor SOCKS proxy for `.onion` addresses
- **i2pd**: I2P router for `.i2p` addresses

## Configuration

Customize relaymon through `config.yaml`. For the unified variant, include all network types:

```yaml
relaymon:
  networks:
    - clearnet
    - tor
    - i2p
```

## Customizing the Unified Variant

### Disabling Networks

1. Comment out or remove the proxy service from the compose file
2. Update your config.yaml to remove that network

## Troubleshooting

- **Tor connectivity issues**: Ensure the tor-proxy container is running and accessible
- **I2P connectivity issues**: Check that i2pd is properly bootstrapped to the network
- **Build issues**: Make sure you're building from the project root (where the libraries/ and internal/ directories are located)
=======
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
>>>>>>> Stashed changes

## Building Manually

```bash
<<<<<<< Updated upstream
# Build the basic image
docker build -t relaymon:basic -f .docker/Dockerfile.basic ../../..

# Build the unified image
docker build -t relaymon:unified -f .docker/Dockerfile.unified ../../..
```
=======
# Clearnet
docker build -t relaymon:clearnet -f apps/relaymon/.docker/Dockerfile.clearnet .

# Multinet
docker build -t relaymon:multinet -f apps/relaymon/.docker/Dockerfile.multinet .
```

## Troubleshooting

- **Tor connectivity issues**: Ensure `tor-proxy` container is running and port 9050 is accessible
- **I2P connectivity issues**: Check that `i2pd` has bootstrapped — initial sync can take several minutes
- **Build issues**: Ensure you're building from the project root where `libraries/` and `internal/` directories are located
>>>>>>> Stashed changes
