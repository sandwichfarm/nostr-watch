/**
 * relay-chronicle - Time Series
 *
 * Generate time series data from Kind 1066 delta events for charting and visualization.
 */

import type {
  DeltaEvent,
  EventStorage,
  QueryOptions,
  OperationalStatus,
} from './types.ts';

import {
  parseOperationalStatus,
  parseRttOpen,
  parseRetryCount,
  isRelayOnline,
  parseDeltas,
  separateByNamespace,
  parseValue,
} from './utils.ts';

/**
 * Time series data point (generic)
 */
export interface TimeSeriesPoint<T = any> {
  /** Unix timestamp */
  timestamp: number;
  /** ISO date string (for convenience) */
  date: string;
  /** Data value */
  value: T;
  /** Optional event ID reference */
  eventId?: string;
}

/**
 * Uptime/downtime state
 */
export type UptimeState = 'online' | 'offline' | 'unknown';

/**
 * Uptime time series point
 */
export interface UptimePoint extends TimeSeriesPoint<UptimeState> {
  /** Operational status if it was a transition */
  operationalStatus?: OperationalStatus;
  /** RTT if online */
  rtt?: number;
  /** Retry count if offline */
  retryCount?: number;
}

/**
 * Change event (for timeline visualizations)
 */
export interface ChangeEvent {
  /** Unix timestamp */
  timestamp: number;
  /** ISO date string */
  date: string;
  /** Event ID */
  eventId: string;
  /** Change type */
  type: 'operational' | 'field' | 'infrastructure';
  /** Human-readable description */
  description: string;
  /** Changed fields */
  fields: {
    key: string;
    oldValue?: any;
    newValue: any;
    changeType: 'add' | 'remove' | 'change';
  }[];
}

/**
 * Aggregated statistics for a time bucket
 */
export interface AggregatedStats {
  /** Bucket start timestamp */
  timestamp: number;
  /** ISO date string */
  date: string;
  /** Number of events in this bucket */
  eventCount: number;
  /** Uptime percentage in this bucket */
  uptimePercent: number;
  /** Average RTT in this bucket */
  avgRtt?: number;
  /** Min RTT in this bucket */
  minRtt?: number;
  /** Max RTT in this bucket */
  maxRtt?: number;
  /** Number of state transitions */
  transitionCount: number;
  /** Number of field changes */
  changeCount: number;
}

/**
 * Options for generating time series
 */
export interface TimeSeriesOptions {
  /** Storage implementation */
  storage: EventStorage;
  /** Relay URL */
  relay: string;
  /** Start timestamp */
  since?: number;
  /** End timestamp */
  until?: number;
  /** Only include state transitions */
  statusOnly?: boolean;
  /** Filter by periods */
  periods?: string[];
}

/**
 * Options for aggregating time series data
 */
export interface AggregationOptions extends TimeSeriesOptions {
  /** Bucket size in seconds (e.g., 3600 for hourly buckets) */
  bucketSize: number;
}

/**
 * Generate uptime/downtime time series
 *
 * Returns a series of points showing relay status over time.
 * Suitable for uptime charts, availability heatmaps, etc.
 *
 * @example
 * ```typescript
 * const series = await generateUptimeSeries({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 86400 * 7, // Last 7 days
 * });
 *
 * // Use with Chart.js
 * new Chart(ctx, {
 *   type: 'line',
 *   data: {
 *     labels: series.map(p => p.date),
 *     datasets: [{
 *       data: series.map(p => p.value === 'online' ? 1 : 0),
 *     }]
 *   }
 * });
 * ```
 */
export async function generateUptimeSeries(
  options: TimeSeriesOptions
): Promise<UptimePoint[]> {
  const events = await options.storage.query({
    relay: options.relay,
    since: options.since,
    until: options.until,
    statusOnly: options.statusOnly,
    periods: options.periods,
  });

  const series: UptimePoint[] = [];

  for (const event of events) {
    const online = isRelayOnline(event);
    const operationalStatus = parseOperationalStatus(event);
    const rtt = parseRttOpen(event);
    const retryCount = parseRetryCount(event);

    series.push({
      timestamp: event.created_at,
      date: new Date(event.created_at * 1000).toISOString(),
      value: online ? 'online' : 'offline',
      operationalStatus,
      rtt,
      retryCount,
      eventId: event.id,
    });
  }

  return series;
}

/**
 * Generate RTT (latency) time series
 *
 * Returns RTT measurements over time for performance monitoring.
 *
 * @example
 * ```typescript
 * const series = await generateRttSeries({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 86400, // Last 24 hours
 * });
 *
 * // Use with Chart.js
 * new Chart(ctx, {
 *   type: 'line',
 *   data: {
 *     labels: series.map(p => p.date),
 *     datasets: [{
 *       label: 'RTT (ms)',
 *       data: series.map(p => p.value),
 *     }]
 *   }
 * });
 * ```
 */
export async function generateRttSeries(
  options: TimeSeriesOptions
): Promise<TimeSeriesPoint<number>[]> {
  const events = await options.storage.query({
    relay: options.relay,
    since: options.since,
    until: options.until,
    periods: options.periods,
  });

  const series: TimeSeriesPoint<number>[] = [];

  for (const event of events) {
    const rtt = parseRttOpen(event);
    if (rtt !== undefined) {
      series.push({
        timestamp: event.created_at,
        date: new Date(event.created_at * 1000).toISOString(),
        value: rtt,
        eventId: event.id,
      });
    }
  }

  return series;
}

/**
 * Generate change events timeline
 *
 * Returns a timeline of significant changes (software updates, config changes, etc.)
 * Suitable for event timelines, annotation markers on charts, etc.
 *
 * @example
 * ```typescript
 * const timeline = await generateChangeTimeline({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 2592000, // Last 30 days
 * });
 *
 * // Display as timeline
 * timeline.forEach(event => {
 *   console.log(`${event.date}: ${event.description}`);
 *   event.fields.forEach(f => {
 *     console.log(`  - ${f.key}: ${f.oldValue} → ${f.newValue}`);
 *   });
 * });
 * ```
 */
export async function generateChangeTimeline(
  options: TimeSeriesOptions
): Promise<ChangeEvent[]> {
  const events = await options.storage.query({
    relay: options.relay,
    since: options.since,
    until: options.until,
    periods: options.periods,
  });

  const timeline: ChangeEvent[] = [];

  for (const event of events) {
    const deltas = parseDeltas(event);
    const { info, dns, geo } = separateByNamespace(deltas);
    const operationalStatus = parseOperationalStatus(event);

    // Skip if no deltas and no operational status change
    if (deltas.length === 0 && !operationalStatus) continue;

    // Determine change type
    let type: ChangeEvent['type'] = 'field';
    if (operationalStatus) {
      type = 'operational';
    } else if (dns.length > 0 || geo.length > 0) {
      type = 'infrastructure';
    }

    // Build description
    let description = '';
    if (operationalStatus === 'init') {
      description = 'First detection - Relay came online';
    } else if (operationalStatus === 'down') {
      description = 'Relay went offline';
    } else if (operationalStatus === 'up') {
      description = 'Relay came online (recovered)';
    } else if (info.some(d => d.key === 'software' || d.key === 'version')) {
      const software = info.find(d => d.key === 'software');
      const version = info.find(d => d.key === 'version');
      if (software && version) {
        description = `Software updated to ${software.value} ${version.value}`;
      } else if (version) {
        description = `Version updated to ${version.value}`;
      } else if (software) {
        description = `Software changed to ${software.value}`;
      }
    } else if (dns.length > 0) {
      const asnChange = dns.find(d => d.key === 'asn');
      const ipChange = dns.find(d => d.key === 'address');
      if (asnChange) {
        description = `Infrastructure changed (ASN: ${asnChange.value})`;
      } else if (ipChange) {
        description = `IP address changed to ${ipChange.value}`;
      } else {
        description = 'DNS configuration changed';
      }
    } else if (geo.length > 0) {
      const cityChange = geo.find(d => d.key === 'city');
      const countryChange = geo.find(d => d.key === 'country');
      if (cityChange || countryChange) {
        description = `Location changed to ${cityChange?.value || '?'}, ${countryChange?.value || '?'}`;
      } else {
        description = 'Geographic data changed';
      }
    } else {
      description = `${deltas.length} field(s) changed`;
    }

    // Build fields array
    const fields = deltas.map(delta => ({
      key: delta.key,
      newValue: parseValue(delta.value),
      changeType: delta.type,
    }));

    timeline.push({
      timestamp: event.created_at,
      date: new Date(event.created_at * 1000).toISOString(),
      eventId: event.id,
      type,
      description,
      fields,
    });
  }

  return timeline;
}

/**
 * Generate aggregated time series
 *
 * Aggregates events into time buckets with statistics.
 * Suitable for overview charts, long-term trends, etc.
 *
 * @example
 * ```typescript
 * const series = await generateAggregatedSeries({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 2592000, // Last 30 days
 *   bucketSize: 86400, // Daily buckets
 * });
 *
 * // Use with Chart.js
 * new Chart(ctx, {
 *   type: 'bar',
 *   data: {
 *     labels: series.map(p => p.date.split('T')[0]),
 *     datasets: [
 *       {
 *         label: 'Uptime %',
 *         data: series.map(p => p.uptimePercent),
 *       },
 *       {
 *         label: 'Avg RTT (ms)',
 *         data: series.map(p => p.avgRtt),
 *       }
 *     ]
 *   }
 * });
 * ```
 */
export async function generateAggregatedSeries(
  options: AggregationOptions
): Promise<AggregatedStats[]> {
  const events = await options.storage.query({
    relay: options.relay,
    since: options.since,
    until: options.until,
    periods: options.periods,
  });

  if (events.length === 0) return [];

  const { bucketSize } = options;
  const buckets = new Map<number, {
    events: DeltaEvent[];
    uptimeMs: number;
    downtimeMs: number;
    rtts: number[];
    transitionCount: number;
    changeCount: number;
    lastState: 'online' | 'offline' | null;
    lastTimestamp: number;
  }>();

  // Calculate bucket key for a timestamp
  const getBucketKey = (timestamp: number) => Math.floor(timestamp / bucketSize) * bucketSize;

  // Initialize buckets
  const startBucket = options.since ? getBucketKey(options.since) : getBucketKey(events[0].created_at);
  const endBucket = options.until ? getBucketKey(options.until) : getBucketKey(events[events.length - 1].created_at);

  for (let bucket = startBucket; bucket <= endBucket; bucket += bucketSize) {
    buckets.set(bucket, {
      events: [],
      uptimeMs: 0,
      downtimeMs: 0,
      rtts: [],
      transitionCount: 0,
      changeCount: 0,
      lastState: null,
      lastTimestamp: bucket,
    });
  }

  // Process events into buckets
  let currentState: 'online' | 'offline' | null = null;
  let stateStartTime: number | null = null;

  for (const event of events) {
    const bucketKey = getBucketKey(event.created_at);
    const bucket = buckets.get(bucketKey);
    if (!bucket) continue;

    bucket.events.push(event);

    const online = isRelayOnline(event);
    const operationalStatus = parseOperationalStatus(event);
    const rtt = parseRttOpen(event);
    const deltas = parseDeltas(event);

    // Track RTT
    if (rtt !== undefined) {
      bucket.rtts.push(rtt);
    }

    // Track transitions
    if (operationalStatus) {
      bucket.transitionCount++;
    }

    // Track changes
    bucket.changeCount += deltas.length;

    // Calculate uptime/downtime
    const newState = online ? 'online' : 'offline';

    if (currentState !== null && stateStartTime !== null) {
      const duration = (event.created_at - stateStartTime) * 1000;

      // Distribute time across buckets
      const startBucketKey = getBucketKey(stateStartTime);
      const endBucketKey = getBucketKey(event.created_at);

      if (startBucketKey === endBucketKey) {
        // Same bucket
        const b = buckets.get(startBucketKey);
        if (b) {
          if (currentState === 'online') {
            b.uptimeMs += duration;
          } else {
            b.downtimeMs += duration;
          }
        }
      } else {
        // Spans multiple buckets - distribute proportionally
        let remaining = duration;
        for (let bk = startBucketKey; bk <= endBucketKey; bk += bucketSize) {
          const b = buckets.get(bk);
          if (!b) continue;

          const bucketStart = bk;
          const bucketEnd = bk + bucketSize;
          const segmentStart = Math.max(stateStartTime, bucketStart);
          const segmentEnd = Math.min(event.created_at, bucketEnd);
          const segmentDuration = (segmentEnd - segmentStart) * 1000;

          if (segmentDuration > 0) {
            if (currentState === 'online') {
              b.uptimeMs += segmentDuration;
            } else {
              b.downtimeMs += segmentDuration;
            }
          }
        }
      }
    }

    currentState = newState;
    stateStartTime = event.created_at;
  }

  // Handle final state extending to end of time range
  if (currentState !== null && stateStartTime !== null && options.until) {
    const duration = (options.until - stateStartTime) * 1000;
    const startBucketKey = getBucketKey(stateStartTime);
    const endBucketKey = getBucketKey(options.until);

    for (let bk = startBucketKey; bk <= endBucketKey; bk += bucketSize) {
      const b = buckets.get(bk);
      if (!b) continue;

      const bucketStart = bk;
      const bucketEnd = bk + bucketSize;
      const segmentStart = Math.max(stateStartTime, bucketStart);
      const segmentEnd = Math.min(options.until, bucketEnd);
      const segmentDuration = (segmentEnd - segmentStart) * 1000;

      if (segmentDuration > 0) {
        if (currentState === 'online') {
          b.uptimeMs += segmentDuration;
        } else {
          b.downtimeMs += segmentDuration;
        }
      }
    }
  }

  // Convert buckets to aggregated stats
  const series: AggregatedStats[] = [];

  for (const [bucketKey, bucket] of buckets) {
    const totalMs = bucket.uptimeMs + bucket.downtimeMs;
    const uptimePercent = totalMs > 0 ? (bucket.uptimeMs / totalMs) * 100 : 0;

    const avgRtt = bucket.rtts.length > 0
      ? bucket.rtts.reduce((a, b) => a + b, 0) / bucket.rtts.length
      : undefined;

    const minRtt = bucket.rtts.length > 0
      ? Math.min(...bucket.rtts)
      : undefined;

    const maxRtt = bucket.rtts.length > 0
      ? Math.max(...bucket.rtts)
      : undefined;

    series.push({
      timestamp: bucketKey,
      date: new Date(bucketKey * 1000).toISOString(),
      eventCount: bucket.events.length,
      uptimePercent,
      avgRtt,
      minRtt,
      maxRtt,
      transitionCount: bucket.transitionCount,
      changeCount: bucket.changeCount,
    });
  }

  return series;
}

/**
 * Track a specific field value over time
 *
 * Returns the value of a specific field over time.
 * Useful for tracking software version, supported NIPs, config values, etc.
 *
 * @param field - Field to track (dot notation, e.g., "software", "dns.asn", "geo.city")
 *
 * @example
 * ```typescript
 * // Track software version over time
 * const series = await generateFieldSeries({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 2592000, // Last 30 days
 * }, 'version');
 *
 * // Track ASN changes
 * const asnSeries = await generateFieldSeries({
 *   storage,
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 2592000,
 * }, 'dns.asn');
 * ```
 */
export async function generateFieldSeries(
  options: TimeSeriesOptions,
  field: string
): Promise<TimeSeriesPoint<any>[]> {
  const events = await options.storage.query({
    relay: options.relay,
    since: options.since,
    until: options.until,
    periods: options.periods,
  });

  const series: TimeSeriesPoint<any>[] = [];
  let currentValue: any = undefined;

  for (const event of events) {
    const deltas = parseDeltas(event);

    for (const delta of deltas) {
      if (delta.key === field) {
        const newValue = parseValue(delta.value);

        if (delta.type === 'remove') {
          currentValue = undefined;
        } else {
          currentValue = newValue;
        }

        series.push({
          timestamp: event.created_at,
          date: new Date(event.created_at * 1000).toISOString(),
          value: currentValue,
          eventId: event.id,
        });
      }
    }
  }

  return series;
}
