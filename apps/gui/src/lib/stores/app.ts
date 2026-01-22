import { StateManager } from "@nostrwatch/route66";
import type { Readable, Writable } from "svelte/store";
import { writable, derived, get } from "svelte/store";
import { route66 } from "./route66";
import { delay } from "@nostrwatch/utils";
import { isProduction } from "./env";

export type AppStateType = 'booting' | 'running' | 'shutdown'
export const appState: Writable<AppStateType> = writable()

export type TabStateType = 'idle' | 'active' | 'inactive' | 'leader' | 'follower' | 'unsupported';
export const tabState: Writable<TabStateType> = writable('follower');

export const isIdle: Writable<boolean> = writable(false)

export const route66Initialized: Readable<boolean> = derived( route66, ($route66) => $route66?.initialized? true: false )
export const unsupported: Writable<boolean> = writable(false)
export const doLiveSync: Writable<boolean> = writable(true) 
export const isLivesyncing: Writable<boolean> = writable(false)
export const isBootstrapping: Writable<boolean> = writable(false)
export const lastCompleteSync: Writable<number> = writable(StateManager.get('lastCompleteSync') ?? 0)

export const darkMode: Writable<boolean> = writable(false)
let darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

//HOTFIX: force dark mode in production
if(isProduction()) {
    darkMode.set(true)
}
else {
    darkMode.set(darkModeQuery.matches);
}

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

// export const updateLastSync = () => {
//     const now = Math.round(Date.now()/1000)
//     lastCompleteSync.set(now)
//     StateManager.set('lastCompleteSync', now)
//     isSeeded.set(true)   
// }

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

export const hasBeenBootstrapped = (): boolean => {
    // Check for both 'sync:all' (re-sync) and 'sync:all-force' (fresh bootstrap)
    return StateManager.get('register:sync:all') || StateManager.get('register:sync:all-force') ? true : false
}

export const isBootstrapped: Writable<boolean> = writable(hasBeenBootstrapped())
export const isSeeded: Writable<boolean> = writable(false)    
export const hasBeenSeeded = (): boolean => {
    return get(isSeeded)    
}

export const doAggregateCache: Writable<boolean> = writable(true)

export const shouldAggregate = (): boolean => {
    return !get(doAggregateCache)
}

// OPFS/SQLite status tracking
export type OpfsStatusType = 'pending' | 'online' | 'fallback' | 'error';
export const opfsStatus: Writable<OpfsStatusType> = writable('pending');
export const opfsError: Writable<string | null> = writable(null);

