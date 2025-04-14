import { writable, derived, type Writable, type Readable, get } from "svelte/store";
import type Route66 from '@nostrwatch/route66'
import { Monitor, Nip66CheckEvent, type IEvent } from '@nostrwatch/route66/models'
import { StateManager } from "@nostrwatch/route66";
import { eventKey } from "$lib/utils/event-keys";
import { route66 } from "./route66.js";
import { events } from "./events";
import PQueue from 'p-queue';
import { delay } from '@nostrwatch/utils'
import { eventsStoreMemoryRelay } from "./memory-relays/memory-relay-events.js";
import { deterministicHash } from "@nostrwatch/route66/utils";

const queue = new PQueue({concurrency: 1});

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const getMonitor = (pubkey: string): Monitor => {
    return $route66?.services?.monitors?.map.get(pubkey)
}

const testingUniques = new Set<string>();

export const publishEventsToMemoryRelay = async (_events: IEvent[], from?: string) => {
    // if(from) console.log(`Memory Relay: Publishing ${_events.length} events to memory relay from ${from}`, deterministicHash(_events.map(eventKey)), _events);
    if(!_events?.length) return;
    const key = deterministicHash(_events.map( event => event.id));
    if(testingUniques.has(key)) return 
    testingUniques.add(key);
    queue.add(async () => {
        await delay(20);
        get(eventsStoreMemoryRelay).eventBatch(_events)
    });
};
