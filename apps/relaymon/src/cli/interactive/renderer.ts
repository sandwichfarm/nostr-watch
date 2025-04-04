import * as colors from "https://deno.land/std@0.218.2/fmt/colors.ts";
import { state } from "./state.ts";
import { formatRelativeTime } from "./utils.ts";
import { getRelayCounts, getRelays, getIgnoredRelays, createSampleIgnoredRelay } from "./db.ts";
import { getLogger } from "../../utils/logger.ts";

const logger = getLogger("Renderer");

// Modern rendering helper for titles and sections
export const renderTitle = (title: string, content: string[]): string => {
  // Create a clean, modern title with color and subtle decoration
  const titleDisplay = `\n${colors.bold(colors.cyan('⚡ ' + title.toUpperCase()))}\n${colors.dim('━'.repeat(title.length + 3))}\n`;
  
  // Directly add content without boxing
  return titleDisplay + content.join('\n') + '\n';
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
    isRunning ? `${colors.red('✖')} Stop Monitor` : `${colors.green('▶')} Start Monitor`,
    `${colors.blue('🔍')} Watch Monitor Logs`,
    `${colors.yellow('⚙')} Configuration`,
    `${colors.magenta('⛔')} Ignored Relays`,
    `${colors.cyan('📶')} All Relays`,
  ];
  
  // ASCII art logo for RelayMon
  const logo = [
    colors.cyan('    ____       __               __  ___          '),
    colors.cyan('   / __ \\___  / /___ ___  __   /  |/  /__  ____  '),
    colors.cyan('  / /_/ / _ \\/ / __ `/ / / /  / /|_/ / _ \\/ __ \\ '),
    colors.cyan(' / _, _/  __/ / /_/ / /_/ /  / /  / /  __/ / / / '),
    colors.cyan('/_/ |_|\\___/_/\\__,_/\\__, /  /_/  /_/\\___/_/ /_/  '),
    colors.cyan('                   /____/                       '),
    '',
  ];
  
  // Basic stats display
  let content: string[] = [];
  
  // Add logo
  content.push(...logo);
  
  // Show monitor stats if we have them
  if (state.monitorStats) {
    content.push(`${colors.bold('STATUS')} ${isRunning ? colors.green('● RUNNING') : colors.red('● STOPPED')}${isRunning ? ` (PID: ${state.monitorPid || 'unknown'})` : ''}`);
    content.push('');
    content.push(`${colors.dim('┌── NETWORK STATS ──────────────────────────────────┐')}`);
    content.push(`${colors.dim('│')} Relays: ${colors.bold(state.monitorStats.total.toString())} total, ${colors.green(state.monitorStats.online.toString())} online, ${colors.red(state.monitorStats.offline.toString())} offline ${colors.dim('│')}`);
    content.push(`${colors.dim('│')} Queue: ${colors.yellow(state.monitorStats.active.toString())} active, ${state.monitorStats.waiting} waiting, ${colors.magenta(state.monitorStats.expired.toString())} expired  ${colors.dim('│')}`);
    content.push(`${colors.dim('└───────────────────────────────────────────────────┘')}`);
    content.push('');
    content.push(`${colors.dim('┌── ACTIVITY STATS ─────────────────────────────────┐')}`);
    content.push(`${colors.dim('│')} Checks: ${colors.bold(state.monitorStats.checksTotal.toString())} total, ${colors.red(state.monitorStats.checksErrors.toString())} errors ${colors.dim('│')}`);
    content.push(`${colors.dim('│')} Events: ${colors.green(state.monitorStats.publishedEvents.toString())} published, ${colors.red(state.monitorStats.failedPublishes.toString())} failed ${colors.dim('│')}`);
    content.push(`${colors.dim('└───────────────────────────────────────────────────┘')}`);
    content.push('');
  } else if (isRunning) {
    content.push(`${colors.bold('STATUS')} ${colors.green('● RUNNING')} (PID: ${state.monitorPid || 'unknown'})`);
    content.push('');
  }
  
  content.push(colors.bold(colors.dim('MENU OPTIONS')));
  content.push('');
  
  // Menu options
  content.push(...options.map((option, index) => {
    return index === state.selectedIndex 
      ? colors.bgCyan(colors.black(` ${option} `)) 
      : `  ${option}  `;
  }));

  content.push('');
  content.push(colors.dim('Use arrow keys to navigate and Enter to select'));
  
  return renderTitle("RelayMon", content);
}

// Render function for the monitor menu
export function renderMonitorMenu(): string {
  const isRunning = state.monitorProcess !== null;
  
  const content = [
    isRunning ? `${colors.bold(colors.green('● RUNNING'))} (PID: ${state.monitorPid || 'unknown'})` : colors.bold(colors.red('● STOPPED')),
    "",
  ];
  
  // Get latest output if process is running
  if (isRunning && state.monitorProcess) {
    content.push(colors.bold("Recent output:"));
    content.push(colors.dim("━━━━━━━━━━━━━━"));
    
    // Add some placeholder for output - in reality, we would read from the process
    content.push("Monitor is running in the background.");
    content.push("Check the logs directory for detailed output.");
  }
  
  content.push("");
  content.push(colors.bold("Commands:"));
  content.push(`${colors.yellow('[R]')} Restart Monitor  ${colors.yellow('[S]')} Stop Monitor  ${colors.yellow('[ESC]')} Back to Main Menu`);
  content.push(colors.dim("Monitor will remain running in background if you return to main menu"));
  
  return renderTitle("Monitor Status", content);
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
  const breadcrumbTrail = breadcrumbs.map((crumb, index) => 
    index === breadcrumbs.length - 1 
      ? colors.cyan(crumb) 
      : colors.dim(crumb)
  ).join(colors.dim(" > "));
  
  let content: string[] = [];
  content.push(breadcrumbTrail);
  content.push("");
  
  if (state.configState.isEditing) {
    // Show editing interface
    content.push(colors.bold(`Editing: ${colors.yellow(state.configState.editingKey || "")}`));
    
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
    content.push(colors.dim("┌" + "─".repeat(Math.max(40, value.length + 2)) + "┐"));
    content.push(colors.dim("│") + " " + displayValue + " ".repeat(Math.max(39 - value.length, 0)) + colors.dim("│"));
    content.push(colors.dim("└" + "─".repeat(Math.max(40, value.length + 2)) + "┘"));
    
    content.push("");
    content.push(colors.bold("Commands:"));
    content.push(`${colors.yellow('[Enter]')} Save  ${colors.yellow('[Escape]')} Cancel  ${colors.yellow('[←/→]')} Move Cursor  ${colors.yellow('[Home/End]')} Start/End`);
  } else {
    // Show current config section
    const entries = Object.entries(currentConfig);
    
    if (entries.length === 0) {
      content.push(colors.italic("Empty configuration section"));
    } else {
      // Show scrolling indicators
      if (state.topIndex > 0) {
        content.push(colors.dim("↑ more above"));
      }

      for (let i = state.topIndex; i < Math.min(state.topIndex + 15, entries.length); i++) {
        const [key, value] = entries[i];
        const isSelected = i === state.selectedIndex;
        
        let displayValue: string;
        
        if (typeof value === "object" && value !== null) {
          // For objects and arrays
          if (Array.isArray(value)) {
            displayValue = colors.blue(`[Array: ${value.length} items]`);
          } else {
            displayValue = colors.blue(`{Object: ${Object.keys(value).length} keys}`);
          }
        } else if (typeof value === "string") {
          // For string values
          displayValue = colors.green(`"${value}"`);
        } else if (typeof value === "boolean") {
          // For boolean values
          displayValue = value ? colors.green("true") : colors.red("false");
        } else {
          // For other primitive values
          displayValue = colors.yellow(String(value));
        }
        
        const line = `${isSelected ? colors.cyan('►') : ' '} ${colors.bold(key)}: ${displayValue}`;
        if (isSelected) {
          content.push(colors.bgCyan(colors.black(` ${key}: ${String(displayValue)} `)));
        } else {
          content.push(line);
        }
      }
      
      // Show scrolling indicators
      if (state.topIndex + 15 < entries.length) {
        content.push(colors.dim("↓ more below"));
      }
    }
    
    content.push("");
    content.push(colors.bold("Commands:"));
    content.push(`${colors.yellow('[Enter]')} Edit/Navigate  ${colors.yellow('[A]')} Add Item  ${colors.yellow('[D]')} Delete Item  ${colors.yellow('[S]')} Save  ${colors.yellow('[Escape]')} Back`);
  }
  
  return renderTitle("Configuration", content);
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
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${state.filter}${colors.bgWhite(colors.black('_'))}`);
      content.push("");
    } else if (state.filter) {
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${colors.yellow(state.filter)} ${colors.dim('[F] to change')}`);
      content.push("");
    } else {
      content.push(`${colors.yellow('[F]')} ${colors.dim('to filter list')}`);
      content.push("");
    }
    
    // Stats summary
    content.push(`${colors.bold(allRelays.length.toString())} ${colors.dim('relays total')}`);
    
    if (allRelays.length === 0) {
      content.push(colors.italic("No relays found. Try running the monitor first."));
    } else {
      // Calculate visible range for scrolling
      const visibleItems = 15; // Adjust based on your display area
      const endIndex = Math.min(state.topIndex + visibleItems, allRelays.length);
      
      // Show pagination info
      content.push(colors.dim(`Showing ${state.topIndex + 1}-${endIndex} of ${allRelays.length}`));
      
      // Show scrolling indicators
      if (state.topIndex > 0) {
        content.push(colors.dim("↑ more above"));
      }
      
      // Add column headers
      content.push("");
      content.push(
        colors.dim("URL") + " ".repeat(31) + 
        colors.dim("│ NETWORK") + " " + 
        colors.dim("│ LAST CHECKED") + " ".repeat(19) +
        colors.dim("│ STATUS")
      );
      content.push(colors.dim("━".repeat(75)));
      
      // Display visible relays
      for (let i = state.topIndex; i < endIndex; i++) {
        const relay = allRelays[i];
        const isSelected = i === state.selectedIndex;
        
        // Get network status information
        let status;
        if (relay.online === 1) {
          status = colors.green("✓ ONLINE");
        } else {
          status = colors.red("✗ OFFLINE");
        }
        
        // Format URL to fit in column
        const urlMaxLength = 32;
        let displayUrl = relay.url;
        if (displayUrl.length > urlMaxLength) {
          displayUrl = displayUrl.substring(0, urlMaxLength - 3) + "...";
        }
        
        // Format network column
        const network = (relay.network || "unknown");
        
        // Format last checked time
        let lastChecked;
        if (!relay.checked_at || relay.checked_at <= 0) {
          lastChecked = colors.dim("never");
        } else {
          lastChecked = formatRelativeTime(relay.checked_at * 1000);
        }
        
        // Create the line with columns
        let line = `${isSelected ? colors.cyan('►') : ' '} ${displayUrl.padEnd(32)} │ ${network.padEnd(8)} │ ${lastChecked.padEnd(28)} │ ${status}`;
        
        if (isSelected) {
          content.push(colors.bgCyan(colors.black(` ${displayUrl.padEnd(32)} │ ${network.padEnd(8)} │ ${lastChecked.padEnd(28)} │ ${status} `)));
        } else {
          content.push(line);
        }
      }
      
      // Show scrolling indicators
      if (endIndex < allRelays.length) {
        content.push(colors.dim("↓ more below"));
      }
    }
    
    content.push("");
    content.push(colors.bold("Commands:"));
    content.push(`${colors.yellow('[I]')} Toggle Ignore  ${colors.yellow('[PageUp/Down]')} Navigate  ${colors.yellow('[ESC]')} Back`);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error rendering All Relays menu: ${errorMessage}`);
    
    content.push(colors.red(`Error loading relays: ${errorMessage}`));
    content.push("");
    content.push("Ensure the database is properly initialized.");
    content.push("Try running the monitor first to populate the database.");
  }
  
  return renderTitle("All Relays", content);
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
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${state.filter}${colors.bgWhite(colors.black('_'))}`);
      content.push("");
    } else if (state.filter) {
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${colors.yellow(state.filter)} ${colors.dim('[F] to change')}`);
      content.push("");
    } else {
      content.push(`${colors.yellow('[F]')} ${colors.dim('to filter list')}`);
      content.push("");
    }
    
    // Stats summary
    content.push(`${colors.bold(ignoredRelays.length.toString())} ${colors.dim('ignored relays')}`);
    
    // Add note about unignoring relays
    content.push(colors.dim("Use [I] or [Enter] to unignore a relay"));
    
    if (ignoredRelays.length === 0) {
      content.push("");
      content.push(colors.italic("No ignored relays found."));
      
      // Add more debug info when no relays are found
      const counts = getRelayCounts();
      content.push(colors.dim(`Database contains: ${counts.total} total, ${counts.online} online, ${counts.ignored} ignored relays`));
      
      // Add button to create a sample ignored relay for testing
      content.push("");
      content.push(`${colors.yellow('[C]')} ${colors.green('Create a sample ignored relay for testing')}`);
      content.push(`${colors.yellow('[R]')} ${colors.green('Repair database ignore values')}`);
      content.push(colors.dim("This will scan and fix any inconsistent ignore values"));
    } else {
      // Calculate visible range for scrolling
      const visibleItems = 15; // Adjust based on your display area
      const endIndex = Math.min(state.topIndex + visibleItems, ignoredRelays.length);
      
      // Show pagination info
      content.push(colors.dim(`Showing ${state.topIndex + 1}-${endIndex} of ${ignoredRelays.length}`));
      
      // Show scrolling indicators
      if (state.topIndex > 0) {
        content.push(colors.dim("↑ more above"));
      }
      
      // Add column headers
      content.push("");
      content.push(
        colors.dim("URL") + " ".repeat(31) + 
        colors.dim("│ NETWORK") + " " + 
        colors.dim("│ LAST CHECKED") + " ".repeat(19) +
        colors.dim("│ STATUS")
      );
      content.push(colors.dim("━".repeat(75)));
      
      // Display visible relays
      for (let i = state.topIndex; i < endIndex; i++) {
        const relay = ignoredRelays[i];
        const isSelected = i === state.selectedIndex;
        
        // Get network status information
        let status;
        if (relay.online === 1) {
          status = colors.green("✓ ONLINE");
        } else {
          status = colors.red("✗ OFFLINE");
        }
        
        // Format URL to fit in column
        const urlMaxLength = 32;
        let displayUrl = relay.url;
        if (displayUrl.length > urlMaxLength) {
          displayUrl = displayUrl.substring(0, urlMaxLength - 3) + "...";
        }
        
        // Format network column
        const network = (relay.network || "unknown");
        
        // Format last checked time
        let lastChecked;
        if (!relay.checked_at || relay.checked_at <= 0) {
          lastChecked = colors.dim("never");
        } else {
          lastChecked = formatRelativeTime(relay.checked_at * 1000);
        }
        
        // Create the line with columns
        let line = `${isSelected ? colors.cyan('►') : ' '} ${displayUrl.padEnd(32)} │ ${network.padEnd(8)} │ ${lastChecked.padEnd(28)} │ ${status}`;
        
        if (isSelected) {
          content.push(colors.bgCyan(colors.black(` ${displayUrl.padEnd(32)} │ ${network.padEnd(8)} │ ${lastChecked.padEnd(28)} │ ${status} `)));
        } else {
          content.push(line);
        }
      }
      
      // Show scrolling indicators
      if (endIndex < ignoredRelays.length) {
        content.push(colors.dim("↓ more below"));
      }
      
      content.push("");
      content.push(colors.bold("Commands:"));
      content.push(`${colors.yellow('[I]')} Toggle Ignore  ${colors.yellow('[R]')} Repair DB  ${colors.yellow('[PageUp/Down]')} Navigate  ${colors.yellow('[ESC]')} Back`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error rendering Ignored Relays menu: ${errorMessage}`);
    
    content.push(colors.red(`Error loading ignored relays: ${errorMessage}`));
    content.push("");
    content.push("Ensure the database is properly initialized.");
    content.push("Try running the monitor first to populate the database.");
  }
  
  return renderTitle("Ignored Relays", content);
}

// Render function for monitor logs
export function renderMonitorLogs(): string {
  const isRunning = state.monitorProcess !== null;
  
  let content: string[] = [];
  
  content.push(isRunning 
    ? `${colors.bold('STATUS')}: ${colors.green('● RUNNING')} ${colors.dim(`(PID: ${state.monitorPid || 'unknown'})`)}` 
    : `${colors.bold('STATUS')}: ${colors.red('● STOPPED')}`
  );
  content.push("");
  
  if (state.monitorLogs.length > 0) {
    content.push(colors.bold("Recent logs:"));
    content.push(colors.dim("━".repeat(20)));
    
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
        content.push(colors.dim(log));
      } else {
        content.push(log);
      }
    }
  } else {
    content.push(colors.italic("No logs available yet."));
    
    if (isRunning) {
      content.push(colors.dim("The monitor is running but no logs have been captured."));
      content.push(colors.dim("Logs will appear here as they are generated."));
    } else {
      content.push(colors.dim("Start the monitor to see logs."));
    }
  }
  
  content.push("");
  content.push(colors.bold("Commands:"));
  content.push(`${colors.yellow('[C]')} Clear Logs  ${colors.yellow('[R]')} Refresh Logs  ${colors.yellow('[ESC]')} Back to Main Menu`);
  
  return renderTitle("Monitor Logs", content);
} 