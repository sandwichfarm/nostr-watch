/// <reference lib="deno.ns" />
import { getLogger } from "./logger.ts";

const logger = getLogger("Blocklists");

// Set to store blocked hostnames
const blockedHostnames = new Set<string>();

/**
 * Loads the hostname blocklist from the specified file
 */
export async function loadHostnameBlocklist(path = "./blocklists/hostname"): Promise<void> {
  try {
    const content = await Deno.readTextFile(path);
    const hostnames = content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#")); // Skip empty lines and comments
    
    // Clear existing blocklist and add new entries
    blockedHostnames.clear();
    hostnames.forEach(hostname => blockedHostnames.add(hostname));
    
    logger.info(`Loaded ${blockedHostnames.size} hostnames to blocklist: ${Array.from(blockedHostnames).join(', ')}`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      logger.warn(`Hostname blocklist file not found at ${path}`);
    } else {
      logger.error(`Error loading hostname blocklist: ${error}`);
    }
  }
}

/**
 * Checks if a relay URL's hostname is in the blocklist
 */
export function isHostnameBlocked(relayUrl: string): boolean {
  try {
    const url = new URL(relayUrl);
    const isBlocked = blockedHostnames.has(url.hostname);
    if (isBlocked) {
      logger.debug(`Relay ${relayUrl} has blocked hostname: ${url.hostname}`);
    }
    return isBlocked;
  } catch (error) {
    logger.warn(`Invalid URL when checking blocklist: ${relayUrl}`);
    return false;
  }
}

/**
 * Returns the current list of blocked hostnames
 */
export function getBlockedHostnames(): string[] {
  return Array.from(blockedHostnames);
} 