import type Nip66 from '@nostrwatch/nip66';
import { get } from 'svelte/store';
import { hasBeenBoostrapped, isBootstrapping, isLivesyncing, isSeeded, nip66Ready } from '../stores/app';
import { instance, stopLiveSync } from './lifecycle';
import { StateManager } from '@nostrwatch/nip66';
import { delay } from '@nostrwatch/utils';

export interface LocalStorageUsage {
    currentSizeMB: number;
    maxSizeMB: number;
    percentageUsed: number;
}

export const wipeCache = async () => {
    await nip66Ready()
    const $nip66 = await instance();
    await abortWebsocket($nip66);
    await wipeCacheAdapter($nip66);
    await wipeEventsStore();
    await wipeAppStores();
    await wipeEventsStore();
    $nip66.destroy();
    await wipeState();
    StateManager.emit('wipe')
    await delay(1000)
    document.location = '/'
}

const abortWebsocket = async ($nip66: Nip66) => {
    if(get(isLivesyncing)) {
        await stopLiveSync()
    }
    $nip66.adapters.websocketAdapter.unsubscribeAll();
    $nip66.adapters.websocketAdapter.abort();
}

export const wipeCacheAdapter = async ($nip66: Nip66) => {
    $nip66.adapters.cacheAdapter.WIPE();
}

export const wipeState = async () => {
    const StateManager = (await import('@nostrwatch/nip66')).StateManager;
    StateManager.clear();
}

export const wipeEventsStore = async () => {
    const { events } = (await import('$lib/stores/index.js'))
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