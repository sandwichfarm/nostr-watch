/**
 * Dimensions Worker Manager
 *
 * Manages the dimensions derivation worker lifecycle:
 * - Initializes worker on app start
 * - Subscribes to relayCheckAggregates and sends debounced updates
 * - Receives results and updates writable dimension stores
 * - Handles caching for leader tab
 */

import { get } from 'svelte/store';
import { relayCheckAggregates } from '$lib/stores/checks';
import { tabState, doAggregateCache } from '$lib/stores/app';
import { StateManager } from '@nostrwatch/route66';
import {
  // Worker state
  dimensionsWorkerStats,
  dimensionsWorkerReady,
  // Geocode stores
  workerGeocodes,
  workerGeocodeCounts,
  workerGeocodePercentages,
  workerRelaysByGeo,
  workerSoftwaresByGeo,
  workerGeoRows,
  // Software stores
  workerSoftwares,
  workerSoftwareCounts,
  workerSoftwarePercentages,
  workerSoftwareVersions,
  workerSoftwareVersionCounts,
  workerSoftwareRelays,
  workerSoftwareOperatorPubkeys,
  workerIspsBySoftware,
  workerSoftwareGeocodes,
  workerSoftwareRows,
  // ISP stores
  workerIsps,
  workerIspCounts,
  workerIspPercentages,
  workerSoftwaresByIsp,
  workerIspRows,
  // NIP stores
  workerNips,
  workerNipCounts,
  workerNipPercentages,
  // Version stores
  workerVersions,
  // IP stores
  workerIpRelayMap,
  // Aggregates
  workerAggregates,
  // Feature flags (for fallback)
  useWorkerGeocodes,
  useWorkerSoftwares,
  useWorkerIsps,
  useWorkerNips,
  useWorkerVersions,
  useWorkerIps,
} from '$lib/stores/dimension-stores';
import type {
  AggregateRow,
  UpdateMessage,
  ConfigMessage,
  ResultMessage,
  DimensionsResult,
} from './dimensions-derivation.worker';

// ============================================================================
// STATE
// ============================================================================

let worker: Worker | null = null;
let isInitialized = false;
let unsubAggregates: (() => void) | null = null;
let pendingUpdate: AggregateRow[] | null = null;
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Error handling and restart state
let restartCount = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

const UPDATE_DEBOUNCE_MS = 150;
const MAX_RESTARTS = 3;
const RESTART_DELAY_BASE_MS = 1000; // Exponential backoff: 1s, 2s, 4s

// Debug logging - enable via localStorage.setItem('debug:dimensionsWorker', 'true')
function isDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' &&
      localStorage.getItem('debug:dimensionsWorker') === 'true';
  } catch {
    return false;
  }
}

function debugLog(...args: any[]): void {
  if (isDebugEnabled()) {
    console.log('[DimensionsWorker]', ...args);
  }
}
const CACHE_KEY_GEOCODES = 'dimensions:geocodes';
const CACHE_KEY_GEOROWS = 'dimensions:geoRows';
const CACHE_KEY_SOFTWARES = 'dimensions:softwares';
const CACHE_KEY_SOFTWARE_ROWS = 'dimensions:softwareRows';
const CACHE_KEY_ISPS = 'dimensions:isps';
const CACHE_KEY_ISP_ROWS = 'dimensions:ispRows';

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

function canUseWorker(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

function createWorker(): Worker | null {
  if (!canUseWorker()) return null;

  try {
    const w = new Worker(
      new URL('./dimensions-derivation.worker.ts', import.meta.url),
      { type: 'module' }
    );
    return w;
  } catch (e) {
    console.error('[DimensionsWorker] Failed to create worker:', e);
    return null;
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Disable all worker feature flags to fallback to legacy stores.
 */
function disableWorkerFeatureFlags(): void {
  useWorkerGeocodes.set(false);
  useWorkerSoftwares.set(false);
  useWorkerIsps.set(false);
  useWorkerNips.set(false);
  useWorkerVersions.set(false);
  useWorkerIps.set(false);
  console.warn('[DimensionsWorker] Disabled worker feature flags, using legacy stores');
}

/**
 * Re-enable worker feature flags after successful restart.
 */
function enableWorkerFeatureFlags(): void {
  useWorkerGeocodes.set(true);
  useWorkerSoftwares.set(true);
  useWorkerIsps.set(true);
  useWorkerNips.set(true);
  useWorkerVersions.set(true);
  useWorkerIps.set(true);
}

/**
 * Handle worker errors - attempt restart with exponential backoff.
 */
function handleWorkerError(ev: ErrorEvent): void {
  console.error('[DimensionsWorker] Worker error:', ev.message);
  dimensionsWorkerReady.set(false);

  // Clean up current worker
  if (worker) {
    worker.removeEventListener('message', handleWorkerMessage);
    worker.removeEventListener('error', handleWorkerError);
    try {
      worker.terminate();
    } catch {}
    worker = null;
  }

  // Attempt restart if under limit
  if (restartCount < MAX_RESTARTS) {
    const delay = RESTART_DELAY_BASE_MS * Math.pow(2, restartCount);
    restartCount++;
    console.log(`[DimensionsWorker] Attempting restart ${restartCount}/${MAX_RESTARTS} in ${delay}ms`);

    restartTimer = setTimeout(() => {
      restartTimer = null;
      restartWorker();
    }, delay);
  } else {
    console.error('[DimensionsWorker] Max restarts exceeded, falling back to legacy stores');
    disableWorkerFeatureFlags();
  }
}

/**
 * Restart the worker after a crash.
 */
function restartWorker(): void {
  worker = createWorker();
  if (!worker) {
    console.error('[DimensionsWorker] Failed to restart worker');
    if (restartCount >= MAX_RESTARTS) {
      disableWorkerFeatureFlags();
    }
    return;
  }

  // Re-attach listeners
  worker.addEventListener('message', handleWorkerMessage);
  worker.addEventListener('error', handleWorkerError);

  // Re-send from source store (avoids storing large dataset in memory)
  const currentAggregates = get(relayCheckAggregates);
  if (currentAggregates && currentAggregates.length > 0) {
    const rows: AggregateRow[] = currentAggregates.map((agg) => ({
      relay: agg.relay,
      operatorPubkey: agg.operatorPubkey,
      software: agg.software,
      version: agg.version,
      geocode: agg.geocode,
      isp: agg.isp,
      as: agg.as,
      asname: agg.asname,
      supportedNips: agg.supportedNips,
      liveness: agg.liveness,
      lastSeen: agg.lastSeen,
      ipv4: agg.ipv4,
      ipv6: agg.ipv6,
      rtt: agg.rtt,
      rttNormalized: agg.rttNormalized,
    }));
    sendUpdate(rows);
  }

  console.log('[DimensionsWorker] Worker restarted successfully');
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

function handleWorkerMessage(ev: MessageEvent): void {
  const data = ev.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'ready') {
    dimensionsWorkerReady.set(true);
    // Reset restart count on successful ready
    restartCount = 0;
    enableWorkerFeatureFlags();
    debugLog('Worker ready');
    return;
  }

  if (data.type === 'result') {
    const result = data as ResultMessage;
    applyDimensionsResult(result.dimensions, result.stats);
    return;
  }
}

function applyDimensionsResult(
  dimensions: DimensionsResult,
  stats: { computeMs: number; aggregateCount: number; dimensionCounts: Record<string, number> }
): void {
  // Debug logging
  debugLog('Computation complete:', {
    computeMs: stats.computeMs,
    aggregates: stats.aggregateCount,
    dimensions: stats.dimensionCounts,
  });

  // Update stats store
  dimensionsWorkerStats.set(stats);

  // Update geocode stores
  workerGeocodes.set(dimensions.geocodes);
  workerGeocodeCounts.set(dimensions.geocodeCounts);
  workerGeocodePercentages.set(dimensions.geocodePercentages);
  workerRelaysByGeo.set(dimensions.relaysByGeo);
  workerSoftwaresByGeo.set(dimensions.softwaresByGeo);
  workerGeoRows.set(dimensions.geoRows);

  // Update software stores
  workerSoftwares.set(dimensions.softwares);
  workerSoftwareCounts.set(dimensions.softwareCounts);
  workerSoftwarePercentages.set(dimensions.softwarePercentages);
  workerSoftwareVersions.set(dimensions.softwareVersions);
  workerSoftwareVersionCounts.set(dimensions.softwareVersionCounts);
  workerSoftwareRelays.set(dimensions.softwareRelays);
  workerSoftwareOperatorPubkeys.set(dimensions.softwareOperatorPubkeys);
  workerIspsBySoftware.set(dimensions.ispsBySoftware);
  workerSoftwareGeocodes.set(dimensions.softwareGeocodes);
  workerSoftwareRows.set(dimensions.softwareRows);

  // Update ISP stores
  workerIsps.set(dimensions.isps);
  workerIspCounts.set(dimensions.ispCounts);
  workerIspPercentages.set(dimensions.ispPercentages);
  workerSoftwaresByIsp.set(dimensions.softwaresByIsp);
  workerIspRows.set(dimensions.ispRows);

  // Update NIP stores
  workerNips.set(dimensions.nips);
  workerNipCounts.set(dimensions.nipCounts);
  workerNipPercentages.set(dimensions.nipPercentages);

  // Update version stores
  workerVersions.set(dimensions.versions);

  // Update IP stores
  workerIpRelayMap.set(dimensions.ipRelayMap);

  // Update worker aggregates for lazy helpers
  workerAggregates.set(dimensions.workerAggregates);

  // Cache on leader tab
  if (get(doAggregateCache) && get(tabState) === 'leader') {
    try {
      // Cache geocodes
      if (dimensions.geocodes.length) {
        StateManager.set(CACHE_KEY_GEOCODES, dimensions.geocodes);
      }
      if (dimensions.geoRows.length) {
        StateManager.set(CACHE_KEY_GEOROWS, dimensions.geoRows);
      }
      // Cache softwares
      if (dimensions.softwares.length) {
        StateManager.set(CACHE_KEY_SOFTWARES, dimensions.softwares);
      }
      if (dimensions.softwareRows.length) {
        StateManager.set(CACHE_KEY_SOFTWARE_ROWS, dimensions.softwareRows);
      }
      // Cache ISPs
      if (dimensions.isps.length) {
        StateManager.set(CACHE_KEY_ISPS, dimensions.isps);
      }
      if (dimensions.ispRows.length) {
        StateManager.set(CACHE_KEY_ISP_ROWS, dimensions.ispRows);
      }
    } catch {}
  }
}

// ============================================================================
// UPDATE SENDING
// ============================================================================

function sendUpdate(aggregates: AggregateRow[], config?: { onlineOnly?: boolean }): void {
  if (!worker) return;

  const message: UpdateMessage = {
    type: 'update',
    aggregates,
    config,
  };

  try {
    worker.postMessage(message);
  } catch (e) {
    console.error('[DimensionsWorker] Failed to send update:', e);
  }
}

function sendConfig(config: { onlineOnly?: boolean }): void {
  if (!worker) return;

  const message: ConfigMessage = {
    type: 'config',
    ...config,
  };

  try {
    worker.postMessage(message);
  } catch {}
}

function scheduleUpdate(aggregates: AggregateRow[]): void {
  pendingUpdate = aggregates;

  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
  }

  updateDebounceTimer = setTimeout(() => {
    if (pendingUpdate) {
      sendUpdate(pendingUpdate);
      pendingUpdate = null;
    }
    updateDebounceTimer = null;
  }, UPDATE_DEBOUNCE_MS);
}

// ============================================================================
// SUBSCRIPTION
// ============================================================================

function subscribeToAggregates(): void {
  if (unsubAggregates) return;

  unsubAggregates = relayCheckAggregates.subscribe(($aggregates) => {
    if (!worker) return;
    if (!Array.isArray($aggregates)) return;

    // Transform to AggregateRow format (already matches)
    const rows: AggregateRow[] = $aggregates.map((agg) => ({
      relay: agg.relay,
      operatorPubkey: agg.operatorPubkey,
      software: agg.software,
      version: agg.version,
      geocode: agg.geocode,
      isp: agg.isp,
      as: agg.as,
      asname: agg.asname,
      supportedNips: agg.supportedNips,
      liveness: agg.liveness,
      lastSeen: agg.lastSeen,
      ipv4: agg.ipv4,
      ipv6: agg.ipv6,
      rtt: agg.rtt,
      rttNormalized: agg.rttNormalized,
    }));

    scheduleUpdate(rows);
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize the dimensions worker.
 * Safe to call multiple times - only initializes once.
 */
export function initDimensionsWorker(): void {
  if (isInitialized) return;
  if (!canUseWorker()) {
    console.warn('[DimensionsWorker] Workers not supported, skipping initialization');
    return;
  }

  isInitialized = true;

  // Seed from cache for fast first paint
  seedFromCache();

  // Create worker
  worker = createWorker();
  if (!worker) {
    console.error('[DimensionsWorker] Failed to create worker');
    isInitialized = false;
    return;
  }

  // Listen for messages and errors
  worker.addEventListener('message', handleWorkerMessage);
  worker.addEventListener('error', handleWorkerError);

  // Subscribe to aggregates
  subscribeToAggregates();
}

/**
 * Seed dimension stores from cache for instant first paint.
 */
function seedFromCache(): void {
  try {
    // Seed geocodes
    const cachedGeocodes = StateManager.get(CACHE_KEY_GEOCODES);
    if (Array.isArray(cachedGeocodes) && cachedGeocodes.length) {
      workerGeocodes.set(cachedGeocodes);
    }

    const cachedGeoRows = StateManager.get(CACHE_KEY_GEOROWS);
    if (Array.isArray(cachedGeoRows) && cachedGeoRows.length) {
      workerGeoRows.set(cachedGeoRows);

      // Derive other stores from cached rows
      const counts: Record<string, number> = {};
      const percentages: Record<string, number> = {};
      const relaysByGeo: Record<string, string[]> = {};
      const softwaresByGeo: Record<string, string[]> = {};

      for (const row of cachedGeoRows) {
        counts[row.geocode] = row.count;
        percentages[row.geocode] = row.percent;
        relaysByGeo[row.geocode] = row.relays || [];
        softwaresByGeo[row.geocode] = row.softwares || [];
      }

      workerGeocodeCounts.set(counts);
      workerGeocodePercentages.set(percentages);
      workerRelaysByGeo.set(relaysByGeo);
      workerSoftwaresByGeo.set(softwaresByGeo);
    }

    // Seed softwares
    const cachedSoftwares = StateManager.get(CACHE_KEY_SOFTWARES);
    if (Array.isArray(cachedSoftwares) && cachedSoftwares.length) {
      workerSoftwares.set(cachedSoftwares);
    }

    const cachedSoftwareRows = StateManager.get(CACHE_KEY_SOFTWARE_ROWS);
    if (Array.isArray(cachedSoftwareRows) && cachedSoftwareRows.length) {
      workerSoftwareRows.set(cachedSoftwareRows);

      // Derive counts and percentages from cached rows
      const counts: Record<string, number> = {};
      const percentages: Record<string, number> = {};
      const versions: Record<string, string[]> = {};

      for (const row of cachedSoftwareRows) {
        counts[row.name] = row.totalDeployed;
        percentages[row.name] = row.marketShare;
        versions[row.name] = row.versions || [];
      }

      workerSoftwareCounts.set(counts);
      workerSoftwarePercentages.set(percentages);
      workerSoftwareVersions.set(versions);
    }

    // Seed ISPs
    const cachedIsps = StateManager.get(CACHE_KEY_ISPS);
    if (Array.isArray(cachedIsps) && cachedIsps.length) {
      workerIsps.set(cachedIsps);
    }

    const cachedIspRows = StateManager.get(CACHE_KEY_ISP_ROWS);
    if (Array.isArray(cachedIspRows) && cachedIspRows.length) {
      workerIspRows.set(cachedIspRows);

      // Derive counts and percentages from cached rows
      const counts: Record<string, number> = {};
      const percentages: Record<string, number> = {};
      const softwaresByIsp: Record<string, string[]> = {};

      for (const row of cachedIspRows) {
        counts[row.prettyName] = row.count;
        percentages[row.prettyName] = row.percent;
        softwaresByIsp[row.prettyName] = row.softwares || [];
      }

      workerIspCounts.set(counts);
      workerIspPercentages.set(percentages);
      workerSoftwaresByIsp.set(softwaresByIsp);
    }
  } catch {}
}

/**
 * Terminate the dimensions worker and clean up.
 */
export function terminateDimensionsWorker(): void {
  // Clear timers
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
    updateDebounceTimer = null;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  // Unsubscribe
  if (unsubAggregates) {
    unsubAggregates();
    unsubAggregates = null;
  }

  // Terminate worker
  if (worker) {
    worker.removeEventListener('message', handleWorkerMessage);
    worker.removeEventListener('error', handleWorkerError);
    try {
      worker.terminate();
    } catch {}
    worker = null;
  }

  // Reset state
  isInitialized = false;
  pendingUpdate = null;
  restartCount = 0;
  dimensionsWorkerReady.set(false);
}

/**
 * Check if the dimensions worker is active.
 */
export function isDimensionsWorkerActive(): boolean {
  return isInitialized && worker !== null;
}
