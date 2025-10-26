/**
 * relay-state-composer - Utilities
 *
 * Helper functions for parsing and processing delta events.
 */

import type {
  DeltaEvent,
  ParsedDelta,
  DeltaType,
  OperationalStatus,
} from './types.ts';

/**
 * Parse operational status from event tags
 */
export function parseOperationalStatus(event: DeltaEvent): OperationalStatus | undefined {
  const oTag = event.tags.find(t => t[0] === 'O');
  if (!oTag || !oTag[1]) return undefined;

  const status = oTag[1];
  if (status === 'init' || status === 'down' || status === 'up') {
    return status;
  }

  return undefined;
}

/**
 * Parse relay URL from event tags
 */
export function parseRelayUrl(event: DeltaEvent): string | undefined {
  const rTag = event.tags.find(t => t[0] === 'r');
  return rTag?.[1];
}

/**
 * Parse time periods from event tags
 */
export function parsePeriods(event: DeltaEvent): string[] {
  return event.tags
    .filter(t => t[0] === 'T' && t[1])
    .map(t => t[1]);
}

/**
 * Parse RTT-open from event tags
 */
export function parseRttOpen(event: DeltaEvent): number | undefined {
  const rttTag = event.tags.find(t => t[0] === 'rtt-open');
  if (!rttTag || !rttTag[1]) return undefined;

  const rtt = parseInt(rttTag[1], 10);
  return isNaN(rtt) ? undefined : rtt;
}

/**
 * Parse retry count from event tags
 */
export function parseRetryCount(event: DeltaEvent): number | undefined {
  const retryTag = event.tags.find(t => t[0] === 'retry');
  if (!retryTag || !retryTag[1]) return undefined;

  const retry = parseInt(retryTag[1], 10);
  return isNaN(retry) ? undefined : retry;
}

/**
 * Determine if relay is online based on event tags
 */
export function isRelayOnline(event: DeltaEvent): boolean {
  // If retry tag exists, relay is offline
  if (event.tags.some(t => t[0] === 'retry')) {
    return false;
  }

  // If rtt-open tag exists, relay is online
  if (event.tags.some(t => t[0] === 'rtt-open')) {
    return true;
  }

  // Check operational status
  const status = parseOperationalStatus(event);
  if (status === 'down') return false;
  if (status === 'up' || status === 'init') return true;

  // Default to unknown (treat as offline for safety)
  return false;
}

/**
 * Parse delta tags from event
 *
 * Returns all delta tags (field changes, additions, removals)
 */
export function parseDeltas(event: DeltaEvent): ParsedDelta[] {
  const deltas: ParsedDelta[] = [];

  // Metadata tags to skip
  const metadataTags = new Set(['r', 'O', 'T', 'rtt-open', 'retry']);

  for (const tag of event.tags) {
    const [key, value] = tag;

    // Skip metadata tags
    if (metadataTags.has(key)) continue;

    // Skip tags without values
    if (!value) continue;

    // Determine delta type
    let deltaType: DeltaType;
    let cleanKey: string;

    if (key.startsWith('+')) {
      deltaType = 'add';
      cleanKey = key.slice(1);
    } else if (key.startsWith('-')) {
      deltaType = 'remove';
      cleanKey = key.slice(1);
    } else {
      deltaType = 'change';
      cleanKey = key;
    }

    deltas.push({
      key: cleanKey,
      value,
      type: deltaType,
      timestamp: event.created_at,
    });
  }

  return deltas;
}

/**
 * Set nested property using dot notation
 *
 * @param obj - Object to modify
 * @param path - Dot-notated path (e.g., "dns.address" or "limitation.max_message_length")
 * @param value - Value to set
 */
export function setNested(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;
}

/**
 * Delete nested property using dot notation
 *
 * @param obj - Object to modify
 * @param path - Dot-notated path
 */
export function deleteNested(obj: Record<string, any>, path: string): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      return; // Path doesn't exist
    }
    current = current[key];
  }

  const lastKey = keys[keys.length - 1];
  delete current[lastKey];
}

/**
 * Parse a value from string (handle JSON, numbers, booleans)
 */
export function parseValue(value: string): any {
  // Try to parse as JSON
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Try to parse as number
  if (/^-?\d+\.?\d*$/.test(value)) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }

  // Parse booleans
  if (value === 'true') return true;
  if (value === 'false') return false;

  return value;
}

/**
 * Separate deltas by namespace (info, dns, geo)
 */
export function separateByNamespace(deltas: ParsedDelta[]): {
  info: ParsedDelta[];
  dns: ParsedDelta[];
  geo: ParsedDelta[];
} {
  const info: ParsedDelta[] = [];
  const dns: ParsedDelta[] = [];
  const geo: ParsedDelta[] = [];

  for (const delta of deltas) {
    if (delta.key.startsWith('dns.')) {
      dns.push({
        ...delta,
        key: delta.key.slice(4), // Remove 'dns.' prefix
      });
    } else if (delta.key.startsWith('geo.')) {
      geo.push({
        ...delta,
        key: delta.key.slice(4), // Remove 'geo.' prefix
      });
    } else {
      info.push(delta);
    }
  }

  return { info, dns, geo };
}
