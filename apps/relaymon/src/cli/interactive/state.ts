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

// State management for the interactive CLI
export type AppState = {
  running: boolean;
  config: Config;
  configPath: string;
  menu: string;
  subMenu: string | null;   // For tracking sub-menus like config sections
  selectedIndex: number;
  topIndex: number;         // For scrolling in lists
  monitorProcess: any;      // Store the monitor process
  monitorPid: number | null; // Store the PID
  monitorLogs: string[];    // Store monitor logs
  monitorStats: any;        // Store monitor stats
  sortColumn: string;
  sortDirection: "asc" | "desc";
  groupBy: string | null;
  configState: ConfigState; // State for config editing
  filter: string;           // Filter for lists
  isFiltering: boolean;     // Whether we're currently entering a filter
};

// Initialize app state
export const state: AppState = {
  running: true,
  config: {} as Config,
  configPath: "./config.yaml",
  menu: "main",
  subMenu: null,
  selectedIndex: 0,
  topIndex: 0,
  monitorProcess: null,
  monitorPid: null,
  monitorLogs: [],
  monitorStats: null,
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

let blinkCallback: (() => void) | null = null;

// Register callback for cursor blink
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

// Helper function to get the current level in config
export function getCurrentConfigLevel(): any {
  // Get the current config object based on the path
  let currentConfig = state.config;
  for (const key of state.configState.path) {
    if (currentConfig && typeof currentConfig === "object") {
      // Use type assertion to avoid TS errors
      currentConfig = currentConfig[key as keyof typeof currentConfig];
    } else {
      break;
    }
  }
  return currentConfig;
} 