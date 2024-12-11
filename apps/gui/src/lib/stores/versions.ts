import { get } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { throttledDerived } from '$lib/utils/stores.js';
import { StateManager } from '@nostrwatch/nip66';
import { doAggregateCache } from './app.js';

export const versions = throttledDerived(eventsArray, ($eventsArray) => {
    const versions = new Set();

    $eventsArray.forEach((check) => {
        if(check?.version)
            versions.add(check.version);
    });
    let finalVersions = Array.from(versions).sort()
    if(finalVersions.length){
        if(get(doAggregateCache)) StateManager.set('aggregate:versions', finalVersions);
    }
    else {
        finalVersions = StateManager.get('aggregate:versions')
    }
    return finalVersions
});