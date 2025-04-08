#!/bin/bash

# Transparent Proxy Entrypoint using dnsmasq and redsocks

echo "Starting Transparent Proxy Setup..."

# --- Configuration ---
DNSMASQ_CONF=/etc/dnsmasq.conf
RESOLV_CONF=/etc/resolv.conf
REDSOCKS_CONF=/etc/redsocks.conf
UPSTREAM_DNS="1.1.1.1" # Use a reliable public DNS

TOR_PROXY_HOST="tor-proxy"
TOR_SOCKS_PORT="9050"
TOR_DNS_PORT="5353" # Default Tor SOCKS DNS port

I2P_PROXY_HOST="i2pd"
I2P_HTTP_PROXY_PORT="4444"
# I2P DNS is tricky, rely on redsocks HTTP connect or specific IPs if known

LOKINET_PROXY_HOST="lokinet"
LOKINET_SOCKS_PORT="9060" # From compose file (verify this)
LOKINET_DNS_PORT="5353" # From compose file (verify this)

REDSOCKS_LISTEN_PORT="12345" # Port redsocks listens on (from redsocks.conf)

# IPTables User/Group Exclusions
# Need a non-root user for redsocks (defined in redsocks.conf)
# Create the user/group if they don't exist
REDSOCKS_USER="redsocks"
getent group $REDSOCKS_USER >/dev/null || groupadd $REDSOCKS_USER
getent passwd $REDSOCKS_USER >/dev/null || useradd -r -g $REDSOCKS_USER -s /sbin/nologin $REDSOCKS_USER

# We also need to exclude dnsmasq user (often dnsmasq or nobody)
DNSMASQ_USER="dnsmasq" # Default user for dnsmasq package
getent group $DNSMASQ_USER >/dev/null || groupadd $DNSMASQ_USER
getent passwd $DNSMASQ_USER >/dev/null || useradd -r -g $DNSMASQ_USER -s /sbin/nologin $DNSMASQ_USER


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

wait_for_service $TOR_PROXY_HOST $TOR_SOCKS_PORT "Tor Proxy"
wait_for_service $I2P_PROXY_HOST $I2P_HTTP_PROXY_PORT "I2P Proxy"
wait_for_service $LOKINET_PROXY_HOST $LOKINET_SOCKS_PORT "Lokinet Proxy"


# --- Configure dnsmasq ---
echo "Configuring dnsmasq..."

# dnsmasq config: forward special TLDs, use upstream for others
cat > $DNSMASQ_CONF <<EOF
port=53
resolv-file=$RESOLV_CONF.upstream
user=$DNSMASQ_USER
group=$DNSMASQ_USER
# no-resolv # Don't read /etc/resolv.conf
# no-hosts  # Don't read /etc/hosts

# Forward .onion to Tor DNS
server=/.onion/$TOR_PROXY_HOST#$TOR_DNS_PORT
# Forward .loki to Lokinet DNS
server=/.loki/$LOKINET_PROXY_HOST#$LOKINET_DNS_PORT
# For I2P, resolution often happens via the proxy itself or specific IPs.
# Let redsocks handle connecting to i2pd, which resolves .i2p internally.

# Optional: Cache settings
cache-size=1000
EOF

# Create upstream resolv config
echo "nameserver $UPSTREAM_DNS" > $RESOLV_CONF.upstream

# Configure local system to use dnsmasq
echo "nameserver 127.0.0.1" > $RESOLV_CONF

# Start dnsmasq
echo "Starting dnsmasq..."
dnsmasq --conf-file=$DNSMASQ_CONF --no-daemon & # Run in background


# --- Configure iptables ---
echo "Configuring iptables..."

# Flush rules
iptables -t nat -F
iptables -t nat -X

# === NAT Table ===

# --- Exclusions (OUTPUT chain) ---
# Don't redirect traffic from the proxy users
iptables -t nat -A OUTPUT -m owner --uid-owner $REDSOCKS_USER -j RETURN
iptables -t nat -A OUTPUT -m owner --uid-owner $DNSMASQ_USER -j RETURN

# Don't redirect loopback traffic
iptables -t nat -A OUTPUT -o lo -j RETURN

# Don't redirect traffic to local/internal networks (adjust as needed)
iptables -t nat -A OUTPUT -d 127.0.0.0/8 -j RETURN
iptables -t nat -A OUTPUT -d 192.168.0.0/16 -j RETURN
iptables -t nat -A OUTPUT -d 172.16.0.0/12 -j RETURN
iptables -t nat -A OUTPUT -d 10.0.0.0/8 -j RETURN

# Don't redirect traffic to the proxy services themselves
iptables -t nat -A OUTPUT -d $TOR_PROXY_HOST -j RETURN
iptables -t nat -A OUTPUT -d $I2P_PROXY_HOST -j RETURN
iptables -t nat -A OUTPUT -d $LOKINET_PROXY_HOST -j RETURN

# --- DNS Redirection (OUTPUT chain) ---
# Redirect all DNS queries (UDP/TCP port 53) to local dnsmasq (127.0.0.1:53)
iptables -t nat -A OUTPUT -p udp --dport 53 -j REDIRECT --to-ports 53
iptables -t nat -A OUTPUT -p tcp --dport 53 -j REDIRECT --to-ports 53

# --- TCP Redirection (OUTPUT chain) ---
# Redirect all remaining TCP traffic to the redsocks listener port
# redsocks will then decide which upstream proxy (Tor/I2P/Loki) to use based on its config
# (currently redsocks.conf doesn't differentiate based on destination, needs refinement)
# For now, it sends ALL redirected TCP to the FIRST redsocks {} block (Tor)
#
# !! IMPORTANT !!: The current redsocks.conf sends ALL redirected traffic to Tor.
#    To route based on destination (.onion, .i2p, .loki), redsocks needs patching
#    or a more complex setup (e.g., multiple redsocks instances or a different tool).
#    As a workaround, one could use iptables rules based on resolved IPs if they are known
#    and distinct ranges, redirecting to different redsocks ports per network.
#
#    Example (if Tor IPs known): iptables -t nat -A OUTPUT -p tcp -d <TOR_IP_RANGE> -j REDIRECT --to-port <TOR_REDSOCKS_PORT>
#    Example (if I2P IPs known): iptables -t nat -A OUTPUT -p tcp -d <I2P_IP_RANGE> -j REDIRECT --to-port <I2P_REDSOCKS_PORT>
#
#    For now, we redirect *all* TCP traffic to the single redsocks instance.
#    This means .i2p and .loki might not work correctly unless redsocks is enhanced
#    or the application explicitly uses respective proxies for those.
#
iptables -t nat -A OUTPUT -p tcp -j REDIRECT --to-port $REDSOCKS_LISTEN_PORT

echo "Warning: Current iptables rules redirect ALL TCP traffic via redsocks, which defaults to Tor." 
echo "Routing for I2P/Loki requires redsocks configuration enhancements or specific IP-based rules."

# --- Start redsocks ---
echo "Starting redsocks..."
redsocks -c $REDSOCKS_CONF & # Run in background

# Give services a moment to start
sleep 5

# --- Execute Application ---
echo "Starting RelayMon application..."

cd /app/nostr-watch/apps/relaymon

# Remove potentially problematic env vars
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY I2P_PROXY

# Execute the Deno application as the original user (often root in containers)
# Or switch to a less privileged user if desired/possible
echo "Executing: deno run ... index.ts $@"
exec deno run --allow-ffi --unstable-sloppy-imports --allow-net --allow-env --allow-read --allow-write --allow-run index.ts "$@" 