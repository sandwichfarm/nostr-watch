#!/bin/bash
# This script chooses the appropriate proxy method based on provided domain

# Look for an onion URL in arguments
for arg in "$@"; do
  if [[ "$arg" == *".onion"* ]]; then
    echo "Running with torsocks for .onion domain" >&2
    export TORSOCKS_CONF_FILE=/etc/torsocks.conf
    exec torsocks "$@"
    exit 0
  fi
done

# For all other URLs, use standard routing with Privoxy
echo "Running with standard routing" >&2
export HTTP_PROXY="http://127.0.0.1:8118"
export HTTPS_PROXY="http://127.0.0.1:8118"
exec "$@" 