import { getLogger } from "../utils/logger.ts";

const logger = getLogger("PeriodCalculator");

/**
 * Parse a period string (e.g., "6h", "1d", "7d", "30d") to milliseconds
 * @param period Period string
 * @returns Milliseconds
 */
export function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)(h|d|w|m)$/);
  if (!match) {
    throw new Error(`Invalid period format: ${period}. Expected format: <number><unit> (e.g., "6h", "1d", "7d")`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'h': // hours
      return value * 60 * 60 * 1000;
    case 'd': // days
      return value * 24 * 60 * 60 * 1000;
    case 'w': // weeks
      return value * 7 * 24 * 60 * 60 * 1000;
    case 'm': // months (approximate as 30 days)
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown period unit: ${unit}`);
  }
}

/**
 * Check if a period is a clean multiple of the check interval
 * @param periodMs Period in milliseconds
 * @param checkIntervalMs Check interval in milliseconds
 * @returns true if clean multiple
 */
export function isCleanMultiple(periodMs: number, checkIntervalMs: number): boolean {
  return periodMs % checkIntervalMs === 0;
}

/**
 * Calculate how many checks should elapse before emitting this period
 * @param periodMs Period in milliseconds
 * @param checkIntervalMs Check interval in milliseconds
 * @returns Number of checks between emissions
 */
export function getChecksPerPeriod(periodMs: number, checkIntervalMs: number): number {
  return Math.round(periodMs / checkIntervalMs);
}

/**
 * Determine if it's time to emit a period aggregate
 * @param periodMs Period in milliseconds
 * @param checkIntervalMs Check interval in milliseconds
 * @param lastSnapshotAt Unix timestamp of last snapshot (0 if never)
 * @param nowTs Current Unix timestamp
 * @returns true if should emit
 */
export function shouldEmitPeriod(
  periodMs: number,
  checkIntervalMs: number,
  lastSnapshotAt: number,
  nowTs: number
): boolean {
  // If never emitted, emit now
  if (lastSnapshotAt === 0) {
    return true;
  }

  // Calculate elapsed time since last snapshot
  const elapsedMs = (nowTs - lastSnapshotAt) * 1000;

  // Emit if we've passed the period duration
  return elapsedMs >= periodMs;
}

/**
 * Validate period configuration against check interval
 * @param periods Array of period strings (e.g., ["6h", "1d", "7d"])
 * @param checkIntervalMs Check interval in milliseconds
 * @returns Validation warnings (empty if valid)
 */
export function validatePeriods(periods: string[], checkIntervalMs: number): string[] {
  const warnings: string[] = [];

  for (const period of periods) {
    try {
      const periodMs = parsePeriod(period);

      // Check if period is smaller than check interval
      if (periodMs < checkIntervalMs) {
        warnings.push(`Period "${period}" (${periodMs}ms) is smaller than check interval (${checkIntervalMs}ms)`);
        continue;
      }

      // Warn if not a clean multiple
      if (!isCleanMultiple(periodMs, checkIntervalMs)) {
        const checksPerPeriod = getChecksPerPeriod(periodMs, checkIntervalMs);
        warnings.push(
          `Period "${period}" is not a clean multiple of check interval. ` +
          `Will emit approximately every ${checksPerPeriod} checks. ` +
          `Consider adjusting check interval for precise timing.`
        );
      }
    } catch (e) {
      warnings.push(`Invalid period "${period}": ${e}`);
    }
  }

  return warnings;
}

/**
 * Get periods that should be emitted on this check
 * @param periods Configured periods (e.g., ["6h", "1d", "7d"])
 * @param checkIntervalMs Check interval in milliseconds
 * @param periodSnapshots Map of period to last snapshot timestamp
 * @param nowTs Current Unix timestamp
 * @returns Array of periods to emit
 */
export function getPeriodsToEmit(
  periods: string[],
  checkIntervalMs: number,
  periodSnapshots: Map<string, number>,
  nowTs: number
): string[] {
  const toEmit: string[] = [];

  for (const period of periods) {
    try {
      const periodMs = parsePeriod(period);
      const lastSnapshotAt = periodSnapshots.get(period) || 0;

      if (shouldEmitPeriod(periodMs, checkIntervalMs, lastSnapshotAt, nowTs)) {
        toEmit.push(period);
      }
    } catch (e) {
      logger.warn(`Skipping invalid period "${period}": ${e}`);
    }
  }

  return toEmit;
}

/**
 * Format milliseconds to human-readable period string
 * @param ms Milliseconds
 * @returns Human-readable string (e.g., "6h", "1d")
 */
export function formatPeriod(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  const days = hours / 24;
  const weeks = days / 7;

  if (weeks >= 1 && weeks === Math.floor(weeks)) {
    return `${weeks}w`;
  }
  if (days >= 1 && days === Math.floor(days)) {
    return `${days}d`;
  }
  if (hours >= 1 && hours === Math.floor(hours)) {
    return `${hours}h`;
  }

  // Fallback to seconds
  const seconds = ms / 1000;
  return `${seconds}s`;
}
