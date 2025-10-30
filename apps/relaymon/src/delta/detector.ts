import type { RelayInfo } from "../types/relay.ts";
import { getLogger } from "../utils/logger.ts";

const logger = getLogger("DeltaDetector");

export interface Delta {
  key: string;
  value: string;
  type: "add" | "remove" | "change";
}

/**
 * Deep comparison of two values
 * @returns true if values are equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    // For simple arrays, check if they have the same elements (order-independent for simple values)
    const aSorted = [...a].sort();
    const bSorted = [...b].sort();
    return aSorted.every((val, idx) => deepEqual(val, bSorted[idx]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  return false;
}

/**
 * Flatten nested object to dot notation
 * @param obj The object to flatten
 * @param prefix Current key prefix
 * @param complexArrays Array of keys that should be treated as complex (JSON stringified)
 * @returns Flattened object with dot notation keys
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  complexArrays: string[] = []
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    // Check if this is a complex array that should be JSON stringified
    const isComplexArray = complexArrays.some(
      (complexKey) =>
        fullKey === complexKey || fullKey.startsWith(`${complexKey}.`)
    );

    if (isComplexArray && (Array.isArray(value) || typeof value === "object")) {
      // For complex arrays/objects (retention, fees.*, etc.), stringify the entire value
      flattened[fullKey] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      // For simple arrays, keep as-is for element-level comparison
      flattened[fullKey] = value;
    } else if (value !== null && typeof value === "object") {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, fullKey, complexArrays));
    } else {
      // Primitive values
      flattened[fullKey] = value;
    }
  }

  return flattened;
}

/**
 * Compare two arrays and return added/removed elements
 */
function compareArrays(
  oldArray: unknown[],
  newArray: unknown[]
): { added: unknown[]; removed: unknown[] } {
  const added: unknown[] = [];
  const removed: unknown[] = [];

  // Find removed elements
  for (const item of oldArray) {
    if (!newArray.some((newItem) => deepEqual(item, newItem))) {
      removed.push(item);
    }
  }

  // Find added elements
  for (const item of newArray) {
    if (!oldArray.some((oldItem) => deepEqual(item, oldItem))) {
      added.push(item);
    }
  }

  return { added, removed };
}

/**
 * Convert value to string for delta tag
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // For objects and arrays, JSON stringify
  return JSON.stringify(value);
}

/**
 * Detect deltas between two relay states
 * @param previousState The previous state (null if first check)
 * @param currentState The current state
 * @returns Array of delta objects
 */
export function detectDeltas(
  previousState: RelayInfo | null,
  currentState: RelayInfo
): Delta[] {
  const deltas: Delta[] = [];

  // Complex array fields that should be JSON stringified as a whole
  const complexArrayFields = [
    "retention",
    "fees.admission",
    "fees.subscription",
    "fees.publication",
  ];

  // If no previous state, all current values are additions
  if (!previousState) {
    const flatCurrent = flattenObject(currentState, "", complexArrayFields);
    for (const [key, value] of Object.entries(flatCurrent)) {
      if (value !== undefined && value !== null) {
        deltas.push({
          key: `+${key}`,
          value: valueToString(value),
          type: "add",
        });
      }
    }
    logger.debug(`First check for relay: ${deltas.length} fields added`);
    return deltas;
  }

  // Flatten both states for comparison
  const flatPrevious = flattenObject(previousState, "", complexArrayFields);
  const flatCurrent = flattenObject(currentState, "", complexArrayFields);

  // Find all keys
  const allKeys = new Set([
    ...Object.keys(flatPrevious),
    ...Object.keys(flatCurrent),
  ]);

  for (const key of allKeys) {
    const prevValue = flatPrevious[key];
    const currValue = flatCurrent[key];

    // Key was removed
    if (prevValue !== undefined && currValue === undefined) {
      deltas.push({
        key: `-${key}`,
        value: valueToString(prevValue),
        type: "remove",
      });
      continue;
    }

    // Key was added
    if (prevValue === undefined && currValue !== undefined) {
      deltas.push({
        key: `+${key}`,
        value: valueToString(currValue),
        type: "add",
      });
      continue;
    }

    // Both exist - check if changed
    if (prevValue !== undefined && currValue !== undefined) {
      // Handle arrays specially
      if (Array.isArray(prevValue) && Array.isArray(currValue)) {
        const { added, removed } = compareArrays(prevValue, currValue);

        // Add delta for each removed element
        for (const item of removed) {
          deltas.push({
            key: `-${key}`,
            value: valueToString(item),
            type: "remove",
          });
        }

        // Add delta for each added element
        for (const item of added) {
          deltas.push({
            key: `+${key}`,
            value: valueToString(item),
            type: "add",
          });
        }
      } else if (!deepEqual(prevValue, currValue)) {
        // Value changed
        deltas.push({
          key,
          value: valueToString(currValue),
          type: "change",
        });
      }
    }
  }

  logger.debug(`Detected ${deltas.length} deltas`);
  return deltas;
}

/**
 * Convert deltas to Nostr event tags
 * @param deltas Array of delta objects
 * @returns Array of tag arrays for Nostr event
 */
export function deltasToTags(deltas: Delta[]): string[][] {
  return deltas.map((delta) => [delta.key, delta.value]);
}
