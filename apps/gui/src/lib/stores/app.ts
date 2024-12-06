import { StateManager } from "@nostrwatch/nip66";
import type { Readable, Writable } from "svelte/store";
import { readable, writable, derived, get } from "svelte/store";


export const lastCompleteSync: Writable<number> = writable(StateManager.get('lastCompleteSync') ?? 0)

export const updateLastSync = () => {
    const now = Math.round(Date.now()/1000)
    lastCompleteSync.set(now)
    StateManager.set('lastCompleteSync', now)
}

export const shouldSync = () => {
    const threshold = 60*60*30
    const timestamp = get(lastCompleteSync)
    const now = Math.round(Date.now()/1000)
    if(threshold<now-timestamp)
        return true;
    return false; 
}