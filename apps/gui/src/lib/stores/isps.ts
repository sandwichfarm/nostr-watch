
import { derived } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { relayAggregates } from './checks.js'; 
import { StateManager } from '@nostrwatch/nip66';

export type StoreIsp = {
    title: string;
    as: string;
    asname: string;
};

export const isps = derived(eventsArray, ($eventsArray) => {
    const ispsMap = new Map();
    $eventsArray.forEach((event) => {
        if (event?.asname) {
            ispsMap.set(event.asname.toLowerCase(), {
                title: event.isp,
                as: event.as,
                asname: event.asname
            });
        }
    });
    const ispsArray = Array.from(ispsMap.values()).sort((a, b) => a.asname.localeCompare(b.asname));
    StateManager.set('aggregate:isps', ispsArray);
    return ispsArray;
});

export const ispCounts = derived(relayAggregates, ($relayAggregates) => {
    const counts = new Map();

    $relayAggregates.forEach((relayCheck) => {
        const isp = relayCheck?.isp || 'unknown';
        counts.set(isp, (counts.get(isp) || 0) + 1);
    });

    if(!Array.from(counts.keys()).length) {
        const cachedCounts = StateManager.get('aggregate:ispCounts')
        if(cachedCounts && cachedCounts?.length) {
            for(const [isp, count] of cachedCounts){
                counts.set(isp, count);
            }
        }
    } else {
        StateManager.set('aggregate:ispCounts', Object.fromEntries(counts));
    }
    
    return counts;
});

export const ispPercentages = derived(ispCounts, ($ispCounts) => {
    const total = Array.from($ispCounts.values()).reduce((sum, count) => sum + count, 0);
    const percentages = new Map();

    $ispCounts.forEach((count, isp) => {
        const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        percentages.set(isp, parseFloat(percent));
    });

    return percentages;
});