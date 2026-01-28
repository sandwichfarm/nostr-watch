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
  DeltaEvent as IDeltaEvent,
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
import { DeltaEvent } from '@base/models';

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
  private memoryByRelay: Map<string, Map<string, IDeltaEvent>> = new Map();
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
      relayMap = new Map<string, IDeltaEvent>();
      this.memoryByRelay.set(relayKey, relayMap);
    }

    // Store the raw event - it should already have the correct DeltaEvent structure
    // Validate it's a proper Kind 1066 event before storing
    if (DeltaEvent.KIND === ev.kind) {
      relayMap.set(ev.id, ev as IDeltaEvent);
      console.log(`[Chronicle] Stored event ${ev.id?.slice(0, 8)} for ${relayKey}, map size: ${relayMap.size}`);
    }
  }

  private getMemoryStorage(): EventStorage {
    const memoryByRelay = this.memoryByRelay;
    const relayTagValues = this.relayTagValues.bind(this);
    const normalizeRelayKey = this.normalizeRelayKey.bind(this);

    return {
      async query(options: QueryOptions): Promise<IDeltaEvent[]> {
        const relayKeys = relayTagValues(options.relay);
        console.log(`[Chronicle] Memory query for relay: ${options.relay}, keys: ${JSON.stringify(relayKeys)}`);
        console.log(`[Chronicle] memoryByRelay has ${memoryByRelay.size} entries:`, Array.from(memoryByRelay.keys()));
        const relayMaps = relayKeys
          .map((key) => memoryByRelay.get(normalizeRelayKey(key)))
          .filter((m): m is Map<string, IDeltaEvent> => Boolean(m && m.size));

        console.log(`[Chronicle] Found ${relayMaps.length} matching maps`);
        if (relayMaps.length === 0) return [];

        const byId = new Map<string, IDeltaEvent>();
        for (const relayMap of relayMaps) {
          relayMap.forEach((ev, id) => byId.set(id, ev));
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

        console.log(`[Chronicle] Memory query returning ${events.length} events`);
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

      // Build filter for Kind 1066 delta events
      // Note: Don't use 'since' filter - relays may not index Kind 1066 by time properly
      const filter: Filter = {
        kinds: [1066],
        '#r': relayValues,
      };

      const filters: Filter[] = [filter];

      console.log(`[Chronicle] syncRelay starting for ${relay}, keepAlive=${keepAlive}`);
      console.log(`[Chronicle] Filter #r values:`, relayValues);
      console.log(`[Chronicle] Sync relays:`, this.options.syncRelays);
      console.log(`[Chronicle] Full filters:`, JSON.stringify(filters));

      let eventCount = 0;

      if (keepAlive) {
        // Use subscribe for live streaming updates
        const args: WebsocketRequestBody = {
          filters,
          relays: this.options.syncRelays,
          hash: deterministicHash(filters),
          options: {
            cache: true,
            stream: true,
            keepAlive: true,
            returnResults: true,
          },
        };

        const callbacks: SubscribeHandlers = {
          onevent: (event) => {
            this.rememberEvent(relay, event);
            eventCount++;
            console.log(`[Chronicle] Received Kind 1066 for ${relay}`, (event as any).id?.slice(0, 8));
          },
          oneose: () => {
            console.log(`[Chronicle] EOSE for ${relay} (${eventCount} events)`);
          },
        };

        // Subscribe for live updates - don't await since it's keepAlive
        this.subscribe(args, callbacks, false).catch((err) => {
          console.warn(`[Chronicle] Subscribe error for ${relay}:`, err);
        });

        this.kind1066Subscriptions.set(relay, args.hash!);
        console.log(`[Chronicle] Syncing ${relay} (hash: ${args.hash})`);
      } else {
        // Use fetch for one-shot queries - this is more reliable than subscribe
        const args: WebsocketRequestBody = {
          filters,
          relays: this.options.syncRelays,
          hash: deterministicHash(filters),
          options: {
            cache: false,
            stream: false,
            keepAlive: false,
            returnResults: true,
          },
        };

        // Use fetch() for one-shot queries - uses fetcher.allEventsIterator internally
        // which is more reliable than pool.subscribeMany for single queries
        console.log(`[Chronicle] Using fetch() for one-shot query`);
        console.log(`[Chronicle] Fetch args:`, JSON.stringify({
          filters: args.filters,
          relays: args.relays,
          options: args.options,
        }));
        try {
          const events = await this.fetch(args);
          console.log(`[Chronicle] Fetch returned:`, Array.isArray(events) ? `${events.length} events` : typeof events);
          if (Array.isArray(events)) {
            for (const event of events) {
              const ev = event as any;
              console.log(`[Chronicle] Processing event: kind=${ev.kind}, id=${ev.id?.slice(0, 8)}`);
              this.rememberEvent(relay, event);
              eventCount++;
            }
          }
        } catch (err) {
          console.warn(`[Chronicle] Fetch error for ${relay}:`, err);
        }

        console.log(`[Chronicle] Sync complete for ${relay} (${eventCount} events in memory)`);
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
   * Extracts time series data from Kind 1066 events.
   * Queries memory first (events captured during sync), then falls back to cache.
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
    }

    // Query memory FIRST (events captured during sync), then fall back to cache
    const memoryStorage = this.getMemoryStorage();
    let storage: EventStorage = memoryStorage;
    let events = await memoryStorage.query({
      relay: options.relay,
      since: options.since,
      until: options.until,
    });

    // Fall back to cache storage if memory is empty
    if (events.length === 0) {
      storage = this.storage;
      events = await this.storage.query({
        relay: options.relay,
        since: options.since,
        until: options.until,
      });
    }

    if (events.length === 0) {
      console.warn(`[Chronicle] No events found for ${options.relay}`);
      return [];
    }

    console.log(`[Chronicle] Found ${events.length} events for ${options.relay} time series`);

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
   * Queries memory first (events captured during sync), then falls back to cache.
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

    // Query memory FIRST, then fall back to cache
    const memoryStorage = this.getMemoryStorage();
    let periods = await uptimeHistory(memoryStorage, relay, options);

    if (periods.length === 0) {
      periods = await uptimeHistory(this.storage, relay, options);
    }

    console.log(`[Chronicle] Found ${periods.length} uptime periods for ${relay}`);

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
