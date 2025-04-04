import * as colors from "https://deno.land/std@0.218.2/fmt/colors.ts";
import { parse, stringify } from "https://deno.land/std@0.218.2/yaml/mod.ts";
import { getLogger } from "../../utils/logger.ts";
import { state } from "./state.ts";

const logger = getLogger("Interactive");

// Clear the terminal screen
export const clearScreen = (): void => {
  // Clear screen and move cursor to top-left
  console.log("\x1Bc");
};

// Load configuration
export async function loadConfig(path: string): Promise<any> {
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
export async function saveConfig(config: any, path: string): Promise<void> {
  try {
    const yamlString = stringify(config);
    await Deno.writeTextFile(path, yamlString);
    logger.info(`Configuration saved to ${path}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error saving config: ${errorMessage}`);
  }
}

// Helper to read from process stdout/stderr
export async function readProcessOutput(process: any): Promise<string> {
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

// Format a Unix timestamp as a relative time string
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) {
    return "never";
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // If timestamp is not in seconds (likely milliseconds), convert it
  const timestampSec = timestamp > 1000000000000 ? Math.floor(timestamp / 1000) : timestamp;
  
  // Check if timestamp is in the future (likely an error)
  if (timestampSec > now) {
    // If it's more than a year in the future, it's probably wrong
    if (timestampSec - now > 31536000) {
      return `invalid (${timestampSec})`;
    }
    return `${timestampSec}s`;
  }
  
  // Calculate the time difference in seconds
  const seconds = now - timestampSec;
  
  // Create the "time ago" part
  let timeAgo = "";
  if (seconds < 60) {
    timeAgo = `${seconds}s ago`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    timeAgo = `${minutes}m ago`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    timeAgo = `${hours}h ago`;
  } else if (seconds < 2592000) {
    const days = Math.floor(seconds / 86400);
    timeAgo = `${days}d ago`;
  } else {
    // For anything older than a month, show the date
    const date = new Date(timestampSec * 1000);
    timeAgo = date.toISOString().split('T')[0];
  }
  
  // Return both the human-readable time and the timestamp in seconds
  return `${timeAgo} (${timestampSec})`;
} 