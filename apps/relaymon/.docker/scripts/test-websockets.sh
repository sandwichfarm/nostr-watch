#!/bin/bash

# WebSocket connectivity test for Tor and clearnet
# To be called from entrypoint.sh with: 
# VERIFY_WEBSOCKETS=true or by running the container with --verify-websockets

echo "═════════════════════════════════════════════"
echo "Testing WebSocket connectivity through proxy chain..."
echo "═════════════════════════════════════════════"

# Check proxy environment
echo "Proxy environment:"
for var in http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY; do
  if [ -n "${!var}" ]; then
    echo "  $var: ${!var}"
  fi
done

# Create temporary test script
TEMP_SCRIPT="/tmp/test-websockets.js"
cat > $TEMP_SCRIPT << 'EOL'
// WebSocket test script

const TIMEOUT = 15000;
const TEST_URLS = {
  clearnet: [
    { url: "wss://relay.damus.io", label: "Damus relay" },
    { url: "wss://nostr.bitcoiner.social", label: "Bitcoiner Social" }
  ],
  tor: [
    { url: "wss://damus.io.onion", label: "Damus Tor relay" },
    { url: "wss://xjnq5d6nqk4qadetjbre5ctzwcuwz5c2q737xbiye4riwxqcg3ddgqid.onion", label: "nostr.wine Tor" }
  ]
};

const connectWebSocket = (url) => {
  return new Promise((resolve) => {
    console.log(`Testing WebSocket connection to ${url}`);
    
    let timeout;
    let success = false;
    
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log(`✅ Connection successful to ${url}`);
        clearTimeout(timeout);
        ws.close();
        success = true;
        resolve(true);
      };
      
      ws.onerror = (err) => {
        console.log(`❌ Connection error to ${url}`);
        // Don't resolve here, wait for onclose
      };
      
      ws.onclose = () => {
        if (!success) {
          console.log(`❌ Connection closed or failed to ${url}`);
          clearTimeout(timeout);
          resolve(false);
        }
      };
      
      timeout = setTimeout(() => {
        console.log(`⏱️ Connection timeout to ${url}`);
        ws.close();
        resolve(false);
      }, TIMEOUT);
    } catch (err) {
      console.log(`❌ Exception connecting to ${url}: ${err.message}`);
      resolve(false);
    }
  });
};

const runTests = async () => {
  console.log("\n=== CLEARNET WEBSOCKET TESTS ===");
  let clearnetSuccess = false;
  
  for (const {url, label} of TEST_URLS.clearnet) {
    console.log(`\nTesting ${label} (${url})...`);
    const result = await connectWebSocket(url);
    if (result) clearnetSuccess = true;
  }
  
  console.log("\n=== TOR ONION WEBSOCKET TESTS ===");
  let torSuccess = false;
  
  for (const {url, label} of TEST_URLS.tor) {
    console.log(`\nTesting ${label} (${url})...`);
    const result = await connectWebSocket(url);
    if (result) torSuccess = true;
  }
  
  console.log("\n=== RESULTS SUMMARY ===");
  console.log(`Clearnet WebSockets: ${clearnetSuccess ? '✅ WORKING' : '❌ FAILING'}`);
  console.log(`Tor WebSockets: ${torSuccess ? '✅ WORKING' : '❌ FAILING'}`);
  
  // Return a status code based on results
  if (!clearnetSuccess && !torSuccess) {
    console.log("\n❌ ALL TESTS FAILED - Check proxy configuration");
    return 2;
  } else if (clearnetSuccess && !torSuccess) {
    console.log("\n⚠️ TOR TESTS FAILED - Check .onion routing configuration");
    return 1;
  } else {
    console.log("\n✅ ALL TESTS PASSED");
    return 0;
  }
};

runTests().then(code => {
  if (code !== 0) {
    console.log("\nPossible solutions if Tor WebSockets are failing:");
    console.log("1. Check if fedproxy is correctly routing .onion domains");
    console.log("2. Verify Tor SOCKS proxy accepts connections from fedproxy");
    console.log("3. Make sure to use socks5h:// protocol (not socks5://) for .onion hostname resolution");
  }
});
EOL

# Run the test with Deno
echo "Running WebSocket connectivity tests..."
if deno run --allow-net $TEMP_SCRIPT; then
  echo "✅ WebSocket tests completed successfully!"
  EXIT_CODE=0
else
  EXIT_CODE=$?
  echo "⚠️ WebSocket tests failed with code $EXIT_CODE"
fi

# Clean up
rm $TEMP_SCRIPT

# Prepare extended tests
if [ "${EXTENDED_TESTS}" = "true" ]; then
  echo "Running extended tests for proxy chain..."
  
  # Test direct connection to Tor proxy (bypassing the proxy chain)
  echo "Testing direct connection to Tor proxy..."
  if curl --socks5-hostname tor-proxy:9050 -s --head --connect-timeout 10 \
     https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/ | grep -q "HTTP/"; then
    echo "✅ Direct connection to Tor proxy successful"
  else
    echo "❌ Direct connection to Tor proxy failed"
    # Don't fail the script for this test
  fi
  
  # Test dante configuration
  echo "Checking Dante SOCKS server configuration..."
  if grep -q "socks_v5" /etc/danted.conf; then
    echo "✅ Dante is configured for SOCKS5"
  else
    echo "⚠️ Dante might not be configured for SOCKS5 correctly"
  fi
  
  # Check routing for .onion domains
  echo "Testing host resolution for .onion domains..."
  if host -t a duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion 2>&1 | grep -q "NXDOMAIN"; then
    echo "✅ .onion domains correctly not resolvable by normal DNS (expected)"
  else
    echo "⚠️ Unexpected DNS behavior for .onion domains"
  fi
fi

echo "═════════════════════════════════════════════"
exit $EXIT_CODE 