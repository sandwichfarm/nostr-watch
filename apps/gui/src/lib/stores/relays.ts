import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates } from './checks.js';
import { doAggregateCache } from './app.js';

export const relays = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const relays = new Set();

    $relayCheckAggregates.forEach((relayAggregate) => {
        const { created_at, relay, network, monitorPubkey } = relayAggregate
        if (!relay) return console.warn('derived relays: no relay', relayAggregate);
        try {
            const normalized = new URL(relay).toString()
            if(relays.has(normalized)){
                const matches = $relayCheckAggregates.filter( aggregate => aggregate.relay === normalized || aggregate.relay === relay)
                console.warn('derived relays: duplicate', matches?.length, matches);    
                return;
            }
            relays.add(normalized);
        }
        catch(e){
            console.warn('derived relays: error', e)
        }
    });

    let relaysArr = Array.from(relays);

    if(relaysArr.length){
        if(get(doAggregateCache)) StateManager.set('aggregate:relays', relaysArr);
    }
    else {
        relaysArr = StateManager.get('aggregate:relays')
    } 

    return relaysArr;
});
