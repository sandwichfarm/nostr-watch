#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SESSION_NAME="relayvm-smoke-tests"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${YELLOW}RelayVM Smoke Test Runner${NC}"
echo "=========================="

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux is not installed${NC}"
    echo "Install with: sudo apt install tmux  (or sudo pacman -S tmux)"
    exit 1
fi

# Kill existing session if it exists
tmux has-session -t $SESSION_NAME 2>/dev/null && {
    echo "Killing existing session..."
    tmux kill-session -t $SESSION_NAME
}

# Generate ephemeral keys for this test run
echo -e "${YELLOW}Generating ephemeral keys for test...${NC}"

if ! command -v nak &> /dev/null; then
    echo -e "${RED}Error: nak is required for smoke tests${NC}"
    echo "Install with: go install github.com/fiatjaf/nak@latest"
    exit 1
fi

# Generate server key pair
SMOKE_SERVER_NSEC=$(nak key generate)
SMOKE_SERVER_PUBKEY=$(nak key public "$SMOKE_SERVER_NSEC")

echo -e "${GREEN}Generated ephemeral server key${NC}"
echo -e "${GREEN}  nsec: ${SMOKE_SERVER_NSEC:0:20}...${NC}"
echo -e "${GREEN}  npub: $SMOKE_SERVER_PUBKEY${NC}"

# Generate client key pair
SMOKE_CLIENT_NSEC=$(nak key generate)
SMOKE_CLIENT_PUBKEY=$(nak key public "$SMOKE_CLIENT_NSEC")

echo -e "${GREEN}Generated ephemeral client key${NC}"
echo -e "${GREEN}  nsec: ${SMOKE_CLIENT_NSEC:0:20}...${NC}"
echo -e "${GREEN}  npub: $SMOKE_CLIENT_PUBKEY${NC}"

# Start nak in-memory relay in background (for testing)
echo -e "${YELLOW}Starting nak in-memory relay on ws://localhost:6969...${NC}"
if command -v nak &> /dev/null; then
  nak serve --port 6969 > /tmp/nak-relay.log 2>&1 &
  NAK_PID=$!
  echo -e "${GREEN}nak serve started (PID: $NAK_PID)${NC}"
  sleep 2
else
  echo -e "${RED}Error: nak is required for smoke tests${NC}"
  echo "Install with: go install github.com/fiatjaf/nak@latest"
  exit 1
fi

# Create test pane script with embedded pubkey
cat > "$SCRIPT_DIR/.run-smoke-tests-pane.sh" << 'EOFPANE'
#!/bin/bash
# This script runs in the tmux test pane

set -e

clear
echo "Waiting for server to start..."

# Wait for REST API to be ready (with timeout)
MAX_WAIT=30
WAIT_COUNT=0
REST_URL="http://127.0.0.1:3000/health/ping"

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  if curl -s -f "$REST_URL" > /dev/null 2>&1; then
    echo "✓ Server is ready!"
    break
  fi
  NEXT=$((WAIT_COUNT + 1))
  echo "  Waiting... ($NEXT/$MAX_WAIT)"
  sleep 1
  WAIT_COUNT=$NEXT
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
  echo "✗ Timeout waiting for server to start"
  exit 1
fi

echo ""
echo "==================================="
echo "  Running Full Smoke Tests"
echo "==================================="
echo ""

# Run smoke tests with ephemeral keys
export SMOKE_SERVER_PUBKEY=PUBKEY_PLACEHOLDER
export SMOKE_CLIENT_KEY=CLIENTKEY_PLACEHOLDER
export SMOKE_RELAYS=ws://localhost:6969
npm run test:smoke:full

# Cleanup
echo ""
echo "Cleaning up test relay..."
pkill -f "nak serve" 2>/dev/null || true
EOFPANE

# Replace the placeholders with actual keys
sed -i "s/PUBKEY_PLACEHOLDER/$SMOKE_SERVER_PUBKEY/" "$SCRIPT_DIR/.run-smoke-tests-pane.sh"
sed -i "s/CLIENTKEY_PLACEHOLDER/$SMOKE_CLIENT_NSEC/" "$SCRIPT_DIR/.run-smoke-tests-pane.sh"

chmod +x "$SCRIPT_DIR/.run-smoke-tests-pane.sh"

# Create new tmux session with two panes
echo -e "${YELLOW}Creating tmux session...${NC}"
tmux new-session -d -s $SESSION_NAME -n "smoke-tests"

# Left pane: Start server with ephemeral key and local relay
tmux send-keys -t $SESSION_NAME:0.0 "cd $SCRIPT_DIR" C-m
tmux send-keys -t $SESSION_NAME:0.0 "clear" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo 'Starting RelayVM server with ephemeral key...'" C-m
tmux send-keys -t $SESSION_NAME:0.0 "CVM_SERVER_NSEC=$SMOKE_SERVER_NSEC CVM_RELAYS=ws://localhost:6969 npm start" C-m

# Split window horizontally
tmux split-window -h -t $SESSION_NAME:0

# Right pane: Run test script (pubkey already embedded)
tmux send-keys -t $SESSION_NAME:0.1 "cd $SCRIPT_DIR" C-m
tmux send-keys -t $SESSION_NAME:0.1 "./.run-smoke-tests-pane.sh" C-m

# Set pane layout (50/50 split)
tmux select-layout -t $SESSION_NAME:0 even-horizontal

# Attach to the session
echo -e "${GREEN}Attaching to tmux session...${NC}"
echo -e "${YELLOW}Tips:${NC}"
echo "  - Left pane: Server logs"
echo "  - Right pane: Test output"
echo "  - Ctrl+B then arrow keys: Switch panes"
echo "  - Ctrl+C in left pane: Stop server"
echo "  - Type 'exit' in each pane to close"
echo ""
sleep 2

tmux attach-session -t $SESSION_NAME
