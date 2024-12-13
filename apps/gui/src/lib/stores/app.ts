import { StateManager } from "@nostrwatch/nip66";
import type { Readable, Writable } from "svelte/store";
import { readable, writable, derived, get } from "svelte/store";
import { formatSeconds, timeAgo } from "../utils/time";


export const isBootstrapping: Writable<boolean> = writable(false)
export const lastCompleteSync: Writable<number> = writable(StateManager.get('lastCompleteSync') ?? 0)

StateManager.on('wipe', () => { lastCompleteSync.set(0) })

export const updateLastSync = () => {
    const now = Math.round(Date.now()/1000)
    lastCompleteSync.set(now)
    StateManager.set('lastCompleteSync', now)
    isSeeded.set(true)
}

export const shouldSync = () => {
    const threshold = 60*30
    const timestamp = get(lastCompleteSync)
    const now = Math.round(Date.now()/1000)
    console.log('should snyc?', threshold<(now-timestamp), formatSeconds(60*30), timeAgo(now*1000), timeAgo(timestamp*1000))
    if(threshold<(now-timestamp))
        return true;
    return false; 
}

export const hasBeenBoostrapped = (): boolean => {
    return StateManager.get('lastCompleteSync')? true: false
}

export const isSeeded: Writable<boolean> = writable(false)    

export const hasBeenSeeded = (): boolean => {
    return get(isSeeded)    
}

export const doAggregateCache: Writable<boolean> = writable(false)

export const shouldAggregate = (): boolean => {
    return !get(doAggregateCache)
}
