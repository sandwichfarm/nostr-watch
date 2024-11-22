import { derived } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { stringify } from 'postcss';
import { StateManager } from '@nostrwatch/nip66';

export type StoreIsp = {
    title: string;
    as: string;
    asname: string;
}

export const isps = derived(eventsArray, ($eventsArray) => {
    const isps: Map<string, StoreIsp> = new Map()
    $eventsArray.forEach((event) => {
        if(event?.asname)
            isps.set(event?.asname, {title: event.isp, as: event.as, asname: event.asname});
    });
    StateManager.set('aggregate:isps', Array.from(isps.values()));
    return Array.from(isps.values());
});