import { derived } from 'svelte/store';
import { eventsArray } from './events.js';
import { StateManager } from '@nostrwatch/nip66';

export const relays = derived(eventsArray, ($eventsArray) => {
    const relayMap = new Map();

    $eventsArray.forEach((event) => {
        const { tags, created_at, pubkey, content } = event
        const dTag = tags.find((tag) => tag[0] === 'd');
        if (!dTag || !dTag[1]) return;

        const relayUrl = new URL(dTag[1]).toString();

        const networkValue = tags.find((tag) => tag[0] === 'n')?.[1];
        const network = networkValue ? networkValue : null;

        const seenBy = event.pubkey

        if (relayMap.has(relayUrl)) {
            let existingRelay = relayMap.get(relayUrl);
            if (!existingRelay?.lastSeen || created_at > existingRelay.lastSeen) {
                existingRelay.lastSeen = created_at;
            }
            existingRelay.seenTimes += 1;
            existingRelay.seenBy.add(seenBy);
            relayMap.set(relayUrl, existingRelay);
        } else {
            relayMap.set(relayUrl, {
                relay: relayUrl,
                lastSeen: created_at,
                network,
                seenTimes: 1,
                seenBy: new Set()
            });
        }
    });

    const relaysArr = Array.from(relayMap.values());

    StateManager.set('aggregate:relays', relaysArr);

    return relaysArr;
});
