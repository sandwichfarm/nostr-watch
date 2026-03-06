import { parse } from "https://deno.land/std@0.218.2/yaml/mod.ts";
import { validateConfig } from "../types/config.ts";
import type { Config } from "../types/config.ts";

// Re-export Config type for backwards compatibility
export type { Config };

// Store original timestring values so they can be preserved in the UI
const originalTimeValues = new Map<string, string>();

export function timeString(input: number | string): number {
  if (typeof input === "number") return input;
  
  // Store the original string for later reference
  const pathKey = String(Math.random()); // Simple way to get a unique key
  originalTimeValues.set(pathKey, input);
  
  const trimmed = input.trim();
  const regex = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/;
  const match = trimmed.match(regex);
  if (!match) {
    throw new Error(`Invalid duration format: ${input}`);
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

// Get the original timestring for a given millisecond value (if available)
export function getOriginalTimeString(ms: number): string | null {
  // Look for a matching value in the original values map
  for (const [_, timeStr] of originalTimeValues.entries()) {
    if (timeString(timeStr) === ms) {
      return timeStr;
    }
  }
  return null;
}

function processConfigTimeValues(config: Config, parentPath = ""): void {
  if (config.relaymon?.seed?.interval) {
    const path = `${parentPath}.relaymon.seed.interval`;
    const originalValue = config.relaymon.seed.interval;
    config.relaymon.seed.interval = timeString(config.relaymon.seed.interval);
    // Store the mapping between path and original value
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }
  
  if (config.relaymon?.checks?.options) {
    if (config.relaymon.checks.options.expires) {
      const path = `${parentPath}.relaymon.checks.options.expires`;
      const originalValue = config.relaymon.checks.options.expires;
      config.relaymon.checks.options.expires = timeString(
        config.relaymon.checks.options.expires,
      );
      if (typeof originalValue === "string") {
        originalTimeValues.set(path, originalValue);
      }
    }
    
    if (config.relaymon.checks.options.interval) {
      const path = `${parentPath}.relaymon.checks.options.interval`;
      const originalValue = config.relaymon.checks.options.interval;
      config.relaymon.checks.options.interval = timeString(
        config.relaymon.checks.options.interval,
      );
      if (typeof originalValue === "string") {
        originalTimeValues.set(path, originalValue);
      }
    }
  }
  
  if (Array.isArray(config.relaymon?.retry?.expiry)) {
    config.relaymon.retry.expiry = config.relaymon.retry.expiry.map(
      (entry: { delay: string | number; retries: number }, index: number) => {
        const entryPath = `${parentPath}.relaymon.retry.expiry[${index}].delay`;
        const originalDelay = entry.delay;

        const result = {
          ...entry,
          delay:
            typeof entry.delay === "string"
              ? timeString(entry.delay)
              : entry.delay,
        };

        if (typeof originalDelay === "string") {
          originalTimeValues.set(entryPath, originalDelay);
        }

        return result;
      },
    );
  }

  // Process announce frequency
  if (config.announce?.frequency) {
    const path = `${parentPath}.announce.frequency`;
    const originalValue = config.announce.frequency;
    config.announce.frequency = timeString(config.announce.frequency);
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }

  // Process health config time values
  if (config.health?.kuma?.intervalMs) {
    const path = `${parentPath}.health.kuma.intervalMs`;
    const originalValue = config.health.kuma.intervalMs;
    config.health.kuma.intervalMs = timeString(config.health.kuma.intervalMs);
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }

  if (config.health?.kuma?.startupGraceMs) {
    const path = `${parentPath}.health.kuma.startupGraceMs`;
    const originalValue = config.health.kuma.startupGraceMs;
    config.health.kuma.startupGraceMs = timeString(config.health.kuma.startupGraceMs);
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }

  if (config.health?.thresholds?.checkIdleMs) {
    const path = `${parentPath}.health.thresholds.checkIdleMs`;
    const originalValue = config.health.thresholds.checkIdleMs;
    config.health.thresholds.checkIdleMs = timeString(config.health.thresholds.checkIdleMs);
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }

  if (config.health?.thresholds?.startupGraceMs) {
    const path = `${parentPath}.health.thresholds.startupGraceMs`;
    const originalValue = config.health.thresholds.startupGraceMs;
    config.health.thresholds.startupGraceMs = timeString(config.health.thresholds.startupGraceMs);
    if (typeof originalValue === "string") {
      originalTimeValues.set(path, originalValue);
    }
  }
}

export async function loadConfig(path: string): Promise<Config> {
  const fileText = await Deno.readTextFile(path);
  const config = parse(fileText);
  processConfigTimeValues(config);

  // Validate config structure and types
  const validatedConfig = validateConfig(config);

  return validatedConfig;
}

// Function to convert milliseconds back to a human-readable timestring
export function msToTimeString(ms: number): string {
  // First check if we have the original string value
  const original = getOriginalTimeString(ms);
  if (original) return original;
  
  // Otherwise generate a new one
  if (ms < 1000) return `${ms}ms`;
  if (ms % 1000 === 0) {
    const seconds = ms / 1000;
    
    if (seconds % 60 === 0) {
      const minutes = seconds / 60;
      
      if (minutes % 60 === 0) {
        const hours = minutes / 60;
        
        if (hours % 24 === 0) {
          const days = hours / 24;
          return `${days}d`;
        }
        
        return `${hours}h`;
      }
      
      return `${minutes}m`;
    }
    
    return `${seconds}s`;
  }
  
  // Fallback for irregular values
  if (ms >= 86400000) return `${Math.floor(ms/86400000)}d`;
  if (ms >= 3600000) return `${Math.floor(ms/3600000)}h`;
  if (ms >= 60000) return `${Math.floor(ms/60000)}m`;
  if (ms >= 1000) return `${Math.floor(ms/1000)}s`;
  return `${ms}ms`;
}
