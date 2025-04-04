#!/usr/bin/env deno run --allow-all

import { parse, stringify } from "https://deno.land/std@0.218.2/yaml/mod.ts";
import * as colors from "https://deno.land/std@0.218.2/fmt/colors.ts";
import { exists } from "https://deno.land/std@0.218.2/fs/exists.ts";
import { db, initDB } from "npm:@nostrwatch/db";
import { getLogger } from "./src/utils/logger.ts";

const logger = getLogger("Interactive");

// Load configuration
async function loadConfig(path: string): Promise<any> {
  try {
    const fileText = await Deno.readTextFile(path);
    return parse(fileText);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error loading config: ${errorMessage}`);
    throw error;
  }
}

// Save configuration
async function saveConfig(config: any, path: string): Promise<void> {
  try {
    const yamlString = stringify(config);
    await Deno.writeTextFile(path, yamlString);
    logger.info(`Configuration saved to ${path}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error saving config: ${errorMessage}`);
  }
}

// Enhanced config state
type ConfigState = {
  path: string[];     // Current path in the config
  editingKey: string | null;  // Currently editing key
  editingValue: string;  // Value being edited
  isEditing: boolean; // Whether we're in edit mode
  cursorPosition: number; // Position of cursor in editing value
  showCursor: boolean; // For blinking cursor
};

// State management for the interactive CLI
type AppState = {
  running: boolean;
  config: any;
  configPath: string;
  menu: string;
  subMenu: string | null; // For tracking sub-menus like config sections
  selectedIndex: number;
  topIndex: number; // For scrolling in lists
  monitorProcess: any;  // Store the monitor process
  monitorPid: number | null; // Store the PID
  sortColumn: string;
  sortDirection: "asc" | "desc";
  groupBy: string | null;
  configState: ConfigState; // State for config editing
  filter: string; // Filter for lists
  isFiltering: boolean; // Whether we're currently entering a filter
};

// Initialize app state
const state: AppState = {
  running: true,
  config: {},
  configPath: "./config.yaml",
  menu: "main",
  subMenu: null,
  selectedIndex: 0,
  topIndex: 0,
  monitorProcess: null,
  monitorPid: null,
  sortColumn: "url",
  sortDirection: "asc",
  groupBy: null,
  configState: {
    path: [],
    editingKey: null,
    editingValue: "",
    isEditing: false,
    cursorPosition: 0,
    showCursor: true
  },
  filter: "",
  isFiltering: false
};

// Menu rendering helpers
const renderBox = (title: string, content: string[]): string => {
  // Ensure width is at least title length + 6 (for padding and borders) and minimum 20 characters
  const contentWidth = Math.max(...content.map(line => line.length));
  const width = Math.max(contentWidth + 4, title.length + 6, 20);
  const border = "+" + "-".repeat(width - 2) + "+";
  const titleLine = `| ${colors.bold(title)} ${" ".repeat(Math.max(0, width - title.length - 4))} |`;
  
  let result = `${border}\n${titleLine}\n${border}\n`;
  content.forEach(line => {
    result += `| ${line}${" ".repeat(Math.max(0, width - line.length - 4))} |\n`;
  });
  result += border;
  
  return result;
};

const clearScreen = (): void => {
  // Clear screen and move cursor to top-left
  console.log("\x1Bc");
};

// Get relays from database
function getRelays(): any[] {
  try {
    // Make sure db is connected - this shouldn't be necessary but adding as a safeguard
    if (!db) {
      logger.error("Database connection not initialized");
      return [];
    }
    
    logger.debug("Querying relays from database");
    try {
      // Get all fields explicitly in the correct order to avoid mapping issues
      const relays = db.query(`SELECT url, online, ignore, parent, checked_at, rtt, network, retries FROM relay_status ORDER BY url LIMIT 1000`);
      
      logger.debug(`Found ${relays.length} relays in database`);
      
      // Map the results to objects with named properties
      return relays.map(row => {
        const [url, online, ignore, parent, checked_at, rtt, network, retries] = row;
        return { 
          url: url as string, 
          online: online as number, 
          ignore: ignore as number,
          parent: parent as string,
          checked_at: checked_at as number, 
          rtt: rtt as number,
          network: network as string,
          retries: retries as number
        };
      });
    } catch (dbError) {
      // Special handling for database query errors
      logger.error(`Database query error in getRelays: ${dbError}`);
      
      // Try a simpler query as fallback
      try {
        logger.info("Trying fallback query for relays");
        const relays = db.query(`SELECT url FROM relay_status ORDER BY url LIMIT 1000`);
        
        // Return simplified objects with minimal data
        return relays.map(row => {
          return { 
            url: row[0] as string, 
            online: 0,  // Default values
            ignore: 0,
            parent: "",
            checked_at: 0, 
            rtt: 0,
            network: "unknown",
            retries: 0
          };
        });
      } catch (fallbackError) {
        logger.error(`Fallback query also failed: ${fallbackError}`);
        return []; // Return empty array as last resort
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting relays: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    return [];
  }
}

// Get ignored relays
function getIgnoredRelays(): any[] {
  try {
    // Make sure db is connected
    if (!db) {
      logger.error("Database connection not initialized");
      return [];
    }
    
    logger.debug("Querying ignored relays from database");
    try {
      // Get all fields for ignored relays with error handling
      const relays = db.query(`SELECT url, online, ignore, parent, checked_at, rtt, network, retries 
                              FROM relay_status WHERE ignore = 1 ORDER BY url`);
      
      logger.debug(`Found ${relays.length} ignored relays in database`);
      
      // Map the results to objects with named properties (same as getRelays)
      return relays.map(row => {
        const [url, online, ignore, parent, checked_at, rtt, network, retries] = row;
        return { 
          url: url as string, 
          online: online as number, 
          ignore: ignore as number,
          parent: parent as string,
          checked_at: checked_at as number, 
          rtt: rtt as number,
          network: network as string,
          retries: retries as number
        };
      });
    } catch (dbError) {
      // Special handling for database query errors
      logger.error(`Database query error in getIgnoredRelays: ${dbError}`);
      
      // Try a simpler query as fallback
      try {
        logger.info("Trying fallback query for ignored relays");
        const relays = db.query(`SELECT url FROM relay_status WHERE ignore = 1 ORDER BY url`);
        
        // Return simplified objects with minimal data
        return relays.map(row => {
          return { 
            url: row[0] as string, 
            online: 0,  // Default values
            ignore: 1,
            parent: "",
            checked_at: 0, 
            rtt: 0,
            network: "unknown",
            retries: 0
          };
        });
      } catch (fallbackError) {
        logger.error(`Fallback query also failed: ${fallbackError}`);
        return []; // Return empty array as last resort
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting ignored relays: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    return [];
  }
}

// Get relay counts
function getRelayCounts(): { total: number; online: number; offline: number; ignored: number } {
  try {
    // Make sure db is connected
    if (!db) {
      logger.error("Database connection not initialized");
      return { total: 0, online: 0, offline: 0, ignored: 0 };
    }
    
    logger.debug("Getting relay counts from database");
    const total = db.query(`SELECT COUNT(*) FROM relay_status`)[0][0] as number;
    const online = db.query(`SELECT COUNT(*) FROM relay_status WHERE online = 1`)[0][0] as number;
    const offline = db.query(`SELECT COUNT(*) FROM relay_status WHERE online = 0`)[0][0] as number;
    const ignored = db.query(`SELECT COUNT(*) FROM relay_status WHERE ignore = 1`)[0][0] as number;
    
    logger.debug(`Relay counts - Total: ${total}, Online: ${online}, Offline: ${offline}, Ignored: ${ignored}`);
    
    return { total, online, offline, ignored };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error getting relay counts: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    return { total: 0, online: 0, offline: 0, ignored: 0 };
  }
}

// Toggle relay ignore status
function toggleRelayIgnore(url: string, ignore: boolean): void {
  try {
    db.query(
      `UPDATE relay_status SET ignore = ? WHERE url = ?`,
      [ignore ? 1 : 0, url]
    );
    logger.info(`Relay ${url} ${ignore ? "ignored" : "unignored"}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error toggling relay ignore status: ${errorMessage}`);
  }
}

// Delete relay
function deleteRelay(url: string): void {
  try {
    db.query(`DELETE FROM relay_status WHERE url = ?`, [url]);
    logger.info(`Relay ${url} deleted`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error deleting relay: ${errorMessage}`);
  }
}

// Define our own KeyboardEvent interface
interface KeyEvent {
  key: string;
}

// Helper to read from process stdout/stderr
async function readProcessOutput(process: any): Promise<string> {
  if (!process) return "Process not running";
  
  try {
    // @ts-ignore - TypeScript doesn't know about .stdout
    const stdout = process.stdout;
    // @ts-ignore - TypeScript doesn't know about .stderr
    const stderr = process.stderr;
    
    if (!stdout || !stderr) return "No output streams available";
    
    const stdoutBuffer = new Uint8Array(1024);
    const stderrBuffer = new Uint8Array(1024);
    
    let output = "";
    
    // Read from stdout (non-blocking)
    try {
      // @ts-ignore
      const bytesReadStdout = await Promise.race([
        stdout.read(stdoutBuffer),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 50))
      ]);
      
      if (bytesReadStdout) {
        const text = new TextDecoder().decode(stdoutBuffer.subarray(0, bytesReadStdout));
        output += text;
      }
    } catch (error) {
      // Ignore read errors
    }
    
    // Read from stderr (non-blocking)
    try {
      // @ts-ignore
      const bytesReadStderr = await Promise.race([
        stderr.read(stderrBuffer),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 50))
      ]);
      
      if (bytesReadStderr) {
        const text = new TextDecoder().decode(stderrBuffer.subarray(0, bytesReadStderr));
        output += text;
      }
    } catch (error) {
      // Ignore read errors
    }
    
    return output || "No new output";
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error reading process output: ${errorMessage}`;
  }
}

// Toggle cursor blink every 500ms
setInterval(() => {
  state.configState.showCursor = !state.configState.showCursor;
  // Only redraw if we're in edit mode
  if (state.configState.isEditing && state.menu === "config") {
    clearScreen();
    console.log(render());
  }
}, 500);

// Helper function to get the current level in config
function getCurrentConfigLevel(): any {
  let currentConfig = state.config;
  for (const key of state.configState.path) {
    currentConfig = currentConfig[key];
  }
  return currentConfig;
}

// Add PageUp and PageDown functionality to the state
function handlePageUp(): void {
  // Remove debug logging
  const visibleItems = 15; // Adjust based on your display area
  
  // First adjust topIndex for scrolling
  if (state.topIndex > 0) {
    state.topIndex = Math.max(0, state.topIndex - visibleItems);
  }
  
  // Then adjust the selected index to move with the page
  state.selectedIndex = Math.max(0, state.selectedIndex - visibleItems);
  
  // Ensure selected index is not before topIndex
  state.selectedIndex = Math.max(state.selectedIndex, state.topIndex);
}

function handlePageDown(): void {
  // Remove debug logging
  const visibleItems = 15; // Adjust based on your display area
  let maxItems = 0;
  
  // Get the maximum number of items based on current menu
  if (state.menu === "all") {
    maxItems = getRelays().length;
  } else if (state.menu === "ignored") {
    maxItems = getRelays().filter(r => r.ignore === 1).length;
  } else if (state.menu === "config") {
    // For config, this is the number of keys in the current level
    const currentLevel = getCurrentConfigLevel();
    maxItems = Object.keys(currentLevel).length;
  }
  
  if (maxItems > 0) {
    // First adjust topIndex for scrolling
    const maxTopIndex = Math.max(0, maxItems - visibleItems);
    state.topIndex = Math.min(maxTopIndex, state.topIndex + visibleItems);
    
    // Then adjust the selected index to move with the page
    state.selectedIndex = Math.min(maxItems - 1, state.selectedIndex + visibleItems);
    
    // Ensure selected index is not past what's shown on current page
    state.selectedIndex = Math.min(state.selectedIndex, state.topIndex + visibleItems - 1);
  }
}

// Function to handle user input
const handleKeyPress = async (keyEvent: KeyEvent): Promise<void> => {
  const key = keyEvent.key;
  
  // If we're filtering, handle filter input
  if (state.isFiltering) {
    if (key === "Enter" || key === "Escape") {
      state.isFiltering = false;
      // Reset topIndex when filter changes or is applied
      state.topIndex = 0;
      // Also reset selectedIndex to ensure it's valid
      state.selectedIndex = 0;
    } else if (key === "Backspace") {
      state.filter = state.filter.slice(0, -1);
    } else if (key.length === 1) {
      state.filter += key;
    }
    return;
  }
  
  // Handle PageUp and PageDown across all menus
  if (key === "PageUp") {
    if (["ignored", "all", "config"].includes(state.menu)) {
      handlePageUp();
    }
    return;
  } else if (key === "PageDown") {
    if (["ignored", "all", "config"].includes(state.menu)) {
      handlePageDown();
    }
    return;
  }
  
  // Exit the application when Escape is pressed
  if (key === "Escape") {
    if (state.menu !== "main") {
      state.menu = "main";
      state.selectedIndex = 0;
      state.topIndex = 0;
      state.filter = "";
    } else {
      state.running = false;
    }
    return;
  }
  
  // Main menu navigation
  if (state.menu === "main") {
    if (key === "ArrowUp" && state.selectedIndex > 0) {
      state.selectedIndex--;
    } else if (key === "ArrowDown" && state.selectedIndex < 3) {
      state.selectedIndex++;
    } else if (key === "Enter") {
      switch (state.selectedIndex) {
        case 0: // Run Monitor
          state.menu = "monitor";
          // Only start the monitor if it's not already running
          if (!state.monitorProcess) {
            try {
              // Check if Deno.run is available using a safe approach that avoids TypeScript errors
              // @ts-ignore - Ignore TypeScript error for runtime feature detection
              if (Deno && typeof Deno.run === 'function') {
                // @ts-ignore - Ignore TypeScript error for runtime feature
                state.monitorProcess = Deno.run({
                  cmd: ["deno", "task", "start", "-c", state.configPath],
                  // Use piped stdout/stderr so we can control when to display output
                  stdout: "piped",
                  stderr: "piped",
                });
                // @ts-ignore - Get PID if available
                state.monitorPid = state.monitorProcess.pid;
                logger.info(`Started monitor process with PID: ${state.monitorPid}`);
              } else {
                // Fallback for environments where Deno.run isn't available
                logger.info(`Starting monitor with config: ${state.configPath}`);
                logger.warn("Note: Unable to start process in this environment. Please run manually.");
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error(`Error starting monitor: ${errorMessage}`);
            }
          }
          break;
        case 1: // Configuration
          state.menu = "config";
          state.configState.path = [];
          state.selectedIndex = 0;
          break;
        case 2: // Ignored Relays
          state.menu = "ignored";
          state.selectedIndex = 0;
          state.topIndex = 0;
          break;
        case 3: // All Relays
          state.menu = "all";
          state.selectedIndex = 0;
          state.topIndex = 0;
          break;
      }
    }
  }
  // Monitor menu handling
  else if (state.menu === "monitor") {
    if (key === "s" || key === "S") {
      // Stop the monitor if it's running
      if (state.monitorProcess) {
        try {
          // @ts-ignore - TypeScript doesn't know about .kill() method
          state.monitorProcess.kill("SIGTERM");
          // @ts-ignore - TypeScript doesn't know about .close() method
          state.monitorProcess.close();
          state.monitorProcess = null;
          state.monitorPid = null;
          logger.info("Monitor stopped");
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error stopping monitor: ${errorMessage}`);
        }
      }
      state.menu = "main";
    } else if (key === "r" || key === "R") {
      // Restart the monitor
      if (state.monitorProcess) {
        try {
          // @ts-ignore - TypeScript doesn't know about .kill() method
          state.monitorProcess.kill("SIGTERM");
          // @ts-ignore - TypeScript doesn't know about .close() method
          state.monitorProcess.close();
          state.monitorProcess = null;
          state.monitorPid = null;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error stopping monitor for restart: ${errorMessage}`);
        }
      }
      
      try {
        // @ts-ignore - Ignore TypeScript error for runtime feature
        state.monitorProcess = Deno.run({
          cmd: ["deno", "task", "start", "-c", state.configPath],
          stdout: "piped",
          stderr: "piped",
        });
        // @ts-ignore - Get PID if available
        state.monitorPid = state.monitorProcess.pid;
        logger.info(`Restarted monitor process with PID: ${state.monitorPid}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error restarting monitor: ${errorMessage}`);
      }
    }
  }
  // Config menu handling
  else if (state.menu === "config") {
    // Get the current config object based on the path
    let currentConfig = state.config;
    let parentConfig = null;
    let currentKey = "";
    
    // Navigate to the current path
    for (let i = 0; i < state.configState.path.length; i++) {
      parentConfig = currentConfig;
      currentKey = state.configState.path[i];
      currentConfig = currentConfig[currentKey];
    }
    
    // If we're editing a value
    if (state.configState.isEditing) {
      if (key === "Enter") {
        // Save the edited value
        try {
          const oldValue = currentConfig[state.configState.editingKey!];
          let newValue: any = state.configState.editingValue;
          
          // Try to parse as number or boolean if applicable
          if (newValue === "true") newValue = true;
          else if (newValue === "false") newValue = false;
          else if (!isNaN(Number(newValue)) && newValue.trim() !== "") newValue = Number(newValue);
          
          // Update the value
          currentConfig[state.configState.editingKey!] = newValue;
          logger.info(`Updated ${state.configState.editingKey}: ${oldValue} -> ${String(newValue)}`);
          
          // Exit edit mode
          state.configState.isEditing = false;
          state.configState.editingKey = null;
          state.configState.cursorPosition = 0;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error updating config value: ${errorMessage}`);
        }
      } else if (key === "Escape") {
        // Cancel editing
        state.configState.isEditing = false;
        state.configState.editingKey = null;
        state.configState.cursorPosition = 0;
      } else if (key === "Backspace") {
        // Handle backspace for editing - delete character before cursor
        if (state.configState.cursorPosition > 0) {
          state.configState.editingValue = 
            state.configState.editingValue.substring(0, state.configState.cursorPosition - 1) + 
            state.configState.editingValue.substring(state.configState.cursorPosition);
          state.configState.cursorPosition--;
        }
      } else if (key === "Delete") {
        // Delete character at cursor
        if (state.configState.cursorPosition < state.configState.editingValue.length) {
          state.configState.editingValue = 
            state.configState.editingValue.substring(0, state.configState.cursorPosition) + 
            state.configState.editingValue.substring(state.configState.cursorPosition + 1);
        }
      } else if (key === "ArrowLeft") {
        // Move cursor left
        if (state.configState.cursorPosition > 0) {
          state.configState.cursorPosition--;
        }
      } else if (key === "ArrowRight") {
        // Move cursor right
        if (state.configState.cursorPosition < state.configState.editingValue.length) {
          state.configState.cursorPosition++;
        }
      } else if (key === "Home") {
        // Move cursor to beginning
        state.configState.cursorPosition = 0;
      } else if (key === "End") {
        // Move cursor to end
        state.configState.cursorPosition = state.configState.editingValue.length;
      } else if (key === "PageUp") {
        // Move cursor up
        if (state.selectedIndex > 0) {
          state.selectedIndex--;
        }
      } else if (key === "PageDown") {
        // Move cursor down
        if (state.selectedIndex < 15) {
          state.selectedIndex++;
        }
      } else if (key.length === 1) {
        // Add character at cursor position
        state.configState.editingValue = 
          state.configState.editingValue.substring(0, state.configState.cursorPosition) + 
          key + 
          state.configState.editingValue.substring(state.configState.cursorPosition);
        state.configState.cursorPosition++;
      }
    } else {
      // Not in edit mode
      if (key === "s" || key === "S") {
        // Save config
        await saveConfig(state.config, state.configPath);
      } else if (key === "Escape") {
        if (state.configState.path.length > 0) {
          // Go up one level
          state.configState.path.pop();
          state.selectedIndex = 0;
        } else {
          // Exit config menu
          state.menu = "main";
          state.selectedIndex = 1; // Position at the config option
        }
      } else if (key === "ArrowUp" && state.selectedIndex > 0) {
        state.selectedIndex--;
      } else if (key === "ArrowDown") {
        const entries = Object.entries(currentConfig);
        if (state.selectedIndex < entries.length - 1) {
          state.selectedIndex++;
        }
      } else if (key === "Enter") {
        const entries = Object.entries(currentConfig);
        if (entries.length > 0 && state.selectedIndex < entries.length) {
          const [selectedKey, selectedValue] = entries[state.selectedIndex];
          
          if (typeof selectedValue === "object" && selectedValue !== null) {
            // Navigate into the object
            state.configState.path.push(selectedKey);
            state.selectedIndex = 0;
          } else {
            // Edit the primitive value
            state.configState.isEditing = true;
            state.configState.editingKey = selectedKey;
            state.configState.editingValue = String(selectedValue);
            state.configState.cursorPosition = state.configState.editingValue.length;
          }
        }
      } else if ((key === "d" || key === "D") && currentKey && parentConfig) {
        // Delete the current item if we're in a sub-path
        try {
          if (Array.isArray(parentConfig)) {
            parentConfig.splice(Number(currentKey), 1);
          } else {
            delete parentConfig[currentKey];
          }
          // Go back up one level
          state.configState.path.pop();
          state.selectedIndex = 0;
          logger.info(`Deleted config item: ${currentKey}`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error deleting config item: ${errorMessage}`);
        }
      } else if (key === "a" || key === "A") {
        // Add a new item
        if (Array.isArray(currentConfig)) {
          // Add empty item to array
          currentConfig.push("");
          logger.info(`Added new item to array at index ${currentConfig.length - 1}`);
        } else if (typeof currentConfig === "object" && currentConfig !== null) {
          // Enter a new key
          state.configState.isEditing = true;
          state.configState.editingKey = "new_key";
          state.configState.editingValue = "";
          state.configState.cursorPosition = 0;
        }
      }
    }
  }
  // Ignored relays menu handling
  else if (state.menu === "ignored") {
    let ignoredRelays = getIgnoredRelays();
    
    // Apply filter if set
    if (state.filter) {
      const filterLower = state.filter.toLowerCase();
      ignoredRelays = ignoredRelays.filter(relay => 
        relay.url.toLowerCase().includes(filterLower)
      );
    }
    
    if (key === "f" || key === "F") {
      // Start filtering
      state.isFiltering = true;
      state.filter = "";
    } else if (key === "ArrowUp") {
      if (state.selectedIndex > 0) {
        state.selectedIndex--;
        // Adjust topIndex for scrolling
        if (state.selectedIndex < state.topIndex) {
          state.topIndex = state.selectedIndex;
        }
      }
    } else if (key === "ArrowDown") {
      if (state.selectedIndex < ignoredRelays.length - 1) {
        state.selectedIndex++;
        // Adjust topIndex for scrolling
        const visibleItems = 15; // Adjust based on your display area
        if (state.selectedIndex >= state.topIndex + visibleItems) {
          state.topIndex = state.selectedIndex - visibleItems + 1;
        }
      }
    } else if (key === "Enter" && ignoredRelays.length > 0) {
      // Unignore the selected relay
      const selectedRelay = ignoredRelays[state.selectedIndex];
      toggleRelayIgnore(selectedRelay.url, false);
    } else if (key === "d" || key === "D") {
      // Delete the selected relay
      if (ignoredRelays.length > 0) {
        const selectedRelay = ignoredRelays[state.selectedIndex];
        deleteRelay(selectedRelay.url);
        if (state.selectedIndex >= ignoredRelays.length - 1) {
          state.selectedIndex = Math.max(0, ignoredRelays.length - 2);
        }
      }
    }
  }
  // All relays menu handling
  else if (state.menu === "all") {
    let relays = getRelays();
    
    // Apply filter if set
    if (state.filter) {
      const filterLower = state.filter.toLowerCase();
      relays = relays.filter(relay => 
        relay.url.toLowerCase().includes(filterLower)
      );
      
      // Reset topIndex if it would be outside the valid range for filtered results
      if (state.topIndex >= relays.length) {
        state.topIndex = Math.max(0, relays.length - 15);
      }
      
      // Also ensure selectedIndex is valid for the filtered results
      if (state.selectedIndex >= relays.length) {
        state.selectedIndex = Math.max(0, relays.length - 1);
      }
    }
    
    if (key === "f" || key === "F") {
      // Start filtering
      state.isFiltering = true;
      state.filter = "";
      // Reset indices when starting a new filter
      state.topIndex = 0;
      state.selectedIndex = 0;
    } else if (key === "ArrowUp") {
      if (state.selectedIndex > 0) {
        state.selectedIndex--;
        // Adjust topIndex for scrolling
        if (state.selectedIndex < state.topIndex) {
          state.topIndex = state.selectedIndex;
        }
      }
    } else if (key === "ArrowDown") {
      if (state.selectedIndex < relays.length - 1) {
        state.selectedIndex++;
        // Adjust topIndex for scrolling
        const visibleItems = 15; // Adjust based on your display area
        if (state.selectedIndex >= state.topIndex + visibleItems) {
          state.topIndex = state.selectedIndex - visibleItems + 1;
        }
      }
    } else if (key === "Enter" && relays.length > 0) {
      // Toggle ignore status of the selected relay
      const selectedRelay = relays[state.selectedIndex];
      toggleRelayIgnore(selectedRelay.url, selectedRelay.ignore === 1 ? false : true);
    } else if (key === "d" || key === "D") {
      // Delete the selected relay
      if (relays.length > 0) {
        const selectedRelay = relays[state.selectedIndex];
        deleteRelay(selectedRelay.url);
        if (state.selectedIndex >= relays.length - 1) {
          state.selectedIndex = Math.max(0, relays.length - 2);
        }
      }
    }
  }
}

// Main render function
function render(): string {
  // If we're filtering, append the filtering indicator
  let output = "";
  
  // Render the appropriate menu
  switch (state.menu) {
    case "main":
      output = renderMainMenu();
      break;
    case "monitor":
      output = renderMonitorMenu();
      break;
    case "config":
      output = renderConfigMenu();
      break;
    case "ignored":
      output = renderIgnoredRelaysMenu();
      break;
    case "all":
      output = renderAllRelaysMenu();
      break;
    default:
      output = "Unknown menu";
  }
  
  return output;
}

// Render function for the main menu
function renderMainMenu(): string {
  const options = [
    "Run Monitor",
    "Configuration",
    "Ignored Relays",
    "All Relays",
  ];
  
  const content = options.map((option, index) => {
    const prefix = index === state.selectedIndex ? colors.green(" > ") : "   ";
    return `${prefix}${option}`;
  });
  
  return renderBox("RelayMon Interactive Menu", content);
}

// Render function for the monitor menu
function renderMonitorMenu(): string {
  const isRunning = state.monitorProcess !== null;
  
  const content = [
    isRunning ? `Status: Running (PID: ${state.monitorPid || 'unknown'})` : "Status: Stopped",
    "",
  ];
  
  // Get latest output if process is running
  if (isRunning && state.monitorProcess) {
    content.push("Recent output:");
    content.push("------------");
    
    // Add some placeholder for output - in reality, we would read from the process
    content.push("Monitor is running in the background.");
    content.push("Check the logs directory for detailed output.");
  }
  
  content.push("");
  content.push("[R] Restart Monitor");
  content.push("[S] Stop Monitor");
  content.push("[ESC] Back to Main Menu (monitor remains running in background)");
  
  return renderBox("Monitor Status", content);
}

// Render function for the configuration menu
function renderConfigMenu(): string {
  // Get the current config object based on the path
  let currentConfig = state.config;
  let breadcrumbs = ["config"];
  
  // Navigate to the current path
  for (const key of state.configState.path) {
    currentConfig = currentConfig[key];
    breadcrumbs.push(key);
  }
  
  // Create a breadcrumb trail for navigation context
  const breadcrumbTrail = breadcrumbs.join(" > ");
  
  let content: string[] = [];
  content.push(breadcrumbTrail);
  content.push("");
  
  if (state.configState.isEditing) {
    // Show editing interface
    content.push(`Editing: ${state.configState.editingKey}`);
    
    // Create a box around the editable text with cursor
    const value = state.configState.editingValue;
    const cursorPos = state.configState.cursorPosition;
    
    // Calculate cursor display
    let displayValue = "";
    for (let i = 0; i < value.length; i++) {
      if (i === cursorPos && state.configState.showCursor) {
        displayValue += colors.bgWhite(colors.black(value[i] || ' '));
      } else {
        displayValue += value[i];
      }
    }
    
    // If cursor is at the end, add a space for it
    if (cursorPos === value.length && state.configState.showCursor) {
      displayValue += colors.bgWhite(' ');
    }
    
    // Draw a box around the value
    content.push("┌" + "─".repeat(Math.max(40, value.length + 2)) + "┐");
    content.push("│ " + displayValue + " ".repeat(Math.max(39 - value.length, 0)) + "│");
    content.push("└" + "─".repeat(Math.max(40, value.length + 2)) + "┘");
    
    content.push("");
    content.push("[Enter] Save  [Escape] Cancel");
    content.push("[←/→] Move Cursor  [Home/End] Start/End  [Delete] Delete at Cursor");
  } else {
    // Show current config section
    const entries = Object.entries(currentConfig);
    
    if (entries.length === 0) {
      content.push("Empty configuration section");
    } else {
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        const isSelected = i === state.selectedIndex;
        const prefix = isSelected ? colors.green(" > ") : "   ";
        
        let displayValue: string;
        
        if (typeof value === "object" && value !== null) {
          // For objects and arrays
          if (Array.isArray(value)) {
            displayValue = `[Array: ${value.length} items]`;
          } else {
            displayValue = `{Object: ${Object.keys(value).length} keys}`;
          }
        } else {
          // For primitive values
          displayValue = String(value);
        }
        
        const line = `${prefix}${key}: ${displayValue}`;
        if (isSelected) {
          content.push(colors.bgBlue(line));
        } else {
          content.push(line);
        }
      }
    }
    
    content.push("");
    content.push("[Enter] Edit/Navigate  [A] Add Item  [D] Delete Item");
    content.push("[S] Save Configuration  [Escape] Back");
  }
  
  return renderBox("Configuration Editor", content);
}

// Render function for the ignored relays menu
function renderIgnoredRelaysMenu(): string {
  let ignoredRelays = getIgnoredRelays();
  
  // Apply filter if set
  if (state.filter) {
    const filterLower = state.filter.toLowerCase();
    ignoredRelays = ignoredRelays.filter(relay => 
      relay.url.toLowerCase().includes(filterLower)
    );
    
    // Reset indices if needed for filtered results
    if (state.topIndex >= ignoredRelays.length) {
      state.topIndex = Math.max(0, ignoredRelays.length - 15);
    }
    if (state.selectedIndex >= ignoredRelays.length) {
      state.selectedIndex = Math.max(0, ignoredRelays.length - 1);
    }
  }
  
  let content: string[] = [];
  
  // Show filter status if filtering
  if (state.isFiltering) {
    content.push(`Enter filter: ${state.filter}_`);
    content.push("");
  } else if (state.filter) {
    content.push(`Filter: ${state.filter} [F to change]`);
    content.push("");
  } else {
    content.push("[F] Filter list");
    content.push("");
  }
  
  if (ignoredRelays.length === 0) {
    content.push("No ignored relays found.");
  } else {
    // Calculate visible range for scrolling
    const visibleItems = 15; // Adjust based on your display area
    const endIndex = Math.min(state.topIndex + visibleItems, ignoredRelays.length);
    
    // Show pagination info
    content.push(`Showing ${state.topIndex + 1}-${endIndex} of ${ignoredRelays.length} relays`);
    
    // Show scrolling indicators
    if (state.topIndex > 0) {
      content.push("  ↑ (more above)");
    }
    
    // Add column headers
    content.push("");
    content.push("   URL                             | Network  | Last Checked     | Status");
    content.push("   " + "-".repeat(32) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(15) + "-+--------");
    
    // Display visible relays
    for (let i = state.topIndex; i < endIndex; i++) {
      const relay = ignoredRelays[i];
      const isSelected = i === state.selectedIndex;
      const prefix = isSelected ? colors.green(" > ") : "   ";
      const status = relay.online === 1 ? colors.green("✓") : colors.red("✗");
      
      // Format relay information to fit in columns
      const urlMaxLength = 32; // Limit URL length for display - matching the All Relays view
      const truncatedUrl = relay.url.length > urlMaxLength ? 
        relay.url.substring(0, urlMaxLength-3) + "..." : 
        relay.url.padEnd(urlMaxLength);
      
      // Enhanced date display with relative time
      const relativeTime = formatRelativeTime(relay.checked_at);
      
      // Create a formatted line with columns
      let line = `${prefix}${status} ${truncatedUrl}`;
      
      // Add network column
      line += ` | ${relay.network.padEnd(8)}`;
      
      // Add time column
      line += ` | ${relativeTime.padEnd(15)}`;
      
      // Add ignored indicator for consistency with all relays view
      line += " | " + colors.yellow("[IGNORED]");
      
      if (isSelected) {
        content.push(colors.bgBlue(line));
      } else {
        content.push(line);
      }
    }
    
    // Show scrolling indicators
    if (endIndex < ignoredRelays.length) {
      content.push("  ↓ (more below)");
    }
  }
  
  content.push("");
  content.push("[Enter] Unignore Selected Relay");
  content.push("[D] Delete Selected Relay");
  content.push("[PageUp/PageDown] Navigate pages");
  content.push("[ESC] Back to Main Menu");
  
  return renderBox(`Ignored Relays (${ignoredRelays.length})`, content);
}

// Main function
async function main() {
  // Parse command line arguments
  const args = Deno.args;
  
  // Parse config path from arguments
  let configPath = "./config.yaml";
  const configArgIndex = Math.max(args.indexOf("-c"), args.indexOf("--config"));
  if (configArgIndex !== -1 && configArgIndex < args.length - 1) {
    configPath = args[configArgIndex + 1];
  }
  
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
  const dbPath = state.config.db?.path || "relaymon.db";
  logger.info(`Connecting to database: ${dbPath}`);
  
  let retryCount = 0;
  const maxRetries = 3;
  let dbInitialized = false;
  
  while (!dbInitialized && retryCount < maxRetries) {
    try {
      // Make sure the DB is initialized
      initDB(dbPath, state.config.db?.enableWAL || true);
      logger.info("Database initialized successfully");
      
      // Test if we can query the database
      const testQuery = db.query("SELECT COUNT(*) FROM relay_status");
      logger.info(`Database connection test: found ${testQuery[0][0]} relays`);
      dbInitialized = true;
    } catch (error: unknown) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Database initialization error (attempt ${retryCount}/${maxRetries}): ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        if (error instanceof Error && error.stack) {
          logger.error(error.stack);
        }
        
        // Continue with warnings instead of exiting if max retries reached
        logger.warn("Continuing with limited functionality due to database issues");
        console.warn("Warning: Database could not be initialized properly. Some features may not work.");
      } else {
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        logger.info(`Retrying database initialization...`);
      }
    }
  }
  
  // Set up keyboard event listener
  Deno.stdin.setRaw(true);
  const decoder = new TextDecoder();
  
  clearScreen();
  console.log(render());
  
  // Clean up resources before exiting
  const cleanup = () => {
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
  };
  
  // Set up cleanup on exit
  globalThis.addEventListener("unload", cleanup);
  
  try {
    // Main event loop
    while (state.running) {
      // Read initial bytes with larger buffer
      const buffer = new Uint8Array(32); // Increased buffer size for longer sequences
      const numBytesRead = await Deno.stdin.read(buffer);
      
      if (numBytesRead === null) break;
      
      // Get the first chunk of input
      const input = decoder.decode(buffer.subarray(0, numBytesRead));
      
      // Special handling for PageUp/PageDown - they can come in different forms
      if (input.includes("[5") || input.includes("OI") || input.includes("O5")) {
        await handleKeyPress({ key: "PageUp" });
      } else if (input.includes("[6") || input.includes("OQ") || input.includes("O6")) {
        await handleKeyPress({ key: "PageDown" });
      }
      // Handle escape sequences properly
      else if (input.startsWith("\x1b")) {
        // This could be an escape key or the start of an escape sequence
        if (input.length === 1) {
          // Just the escape key alone - we need to read more to check for sequences
          const escBuffer = new Uint8Array(32); // Increased buffer for longer sequences
          
          // Set a longer timeout to capture the full sequence
          const bytesRead = await Promise.race([
            Deno.stdin.read(escBuffer),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 100)) // Increased timeout
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
      } else if (input === "\r") {
        await handleKeyPress({ key: "Enter" });
      } else if (input === "\x7f") {
        await handleKeyPress({ key: "Backspace" });
      } else if (input === "\t") {
        // Tab key - maybe use for navigation between sections
        // For now, do nothing
      } else if (input.length === 1 && input >= " " && input <= "~") {
        // Printable ASCII character
        await handleKeyPress({ key: input });
      }
      
      // Redraw UI
      clearScreen();
      console.log(render());
      
      // Small delay to prevent CPU hogging
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } finally {
    cleanup();
  }
  
  clearScreen();
  console.log("RelayMon interactive mode exited");
}

// Helper function to handle escape sequences
async function handleEscapeSequence(sequence: string): Promise<void> {
  // Debug the sequence for troubleshooting
  console.log("Escape sequence:", JSON.stringify(sequence));
  
  // Handle common escape sequences for arrow keys and special keys
  if (sequence === "\x1b[A" || sequence.includes("[A")) {
    await handleKeyPress({ key: "ArrowUp" });
  } else if (sequence === "\x1b[B" || sequence.includes("[B")) {
    await handleKeyPress({ key: "ArrowDown" });
  } else if (sequence === "\x1b[C" || sequence.includes("[C")) {
    await handleKeyPress({ key: "ArrowRight" });
  } else if (sequence === "\x1b[D" || sequence.includes("[D")) {
    await handleKeyPress({ key: "ArrowLeft" });
  } else if (sequence === "\x1b[5~" || sequence.includes("[5~") || sequence.includes("OI") || 
             sequence.includes("[25~") || sequence.includes("O5")) {
    // PageUp (different terminals send different sequences)
    await handleKeyPress({ key: "PageUp" });
  } else if (sequence === "\x1b[6~" || sequence.includes("[6~") || sequence.includes("OQ") || 
             sequence.includes("[26~") || sequence.includes("O6")) {
    // PageDown (different terminals send different sequences)
    await handleKeyPress({ key: "PageDown" });
  } else if (sequence === "\x1b[H" || sequence.includes("[H") || sequence.includes("[1~")) {
    await handleKeyPress({ key: "Home" });
  } else if (sequence === "\x1b[F" || sequence.includes("[F") || sequence.includes("[4~")) {
    await handleKeyPress({ key: "End" });
  } else if (sequence === "\x1b[3~" || sequence.includes("[3~")) {
    await handleKeyPress({ key: "Delete" });
  } else {
    // Unknown sequence or just Escape
    console.log("Unknown escape sequence:", JSON.stringify(sequence));
    await handleKeyPress({ key: "Escape" });
  }
}

// Render function for the all relays menu
function renderAllRelaysMenu(): string {
  const relayCounts = getRelayCounts();
  let relays = getRelays();
  
  // Apply filter if set
  if (state.filter) {
    const filterLower = state.filter.toLowerCase();
    relays = relays.filter(relay => 
      relay.url.toLowerCase().includes(filterLower)
    );
    
    // Ensure topIndex is valid for the filtered results
    if (state.topIndex >= relays.length) {
      state.topIndex = Math.max(0, relays.length - 15);
    }
  }
  
  // Apply sorting
  relays.sort((a, b) => {
    let valA = a[state.sortColumn as keyof typeof a];
    let valB = b[state.sortColumn as keyof typeof b];
    
    // Handle special cases like dates
    if (state.sortColumn === "checked_at") {
      valA = Number(valA);
      valB = Number(valB);
    }
    
    if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  
  // Apply grouping if enabled
  let groupedRelays: Record<string, typeof relays> = {};
  
  if (state.groupBy) {
    relays.forEach(relay => {
      const groupValue = String(relay[state.groupBy as keyof typeof relay] || "unknown");
      if (!groupedRelays[groupValue]) {
        groupedRelays[groupValue] = [];
      }
      groupedRelays[groupValue].push(relay);
    });
  }
  
  let content: string[] = [];
  
  // Stats header
  content.push(`Total: ${relayCounts.total} | Online: ${relayCounts.online} | Offline: ${relayCounts.offline} | Ignored: ${relayCounts.ignored}`);
  content.push(`Sort: ${state.sortColumn} (${state.sortDirection}) | Group: ${state.groupBy || "none"}`);
  
  // Show filter status if filtering
  if (state.isFiltering) {
    content.push(`Enter filter: ${state.filter}_`);
  } else if (state.filter) {
    content.push(`Filter: ${state.filter} [F to change]`);
  } else {
    content.push("[F] Filter list");
  }
  
  content.push("");
  
  if (relays.length === 0) {
    content.push("No relays found.");
    content.push("Make sure the database is properly initialized and contains relay data.");
  } else if (state.groupBy) {
    // Render grouped relays
    Object.entries(groupedRelays).forEach(([group, groupRelays]) => {
      content.push(colors.bold(`Group: ${group} (${groupRelays.length})`));
      
      // Add column headers for this group
      content.push("   URL                             | Network  | Last Checked     | Status");
      content.push("   " + "-".repeat(32) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(15) + "-+--------");
      
      // Calculate visible range for this group
      const visibleRelaysPerGroup = 8; // Adjust based on your display area
      const toShow = groupRelays.slice(0, visibleRelaysPerGroup);
      
      toShow.forEach((relay) => {
        const isSelected = relays.findIndex(r => r.url === relay.url) === state.selectedIndex;
        const prefix = isSelected ? colors.green(" > ") : "   ";
        const status = relay.online === 1 ? colors.green("✓") : colors.red("✗");
        const ignored = relay.ignore === 1 ? colors.yellow(" [IGNORED]") : "";
        
        // Format relay information to fit in columns
        const urlMaxLength = 32; // Limit URL length for display
        const truncatedUrl = relay.url.length > urlMaxLength ? 
          relay.url.substring(0, urlMaxLength-3) + "..." : 
          relay.url.padEnd(urlMaxLength);
        
        // Enhanced date display with relative time
        const relativeTime = formatRelativeTime(relay.checked_at);
        
        // Create a formatted line with columns
        let line = `${prefix}${status} ${truncatedUrl}`;
        
        // Add network column
        line += ` | ${relay.network.padEnd(8)}`;
        
        // Add time column
        line += ` | ${relativeTime.padEnd(15)}`;
        
        // Add ignored indicator at the end if needed
        if (ignored) {
          line += ` ${ignored}`;
        }
        
        if (isSelected) {
          content.push(colors.bgBlue(line));
        } else {
          content.push(line);
        }
      });
      
      if (groupRelays.length > visibleRelaysPerGroup) {
        content.push(`   ... and ${groupRelays.length - visibleRelaysPerGroup} more`);
      }
      content.push("");
    });
  } else {
    // Calculate visible range for scrolling
    const visibleItems = 15; // Adjust based on your display area
    const startIndex = state.topIndex;
    const endIndex = Math.min(startIndex + visibleItems, relays.length);
    
    // Show pagination info
    if (relays.length > 0) {
      content.push(`Showing ${startIndex + 1}-${endIndex} of ${relays.length} relays`);
    } else {
      content.push("No relays found matching the filter criteria.");
    }
    
    // Show scrolling indicators
    if (startIndex > 0) {
      content.push("  ↑ (more above)");
    }
    
    // Add column headers
    content.push("");
    content.push("   URL                             | Network  | Last Checked     | Status");
    content.push("   " + "-".repeat(32) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(15) + "-+--------");
    
    // Render flat list of relays
    for (let i = startIndex; i < endIndex; i++) {
      const relay = relays[i];
      const isSelected = i === state.selectedIndex;
      const prefix = isSelected ? colors.green(" > ") : "   ";
      const status = relay.online === 1 ? colors.green("✓") : colors.red("✗");
      const ignored = relay.ignore === 1 ? colors.yellow(" [IGNORED]") : "";
      
      // Format relay information to fit in columns
      const urlMaxLength = 32; // Limit URL length for display
      const truncatedUrl = relay.url.length > urlMaxLength ? 
        relay.url.substring(0, urlMaxLength-3) + "..." : 
        relay.url.padEnd(urlMaxLength);
      
      // Enhanced date display with relative time
      const relativeTime = formatRelativeTime(relay.checked_at);
      
      // Create a formatted line with columns
      let line = `${prefix}${status} ${truncatedUrl}`;
      
      // Add network column
      line += ` | ${relay.network.padEnd(8)}`;
      
      // Add time column
      line += ` | ${relativeTime.padEnd(15)}`;
      
      // Add ignored indicator at the end if needed
      if (ignored) {
        line += ` ${ignored}`;
      }
      
      if (isSelected) {
        content.push(colors.bgBlue(line));
      } else {
        content.push(line);
      }
    }
    
    // Show scrolling indicators
    if (endIndex < relays.length) {
      content.push("  ↓ (more below)");
    }
  }
  
  content.push("");
  content.push("[Enter] Toggle Ignore Status");
  content.push("[S] Change Sort Field  [D] Toggle Sort Direction  [G] Toggle Grouping");
  content.push("[Delete] Delete Selected Relay  [PageUp/PageDown] Navigate pages");
  content.push("[ESC] Back to Main Menu");
  
  const title = state.filter 
    ? `All Relays (${relays.length} of ${relayCounts.total} shown)` 
    : `All Relays (${relayCounts.total})`;
    
  return renderBox(title, content);
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  if (timestamp === null || timestamp === undefined || timestamp <= 0) return "never";
  
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < 0) return "in the future"; // Handle case where timestamp is in the future
  
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  
  // For longer periods, just return the date
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

// Call main function
if (import.meta.main) {
  main().catch(error => {
    console.error(`Error in main function: ${error.message}`);
    console.error(error.stack);
    Deno.exit(1);
  });
} 