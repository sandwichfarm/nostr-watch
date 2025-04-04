import * as colors from "https://deno.land/std@0.218.2/fmt/colors.ts";
import { state } from "./state.ts";
import { formatRelativeTime } from "./utils.ts";
import { getRelayCounts, getRelays, getIgnoredRelays, createSampleIgnoredRelay } from "./db.ts";
import { getLogger } from "../../utils/logger.ts";

const logger = getLogger("Renderer");

// Box drawing helper
export const renderBox = (title: string, content: string[]): string => {
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

// Main render function
export function render(): string {
  // Store start time for performance tracking
  const startTime = Date.now();
  
  // Render the appropriate menu
  let result = "";
  switch (state.menu) {
    case "main":
      result = renderMainMenu();
      break;
    case "monitor":
      result = renderMonitorMenu();
      break;
    case "config":
      result = renderConfigMenu();
      break;
    case "ignored":
      result = renderIgnoredRelaysMenu();
      break;
    case "all":
      result = renderAllRelaysMenu();
      break;
    case "logs":
      result = renderMonitorLogs();
      break;
    default:
      result = "Unknown menu";
  }
  
  // Calculate and add render time (but don't show in production)
  // const renderTime = Date.now() - startTime;
  // result += `\nRender time: ${renderTime}ms`;
  
  return result;
}

// Render function for the main menu
export function renderMainMenu(): string {
  const isRunning = state.monitorProcess !== null;
  
  // Create dynamic options list
  const options = [
    isRunning ? "Stop Monitor" : "Start Monitor",
    "Watch Monitor Logs",
    "Configuration",
    "Ignored Relays",
    "All Relays",
  ];
  
  // Basic stats display
  let content: string[] = [];
  
  // Show monitor stats if we have them
  if (state.monitorStats) {
    content.push(`Monitor Status: ${isRunning ? colors.green('Running') : colors.red('Stopped')}${isRunning ? ` (PID: ${state.monitorPid || 'unknown'})` : ''}`);
    content.push("");
    content.push(`Relays: ${state.monitorStats.total} total, ${state.monitorStats.online} online, ${state.monitorStats.offline} offline`);
    content.push(`Queue: ${state.monitorStats.active} active, ${state.monitorStats.waiting} waiting, ${state.monitorStats.expired} expired`);
    content.push(`Checks: ${state.monitorStats.checksTotal} total, ${state.monitorStats.checksErrors} errors`);
    content.push(`Events: ${state.monitorStats.publishedEvents} published, ${state.monitorStats.failedPublishes} failed`);
    content.push("");
    content.push("Menu Options:");
    content.push("");
  } else if (isRunning) {
    content.push(`Monitor Status: ${colors.green('Running')} (PID: ${state.monitorPid || 'unknown'})`);
    content.push("");
    content.push("Menu Options:");
    content.push("");
  } else {
    content.push("Menu Options:");
    content.push("");
  }
  
  // Menu options
  content.push(...options.map((option, index) => {
    const prefix = index === state.selectedIndex ? colors.green(" > ") : "   ";
    return `${prefix}${option}`;
  }));
  
  return renderBox("RelayMon Interactive Menu", content);
}

// Render function for the monitor menu
export function renderMonitorMenu(): string {
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
export function renderConfigMenu(): string {
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
      for (let i = state.topIndex; i < Math.min(state.topIndex + 15, entries.length); i++) {
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
      
      // Show scrolling indicators
      if (state.topIndex > 0) {
        content.unshift("  ↑ (more above)");
      }
      if (state.topIndex + 15 < entries.length) {
        content.push("  ↓ (more below)");
      }
    }
    
    content.push("");
    content.push("[Enter] Edit/Navigate  [A] Add Item  [D] Delete Item");
    content.push("[S] Save Configuration  [Escape] Back");
    content.push("[PageUp/PageDown] Navigate pages");
  }
  
  return renderBox("Configuration Editor", content);
}

// Render function for the all relays menu
export function renderAllRelaysMenu(): string {
  let content: string[] = [];
  
  try {
    logger.debug("Getting relays for All Relays menu");
    
    // Get relays data - could be empty or an error
    let allRelays = getRelays();
    
    logger.debug(`Retrieved ${allRelays.length} relays from database`);
    
    // Apply filter if set
    if (state.filter) {
      const filterLower = state.filter.toLowerCase();
      allRelays = allRelays.filter(relay => 
        relay.url.toLowerCase().includes(filterLower)
      );
      
      // Reset indices if needed for filtered results
      if (state.topIndex >= allRelays.length && allRelays.length > 0) {
        state.topIndex = Math.max(0, allRelays.length - 15);
      }
      if (state.selectedIndex >= allRelays.length && allRelays.length > 0) {
        state.selectedIndex = Math.max(0, allRelays.length - 1);
      }
    }
    
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
    
    // Add debug info
    content.push(`Database info: ${allRelays.length} relays total`);
    
    if (allRelays.length === 0) {
      content.push("No relays found. Try running the monitor first.");
    } else {
      // Calculate visible range for scrolling
      const visibleItems = 15; // Adjust based on your display area
      const endIndex = Math.min(state.topIndex + visibleItems, allRelays.length);
      
      // Show pagination info
      content.push(`Showing ${state.topIndex + 1}-${endIndex} of ${allRelays.length} relays`);
      
      // Show scrolling indicators
      if (state.topIndex > 0) {
        content.push("  ↑ (more above)");
      }
      
      // Add column headers
      content.push("");
      content.push("   URL                             | Network  | Last Checked                  | Status");
      content.push("   " + "-".repeat(32) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(28) + "-+--------");
      
      // Display visible relays
      for (let i = state.topIndex; i < endIndex; i++) {
        const relay = allRelays[i];
        const isSelected = i === state.selectedIndex;
        const prefix = isSelected ? colors.green(" > ") : "   ";
        
        // Get network status information
        let status;
        if (relay.online === 1) {
          status = colors.green("✓");
        } else {
          status = colors.red("✗");
        }
        
        // Format URL to fit in column
        const urlMaxLength = 32;
        let displayUrl = relay.url;
        if (displayUrl.length > urlMaxLength) {
          displayUrl = displayUrl.substring(0, urlMaxLength - 3) + "...";
        } else {
          displayUrl = displayUrl.padEnd(urlMaxLength);
        }
        
        // Format network column
        const network = (relay.network || "unknown").padEnd(8);
        
        // Format last checked time
        let lastChecked;
        if (!relay.checked_at || relay.checked_at <= 0) {
          lastChecked = "never".padEnd(28);
        } else {
          lastChecked = formatRelativeTime(relay.checked_at * 1000).padEnd(28);
        }
        
        // Create the line with columns
        let line = `${prefix}${displayUrl} | ${network} | ${lastChecked} | ${status}`;
        
        if (isSelected) {
          content.push(colors.bgBlue(line));
        } else {
          content.push(line);
        }
      }
      
      // Show scrolling indicators
      if (endIndex < allRelays.length) {
        content.push("  ↓ (more below)");
      }
    }
    
    content.push("");
    content.push("[I] Toggle Ignore  [PageUp/PageDown] Navigate pages  [ESC] Back");
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error rendering All Relays menu: ${errorMessage}`);
    
    content.push(colors.red(`Error loading relays: ${errorMessage}`));
    content.push("");
    content.push("Ensure the database is properly initialized.");
    content.push("Try running the monitor first to populate the database.");
  }
  
  return renderBox("All Relays", content);
}

// Render function for the ignored relays menu
export function renderIgnoredRelaysMenu(): string {
  let content: string[] = [];
  
  try {
    logger.debug("Getting relays for Ignored Relays menu");
    
    // Get ignored relays data
    let ignoredRelays = getIgnoredRelays();
    
    logger.debug(`Retrieved ${ignoredRelays.length} ignored relays from database`);
    
    // Apply filter if set
    if (state.filter) {
      const filterLower = state.filter.toLowerCase();
      ignoredRelays = ignoredRelays.filter(relay => 
        relay.url.toLowerCase().includes(filterLower)
      );
      
      // Reset indices if needed for filtered results
      if (state.topIndex >= ignoredRelays.length && ignoredRelays.length > 0) {
        state.topIndex = Math.max(0, ignoredRelays.length - 15);
      }
      if (state.selectedIndex >= ignoredRelays.length && ignoredRelays.length > 0) {
        state.selectedIndex = Math.max(0, ignoredRelays.length - 1);
      }
    }
    
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
    
    // Add debug info
    content.push(`Database info: ${ignoredRelays.length} ignored relays total`);
    
    // Add debugging note
    content.push(colors.yellow("Use [I] to unignore a relay"));
    content.push(colors.yellow("[Enter] also unignores selected relay"));
    
    if (ignoredRelays.length === 0) {
      content.push("No ignored relays found.");
      
      // Add more debug info when no relays are found
      const counts = getRelayCounts();
      content.push(colors.yellow(`Database contains: ${counts.total} total, ${counts.online} online, ${counts.ignored} ignored relays`));
      
      // Add button to create a sample ignored relay for testing
      content.push("");
      content.push(colors.green("[C] Create a sample ignored relay for testing"));
      content.push(colors.green("[R] Repair database ignore values"));
      content.push(colors.yellow("This will scan and fix any inconsistent ignore values"));
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
      content.push("   URL                             | Network  | Last Checked                  | Status");
      content.push("   " + "-".repeat(32) + "-+-" + "-".repeat(8) + "-+-" + "-".repeat(28) + "-+--------");
      
      // Display visible relays
      for (let i = state.topIndex; i < endIndex; i++) {
        const relay = ignoredRelays[i];
        const isSelected = i === state.selectedIndex;
        const prefix = isSelected ? colors.green(" > ") : "   ";
        
        // Get network status information
        let status;
        if (relay.online === 1) {
          status = colors.green("✓");
        } else {
          status = colors.red("✗");
        }
        
        // Format URL to fit in column
        const urlMaxLength = 32;
        let displayUrl = relay.url;
        if (displayUrl.length > urlMaxLength) {
          displayUrl = displayUrl.substring(0, urlMaxLength - 3) + "...";
        } else {
          displayUrl = displayUrl.padEnd(urlMaxLength);
        }
        
        // Format network column
        const network = (relay.network || "unknown").padEnd(8);
        
        // Format last checked time
        let lastChecked;
        if (!relay.checked_at || relay.checked_at <= 0) {
          lastChecked = "never".padEnd(28);
        } else {
          lastChecked = formatRelativeTime(relay.checked_at * 1000).padEnd(28);
        }
        
        // Create the line with columns
        let line = `${prefix}${displayUrl} | ${network} | ${lastChecked} | ${status}`;
        
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
    if (ignoredRelays.length === 0) {
      content.push("[C] Create Sample  [R] Repair DB  [ESC] Back");
    } else {
      content.push("[I] Toggle Ignore  [R] Repair DB  [PageUp/PageDown] Navigate pages  [ESC] Back");
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error rendering Ignored Relays menu: ${errorMessage}`);
    
    content.push(colors.red(`Error loading ignored relays: ${errorMessage}`));
    content.push("");
    content.push("Ensure the database is properly initialized.");
    content.push("Try running the monitor first to populate the database.");
  }
  
  return renderBox("Ignored Relays", content);
}

// Render function for monitor logs
export function renderMonitorLogs(): string {
  const isRunning = state.monitorProcess !== null;
  
  let content: string[] = [];
  
  content.push(isRunning ? `Monitor Status: ${colors.green('Running')} (PID: ${state.monitorPid || 'unknown'})` : `Monitor Status: ${colors.red('Stopped')}`);
  content.push("");
  
  if (state.monitorLogs.length > 0) {
    content.push("Recent logs:");
    content.push("------------");
    
    // Show last 20 logs (or fewer if we don't have 20)
    const logCount = Math.min(20, state.monitorLogs.length);
    const startIndex = Math.max(0, state.monitorLogs.length - logCount);
    
    for (let i = startIndex; i < state.monitorLogs.length; i++) {
      const log = state.monitorLogs[i];
      
      // Color based on log level
      if (log.includes(" ERROR ") || log.includes(" CRITICAL ")) {
        content.push(colors.red(log));
      } else if (log.includes(" WARN ")) {
        content.push(colors.yellow(log));
      } else if (log.includes(" INFO ")) {
        content.push(colors.blue(log));
      } else if (log.includes(" DEBUG ")) {
        content.push(colors.gray(log));
      } else {
        content.push(log);
      }
    }
  } else {
    content.push("No logs available yet.");
    
    if (isRunning) {
      content.push("The monitor is running but no logs have been captured.");
      content.push("Logs will appear here as they are generated.");
    } else {
      content.push("Start the monitor to see logs.");
    }
  }
  
  content.push("");
  content.push("[C] Clear Logs  [R] Refresh Logs  [ESC] Back to Main Menu");
  
  return renderBox("Monitor Logs", content);
} 