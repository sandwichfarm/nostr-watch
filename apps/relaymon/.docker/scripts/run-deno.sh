#!/bin/bash
# Script to run Deno directly with the proper arguments

cd /app/nostr-watch/apps/relaymon

echo "Running RelayMon with Deno directly"
exec deno run --allow-ffi --unstable-sloppy-imports --allow-net --allow-env --allow-read --allow-write --allow-run index.ts "$@" 