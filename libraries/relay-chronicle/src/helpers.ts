/**
 * relay-chronicle - Helper Functions
 *
 * Convenience functions for querying specific relay data points.
 */

import type {
  EventStorage,
  OperationalStatus,
} from './types.ts';

import {
  parseOperationalStatus,
  parseRetryCount,
  parseDeltas,
  separateByNamespace,
  parseValue,
  isRelayOnline,
} from './utils.ts';

/**
 * Result from whenInit()
 */
export interface InitInfo {
  /** When relay was first detected */
  timestamp: number;
  /** ISO date string */
  date: string;
  /** Event ID */
  eventId: string;
}

/**
 * Result from liveness()
 */
export interface LivenessInfo {
  /** Whether relay is currently live */
  live: boolean;
  /** When liveness was detected */
  detected_at: number;
  /** ISO date string */
  date: string;
  /** Operational status (init, up, down) */
  operationalStatus?: OperationalStatus;
  /** Event ID */
  eventId: string;
  /** Last check timestamp (most recent event) */
  last_check?: number;
}

/**
 * Result from lastDowntime()
 */
export interface DowntimeInfo {
  /** When relay went down */
  down_at: number;
  /** When relay came back up (if recovered) */
  up_at?: number;
  /** Duration in milliseconds (if recovered) */
  length?: number;
  /** Whether relay is still down */
  down_now: boolean;
  /** Number of retries */
  retries?: number;
  /** Down event ID */
  eventId: string;
  /** Up event ID (if recovered) */
  upEventId?: string;
}

/**
 * Uptime/downtime period
 */
export interface Period {
  /** Period type */
  type: 'uptime' | 'downtime';
  /** Start timestamp */
  start: number;
  /** End timestamp (if period ended) */
  end?: number;
  /** Duration in milliseconds (if period ended) */
  duration?: number;
  /** Whether period is ongoing */
  ongoing: boolean;
  /** Start event ID */
  eventId: string;
  /** End event ID (if period ended) */
  endEventId?: string;
}

/**
 * Field change info
 */
export interface ChangeInfo {
  /** Change timestamp */
  timestamp: number;
  /** ISO date string */
  date: string;
  /** Old value (undefined for additions) */
  oldValue?: any;
  /** New value */
  newValue: any;
  /** Change type */
  changeType: 'add' | 'remove' | 'change';
  /** Event ID */
  eventId: string;
}

/**
 * Find when relay was first detected
 *
 * @example
 * ```typescript
 * const init = await whenInit(storage, 'wss://relay.example.com');
 * console.log(`First seen: ${init.date}`);
 * ```
 */
export async function whenInit(
  storage: EventStorage,
  relay: string
): Promise<InitInfo | null> {
  const events = await storage.query({
    relay,
    limit: 1000,
  });

  // Find first event with O:init
  const initEvent = events.find(e => parseOperationalStatus(e) === 'init');

  if (!initEvent) {
    // Try to find the very first event if no init tag
    if (events.length > 0) {
      const first = events[0];
      return {
        timestamp: first.created_at,
        date: new Date(first.created_at * 1000).toISOString(),
        eventId: first.id,
      };
    }
    return null;
  }

  return {
    timestamp: initEvent.created_at,
    date: new Date(initEvent.created_at * 1000).toISOString(),
    eventId: initEvent.id,
  };
}

/**
 * Get current liveness status
 *
 * @example
 * ```typescript
 * const status = await liveness(storage, 'wss://relay.example.com');
 * console.log(`Live: ${status.live}, Last check: ${status.last_check}`);
 * ```
 */
export async function liveness(
  storage: EventStorage,
  relay: string
): Promise<LivenessInfo | null> {
  const events = await storage.query({
    relay,
    limit: 1000,
  });

  if (events.length === 0) {
    return null;
  }

  // Get most recent event
  const latest = events[events.length - 1];
  const live = isRelayOnline(latest);
  const operationalStatus = parseOperationalStatus(latest);

  // Find most recent status change
  let detected_at = latest.created_at;
  let detectedEventId = latest.id;

  // Walk backwards to find when current status started
  for (let i = events.length - 2; i >= 0; i--) {
    const prevLive = isRelayOnline(events[i]);
    if (prevLive !== live) {
      // Status changed, so current status started at 'latest'
      break;
    }
    // Same status, keep going back
    detected_at = events[i].created_at;
    detectedEventId = events[i].id;
  }

  return {
    live,
    detected_at,
    date: new Date(detected_at * 1000).toISOString(),
    operationalStatus,
    eventId: detectedEventId,
    last_check: latest.created_at,
  };
}

/**
 * Get last downtime period
 *
 * @example
 * ```typescript
 * const downtime = await lastDowntime(storage, 'wss://relay.example.com');
 * if (downtime?.down_now) {
 *   console.log(`Down since ${downtime.date}, ${downtime.retries} retries`);
 * }
 * ```
 */
export async function lastDowntime(
  storage: EventStorage,
  relay: string
): Promise<DowntimeInfo | null> {
  const events = await storage.query({
    relay,
    statusOnly: true,
    limit: 1000,
  });

  // Walk backwards to find most recent downtime
  let downEvent = null;
  let upEvent = null;

  for (let i = events.length - 1; i >= 0; i--) {
    const status = parseOperationalStatus(events[i]);

    if (status === 'down' && !downEvent) {
      downEvent = events[i];
      // Look for recovery event
      for (let j = i + 1; j < events.length; j++) {
        const nextStatus = parseOperationalStatus(events[j]);
        if (nextStatus === 'up' || nextStatus === 'init') {
          upEvent = events[j];
          break;
        }
      }
      break;
    }
  }

  if (!downEvent) {
    return null;
  }

  const retries = parseRetryCount(downEvent);
  const down_now = !upEvent;
  const length = upEvent
    ? (upEvent.created_at - downEvent.created_at) * 1000
    : undefined;

  return {
    down_at: downEvent.created_at,
    up_at: upEvent?.created_at,
    length,
    down_now,
    retries,
    eventId: downEvent.id,
    upEventId: upEvent?.id,
  };
}

/**
 * Get uptime/downtime history
 *
 * @example
 * ```typescript
 * const history = await uptimeHistory(storage, 'wss://relay.example.com', {
 *   since: Date.now() / 1000 - 86400 * 30 // Last 30 days
 * });
 *
 * console.log(`${history.length} periods`);
 * history.forEach(p => {
 *   console.log(`${p.type}: ${p.duration}ms`);
 * });
 * ```
 */
export async function uptimeHistory(
  storage: EventStorage,
  relay: string,
  options?: { since?: number; until?: number }
): Promise<Period[]> {
  const since = options?.since;
  const until = options?.until;

  let events = await storage.query({
    relay,
    statusOnly: true,
    since,
    until,
  });

  // If we are querying a bounded window, seed with the latest status event
  // immediately before `since` so we can render an "ongoing" period even
  // when there were no transitions inside the window.
  if (since !== undefined) {
    const seedEvents = await storage.query({
      relay,
      statusOnly: true,
      until: since,
    });

    const seed = seedEvents.length > 0 ? seedEvents[seedEvents.length - 1] : null;
    const first = events.length > 0 ? events[0] : null;
    if (seed && (!first || seed.created_at < first.created_at)) {
      events = [seed, ...events];
    }
  }

  const periods: Period[] = [];
  let currentPeriod: Period | null = null;

  for (const event of events) {
    const status = parseOperationalStatus(event);
    const online = isRelayOnline(event);

    if (status === 'init' || status === 'up') {
      // Start uptime period
      if (currentPeriod) {
        // End previous period
        currentPeriod.end = event.created_at;
        currentPeriod.duration = (event.created_at - currentPeriod.start) * 1000;
        currentPeriod.ongoing = false;
        currentPeriod.endEventId = event.id;
      }

      currentPeriod = {
        type: 'uptime',
        start: event.created_at,
        ongoing: true,
        eventId: event.id,
      };
      periods.push(currentPeriod);
    } else if (status === 'down') {
      // Start downtime period
      if (currentPeriod) {
        // End previous period
        currentPeriod.end = event.created_at;
        currentPeriod.duration = (event.created_at - currentPeriod.start) * 1000;
        currentPeriod.ongoing = false;
        currentPeriod.endEventId = event.id;
      }

      currentPeriod = {
        type: 'downtime',
        start: event.created_at,
        ongoing: true,
        eventId: event.id,
      };
      periods.push(currentPeriod);
    }
  }

  // Clip periods to requested time window, if provided.
  if (since !== undefined || until !== undefined) {
    const clipped: Period[] = [];
    for (const period of periods) {
      let start = period.start;
      let end = period.end;

      if (since !== undefined && start < since) {
        start = since;
      }

      if (until !== undefined) {
        // If the period is ongoing, cap it to `until` for bounded queries.
        const effectiveEnd = end ?? until;
        end = Math.min(effectiveEnd, until);
      }

      if (end !== undefined && end <= start) continue;

      clipped.push({
        ...period,
        start,
        ...(end !== undefined ? { end } : {}),
        ...(end !== undefined ? { duration: (end - start) * 1000, ongoing: false } : {}),
      });
    }
    return clipped;
  }

  return periods;
}

/**
 * Find when a field last changed
 *
 * @example
 * ```typescript
 * const change = await lastChange(storage, 'wss://relay.example.com', 'version');
 * console.log(`Version changed to ${change.newValue} on ${change.date}`);
 * ```
 */
export async function lastChange(
  storage: EventStorage,
  relay: string,
  field: string
): Promise<ChangeInfo | null> {
  const events = await storage.query({
    relay,
    limit: 1000,
  });

  // Determine namespace and stripped field name
  let namespace: 'info' | 'dns' | 'geo' = 'info';
  let strippedField = field;

  if (field.startsWith('dns.')) {
    namespace = 'dns';
    strippedField = field.slice(4);
  } else if (field.startsWith('geo.')) {
    namespace = 'geo';
    strippedField = field.slice(4);
  }

  // Walk backwards to find most recent change to field
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const deltas = parseDeltas(event);
    const { info, dns, geo } = separateByNamespace(deltas);

    // Select the appropriate namespace
    const targetDeltas = namespace === 'dns' ? dns : namespace === 'geo' ? geo : info;

    // Find delta for this field (using stripped field name)
    const delta = targetDeltas.find(d => d.key === strippedField);

    if (delta) {
      return {
        timestamp: event.created_at,
        date: new Date(event.created_at * 1000).toISOString(),
        newValue: parseValue(delta.value),
        changeType: delta.type,
        eventId: event.id,
      };
    }
  }

  return null;
}

/**
 * Get change history for a field
 *
 * @example
 * ```typescript
 * const history = await changeHistory(
 *   storage,
 *   'wss://relay.example.com',
 *   'dns.asn',
 *   { since: Date.now() / 1000 - 2592000 } // Last 30 days
 * );
 *
 * history.forEach(change => {
 *   console.log(`${change.date}: ${change.value}`);
 * });
 * ```
 */
export async function changeHistory(
  storage: EventStorage,
  relay: string,
  field: string,
  options?: { since?: number; until?: number }
): Promise<ChangeInfo[]> {
  const events = await storage.query({
    relay,
    since: options?.since,
    until: options?.until,
  });

  // Determine namespace and stripped field name
  let namespace: 'info' | 'dns' | 'geo' = 'info';
  let strippedField = field;

  if (field.startsWith('dns.')) {
    namespace = 'dns';
    strippedField = field.slice(4);
  } else if (field.startsWith('geo.')) {
    namespace = 'geo';
    strippedField = field.slice(4);
  }

  const changes: ChangeInfo[] = [];
  let lastValue: any = undefined;

  for (const event of events) {
    const deltas = parseDeltas(event);
    const { info, dns, geo } = separateByNamespace(deltas);

    // Select the appropriate namespace
    const targetDeltas = namespace === 'dns' ? dns : namespace === 'geo' ? geo : info;

    // Find delta for this field (using stripped field name)
    const delta = targetDeltas.find(d => d.key === strippedField);

    if (delta) {
      const newValue = parseValue(delta.value);

      changes.push({
        timestamp: event.created_at,
        date: new Date(event.created_at * 1000).toISOString(),
        oldValue: delta.type === 'change' ? lastValue : undefined,
        newValue,
        changeType: delta.type,
        eventId: event.id,
      });

      lastValue = newValue;
    }
  }

  return changes;
}
