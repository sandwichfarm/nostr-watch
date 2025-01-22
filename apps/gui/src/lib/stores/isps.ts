
import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { relayCheckAggregates, relayChecks } from './checks.js'; 
import { StateManager } from '@nostrwatch/route66';
import { doAggregateCache } from './app.js';

export type StoreIsp = {
    title: string;
    as: string;
    asname: string;
};

export const isps = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const ispsMap = new Map();
    $relayCheckAggregates.forEach((event) => {
        if (event?.asname) {
            ispsMap.set(event.asname.toLowerCase(), {
                title: event.isp,
                as: event.as,
                asname: event.asname
            });
        }
    });
    let ispsArray = Array.from(ispsMap.values()).sort((a, b) => a.asname.localeCompare(b.asname));
    if(ispsArray.length) {
        if(get(doAggregateCache)) StateManager.set('aggregate:isps', ispsArray);
    }
    else {
        ispsArray = StateManager.get('aggregate:isps');
    }
    
    return ispsArray;
});

export const ispCounts = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const counts = new Map();

    $relayCheckAggregates.forEach((relayCheck) => {
        const isp = relayCheck?.isp || 'unknown';
        counts.set(isp, (counts.get(isp) || 0) + 1);
    });

    let countsLength = !Array.from(counts.keys()).length

    if(countsLength) {
        const cachedCounts = StateManager.get('aggregate:ispCounts')
        if(cachedCounts && cachedCounts?.length) {
            for(const [isp, count] of cachedCounts){
                counts.set(isp, count);
            }
        }
    } else {
        if(get(doAggregateCache)) StateManager.set('aggregate:ispCounts', Object.fromEntries(counts));
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