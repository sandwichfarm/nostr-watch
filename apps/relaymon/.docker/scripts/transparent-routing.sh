#!/bin/bash

# Start Privoxy
echo "Starting Privoxy..."
cp /etc/privoxy/config.orig /etc/privoxy/config
service privoxy start

# Setup iptables rules for transparent proxying
setup_iptables() {
  echo "Setting up transparent proxy routing..."
  # Create a custom chain for domain-based routing
  iptables -t nat -N DOMAIN_ROUTER 2>/dev/null || iptables -t nat -F DOMAIN_ROUTER
  # Send all non-local TCP traffic to our routing chain
  iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner privoxy -j DOMAIN_ROUTER

  # Save original resolv.conf
  if [ ! -f /etc/resolv.conf.orig ]; then
    cp /etc/resolv.conf /etc/resolv.conf.orig
  fi
}

# Wait for a service to be available
wait_for_service() {
  local host=$1
  local port=$2
  local name=$3
  echo "Waiting for $name service at $host:$port..."
  until nc -z $host $port; do
    echo "$name not ready, waiting..."
    sleep 2
  done
  echo "$name service is available"
}

# Setup routing for .onion domains (Tor)
setup_tor() {
  wait_for_service tor-proxy 9050 "Tor"
  
  # Add Privoxy forwarding for .onion domains
  echo "forward-socks5t .onion tor-proxy:9050 ." >> /etc/privoxy/config

  # Restart Privoxy to apply changes
  service privoxy restart

  echo "Tor routing configured."
}

# Setup routing for .i2p domains
setup_i2p() {
  wait_for_service i2pd 4444 "I2P"
  
  # Add Privoxy forwarding for .i2p domains
  echo "forward-socks4a .i2p i2pd:4444 ." >> /etc/privoxy/config

  # Restart Privoxy to apply changes
  service privoxy restart

  echo "I2P routing configured."
}

# Setup routing for .loki domains
setup_lokinet() {
  if nc -z lokinet 9050 2>/dev/null; then
    # Add Privoxy forwarding for .loki domains
    echo "forward-socks5 .loki lokinet:9050 ." >> /etc/privoxy/config

    # Configure DNS for .loki domains
    echo "nameserver lokinet" > /etc/resolv.conf
    cat /etc/resolv.conf.orig >> /etc/resolv.conf

    # Restart Privoxy to apply changes
    service privoxy restart

    echo "Lokinet routing configured."
  else
    echo "Lokinet service not detected, skipping configuration."
  fi
}

# Configure socat for transparent WebSocket proxying
setup_websocket_proxies() {
  # Use the separate wsroute.sh script
  chmod +x /usr/local/bin/wsroute.sh

  # Start socat listeners for WebSocket ports
  socat TCP-LISTEN:80,fork,reuseaddr EXEC:/usr/local/bin/wsroute.sh &
  socat TCP-LISTEN:443,fork,reuseaddr EXEC:/usr/local/bin/wsroute.sh &
  socat TCP-LISTEN:8080,fork,reuseaddr EXEC:/usr/local/bin/wsroute.sh &
}

# Setup transparent proxying
echo "Setting up transparent network routing..."

# Make sure we have the original Privoxy config
cp /etc/privoxy/config /etc/privoxy/config.orig
echo "listen-address 127.0.0.1:8118" > /etc/privoxy/config

# Setup base routing
setup_iptables

# Setup network-specific routing
setup_tor
setup_i2p
setup_lokinet

# Setup WebSocket proxying
setup_websocket_proxies

# Configure DNS resolution
echo "Configuring DNS resolution..."

# Setup environment for proxy usage
export http_proxy="http://127.0.0.1:8118"
export https_proxy="http://127.0.0.1:8118"
export no_proxy="localhost,127.0.0.1"

echo "Transparent routing setup complete."

# Debug command string
echo "ARGS count: $#"
echo "ARGS are: $@"
echo "ARG1 is: $1"
echo "ARG2 is: $2"

# Check if we're trying to run relaymon directly
if [ "$1" = "/usr/local/bin/deno-proxy-wrapper.sh" ] && [ "$2" = "/usr/local/bin/relaymon" ]; then
  echo "Detected relaymon execution request, redirecting to run-deno.sh"
  exec /usr/local/bin/deno-proxy-wrapper.sh /usr/local/bin/run-deno.sh
else
  # Execute the original command
  echo "Executing: $@"
  exec "$@"
fi 