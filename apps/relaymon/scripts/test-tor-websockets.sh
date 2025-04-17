#!/bin/bash

# Script to run WebSocket tests on a running container
# This tests both clearnet and Tor WebSockets

CONTAINER="relaymon"

# Parse container name if provided
if [ "$1" != "" ]; then
  CONTAINER="$1"
fi

echo "Running WebSocket connectivity tests in container '$CONTAINER'..."

# Run the entrypoint script with --verify-websockets flag
docker exec $CONTAINER /app/nostr-watch/apps/relaymon/.docker/scripts/entrypoint.sh --verify-websockets

# Display useful commands for debugging
echo ""
echo "If tests failed, you can try these commands for more diagnostics:"
echo ""
echo "1. Check Dante logs for connection issues:"
echo "   docker exec $CONTAINER grep -i 'error\\|denied' /var/log/syslog | tail -20"
echo ""
echo "2. Test direct Tor connectivity:"
echo "   docker exec $CONTAINER curl --socks5-hostname tor-proxy:9050 -s https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/"
echo ""
echo "3. Check if dante is correctly configured for SOCKS5h:"
echo "   docker exec $CONTAINER grep -A 10 'route {' /etc/danted.conf"
echo ""
echo "4. Restart the proxy chain:"
echo "   docker restart $CONTAINER" 