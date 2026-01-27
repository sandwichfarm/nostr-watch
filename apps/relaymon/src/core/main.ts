import { header } from "../utils/header.ts";
import { loadConfig } from "../config/config.ts";
import { runDaemon, getPrivateKey, heartbeatTracker, errorTracker } from "./daemon.ts";
import { existsSync } from "https://deno.land/std@0.218.2/fs/mod.ts";
import { join } from "https://deno.land/std@0.218.2/path/mod.ts";
import { initializeDB } from "../db/db.ts";
import { getLogger } from "../utils/logger.ts";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { parseRelayNetwork } from "npm:@nostrwatch/utils";
import { loadHostnameBlocklist } from "../utils/blocklists.ts";
import { runInteractive } from "../cli/interactive.ts";
import { buildHealthSnapshot } from "../health/index.ts";
import { QueueManager } from "../utils/queueManager.ts";

const logger = getLogger("Main");

/**
 * Display help menu with usage information
 */
function displayHelpMenu() {
  console.log(`
RelayMon - Nostr Relay Monitor

USAGE:
  relaymon [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -c, --config <PATH>     Specify a custom configuration file path (default: ./config.yaml)
  -m, --migrate           Run network migration on existing database (updates relay network types)
  -i, --interactive       Run in interactive mode with a menu-based interface
  --health                Check health status and exit (returns JSON, exit 0 for up/degraded, non-zero for down)

EXAMPLES:
  relaymon                        Run with default config (./config.yaml)
  relaymon -c custom-config.yaml  Run with a custom config file
  relaymon --migrate              Run network migration before starting monitor
  relaymon -i                     Run in interactive mode
  relaymon --health               Check health and exit

RelayMon creates a PID file in the system's temporary directory to prevent multiple instances.
When running, press Ctrl+C to stop the monitor gracefully.
`);
}

/**
 * Get the platform-appropriate directory for the PID file
 */
function getPidFilePath(): string {
  // Get temp directory that works cross-platform
  let tempDir: string;
  
  if (Deno.build.os === "windows") {
    tempDir = Deno.env.get("TEMP") || "C:\\Windows\\Temp";
  } else {
    // For macOS and Linux
    tempDir = Deno.env.get("TMPDIR") || "/tmp";
  }
  
  // Ensure the directory exists
  try {
    Deno.statSync(tempDir);
  } catch (e) {
    // If error, fall back to current directory
    return "./relaymon.pid";
  }
  
  return join(tempDir, "relaymon.pid");
}

const PID_FILE = getPidFilePath();

// Flag to track shutdown status
let isShuttingDown = false;

/**
 * Clean up resources and exit gracefully
 */
async function shutdown(signal?: string): Promise<void> {
  if (isShuttingDown) return; // Prevent multiple shutdown attempts
  isShuttingDown = true;
  
  console.log(`\nReceived ${signal || 'shutdown'} signal. Cleaning up...`);
  
  try {
    // Clean up PID file
    if (existsSync(PID_FILE)) {
      await Deno.remove(PID_FILE);
      console.log("PID file removed successfully.");
    }
  } catch (error) {
    console.error(`Error during cleanup: ${error}`);
  }
  
  console.log("Exiting gracefully.");
  Deno.exit(0);
}

/**
 * Check if relaymon is already running
 * @returns {boolean} true if already running, false otherwise
 */
async function isAlreadyRunning(): Promise<{ running: boolean; pid?: number }> {
  // Check if PID file exists
  if (existsSync(PID_FILE)) {
    try {
      // Read the PID from the file
      const pidContent = await Deno.readTextFile(PID_FILE);
      const pid = parseInt(pidContent.trim(), 10);
      
      if (isNaN(pid)) {
        // Invalid PID, not running
        return { running: false };
      }
      
      try {
        // On Unix systems, try to send signal 0 to check if process exists
        // This doesn't actually send a signal but checks if process exists
        Deno.kill(pid, "SIGCONT");
        // If we get here, the process exists
        return { running: true, pid };
      } catch (error) {
        // Process doesn't exist, clean up stale PID file
        await Deno.remove(PID_FILE);
        return { running: false };
      }
    } catch (error) {
      // Error reading PID file
      console.error(`Error reading PID file: ${error}`);
      return { running: false };
    }
  }
  
  return { running: false };
}

/**
 * Create PID file with current process ID
 */
async function createPidFile(): Promise<void> {
  try {
    // Write current process ID to file
    await Deno.writeTextFile(PID_FILE, Deno.pid.toString());
    
    // Add event listener to clean up PID file on exit
    globalThis.addEventListener("unload", async () => {
      if (!isShuttingDown) {
        try {
          await Deno.remove(PID_FILE);
        } catch (error) {
          console.error(`Failed to remove PID file: ${error}`);
        }
      }
    });
    
    // Register signal handlers for graceful shutdown
    for (const signal of ["SIGINT", "SIGTERM"]) {
      Deno.addSignalListener(signal as Deno.Signal, () => {
        shutdown(signal).catch(console.error);
      });
    }
  } catch (error) {
    console.error(`Failed to create PID file: ${error}`);
  }
}

/**
 * Migrate relay networks in the database
 * This function fixes network types for all relay URLs
 */
async function migrateNetworks(dbPath: string): Promise<void> {
  const migrationLogger = getLogger("NetworkMigration");
  migrationLogger.info(`Initializing database: ${dbPath}`);
  
  // Connect directly to the database for raw queries
  const db = new DB(dbPath);

  try {
    migrationLogger.info("Beginning network migration...");
    
    // Count total relays before migration
    const countResult = db.query("SELECT COUNT(*) FROM relay_status");
    const totalRelays = countResult[0][0] as number;
    migrationLogger.info(`Found ${totalRelays} relays in the database`);

    // Get all relay URLs and their current networks
    const rows = db.query("SELECT url, network FROM relay_status");
    
    // Collect statistics
    let updated = 0;
    let unchanged = 0;
    const networkStats: Record<string, number> = {};
    const fromToStats: Record<string, Record<string, number>> = {};
    
    // Begin transaction for better performance
    db.query("BEGIN TRANSACTION");

    // Process each relay
    for (const [url, storedNetwork] of rows) {
      const relayUrl = url as string;
      const currentNetwork = storedNetwork as string;
      
      // Determine the correct network using parseRelayNetwork
      const detectedNetwork = parseRelayNetwork(relayUrl);
      
      // Update statistics
      networkStats[detectedNetwork] = (networkStats[detectedNetwork] || 0) + 1;
      
      // Check if update is needed
      if (currentNetwork !== detectedNetwork) {
        // Update from->to stats
        fromToStats[currentNetwork] = fromToStats[currentNetwork] || {};
        fromToStats[currentNetwork][detectedNetwork] = (fromToStats[currentNetwork][detectedNetwork] || 0) + 1;
        
        // Update the database
        db.query(
          "UPDATE relay_status SET network = ? WHERE url = ?",
          [detectedNetwork, relayUrl]
        );
        
        updated++;
        if (updated % 100 === 0) {
          migrationLogger.info(`Progress: Updated ${updated} relays so far...`);
        }
      } else {
        unchanged++;
      }
    }
    
    // Commit the transaction
    db.query("COMMIT");
    
    // Log results
    migrationLogger.info(`Migration complete!`);
    migrationLogger.info(`Updated ${updated} relays, ${unchanged} were already correct`);
    migrationLogger.info(`Network distribution after migration: ${JSON.stringify(networkStats)}`);
    
    // Log the from->to stats in a readable format
    migrationLogger.info("Network migration details:");
    for (const fromNetwork in fromToStats) {
      const toNetworks = fromToStats[fromNetwork];
      for (const toNetwork in toNetworks) {
        const count = toNetworks[toNetwork];
        migrationLogger.info(`  ${fromNetwork} → ${toNetwork}: ${count} relays`);
      }
    }
    
  } catch (error) {
    migrationLogger.error(`Error during migration: ${error.message}`);
    migrationLogger.error(error.stack);
    db.query("ROLLBACK");
    throw error;
  } finally {
    // Close the database connection
    db.close();
  }
}

export async function main() {
  // Display banner

  const args = Deno.args;

  // Process command line arguments
  if (args.includes("-h") || args.includes("--help")) {
    displayHelpMenu();
    Deno.exit(0);
  }

  // Check if health check is requested
  if (args.includes("--health")) {
    // Parse config path from arguments
    let configPath = "./config.yaml";
    const configArgIndex = Math.max(args.indexOf("-c"), args.indexOf("--config"));
    if (configArgIndex !== -1 && configArgIndex < args.length - 1) {
      configPath = args[configArgIndex + 1];
    }

    // Check if file exists
    if (!existsSync(configPath)) {
      console.error(JSON.stringify({
        status: "down",
        error: `Config file not found at "${configPath}"`,
        timestamp: new Date().toISOString(),
      }, null, 2));
      Deno.exit(1);
    }

    try {
      // Load configuration
      const config = await loadConfig(configPath);

      // Initialize database
      if (config.db?.path) {
        await initializeDB(config.db.path, config.db.enableWAL);
      } else {
        console.error(JSON.stringify({
          status: "down",
          error: "Database path not specified in config",
          timestamp: new Date().toISOString(),
        }, null, 2));
        Deno.exit(1);
      }

      // Get private key
      const privkey = getPrivateKey();

      // Create a minimal queue manager for health check
      const queueManager = new QueueManager(1, 1, config);

      // Get thresholds (use defaults if health not configured)
      const thresholds = config.health?.thresholds || {
        checkIdleMs: 300000, // 5 minutes
        publishBacklogMax: 100,
        errorRatePerMin: 10,
        startupGraceMs: 30000, // 30 seconds
      };

      // Build health snapshot
      const snapshot = await buildHealthSnapshot({
        queueManager,
        privkey,
        heartbeat: heartbeatTracker,
        thresholds,
        errorTracker,
      });

      // Print minimal JSON
      console.log(JSON.stringify({
        status: snapshot.state,
        timestamp: snapshot.timestamp,
        uptime: snapshot.uptime,
        checks: {
          database: snapshot.checks.database.status,
          signing: snapshot.checks.signing.status,
          checkQueue: snapshot.checks.checkQueue.status,
          publishQueue: snapshot.checks.publishQueue.status,
          checkLoop: snapshot.checks.checkLoop.status,
        },
        reasons: snapshot.reasons,
      }, null, 2));

      // Exit with appropriate code
      const exitCode = snapshot.state === "down" ? 1 : 0;
      Deno.exit(exitCode);
    } catch (error) {
      console.error(JSON.stringify({
        status: "down",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }, null, 2));
      Deno.exit(1);
    }
  }

  // Check if interactive mode is requested
  if (args.includes("-i") || args.includes("--interactive")) {
    // Parse config path from arguments
    let configPath = "./config.yaml";
    const configArgIndex = Math.max(args.indexOf("-c"), args.indexOf("--config"));
    if (configArgIndex !== -1 && configArgIndex < args.length - 1) {
      configPath = args[configArgIndex + 1];
    }

    // Run in interactive mode by using Deno.run to start the interactive script
    try {
      // @ts-ignore - Ignore TypeScript error for runtime feature
      const process = Deno.run({
        cmd: ["deno", "task", "interactive"],
        stdout: "inherit",
        stderr: "inherit",
      });
      // Wait for the process to complete
      // @ts-ignore - Ignore TypeScript error for runtime feature
      const status = await process.status();
      Deno.exit(status.code);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error starting interactive mode: ${errorMessage}`);
      Deno.exit(1);
    }
  }

  // Check if relaymon is already running
  const skipPidCheck = Deno.env.get('RELAYMON_SKIP_PID_CHECK') === 'true';
  if (!skipPidCheck) {
    const runStatus = await isAlreadyRunning();
    if (runStatus.running) {
      console.error(`Error: RelayMon is already running (PID ${runStatus.pid})`);
      Deno.exit(1);
    }
    
    // Create PID file
    await createPidFile();
  } else {
    console.log("PID check skipped (running in container mode)");
  }

  // Parse config path from arguments
  let configPath = "./config.yaml";
  const configArgIndex = Math.max(args.indexOf("-c"), args.indexOf("--config"));
  if (configArgIndex !== -1 && configArgIndex < args.length - 1) {
    configPath = args[configArgIndex + 1];
  }

  // Check if file exists
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found at "${configPath}"`);
    displayHelpMenu();
    Deno.exit(1);
  }

  // Load configuration
  const config = await loadConfig(configPath);

  //DO NOT REMOVE THIS.
  console.log(header(config));

  logger.info(`Loaded configuration from ${configPath}`);

  // Load hostname blocklist
  await loadHostnameBlocklist();
  logger.info("Loaded hostname blocklist");

  // Initialize database
  if (config.db?.path) {
    await initializeDB(config.db.path, config.db.enableWAL);
  } else {
    console.error("Error: Database path not specified in config");
    Deno.exit(1);
  }

  // Check for network migration flag
  if (args.includes("-m") || args.includes("--migrate")) {
    await migrateNetworks(config.db.path);
  }

  // Start the daemon
  await runDaemon(config);
}

// Call main function if this module is executed directly
if (import.meta.main) {
  main();
}
