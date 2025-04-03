import chalk from "npm:chalk";
import { LogLevel, getLogger } from "./logger";

const logger = getLogger("Status");

// Statistics counters for trawler
let statsCounter = 0;
export const trawlerStats = {
  // Event stats
  totalEvents: 0,
  eventsProcessed: 0,
  eventsRejected: 0,
  
  // Relay stats
  newRelaysFound: 0,
  uniqueRelaysFound: new Set<string>(),
  
  // Session stats
  sessionStart: Date.now(),
  lastUpdateTime: Date.now(),
  
  // Reset stats for a new session
  reset: () => {
    trawlerStats.totalEvents = 0;
    trawlerStats.eventsProcessed = 0;
    trawlerStats.eventsRejected = 0;
    trawlerStats.newRelaysFound = 0;
    trawlerStats.uniqueRelaysFound.clear();
    trawlerStats.sessionStart = Date.now();
    trawlerStats.lastUpdateTime = Date.now();
  }
};

// Define interface for our status box
interface TrawlerStatusData {
  // Event counts
  totalEvents: number;
  eventsProcessed: number;
  eventsRejected: number;
  rejectionRate: number;
  
  // Relay stats
  totalRelaysList: number;
  newRelaysFound: number;
  uniqueRelaysFound: number;
  
  // Session stats
  runtime: string;
  eventsPerMinute: number;
  timeSinceLastEvent: string;
}

/**
 * Create a status object with all the current stats
 */
function getStatusData(): TrawlerStatusData {
  const now = Date.now();
  const runtimeMs = now - trawlerStats.sessionStart;
  const runtimeMinutes = runtimeMs / 60000;
  const timeSinceLastMs = now - trawlerStats.lastUpdateTime;
  
  // Calculate events per minute
  const eventsPerMinute = runtimeMinutes > 0 
    ? Math.round((trawlerStats.eventsProcessed / runtimeMinutes) * 10) / 10 
    : 0;
  
  // Calculate rejection rate
  const rejectionRate = trawlerStats.totalEvents > 0 
    ? Math.round((trawlerStats.eventsRejected / trawlerStats.totalEvents) * 1000) / 10 
    : 0;
  
  // Format runtime
  const hours = Math.floor(runtimeMs / 3600000);
  const minutes = Math.floor((runtimeMs % 3600000) / 60000);
  const seconds = Math.floor((runtimeMs % 60000) / 1000);
  const runtime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Format time since last event
  const timeSinceLastHours = Math.floor(timeSinceLastMs / 3600000);
  const timeSinceLastMinutes = Math.floor((timeSinceLastMs % 3600000) / 60000);
  const timeSinceLastSeconds = Math.floor((timeSinceLastMs % 60000) / 1000);
  const timeSinceLastEvent = timeSinceLastMs < 1000 ? "just now" : 
    `${timeSinceLastHours > 0 ? timeSinceLastHours + "h " : ""}${timeSinceLastMinutes > 0 ? timeSinceLastMinutes + "m " : ""}${timeSinceLastSeconds}s ago`;
  
  return {
    totalEvents: trawlerStats.totalEvents,
    eventsProcessed: trawlerStats.eventsProcessed,
    eventsRejected: trawlerStats.eventsRejected,
    rejectionRate,
    totalRelaysList: 0, // Will be populated later
    newRelaysFound: trawlerStats.newRelaysFound,
    uniqueRelaysFound: trawlerStats.uniqueRelaysFound.size,
    runtime,
    eventsPerMinute,
    timeSinceLastEvent
  };
}

/**
 * Create an ASCII box with trawler stats
 */
export function createAsciiBox(): string {
  const c = chalk;
  const title = c.bold.bgBlue.white;
  const header = c.bold.cyan;
  const subheader = c.bold.blue;
  const value = c.yellow;
  const highlight = c.bold.green;
  const warning = c.bold.red;
  
  // Calculate visible string length (without ANSI codes)
  const strLength = (str: string): number => {
    // Remove ANSI escape codes when calculating length
    return str.replace(/\u001b\[.*?m/g, '').length;
  };
  
  // Box dimensions
  const boxWidth = 70;
  const columnWidth = Math.floor((boxWidth - 4) / 2);
  const titleText = ' NOSTR TRAWLER STATUS ';
  const titlePadding = Math.floor((boxWidth - 2 - titleText.length) / 2);
  
  // Get status data
  const stats = getStatusData();
  
  // Create the box
  let box = '\n';
  
  // Top border
  box += '╔' + '═'.repeat(boxWidth - 2) + '╗\n';
  
  // Title
  const titleLine = `${' '.repeat(titlePadding)}${title(titleText)}${' '.repeat(boxWidth - 2 - titlePadding - titleText.length)}`;
  box += `║${titleLine}║\n`;
  
  // Separator
  box += '╠' + '═'.repeat(boxWidth - 2) + '╣\n';
  
  // Headers for the two columns
  const eventsHeader = `${header('EVENTS')}`;
  const relaysHeader = `${header('RELAYS')}`;
  
  // Create a header row with exact width
  let headerContent = '';
  
  // Pad each header to fit exactly one column width
  headerContent += ` ${eventsHeader}${' '.repeat(Math.max(0, columnWidth - strLength(eventsHeader) - 1))}`;
  
  // For the last column
  const remainingHeaderWidth = (boxWidth - 2) - strLength(headerContent) - strLength(relaysHeader) - 1;
  headerContent += `${relaysHeader}${' '.repeat(Math.max(0, remainingHeaderWidth))}`;
  
  // Add headers row
  box += `║${headerContent} ║\n`;
  
  // Separator line
  box += `║${' '.repeat(boxWidth - 2)}║\n`;
  
  // Define type for the data items
  interface StatsItem {
    key: string;
    value: string | number;
    highlight?: boolean;
    warning?: boolean;
  }
  
  // Function to pad values
  const padValue = (val: number | string): string => {
    if (typeof val === 'number') {
      return val.toString().padStart(8, ' ');
    }
    return val.toString().padStart(8, ' ');
  };
  
  // Define the data for each column
  const eventsData: StatsItem[] = [
    { key: 'Total Events:', value: padValue(stats.totalEvents), highlight: true },
    { key: 'Processed:', value: padValue(stats.eventsProcessed) },
    { key: 'Rejected:', value: padValue(stats.eventsRejected), warning: stats.eventsRejected > 0 },
    { key: 'Rejection Rate:', value: padValue(stats.rejectionRate + '%'), warning: stats.rejectionRate > 50 },
    { key: 'Events/Minute:', value: padValue(stats.eventsPerMinute) },
    { key: 'Last Event:', value: stats.timeSinceLastEvent }
  ];
  
  const relaysData: StatsItem[] = [
    { key: 'New Relays Found:', value: padValue(stats.newRelaysFound), highlight: stats.newRelaysFound > 0 },
    { key: 'Unique Relays:', value: padValue(stats.uniqueRelaysFound), highlight: true },
    { key: 'Runtime:', value: stats.runtime }
  ];
  
  // Find the max number of rows needed
  const maxRows = Math.max(eventsData.length, relaysData.length);
  
  // Find the longest key in each column for better alignment
  const findLongestKey = (data: StatsItem[]): number => {
    return Math.max(...data.map(item => strLength(item.key)));
  };
  
  const eventsKeyLength = findLongestKey(eventsData);
  const relaysKeyLength = findLongestKey(relaysData);
  
  // Generate rows for the tables
  for (let i = 0; i < maxRows; i++) {
    let rowContent = '';
    
    // Events column
    if (i < eventsData.length) {
      const item = eventsData[i];
      const keyPadding = ' '.repeat(eventsKeyLength - strLength(item.key));
      const formattedValue = item.warning ? 
        warning(item.value) : 
        (item.highlight ? highlight(item.value) : value(item.value));
      const cellContent = ` ${subheader(item.key)}${keyPadding} ${formattedValue}`;
      rowContent += `${cellContent}${' '.repeat(Math.max(0, columnWidth - strLength(cellContent)))}`;
    } else {
      rowContent += ' '.repeat(columnWidth);
    }
    
    // Relays column
    if (i < relaysData.length) {
      const item = relaysData[i];
      const keyPadding = ' '.repeat(relaysKeyLength - strLength(item.key));
      const formattedValue = item.warning ? 
        warning(item.value) : 
        (item.highlight ? highlight(item.value) : value(item.value));
      const cellContent = `${subheader(item.key)}${keyPadding} ${formattedValue}`;
      // Make sure we pad exactly to the remaining width to ensure straight right border
      const remainingWidth = (boxWidth - 2) - strLength(rowContent) - strLength(cellContent) - 1;
      rowContent += `${cellContent}${' '.repeat(Math.max(0, remainingWidth))}`;
    } else {
      // Fill the remaining width exactly
      const remainingWidth = (boxWidth - 2) - strLength(rowContent);
      rowContent += ' '.repeat(Math.max(0, remainingWidth));
    }
    
    // Add the row to the box
    box += `║${rowContent} ║\n`;
  }
  
  // Bottom border
  box += '╚' + '═'.repeat(boxWidth - 2) + '╝\n';
  
  return box;
}

/**
 * Log status information based on interval
 */
export function logStatus(interval: number = 20): void {
  statsCounter++;
  if (statsCounter >= interval) {
    statsCounter = 0; // Reset counter
    try {
      console.log(createAsciiBox());
    } catch (error) {
      logger.error(`Error creating status box: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Format a simple one-line status summary
 */
export function formatCompactStats(): string {
  try {
    const stats = getStatusData();
    return `Events: ${stats.eventsProcessed}/${stats.totalEvents} | Rejected: ${stats.rejectionRate}% | New Relays: ${stats.newRelaysFound}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Set up periodic status logging
 */
export function setupStatusReporting(intervalSeconds: number = 30): ReturnType<typeof setInterval> {
  // Convert to milliseconds
  const msInterval = intervalSeconds * 1000;
  
  return setInterval(() => {
    console.log(createAsciiBox());
  }, msInterval);
} 