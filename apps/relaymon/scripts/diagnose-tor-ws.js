// Simple Tor WebSocket diagnostics script
// Run with: deno run --allow-net --allow-env diagnose-tor-ws.js

import { UniversalWebSocket } from "../../../libraries/websocket/src/index.ts";

// Configuration
const TIMEOUT_MS = 15000;
const TEST_URLS = {
  clearnet: [
    { url: "wss://relay.damus.io", label: "Damus relay (clearnet)" },
    { url: "wss://nostr.bitcoiner.social", label: "Bitcoiner Social relay (clearnet)" }
  ],
  tor: [
    { url: "ws://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion", label: "Tor relay 1" },
    { url: "ws://2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion", label: "Tor relay 2" }
  ]
};

// Test a single WebSocket connection
async function testConnection(urlInfo) {
  console.log(`\nTesting: ${urlInfo.label} - ${urlInfo.url}`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timeoutId;
    let loggedError = false;
    
    try {
      // Create WebSocket connection
      const ws = new UniversalWebSocket(urlInfo.url, [], { connectTimeout: TIMEOUT_MS });
      
      // Set up event handlers
      ws.on("open", () => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.log(`✅ SUCCESS: Connected in ${duration}ms`);
        ws.close();
        resolve(true);
      });
      
      ws.on("error", () => {
        if (!loggedError) {
          loggedError = true;
          const duration = Date.now() - startTime;
          console.log(`❌ ERROR: Failed to connect after ${duration}ms`);
          console.log(`   Error connecting to ${urlInfo.url}`);
        }
      });
      
      ws.on("close", (event) => {
        if (!ws.isOpen() && !loggedError) {
          const duration = Date.now() - startTime;
          console.log(`❌ CLOSED: Connection closed before opening after ${duration}ms`);
          console.log(`   Close code: ${event.code}`);
        }
        clearTimeout(timeoutId);
        resolve(false);
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        if (!loggedError) {
          loggedError = true;
          console.log(`⏱️ TIMEOUT: Connection timed out after ${TIMEOUT_MS}ms`);
        }
        ws.terminate();
        resolve(false);
      }, TIMEOUT_MS);
      
    } catch (err) {
      if (!loggedError) {
        loggedError = true;
        console.log(`❌ EXCEPTION: ${err.message || err}`);
      }
      resolve(false);
    }
  });
}

// Check proxy settings
function checkProxySettings() {
  console.log("\n=== PROXY ENVIRONMENT SETTINGS ===");
  
  const proxyVars = ["http_proxy", "https_proxy", "all_proxy", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"];
  let foundProxy = false;
  
  for (const varName of proxyVars) {
    // Use globalThis approach which works in both browser and Deno
    const value = globalThis.Deno?.env?.get?.(varName);
    if (value) {
      foundProxy = true;
      const isCorrectFormat = value.startsWith("socks5h://");
      console.log(`${varName}: ${value} ${isCorrectFormat ? '✅' : '⚠️'}`);
      
      if (!isCorrectFormat) {
        console.log(`   ⚠️ For .onion domains, proxy should use socks5h:// (not socks5://)`);
      }
    }
  }
  
  if (!foundProxy) {
    console.log("❌ No proxy environment variables found!");
    console.log("   Set http_proxy, https_proxy, all_proxy to socks5h://127.0.0.1:12346");
  }
  
  return foundProxy;
}

// Check TCP connectivity to proxies
async function checkProxyConnectivity() {
  console.log("\n=== PROXY CONNECTIVITY ===");
  
  const proxies = [
    { host: "127.0.0.1", port: 12346, label: "Dante SOCKS" },
    { host: "127.0.0.1", port: 12345, label: "fedproxy" },
    { host: "tor-proxy", port: 9050, label: "Tor SOCKS" }
  ];
  
  for (const proxy of proxies) {
    try {
      console.log(`Testing connection to ${proxy.label} (${proxy.host}:${proxy.port})...`);
      const startTime = Date.now();
      
      if (!globalThis.Deno?.connect) {
        console.log(`⚠️ Cannot test direct TCP connection to ${proxy.label} (Deno.connect not available)`);
        continue;
      }
      
      const conn = await Promise.race([
        globalThis.Deno.connect({ hostname: proxy.host, port: proxy.port }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), 3000))
      ]);
      
      conn.close();
      const duration = Date.now() - startTime;
      console.log(`✅ Connected to ${proxy.label} in ${duration}ms`);
    } catch (err) {
      console.log(`❌ Failed to connect to ${proxy.label}: ${err.message}`);
    }
  }
}

// Run all tests
async function runDiagnostics() {
  console.log("========================================");
  console.log("TOR WEBSOCKET CONNECTIVITY DIAGNOSTICS");
  console.log("========================================");
  
  // Check proxy environment
  const hasProxyEnv = checkProxySettings();
  if (!hasProxyEnv) {
    console.log("\n⚠️ Missing proxy environment settings. Tests will likely fail.");
  }
  
  // Check proxy connectivity
  await checkProxyConnectivity();
  
  // Test clearnet connections
  console.log("\n=== CLEARNET WEBSOCKET TESTS ===");
  let clearnetSuccess = false;
  for (const urlInfo of TEST_URLS.clearnet) {
    const success = await testConnection(urlInfo);
    if (success) {
      clearnetSuccess = true;
    }
  }
  
  // Test tor connections
  console.log("\n=== TOR ONION WEBSOCKET TESTS ===");
  let torSuccess = false;
  for (const urlInfo of TEST_URLS.tor) {
    const success = await testConnection(urlInfo);
    if (success) {
      torSuccess = true;
    }
  }
  
  // Summary
  console.log("\n=== DIAGNOSTICS SUMMARY ===");
  console.log(`Clearnet WebSockets: ${clearnetSuccess ? '✅ WORKING' : '❌ FAILING'}`);
  console.log(`Tor WebSockets: ${torSuccess ? '✅ WORKING' : '❌ FAILING'}`);
  
  if (clearnetSuccess && !torSuccess) {
    console.log("\n🔍 DIAGNOSIS: Clearnet works but Tor doesn't");
    console.log("\nMost likely issues:");
    console.log("1. fedproxy isn't correctly routing .onion domains to Tor");
    console.log("2. Tor proxy is rejecting connections from fedproxy");
    console.log("3. Proxy chain isn't properly set up for DNS resolution of .onion domains");
    console.log("\nTry these fixes:");
    console.log("1. Ensure HTTP_PROXY environment variable uses socks5h:// protocol");
    console.log("2. Check Tor configuration to accept connections from Docker network");
    console.log("3. Verify fedproxy is correctly routing .onion domains to Tor");
  } else if (!clearnetSuccess && !torSuccess) {
    console.log("\n🔍 DIAGNOSIS: Both clearnet and Tor connections are failing");
    console.log("\nMost likely issues:");
    console.log("1. Proxy chain is completely broken or misconfigured");
    console.log("2. Network connectivity issues in the container");
    console.log("\nTry these fixes:");
    console.log("1. Check all proxy components are running (fedproxy, dante, tor)");
    console.log("2. Verify proxy environment variables are set correctly");
  }
}

// Run the diagnostics
runDiagnostics(); 