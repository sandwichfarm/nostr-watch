
import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { relayAggregates } from './checks.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66';
import { Nip66Event } from '@nostrwatch/nip66/models';
import type { lte } from 'lodash';
import { doAggregateCache } from './app.js';

export const geocodes = derived(
  relayAggregates, 
  ($relayAggregates) => {
    if (!$relayAggregates.length) return [];
    const codes = new Set();

    $relayAggregates.forEach((event: Nip66Event) => {
      if (event.geocode) {
        codes.add(event.geocode.toLowerCase());
      }
    });

    let geocodesArray = Array.from(codes).sort();

    if(geocodesArray.length){
      if(get(doAggregateCache)) StateManager.set('aggregate:geocodes', geocodesArray);
    }
    else {
      geocodesArray = StateManager.get('aggregate:geocodes')
    }    

    return geocodesArray;
  }
);

export const geocodeCounts = derived(relayAggregates, ($relayAggregates) => {
    const counts = new Map();
    $relayAggregates.forEach((relayCheck) => {
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
