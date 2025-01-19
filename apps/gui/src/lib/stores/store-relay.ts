import { writable, type Writable } from "svelte/store";
import type { Filter } from "nostr-tools";

import { events } from "../stores";
import type { IEvent } from "@nostrwatch/route66/models/Event";

export class StoreRelay {

    private _events: Map<string, IEvent> = new Map();

    constructor(){
        events.subscribe( (events) => this.events = events )
    }

    private set events (events: Map<string, IEvent>){
        this._events = events;
    }

    get events(){
        return this._events;
    }

    REQ(filters: Filter[]){
        const ret = [];
        for (const [, e] of this.events) {
            for (const filter of filters) {
                if (eventMatchesFilter(e, filter)) {
                    ret.push(e);
                }
            }
        }
        return ret;
    }

    COUNT(filters: Filter[]){
        return this.REQ(filters).length;
    }
}


//from worker relay, wet af
export function eventMatchesFilter(ev: IEvent, filter: Filter) {
    if (filter.since && ev.created_at && ev.created_at < filter.since) {
        return false;
    }
    if (filter.until && ev.created_at && ev.created_at > filter.until) {
        return false;
    }
    if (!(filter.ids?.includes(ev.id) ?? true)) {
        return false;
    }
    if (!(filter.authors?.includes(ev.pubkey) ?? true)) {
        return false;
    }
    if (!(filter.kinds?.includes(ev.kind) ?? true)) {
        return false;
    }
    const orTags = Object.entries(filter).filter(([k]) => k.startsWith("#"));
    for (const [k, v] of orTags) {
        const vargs = v as Array<string>;
        for (const x of vargs) {
        if (!ev.tags.find(a => a[0] === k.slice(1) && a[1] === x)) {
            return false;
        }
        }
    }
    const andTags = Object.entries(filter).filter(([k]) => k.startsWith("&"));
    for (const [k, v] of andTags) {
        const vargs = v as Array<string>;
        const allMatch = vargs.every(x => ev.tags.some(tag => tag[0] === k.slice(1) && tag[1] === x));
        if (!allMatch) {
        return false;
        }
    }
    return true;
}

export const storeRelay: Writable<StoreRelay> = writable(new StoreRelay());