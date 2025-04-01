import { header } from "./header.ts";
import { loadConfig } from "./config.ts";
import { runDaemon } from "./daemon.ts";
import { existsSync } from "https://deno.land/std@0.218.2/fs/mod.ts";
import { join } from "https://deno.land/std@0.218.2/path/mod.ts";

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

EXAMPLES:
  relaymon                        Run with default config (./config.yaml)
  relaymon -c custom-config.yaml  Run with a custom config file
  
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

async function main() {
  try {
    // Simple command line argument parsing
    let configPath = "./config.yaml";
    
    for (let i = 0; i < Deno.args.length; i++) {
      const arg = Deno.args[i];
      
      if (arg === "-h" || arg === "--help") {
        displayHelpMenu();
        Deno.exit(0);
      } else if (arg === "-c" || arg === "--config") {
        if (i + 1 < Deno.args.length) {
          configPath = Deno.args[i + 1];
          i++; // Skip the next argument as we've used it
        }
      }
    }
    
    // Check if already running
    const { running, pid } = await isAlreadyRunning();
    if (running) {
      console.error(`Error: relaymon is already running with PID ${pid}`);
      console.error("To stop it, use: kill " + pid);
      Deno.exit(1);
    }
    
    // Create PID file
    await createPidFile();
    
    const config = await loadConfig(configPath);
    console.log(`Configuration loaded successfully from ${configPath}`);
    await header(config);
    await runDaemon(config);
  } catch (error) {
    console.error("Error loading configuration or starting the daemon:", error);
    // Make sure to clean up PID file on error
    try {
      if (existsSync(PID_FILE)) {
        await Deno.remove(PID_FILE);
      }
    } catch (e) {
      // Ignore errors removing PID file
    }
    Deno.exit(1);
  }
}

main();
