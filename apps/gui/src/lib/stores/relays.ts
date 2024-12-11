import { derived, get } from 'svelte/store';
import { eventsArray } from './events.js';
import { StateManager } from '@nostrwatch/nip66';
import { relayAggregates } from './checks.js';
import { doAggregateCache } from './app.js';

export const relays = derived(relayAggregates, ($relayAggregates) => {
    const relays = new Set();

    $relayAggregates.forEach((relayAggregate) => {
        const { created_at, relay, network, monitorPubkey } = relayAggregate
        if (!relay) return;
        try {
            relays.add(new URL(relay).toString());
        }
        catch(e){""}
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
