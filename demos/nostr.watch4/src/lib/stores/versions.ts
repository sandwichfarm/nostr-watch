import { derived } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66';

export const versions = throttledDerived(eventsArray, ($eventsArray) => {
    const versions = new Set();

    $eventsArray.forEach((check) => {
        if(check?.version)
            versions.add(check.version);
    });
    const finalVersions = Array.from(versions).sort()
    StateManager.set('aggregate:versions', finalVersions);
    return finalVersions
});