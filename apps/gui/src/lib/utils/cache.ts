import type Nip66 from '@nostrwatch/nip66';
import { get } from 'svelte/store';
import { hasBeenBoostrapped, isBootstrapping, isSeeded } from '../stores/app';
import { instance } from './lifecycle';
import { StateManager } from '@nostrwatch/nip66';
import { events } from '../stores';

export interface LocalStorageUsage {
    currentSizeMB: number;
    maxSizeMB: number;
    percentageUsed: number;
}

export const wipeCache = async () => {
    await abortWebsocket();
    await wipeState();
    await wipeCacheAdapter();
    await wipeEventsStore();
    await wipeAppStores();
    await wipeEventsStore();
    StateManager.emit('wipe')
}

const abortWebsocket = async () => {
    if(get(isBootstrapping)) {
        const $nip66 = await instance();
        $nip66.adapters.websocketAdapter.unsubscribe();
        $nip66.adapters.websocketAdapter.abort();
    }
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

const getObjectType = (obj: any) => Object.prototype.toString.call(obj).slice(8, -1);

export const wipeAppStores = async () => {
    isBootstrapping.set(false)
    isSeeded.set(false)
}

export const wipeStores = async () => {
    const stores = (await import('$lib/stores/index.js'));
    stores.forEach( (store: any) => { 
        const $store = get(store);
        const type = typeof $store === 'object' ? getObjectType($store): typeof $store;
        switch(type){
            case 'boolean':
                store.set(false);
                break;
            case 'number':
                store.set(0);
                break;
            case 'string':
                store.set('');
                break;
            case 'object':
                store.set({});
                break;
            case 'array':
                store.set([]);
                break;
            default:
                store.set(null);
        }
        
    });
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