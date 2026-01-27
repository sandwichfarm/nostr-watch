import { Config } from "../../config/config.ts";

// Enhanced config state
export type ConfigState = {
  path: string[];           // Current path in the config
  editingKey: string | null;  // Currently editing key
  editingValue: string;     // Value being edited
  isEditing: boolean;       // Whether we're in edit mode
  cursorPosition: number;   // Position of cursor in editing value
  showCursor: boolean;      // For blinking cursor
};

// Valid menu names
export type MenuName = "main" | "monitor" | "config" | "relayStatus" | "logs";

// Columns for relay status display
export type ColumnName = "url" | "network" | "lastChecked" | "status" | "ignored";

// Application state
export interface State {
  running: boolean;                // Whether the app is running
  menu: MenuName;                  // Current menu
  selectedIndex: number;           // Selected item in the current menu
  topIndex: number;                // Top index for scrolling
  
  config: Config;                  // Application configuration
  configPath: string;              // Path to the config file
  configState: ConfigState;        // Config editing state
  
  monitorProcess: any;             // Running monitor process
  monitorPid: number | null;       // PID of the monitor process
  monitorStats: any;               // Stats from the monitor
  monitorLogs: string[];           // Monitor logs
  
  filter: string;                  // Text filter for lists
  isFiltering: boolean;            // Whether we're actively filtering
  
  editingFilters: boolean;         // Whether we're editing filters
  filterMenuIndex: number;         // Selected filter in the filter menu
  
  statusFilters: {                 // Status filters
    online: boolean;
    offline: boolean;
    unchecked: boolean;
    ignored: boolean;              // Added ignored filter
  };
  
  networkFilters: {                // Network filters
    [key: string]: boolean;
  };
  
  // Added for column selection and sorting
  selectedColumn: ColumnName;      // Currently selected column
  sortOrder: "asc" | "desc";       // Sort order
  sortColumn: ColumnName;          // Column to sort by
  
  groupBy: string | null;          // Group by column
}

// Initialize the state
export const state: State = {
  running: true,
  menu: "main",
  selectedIndex: 0,
  topIndex: 0,
  
  config: {} as Config,
  configPath: "",
  configState: {
    path: [],
    editingKey: null,
    editingValue: "",
    isEditing: false,
    cursorPosition: 0,
    showCursor: true
  },
  
  monitorProcess: null,
  monitorPid: null,
  monitorStats: null,
  monitorLogs: [],
  
  filter: "",
  isFiltering: false,
  
  editingFilters: false,
  filterMenuIndex: 0,
  
  statusFilters: {
    online: true,
    offline: false,   // Changed to false - offline relays hidden by default
    unchecked: true,
    ignored: true    
  },
  
  networkFilters: {},
  
  // Updated sort defaults
  selectedColumn: "lastChecked",
  sortOrder: "desc",  // Changed to descending
  sortColumn: "lastChecked", // Changed to lastChecked
  
  groupBy: null
};

// Store callback for cursor blinking
let blinkCallback: (() => void) | null = null;

// Register a callback for cursor blinking
export function registerBlinkCallback(callback: () => void): void {
  blinkCallback = callback;
}

// Set up cursor blinking at a slower rate
export function setupCursorBlink(): number {
  // Only blink in edit mode at a slower rate
  const interval = setInterval(() => {
    // Only blink if we're in edit mode
    if (state.configState.isEditing) {
      state.configState.showCursor = !state.configState.showCursor;
      
      // Call the blink callback if registered
      if (blinkCallback) {
        blinkCallback();
      }
    }
  }, 800); // Increased from 500ms to reduce flashing
  
  return interval;
}

// Function to get the current level of config based on the path
export function getCurrentConfigLevel(): any {
  let current = state.config as Record<string, any>;
  for (const key of state.configState.path) {
    current = current[key];
  }
  return current;
}

// Function to initialize network filters from the database
export function initializeNetworkFilters(): void {
  // Get networks from config
  const configNetworks = state.config?.relaymon?.networks || [];
  
  // Create the network filters object with all networks enabled by default
  const networkFilters: {[key: string]: boolean} = {};
  
  // Always include these standard networks
  ["clearnet", "tor", "i2p", "loki"].forEach(network => {
    networkFilters[network] = true;
  });
  
  // Add networks from config
  configNetworks.forEach(network => {
    networkFilters[network] = true;
  });
  
  // Set the state
  state.networkFilters = networkFilters;
} 