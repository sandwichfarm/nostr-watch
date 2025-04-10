#!/bin/bash

echo "Starting RelayMon with hedproxy..."

# --- Parse command-line arguments first ---
VERIFY_ONLY=false
APP_ARGS=()

for arg in "$@"; do
  if [ "$arg" = "--verify-network" ]; then
    VERIFY_ONLY=true
  else
    APP_ARGS+=("$arg")
  fi
done

# --- Configuration ---
TOR_PROXY_HOST="tor-proxy"
TOR_SOCKS_PORT="9050"

I2P_PROXY_HOST="i2pd"
I2P_SAM_PORT="4447"

LOKINET_PROXY_HOST="lokinet"
LOKINET_SOCKS_PORT="9060"

HEDPROXY_PORT="12345"

# Disable PID check in Docker environment
export RELAYMON_SKIP_PID_CHECK=true

# --- Wait for Proxies ---
wait_for_service() {
  local host=$1
  local port=$2
  local name=$3
  echo "Waiting for $name service at $host:$port..."
  until nc -z $host $port; do
    echo "Waiting for $name ($host:$port)..."
    sleep 2
  done
  echo "$name service is available."
}

echo "Waiting for proxy services..."
wait_for_service $TOR_PROXY_HOST $TOR_SOCKS_PORT "Tor Proxy"
wait_for_service $I2P_PROXY_HOST $I2P_SAM_PORT "I2P SAM Bridge"

# Uncomment if lokinet is enabled in docker-compose
# wait_for_service $LOKINET_PROXY_HOST $LOKINET_SOCKS_PORT "Lokinet Proxy"

# --- First, cache dependencies directly without proxy ---
if [ "$VERIFY_ONLY" = "false" ]; then
  cd /app/nostr-watch/apps/relaymon

  echo "Pre-caching dependencies in direct mode (no proxy)..."
  # Make sure no proxy settings are active for this step
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY

  # Cache dependencies
  deno cache --reload index.ts || echo "Some dependency caching failed, continuing anyway"
fi

# --- Start hedproxy ---
echo "Starting hedproxy for network operations..."

# Run hedproxy in the background with debug logging
hedproxy -proto socks -bind "0.0.0.0:$HEDPROXY_PORT" -tor "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" -i2p "$I2P_PROXY_HOST:$I2P_SAM_PORT" -passthrough clearnet &
HEDPROXY_PID=$!

# Verify hedproxy is listening
sleep 2
if ! netstat -tlpn | grep -q ":$HEDPROXY_PORT.*LISTEN.*hedproxy"; then
    echo "ERROR: hedproxy failed to bind to port $HEDPROXY_PORT"
    exit 1
fi


# Give services a moment to start
sleep 2

# Test Tor WebSocket connectivity with websocat
test_tor_ws_with_websocat() {
  echo "═════════════════════════════════════════════"
  echo "Testing Tor WebSocket connectivity with websocat..."
  echo "═════════════════════════════════════════════"

  # Verify websocat is available
  if ! command -v websocat &> /dev/null; then
    echo "❌ ERROR: websocat not found! It should be installed in the Dockerfile."
    return 1
  fi

  # Resolve Tor proxy hostname to IP address
  echo "Resolving $TOR_PROXY_HOST..."
  TOR_PROXY_IP=$(getent hosts $TOR_PROXY_HOST | awk '{ print $1 }')

  if [ -z "$TOR_PROXY_IP" ]; then
    echo "❌ ERROR: Could not resolve IP address for $TOR_PROXY_HOST"
    return 1
  fi
  echo "Resolved $TOR_PROXY_HOST to $TOR_PROXY_IP"

  # Set up test parameters
  local timeout=30 # Keep the increased timeout
  local success=false

  # List of Tor onion relays to test
  local tor_relays=(
    "ws://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion"
    "ws://2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion"
    "ws://nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion"
  )

  echo "Testing WebSocket connections to Tor onion relays using IP $TOR_PROXY_IP..."

  for relay in "${tor_relays[@]}"; do
    echo "  • Testing connection to $relay..."
    echo "DEBUG: Using SOCKS Proxy='${TOR_PROXY_IP}:${TOR_SOCKS_PORT}'" # Updated DEBUG line

    # Use the resolved IP address instead of the hostname
    if websocat -v --socks5 "${TOR_PROXY_IP}:${TOR_SOCKS_PORT}" "$relay" -1 </dev/null > /dev/null; then
      echo "✅ Successfully connected to WebSocket relay: $relay"
      success=true
      break
    else
      echo "❌ Failed to connect to WebSocket relay: $relay"
    fi
  done

  echo "═════════════════════════════════════════════"
  if [ "$success" = "true" ]; then
    echo "✅ Tor WebSocket connectivity test PASSED"
  else
    echo "❌ Tor WebSocket connectivity test FAILED"
    echo "This means WebSocket connections to .onion services will likely fail."
    echo "Check Tor configuration and connectivity."
  fi
  echo "═════════════════════════════════════════════"
}

# --- Verify hedproxy connectivity to different networks ---
verify_hedproxy_connectivity() {
  echo "═════════════════════════════════════════════"
  echo "Verifying hedproxy connectivity to anonymous networks..."
  echo "═════════════════════════════════════════════"
  echo "This test verifies that hedproxy can connect to Tor, I2P, and"
  echo "Lokinet networks. It attempts to connect to known services on"
  echo "each network through the hedproxy SOCKS5 proxy."
  echo ""
  echo "Usage:"
  echo "  • Run verification at startup: VERIFY_CONNECTIVITY=true"
  echo "  • Require successful tests:    REQUIRE_NETWORK_CONNECTIVITY=true"
  echo "  • Run verification only:       docker exec <container> /app/nostr-watch/apps/relaymon/.docker/scripts/entrypoint.sh --verify-network"
  echo "═════════════════════════════════════════════"

  # Known test domains for each network
  local tor_domains=(
    "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion" # DuckDuckGo
    "vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd.onion" # Tor Project
    "protonmailrmez3lotccipshtkleegetolb73fuirgj7r4o4vfu7ozyd.onion" # ProtonMail
  )
  
  local i2p_domains=(
    "stats.i2p"
    "i2p-projekt.i2p"
    "planet.i2p"
  )
  
  local lokinet_domains=(
    "dw68y1xhptqbhcm5s8aaaip6dbopykagig5q5u1za4c7pzxto77y.loki"
    "oxen.io.loki"
  )

  local timeout=10
  local exit_code=0
  
  # Function to test connection to a domain
  test_domain() {
    local proxy_type=$1
    local proxy_addr=$2
    local domain=$3
    local timeout=$4
    
    echo "  • Testing connection to $domain..."
    if [ "$proxy_type" = "socks5" ]; then
      curl --socks5-hostname $proxy_addr -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
      return $?
    elif [ "$proxy_type" = "http" ]; then
      curl -x $proxy_addr -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
      return $?
    else
      curl -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
      return $?
    fi
  }
  
  # Check Tor connectivity
  echo "─────────────────────────────────────────────"
  echo "Testing Tor connectivity via hedproxy..."
  echo "─────────────────────────────────────────────"
  
  local tor_success=false
  for domain in "${tor_domains[@]}"; do
    if test_domain "socks5" "127.0.0.1:$HEDPROXY_PORT" "$domain" "$timeout"; then
      tor_success=true
      echo "✅ Successfully connected to Tor onion service: $domain"
      break
    fi
  done
  
  if [ "$tor_success" = "false" ]; then
    echo "❌ Failed to connect to any Tor onion services"
    echo "Diagnostic information:"
    echo "  • Checking direct Tor connection..."
    for domain in "${tor_domains[@]}"; do
      if test_domain "socks5" "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" "$domain" "$timeout"; then
        echo "    ✓ Direct Tor connection works for $domain (issue is with hedproxy)"
        break
      fi
    done
    
    echo "  • Displaying network configuration:"
    echo "    - Tor proxy: $TOR_PROXY_HOST:$TOR_SOCKS_PORT"
    echo "    - Hedproxy port: $HEDPROXY_PORT"
    echo "    - HTTP_PROXY: $HTTP_PROXY"
    exit_code=1
  fi
  
  # Check I2P connectivity
  echo "─────────────────────────────────────────────"
  echo "Testing I2P connectivity via hedproxy..."
  echo "─────────────────────────────────────────────"
  
  local i2p_success=false
  for domain in "${i2p_domains[@]}"; do
    if test_domain "socks5" "127.0.0.1:$HEDPROXY_PORT" "$domain" "$timeout"; then
      i2p_success=true
      echo "✅ Successfully connected to I2P service: $domain"
      break
    fi
  done
  
  if [ "$i2p_success" = "false" ]; then
    echo "❌ Failed to connect to any I2P services"
    echo "Diagnostic information:"
    # Check if I2P HTTP proxy is available
    if nc -z $I2P_PROXY_HOST 4444 2>/dev/null; then
      echo "  • I2P HTTP proxy available at $I2P_PROXY_HOST:4444"
      echo "  • Checking direct I2P HTTP proxy connection..."
      for domain in "${i2p_domains[@]}"; do
        if test_domain "http" "$I2P_PROXY_HOST:4444" "$domain" "$timeout"; then
          echo "    ✓ Direct I2P HTTP proxy works for $domain (issue is with hedproxy)"
          break
        fi
      done
    else 
      echo "  • I2P HTTP proxy not available at $I2P_PROXY_HOST:4444"
    fi
    
    echo "  • Displaying network configuration:"
    echo "    - I2P SAM bridge: $I2P_PROXY_HOST:$I2P_SAM_PORT"
    echo "    - Hedproxy port: $HEDPROXY_PORT"
    echo "    - HTTP_PROXY: $HTTP_PROXY"
    exit_code=1
  fi
  
  # Check Lokinet connectivity if enabled
  if nc -z $LOKINET_PROXY_HOST $LOKINET_SOCKS_PORT 2>/dev/null; then
    echo "─────────────────────────────────────────────"
    echo "Testing Lokinet connectivity via hedproxy..."
    echo "─────────────────────────────────────────────"
    
    local lokinet_success=false
    for domain in "${lokinet_domains[@]}"; do
      if test_domain "socks5" "127.0.0.1:$HEDPROXY_PORT" "$domain" "$timeout"; then
        lokinet_success=true
        echo "✅ Successfully connected to Lokinet service: $domain"
        break
      fi
    done
    
    if [ "$lokinet_success" = "false" ]; then
      echo "❌ Failed to connect to any Lokinet services"
      echo "Diagnostic information:"
      echo "  • Checking direct Lokinet connection..."
      for domain in "${lokinet_domains[@]}"; do
        if test_domain "socks5" "$LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT" "$domain" "$timeout"; then
          echo "    ✓ Direct Lokinet connection works for $domain (issue is with hedproxy)"
          break
        fi
      done
      
      echo "  • Displaying network configuration:"
      echo "    - Lokinet proxy: $LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT"
      echo "    - Hedproxy port: $HEDPROXY_PORT"
      echo "    - HTTP_PROXY: $HTTP_PROXY"
      exit_code=1
    fi
  else
    echo "Lokinet not enabled or available, skipping test"
  fi
  
  echo "═════════════════════════════════════════════"
  if [ $exit_code -eq 0 ]; then
    echo "✅ All available network tests PASSED"
  else
    echo "⚠️ Some network tests FAILED"
    if [ "${REQUIRE_NETWORK_CONNECTIVITY}" = "true" ] || [ "$VERIFY_ONLY" = "true" ]; then
      echo "Exiting with failure status..."
      exit $exit_code
    else
    
      echo "Continuing despite connectivity issues..."
      echo "TIP: If you're setting up this environment, these failures are expected"
      echo "     until all services are properly configured."
    fi
  fi
  echo "═════════════════════════════════════════════"

  return $exit_code
}

# Run connectivity verification
if [ "${VERIFY_CONNECTIVITY}" != "false" ] || [ "$VERIFY_ONLY" = "true" ]; then
  verify_hedproxy_connectivity
  sleep 5
fi

test_tor_ws_with_websocat
sleep 5

# Skipping transparent proxy test
echo "Skipping transparent proxy test. Will use proxychains4 instead."
sleep 5

# If only verification was requested, exit now
if [ "$VERIFY_ONLY" = "true" ]; then
  echo "Network verification complete, exiting as requested."
  # Kill hedproxy before exiting
  if [ -n "$HEDPROXY_PID" ]; then
    kill $HEDPROXY_PID 2>/dev/null || true
  fi
  exit 0
fi

# --- Execute Application ---
echo "Starting RelayMon application..."
echo "Executing with proxychains4: proxychains4 -f /etc/proxychains.conf deno run ... index.ts ${APP_ARGS[*]}"
cd /app/nostr-watch/apps/relaymon
exec proxychains4 -f /etc/proxychains.conf deno run --allow-ffi --unstable-sloppy-imports --allow-net --allow-env --allow-read --allow-write --allow-run index.ts -c /opt/config.yaml "${APP_ARGS[@]}"