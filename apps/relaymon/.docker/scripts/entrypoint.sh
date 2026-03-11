#!/bin/bash

echo "Starting RelayMon..."

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

# --- Mode Selection ---
RELAYMON_MODE="${RELAYMON_MODE:-clearnet}"

if [ "$RELAYMON_MODE" = "clearnet" ]; then
  echo "Starting RelayMon in clearnet mode..."
  export RELAYMON_SKIP_PID_CHECK=true
  cd /app/nostr-watch/apps/relaymon
  exec deno run --no-lock --env-file=/app/.env --allow-all --unstable-sloppy-imports index.ts -c /opt/config.yaml "${APP_ARGS[@]}"
fi

echo "Starting RelayMon in multinet mode with hedproxy..."

# --- Configuration ---
TOR_PROXY_HOST="tor-proxy"
TOR_SOCKS_PORT="9050"

I2P_PROXY_HOST="i2pd"
I2P_SOCKS_PORT="4447"
I2P_SAM_PORT="7656"

LOKINET_PROXY_HOST="lokinet"
LOKINET_SOCKS_PORT="9060"

HEDPROXY_PORT="12345"

# Disable PID check in Docker environment
export RELAYMON_SKIP_PID_CHECK=true

# --- Wait for Proxies (bootstrap-aware) ---
TOR_BOOTSTRAP_TIMEOUT="${TOR_BOOTSTRAP_TIMEOUT:-180}"
I2P_BOOTSTRAP_TIMEOUT="${I2P_BOOTSTRAP_TIMEOUT:-300}"

wait_for_tor_ready() {
  local host=$1
  local port=$2

  # Phase 1: Wait for port to open
  echo "Waiting for Tor to bootstrap..."
  echo "  Phase 1: Waiting for SOCKS port $host:$port..."
  until nc -z $host $port 2>/dev/null; do
    sleep 2
  done
  echo "  Tor SOCKS port is open."

  # Phase 2: Verify actual Tor connectivity
  echo "  Phase 2: Verifying Tor circuit readiness (timeout: ${TOR_BOOTSTRAP_TIMEOUT}s)..."
  local test_domain="duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion"
  local elapsed=0
  local wait_interval=10

  while [ $elapsed -lt $TOR_BOOTSTRAP_TIMEOUT ]; do
    if curl --socks5-hostname "$host:$port" -s --head --connect-timeout 15 "http://$test_domain" > /dev/null 2>&1; then
      echo "  Tor circuits are ready (took ${elapsed}s)."
      return 0
    fi
    echo "  Tor not ready yet (${elapsed}s/${TOR_BOOTSTRAP_TIMEOUT}s), retrying in ${wait_interval}s..."
    sleep $wait_interval
    elapsed=$((elapsed + wait_interval))
    # Increase backoff after first minute
    if [ $elapsed -ge 60 ] && [ $wait_interval -lt 20 ]; then
      wait_interval=20
    fi
  done

  echo "  WARNING: Tor bootstrap timeout after ${TOR_BOOTSTRAP_TIMEOUT}s - circuits may not be ready."
  if [ "${REQUIRE_NETWORK_CONNECTIVITY}" = "true" ]; then
    echo "  REQUIRE_NETWORK_CONNECTIVITY is set, aborting."
    exit 1
  fi
  echo "  Continuing anyway..."
  return 1
}

wait_for_i2p_ready() {
  local host=$1
  local port=$2

  # Phase 1: Wait for SAM port to open
  echo "Waiting for I2P to bootstrap..."
  echo "  Phase 1: Waiting for SAM port $host:$port..."
  until nc -z $host $port 2>/dev/null; do
    sleep 2
  done
  echo "  I2P SAM port is open."

  # Phase 2: Verify SAM bridge readiness with HELLO handshake
  echo "  Phase 2: Verifying I2P SAM readiness (timeout: ${I2P_BOOTSTRAP_TIMEOUT}s)..."
  local elapsed=0
  local wait_interval=15

  while [ $elapsed -lt $I2P_BOOTSTRAP_TIMEOUT ]; do
    local sam_response
    sam_response=$(echo "HELLO VERSION" | nc -w 5 "$host" "$port" 2>/dev/null || true)
    if echo "$sam_response" | grep -q "HELLO REPLY RESULT=OK"; then
      echo "  I2P SAM bridge is ready (took ${elapsed}s)."
      return 0
    fi
    echo "  I2P SAM not ready yet (${elapsed}s/${I2P_BOOTSTRAP_TIMEOUT}s), retrying in ${wait_interval}s..."
    sleep $wait_interval
    elapsed=$((elapsed + wait_interval))
    # Increase backoff after two minutes
    if [ $elapsed -ge 120 ] && [ $wait_interval -lt 30 ]; then
      wait_interval=30
    fi
  done

  echo "  WARNING: I2P bootstrap timeout after ${I2P_BOOTSTRAP_TIMEOUT}s - tunnels may not be ready."
  if [ "${REQUIRE_NETWORK_CONNECTIVITY}" = "true" ]; then
    echo "  REQUIRE_NETWORK_CONNECTIVITY is set, aborting."
    exit 1
  fi
  echo "  Continuing anyway..."
  return 1
}

echo "Waiting for proxy services..."
wait_for_tor_ready $TOR_PROXY_HOST $TOR_SOCKS_PORT
wait_for_i2p_ready $I2P_PROXY_HOST $I2P_SAM_PORT

# Uncomment if lokinet is enabled in docker-compose
# wait_for_service $LOKINET_PROXY_HOST $LOKINET_SOCKS_PORT "Lokinet Proxy"

# --- First, cache dependencies directly without proxy ---
if [ "$VERIFY_ONLY" = "false" ]; then
  cd /app/nostr-watch/apps/relaymon

  echo "Pre-caching dependencies in direct mode (no proxy)..."
  # Make sure no proxy settings are active for this step
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY

  # Cache dependencies
  deno cache --no-lock index.ts || echo "Some dependency caching failed, continuing anyway"
fi

# --- Start hedproxy ---
echo "Starting hedproxy for network operations..."

# Run hedproxy in the background with debug logging
# hedproxy <proto> <bind> <...options>
hedproxy -proto socks -bind "0.0.0.0:$HEDPROXY_PORT" -tor "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" -i2p "$I2P_PROXY_HOST:$I2P_SOCKS_PORT" -passthrough clearnet &
# hedproxy socks "0.0.0.0:$HEDPROXY_PORT" -tor "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" -i2p "$I2P_PROXY_HOST:$I2P_SOCKS_PORT" -passthrough clearnet -logLevel SILENT &
HEDPROXY_PID=$!

# Verify hedproxy is listening (poll up to 10s instead of fixed sleep)
echo "Waiting for hedproxy to bind to port $HEDPROXY_PORT..."
hedproxy_wait=0
while [ $hedproxy_wait -lt 10 ]; do
  if netstat -tlpn 2>/dev/null | grep -q ":$HEDPROXY_PORT\b"; then
    echo "hedproxy is listening on port $HEDPROXY_PORT."
    break
  fi
  sleep 1
  hedproxy_wait=$((hedproxy_wait + 1))
done
if [ $hedproxy_wait -ge 10 ]; then
  echo "ERROR: hedproxy failed to bind to port $HEDPROXY_PORT within 10s"
  exit 1
fi

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
  echo "  • Run verification only:       docker exec <container> /usr/local/bin/entrypoint.sh --verify-network"
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

  local timeout=20
  local max_retries=3
  local retry_delay=5
  local exit_code=0

  # Function to test connection to a domain (with retries)
  test_domain() {
    local proxy_type=$1
    local proxy_addr=$2
    local domain=$3
    local timeout=$4

    local attempt=1
    while [ $attempt -le $max_retries ]; do
      if [ $attempt -gt 1 ]; then
        echo "    Retry $attempt/$max_retries for $domain..."
      else
        echo "  • Testing connection to $domain..."
      fi

      local result=1
      if [ "$proxy_type" = "socks5" ]; then
        curl --socks5-hostname $proxy_addr -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
        result=$?
      elif [ "$proxy_type" = "http" ]; then
        curl -x $proxy_addr -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
        result=$?
      else
        curl -s --head --connect-timeout $timeout http://$domain > /dev/null 2>&1
        result=$?
      fi

      if [ $result -eq 0 ]; then
        return 0
      fi

      attempt=$((attempt + 1))
      if [ $attempt -le $max_retries ]; then
        sleep $retry_delay
      fi
    done
    return 1
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
    echo "❌ Failed to connect to any Tor onion services via hedproxy"
    echo "Diagnostic information:"
    echo "  • Checking direct Tor connection (note: extra time may allow circuits to complete)..."
    local direct_tor_works=false
    for domain in "${tor_domains[@]}"; do
      if test_domain "socks5" "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" "$domain" "$timeout"; then
        echo "    ✓ Direct Tor connection works for $domain"
        direct_tor_works=true
        break
      fi
    done

    if [ "$direct_tor_works" = "true" ]; then
      echo "  • Direct Tor works — retrying hedproxy to rule out timing..."
      for domain in "${tor_domains[@]}"; do
        if test_domain "socks5" "127.0.0.1:$HEDPROXY_PORT" "$domain" "$timeout"; then
          echo "    ✓ Hedproxy now works for $domain (was a timing issue, not hedproxy)"
          tor_success=true
          break
        fi
      done
      if [ "$tor_success" = "false" ]; then
        echo "    ✗ Hedproxy still fails — may be a hedproxy routing issue"
      fi
    else
      echo "    ✗ Direct Tor also fails — Tor circuits may still be building"
    fi

    echo "  • Network configuration:"
    echo "    - Tor proxy: $TOR_PROXY_HOST:$TOR_SOCKS_PORT"
    echo "    - Hedproxy port: $HEDPROXY_PORT"
    if [ "$tor_success" = "false" ]; then
      exit_code=1
    fi
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
    echo "❌ Failed to connect to any I2P services via hedproxy"
    echo "Diagnostic information:"
    local direct_i2p_works=false
    # Check if I2P HTTP proxy is available for diagnostics
    if nc -z $I2P_PROXY_HOST 4444 2>/dev/null; then
      echo "  • I2P HTTP proxy available at $I2P_PROXY_HOST:4444"
      echo "  • Checking direct I2P HTTP proxy connection (note: extra time may allow tunnels to build)..."
      for domain in "${i2p_domains[@]}"; do
        if test_domain "http" "$I2P_PROXY_HOST:4444" "$domain" "$timeout"; then
          echo "    ✓ Direct I2P HTTP proxy works for $domain"
          direct_i2p_works=true
          break
        fi
      done
    else
      echo "  • I2P HTTP proxy not available at $I2P_PROXY_HOST:4444"
    fi

    if [ "$direct_i2p_works" = "true" ]; then
      echo "  • Direct I2P works — retrying hedproxy to rule out timing..."
      for domain in "${i2p_domains[@]}"; do
        if test_domain "socks5" "127.0.0.1:$HEDPROXY_PORT" "$domain" "$timeout"; then
          echo "    ✓ Hedproxy now works for $domain (was a timing issue, not hedproxy)"
          i2p_success=true
          break
        fi
      done
      if [ "$i2p_success" = "false" ]; then
        echo "    ✗ Hedproxy still fails — may be a hedproxy routing issue"
      fi
    else
      echo "    ✗ Direct I2P also fails — I2P tunnels may still be building"
    fi

    echo "  • Network configuration:"
    echo "    - I2P SAM bridge: $I2P_PROXY_HOST:$I2P_SAM_PORT"
    echo "    - Hedproxy port: $HEDPROXY_PORT"
    if [ "$i2p_success" = "false" ]; then
      exit_code=1
    fi
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

# If only verification was requested, exit now
if [ "$VERIFY_ONLY" = "true" ]; then
  echo "Network verification complete, exiting as requested."
  # Kill hedproxy before exiting
  if [ -n "$HEDPROXY_PID" ]; then
    kill $HEDPROXY_PID 2>/dev/null || true
  fi
  exit 0
fi

# --- Hedproxy supervisor (background) ---
# Monitors hedproxy and restarts it if it dies.
# Runs as a background process alongside the main Deno process.
hedproxy_supervisor() {
  local restart_count=0
  local max_restarts=50
  local backoff=5
  local stable_count=0

  while true; do
    sleep 10
    # Check if hedproxy is still listening
    if ! ss -tlpn 2>/dev/null | grep -q ":$HEDPROXY_PORT\b"; then
      restart_count=$((restart_count + 1))
      stable_count=0
      if [ $restart_count -gt $max_restarts ]; then
        echo "[hedproxy-supervisor] Exceeded max restarts ($max_restarts), giving up"
        return 1
      fi
      echo "[hedproxy-supervisor] hedproxy is not listening on port $HEDPROXY_PORT (restart #$restart_count)"
      # Kill any leftover hedproxy processes
      pkill -f "hedproxy.*$HEDPROXY_PORT" 2>/dev/null || true
      sleep 1
      # Restart hedproxy
      hedproxy -proto socks -bind "0.0.0.0:$HEDPROXY_PORT" -tor "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" -i2p "$I2P_PROXY_HOST:$I2P_SOCKS_PORT" -passthrough clearnet &
      sleep 2
      if ss -tlpn 2>/dev/null | grep -q ":$HEDPROXY_PORT\b"; then
        echo "[hedproxy-supervisor] hedproxy restarted successfully (restart #$restart_count)"
      else
        echo "[hedproxy-supervisor] hedproxy failed to restart, retrying in ${backoff}s..."
        sleep $backoff
        backoff=$((backoff * 2))
        if [ $backoff -gt 60 ]; then backoff=60; fi
      fi
    else
      # Reset backoff on successful check
      backoff=5
      # Track stability — reset restart_count after 1 hour of uptime (360 checks × 10s)
      stable_count=$((stable_count + 1))
      if [ $stable_count -ge 360 ]; then
        if [ $restart_count -gt 0 ]; then
          echo "[hedproxy-supervisor] hedproxy stable for 1 hour, resetting restart count (was $restart_count)"
        fi
        restart_count=0
        stable_count=0
      fi
    fi
  done
}

echo "Starting hedproxy supervisor..."
hedproxy_supervisor &

# --- Execute Application ---
echo "Starting RelayMon application..."
echo "Executing with proxychains4: proxychains4 -f /etc/proxychains.conf deno run ... index.ts ${APP_ARGS[*]}"
cd /app/nostr-watch/apps/relaymon
exec proxychains4 -f /etc/proxychains.conf deno run --no-lock --env-file=/app/.env --unstable-sloppy-imports --allow-all index.ts -c /opt/config.yaml "${APP_ARGS[@]}"