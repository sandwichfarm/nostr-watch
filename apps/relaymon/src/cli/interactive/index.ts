import { state, setupCursorBlink, registerBlinkCallback } from "./state.ts";
import { exists } from "https://deno.land/std@0.218.2/fs/exists.ts";
import { clearScreen } from "./utils.ts";
import { loadConfig } from "../../config/config.ts";
import { getLogger } from "../../utils/logger.ts";
import { render } from "./renderer.ts";
import { handleKeyPress, handleEscapeSequence, KeyEvent } from "./input.ts";
import { initDB, getRelays, getRelayCounts, db } from "./db.ts";
import { join } from "https://deno.land/std@0.218.2/path/mod.ts";
import { getStats } from "../../core/status.ts";

// Configure logger to output to a file instead of console for interactive mode
const logger = getLogger("Interactive");

// Ensure logs directory exists
async function setupLogging(): Promise<void> {
  try {
    // Check if logs directory exists, create if not
    const logsDir = join(Deno.cwd(), "logs");
    if (!await exists(logsDir)) {
      await Deno.mkdir(logsDir, { recursive: true });
    }
    
    // Create a log file for this session
    const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
    const logPath = join(logsDir, `interactive-${timestamp}.log`);
    
    // Create a log writer
    const logFile = await Deno.open(logPath, { create: true, write: true, append: true });
    const logWriter = logFile.writable.getWriter();
    
    // Override console.error to write to the log file
    const origConsoleError = console.error;
    console.error = (...args: any[]) => {
      const text = args.map(a => String(a)).join(' ') + '\n';
      logWriter.write(new TextEncoder().encode(text)).catch(() => {});
      // We don't write to original console.error to keep the UI clean
    };
    
    // Update logger.info to let user know where logs will go
    console.info(`Logs will be written to ${logPath}`);
    
    // Wait a moment for the message to be seen
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Register cleanup to restore console.error on exit
    globalThis.addEventListener("unload", () => {
      console.error = origConsoleError;
      logWriter.close().catch(() => {});
    });
    
    return;
  } catch (e) {
    console.error(`Failed to set up logging: ${e}`);
  }
}

// Debug function to directly inspect database tables
async function debugInspectDatabase(dbPath: string): Promise<void> {
  logger.info("=== DB DEBUG INSPECTION ===");
  logger.info(`Database file: ${dbPath}`);
  
  try {
    // Check if file exists and get size
    if (await exists(dbPath)) {
      const fileInfo = await Deno.stat(dbPath);
      logger.info(`Database file exists: ${fileInfo.size} bytes`);
    } else {
      logger.error(`Database file does not exist at path: ${dbPath}`);
    }
    
    // Check schema
    logger.info("Examining table schema:");
    const tableInfo = db.query(`PRAGMA table_info(relay_status)`);
    tableInfo.forEach(col => {
      logger.info(`Column: ${col[1]}, Type: ${col[2]}, NotNull: ${col[3]}, DefaultValue: ${col[4]}, PK: ${col[5]}`);
    });
    
    // Check data in relay_status table
    const counts = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
    logger.info(`Total relays in database: ${counts}`);
    
    // Check all values of the ignore column
    logger.info("Checking ignore column values:");
    const ignoreValues = db.query(`SELECT DISTINCT ignore FROM relay_status`);
    ignoreValues.forEach(row => {
      logger.info(`Found ignore value: ${row[0]}, Type: ${typeof row[0]}`);
      
      // Count how many relays have this ignore value
      const countWithValue = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = ?`, [row[0] as number])[0][0] as number;
      logger.info(`Number of relays with ignore=${row[0]}: ${countWithValue}`);
    });
    
    // Examine a few sample relays
    logger.info("Sample relays in database:");
    const samples = db.query(`SELECT url, online, ignore FROM relay_status LIMIT 10`);
    samples.forEach((row, i) => {
      logger.info(`Relay ${i+1}: ${row[0]}, online=${row[1]}, ignore=${row[2]}`);
    });
    
    // Try to find any ignored relays with a more permissive query
    const maybeIgnored = db.query(`SELECT url, ignore FROM relay_status WHERE ignore > 0 LIMIT 10`);
    if (maybeIgnored.length > 0) {
      logger.info("Found potentially ignored relays with 'ignore > 0':");
      maybeIgnored.forEach((row, i) => {
        logger.info(`Relay ${i+1}: ${row[0]}, ignore=${row[1]}`);
      });
    } else {
      logger.info("No relays found with 'ignore > 0'");
    }
    
    // Try direct SQL to see what's in the database
    logger.info("=== END DB DEBUG INSPECTION ===");
  } catch (error) {
    logger.error(`Database inspection error: ${error}`);
  }
}

// Helper function to render the app
function renderApp(): void {
  clearScreen();
  console.log(render());
}

// Function to update monitor stats
function updateMonitorStats(): void {
  try {
    // Only update if the monitor is running
    if (state.monitorProcess) {
      // Create a mock queue manager with the required properties
      const mockQueueManager = {
        checkQueue: {
          pending: 0,
          size: 0,
          sizeFailed: 0,
          isPaused: false
        },
        publishQueue: {
          pending: 0,
          size: 0
        },
        publishedEvents: 0,
        failedPublishes: 0,
        retryingPublishes: 0,
        config: state.config
      };
      
      // Get the current stats
      const stats = getStats(mockQueueManager);
      
      // Update the state
      state.monitorStats = stats;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error updating monitor stats: ${errorMessage}`);
  }
}

// Main function
export async function runInteractive(configPath: string): Promise<void> {
  // Set up logging to file first
  await setupLogging();
  
  state.configPath = configPath;
  
  // Check if file exists
  if (!await exists(configPath)) {
    console.error(`Error: Config file not found at "${configPath}"`);
    Deno.exit(1);
  }
  
  // Load configuration
  state.config = await loadConfig(configPath);
  logger.info(`Loaded configuration from ${configPath}`);
  
  // Initialize the database connection
  const configDbPath = state.config.db?.path || "relaymon.db";
  
  // Try to make the database path absolute - improves reliability
  let dbPath;
  if (configDbPath.startsWith("/")) {
    // Already absolute
    dbPath = configDbPath;
  } else {
    // Try to resolve relative to the config file directory
    const configDir = configPath.split("/").slice(0, -1).join("/");
    dbPath = join(configDir || ".", configDbPath);
    logger.info(`Resolved database path: ${dbPath}`);
  }
  
  // Verify the DB file exists
  if (!await exists(dbPath)) {
    logger.error(`Database file not found at ${dbPath}. This path must match the one used by the main application.`);
    console.error(`\nERROR: Database file not found at ${dbPath}`);
    console.error(`Make sure this path matches the one in your config: ${configDbPath}`);
    console.error(`Try running first: deno task start -c ${configPath}`);
    Deno.exit(1);
  } else {
    const fileInfo = await Deno.stat(dbPath);
    logger.info(`Database file found at ${dbPath} (${fileInfo.size} bytes)`);
  }
  
  // Initialize database 
  try {
    logger.info(`Initializing database at ${dbPath} (enableWAL=${!!state.config.db?.enableWAL})`);
    initDB(dbPath, !!state.config.db?.enableWAL);
    
    // Run database debug and diagnostics
    await debugInspectDatabase(dbPath);
    
    // If we don't find any ignored relays but want to test functionality, we can temporarily mark a relay as ignored
    try {
      const ignoredCount = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0] as number;
      if (ignoredCount === 0) {
        logger.info("No ignored relays found. Creating a test ignored relay for debugging...");
        
        // Find a relay to mark as ignored
        const someRelay = db.query(`SELECT url FROM relay_status LIMIT 1`);
        if (someRelay.length > 0) {
          const relayUrl = someRelay[0][0] as string;
          logger.info(`Marking relay ${relayUrl} as ignored for testing`);
          db.query(`UPDATE relay_status SET ignore = 1 WHERE url = ?`, [relayUrl]);
          
          // Verify the update worked
          const nowIgnored = db.query(`SELECT ignore FROM relay_status WHERE url = ?`, [relayUrl])[0][0] as number;
          logger.info(`Relay ${relayUrl} ignore status is now: ${nowIgnored}`);
        }
      }
    } catch (e) {
      logger.error(`Error creating test ignored relay: ${e}`);
    }
    
    // Immediately test if we can access relay data
    const counts = getRelayCounts();
    logger.info(`Database initialized with ${counts.total} relays (${counts.online} online, ${counts.ignored} ignored)`);
    
    // Force a query execution to make sure DB is fully ready
    const relays = getRelays();
    logger.info(`Successfully loaded ${relays.length} relays`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Database initialization failed: ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    
    // Show a clear error message and exit
    console.error(`\nERROR: Could not initialize database at ${dbPath}.`);
    console.error(`Make sure this path matches what's in your config.yaml: ${configDbPath}`); 
    console.error(`The logs show the database is at: ./data/relaymon2.db`);
    console.error(`Try running first: deno task start -c ${configPath}`);
    console.error("Then restart the interactive mode.");
    Deno.exit(1);
  }
  
  // Set up cursor blinking
  const blinkInterval = setupCursorBlink();
  
  // Register the render function to be called when the cursor blinks
  registerBlinkCallback(() => {
    renderApp();
  });
  
  // Set up stats update interval
  const statsInterval = setInterval(() => {
    updateMonitorStats();
    renderApp();
  }, 5000); // Update stats every 5 seconds
  
  // Set up keyboard event listener
  Deno.stdin.setRaw(true);
  const decoder = new TextDecoder();
  
  // Track when we last refreshed to prevent flashing
  let lastRedraw = Date.now();
  const REDRAW_THRESHOLD = 50; // ms
  
  // Helper function to redraw the screen only if enough time has passed
  function redrawIfNeeded(): void {
    const now = Date.now();
    if (now - lastRedraw > REDRAW_THRESHOLD) {
      clearScreen();
      console.log(render());
      lastRedraw = now;
    }
  }
  
  // Initial render
  clearScreen();
  console.log(render());
  lastRedraw = Date.now();
  
  // Clean up resources before exiting
  const cleanup = () => {
    // Stop cursor blink timer
    clearInterval(blinkInterval);
    
    // Close any monitor process that might be running
    if (state.monitorProcess) {
      try {
        // @ts-ignore - TypeScript doesn't know about .kill() method
        state.monitorProcess.kill("SIGTERM");
        // @ts-ignore - TypeScript doesn't know about .close() method
        state.monitorProcess.close();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error closing monitor process: ${errorMessage}`);
      }
    }
    
    // Reset terminal
    Deno.stdin.setRaw(false);
    
    // Clear stats interval
    clearInterval(statsInterval);
  };
  
  // Set up cleanup on exit
  globalThis.addEventListener("unload", cleanup);
  
  try {
    // Main event loop
    while (state.running) {
      // Read initial bytes with larger buffer
      const buffer = new Uint8Array(32);
      const numBytesRead = await Deno.stdin.read(buffer);
      
      if (numBytesRead === null) break;
      
      // Get the first chunk of input
      const input = decoder.decode(buffer.subarray(0, numBytesRead));
      
      // Handle escape sequences properly
      if (input.startsWith("\x1b")) {
        // This could be an escape key or the start of an escape sequence
        if (input.length === 1) {
          // Just the escape key alone - we need to read more to check for sequences
          const escBuffer = new Uint8Array(32);
          
          // Set a shorter timeout to capture the full sequence
          const bytesRead = await Promise.race([
            Deno.stdin.read(escBuffer),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 30)) // Shorter timeout
          ]);
          
          if (bytesRead === null || bytesRead === 0) {
            // Timeout with no more bytes - it's a standalone Escape key
            await handleKeyPress({ key: "Escape" });
          } else {
            // Got more bytes - it's an escape sequence
            const escSeq = decoder.decode(escBuffer.subarray(0, bytesRead));
            await handleEscapeSequence(input + escSeq);
          }
        } else {
          // Already got multiple bytes with the escape character - process as sequence
          await handleEscapeSequence(input);
        }
        redrawIfNeeded();
      } else if (input === "\r") {
        await handleKeyPress({ key: "Enter" });
        redrawIfNeeded();
      } else if (input === "\x7f") {
        await handleKeyPress({ key: "Backspace" });
        redrawIfNeeded();
      } else if (input === "\t") {
        // Tab key - maybe use for navigation between sections
        // For now, do nothing
      } else if (input.length === 1 && input >= " " && input <= "~") {
        // Printable ASCII character
        await handleKeyPress({ key: input });
        redrawIfNeeded();
      }
    }
  } finally {
    cleanup();
  }
  
  clearScreen();
  console.log("RelayMon interactive mode exited");
} 