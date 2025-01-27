
import { derived, get, type Readable } from 'svelte/store';
import { eventsArray } from './events.js'; 
import { relayCheckAggregates, relayChecks } from './checks.js'; 
import { StateManager } from '@nostrwatch/route66';
import { doAggregateCache } from './app.js';
import softwares from '../config/dataTable/softwares.js';

export type StoreIsp = {
    title: string;
    as: string;
    asname: string;
};

export const isps: Readable<StoreIsp[]> = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const ispsMap = new Map();
    $relayCheckAggregates.forEach((event) => {
        if (event?.asname) {
            ispsMap.set(event.asname, {
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

export const softwaresByIsp: Readable<Map<string, string[]>> = derived(
    [relayCheckAggregates],
    ([$relayCheckAggregates]) => {
        const softwaresByIsp: Map<string, string[] | Set<string>> = new Map();
        $relayCheckAggregates.forEach((relayCheck) => {
            const isp = relayCheck?.isp || 'unknown';
            const softwares = softwaresByIsp.get(isp) || new Set();
            if((softwares as Set<string>).has(relayCheck.software)) return;
            (softwares as Set<string>).add(relayCheck.software);
            softwaresByIsp.set(isp, softwares);
        });
        // console.log(softwaresByIsp, 'softwaresByIsp')
        softwaresByIsp.forEach((softwares, isp) => {
            softwaresByIsp.set(isp, Array.from(softwares));
        })
        return softwaresByIsp as Map<string, string[]>;
    }
);

export const ispRows = derived(
    [isps, ispCounts, ispPercentages, softwaresByIsp], 
    ([$isps, $ispCounts, $ispPercentages, $softwaresByIsp]) => {
    const rows = $isps.map((isp) => {
        const count = $ispCounts.get(isp.title) || 0;
        const percent = $ispPercentages.get(isp.title) || 0;
        const softwares = $softwaresByIsp.get(isp.title) || [];
        const softwaresCount = softwares?.length;
        const { title:prettyName, asname, as } = isp;
        return {
            id: as,
            prettyName,
            asname, 
            as,
            count,
            percent,
            softwares,
            softwaresCount
        };
    });
    return rows;
})