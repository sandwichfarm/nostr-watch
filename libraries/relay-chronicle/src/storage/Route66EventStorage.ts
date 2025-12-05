/**
 * relay-chronicle - Route66 Event Storage
 *
 * EventStorage implementation for route66's cache adapter system.
 * Works with any route66-compatible cache adapter (NostrSqlite, IDB, etc.)
 */

import type { EventStorage, QueryOptions, DeltaEvent } from '../types.ts';

/**
 * Route66 cache adapter interface (minimal subset needed)
 */
export interface Route66CacheAdapter {
  REQ(filters: any[]): Promise<any[]>;
  ready(): Promise<void>;
}

/**
 * EventStorage implementation using route66's CacheAdapter
 *
 * This adapter allows relay-chronicle to query Kind 1066 delta events
 * from route66's cache layer without needing direct database access.
 *
 * @example
 * ```typescript
 * import { Route66EventStorage } from '@nostrwatch/relay-chronicle/storage';
 * import { NostrSqliteAdapter } from '@nostrwatch/route66';
 *
 * const cacheAdapter = new NostrSqliteAdapter();
 * const storage = new Route66EventStorage(cacheAdapter);
 *
 * const events = await storage.query({
 *   relay: 'wss://relay.example.com',
 *   since: Date.now() / 1000 - 86400,
 * });
 * ```
 */
export class Route66EventStorage implements EventStorage {
  constructor(private cacheAdapter: Route66CacheAdapter) {}

  /**
   * Query delta events matching the given options
   *
   * Translates relay-chronicle QueryOptions into route66 filter format
   * and fetches events from the cache adapter.
   *
   * @param options - Query parameters
   * @returns Promise resolving to array of delta events (sorted by created_at ASC)
   */
  async query(options: QueryOptions): Promise<DeltaEvent[]> {
    // Ensure cache adapter is ready
    await this.cacheAdapter.ready();

    // Build filter for Kind 1066 events
    const filter: any = {
      kinds: [1066],
      '#r': [options.relay],
    };

    // Add time range if specified
    if (options.since !== undefined) {
      filter.since = options.since;
    }

    if (options.until !== undefined) {
      filter.until = options.until;
    }

    // Add limit if specified
    if (options.limit !== undefined) {
      filter.limit = options.limit;
    }

    // Filter by operational status if requested
    if (options.statusOnly) {
      filter['#O'] = ['init', 'up', 'down'];
    }

    // Filter by specific time periods if specified
    if (options.periods && options.periods.length > 0) {
      filter['#P'] = options.periods;
    }

    // Query events from cache adapter
    const events = await this.cacheAdapter.REQ([filter]);

    // Filter to only Kind 1066 and sort by created_at ascending
    return events
      .filter((e: any) => e.kind === 1066)
      .sort((a: any, b: any) => a.created_at - b.created_at) as DeltaEvent[];
  }
}
