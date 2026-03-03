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
  private memoryBoundsByRelay: Map<string, { min: number; max: number }> = new Map();
  private options: ChronicleServiceOptions;
  private kind1066Subscriptions: Map<string, string> = new Map();
  private syncInFlight: Map<string, Promise<void>> = new Map();
  private desiredSinceByRelay: Map<string, number | undefined> = new Map();

  private aggregateTimeSeries(
    points: TimeSeriesPoint[],
    bucketSize: number,
    fn: 'avg' | 'min' | 'max' | 'sum'
  ): TimeSeriesPoint[] {
    if (!Array.isArray(points) || points.length === 0) return [];
    if (!Number.isFinite(bucketSize) || bucketSize <= 0) return points;

    const buckets = new Map<number, { values: number[]; eventId?: string }>();

    for (const point of points) {
      const timestamp = point?.timestamp;
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;

      const bucketTimestamp = Math.floor(timestamp / bucketSize) * bucketSize;

      const raw = (point as any)?.value;
      const value =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'boolean'
            ? raw
              ? 1
              : 0
            : null;
      if (value == null || !Number.isFinite(value)) continue;

      const bucket = buckets.get(bucketTimestamp) ?? { values: [] as number[] };
      bucket.values.push(value);
      if ((point as any)?.eventId) bucket.eventId = (point as any).eventId;
      buckets.set(bucketTimestamp, bucket);
    }

    const aggregated: TimeSeriesPoint[] = [];
    buckets.forEach((bucket, timestamp) => {
      const values = bucket.values;
      if (!values.length) return;

      let aggregatedValue = 0;
      switch (fn) {
        case 'avg':
          aggregatedValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'sum':
          aggregatedValue = values.reduce((a: number, b: number) => a + b, 0);
          break;
      }

      aggregated.push({
        timestamp,
        date: new Date(timestamp * 1000).toISOString(),
        value: aggregatedValue,
        ...(bucket.eventId ? { eventId: bucket.eventId } : {}),
      } as any);
    });

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  private normalizeRelayKey(relay: string): string {
    const trimmed = (relay || '').trim();
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/, '');
  }

  private normalizeSince(since?: number): number | undefined {
    if (typeof since !== 'number') return undefined;
    if (!Number.isFinite(since)) return undefined;
    return since;
  }

  private relayTagValues(relay: string): string[] {
    const trimmed = (relay || '').trim();
    if (!trimmed) return [];
    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
    const withTrailingSlash = `${withoutTrailingSlash}/`;
    return Array.from(new Set([trimmed, withoutTrailingSlash, withTrailingSlash]));
  }

  /**
   * Values to use for *remote* `#r` filtering.
   *
   * Some relays (notably `wss://relay.nostr.watch`) appear to mishandle multiple values
   * within a single `#r: [...]` array. To remain compatible, we query each candidate
   * as a separate filter/request.
   */
  private relayTagQueryValues(relay: string): string[] {
    const trimmed = (relay || '').trim();
    if (!trimmed) return [];
    const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
    if (!withoutTrailingSlash) return [];
    const withTrailingSlash = `${withoutTrailingSlash}/`;
    return Array.from(new Set([withoutTrailingSlash, withTrailingSlash]));
  }

  private updateMemoryBounds(relayKey: string, createdAt: number): void {
    if (!Number.isFinite(createdAt)) return;
    const existing = this.memoryBoundsByRelay.get(relayKey);
    if (!existing) {
      this.memoryBoundsByRelay.set(relayKey, { min: createdAt, max: createdAt });
      return;
    }
    if (createdAt < existing.min) existing.min = createdAt;
    if (createdAt > existing.max) existing.max = createdAt;
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

  private extractRelayKeyFromEvent(event: unknown): string | null {
    const ev = event as any;
    if (!ev || ev.kind !== 1066) return null;
    const rTag = Array.isArray(ev.tags) ? ev.tags.find((t: any[]) => t?.[0] === 'r')?.[1] : undefined;
    if (typeof rTag !== 'string' || !rTag) return null;
    return this.normalizeRelayKey(rTag);
  }

  private rememberEvent(event: unknown, relayKey: string): void {
    const ev = event as any;
    if (!ev || ev.kind !== 1066 || typeof ev.id !== 'string') return;
    if (typeof ev.created_at === 'number') {
      this.updateMemoryBounds(relayKey, ev.created_at);
    }

    let relayMap = this.memoryByRelay.get(relayKey);
    if (!relayMap) {
      relayMap = new Map<string, IDeltaEvent>();
      this.memoryByRelay.set(relayKey, relayMap);
    }

    // Store the raw event - it should already have the correct DeltaEvent structure
    // Validate it's a proper Kind 1066 event before storing
    if (DeltaEvent.KIND === ev.kind) {
      relayMap.set(ev.id, ev as IDeltaEvent);
    }
  }

  private async backfillKind1066ForRelayTag(
    relayKey: string,
    relayTagValue: string,
    options?: { since?: number; until?: number }
  ): Promise<void> {
    const PAGE_LIMIT = 5000;
    const MAX_PAGES = 250; // safety guard for pathological relays/ranges

    const targetSince = this.normalizeSince(options?.since);
    let cursorUntil = this.normalizeSince(options?.until) ?? Math.floor(Date.now() / 1000);

    let pages = 0;
    let lastOldest: number | undefined;

    while (pages < MAX_PAGES) {
      const filter: Filter = {
        kinds: [1066],
        '#r': [relayTagValue],
        until: cursorUntil,
        limit: PAGE_LIMIT,
      };
      if (typeof targetSince === 'number') filter.since = targetSince;

      const args: WebsocketRequestBody = {
        filters: [filter],
        relays: this.options.syncRelays,
        hash: deterministicHash([filter]),
        options: {
          cache: false,
          stream: false,
          keepAlive: false,
          returnResults: true,
        },
      };

      let events: unknown[] = [];
      try {
        const res = await this.fetchFromWebsocket(args);
        events = Array.isArray(res) ? res : [];
      } catch (err) {
        console.warn(`[Chronicle] Fetch error for ${relayTagValue}:`, err);
        return;
      }

      if (!events.length) return;

      let oldest: number | undefined;
      for (const event of events) {
        const ev = event as any;
        if (!ev || ev.kind !== 1066) continue;
        if (this.extractRelayKeyFromEvent(ev) !== relayKey) continue;
        if (typeof ev.created_at === 'number') {
          if (oldest === undefined || ev.created_at < oldest) oldest = ev.created_at;
        }
        this.rememberEvent(ev, relayKey);
      }

      // If we didn't see any matching events in this page, bail (either relay has no data,
      // or the remote relay isn't returning the expected tag variant).
      if (oldest === undefined) return;

      if (typeof targetSince === 'number' && oldest <= targetSince) return;

      // If we got fewer than the page limit, we likely exhausted history for this tag/range.
      if (events.length < PAGE_LIMIT) return;

      // Safety: avoid infinite loops if server keeps returning the same oldest timestamp.
      if (oldest === lastOldest) return;
      lastOldest = oldest;

      // Page backwards in time.
      const nextUntil = oldest - 1;
      if (!Number.isFinite(nextUntil) || nextUntil <= 0) return;
      if (nextUntil >= cursorUntil) return;
      cursorUntil = nextUntil;
      pages += 1;
    }
  }

  private async backfillKind1066ForRelay(
    relay: string,
    relayKey: string,
    options?: { since?: number; until?: number }
  ): Promise<void> {
    const targetSince = this.normalizeSince(options?.since);
    const bounds = this.memoryBoundsByRelay.get(relayKey);
    if (
      typeof targetSince === 'number' &&
      bounds &&
      Number.isFinite(bounds.min) &&
      bounds.min <= targetSince
    ) {
      return;
    }

    const tagValues = this.relayTagQueryValues(relay);
    for (const tagValue of tagValues) {
      await this.backfillKind1066ForRelayTag(relayKey, tagValue, options);
    }
  }

  private getMemoryStorage(): EventStorage {
    const memoryByRelay = this.memoryByRelay;
    const relayTagValues = this.relayTagValues.bind(this);
    const normalizeRelayKey = this.normalizeRelayKey.bind(this);

    return {
      async query(options: QueryOptions): Promise<IDeltaEvent[]> {
        const relayKeys = relayTagValues(options.relay);
        const relayMaps = relayKeys
          .map((key) => memoryByRelay.get(normalizeRelayKey(key)))
          .filter((m): m is Map<string, IDeltaEvent> => Boolean(m && m.size));

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
            e.tags.some((t: any[]) => (t?.[0] === 'status' || t?.[0] === 'O') && (t?.[1] === 'init' || t?.[1] === 'up' || t?.[1] === 'down'))
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
    const relayKey = this.normalizeRelayKey(relay);

    const requestedSince = this.normalizeSince(options?.since);
    const prevDesiredSince = this.desiredSinceByRelay.get(relayKey);
    const desiredSince =
      requestedSince === undefined
        ? prevDesiredSince
        : prevDesiredSince === undefined
          ? requestedSince
          : Math.min(prevDesiredSince, requestedSince);
    this.desiredSinceByRelay.set(relayKey, desiredSince);

    const existing = this.syncInFlight.get(relayKey);
    if (existing) {
      // If another sync is already in-flight, wait for it, then re-evaluate whether we
      // still need to start/extend syncing (e.g. the requested `since` expanded).
      await existing;
    }

    const effectiveSince = this.desiredSinceByRelay.get(relayKey);
    const bounds = this.memoryBoundsByRelay.get(relayKey);
    const needsBackfill =
      typeof effectiveSince === 'number'
        ? !bounds || !Number.isFinite(bounds.min) || bounds.min > effectiveSince
        : false;
    const needsLiveSubscription = keepAlive && !this.kind1066Subscriptions.has(relayKey);

    const inFlightNow = this.syncInFlight.get(relayKey);
    if (inFlightNow) return inFlightNow;
    if (!needsBackfill && !needsLiveSubscription) return;

    const task = (async () => {
      if (keepAlive) {
        // Start a lightweight live subscription for new deltas. Historical ranges are fetched
        // explicitly via backfill to avoid relay `limit` caps truncating initial results.
        if (!this.kind1066Subscriptions.has(relayKey)) {
          const liveSince = Math.floor(Date.now() / 1000) - 60;
          const tagValues = this.relayTagQueryValues(relay);

          const filters: Filter[] = tagValues.map((tagValue) => ({
            kinds: [1066],
            '#r': [tagValue],
            since: liveSince,
          }));

          const hash = deterministicHash({ kind: 1066, relay: relayKey, tagValues });

          const args: WebsocketRequestBody = {
            filters,
            relays: this.options.syncRelays,
            hash,
            options: {
              cache: false,
              stream: true,
              keepAlive: true,
              returnResults: true,
            },
          };

          const callbacks: SubscribeHandlers = {
            onevent: (event) => {
              const eventRelayKey = this.extractRelayKeyFromEvent(event);
              if (!eventRelayKey || eventRelayKey !== relayKey) return;
              this.rememberEvent(event, relayKey);
            },
          };

          this.subscribe(args, callbacks, true).catch((err) => {
            console.warn(`[Chronicle] Subscribe error for ${relay}:`, err);
          });

          this.kind1066Subscriptions.set(relayKey, hash);
        }
      }

      // Always backfill the requested history window into memory so charts don't hydrate
      // from partial data.
      if (needsBackfill) {
        await this.backfillKind1066ForRelay(relay, relayKey, { since: effectiveSince });
      }
    })().finally(() => {
      this.syncInFlight.delete(relayKey);
    });

    this.syncInFlight.set(relayKey, task);
    return task;
  }

  /**
   * Stop syncing Kind 1066 events for a relay
   *
   * @param relay - Relay URL to stop syncing
   */
  async unsyncRelay(relay: string): Promise<void> {
    const relayKey = this.normalizeRelayKey(relay);
    const hash = this.kind1066Subscriptions.get(relayKey);
    this.desiredSinceByRelay.delete(relayKey);
    this.memoryByRelay.delete(relayKey);
    this.memoryBoundsByRelay.delete(relayKey);
    if (hash) {
      this.kind1066Subscriptions.delete(relayKey);
      await this.unsubscribe(hash);
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
      !this.kind1066Subscriptions.has(this.normalizeRelayKey(options.relay))
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

    // Apply aggregation if specified
    if (options.aggregate) {
      timeSeries = this.aggregateTimeSeries(
        timeSeries,
        options.aggregate.bucketSize,
        options.aggregate.fn
      );
    }

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

    // Convert to UptimePeriod format
    return periods.map((period) => ({
      start: period.start,
      end: period.end || null,
      online: period.type === 'uptime',
      rtt: undefined, // TODO: Extract RTT from period if available
    }));
  }

  /**
   * Get raw Kind 1066 delta events for a relay
   *
   * Queries memory first (events captured during sync), then falls back to cache storage.
   * Optionally syncs the relay first if autoSync is enabled.
   */
  async getDeltaEvents(options: QueryOptions): Promise<IDeltaEvent[]> {
    await this.ready();

    if (this.options.autoSync && !this.kind1066Subscriptions.has(this.normalizeRelayKey(options.relay))) {
      await this.syncRelay(options.relay, { since: options.since });
    }

    const memoryStorage = this.getMemoryStorage();
    let events = await memoryStorage.query(options);

    if (events.length === 0) {
      events = await this.storage.query(options);
    }

    return events;
  }

  /**
   * Check if a relay is currently being synced
   *
   * @param relay - Relay URL to check
   * @returns True if relay is being synced
   */
  isSyncing(relay: string): boolean {
    return this.kind1066Subscriptions.has(this.normalizeRelayKey(relay));
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
