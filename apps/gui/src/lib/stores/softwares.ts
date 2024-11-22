import { derived } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66';

export const softwares = throttledDerived(eventsArray, ($eventsArray) => {
  const software = new Set();

  $eventsArray.forEach((check) => {
    if(check?.software)
        software.add(check.software);
  });

  const softwares = Array.from(software).sort()

  StateManager.set('aggregate:softwares', softwares);

  return softwares;
});