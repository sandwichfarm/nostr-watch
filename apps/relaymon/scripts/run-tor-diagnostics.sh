#!/bin/bash

# Simple script to run Tor WebSocket diagnostics in the container
# without interfering with existing configuration

CONTAINER="relaymon"

# Parse container name if provided
if [ "$1" != "" ]; then
  CONTAINER="$1"
fi

echo "Running Tor WebSocket diagnostics in container '$CONTAINER'..."

# Run the diagnostic script in the container
docker exec -it $CONTAINER bash -c "
  cd /app/nostr-watch/apps/relaymon

  # Set proxy explicitly for the test
  export http_proxy=socks5h://127.0.0.1:12346
  export https_proxy=socks5h://127.0.0.1:12346
  export all_proxy=socks5h://127.0.0.1:12346

  # Run the diagnostic script
  echo 'Running diagnostics...'
  deno run --allow-net --allow-env scripts/diagnose-tor-ws.js
"

# Provide additional guidance
echo ""
echo "If the Tor WebSockets are failing but clearnet is working:"
echo ""
echo "1. Check the dante-server configuration:"
echo "   - Make sure debug is set to 1 in /etc/danted.conf for detailed logs"
echo "   - Restart dante with: 'pkill -f danted && danted &'"
echo ""
echo "2. Check traffic routing with:"
echo "   - Route display: 'ip route'"
echo "   - SOCKS/proxy rules: 'iptables -t nat -L'"
echo ""
echo "3. Check fedproxy logs:"
echo "   - Look for rejections from Tor when connecting to .onion domains"
echo ""
echo "4. Test direct Tor connectivity with:"
echo "   - 'curl --socks5-hostname tor-proxy:9050 https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion'" 