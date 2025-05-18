#!/bin/bash

# Database repair script
# This script dumps the database, filters out duplicates, and rebuilds a clean database

# Configuration
SOURCE_DB="./data/relaymon2.db"
TEMP_DIR="./data/repair_temp"
DUMP_FILE="$TEMP_DIR/dump.sql"
CLEAN_DUMP="$TEMP_DIR/clean_dump.sql"
NEW_DB="./data/relaymon2_fixed.db"

# Create temp directory
mkdir -p "$TEMP_DIR"

echo "Dumping database from $SOURCE_DB..."
sqlite3 "$SOURCE_DB" ".dump" > "$DUMP_FILE"

if [ $? -ne 0 ]; then
  echo "Error: Failed to dump database."
  exit 1
fi

echo "Filtering duplicate entries..."
grep -v "INSERT INTO relay_status VALUES('ws://100.100.173.81:4848/'," "$DUMP_FILE" | \
grep -v "INSERT INTO relay_status VALUES('ws://100.100.36.100:4848/'," > "$CLEAN_DUMP"

echo "Creating new database..."
rm -f "$NEW_DB"
sqlite3 "$NEW_DB" < "$CLEAN_DUMP"

if [ $? -ne 0 ]; then
  echo "Error: Failed to create new database."
  exit 1
fi

echo "Adding unique entries for problematic relays..."
sqlite3 "$NEW_DB" "INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network, retries) VALUES ('ws://100.100.173.81:4848/', 0, 0, '', 1744104452, -1, 'clearnet', 392);"
sqlite3 "$NEW_DB" "INSERT INTO relay_status (url, online, ignore, parent, checked_at, rtt, network, retries) VALUES ('ws://100.100.36.100:4848/', 0, 0, '', 1744104452, -1, 'clearnet', 391);"

echo "Validating new database..."
sqlite3 "$NEW_DB" "PRAGMA integrity_check;"

echo "Repair complete. New database is at $NEW_DB"
echo "To use the new database, update the db.path setting in config.yaml to point to $NEW_DB"
echo "or run: cp $NEW_DB $SOURCE_DB (after backing up the original)" 