/**
 * Chronicle Store
 *
 * Provides access to relay history and time series data via ChronicleService.
 */

import { writable, type Writable } from 'svelte/store';
import { ChronicleService, type TimeSeriesOptions, type ChronicleServiceOptions, type UptimePeriod } from '@nostrwatch/route66/services';
import type { TimeSeriesPoint } from '@nostrwatch/relay-chronicle';
import { route66 } from './route66';
import { get } from 'svelte/store';

let chronicleService: ChronicleService | null = null;

/**
 * Initialize ChronicleService
 */
export function initializeChronicleService() {
  const r66 = get(route66);
  if (!r66) {
    console.warn('[Chronicle] Route66 not initialized');
    return null;
  }

  if (!chronicleService) {
    chronicleService = new ChronicleService(r66.adapters, {
      autoSync: false, // Manual sync control
      syncRelays: [
        'wss://relay.nostr.watch',
        'wss://relaypag.es',
      ],
    });
    console.log('[Chronicle] Service initialized');
  }

  return chronicleService;
}

/**
 * Get ChronicleService instance
 */
export function getChronicleService(): ChronicleService | null {
  if (!chronicleService) {
    return initializeChronicleService();
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
  const service = getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  await service.syncRelay(relay, options);
}

/**
 * Stop syncing a relay
 */
export async function unsyncRelay(relay: string): Promise<void> {
  const service = getChronicleService();
  if (!service) return;

  await service.unsyncRelay(relay);
}

/**
 * Get time series data for a relay
 */
export async function getTimeSeriesData(
  options: TimeSeriesOptions
): Promise<TimeSeriesPoint[]> {
  const service = getChronicleService();
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
  const service = getChronicleService();
  if (!service) {
    throw new Error('[Chronicle] Service not initialized');
  }

  return await service.getUptimeHistory(relay, options);
}

/**
 * Check if a relay is currently being synced
 */
export function isSyncing(relay: string): boolean {
  const service = getChronicleService();
  if (!service) return false;

  return service.isSyncing(relay);
}

/**
 * Get list of currently synced relays
 */
export function getSyncedRelays(): string[] {
  const service = getChronicleService();
  if (!service) return [];

  return service.getSyncedRelays();
}

/**
 * Get ChronicleService storage for direct queries
 */
export function getChronicleStorage() {
  const service = getChronicleService();
  return service?.storage;
}
