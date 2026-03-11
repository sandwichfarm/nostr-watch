#!/bin/bash
#
# Fedproxy Network Connectivity Test Script
# This script tests connectivity to Tor, I2P, and Lokinet networks through fedproxy
#

set -e

# --- Configuration (can be overridden with environment variables) ---
TOR_PROXY_HOST="${TOR_PROXY_HOST:-tor-proxy}"
TOR_SOCKS_PORT="${TOR_SOCKS_PORT:-9050}"

I2P_PROXY_HOST="${I2P_PROXY_HOST:-i2pd}"
I2P_SAM_PORT="${I2P_SAM_PORT:-4447}"
I2P_HTTP_PORT="${I2P_HTTP_PORT:-4444}"

LOKINET_PROXY_HOST="${LOKINET_PROXY_HOST:-lokinet}"
LOKINET_SOCKS_PORT="${LOKINET_SOCKS_PORT:-9060}"

FEDPROXY_PORT="${FEDPROXY_PORT:-12345}"
FEDPROXY_HOST="${FEDPROXY_HOST:-127.0.0.1}"

VERBOSE="${VERBOSE:-false}"
MAX_RETRIES="${MAX_RETRIES:-3}"
TIMEOUT="${TIMEOUT:-10}"

# --- Helper Functions ---
print_banner() {
  echo "============================================="
  echo "$1"
  echo "============================================="
}

print_section() {
  echo "---------------------------------------------"
  echo "$1"
  echo "---------------------------------------------"
}

# Pretty status indicators
info_icon="ℹ️"
success_icon="✅"
warning_icon="⚠️"
error_icon="❌"
test_icon="🧪"
waiting_icon="🕒"
retry_icon="🔄"
diagnostic_icon="📊"

log_info() {
  echo "$info_icon $1"
}

log_success() {
  echo "$success_icon $1"
}

log_warning() {
  echo "$warning_icon $1"
}

log_error() {
  echo "$error_icon $1"
}

# --- Wait Functions ---
wait_for_service() {
  local host=$1
  local port=$2
  local name=$3
  local max_attempts=10
  local attempt=1
  
  log_info "Waiting for $name service at $host:$port..."
  
  while [ $attempt -le $max_attempts ]; do
    if nc -z $host $port 2>/dev/null; then
      log_success "$name service is available at $host:$port"
      return 0
    else
      echo "$waiting_icon Attempt $attempt/$max_attempts: $name service not available yet..."
      sleep 2
      attempt=$((attempt + 1))
    fi
  done
  
  log_error "Failed to connect to $name service after $max_attempts attempts"
  return 1
}

# --- Test Function ---
test_connection() {
  local network=$1
  local domain=$2
  local retry_count=0
  
  echo "$retry_icon Testing $network connection to $domain..."
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    if [ "$VERBOSE" = "true" ]; then
      echo "curl --socks5-hostname $FEDPROXY_HOST:$FEDPROXY_PORT -s --connect-timeout $TIMEOUT http://$domain"
    fi
    
    if curl --socks5-hostname $FEDPROXY_HOST:$FEDPROXY_PORT -s --head --connect-timeout $TIMEOUT http://$domain > /dev/null 2>&1; then
      log_success "$network connection to $domain successful!"
      return 0
    else
      retry_count=$((retry_count + 1))
      if [ $retry_count -lt $MAX_RETRIES ]; then
        log_warning "$network connection to $domain failed, retrying ($retry_count/$MAX_RETRIES)..."
        sleep 2
      fi
    fi
  done
  
  log_error "$network connection to $domain failed after $MAX_RETRIES attempts"
  return 1
}

# --- Main Test Function ---
run_tests() {
  print_banner "$test_icon Testing fedproxy connections to different networks"
  
  # Test domains for each network
  local tor_test_domains=(
    "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion:80"  # DuckDuckGo onion
    "vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd.onion:80"  # Tor Project website
    "proof.torch.sh:80" # Torch onion test site
  )
  
  local i2p_test_domains=(
    "stats.i2p:80"  # I2P stats site
    "i2p-projekt.i2p:80"  # I2P project website
    "planet.i2p:80" # I2P planet site
  )
  
  local lokinet_test_domains=(
    "dw68y1xhptqbhcm5s8aaaip6dbopykagig5q5u1za4c7pzxto77y.loki:80"  # Lokinet test site
    "oxen.io.loki:80"  # Oxen website
  )
  
  # --- Check if services are available ---
  wait_for_service $TOR_PROXY_HOST $TOR_SOCKS_PORT "Tor Proxy" || tor_unavailable=true
  wait_for_service $I2P_PROXY_HOST $I2P_SAM_PORT "I2P SAM Bridge" || i2p_unavailable=true
  
  # Lokinet is optional
  if nc -z $LOKINET_PROXY_HOST $LOKINET_SOCKS_PORT 2>/dev/null; then
    log_info "Lokinet service is available at $LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT"
    lokinet_available=true
  else
    log_info "Lokinet service is not available, will skip Lokinet tests"
    lokinet_available=false
  fi
  
  # --- Check if fedproxy is running ---
  if ! nc -z $FEDPROXY_HOST $FEDPROXY_PORT 2>/dev/null; then
    log_info "Starting fedproxy..."
    
    # Start fedproxy in the background
    fedproxy socks "0.0.0.0:$FEDPROXY_PORT" "$TOR_PROXY_HOST:$TOR_SOCKS_PORT" "$I2P_PROXY_HOST:$I2P_SAM_PORT" &
    FEDPROXY_PID=$!
    
    # Give fedproxy a moment to start
    sleep 3
    
    if ! nc -z $FEDPROXY_HOST $FEDPROXY_PORT 2>/dev/null; then
      log_error "Failed to start fedproxy. Exiting."
      exit 1
    else
      log_success "Fedproxy started successfully on port $FEDPROXY_PORT"
    fi
  else
    log_info "Using existing fedproxy instance at $FEDPROXY_HOST:$FEDPROXY_PORT"
  fi
  
  # --- Test Tor connections ---
  if [ "$tor_unavailable" != "true" ]; then
    print_section "🧅 Testing Tor connections"
    local tor_success=false
    
    for domain in "${tor_test_domains[@]}"; do
      if test_connection "Tor" "$domain"; then
        tor_success=true
        break
      fi
    done
    
    if [ "$tor_success" = true ]; then
      log_success "Tor network is accessible through fedproxy"
    else
      log_error "Failed to connect to any Tor test domains. Tor may not be functioning properly."
      echo "$diagnostic_icon Diagnostic information:"
      echo "  - Tor proxy configured at: $TOR_PROXY_HOST:$TOR_SOCKS_PORT"
      if [ "$VERBOSE" = "true" ]; then
        echo "Running direct Tor diagnostic:"
        curl --socks5-hostname $TOR_PROXY_HOST:$TOR_SOCKS_PORT -v http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion 2>&1 | grep -i "connected\|proxy\|fail\|error"
      fi
    fi
  fi
  
  # --- Test I2P connections ---
  if [ "$i2p_unavailable" != "true" ]; then
    print_section "🏄 Testing I2P connections"
    local i2p_success=false
    
    for domain in "${i2p_test_domains[@]}"; do
      if test_connection "I2P" "$domain"; then
        i2p_success=true
        break
      fi
    done
    
    if [ "$i2p_success" = true ]; then
      log_success "I2P network is accessible through fedproxy"
    else
      log_error "Failed to connect to any I2P test domains. I2P may not be functioning properly."
      echo "$diagnostic_icon Diagnostic information:"
      echo "  - I2P SAM bridge configured at: $I2P_PROXY_HOST:$I2P_SAM_PORT"
      # Check if I2P HTTP proxy is accessible
      if nc -z $I2P_PROXY_HOST $I2P_HTTP_PORT 2>/dev/null; then
        log_info "I2P HTTP proxy is available at $I2P_PROXY_HOST:$I2P_HTTP_PORT"
        if [ "$VERBOSE" = "true" ]; then
          echo "Testing direct I2P HTTP proxy:"
          curl -x http://$I2P_PROXY_HOST:$I2P_HTTP_PORT -v http://stats.i2p 2>&1 | grep -i "connected\|proxy\|fail\|error"
        fi
      else
        log_warning "I2P HTTP proxy is not available at $I2P_PROXY_HOST:$I2P_HTTP_PORT"
      fi
    fi
  fi
  
  # --- Test Lokinet connections ---
  if [ "$lokinet_available" = true ]; then
    print_section "🔒 Testing Lokinet connections"
    local lokinet_success=false
    
    for domain in "${lokinet_test_domains[@]}"; do
      if test_connection "Lokinet" "$domain"; then
        lokinet_success=true
        break
      fi
    done
    
    if [ "$lokinet_success" = true ]; then
      log_success "Lokinet is accessible through fedproxy"
    else
      log_error "Failed to connect to any Lokinet test domains. Lokinet may not be functioning properly."
      echo "$diagnostic_icon Diagnostic information:"
      echo "  - Lokinet proxy configured at: $LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT"
      if [ "$VERBOSE" = "true" ]; then
        echo "Testing direct Lokinet connection:"
        curl --socks5-hostname $LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT -v http://dw68y1xhptqbhcm5s8aaaip6dbopykagig5q5u1za4c7pzxto77y.loki 2>&1 | grep -i "connected\|proxy\|fail\|error"
      fi
    fi
  fi
  
  print_banner "🔍 Fedproxy connection tests completed"
  
  # Cleanup if we started fedproxy
  if [ -n "$FEDPROXY_PID" ]; then
    log_info "Stopping fedproxy instance (PID: $FEDPROXY_PID)"
    kill $FEDPROXY_PID 2>/dev/null || true
  fi
}

# --- Parse Command Line Arguments ---
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -h, --help                 Show this help message"
  echo "  -v, --verbose              Enable verbose output"
  echo "  -t, --tor-proxy HOST:PORT  Specify Tor proxy (default: $TOR_PROXY_HOST:$TOR_SOCKS_PORT)"
  echo "  -i, --i2p-proxy HOST:PORT  Specify I2P SAM bridge (default: $I2P_PROXY_HOST:$I2P_SAM_PORT)"
  echo "  -l, --lokinet HOST:PORT    Specify Lokinet proxy (default: $LOKINET_PROXY_HOST:$LOKINET_SOCKS_PORT)"
  echo "  -f, --fedproxy HOST:PORT   Specify fedproxy address (default: $FEDPROXY_HOST:$FEDPROXY_PORT)"
  echo "  -r, --retries N            Number of retry attempts (default: $MAX_RETRIES)"
  echo "  --timeout N                Connection timeout in seconds (default: $TIMEOUT)"
}

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -t|--tor-proxy)
      IFS=':' read -r TOR_PROXY_HOST TOR_SOCKS_PORT <<< "$2"
      shift 2
      ;;
    -i|--i2p-proxy)
      IFS=':' read -r I2P_PROXY_HOST I2P_SAM_PORT <<< "$2"
      shift 2
      ;;
    -l|--lokinet)
      IFS=':' read -r LOKINET_PROXY_HOST LOKINET_SOCKS_PORT <<< "$2"
      shift 2
      ;;
    -f|--fedproxy)
      IFS=':' read -r FEDPROXY_HOST FEDPROXY_PORT <<< "$2"
      shift 2
      ;;
    -r|--retries)
      MAX_RETRIES=$2
      shift 2
      ;;
    --timeout)
      TIMEOUT=$2
      shift 2
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Run the tests
run_tests

exit 0 