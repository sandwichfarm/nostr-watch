/**
 * relay-state-composer - Types
 *
 * Type definitions for composing relay state from Kind 1066 delta events.
 */

/**
 * Nostr event structure (minimal subset needed for delta events)
 */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

/**
 * Kind 1066 delta event (type-safe subset)
 */
export interface DeltaEvent extends NostrEvent {
  kind: 1066;
}

/**
 * Operational status values for relay liveness transitions
 */
export type OperationalStatus = 'init' | 'down' | 'up';

/**
 * Delta tag types
 */
export type DeltaType = 'add' | 'remove' | 'change';

/**
 * Parsed delta from event tags
 */
export interface ParsedDelta {
  key: string;
  value: string;
  type: DeltaType;
  timestamp: number;
}

/**
 * Relay state snapshot at a point in time
 */
export interface RelayState {
  /** Relay URL */
  url: string;

  /** Operational status (if state transition occurred) */
  operationalStatus?: OperationalStatus;

  /** Is relay currently online? */
  online: boolean;

  /** RTT for connection open (milliseconds) */
  rttOpen?: number;

  /** Retry count (for offline relays) */
  retryCount?: number;

  /** Time periods this state represents */
  periods?: string[];

  /** NIP-11 relay info */
  info: Record<string, any>;

  /** DNS information */
  dns: Record<string, any>;

  /** Geographic information */
  geo: Record<string, any>;

  /** Timestamp of this state */
  timestamp: number;

  /** Event ID that produced this state */
  eventId: string;
}

/**
 * Options for querying delta events
 */
export interface QueryOptions {
  /** Relay URL to query */
  relay: string;

  /** Start of time range (unix timestamp) */
  since?: number;

  /** End of time range (unix timestamp) */
  until?: number;

  /** Limit number of events */
  limit?: number;

  /** Filter by operational status transitions only */
  statusOnly?: boolean;

  /** Filter by specific time periods */
  periods?: string[];
}

/**
 * Storage interface for fetching delta events
 *
 * Implement this interface to connect to any backend (Nostr relays, database, API, etc.)
 */
export interface EventStorage {
  /**
   * Query delta events with the given options
   *
   * @param options - Query parameters
   * @returns Promise resolving to array of delta events (sorted by created_at ASC)
   */
  query(options: QueryOptions): Promise<DeltaEvent[]>;
}

/**
 * Options for composing relay state
 */
export interface ComposeOptions {
  /** Storage implementation for fetching events */
  storage: EventStorage;

  /** Relay URL to compose state for */
  relay: string;

  /** Start of time range */
  since?: number;

  /** End of time range */
  until?: number;

  /** Limit number of events to fetch */
  limit?: number;

  /** Only include state transition events */
  statusOnly?: boolean;

  /** Filter by time periods */
  periods?: string[];

  /** Return snapshots for each event instead of final state */
  snapshots?: boolean;
}

/**
 * Result of state composition
 */
export interface ComposedState {
  /** Final composed state */
  state: RelayState;

  /** Number of events processed */
  eventCount: number;

  /** Time range covered */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Result when requesting snapshots
 */
export interface ComposedSnapshots {
  /** Array of state snapshots (one per event) */
  snapshots: RelayState[];

  /** Number of events processed */
  eventCount: number;

  /** Time range covered */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Uptime calculation result
 */
export interface UptimeStats {
  /** Total uptime in milliseconds */
  uptimeMs: number;

  /** Total downtime in milliseconds */
  downtimeMs: number;

  /** Uptime percentage (0-100) */
  uptimePercent: number;

  /** Number of outages */
  outageCount: number;

  /** Average outage duration in milliseconds */
  avgOutageDurationMs?: number;

  /** Longest outage duration in milliseconds */
  maxOutageDurationMs?: number;

  /** Current status */
  currentStatus: 'online' | 'offline' | 'unknown';
}
