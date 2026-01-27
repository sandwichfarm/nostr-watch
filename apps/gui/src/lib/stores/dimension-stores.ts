/**
 * Dimension Stores
 *
 * Writable stores for dimension data computed by the dimensions worker.
 * These stores are updated via postMessage from the worker, avoiding
 * the cascade of derived store re-computations on the main thread.
 */

import { writable, get, type Writable } from 'svelte/store';
import { StateManager } from '@nostrwatch/route66';
import type { AggregateRow, GeoRow, SoftwareRow, StoreIsp, IspRow } from '$lib/workers/dimensions-derivation.worker';

// ============================================================================
// DERIVATION MODE PREFERENCE
// ============================================================================

export type DerivationMode = 'worker' | 'legacy';

export const DERIVATION_MODE_KEY = 'preferences:derivation:mode';
export const DEFAULT_DERIVATION_MODE: DerivationMode = 'worker';

function normalizeDerivationMode(value: unknown): DerivationMode {
  if (value === 'worker' || value === 'legacy') return value;
  return DEFAULT_DERIVATION_MODE;
}

const initialDerivationMode: DerivationMode =
  typeof window === 'undefined'
    ? DEFAULT_DERIVATION_MODE
    : normalizeDerivationMode(StateManager.get(DERIVATION_MODE_KEY));

/** User preference for derivation mode: 'worker' (Web Workers) or 'legacy' (Memory Relay) */
export const derivationMode: Writable<DerivationMode> = writable(initialDerivationMode);

// ============================================================================
// WORKER STATE STORES
// ============================================================================

/** Whether the dimensions worker is ready */
export const dimensionsWorkerReady: Writable<boolean> = writable(false);

/** Stats from the most recent worker computation */
export const dimensionsWorkerStats: Writable<{
  computeMs: number;
  aggregateCount: number;
  dimensionCounts: Record<string, number>;
} | null> = writable(null);

// ============================================================================
// GEOCODE STORES (Worker-fed)
// ============================================================================

/** List of unique geocodes sorted alphabetically */
export const workerGeocodes: Writable<string[]> = writable([]);

/** Map of geocode -> relay count */
export const workerGeocodeCounts: Writable<Record<string, number>> = writable({});

/** Map of geocode -> percentage of total relays */
export const workerGeocodePercentages: Writable<Record<string, number>> = writable({});

/** Map of geocode -> array of relay URLs */
export const workerRelaysByGeo: Writable<Record<string, string[]>> = writable({});

/** Map of geocode -> array of unique software names */
export const workerSoftwaresByGeo: Writable<Record<string, string[]>> = writable({});

/** Pre-computed rows for geocode data table */
export const workerGeoRows: Writable<GeoRow[]> = writable([]);

// ============================================================================
// SOFTWARE STORES (Worker-fed)
// ============================================================================

/** List of unique software names sorted alphabetically */
export const workerSoftwares: Writable<string[]> = writable([]);

/** Map of software -> relay count */
export const workerSoftwareCounts: Writable<Record<string, number>> = writable({});

/** Map of software -> percentage of total relays */
export const workerSoftwarePercentages: Writable<Record<string, number>> = writable({});

/** Map of software -> array of version strings */
export const workerSoftwareVersions: Writable<Record<string, string[]>> = writable({});

/** Map of software -> map of version -> count */
export const workerSoftwareVersionCounts: Writable<Record<string, Record<string, number>>> = writable({});

/** Map of software -> array of relay URLs */
export const workerSoftwareRelays: Writable<Record<string, string[]>> = writable({});

/** Map of software -> array of operator pubkeys */
export const workerSoftwareOperatorPubkeys: Writable<Record<string, string[]>> = writable({});

/** Map of software -> array of ISP names */
export const workerIspsBySoftware: Writable<Record<string, string[]>> = writable({});

/** Map of software -> array of geocodes */
export const workerSoftwareGeocodes: Writable<Record<string, string[]>> = writable({});

/** Pre-computed rows for software data table */
export const workerSoftwareRows: Writable<SoftwareRow[]> = writable([]);

// ============================================================================
// ISP STORES (Worker-fed)
// ============================================================================

/** List of unique ISPs with metadata */
export const workerIsps: Writable<StoreIsp[]> = writable([]);

/** Map of ISP -> relay count */
export const workerIspCounts: Writable<Record<string, number>> = writable({});

/** Map of ISP -> percentage of total relays */
export const workerIspPercentages: Writable<Record<string, number>> = writable({});

/** Map of ISP -> array of software names */
export const workerSoftwaresByIsp: Writable<Record<string, string[]>> = writable({});

/** Pre-computed rows for ISP data table */
export const workerIspRows: Writable<IspRow[]> = writable([]);

// ============================================================================
// NIP STORES (Worker-fed)
// ============================================================================

/** List of unique NIP numbers sorted numerically */
export const workerNips: Writable<number[]> = writable([]);

/** Map of NIP number -> relay count supporting that NIP */
export const workerNipCounts: Writable<Record<number, number>> = writable({});

/** Map of NIP number -> percentage of total NIP mentions */
export const workerNipPercentages: Writable<Record<number, number>> = writable({});

// ============================================================================
// VERSION STORES (Worker-fed)
// ============================================================================

/** List of unique version strings sorted alphabetically */
export const workerVersions: Writable<string[]> = writable([]);

// ============================================================================
// IP STORES (Worker-fed)
// ============================================================================

/** Map of IP address -> array of relay URLs using that IP */
export const workerIpRelayMap: Writable<Record<string, string[]>> = writable({});

// ============================================================================
// WORKER AGGREGATES (For lazy helper functions)
// ============================================================================

/**
 * Aggregates passed through the worker, potentially filtered (e.g., onlineOnly).
 * Lazy helper functions can use get(workerAggregates) instead of
 * get(relayCheckAggregates) for consistent filtering.
 */
export const workerAggregates: Writable<AggregateRow[]> = writable([]);

// ============================================================================
// FEATURE FLAGS
// ============================================================================

// Initial feature flag state based on derivation mode preference
const initialUseWorker = initialDerivationMode === 'worker';

/**
 * Feature flag to use worker-computed geocode stores.
 * When true, components should use workerGeocodes, workerGeocodeCounts, etc.
 * When false, use the legacy derived stores from geocodes.ts.
 */
export const useWorkerGeocodes: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker-computed software stores.
 */
export const useWorkerSoftwares: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker-computed ISP stores.
 */
export const useWorkerIsps: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker-computed NIP stores.
 */
export const useWorkerNips: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker-computed version stores.
 */
export const useWorkerVersions: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker-computed IP stores.
 */
export const useWorkerIps: Writable<boolean> = writable(initialUseWorker);

/**
 * Feature flag to use worker for relay checks aggregation.
 * This is the original derivation worker (relay-checks-aggregation.worker.ts).
 */
export const useWorkerRelayChecks: Writable<boolean> = writable(initialUseWorker);

// ============================================================================
// DERIVATION MODE PERSISTENCE & SYNC
// ============================================================================

// Persist derivation mode and sync feature flags (must be after feature flags are defined)
if (typeof window !== 'undefined') {
  // Track if this is the initial subscription call to avoid redundant sets
  let isInitialCall = true;

  derivationMode.subscribe((value) => {
    const next = normalizeDerivationMode(value);
    if (next !== value) {
      derivationMode.set(next);
      return;
    }

    // Persist to storage
    try {
      if (StateManager.get(DERIVATION_MODE_KEY) !== next) {
        StateManager.set(DERIVATION_MODE_KEY, next);
      }
    } catch {}

    // Sync all feature flags based on derivation mode (skip on initial call since already set)
    if (!isInitialCall) {
      const useWorker = next === 'worker';
      useWorkerGeocodes.set(useWorker);
      useWorkerSoftwares.set(useWorker);
      useWorkerIsps.set(useWorker);
      useWorkerNips.set(useWorker);
      useWorkerVersions.set(useWorker);
      useWorkerIps.set(useWorker);
      useWorkerRelayChecks.set(useWorker);
    }
    isInitialCall = false;
  });

  // Listen for storage changes from other tabs
  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    const prefix = (StateManager as any)?.localStorage?.prefix ?? 'state';
    if (event.key === `${prefix}:${DERIVATION_MODE_KEY}`) {
      const next = normalizeDerivationMode(StateManager.get(DERIVATION_MODE_KEY));
      if (get(derivationMode) !== next) derivationMode.set(next);
    }
  });
}
