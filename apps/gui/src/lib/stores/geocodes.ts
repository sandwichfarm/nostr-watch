
import { derived, get, type Readable } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { relayCheckAggregates } from './checks.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/route66';
import { Nip66CheckEvent } from '@nostrwatch/route66/models';
import type { lte } from 'lodash';
import { doAggregateCache } from './app.js';

export const geocodes: Readable<string[]> = derived(
  relayCheckAggregates, 
  ($relayCheckAggregates) => {
    if (!$relayCheckAggregates.length) return [];
    const codes: Set<string> = new Set();

    codes.add('unknown');

    $relayCheckAggregates.forEach((event: Nip66CheckEvent) => {
      if (event.geocode) {
        codes.add(event.geocode);
      }
    });

    let geocodesArray: string[] = Array.from(codes).sort();

    if(geocodesArray.length){
      if(get(doAggregateCache)) StateManager.set('aggregate:geocodes', geocodesArray);
    }
    else {
      geocodesArray = StateManager.get('aggregate:geocodes')
    }    

    return geocodesArray;
  }
);

export const geocodeCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const counts = new Map();
    $relayCheckAggregates.forEach((relayCheck) => {
        const geocode = relayCheck?.geocode || 'unknown';
        counts.set(geocode, (counts.get(geocode) || 0) + 1);
    });
    const countsObject = Object.fromEntries(counts);
    if(get(doAggregateCache)) StateManager.set('aggregate:geocodeCounts', countsObject);
    return counts;
});

export const geocodePercentages = derived(geocodeCounts, ($geocodeCounts) => {
    const total = Array.from($geocodeCounts.values()).reduce((sum, count) => sum + count, 0);
    const percentages = new Map();
    $geocodeCounts.forEach((count, geocode) => {
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        percentages.set(geocode, parseFloat(percent));
    });
    return percentages;
});

export const relaysByGeo: Readable<Map<string, string[]>> = derived(
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

export const geoRows = derived(
  [geocodes, geocodeCounts, geocodePercentages, relaysByGeo],
  ([$geocodes, $geocodeCounts, $geocodePercentages, $relaysByGeo]) => {
    const rows: Record<string, any> = [];
    $geocodes.forEach((geocode: string) => {
      const id = geocode;
      const count = $geocodeCounts.get(geocode) || 0;
      const percent = $geocodePercentages.get(geocode) || 0;
      const relays = $relaysByGeo.get(geocode) || [];
      const relaysCount = relays.length || 0;
      rows.push({ id, geocode, count, percent, relays, relaysCount });
    });
    return rows;
  }
);