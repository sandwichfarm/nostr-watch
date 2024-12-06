import type Nip66 from '@nostrwatch/nip66';

export interface LocalStorageUsage {
    currentSizeMB: number;
    maxSizeMB: number;
    percentageUsed: number;
}

export const wipeCache = async () => {
    await wipeCacheAdapter();
    await wipeState();
    await wipeEventsStore();
}

export const wipeCacheAdapter = async () => {
    const instance = (await import('$lib/utils/lifecycle.js')).instance;
    const n66: Nip66 = await instance();
    n66.cacheAdapter.WIPE();
}

export const wipeState = async () => {
    const StateManager = (await import('@nostrwatch/nip66')).StateManager;
    StateManager.clear();
}

export const wipeEventsStore = async () => {
    const events = (await import('$lib/stores/index.js')).events;
    events.set(new Map());
}


  
export const getLocalStorageUsage = (maxSizeMB: number = 5): LocalStorageUsage => {
    let totalBytes = 0;
    for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
            totalBytes += (key.length + value.length) * 2;
        }
        }
    }
    const currentSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    const percentageUsed = parseFloat(((currentSizeMB / maxSizeMB) * 100).toFixed(2));
    return {
        currentSizeMB,
        maxSizeMB,
        percentageUsed,
    };
}