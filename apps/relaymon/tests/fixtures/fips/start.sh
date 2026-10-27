#!/bin/sh
set -eu

# Only the two test nodes can peer. No host networking, public discovery,
# published ports, or forwarding. Apply policy before starting any daemon.
for firewall in iptables ip6tables; do
  "$firewall" -P INPUT DROP
  "$firewall" -P OUTPUT DROP
  "$firewall" -P FORWARD DROP
  "$firewall" -A INPUT -i lo -j ACCEPT
  "$firewall" -A OUTPUT -o lo -j ACCEPT
  "$firewall" -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  "$firewall" -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
done
iptables -A INPUT -i eth0 -s "$PEER_IP" -p udp --dport 2121 -j ACCEPT
iptables -A OUTPUT -o eth0 -d "$PEER_IP" -p udp --dport 2121 -j ACCEPT
if [ "$ROLE" = relay ]; then
  ip6tables -A INPUT -i fips0 -p tcp --dport 7777 -j ACCEPT
  ip6tables -A OUTPUT -o fips0 -p tcp --dport 7778 -j ACCEPT
else
  ip6tables -A OUTPUT -o fips0 -p tcp --dport 7777 -j ACCEPT
  ip6tables -A INPUT -i fips0 -p tcp --dport 7778 -j DROP
fi

mkdir -p /run/fips
fips --config /fixture/node.yaml > /tmp/fips.log 2>&1 &
mesh_pid=$!
cleanup() { kill "$mesh_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for attempt in $(seq 1 30); do
  if ! kill -0 "$mesh_pid" 2>/dev/null; then cat /tmp/fips.log; exit 1; fi
  if ip link show fips0 >/dev/null 2>&1; then break; fi
  sleep 0.1
done
ip link show fips0 >/dev/null
if [ "$ROLE" = relay ]; then
  deno run --cached-only --no-lock --no-check --unstable-sloppy-imports --allow-all tests/fixtures/fips/relay.ts
else
  # Deliberately bind a container-only sentinel to prove mesh ingress is denied.
  deno run --cached-only --no-lock --no-check --unstable-sloppy-imports --allow-all tests/fixtures/fips/relay.ts sentinel
fi
