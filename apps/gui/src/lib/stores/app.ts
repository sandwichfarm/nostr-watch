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

function normalizeSyncSeconds(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
}

export const lastCompleteSync: Writable<number> = writable(normalizeSyncSeconds(StateManager.get('lastCompleteSync')));

const STATS_AS_OF_KEY = "stats:asOf";

function normalizeStatsAsOf(value: unknown): number {
    const numeric = normalizeSyncSeconds(value);
    if (numeric) return numeric;

    // Back-compat: allow ISO strings (e.g. seed `generatedAt`) to seed the reference.
    if (typeof value === "string") {
        const ms = Date.parse(value);
        if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 1000);
    }

    return 0;
}

function readStatsAsOf(): number {
    try {
        const direct = normalizeStatsAsOf(StateManager.get(STATS_AS_OF_KEY));
        if (direct) return direct;
    } catch {}

    // Fall back to last known "complete" sync marker if present.
    try {
        const fromLastSync = normalizeSyncSeconds(StateManager.get("lastCompleteSync"));
        if (fromLastSync) return fromLastSync;
    } catch {}

    // Fall back to seed build timestamp if available.
    try {
        const seededAt = StateManager.get("seed:build:generatedAt");
        return normalizeStatsAsOf(seededAt);
    } catch {}

    return 0;
}

// Stable reference timestamp for UI liveness + "cached stats" display.
// This MUST NOT advance during an in-flight sync; it should only update when a sync is considered "complete".
export const statsAsOf: Writable<number> = writable(readStatsAsOf());

export function setStatsAsOf(nextSeconds: number, opts: { persist?: boolean } = {}): void {
    const next = normalizeSyncSeconds(nextSeconds);
    if (!next) return;

    const current = get(statsAsOf);
    if (next <= current) return;

    statsAsOf.set(next);

    const shouldPersist = opts.persist ?? (get(tabState) === "leader");
    if (!shouldPersist) return;
    try {
        StateManager.set(STATS_AS_OF_KEY, next);
    } catch {}
}

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
        await delay(100);
    }
}

StateManager.on('wipe', () => {
    lastCompleteSync.set(0);
    statsAsOf.set(0);
})

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

function hasNonEmptyArrayCache(key: string): boolean {
    try {
        const value = StateManager.get(key);
        return Array.isArray(value) && value.length > 0;
    } catch {
        return false;
    }
}

function hasPositiveNumberCache(key: string): boolean {
    try {
        const value = Number(StateManager.get(key));
        return Number.isFinite(value) && value > 0;
    } catch {
        return false;
    }
}

export const hasUsableCachedData = (): boolean => {
    try {
        if (StateManager.get('aggregate:complete')) return true;
    } catch {}

    return (
        hasPositiveNumberCache('count:events:checks') ||
        hasNonEmptyArrayCache('cache:monitors') ||
        hasNonEmptyArrayCache('aggregate:relays') ||
        hasNonEmptyArrayCache('relays:minisearch') ||
        hasNonEmptyArrayCache('aggregate:operators')
    );
}

export type BootstrapGateState = {
    bootstrapped: boolean;
    seeded: boolean;
    seedBootStatus: 'idle' | 'in_progress' | 'complete' | 'error';
    hasUsableCache: boolean;
}

export const shouldRequireSeedBootstrap = (state: BootstrapGateState): boolean => {
    const seedReady = state.seeded || state.seedBootStatus === 'complete';
    const freshState = !state.bootstrapped && !state.seeded && !state.hasUsableCache;
    return freshState && !seedReady;
}

export const shouldForceFullBootstrap = (state: {
    bootstrapped: boolean;
    hasUsableCache: boolean;
    opfsStatus: OpfsStatusType;
}): boolean => {
    if (state.opfsStatus === 'fallback' || state.opfsStatus === 'error') return true;
    return !state.bootstrapped && !state.hasUsableCache;
}

export const hasBeenBootstrapped = (): boolean => {
    // Check for both 'sync:all' (re-sync) and 'sync:all-force' (fresh bootstrap)
    return StateManager.get('register:sync:all') || StateManager.get('register:sync:all-force') ? true : false
}

export const isBootstrapped: Writable<boolean> = writable(hasBeenBootstrapped())

// Initialize isSeeded based on whether seed data was previously imported
const checkIfSeeded = (): boolean => {
    // If seed:build:generatedAt exists, seed data has been imported
    return !!StateManager.get('seed:build:generatedAt');
}
export const isSeeded: Writable<boolean> = writable(checkIfSeeded())
export const hasBeenSeeded = (): boolean => {
    return get(isSeeded)
}

function storageKey(key: string): string {
    const prefix = (StateManager as any)?.localStorage?.prefix ?? "state";
    return `${prefix}:${key}`;
}

// Keep cross-tab bootstrap/seed flags in sync (leader tab writes, followers react).
if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (!event.key) return;
        if (event.key === storageKey("seed:build:generatedAt")) {
            isSeeded.set(checkIfSeeded());
        }
        if (
            event.key === storageKey("register:sync:all") ||
            event.key === storageKey("register:sync:all-force")
        ) {
            isBootstrapped.set(hasBeenBootstrapped());
        }
        if (event.key === storageKey("lastCompleteSync")) {
            lastCompleteSync.set(normalizeSyncSeconds(StateManager.get("lastCompleteSync")));
        }
        if (event.key === storageKey(STATS_AS_OF_KEY)) {
            statsAsOf.set(normalizeStatsAsOf(StateManager.get(STATS_AS_OF_KEY)));
        }
    });
}

export const doAggregateCache: Writable<boolean> = writable(true)

export const shouldAggregate = (): boolean => {
    return !get(doAggregateCache)
}

// OPFS/SQLite status tracking
export type OpfsStatusType = 'pending' | 'online' | 'fallback' | 'error';
export const opfsStatus: Writable<OpfsStatusType> = writable('pending');
export const opfsError: Writable<string | null> = writable(null);
