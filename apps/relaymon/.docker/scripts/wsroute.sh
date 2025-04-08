#!/bin/bash

# Read the host from the connection data
read_host() {
  # Read data without consuming it
  read -n 1024 data
  # Extract host from HTTP headers or WebSocket upgrade request
  host=$(echo "$data" | grep -oP "Host: \K[^\r\n]+")
  if [ -z "$host" ]; then
    # Try to extract from the first line (WebSocket upgrade)
    host=$(echo "$data" | head -1 | grep -oP "https?://\K[^:/]+")
  fi
  echo "$host"
}

host=$(read_host)
echo "Detected host: $host" >&2

# Route based on TLD
if [[ "$host" == *".onion"* ]]; then
  echo "Routing .onion through Tor" >&2
  exec socat - SOCKS4:tor-proxy:$host:80,socksport=9050
elif [[ "$host" == *".i2p"* ]]; then
  echo "Routing .i2p through I2P" >&2
  exec socat - SOCKS4:i2pd:$host:80,socksport=4444
elif [[ "$host" == *".loki"* ]]; then
  echo "Routing .loki through Lokinet" >&2
  exec socat - SOCKS5:lokinet:$host:80,socksport=9050
else
  echo "Direct connection for $host" >&2
  exec socat - TCP:$host:80
fi 