import { UniversalWebSocket } from "../../../../libraries/websocket/src/index.ts";

// Types
export interface ConnectionResult {
  success: boolean;
  durationMs: number;
  error?: Error;
  stage?: string;
  details?: Record<string, any>;
}

export interface ProxyConfig {
  type: "socks5" | "http" | "direct";
  host: string;
  port: number;
  label: string;
}

// Utility to test TCP connection using fetch or custom sockets
export async function testTcpConnection(
  host: string, 
  port: number,
  timeout = 5000
): Promise<ConnectionResult> {
  const startTime = Date.now();
  
  try {
    // For Node/Deno environments, we'll use the built-in TCP client
    // This is a simplified version that works in Deno
    if (globalThis.Deno) {
      const conn = await Promise.race([
        Deno.connect({ hostname: host, port }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Connection timed out")), timeout)
        )
      ]);
      
      // Close the connection immediately
      conn.close();
      
      return {
        success: true,
        durationMs: Date.now() - startTime
      };
    } 
    
    // Fallback for browser environments - try to fetch with appropriate timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    await fetch(`http://${host}:${port}`, { 
      signal: controller.signal,
      method: "HEAD"
    });
    
    clearTimeout(timeoutId);
    
    return {
      success: true,
      durationMs: Date.now() - startTime
    };
  } catch (err) {
    return {
      success: false,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err : new Error(String(err))
    };
  }
}

// Test WebSocket connection through specific proxy
export async function testWebsocketThroughProxy(
  websocketUrl: string,
  proxy: ProxyConfig,
  timeout = 10000
): Promise<ConnectionResult> {
  const startTime = Date.now();
  let timeoutId: number | undefined;
  
  return new Promise((resolve) => {
    try {
      // For direct connections, use normal WebSocket
      if (proxy.type === "direct") {
        const ws = new UniversalWebSocket(websocketUrl, [], { connectTimeout: timeout });
        
        const onOpen = () => {
          if (timeoutId) clearTimeout(timeoutId);
          ws.close();
          resolve({
            success: true,
            durationMs: Date.now() - startTime,
            stage: "connected",
            details: { proxy: proxy.label }
          });
        };
        
        const onError = (event: Event) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve({
            success: false,
            durationMs: Date.now() - startTime,
            stage: "error",
            error: new Error(`WebSocket connection failed through ${proxy.label}`),
            details: { proxy: proxy.label }
          });
        };
        
        const onClose = (event: CloseEvent) => {
          if (timeoutId) clearTimeout(timeoutId);
          if (!ws.isOpen()) {
            resolve({
              success: false,
              durationMs: Date.now() - startTime,
              stage: "closed",
              error: new Error(`WebSocket connection closed prematurely through ${proxy.label}: code ${event.code}`),
              details: { proxy: proxy.label, closeCode: event.code }
            });
          }
        };
        
        ws.on("open", onOpen);
        ws.on("error", onError);
        ws.on("close", onClose);
        
        timeoutId = setTimeout(() => {
          ws.terminate();
          resolve({
            success: false,
            durationMs: timeout,
            stage: "timeout",
            error: new Error(`WebSocket connection timed out through ${proxy.label} after ${timeout}ms`),
            details: { proxy: proxy.label }
          });
        }, timeout) as unknown as number;
      } else {
        // For proxy connections, need to set proxy env vars or use fetch with proxy
        // This is a placeholder as the actual implementation depends on the environment
        // and available libraries
        console.warn("Proxy testing through specific proxy not implemented yet");
        resolve({
          success: false,
          durationMs: 0,
          stage: "not_implemented",
          error: new Error(`Testing through ${proxy.type} proxy ${proxy.host}:${proxy.port} not implemented`),
          details: { proxy: proxy.label }
        });
      }
    } catch (err) {
      resolve({
        success: false,
        durationMs: Date.now() - startTime,
        stage: "exception",
        error: err instanceof Error ? err : new Error(String(err)),
        details: { proxy: proxy.label }
      });
    }
  });
}

// Diagnose full proxy chain
export async function diagnoseProxyChain(
  websocketUrl: string,
  proxyChain: ProxyConfig[]
): Promise<ConnectionResult[]> {
  const results: ConnectionResult[] = [];
  
  // Test TCP connectivity to each proxy in the chain
  console.log("===== Testing TCP connectivity to each proxy =====");
  for (const proxy of proxyChain) {
    console.log(`Testing connection to ${proxy.label} (${proxy.host}:${proxy.port})...`);
    const result = await testTcpConnection(proxy.host, proxy.port);
    
    console.log(`${result.success ? "✅" : "❌"} ${proxy.label}: ${result.success ? "Success" : "Failed"} in ${result.durationMs}ms`);
    if (!result.success && result.error) {
      console.error(`  Error: ${result.error.message}`);
    }
    
    results.push({
      ...result,
      stage: "tcp_connection",
      details: { 
        proxy: proxy.label,
        host: proxy.host,
        port: proxy.port
      }
    });
    
    // If we can't connect to this proxy, remaining tests will fail
    if (!result.success) {
      console.log(`⚠️ Cannot connect to ${proxy.label}, skipping further tests in the chain`);
      break;
    }
  }
  
  // Test WebSocket connection through the entire proxy chain
  console.log("\n===== Testing WebSocket through proxy chain =====");
  console.log(`Connecting to ${websocketUrl}...`);
  
  const wsResult = await testWebsocketThroughProxy(websocketUrl, proxyChain[0]);
  
  console.log(`${wsResult.success ? "✅" : "❌"} WebSocket: ${wsResult.success ? "Success" : "Failed"} in ${wsResult.durationMs}ms`);
  if (!wsResult.success && wsResult.error) {
    console.error(`  Error: ${wsResult.error.message}`);
    if (wsResult.details) {
      console.error(`  Details: ${JSON.stringify(wsResult.details, null, 2)}`);
    }
  }
  
  results.push(wsResult);
  
  return results;
}

// Helper to print diagnostics report
export function printDiagnosticsReport(url: string, results: ConnectionResult[]): void {
  console.log("\n========== PROXY DIAGNOSTICS REPORT ==========");
  console.log(`Target URL: ${url}`);
  console.log("Results:");
  
  // Table header
  console.log("\nComponent Status | Duration | Details");
  console.log("-------------- | -------- | -------");
  
  for (const result of results) {
    const status = result.success ? "✅ SUCCESS" : "❌ FAILED";
    const component = result.details?.proxy || result.stage || "Unknown";
    const duration = `${result.durationMs}ms`;
    const details = result.error ? 
      result.error.message : 
      (result.details ? JSON.stringify(result.details) : "");
    
    console.log(`${component} ${status} | ${duration} | ${details}`);
  }
  
  console.log("\nRecommendations:");
  
  // Check for failed TCP connections
  const failedTcpConnections = results.filter(r => 
    !r.success && r.stage === "tcp_connection"
  );
  
  if (failedTcpConnections.length > 0) {
    console.log("- Fix TCP connectivity to these proxies:");
    for (const result of failedTcpConnections) {
      console.log(`  * ${result.details?.proxy}: ${result.details?.host}:${result.details?.port}`);
    }
  }
  
  // Check for WebSocket failures
  const wsFailure = results.find(r => 
    !r.success && r.stage !== "tcp_connection"
  );
  
  if (wsFailure) {
    console.log(`- WebSocket connection failed at stage "${wsFailure.stage}"`);
    console.log(`  * Error: ${wsFailure.error?.message}`);
    console.log("- Check proxy chain configuration and permissions");
  }
  
  console.log("==============================================");
} 