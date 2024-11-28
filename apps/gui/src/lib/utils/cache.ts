import type Nip66 from '@nostrwatch/nip66';

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