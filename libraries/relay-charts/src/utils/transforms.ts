/**
 * Utility functions for transforming relay-chronicle data into chart-ready formats
 */

import type {
  TimeSeriesPoint,
  UptimePeriod,
  StateChange,
} from '../types/index.ts';

/**
 * Transform uptime history into timeline periods
 */
export function transformUptimeHistory(
  periods: Array<{ start: number; end: number | null; online: boolean; rtt?: number }>
): UptimePeriod[] {
  return periods.map(p => ({
    start: p.start,
    end: p.end,
    online: p.online,
    rtt: p.rtt,
  }));
}

/**
 * Transform change history into time series points
 */
export function transformChangeHistory(
  changes: Array<{ timestamp: number; from: any; to: any; field: string }>,
  valueField: 'from' | 'to' = 'to'
): TimeSeriesPoint[] {
  return changes.map(change => ({
    timestamp: change.timestamp,
    value: change[valueField],
    label: change.field,
  }));
}

/**
 * Transform change history into state change events
 */
export function transformStateChanges(
  changes: Array<{ timestamp: number; from: any; to: any; field: string }>
): StateChange[] {
  return changes.map(change => ({
    timestamp: change.timestamp,
    from: change.from,
    to: change.to,
    field: change.field,
  }));
}

/**
 * Extract RTT values from uptime periods as time series
 */
export function extractRttTimeSeries(
  periods: UptimePeriod[]
): TimeSeriesPoint[] {
  return periods
    .filter(p => p.online && p.rtt !== undefined)
    .map(p => ({
      timestamp: p.start,
      value: p.rtt!,
      label: 'RTT (ms)',
    }));
}

/**
 * Calculate uptime percentage over periods
 */
export function calculateUptimePercentage(
  periods: UptimePeriod[],
  timeRange?: { start: number; end: number }
): number {
  const start = timeRange?.start ?? Math.min(...periods.map(p => p.start));
  const end = timeRange?.end ?? Date.now() / 1000;
  const totalTime = end - start;

  let uptimeSeconds = 0;

  for (const period of periods) {
    if (!period.online) continue;

    const periodStart = Math.max(period.start, start);
    const periodEnd = Math.min(period.end ?? end, end);

    if (periodEnd > periodStart) {
      uptimeSeconds += periodEnd - periodStart;
    }
  }

  return totalTime > 0 ? (uptimeSeconds / totalTime) * 100 : 0;
}

/**
 * Aggregate time series data into buckets
 */
export function aggregateTimeSeries(
  points: TimeSeriesPoint[],
  bucketSize: number, // seconds
  aggregationFn: 'avg' | 'min' | 'max' | 'sum' = 'avg'
): TimeSeriesPoint[] {
  if (points.length === 0) return [];

  const buckets = new Map<number, number[]>();

  // Group points into buckets
  for (const point of points) {
    const bucketTimestamp = Math.floor(point.timestamp / bucketSize) * bucketSize;
    const value = typeof point.value === 'number' ? point.value : 0;

    if (!buckets.has(bucketTimestamp)) {
      buckets.set(bucketTimestamp, []);
    }
    buckets.get(bucketTimestamp)!.push(value);
  }

  // Aggregate each bucket
  const result: TimeSeriesPoint[] = [];
  for (const [timestamp, values] of buckets) {
    let aggregatedValue: number;

    switch (aggregationFn) {
      case 'avg':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
    }

    result.push({
      timestamp,
      value: aggregatedValue,
      label: points[0]?.label,
    });
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Filter time series by time range
 */
export function filterByTimeRange(
  points: TimeSeriesPoint[],
  start?: number,
  end?: number
): TimeSeriesPoint[] {
  return points.filter(p => {
    if (start !== undefined && p.timestamp < start) return false;
    if (end !== undefined && p.timestamp > end) return false;
    return true;
  });
}

/**
 * Convert timestamp to formatted date string
 */
export function formatTimestamp(
  timestamp: number,
  format: 'date' | 'datetime' | 'time' = 'datetime'
): string {
  const date = new Date(timestamp * 1000);

  switch (format) {
    case 'date':
      return date.toLocaleDateString();
    case 'time':
      return date.toLocaleTimeString();
    case 'datetime':
    default:
      return date.toLocaleString();
  }
}
