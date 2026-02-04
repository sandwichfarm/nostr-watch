/**
 * Chronicle Store
 *
 * Provides access to relay history and time series data via ChronicleService.
 */

import { writable, type Writable } from 'svelte/store';
import { ChronicleService, type TimeSeriesOptions, type ChronicleServiceOptions, type UptimePeriod } from '@nostrwatch/route66/services';
import type { DeltaEvent, QueryOptions, TimeSeriesPoint } from '@nostrwatch/relay-chronicle';
import { route66 } from './route66';
import { route66Ready } from './app';
import { get } from 'svelte/store';
import { DEFAULT_NIP66_RELAY_URLS } from '$lib/config/nip66-defaults';

let chronicleService: ChronicleService | null = null;

/**
 * Initialize ChronicleService
 * Waits for Route66 to be fully ready before initializing.
 */
export async function initializeChronicleService(): Promise<ChronicleService | null> {
  // Wait for route66 to be fully initialized
  await route66Ready();

  const r66 = get(route66);
  if (!r66) {
    console.warn('[Chronicle] Route66 not initialized');
    return null;
  }

  if (!chronicleService) {
    chronicleService = new ChronicleService(r66.adapters, {
      autoSync: false, // Manual sync control
      syncRelays: DEFAULT_NIP66_RELAY_URLS,
    });
    console.log('[Chronicle] Service initialized');
  }

  return chronicleService;
}

/**
 * Get ChronicleService instance
 */
export async function getChronicleService(): Promise<ChronicleService | null> {
  if (!chronicleService) {
    return await initializeChronicleService();
  }
  return chronicleService;
}

/**
 * Sync a relay (fetch and subscribe to Kind 1066 events)
 */
export async function syncRelay(
  relay: string,
  options?: { since?: number; keepAlive?: boolean }
): Promise<void> {
  const service = await getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  await service.syncRelay(relay, options);
}

/**
 * Stop syncing a relay
 */
export async function unsyncRelay(relay: string): Promise<void> {
  const service = await getChronicleService();
  if (!service) return;

  await service.unsyncRelay(relay);
}

/**
 * Get time series data for a relay
 */
export async function getTimeSeriesData(
  options: TimeSeriesOptions
): Promise<TimeSeriesPoint[]> {
  const service = await getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  return await service.getTimeSeriesData(options);
}

/**
 * Get uptime/downtime periods for a relay
 */
export async function getUptimeHistory(
  relay: string,
  options?: { since?: number; until?: number }
): Promise<UptimePeriod[]> {
  const service = await getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  return await service.getUptimeHistory(relay, options);
}

/**
 * Get raw Kind 1066 delta events for a relay
 */
export async function getDeltaEvents(options: QueryOptions): Promise<DeltaEvent[]> {
  const service = await getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  return await service.getDeltaEvents(options);
}

/**
 * Check if a relay is currently being synced
 */
export function isSyncing(relay: string): boolean {
  // Use cached service directly for synchronous check
  if (!chronicleService) return false;
  return chronicleService.isSyncing(relay);
}

/**
 * Get list of currently synced relays
 */
export function getSyncedRelays(): string[] {
  // Use cached service directly for synchronous check
  if (!chronicleService) return [];
  return chronicleService.getSyncedRelays();
}

/**
 * Get ChronicleService storage for direct queries
 */
export function getChronicleStorage() {
  // Use cached service directly for synchronous access
  return chronicleService?.storage;
}

export interface RelayDeltasSubscriptionHandle {
  /**
   * Resolves once the keep-alive subscription attempt has completed.
   *
   * Note: this does not guarantee EOSE; it only guarantees that Route66 was asked to subscribe.
   */
  ready: Promise<void>;
  /** Decrement subscription ref count and unsync if last consumer */
  stop: () => Promise<void>;
}

const relayDeltasRefCount = new Map<string, number>();
const relayDeltasEnsureInFlight = new Map<string, Promise<void>>();
const relayDeltasSinceMin = new Map<string, number | undefined>();

function normalizeSince(since?: number): number | undefined {
  if (typeof since !== 'number') return undefined;
  if (!Number.isFinite(since)) return undefined;
  return since;
}

async function ensureRelayDeltasSubscription(
  relay: string,
  options?: { since?: number }
): Promise<void> {
  const requestedSince = normalizeSince(options?.since);
  const currentSince = relayDeltasSinceMin.get(relay);

  // Track earliest requested since for this relay while subscribed.
  if (
    requestedSince !== undefined &&
    (currentSince === undefined || requestedSince < currentSince)
  ) {
    relayDeltasSinceMin.set(relay, requestedSince);
  }

  const existing = relayDeltasEnsureInFlight.get(relay);
  if (existing) {
    // Wait for the in-flight ensure, then run again in case `since` was updated while waiting.
    await existing;
  }

  const inFlightNow = relayDeltasEnsureInFlight.get(relay);
  if (inFlightNow) return inFlightNow;

  const task = (async () => {
    const desiredSince = relayDeltasSinceMin.get(relay);
    const wantsSubscription = (relayDeltasRefCount.get(relay) ?? 0) > 0;

    if (!wantsSubscription) {
      if (isSyncing(relay)) await unsyncRelay(relay);
      return;
    }

    // ChronicleService will keep a live subscription and backfill history as `since` expands.
    await syncRelay(relay, { since: desiredSince, keepAlive: true });

    // If a one-shot sync was in-flight, the first call above can return without creating a keepAlive
    // subscription. Double-check and retry once if we still want the subscription.
    if (wantsSubscription && !isSyncing(relay)) {
      await syncRelay(relay, { since: desiredSince, keepAlive: true });
    }

    // If nobody wants it anymore (e.g. scrolled out quickly), clean up.
    if ((relayDeltasRefCount.get(relay) ?? 0) <= 0) {
      await unsyncRelay(relay);
    }
  })().finally(() => {
    relayDeltasEnsureInFlight.delete(relay);
  });

  relayDeltasEnsureInFlight.set(relay, task);
  return task;
}

/**
 * Reference-counted keepAlive subscription to Kind 1066 deltas for a relay.
 *
 * Use this from UI components that should only keep websocket subscriptions alive while visible.
 */
export function subscribeRelayDeltas(
  relay: string,
  options?: { since?: number }
): RelayDeltasSubscriptionHandle {
  const current = relayDeltasRefCount.get(relay) ?? 0;
  relayDeltasRefCount.set(relay, current + 1);

  const ready = ensureRelayDeltasSubscription(relay, options);

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;

    const cur = relayDeltasRefCount.get(relay) ?? 0;
    const next = Math.max(0, cur - 1);

    if (next === 0) {
      relayDeltasRefCount.delete(relay);
      relayDeltasSinceMin.delete(relay);
      await unsyncRelay(relay);
      return;
    }

    relayDeltasRefCount.set(relay, next);
  };

  return { ready, stop };
}

/**
 * Hint that an active relay deltas subscription should include at least `since`.
 *
 * This does not change the subscription ref-count. If `since` expands the currently subscribed
 * time window, the websocket subscription is restarted.
 */
export async function updateRelayDeltasSince(
  relay: string,
  options?: { since?: number }
): Promise<void> {
  if ((relayDeltasRefCount.get(relay) ?? 0) <= 0) return;
  await ensureRelayDeltasSubscription(relay, options);
}
