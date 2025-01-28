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

const queue = new PQueue({concurrency: 1});

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

const getMonitor = (pubkey: string): Monitor => {
    return $route66?.services?.monitors?.map.get(pubkey)
}

export const publishEventsToMemoryRelay = async (_events: IEvent[]) => {
    queue.add(async () => {
        await delay(20);
        get(eventsStoreMemoryRelay).eventBatch(_events)
    });
};
