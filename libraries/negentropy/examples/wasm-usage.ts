import { WasmClientHandler, WasmServerHandler } from '../src';
import { WebSocketTransport } from '../src/transports/WebSocket';
import { RecordItem } from '../src/types';

// Example usage of WASM-based Negentropy

async function clientExample() {
  // Your local records
  const records: RecordItem[] = [
    { timestamp: BigInt(1000), id: new Uint8Array(32).fill(1) },
    { timestamp: BigInt(2000), id: new Uint8Array(32).fill(2) },
    // ... more records
  ];

  // Create a WebSocket connection
  const websocket = new WebSocket('wss://relay.example.com');
  
  // Create transport
  const transport = new WebSocketTransport(websocket);
  
  // Create WASM client handler
  const client = new WasmClientHandler(
    records,
    transport,
    { kinds: [1] }, // Nostr filter
    'sub-123'
  );

  // Initialize WASM (must be done before use)
  await client.init(16); // frame size limit of 16

  // Start syncing when WebSocket is open
  websocket.onopen = () => {
    client.startSync();
  };

  // Later, check results
  setTimeout(() => {
    console.log('Client has IDs:', client.getClientHasIds());
    console.log('Client needs IDs:', client.getClientNeedsIds());
    
    // Clean up
    client.destroy();
  }, 5000);
}

async function serverExample() {
  // Your server records
  const records: RecordItem[] = [
    { timestamp: BigInt(1000), id: new Uint8Array(32).fill(1) },
    { timestamp: BigInt(3000), id: new Uint8Array(32).fill(3) },
    // ... more records
  ];

  // WebSocket server setup (pseudo-code)
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', async (ws: WebSocket) => {
    // Create transport
    const transport = new WebSocketTransport(ws);
    
    // Create WASM server handler
    const server = new WasmServerHandler(
      records,
      transport,
      async (records, filter) => {
        // Apply Nostr filter to records
        return records.filter(r => {
          // Implement your filter logic
          return true;
        });
      },
      16 // frame size limit
    );

    // Server automatically handles incoming messages
  });
}

// Performance comparison
async function performanceTest() {
  const recordCount = 10000;
  const records: RecordItem[] = [];
  
  // Generate test records
  for (let i = 0; i < recordCount; i++) {
    const id = new Uint8Array(32);
    crypto.getRandomValues(id);
    records.push({
      timestamp: BigInt(Date.now() - Math.random() * 86400000),
      id
    });
  }

  console.log(`Testing with ${recordCount} records...`);

  // Test WASM implementation
  const wasmStart = performance.now();
  const wasmClient = new WasmClientHandler(records, null as any, {}, 'test');
  await wasmClient.init();
  const wasmEnd = performance.now();
  
  console.log(`WASM initialization: ${wasmEnd - wasmStart}ms`);
  
  // The WASM implementation will be significantly faster for:
  // - Large record sets
  // - Complex reconciliation operations
  // - Multiple rounds of negotiation
}