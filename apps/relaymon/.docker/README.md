# relaymon Docker Configuration

This directory contains Docker configurations for running relaymon with transparent network routing through different proxy services.

## How It Works

The Docker setup provides a single relaymon instance that automatically routes traffic through the appropriate network based on the URL:

- `.onion` domains are routed through Tor
- `.i2p` domains are routed through I2P
- `.loki` domains are routed through Lokinet
- Regular domains go through clearnet

This is achieved through transparent proxying at the container level, without requiring any modifications to the relaymon application code or separate configurations.

## Network Routing

The transparent routing is accomplished by:

1. Using torsocks SOCKS proxy for `.onion` addresses
2. Using Privoxy HTTP proxy for `.i2p` addresses
3. Using Privoxy and DNS resolution for `.loki` addresses
4. Direct connections for regular clearnet traffic

All proxy services are automatically configured and started, so relaymon can focus on monitoring relays across all networks with a single instance.

## Quick Start

To run the setup:

```bash
cd apps/relaymon
docker compose -f .docker/docker-compose.yml up -d
```

## Container Services

The docker-compose file includes:

- **relaymon**: The main container running a single relaymon instance
- **tor-proxy**: Tor SOCKS proxy for `.onion` addresses
- **i2pd**: I2P router for `.i2p` addresses
- **lokinet**: Lokinet router for `.loki` addresses

## Configuration

Unlike the multi-instance approach, this setup uses a single configuration file (`config.yaml`) for all networks. You only need to ensure the config includes all the network types you want to monitor:

```yaml
relaymon:
  networks:
    - clearnet
    - tor
    - i2p
    - lokinet
```

## Customizing

### Adding More Networks

To add support for additional anonymity networks:

1. Add the appropriate proxy container to docker-compose.yml
2. Update the Dockerfile.unified to configure the network routing

### Disabling Networks

To disable a network:

1. Comment out or remove the proxy service from docker-compose.yml
2. Update your config.yaml to remove that network from the monitored networks list

## Network-Specific Notes

### Tor

The Tor proxy is provided by the `dperson/torproxy` image, which is a lightweight container that runs the Tor daemon and exposes a SOCKS5 proxy.

### I2P

The I2P network is accessed through the `purplei2p/i2pd` container which provides an HTTP proxy for accessing I2P services.

### Lokinet

The Lokinet router uses the official `ghcr.io/oxen-io/lokinet` image. It requires the NET_ADMIN capability to configure its network interfaces. We route traffic through its SOCKS proxy and configure DNS resolution for `.loki` domains.

## Troubleshooting

- **Tor connectivity issues**: Ensure the tor-proxy container is running and accessible
- **I2P connectivity issues**: Check that i2pd is properly bootstrapped to the network
- **Lokinet issues**: Make sure the lokinet container has proper network capabilities and check its logs for bootstrap status

## Building Manually

```bash
# Build the unified image
docker build -t relaymon -f .docker/Dockerfile.unified ..

# Run with proxy services already available
docker run --network=relaymon-net relaymon