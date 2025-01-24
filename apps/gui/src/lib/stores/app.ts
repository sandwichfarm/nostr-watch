import { StateManager } from "@nostrwatch/route66";
import type { Readable, Writable } from "svelte/store";
import { readable, writable, derived, get } from "svelte/store";
import { formatSeconds, timeAgo } from "../utils/time";
import { route66 } from "./route66";
import { delay } from "@nostrwatch/utils";

export type AppStateType = 'booting' | 'running' | 'shutdown'
export const appState: Writable<AppStateType> = writable()

export type TabStateType = 'idle' | 'leader' | 'follower' | 'unsupported';
export const tabState: Writable<TabStateType> = writable('follower');

export const isIdle: Writable<boolean> = writable(false)

export const route66Initialized: Readable<boolean> = derived( route66, ($route66) => $route66?.initialized? true: false )
export const unsupported: Writable<boolean> = writable(false)
export const isLivesyncing: Writable<boolean> = writable(false)
export const isBootstrapping: Writable<boolean> = writable(false)
export const lastCompleteSync: Writable<number> = writable(StateManager.get('lastCompleteSync') ?? 0)

export const darkMode: Writable<boolean> = writable(false)

darkMode.set(window.matchMedia('(prefers-color-scheme: dark)').matches);

const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

darkModeQuery.addEventListener('change', (event) => {
  if (event.matches) {
    darkMode.set(true);
  } else {
    darkMode.set(false);
  }
});

export const route66Ready = async () => {
    while(!get(route66Initialized)) {
        await delay(200);
    }
}

StateManager.on('wipe', () => { lastCompleteSync.set(0) })

export const updateLastSync = () => {
    const now = Math.round(Date.now()/1000)
    lastCompleteSync.set(now)
    StateManager.set('lastCompleteSync', now)
    isSeeded.set(true)
}

export const shouldSync = () => {
    const threshold = 60*30
    // const threshold = 1*15
    const timestamp = get(lastCompleteSync)
    const now = Math.round(Date.now()/1000)
    //console.log('should sync?', threshold<(now-timestamp), formatSeconds(threshold), timeAgo(now*1000), timeAgo(timestamp*1000))
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

