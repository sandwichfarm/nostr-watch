const url = "ws://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion"; // Use a known onion WebSocket
const timeoutMs = 20000; // 20 seconds

console.log(`Attempting to connect to ${url} via proxychains -> hedproxy...`);

let connectionAttempted = false;
let connectionSucceeded = false;

const connectTimer = setTimeout(() => {
  if (!connectionAttempted) {
    console.error(`❌ TIMEOUT: Connection attempt did not progress within ${timeoutMs}ms.`);
  } else if (!connectionSucceeded) {
    console.error(`❌ TIMEOUT: Connection did not open within ${timeoutMs}ms.`);
  }
  // In Deno, forcefully exiting might be necessary if the WebSocket hangs indefinitely
  // Deno.exit(1);
}, timeoutMs);

try {
  connectionAttempted = true;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    connectionSucceeded = true;
    clearTimeout(connectTimer);
    console.log(`✅ SUCCESS: Connected to ${url}`);
    ws.close();
  };

  ws.onerror = (event) => {
    clearTimeout(connectTimer);
    // Try to get more specific error info if possible
    const error = (event as ErrorEvent).error;
    const message = (event as ErrorEvent).message;
    console.error(`❌ ERROR connecting to ${url}:`);
    if (message) console.error(`   Message: ${message}`);
    if (error) console.error(`   Error object:`, error);
    if (!error && !message) console.error(`   (No specific error details provided by onerror event)`);
    // Deno.exit(1); // Exit after error
  };

  ws.onclose = (event) => {
    clearTimeout(connectTimer);
    if (!connectionSucceeded) { // Only log close as an issue if we didn't connect first
       console.log(`ℹ️ CLOSED (Before Open): Connection to ${url} closed. Code: ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}`);
       // Deno.exit(1); // Exit if closed before opening
    } else {
        console.log(`ℹ️ CLOSED (After Open): Connection to ${url} closed. Code: ${event.code}, Clean: ${event.wasClean}`);
        // Deno.exit(0); // Exit successfully after closing
    }
  };

} catch (err) {
  clearTimeout(connectTimer);
  console.error(`❌ EXCEPTION creating WebSocket for ${url}:`, err);
  // Deno.exit(1); // Exit after exception
}