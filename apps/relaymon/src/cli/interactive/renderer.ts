import * as colors from "https://deno.land/std@0.218.2/fmt/colors.ts";
import { state } from "./state.ts";
import { formatRelativeTime } from "./utils.ts";
import { getRelayCounts, getRelays, getIgnoredRelays, createSampleIgnoredRelay } from "./db.ts";
import { getLogger } from "../../utils/logger.ts";
import { msToTimeString } from "../../config/config.ts";

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
    case "relayStatus":
      result = renderRelayStatusMenu();
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
    `${colors.cyan('📶')} Relay Status`,
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
    currentConfig = currentConfig[key as keyof typeof currentConfig];
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
        } else if (typeof value === "number") {
          // Check if this is likely a time value based on the key name
          if (isTimeKey(key) && value > 1000) {
            // Convert milliseconds to timestring for display using the central utility
            displayValue = colors.green(`"${msToTimeString(value)}"`);
          } else {
            // Regular number
            displayValue = colors.yellow(String(value));
          }
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

// Render filter options UI
function renderFilterOptions(): string[] {
  const content: string[] = [];
  
  // If we're not editing filters, just show a summary
  if (!state.editingFilters) {
    const activeStatusFilters = [];
    if (state.statusFilters.online) activeStatusFilters.push("online");
    if (state.statusFilters.offline) activeStatusFilters.push("offline");
    if (state.statusFilters.unchecked) activeStatusFilters.push("unchecked");
    if (state.statusFilters.ignored) activeStatusFilters.push("ignored");
    
    const activeNetworks = Object.entries(state.networkFilters)
      .filter(([_, enabled]) => enabled)
      .map(([network]) => network);
    
    content.push(`${colors.yellow('[V]')} ${colors.dim('Value Filters:')} ${colors.cyan(activeStatusFilters.join(', '))} | ${colors.magenta(activeNetworks.join(', '))}`);
    return content;
  }
  
  // We're editing filters, show the full UI
  content.push(colors.bold(colors.cyan("📊 Filter Options")));
  content.push(colors.dim('━'.repeat(20)));
  content.push("");
  
  // Status filters section
  content.push(colors.bold("Status Filters:"));
  
  const statusOptions = [
    { key: "online", label: "Online" },
    { key: "offline", label: "Offline" },
    { key: "unchecked", label: "Unchecked" },
    { key: "ignored", label: "Ignored" }
  ];
  
  statusOptions.forEach((option, index) => {
    const isSelected = state.filterMenuIndex === index;
    const isEnabled = state.statusFilters[option.key as keyof typeof state.statusFilters];
    
    const line = `${isSelected ? colors.cyan('►') : ' '} [${isEnabled ? colors.green('✓') : ' '}] ${option.label}`;
    
    if (isSelected) {
      content.push(colors.bgCyan(colors.black(` [${isEnabled ? '✓' : ' '}] ${option.label} `)));
    } else {
      content.push(line);
    }
  });
  
  content.push("");
  
  // Network filters section
  content.push(colors.bold("Network Filters:"));
  
  // Convert networks to array for easier indexing
  const networkEntries = Object.entries(state.networkFilters);
  
  networkEntries.forEach(([network, enabled], index) => {
    const actualIndex = index + statusOptions.length; // Offset by the number of status options
    const isSelected = state.filterMenuIndex === actualIndex;
    
    const line = `${isSelected ? colors.cyan('►') : ' '} [${enabled ? colors.green('✓') : ' '}] ${network}`;
    
    if (isSelected) {
      content.push(colors.bgCyan(colors.black(` [${enabled ? '✓' : ' '}] ${network} `)));
    } else {
      content.push(line);
    }
  });
  
  content.push("");
  content.push(colors.dim("Press Space to toggle, Enter/ESC to apply filters"));
  
  return content;
}

// Function to render a column header with proper highlighting for selected column
function renderColumnHeader(name: string, label: string, width: number): string {
  const isSelected = state.selectedColumn === name;
  const isSorted = state.sortColumn === name;
  
  // Determine the sort indicator
  let sortIndicator = '';
  if (isSorted) {
    sortIndicator = state.sortOrder === 'asc' ? ' ↑' : ' ↓';
  }
  
  // Create the header
  const header = `${label}${sortIndicator}`.padEnd(width);
  
  // Apply styling
  if (isSelected) {
    return colors.bgCyan(colors.black(` ${header} `));
  } else {
    return colors.dim(header);
  }
}

// Render category stats based on the relays array
function renderRelayStats(relays: any[]): string[] {
  const content: string[] = [];
  
  // Calculate stats
  const total = relays.length;
  const online = relays.filter(r => r.online === 1).length;
  const offline = relays.filter(r => r.online === 0 && r.checked_at > 0).length;
  const unchecked = relays.filter(r => r.checked_at <= 0).length;
  const ignored = relays.filter(r => r.ignore === 1).length;
  
  // Network counts
  const networks: {[key: string]: number} = {};
  relays.forEach(relay => {
    const network = relay.network || 'unknown';
    networks[network] = (networks[network] || 0) + 1;
  });
  
  // Format as styled output with boxes
  content.push(`${colors.dim('┌── RELAY COUNTS ─────────────────────────────────────┐')}`);
  content.push(`${colors.dim('│')} Total: ${colors.bold(total.toString())} | ${colors.green(`Online: ${online}`)} | ${colors.red(`Offline: ${offline}`)} | Unchecked: ${unchecked} ${colors.dim('│')}`);
  content.push(`${colors.dim('│')} Ignored: ${ignored} ${colors.dim('│')}`);
  content.push(`${colors.dim('└───────────────────────────────────────────────────┘')}`);
  
  content.push(`${colors.dim('┌── NETWORKS ────────────────────────────────────────┐')}`);
  const networkStrs = Object.entries(networks)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([name, count]) => `${name}: ${count}`)
    .join(' | ');
  content.push(`${colors.dim('│')} ${networkStrs} ${colors.dim('│')}`);
  content.push(`${colors.dim('└───────────────────────────────────────────────────┘')}`);
  
  content.push('');
  
  return content;
}

// Sort relays based on the sort column and order
function sortRelays(relays: any[]): any[] {
  const sorted = [...relays]; // Create a copy to avoid modifying the original
  
  sorted.sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (state.sortColumn) {
      case "url":
        aValue = a.url || '';
        bValue = b.url || '';
        break;
      case "network":
        aValue = a.network || 'unknown';
        bValue = b.network || 'unknown';
        break;
      case "lastChecked":
        aValue = a.checked_at || 0;
        bValue = b.checked_at || 0;
        break;
      case "status":
        // Sort by: online -> offline -> unchecked
        if (a.checked_at <= 0 && b.checked_at <= 0) {
          aValue = 2; // Both unchecked
          bValue = 2;
        } else if (a.checked_at <= 0) {
          aValue = 2; // a is unchecked
          bValue = b.online === 1 ? 0 : 1; // b is online or offline
        } else if (b.checked_at <= 0) {
          aValue = a.online === 1 ? 0 : 1; // a is online or offline
          bValue = 2; // b is unchecked
        } else {
          aValue = a.online === 1 ? 0 : 1; // a is online or offline
          bValue = b.online === 1 ? 0 : 1; // b is online or offline
        }
        break;
      case "ignored":
        aValue = a.ignore === 1 ? 1 : 0;
        bValue = b.ignore === 1 ? 1 : 0;
        break;
      default:
        aValue = a.url || '';
        bValue = b.url || '';
    }
    
    // Compare based on sort order
    if (state.sortOrder === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });
  
  return sorted;
}

// Render the Relay Status menu (formerly All Relays)
export function renderRelayStatusMenu(): string {
  let content: string[] = [];
  
  try {
    logger.debug("Getting relays for Relay Status menu");
    
    // Get relays data - could be empty or an error
    let allRelays = getRelays();
    
    logger.debug(`Retrieved ${allRelays.length} relays from database`);
    
    // Apply status filters
    allRelays = allRelays.filter(relay => {
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
    
    // Apply text filter if set
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
    
    // Sort relays based on current sort settings
    allRelays = sortRelays(allRelays);
    
    // Show filter status if filtering
    if (state.isFiltering) {
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${state.filter}${colors.bgWhite(colors.black('_'))}`);
      content.push("");
    } else if (state.filter) {
      content.push(`${colors.blue('🔍')} ${colors.bold('Filter')}: ${colors.yellow(state.filter)} ${colors.dim('[F] to change')}`);
      content.push("");
    } else {
      content.push(`${colors.yellow('[F]')} ${colors.dim('to filter list')}`);
    }
    
    // Show value filters UI
    content.push(...renderFilterOptions());
    content.push("");
    
    // Add detailed stats
    content.push(...renderRelayStats(allRelays));
    
    // Show sort and column selection help
    content.push(`${colors.yellow('[←/→]')} Select Column  ${colors.yellow('[A]')} Sort Ascending  ${colors.yellow('[D]')} Sort Descending`);
    content.push('');
    
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
      
      // Define column widths
      const urlWidth = 32;
      const networkWidth = 10;
      const lastCheckedWidth = 18;
      const statusWidth = 10;
      const ignoredWidth = 8;
      
      // Render column headers with proper highlighting
      const urlHeader = renderColumnHeader("url", "URL", urlWidth);
      const networkHeader = renderColumnHeader("network", "NETWORK", networkWidth);
      const lastCheckedHeader = renderColumnHeader("lastChecked", "LAST CHECKED", lastCheckedWidth);
      const statusHeader = renderColumnHeader("status", "STATUS", statusWidth);
      const ignoredHeader = renderColumnHeader("ignored", "IGNORED", ignoredWidth);
      
      content.push(
        `${urlHeader} │ ${networkHeader} │ ${lastCheckedHeader} │ ${statusHeader} │ ${ignoredHeader}`
      );
      content.push(colors.dim("━".repeat(urlWidth + networkWidth + lastCheckedWidth + statusWidth + ignoredWidth + 12)));
      
      // Display visible relays
      for (let i = state.topIndex; i < endIndex; i++) {
        const relay = allRelays[i];
        const isSelected = i === state.selectedIndex;
        
        // Get network status information
        let status;
        if (relay.online === 1) {
          status = colors.green("✓ ONLINE");
        } else if (relay.checked_at <= 0) {
          status = colors.dim("? UNCHECKED");
        } else {
          status = colors.red("✗ OFFLINE");
        }
        
        // Format URL to fit in column
        const urlMaxLength = urlWidth;
        let displayUrl = relay.url;
        if (displayUrl.length > urlMaxLength) {
          displayUrl = displayUrl.substring(0, urlMaxLength - 3) + "...";
        } else {
          displayUrl = displayUrl.padEnd(urlMaxLength);
        }
        
        // Format network column
        const network = (relay.network || "unknown").padEnd(networkWidth);
        
        // Format last checked time
        let lastChecked;
        if (!relay.checked_at || relay.checked_at <= 0) {
          lastChecked = colors.dim("never");
        } else {
          lastChecked = formatRelativeTime(relay.checked_at * 1000);
        }
        lastChecked = lastChecked.padEnd(lastCheckedWidth);
        
        // Format ignored status
        const ignored = relay.ignore === 1 
          ? colors.yellow("✓ YES") 
          : colors.dim("✗ NO");
        
        // Create the line with columns
        let line = `${isSelected ? colors.cyan('►') : ' '} ${displayUrl} │ ${network} │ ${lastChecked} │ ${status.padEnd(statusWidth)} │ ${ignored.padEnd(ignoredWidth)}`;
        
        if (isSelected) {
          content.push(colors.bgCyan(colors.black(` ${displayUrl} │ ${network} │ ${lastChecked} │ ${status.padEnd(statusWidth)} │ ${ignored.padEnd(ignoredWidth)} `)));
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
    
    if (state.editingFilters) {
      content.push(`${colors.yellow('[Space]')} Toggle Filter  ${colors.yellow('[Enter]')} Apply  ${colors.yellow('[ESC]')} Cancel`);
    } else {
      content.push(`${colors.yellow('[I]')} Toggle Ignore  ${colors.yellow('[V]')} Edit Filters  ${colors.yellow('[PageUp/Down]')} Navigate  ${colors.yellow('[ESC]')} Back`);
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error rendering Relay Status menu: ${errorMessage}`);
    
    content.push(colors.red(`Error loading relays: ${errorMessage}`));
    content.push("");
    content.push("Ensure the database is properly initialized.");
    content.push("Try running the monitor first to populate the database.");
  }
  
  return renderTitle("Relay Status", content);
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