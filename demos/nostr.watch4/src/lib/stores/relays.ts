import { derived } from 'svelte/store';
import { eventsArray } from './events.js';

export const relays = derived(eventsArray, ($eventsArray) => {
    const relayMap = new Map();

    $eventsArray.forEach((event) => {
        const dTag = event.tags.find((tag) => tag[0] === 'd');
        if (!dTag || !dTag[1]) return;

        const relayUrl = new URL(dTag[1]).toString();

        const networkValue = event.tags.find((tag) => tag[0] === 'n')?.[1];
        const network = networkValue ? networkValue : null;

        const seenBy = event.pubkey

        if (relayMap.has(relayUrl)) {
            let existingRelay = relayMap.get(relayUrl);
            if (event.created_at > existingRelay.lastSeen) {
                existingRelay.lastSeen = event.created_at;
            }
            existingRelay.seenTimes += 1;
            existingRelay.seenBy.add(seenBy);
            relayMap.set(relayUrl, existingRelay);
        } else {
            relayMap.set(relayUrl, {
                relay: relayUrl,
                lastSeen: event.created_at,
                network,
                seenTimes: 1,
                seenBy: new Set()
            });
        }
    });

    return Array.from(relayMap.values());
});
