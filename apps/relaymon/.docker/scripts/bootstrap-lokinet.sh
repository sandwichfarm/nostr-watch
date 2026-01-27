#!/bin/bash

# Handle resolv.conf setup
echo "Setting up DNS configuration..."
# Make sure we don't try to modify the host's resolv.conf
mkdir -p /etc/resolvconf/run/
touch /etc/resolvconf/run/enable-updates
# Create a copy we can safely modify
cp /etc/resolv.conf /etc/resolv.conf.lokinet

# Generate a new config if one doesn't exist
if [ ! -f /var/lib/lokinet/lokinet.ini ]; then
    echo "Generating new Lokinet configuration..."
    # Skip bootstrap since we'll configure manually
    # lokinet-bootstrap

    # Configure Lokinet to start SOCKS proxy
    cat > /var/lib/lokinet/lokinet.ini <<EOF
[lokinet]
netid=service
keyfile=/var/lib/lokinet/lokinet.key
contact-file=/var/lib/lokinet/self.signed
encryption-privkey=/var/lib/lokinet/encryption.key

[bootstrap]
add-node=public.loki.foundation
add-node=iowvtksyxajfgj7itagimtnvdpgkjk4e6f5budrjbyodzetvcgbq.loki

[network]
ifname=lokitun0
ifaddr=10.0.0.1/16
keyfile=/var/lib/lokinet/lokinet.key

[api]
enabled=true
bind=127.0.0.1:1190

[dns]
bind=127.0.0.1:53
upstream=1.1.1.1
# Use internal DNS, not host system
# We're not modifying the system resolv.conf
upstream-only=true

[router]
min-connections=20

[logging]
level=info

[services]
enabled=true

[stream]
enabled=true
socks=true
socks-port=9050
EOF
fi

# Generate key if it doesn't exist
if [ ! -f /var/lib/lokinet/lokinet.key ]; then
    echo "Generating new Lokinet private key..."
    dd if=/dev/urandom of=/var/lib/lokinet/lokinet.key bs=8 count=8 2>/dev/null
fi

# Start Lokinet in the foreground with verbose output
echo "Starting Lokinet..."
exec lokinet -f -v --configfile=/var/lib/lokinet/lokinet.ini 