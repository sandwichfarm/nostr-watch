# relaymon Docker Configuration

This directory contains Docker configurations for running relaymon in two variants:

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

```bash
cd apps/relaymon
docker compose -f .docker/docker-compose.yml up -d
```

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

## Building Manually

```bash
# Build the basic image
docker build -t relaymon:basic -f .docker/Dockerfile.basic ../../..

# Build the unified image
docker build -t relaymon:unified -f .docker/Dockerfile.unified ../../..
```
