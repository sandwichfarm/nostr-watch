
import { derived, get, type Readable } from 'svelte/store';
import { eventsArray } from './events.js';
import { relayCheckAggregates } from './checks.js';
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import type { lte } from 'lodash';
import { doAggregateCache, isBootstrapping, tabState } from './app.js';
import softwares from '../config/dataTable/softwares.js';
import {
  useWorkerGeocodes,
  workerGeocodes,
  workerGeocodeCounts,
  workerGeocodePercentages,
  workerRelaysByGeo,
  workerSoftwaresByGeo,
  workerGeoRows,
} from './dimension-stores.js';
import type { GeoRow } from '$lib/workers/dimensions-derivation.worker';

// ============================================================================
// LEGACY DERIVED STORES (Main thread computation)
// These are kept as fallback and for comparison testing
// ============================================================================

export const geocodes_legacy: Readable<string[]> = derived(
  relayCheckAggregates,
  ($relayCheckAggregates) => {
    if (!$relayCheckAggregates.length) {
      const cached = StateManager.get('aggregate:geocodes');
      return Array.isArray(cached) ? cached : [];
    }
    const codes: Set<string> = new Set();

    codes.add('unknown');

    $relayCheckAggregates.forEach((event: Nip66CheckEvent) => {
      if (event.geocode) {
        codes.add(event.geocode);
      }
    });

    let geocodesArray: string[] = Array.from(codes).sort();

    if(geocodesArray.length){
      if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
        StateManager.set('aggregate:geocodes', geocodesArray);
      }
    }
    else {
      const cached = StateManager.get('aggregate:geocodes')
      geocodesArray = Array.isArray(cached) ? cached : [];
    }

    return geocodesArray;
  }
);

export const geocodeCounts_legacy = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const counts = new Map();
    $relayCheckAggregates.forEach((relayCheck) => {
        const geocode = relayCheck?.geocode || 'unknown';
        counts.set(geocode, (counts.get(geocode) || 0) + 1);
    });

    if (!counts.size) {
      const cachedCounts = StateManager.get('aggregate:geocodeCounts') as
        | Record<string, number>
        | [string, number][]
        | undefined;
      if (Array.isArray(cachedCounts)) {
        for (const [geocode, count] of cachedCounts) counts.set(geocode, count);
      } else if (cachedCounts && typeof cachedCounts === 'object') {
        for (const [geocode, count] of Object.entries(cachedCounts)) counts.set(geocode, count);
      }
    } else {
      const countsObject = Object.fromEntries(counts);
      if(get(doAggregateCache) && get(tabState) === 'leader' && !get(isBootstrapping)) {
        StateManager.set('aggregate:geocodeCounts', countsObject);
      }
    }
    return counts;
});

export const geocodePercentages_legacy = derived(geocodeCounts_legacy, ($geocodeCounts) => {
    const total = Array.from($geocodeCounts.values()).reduce((sum, count) => sum + count, 0);
    const percentages = new Map();
    $geocodeCounts.forEach((count, geocode) => {
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        percentages.set(geocode, parseFloat(percent));
    });
    return percentages;
});

export const relaysByGeo_legacy: Readable<Map<string, string[]>> = derived(
  [relayCheckAggregates],
  ([$relayCheckAggregates]) => {
    const relaysByGeo = new Map();
    $relayCheckAggregates.forEach((relayCheck) => {
      const geocode = relayCheck?.geocode || 'unknown';
      const relays = relaysByGeo.get(geocode) || [];
      relays.push(relayCheck.relay);
      relaysByGeo.set(geocode, relays);
    });
    return relaysByGeo;
})

export const softwaresByGeo_legacy: Readable<Map<string, string[]>> = derived(
  [relayCheckAggregates],
  ([$relayCheckAggregates]) => {
    const softwaresByGeo: Map<string, string[] | Set<string>> = new Map();
    $relayCheckAggregates.forEach((relayCheck) => {
      const geocode = relayCheck?.geocode || 'unknown';
      const softwares = softwaresByGeo.get(geocode) || new Set();
      if((softwares as Set<string>).has(relayCheck.software)) return;
      (softwares as Set<string>).add(relayCheck.software);
      softwaresByGeo.set(geocode, softwares);
    });
    softwaresByGeo.forEach((softwares, geocode) => {
      softwaresByGeo.set(geocode, Array.from(softwares));
    })
    return softwaresByGeo as Map<string, string[]>;
})


export const geoRows_legacy = derived(
  [geocodes_legacy, geocodeCounts_legacy, geocodePercentages_legacy, relaysByGeo_legacy, softwaresByGeo_legacy],
  ([$geocodes, $geocodeCounts, $geocodePercentages, $relaysByGeo, $softwaresByGeo]) => {
    const rows: Record<string, any> = [];
    $geocodes.forEach((geocode: string) => {
      const id = geocode;
      const count = $geocodeCounts.get(geocode) || 0;
      const percent = $geocodePercentages.get(geocode) || 0;
      const relays = $relaysByGeo.get(geocode) || [];
      const relaysCount = relays.length || 0;
      const softwares = $softwaresByGeo.get(geocode) || [];
      const softwaresCount = softwares.length || 0;
      rows.push({ id, geocode, count, percent, relays, relaysCount, softwares, softwaresCount });
    });
    return rows;
  }
);

// ============================================================================
// HYBRID STORES (Switch between worker and legacy based on feature flag)
// ============================================================================

/**
 * Geocodes store - uses worker-computed values when enabled, falls back to legacy.
 */
export const geocodes: Readable<string[]> = derived(
  [useWorkerGeocodes, workerGeocodes, geocodes_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker;
    return $legacy;
  }
);

/**
 * Geocode counts store - uses worker-computed values when enabled.
 * Note: Worker returns Record<string, number>, legacy returns Map<string, number>
 */
export const geocodeCounts: Readable<Map<string, number>> = derived(
  [useWorkerGeocodes, workerGeocodeCounts, geocodeCounts_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Geocode percentages store - uses worker-computed values when enabled.
 */
export const geocodePercentages: Readable<Map<string, number>> = derived(
  [useWorkerGeocodes, workerGeocodePercentages, geocodePercentages_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Relays by geo store - uses worker-computed values when enabled.
 */
export const relaysByGeo: Readable<Map<string, string[]>> = derived(
  [useWorkerGeocodes, workerRelaysByGeo, relaysByGeo_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Softwares by geo store - uses worker-computed values when enabled.
 */
export const softwaresByGeo: Readable<Map<string, string[]>> = derived(
  [useWorkerGeocodes, workerSoftwaresByGeo, softwaresByGeo_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && Object.keys($worker).length > 0) {
      return new Map(Object.entries($worker));
    }
    return $legacy;
  }
);

/**
 * Geo rows store - uses worker-computed values when enabled.
 */
export const geoRows: Readable<GeoRow[]> = derived(
  [useWorkerGeocodes, workerGeoRows, geoRows_legacy],
  ([$useWorker, $worker, $legacy]) => {
    if ($useWorker && $worker.length > 0) return $worker;
    return $legacy as GeoRow[];
  }
);
