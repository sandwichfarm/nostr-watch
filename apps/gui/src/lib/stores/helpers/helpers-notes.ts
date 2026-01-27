import { derived, get, type Readable } from "svelte/store";

import { eventsStoreMemoryRelay } from "$stores/memory-relays/memory-relay-events";
import type { SvelteMemoryRelay } from "@nostrwatch/memory-relay";

export const noteComments = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any> | undefined): OutputEvent[] => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    const events = memoryRelay.req(`${id}:comments`, [
        { kinds: [1, 1111], '#e': [id] },
        { kinds: [1111], '#E': [id] }
    ])
    return events ?? []
}

export const noteComments$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any> | undefined): Readable<OutputEvent[]> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        const events = memoryRelay.req(`${id}:comments`, [
            { kinds: [1, 1111], '#e': [id] },
            { kinds: [1111], '#E': [id] }
        ])
        return events ?? []
    })
}

export const noteCommentsCount$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any> | undefined): Readable<number> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        return memoryRelay.count([
            { kinds: [1, 1111], '#e': [id] },
            { kinds: [1111], '#E': [id] }
        ])
    })
}

export const noteZaps = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): OutputEvent[] => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    const events = memoryRelay.req(`${id}:zaps`, [{ kinds: [9735, 9321], '#e': [id] }])
    return events ?? []
}

export const noteZaps$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): Readable<OutputEvent[]> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        const events = memoryRelay.req(`${id}:zaps`, [{ kinds: [9735, 9321], '#e': [id] }])
        return events ?? []
    })
}

export const noteZapsCount$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): Readable<number> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        return memoryRelay.count([{ kinds: [9735, 9321], '#e': [id] }])
    })
}

export const noteReactions = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): OutputEvent[] => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    const events = memoryRelay.req(`${id}:reactions`, [{ kinds: [7], '#e': [id] }])
    return events ?? []
}

export const noteReactions$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): Readable<OutputEvent[]> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        const events = memoryRelay.req(`${id}:reactions`, [{ kinds: [7], '#e': [id] }])
        return events ?? []
    })
}

export const noteReactionsCount$ = <OutputEvent>(id: string, memoryRelay?: SvelteMemoryRelay<any, any, any, any, any>): Readable<number> => {
    memoryRelay = memoryRelay ?? get(eventsStoreMemoryRelay);
    return derived(memoryRelay.store, () => {
        return memoryRelay.count([{ kinds: [7], '#e': [id] }])
    })
}
