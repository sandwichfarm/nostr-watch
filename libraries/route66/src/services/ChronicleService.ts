/**
 * ChronicleService
 *
 * Service for accessing relay history and time series data from Kind 1066 delta events.
 * Leverages route66's existing websocket adapter to avoid duplicate connections.
 */

import { Service } from './Service';
import { Route66EventStorage } from '@nostrwatch/relay-chronicle';
import type {
  TimeSeriesPoint,
  UptimeState,
  DeltaEvent,
  EventStorage,
  QueryOptions,
} from '@nostrwatch/relay-chronicle';
import {
  generateRttSeries,
  generateUptimeSeries,
  uptimeHistory,
} from '@nostrwatch/relay-chronicle';
import type { IAdaptersArgument } from '@base/interfaces';
import type { Filter } from 'nostr-tools';
import type { WebsocketRequestBody, SubscribeHandlers } from '@base/core';
import { deterministicHash } from '@base/utils';

/**
 * Configuration options for ChronicleService
 */
export interface ChronicleServiceOptions {
  /** Automatically subscribe to Kind 1066 events for queried relays */
  autoSync?: boolean;
  /** Relays to fetch Kind 1066 events from */
  syncRelays?: string[];
}

/**
 * Options for time series queries
 */
export interface TimeSeriesOptions {
  /** Relay URL to query */
  relay: string;
  /** Start of time range (unix timestamp in seconds) */
  since?: number;
  /** End of time range (unix timestamp in seconds) */
  until?: number;
  /** Type of time series data to extract */
  type?: 'rtt' | 'uptime' | 'changes';
  /** Optional aggregation settings */
  aggregate?: {
    /** Bucket size in seconds */
    bucketSize: number;
    /** Aggregation function */
    fn: 'avg' | 'min' | 'max' | 'sum';
  };
}

/**
 * Uptime period for timeline visualization
 */
export interface UptimePeriod {
  /** Period start timestamp */
  start: number;
  /** Period end timestamp (null if ongoing) */
  end: number | null;
  /** Whether relay was online during this period */
  online: boolean;
  /** RTT in milliseconds (if online) */
  rtt?: number;
}

/**
 * ChronicleService - Access relay history via Kind 1066 delta events
 *
 * This service integrates relay-chronicle with route66's existing infrastructure:
 * - Uses websocket adapter for fetching events (no duplicate connections)
 * - Uses cache adapter for querying stored events
 * - Provides time series data for charting
 *
 * @example
 * ```typescript
 * const chronicle = new ChronicleService(route66.adapters, {
 *   autoSync: true,
 *   syncRelays: ['wss://relay.nostr.watch'],
 * });
 *
 * // Sync a relay (fetch and subscribe to Kind 1066)
 * await chronicle.syncRelay('wss://relay.example.com');
 *
 * // Get RTT time series for charting
 * const rttData = await chronicle.getTimeSeriesData({
 *   relay: 'wss://relay.example.com',
 *   type: 'rtt',
 *   since: Date.now() / 1000 - 86400, // Last 24h
 * });
 * ```
 */
export class ChronicleService extends Service {
  public storage: Route66EventStorage;
  private memoryByRelay: Map<string, Map<string, DeltaEvent>> = new Map();
  private options: ChronicleServiceOptions;
  private kind1066Subscriptions: Map<string, string> = new Map();
  private syncInFlight: Map<string, Promise<void>> = new Map();

  private normalizeRelayKey(relay: string): string {
    const trimmed = (relay || '').trim();
    if (!trimmed) return '';
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  }

  private relayTagValues(relay: string): string[] {
    const trimmed = (relay || '').trim();
    if (!trimmed) return [];
    const withoutTrailingSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    const withTrailingSlash = `${withoutTrailingSlash}/`;
    return Array.from(new Set([trimmed, withoutTrailingSlash, withTrailingSlash]));
  }

  constructor(
    adapters: IAdaptersArgument,
    options: ChronicleServiceOptions = {}
  ) {
    super(adapters);
    this.storage = new Route66EventStorage(this.cacheAdapter);
    this.options = {
      autoSync: options.autoSync ?? false,
      syncRelays: options.syncRelays ?? [],
    };
    this.init();
  }

  private rememberEvent(relay: string, event: unknown): void {
    const ev = event as any;
    if (!ev || ev.kind !== 1066 || typeof ev.id !== 'string') return;

    const relayKey = this.normalizeRelayKey(relay);

    let relayMap = this.memoryByRelay.get(relayKey);
    if (!relayMap) {
      relayMap = new Map<string, DeltaEvent>();
      this.memoryByRelay.set(relayKey, relayMap);
    }
    relayMap.set(ev.id, ev as DeltaEvent);
  }

  private getMemoryStorage(): EventStorage {
    const memoryByRelay = this.memoryByRelay;
    const relayTagValues = this.relayTagValues.bind(this);
    const normalizeRelayKey = this.normalizeRelayKey.bind(this);

    return {
      async query(options: QueryOptions): Promise<DeltaEvent[]> {
        const relayKeys = relayTagValues(options.relay);
        const relayMaps = relayKeys
          .map((key) => memoryByRelay.get(normalizeRelayKey(key)))
          .filter((m): m is Map<string, DeltaEvent> => Boolean(m && m.size));

        if (relayMaps.length === 0) return [];

        const byId = new Map<string, DeltaEvent>();
        for (const relayMap of relayMaps) {
          for (const [id, ev] of relayMap.entries()) byId.set(id, ev);
        }

        let events = Array.from(byId.values());

        if (typeof options.since === 'number' && Number.isFinite(options.since)) {
          events = events.filter((e) => e.created_at >= options.since!);
        }
        if (typeof options.until === 'number' && Number.isFinite(options.until)) {
          events = events.filter((e) => e.created_at <= options.until!);
        }
        if (options.statusOnly) {
          events = events.filter((e) =>
            Array.isArray(e.tags) &&
            e.tags.some((t: any[]) => t?.[0] === 'O' && (t?.[1] === 'init' || t?.[1] === 'up' || t?.[1] === 'down'))
          );
        }
        if (options.periods && options.periods.length > 0) {
          const allowed = new Set(options.periods);
          events = events.filter((e) =>
            Array.isArray(e.tags) &&
            e.tags.some((t: any[]) => t?.[0] === 'T' && allowed.has(String(t?.[1] ?? '')))
          );
        }

        events.sort((a, b) => a.created_at - b.created_at);

        if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
          // Nostr `limit` semantics typically return most recent events; after sorting ASC,
          // keep the last N.
          events = events.slice(-options.limit);
        }

        return events;
      },
    };
  }

  async init(): Promise<void> {
    await this.cacheAdapter.ready();
    this._ready = true;
  }

  /**
   * Subscribe to Kind 1066 delta events for a relay
   *
   * Uses route66's websocket adapter to fetch and subscribe to events.
   * Events are automatically cached by the cache adapter.
   *
   * @param relay - Relay URL to sync
   * @param options - Sync options
   */
  async syncRelay(
    relay: string,
    options?: {
      /** Fetch events since this timestamp */
      since?: number;
      /** Keep subscription alive */
      keepAlive?: boolean;
    }
  ): Promise<void> {
    await this.ready();

    const keepAlive = options?.keepAlive ?? this.options.autoSync ?? false;

    // Check if already subscribed
    if (this.kind1066Subscriptions.has(relay)) {
      console.warn(`[Chronicle] Already syncing ${relay}`);
      return;
    }

    const existing = this.syncInFlight.get(relay);
    if (existing) return existing;

    const task = (async () => {
      const relayValues = this.relayTagValues(relay);

      const filters: Filter[] = [];

      // Always fetch the requested window (for RTT + check-frequency style charts)
      filters.push({
        kinds: [1066],
        '#r': relayValues,
        since: options?.since,
      });

      // Also fetch status transition events (O tags) so uptime history can be
      // computed even when there are no transitions in the requested window.
      filters.push({
        kinds: [1066],
        '#r': relayValues,
        '#O': ['init', 'up', 'down'],
        limit: 1000,
      });

      const args: WebsocketRequestBody = {
        filters,
        relays: this.options.syncRelays,
        hash: deterministicHash(filters),
        options: {
          // One-shot chart fetches should not depend on the cache worker (OPFS/COOP/COEP),
          // otherwise Kind 1066 streaming can fail entirely when OPFS isn't available.
          cache: keepAlive,
          stream: true,
          keepAlive,
          returnResults: false,
        },
      };

      const callbacks: SubscribeHandlers = {
        onevent: (event) => {
          this.rememberEvent(relay, event);
          console.log(`[Chronicle] Received Kind 1066 for ${relay}`, event.id.slice(0, 8));
        },
        oneose: () => {
          console.log(`[Chronicle] EOSE for ${relay}`);
        },
      };

      // Subscribe via websocket adapter - leverages existing connections
      await this.subscribe(args, callbacks, !keepAlive);

      if (keepAlive) {
        this.kind1066Subscriptions.set(relay, args.hash!);
        console.log(`[Chronicle] Syncing ${relay} (hash: ${args.hash})`);
      }
    })().finally(() => {
      this.syncInFlight.delete(relay);
    });

    this.syncInFlight.set(relay, task);
    return task;
  }

  /**
   * Stop syncing Kind 1066 events for a relay
   *
   * @param relay - Relay URL to stop syncing
   */
  async unsyncRelay(relay: string): Promise<void> {
    const hash = this.kind1066Subscriptions.get(relay);
    if (hash) {
      await this.unsubscribe(hash);
      this.kind1066Subscriptions.delete(relay);
      console.log(`[Chronicle] Stopped syncing ${relay}`);
    }
  }

  /**
   * Get time series data for charting
   *
   * Extracts time series data from cached Kind 1066 events.
   * Optionally syncs the relay first if autoSync is enabled.
   *
   * @param options - Time series query options
   * @returns Array of time series points
   */
  async getTimeSeriesData(
    options: TimeSeriesOptions
  ): Promise<TimeSeriesPoint[]> {
    await this.ready();

    // Optionally sync first if autoSync enabled
    if (
      this.options.autoSync &&
      !this.kind1066Subscriptions.has(options.relay)
    ) {
      await this.syncRelay(options.relay, { since: options.since });
      // Wait a moment for events to arrive
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Prefer cached events; fall back to in-memory events captured during sync
    let storage: EventStorage = this.storage;
    let events = await storage.query({
      relay: options.relay,
      since: options.since,
      until: options.until,
    });

    if (events.length === 0) {
      storage = this.getMemoryStorage();
      events = await storage.query({
        relay: options.relay,
        since: options.since,
        until: options.until,
      });
    }

    if (events.length === 0) {
      console.warn(`[Chronicle] No events found for ${options.relay}`);
      return [];
    }

    let timeSeries: TimeSeriesPoint[] = [];

    // Extract appropriate time series based on type
    switch (options.type) {
      case 'rtt':
        timeSeries = await generateRttSeries({
          storage,
          relay: options.relay,
          since: options.since,
          until: options.until,
        });
        break;

      case 'uptime': {
        const uptimeSeries = await generateUptimeSeries({
          storage,
          relay: options.relay,
          since: options.since,
          until: options.until,
        });
        // Convert UptimePoint[] to TimeSeriesPoint[]
        timeSeries = uptimeSeries.map((point) => ({
          timestamp: point.timestamp,
          date: point.date,
          value: point.value === 'online' ? 1 : 0,
        }));
        break;
      }

      default:
        console.warn(`[Chronicle] Unknown time series type: ${options.type}`);
    }

    // TODO: Apply aggregation if specified
    // if (options.aggregate) {
    //   timeSeries = aggregateTimeSeries(
    //     timeSeries,
    //     options.aggregate.bucketSize,
    //     options.aggregate.fn
    //   );
    // }

    return timeSeries;
  }

  /**
   * Get uptime/downtime periods for timeline visualization
   *
   * @param relay - Relay URL
   * @param options - Query options
   * @returns Array of uptime/downtime periods
   */
  async getUptimeHistory(
    relay: string,
    options?: { since?: number; until?: number }
  ): Promise<UptimePeriod[]> {
    await this.ready();

    let periods = await uptimeHistory(this.storage, relay, options);
    if (periods.length === 0) {
      periods = await uptimeHistory(this.getMemoryStorage(), relay, options);
    }

    // Convert to UptimePeriod format
    return periods.map((period) => ({
      start: period.start,
      end: period.end || null,
      online: period.type === 'uptime',
      rtt: undefined, // TODO: Extract RTT from period if available
    }));
  }

  /**
   * Check if a relay is currently being synced
   *
   * @param relay - Relay URL to check
   * @returns True if relay is being synced
   */
  isSyncing(relay: string): boolean {
    return this.kind1066Subscriptions.has(relay);
  }

  /**
   * Get list of currently synced relays
   *
   * @returns Array of relay URLs being synced
   */
  getSyncedRelays(): string[] {
    return Array.from(this.kind1066Subscriptions.keys());
  }

  /**
   * Stop syncing all relays
   */
  async unsyncAll(): Promise<void> {
    const relays = this.getSyncedRelays();
    for (const relay of relays) {
      await this.unsyncRelay(relay);
    }
  }
}
