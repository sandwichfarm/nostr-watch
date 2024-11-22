import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66'

export const geocodes = throttledDerived(
  eventsArray, 
  ($eventsArray) => {
    if(!$eventsArray.length) return [];
    const codes = new Set();

    $eventsArray.forEach((event) => {
      codes.add(event.geocode);
    });

    return Array.from(codes);
  },
  1000
);