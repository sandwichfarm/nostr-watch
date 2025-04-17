#!/bin/bash

# Script to run proxy tests in the relaymon Docker container
# This should be run from the host machine, not inside the container

# Configuration
CONTAINER_NAME="relaymon"
TEST_DIR="/app/nostr-watch/apps/relaymon/tests"
VERBOSE=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -v|--verbose) VERBOSE=true; shift ;;
    -c|--container) CONTAINER_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -v, --verbose      Enable verbose output"
      echo "  -c, --container    Specify container name (default: relaymon)"
      echo "  -h, --help         Show this help message"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

# Ensure container is running
echo "Checking if container $CONTAINER_NAME is running..."
CONTAINER_RUNNING=$(docker ps -q -f name=$CONTAINER_NAME)

if [ -z "$CONTAINER_RUNNING" ]; then
  echo "Error: Container $CONTAINER_NAME is not running"
  echo "Start the container first with: docker-compose up -d $CONTAINER_NAME"
  exit 1
fi

echo "Container $CONTAINER_NAME is running"

# Generate test data for onion addresses
echo "Generating list of Tor relays for testing..."
RELAY_LIST_TEMP=$(mktemp)
cat > $RELAY_LIST_TEMP << EOL
[
  "wss://relayable.org.onion",
  "wss://nostr.wine.onion",
  "wss://damus.io.onion/",
  "wss://relay.damus.io"
]
EOL

echo "Copying test configuration into container..."
docker cp $RELAY_LIST_TEMP $CONTAINER_NAME:/tmp/test-relays.json

# Clean up temp file
rm $RELAY_LIST_TEMP

# Prepare test environment inside container
echo "Setting up test environment in container..."
docker exec $CONTAINER_NAME bash -c "
  mkdir -p $TEST_DIR/utils 2>/dev/null || true
  echo 'Test environment ready'
"

# Run a quick connection test to see if we can access Tor
echo "Running quick Tor connectivity check..."
docker exec $CONTAINER_NAME bash -c "
  export http_proxy=socks5h://127.0.0.1:12346
  export https_proxy=socks5h://127.0.0.1:12346
  
  echo 'Testing clearnet connectivity...'
  curl -s -o /dev/null -w 'Clearnet status: %{http_code}\n' https://httpbin.org/status/200
  
  echo 'Testing Tor connectivity to DuckDuckGo onion...'
  curl -s -o /dev/null -w 'Tor status: %{http_code}\n' https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/
"

# Run the proxy chain tests
echo "Running proxy chain diagnostic tests..."
docker exec $CONTAINER_NAME bash -c "
  cd /app/nostr-watch
  
  # Run the tests
  cd apps/relaymon
  
  echo 'Running proxy connectivity tests (may take a minute)...'
  deno test --allow-net --allow-read --allow-env tests/proxy-connectivity.test.ts
  
  echo 'Running detailed Docker proxy chain tests...'
  deno test --allow-net --allow-read --allow-env tests/docker-proxy-chain.test.ts
"

echo "Tests complete. Review the output above for diagnostics information."
echo ""
echo "Next steps:"
echo "1. If the tests show clearnet works but Tor doesn't, review fedproxy configuration"
echo "2. Check Dante SOCKS settings for DNS resolution (socks5h support)"
echo "3. Verify Tor proxy is accepting connections from Docker network"
echo "4. Use --verbose flag for more detailed logs: $0 --verbose" 