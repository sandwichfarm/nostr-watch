/**
 * Chronicle Store
 *
 * Provides access to relay history and time series data via ChronicleService.
 */

import { writable, type Writable } from 'svelte/store';
import { ChronicleService, type TimeSeriesOptions, type ChronicleServiceOptions, type UptimePeriod } from '@nostrwatch/route66/services';
import type { TimeSeriesPoint } from '@nostrwatch/relay-chronicle';
import { route66 } from './route66';
import { route66Ready } from './app';
import { get } from 'svelte/store';

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
      syncRelays: [
        'wss://relay.nostr.watch',
      ],
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
