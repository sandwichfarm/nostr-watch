import { state } from "./state.ts";
import { getRelays, getIgnoredRelays, toggleRelayIgnore, deleteRelay, db, createSampleIgnoredRelay, resetCache, debugAndRepairIgnoredRelays } from "./db.ts";
import { Config } from "../../config/config.ts";
import { getLogger } from "../../utils/logger.ts";
import { getCurrentConfigLevel } from "./state.ts";
import { msToTimeString } from "../../config/config.ts";
import { ColumnName } from "./state.ts";

const logger = getLogger("InteractiveInput");

// Define our key event interface
export interface KeyEvent {
  key: string;
}

// Add PageUp and PageDown functionality to the state
export function handlePageUp(): void {
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

export function handlePageDown(): void {
  const visibleItems = 15; // Adjust based on your display area
  let maxItems = 0;
  
  // Get the maximum number of items based on current menu
  if (state.menu === "relayStatus") {
    const relays = getRelays();
    maxItems = state.filter ? 
      relays.filter(r => r.url.toLowerCase().includes(state.filter.toLowerCase())).length : 
      relays.length;
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
export const handleKeyPress = async (keyEvent: KeyEvent): Promise<void> => {
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
    if (["relayStatus", "config"].includes(state.menu)) {
      handlePageUp();
    }
    return;
  } else if (key === "PageDown") {
    if (["relayStatus", "config"].includes(state.menu)) {
      handlePageDown();
    }
    return;
  }
  
  // Exit the application when Escape is pressed on the main menu
  if (key === "Escape") {
    if (state.menu !== "main") {
      state.menu = "main";
      state.selectedIndex = 0;
      state.topIndex = 0;
      state.filter = "";
    } else {
      // If we're already on the main menu, exit the app
      state.running = false;
      logger.info("Exit requested via Escape key on main menu");
    }
    return;
  }
  
  // Main menu navigation
  if (state.menu === "main") {
    handleMainMenuInput(key);
  }
  // Monitor menu handling
  else if (state.menu === "monitor") {
    handleMonitorMenuInput(key);
  }
  // Config menu handling
  else if (state.menu === "config") {
    handleConfigMenuInput(key);
  }
  // Relay status menu handling
  else if (state.menu === "relayStatus") {
    handleRelayStatusMenuInput(key);
  }
  // Monitor logs menu handling
  else if (state.menu === "logs") {
    handleMonitorLogsInput(key);
  }
};

// Main menu input handling
function handleMainMenuInput(key: string): void {
  if (key === "ArrowUp" && state.selectedIndex > 0) {
    state.selectedIndex--;
  } else if (key === "ArrowDown" && state.selectedIndex < 3) { // Adjusted for fewer menu items
    state.selectedIndex++;
  } else if (key === "Enter") {
    switch (state.selectedIndex) {
      case 0: // Start/Stop Monitor
        if (state.monitorProcess) {
          // Monitor is running, stop it
          stopMonitorProcess();
        } else {
          // Monitor is not running, start it
          startMonitorProcess();
        }
        break;
      case 1: // Watch Monitor Logs
        state.menu = "logs";
        break;
      case 2: // Configuration
        state.menu = "config";
        state.configState.path = [];
        state.selectedIndex = 0;
        break;
      case 3: // Relay Status
        state.menu = "relayStatus";
        state.selectedIndex = 0;
        state.topIndex = 0;
        break;
    }
  }
}

// Monitor menu input handling
function handleMonitorMenuInput(key: string): void {
  if (key === "s" || key === "S") {
    // Stop the monitor if it's running
    if (state.monitorProcess) {
      stopMonitorProcess();
    }
    state.menu = "main";
  } else if (key === "r" || key === "R") {
    // Restart the monitor
    if (state.monitorProcess) {
      stopMonitorProcess();
    }
    startMonitorProcess();
  }
}

// Config menu input handling
function handleConfigMenuInput(key: string): void {
  // Get the current config object based on the path
  let currentConfig = getCurrentConfigLevel();
  let parentConfig = null;
  let currentKey = "";
  
  // Navigate to the current path
  if (state.configState.path.length > 0) {
    parentConfig = state.config;
    for (let i = 0; i < state.configState.path.length - 1; i++) {
      parentConfig = parentConfig[state.configState.path[i] as keyof typeof parentConfig];
    }
    currentKey = state.configState.path[state.configState.path.length - 1];
  }
  
  // If we're editing a value
  if (state.configState.isEditing) {
    handleConfigEditingInput(key, currentConfig);
  } else {
    // Not in edit mode
    handleConfigBrowsingInput(key, currentConfig, parentConfig, currentKey);
  }
}

// Handle input while editing config value
function handleConfigEditingInput(key: string, currentConfig: any): void {
  if (key === "Enter") {
    // Save the edited value
    try {
      const editingKey = state.configState.editingKey!;
      const oldValue = currentConfig[editingKey];
      let newValue: any = state.configState.editingValue;
      
      // Check if this is likely a time-related key
      if (isTimeKey(editingKey)) {
        // Allow users to enter timestrings directly
        // They get stored as numbers in the config after saving
        if (isTimeStringFormat(newValue)) {
          // This is a formatted timestring (like "5m", "2h"), keep it as is
          // When we eventually save the config, it will get processed correctly
          newValue = newValue;
        } else if (!isNaN(Number(newValue))) {
          // If they entered a pure number, assume milliseconds
          newValue = Number(newValue);
        }
      } else {
        // For non-time values, apply normal type conversion
        if (newValue === "true") newValue = true;
        else if (newValue === "false") newValue = false;
        else if (!isNaN(Number(newValue)) && newValue.trim() !== "") newValue = Number(newValue);
      }
      
      // Update the value
      currentConfig[editingKey] = newValue;
      logger.info(`Updated ${editingKey}: ${oldValue} -> ${String(newValue)}`);
      
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
    // Handle backspace
    if (state.configState.cursorPosition > 0) {
      const value = state.configState.editingValue;
      const cursor = state.configState.cursorPosition;
      state.configState.editingValue = value.substring(0, cursor - 1) + value.substring(cursor);
      state.configState.cursorPosition--;
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
    // Move cursor to the start
    state.configState.cursorPosition = 0;
  } else if (key === "End") {
    // Move cursor to the end
    state.configState.cursorPosition = state.configState.editingValue.length;
  } else if (key.length === 1) {
    // Add character at cursor position
    const value = state.configState.editingValue;
    const cursor = state.configState.cursorPosition;
    state.configState.editingValue = value.substring(0, cursor) + key + value.substring(cursor);
    state.configState.cursorPosition++;
  }
}

// Helper function to check if a key is likely to be a time-related value
function isTimeKey(key: string): boolean {
  const timeKeywords = [
    'interval',
    'timeout',
    'expires',
    'expiry',
    'delay',
    'duration',
    'ttl',
    'time'
  ];
  
  return timeKeywords.some(keyword => 
    key.toLowerCase().includes(keyword)
  );
}

// Check if a string is in timestring format (e.g., "5m", "2h", "30s")
function isTimeStringFormat(value: string): boolean {
  return /^\d+(?:\.\d+)?(?:ms|s|m|h|d)$/.test(value.trim());
}

// When starting to edit a configuration value, prepare the edit value
function startEditingValue(currentConfig: any, key: string): void {
  const value = currentConfig[key];
  let editValue: string;
  
  if (isTimeKey(key) && typeof value === "number" && value >= 1000) {
    // Convert milliseconds to timestring for editing using the centralized function
    editValue = msToTimeString(value);
  } else {
    // For other types, just convert to string
    editValue = String(value);
  }
  
  state.configState.isEditing = true;
  state.configState.editingKey = key;
  state.configState.editingValue = editValue;
  state.configState.cursorPosition = editValue.length;
}

// Handle browsing the config menu (not in edit mode)
function handleConfigBrowsingInput(key: string, currentConfig: any, parentConfig: any, currentKey: string): void {
  if (key === "s" || key === "S") {
    // Save config
    saveConfig(state.config, state.configPath);
  } else if (key === "ArrowUp" && state.selectedIndex > 0) {
    state.selectedIndex--;
    // Adjust topIndex for scrolling if needed
    if (state.selectedIndex < state.topIndex) {
      state.topIndex = state.selectedIndex;
    }
  } else if (key === "ArrowDown") {
    const entries = Object.entries(currentConfig);
    if (state.selectedIndex < entries.length - 1) {
      state.selectedIndex++;
      // Adjust topIndex for scrolling if needed
      const visibleItems = 15;
      if (state.selectedIndex >= state.topIndex + visibleItems) {
        state.topIndex = state.selectedIndex - visibleItems + 1;
      }
    }
  } else if (key === "Enter") {
    // Handle enter press in browse mode
    const entries = Object.entries(currentConfig);
    if (entries.length > 0 && state.selectedIndex >= 0 && state.selectedIndex < entries.length) {
      const [key, value] = entries[state.selectedIndex];
      
      if (typeof value === "object" && value !== null) {
        // Navigate into the object
        state.configState.path.push(key);
        state.selectedIndex = 0;
        state.topIndex = 0;
      } else {
        // Start editing the value
        startEditingValue(currentConfig, key);
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
      state.topIndex = 0;
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

// Helper function to toggle filters
function handleFilterToggle(): void {
  // If we're not in filter edit mode, do nothing
  if (!state.editingFilters) return;
  
  // Get the status options
  const statusOptions = ["online", "offline", "unchecked", "ignored"];
  
  // Get all network options as array
  const networkOptions = Object.keys(state.networkFilters);
  
  // If selected index is within status options
  if (state.filterMenuIndex < statusOptions.length) {
    const statusKey = statusOptions[state.filterMenuIndex] as keyof typeof state.statusFilters;
    state.statusFilters[statusKey] = !state.statusFilters[statusKey];
    logger.debug(`Toggled ${statusKey} status filter to: ${state.statusFilters[statusKey]}`);
  } 
  // If selected index is within network options
  else if (state.filterMenuIndex < statusOptions.length + networkOptions.length) {
    const networkIndex = state.filterMenuIndex - statusOptions.length;
    const networkKey = networkOptions[networkIndex];
    state.networkFilters[networkKey] = !state.networkFilters[networkKey];
    logger.debug(`Toggled ${networkKey} network filter to: ${state.networkFilters[networkKey]}`);
  }
}

// Relay status menu input handling (combined all & ignored relays functionality)
function handleRelayStatusMenuInput(key: string): void {
  let relays = getRelays();
  
  // Apply status filters
  relays = relays.filter(relay => {
    // Apply online/offline/unchecked filters
    if (relay.checked_at <= 0 && !state.statusFilters.unchecked) return false;
    if (relay.online === 1 && !state.statusFilters.online) return false;
    if (relay.online === 0 && relay.checked_at > 0 && !state.statusFilters.offline) return false;
    if (relay.ignore === 1 && !state.statusFilters.ignored) return false;
    
    // Apply network filters
    if (relay.network && state.networkFilters.hasOwnProperty(relay.network)) {
      return state.networkFilters[relay.network];
    }
    
    return true; // Show relays with unknown network by default
  });
  
  // Apply filter if set
  if (state.filter) {
    const filterLower = state.filter.toLowerCase();
    relays = relays.filter(relay => 
      relay.url.toLowerCase().includes(filterLower)
    );
    
    // Reset indices if needed
    if (state.topIndex >= relays.length && relays.length > 0) {
      state.topIndex = Math.max(0, relays.length - 15);
    }
    if (state.selectedIndex >= relays.length && relays.length > 0) {
      state.selectedIndex = Math.max(0, relays.length - 1);
    }
  }
  
  // If we're in filter edit mode, handle different inputs
  if (state.editingFilters) {
    const statusOptions = ["online", "offline", "unchecked", "ignored"];
    const networkOptions = Object.keys(state.networkFilters);
    const totalOptions = statusOptions.length + networkOptions.length;
    
    if (key === "ArrowUp" && state.filterMenuIndex > 0) {
      state.filterMenuIndex--;
    } else if (key === "ArrowDown" && state.filterMenuIndex < totalOptions - 1) {
      state.filterMenuIndex++;
    } else if (key === " ") {
      handleFilterToggle();
    } else if (key === "Enter") {
      // Apply filters and exit filter edit mode
      state.editingFilters = false;
    } else if (key === "Escape") {
      // Cancel and exit filter edit mode
      state.editingFilters = false;
    }
    return;
  }
  
  // Handle normal navigation and column selection
  if (key === "f" || key === "F") {
    // Start filtering
    state.isFiltering = true;
    state.filter = "";
  } else if (key === "v" || key === "V") {
    // Start filter editing mode
    state.editingFilters = true;
    state.filterMenuIndex = 0;
  } else if (key === "c" || key === "C") {
    // Create a sample ignored relay for testing
    logger.info("Creating sample ignored relay for testing");
    const success = createSampleIgnoredRelay();
    if (success) {
      logger.info("Successfully created sample ignored relay");
      // Force cache reset to show the new relay
      resetCache();
    } else {
      logger.error("Failed to create sample ignored relay");
    }
  } else if (key === "r" || key === "R") {
    // Run the repair function
    logger.info("Repairing database ignore values");
    const result = debugAndRepairIgnoredRelays();
    logger.info(`Database repair complete: Fixed ${result.fixed} out of ${result.total} relays`);
    
    // Force cache reset to show updated values
    resetCache();
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
  } else if (key === "ArrowLeft") {
    // Select previous column
    const columns: Array<ColumnName> = ["url", "network", "lastChecked", "status", "ignored"];
    const currentIndex = columns.indexOf(state.selectedColumn);
    if (currentIndex > 0) {
      state.selectedColumn = columns[currentIndex - 1];
    } else {
      // Wrap around to the last column
      state.selectedColumn = columns[columns.length - 1];
    }
  } else if (key === "ArrowRight") {
    // Select next column
    const columns: Array<ColumnName> = ["url", "network", "lastChecked", "status", "ignored"];
    const currentIndex = columns.indexOf(state.selectedColumn);
    if (currentIndex < columns.length - 1) {
      state.selectedColumn = columns[currentIndex + 1];
    } else {
      // Wrap around to the first column
      state.selectedColumn = columns[0];
    }
  } else if (key === "a" || key === "A") {
    // Set sort order to ascending
    state.sortOrder = "asc";
    state.sortColumn = state.selectedColumn;
  } else if (key === "d" || key === "D") {
    // Set sort order to descending
    state.sortOrder = "desc";
    state.sortColumn = state.selectedColumn;
  } else if (key === "i" || key === "I" || key === "Enter") {
    // Toggle the selected relay's ignore status
    if (relays.length > 0) {
      const selectedRelay = relays[state.selectedIndex];
      
      // Log the action
      logger.info(`Toggling ignore for relay ${selectedRelay.url} (currently ${selectedRelay.ignore === 1 ? 'ignored' : 'not ignored'})`);
      
      // Use proper toggle function
      toggleRelayIgnore(selectedRelay.url, selectedRelay.ignore === 1 ? false : true);
      
      // Force cache reset
      resetCache();
    } else {
      logger.warn("No relays to toggle");
    }
  } else if (key === "Delete") {
    // Delete the selected relay
    if (relays.length > 0) {
      const selectedRelay = relays[state.selectedIndex];
      logger.info(`Deleting relay ${selectedRelay.url}`);
      deleteRelay(selectedRelay.url);
      
      // Ensure selection stays within bounds
      if (state.selectedIndex >= relays.length - 1) {
        state.selectedIndex = Math.max(0, relays.length - 2);
      }
      
      // Force cache reset
      resetCache();
    } else {
      logger.warn("No relays to delete");
    }
  }
}

// Monitor logs menu input handling
function handleMonitorLogsInput(key: string): void {
  if (key === "Escape") {
    state.menu = "main";
  } else if (key === "c" || key === "C") {
    // Clear logs
    state.monitorLogs = [];
    logger.info("Monitor logs cleared");
  } else if (key === "r" || key === "R") {
    // Refresh logs (this would be done automatically by the log capture loop)
    logger.info("Refreshing monitor logs");
    
    // If the monitor is running, try to read new logs
    if (state.monitorProcess) {
      readMonitorLogs();
    }
  }
}

// Helper function to start the monitor process
function startMonitorProcess(): void {
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
      
      // Record startup in logs
      state.monitorLogs.push(`[${new Date().toISOString()}] INFO Monitor started with PID: ${state.monitorPid}`);
      
      // Set up a log capture interval to periodically read logs
      const logCaptureInterval = setInterval(async () => {
        if (!state.monitorProcess) {
          clearInterval(logCaptureInterval);
          return;
        }
        
        await readMonitorLogs();
      }, 1000); // Read logs every second
      
      // Store the interval ID so we can clear it when the monitor is stopped
      // @ts-ignore - Add a property to the process object
      state.monitorProcess.logCaptureInterval = logCaptureInterval;
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

// Helper function to stop the monitor process
function stopMonitorProcess(): void {
  try {
    // Clear the log capture interval if it exists
    // @ts-ignore - TypeScript doesn't know about our custom property
    if (state.monitorProcess?.logCaptureInterval) {
      // @ts-ignore - TypeScript doesn't know about our custom property
      clearInterval(state.monitorProcess.logCaptureInterval);
    }
    
    // Record shutdown in logs
    state.monitorLogs.push(`[${new Date().toISOString()}] INFO Monitor stopped`);
    
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

// Helper function to handle escape sequences
export async function handleEscapeSequence(sequence: string): Promise<void> {
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
    await handleKeyPress({ key: "Escape" });
  }
}

// Helper function to read logs from monitor process
async function readMonitorLogs(): Promise<void> {
  if (!state.monitorProcess) {
    return;
  }
  
  try {
    // @ts-ignore - TypeScript doesn't know about reading from process stdout/stderr
    const decoder = new TextDecoder();
    const stdoutReader = state.monitorProcess.stdout;
    const stderrReader = state.monitorProcess.stderr;
    
    // Read stdout if available
    if (stdoutReader) {
      try {
        // Create a buffer to read into
        const buf = new Uint8Array(1024);
        
        // Try to read from stdout (non-blocking)
        // @ts-ignore - TypeScript doesn't know about read method
        const n = await stdoutReader.read(buf);
        if (n > 0) {
          const text = decoder.decode(buf.subarray(0, n));
          const lines = text.split("\n").filter(line => line.trim() !== "");
          state.monitorLogs.push(...lines);
          
          // Keep only the last 1000 log lines to avoid memory issues
          if (state.monitorLogs.length > 1000) {
            state.monitorLogs = state.monitorLogs.slice(state.monitorLogs.length - 1000);
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
    
    // Read stderr if available
    if (stderrReader) {
      try {
        // Create a buffer to read into
        const buf = new Uint8Array(1024);
        
        // Try to read from stderr (non-blocking)
        // @ts-ignore - TypeScript doesn't know about read method
        const n = await stderrReader.read(buf);
        if (n > 0) {
          const text = decoder.decode(buf.subarray(0, n));
          const lines = text.split("\n").filter(line => line.trim() !== "");
          state.monitorLogs.push(...lines);
          
          // Keep only the last 1000 log lines to avoid memory issues
          if (state.monitorLogs.length > 1000) {
            state.monitorLogs = state.monitorLogs.slice(state.monitorLogs.length - 1000);
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error reading monitor logs: ${errorMessage}`);
  }
}

// Helper function to save config
function saveConfig(config: Config, path: string): void {
  try {
    // Convert config to YAML and save to file
    const yaml = JSON.stringify(config, null, 2); // Simple conversion for now
    Deno.writeTextFileSync(path, yaml);
    logger.info(`Configuration saved to ${path}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error saving configuration: ${errorMessage}`);
  }
} 