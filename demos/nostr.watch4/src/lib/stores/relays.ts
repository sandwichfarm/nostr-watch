// import { writable, type Writable } from "svelte/store";


// import type { IRelay } from "@nostrwatch/nip66/models";

// export const relays: Writable<Map<string, IRelay>> = writable(new Map<string, IRelay>());


import { derived } from 'svelte/store';
import { events } from './events.js'; // Adjust the import path as necessary

export const relays = derived(events, ($events) => {
    const relayMap = new Map();

    $events.forEach((event) => {
        // Extract relay URL from the 'd' tag
        const dTag = event.tags.find((tag) => tag[0] === 'd');
        if (!dTag || !dTag[1]) return;

        const relayUrl = new URL(dTag[1]).toString();

        // Get network from the 'n' tag
        const nTag = event.tags.find((tag) => tag[0] === 'n');
        const network = nTag ? nTag[1] : null;

        // Create the relay object
        const relay = {
        relay: relayUrl,
        lastSeen: event.created_at,
        network,
        created_at: event.created_at,
        ignore: false,
        score: null,
        };

        // Add to the map to ensure uniqueness
        relayMap.set(relayUrl, relay);
    });

    // Return an array of unique relays
    return Array.from(relayMap.values());
});