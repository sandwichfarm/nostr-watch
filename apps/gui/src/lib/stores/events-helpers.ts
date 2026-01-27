import { writable, derived, type Writable, type Readable, get } from "svelte/store";
import type Route66 from '@nostrwatch/route66'
import { Monitor, Nip66CheckEvent, type IEvent } from '@nostrwatch/route66/models'
import { StateManager } from "@nostrwatch/route66";
import { eventKey } from "$lib/utils/event-keys";
import { route66 } from "./route66.js";
import { events } from "./events";
import { tabState } from "./app";
import PQueue from 'p-queue';
import { delay } from '@nostrwatch/utils'
import { eventsStoreMemoryRelay } from "./memory-relays/memory-relay-events.js";
import { deterministicHash } from "@nostrwatch/route66/utils";
import { getLeaderTabRpcClient } from "$lib/runtime/leader-tab-client";
import {
    getSignatureVerificationService,
    stopSignatureVerificationService,
} from "$lib/services/SignatureVerificationService";
import { recordLeaderTabEvents } from "$lib/runtime/leader-tab-snapshot";

// Lazy-loaded blocklist filter to avoid circular dependency
// chain: checks.ts → monitors.ts → events-helpers.ts → blocklist.ts
let _filterBlockedEvents: ((events: IEvent[]) => IEvent[]) | null = null;

async function getFilterBlockedEvents() {
    if (!_filterBlockedEvents) {
        const { filterBlockedEvents } = await import("./blocklist");
        _filterBlockedEvents = filterBlockedEvents;
    }
    return _filterBlockedEvents;
}

// Synchronous filter that uses cached function or returns events as-is
function filterBlockedEventsSync(events: IEvent[]): IEvent[] {
    if (_filterBlockedEvents) {
        return _filterBlockedEvents(events);
    }
    return events;
}

// Pre-load the filter function
if (typeof window !== 'undefined') {
    getFilterBlockedEvents().catch(() => {});
}

const queue = new PQueue({concurrency: 1});

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const getMonitor = (pubkey: string): Monitor => {
    return $route66?.services?.monitors?.map.get(pubkey)
}

const testingUniques = new Set<string>();
const MAX_UNIQUE_BATCHES = 5000;

export const publishEventsToMemoryRelay = async (_events: IEvent[], from?: string) => {
    // if(from) console.log(`Memory Relay: Publishing ${_events.length} events to memory relay from ${from}`, deterministicHash(_events.map(eventKey)), _events);
    if(!_events || _events.length === 0) return
    if(!_events?.length) return;

    // Filter out events for blocked relays (uses cached function or no-op if not loaded yet)
    const filteredEvents = filterBlockedEventsSync(_events);
    if (filteredEvents.length === 0) return;
    if (filteredEvents.length !== _events.length) {
        console.log(`[blocklist] Filtered ${_events.length - filteredEvents.length} blocked relay events on ingress`);
    }

    const key = deterministicHash(filteredEvents.map( event => event.id));
    if(testingUniques.has(key)) return
    testingUniques.add(key);
    if (testingUniques.size > MAX_UNIQUE_BATCHES) {
        testingUniques.clear();
        testingUniques.add(key);
    }

    if (get(tabState) === 'leader') {
        try {
            recordLeaderTabEvents(filteredEvents);
        } catch {}
        try {
            getLeaderTabRpcClient().broadcast('events', filteredEvents);
        } catch {}
        try {
            const verifier = getSignatureVerificationService();
            if (verifier) void verifier.verifyEvents(filteredEvents, { kinds: [30166] });
        } catch {}
    }

    queue.add(async () => {
        await delay(20);
        get(eventsStoreMemoryRelay).eventBatch(filteredEvents)
    });
};

// Followers ingest leader-broadcast events into the local memory relay/stores.
if (typeof window !== 'undefined') {
    try {
        getLeaderTabRpcClient().onBroadcast((msg) => {
            if (msg.kind !== 'events') return;
            if (get(tabState) === 'leader') return;
            const events = msg.data as IEvent[] | undefined;
            if (!events?.length) return;
            void publishEventsToMemoryRelay(events, 'leader-broadcast');
        });
    } catch {}
}

// Ensure the signature verification worker pool doesn't survive a demotion.
if (typeof window !== 'undefined') {
    try {
        tabState.subscribe((role) => {
            if (role !== 'leader') {
                try {
                    stopSignatureVerificationService();
                } catch {}
            }
        });
    } catch {}
}
