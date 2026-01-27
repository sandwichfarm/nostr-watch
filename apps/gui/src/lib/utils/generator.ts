import { get, type Writable } from "svelte/store";

import type { WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/route66/core";
import type { IEvent } from "@nostrwatch/route66/models";

import { route66 } from "../stores";
import { storeRelay, type eventsStoreMemoryRelay } from "../stores/memory-relays/memory-relay-events";
import type { Route66 } from "@nostrwatch/route66";
import { instance } from "./lifecycle";
import type { Filter } from "nostr-tools";

const defaultOptions: WebsocketAdapterOptions = {
    cache: true,
    stream: true,
    returnResults: true,
    keepAlive: false
};

export async function* subscribe(
    filters: Filter[],
    relays?: string[],
    opts: Partial<WebsocketAdapterOptions> = {}
) {
    yield* generate("subscribe", filters, relays, opts);
}

export async function* fetch(
    filters: Filter[],
    relays?: string[],
    opts: Partial<WebsocketAdapterOptions> = {}
) {
    yield* generate("fetch", filters, relays, opts);
}

async function* generate(
    which: "fetch" | "subscribe",
    filters: Filter[],
    relays?: string[],
    opts: Partial<WebsocketAdapterOptions> = {}
) {
    const $route66: Route66 | null = get(route66) ?? await instance().catch((err) => {
        console.error("Error initializing Route66 instance:", err);
        return null;
    });

    if (!$route66) {
        throw new Error("Route66 instance could not be initialized.");
    }

    const $storeRelay: typeof eventsStoreMemoryRelay = get(storeRelay);

    relays = relays || [];
    const priority = 100;

    const options: WebsocketAdapterOptions = { ...defaultOptions, ...opts };
    const args: WebsocketRequestBody = {
        filters,
        relays,
        options,
        priority
    };

    const eventQueue: IEvent[][] = [];
    const resolveQueuePromises: (() => void)[] = [];
    let isComplete = false;

    const generator = async function* () {
        while (!isComplete || eventQueue.length > 0) {
            if (eventQueue.length > 0) {
                const events = eventQueue.shift();
                if (events) {
                    for (const event of events) {
                        yield event;
                    }
                }
            } else {
                await new Promise<void>((resolve) => {
                    resolveQueuePromises.push(resolve);
                });
            }
        }
    };

    const onevents = (events: IEvent[]) => {
        eventQueue.push(events);
        while (resolveQueuePromises.length > 0) {
            const resolve = resolveQueuePromises.shift();
            if (resolve) resolve();
        }
    };

    const onevent = (event: IEvent) => {
        eventQueue.push([event]);
        while (resolveQueuePromises.length > 0) {
            const resolve = resolveQueuePromises.shift();
            if (resolve) resolve();
        }
    };

    const oneose = () => {
        if(!options.keepAlive) {
            isComplete = true;    
        }
        while (resolveQueuePromises.length > 0) {
            const resolve = resolveQueuePromises.shift();
            if (resolve) resolve();
        }
    };

    const storeEvents = $storeRelay.req(filters);
    if (storeEvents?.length) {
        onevents(storeEvents);
    }

    try {
        await $route66.ready();
        $route66
            [which as keyof Route66](args, { onevent, onevents, oneose })
            .catch((err: any) => {
                console.error(`Error during ${which}:`, err);
            });
    } catch (err: any) {
        console.error(`Error initializing ${which}:`, err);
        throw err;
    }

    yield* generator();
}
