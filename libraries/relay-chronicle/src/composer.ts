/**
 * relay-chronicle - Core Composer
 *
 * Core logic for composing relay state from Kind 1066 delta events.
 */

import type {
  DeltaEvent,
  RelayState,
  ComposeOptions,
  ComposedState,
  ComposedSnapshots,
  ParsedDelta,
  UptimeStats,
} from './types.ts';

import {
  parseOperationalStatus,
  parseRelayUrl,
  parsePeriods,
  parseRttOpen,
  parseRetryCount,
  isRelayOnline,
  parseDeltas,
  setNested,
  deleteNested,
  parseValue,
  separateByNamespace,
} from './utils.ts';

/**
 * Apply a single delta to a state object
 */
function applyDelta(state: Record<string, any>, delta: ParsedDelta): void {
  const value = parseValue(delta.value);

  switch (delta.type) {
    case 'add':
    case 'change':
      setNested(state, delta.key, value);
      break;

    case 'remove':
      deleteNested(state, delta.key);
      break;
  }
}

/**
 * Create an initial empty relay state
 */
function createEmptyState(url: string, timestamp: number, eventId: string): RelayState {
  return {
    url,
    online: false,
    info: {},
    dns: {},
    geo: {},
    timestamp,
    eventId,
  };
}

/**
 * Process a single delta event and update state
 */
function processEvent(currentState: RelayState, event: DeltaEvent): RelayState {
  // Parse event metadata
  const operationalStatus = parseOperationalStatus(event);
  const online = isRelayOnline(event);
  const periods = parsePeriods(event);
  const rttOpen = parseRttOpen(event);
  const retryCount = parseRetryCount(event);

  // Parse delta tags
  const deltas = parseDeltas(event);
  const { info, dns, geo } = separateByNamespace(deltas);

  // Create new state (immutable update)
  const newState: RelayState = {
    ...currentState,
    online,
    timestamp: event.created_at,
    eventId: event.id,
  };

  // Update operational status if present
  if (operationalStatus) {
    newState.operationalStatus = operationalStatus;
  }

  // Update periods if present
  if (periods.length > 0) {
    newState.periods = periods;
  }

  // Update RTT if present
  if (rttOpen !== undefined) {
    newState.rttOpen = rttOpen;
  }

  // Update retry count if present
  if (retryCount !== undefined) {
    newState.retryCount = retryCount;
  }

  // Apply deltas to info, dns, geo (create new objects for immutability)
  newState.info = { ...currentState.info };
  newState.dns = { ...currentState.dns };
  newState.geo = { ...currentState.geo };

  for (const delta of info) {
    applyDelta(newState.info, delta);
  }

  for (const delta of dns) {
    applyDelta(newState.dns, delta);
  }

  for (const delta of geo) {
    applyDelta(newState.geo, delta);
  }

  return newState;
}

/**
 * Compose relay state from delta events
 *
 * @param options - Composition options
 * @returns Composed state or snapshots
 */
export async function composeState(
  options: ComposeOptions
): Promise<ComposedState | ComposedSnapshots> {
  const { storage, relay, since, until, limit, statusOnly, periods, snapshots } = options;

  // Query events from storage
  const events = await storage.query({
    relay,
    since,
    until,
    limit,
    statusOnly,
    periods,
  });

  // Handle empty result
  if (events.length === 0) {
    const emptyState = createEmptyState(relay, Date.now() / 1000, '');

    if (snapshots) {
      return {
        snapshots: [],
        eventCount: 0,
        timeRange: {
          start: since || 0,
          end: until || Date.now() / 1000,
        },
      };
    }

    return {
      state: emptyState,
      eventCount: 0,
      timeRange: {
        start: since || 0,
        end: until || Date.now() / 1000,
      },
    };
  }

  // Initialize state
  const firstEvent = events[0];
  let currentState = createEmptyState(
    relay,
    firstEvent.created_at,
    firstEvent.id
  );

  // Track snapshots if requested
  const stateSnapshots: RelayState[] = [];

  // Process all events in chronological order
  for (const event of events) {
    currentState = processEvent(currentState, event);

    if (snapshots) {
      // Store a snapshot for each event
      stateSnapshots.push({ ...currentState });
    }
  }

  // Calculate time range
  const timeRange = {
    start: events[0].created_at,
    end: events[events.length - 1].created_at,
  };

  if (snapshots) {
    return {
      snapshots: stateSnapshots,
      eventCount: events.length,
      timeRange,
    };
  }

  return {
    state: currentState,
    eventCount: events.length,
    timeRange,
  };
}

/**
 * Calculate uptime statistics from delta events
 *
 * @param options - Composition options
 * @returns Uptime statistics
 */
export async function calculateUptime(
  options: Omit<ComposeOptions, 'snapshots'>
): Promise<UptimeStats> {
  const { storage, relay, since, until } = options;

  // Query only state transition events
  const events = await storage.query({
    relay,
    since,
    until,
    statusOnly: true, // Only get O tag events
  });

  let uptimeMs = 0;
  let downtimeMs = 0;
  let outageCount = 0;
  let lastOnlineTime: number | null = null;
  let lastOfflineTime: number | null = null;
  let maxOutageDurationMs = 0;
  let totalOutageDurationMs = 0;
  let currentStatus: 'online' | 'offline' | 'unknown' = 'unknown';

  for (const event of events) {
    const status = parseOperationalStatus(event);
    const timestamp = event.created_at;

    if (status === 'init' || status === 'up') {
      // Relay came online
      if (lastOfflineTime !== null) {
        // Calculate downtime
        const outage = (timestamp - lastOfflineTime) * 1000;
        downtimeMs += outage;
        totalOutageDurationMs += outage;
        maxOutageDurationMs = Math.max(maxOutageDurationMs, outage);
        lastOfflineTime = null;
      }
      lastOnlineTime = timestamp;
      currentStatus = 'online';
    } else if (status === 'down') {
      // Relay went offline
      if (lastOnlineTime !== null) {
        // Calculate uptime
        uptimeMs += (timestamp - lastOnlineTime) * 1000;
        lastOnlineTime = null;
      }
      lastOfflineTime = timestamp;
      outageCount++;
      currentStatus = 'offline';
    }
  }

  // Handle ongoing state at the end of time range
  const endTime = until || Math.floor(Date.now() / 1000);

  if (lastOnlineTime !== null) {
    uptimeMs += (endTime - lastOnlineTime) * 1000;
  }

  if (lastOfflineTime !== null) {
    const ongoing = (endTime - lastOfflineTime) * 1000;
    downtimeMs += ongoing;
    totalOutageDurationMs += ongoing;
    maxOutageDurationMs = Math.max(maxOutageDurationMs, ongoing);
  }

  // Calculate total time and percentage
  const totalMs = uptimeMs + downtimeMs;
  const uptimePercent = totalMs > 0 ? (uptimeMs / totalMs) * 100 : 0;

  const avgOutageDurationMs = outageCount > 0
    ? totalOutageDurationMs / outageCount
    : undefined;

  return {
    uptimeMs,
    downtimeMs,
    uptimePercent,
    outageCount,
    avgOutageDurationMs,
    maxOutageDurationMs: outageCount > 0 ? maxOutageDurationMs : undefined,
    currentStatus,
  };
}

/**
 * Get the latest state for a relay
 *
 * @param options - Composition options (without time range)
 * @returns Latest relay state
 */
export async function getLatestState(
  storage: import('./types.ts').EventStorage,
  relay: string
): Promise<RelayState | null> {
  const result = await composeState({
    storage,
    relay,
    limit: 1000, // Get recent events to build up state
  });

  if ('state' in result) {
    return result.state;
  }

  return null;
}
