import type Route66 from '@nostrwatch/route66';
import { get } from 'svelte/store';
import { hasBeenBootstrapped, isBootstrapping, isLivesyncing, isSeeded, route66Ready } from '../stores/app';
import { instance } from './lifecycle';
import { stopLiveSync } from './live-sync'
import { StateManager } from '@nostrwatch/route66';
import { delay } from '@nostrwatch/utils';

export interface LocalStorageUsage {
    currentSizeMB: number;
    maxSizeMB: number;
    percentageUsed: number;
}

export const wipeCache = async () => {
    await route66Ready()
    const $route66 = await instance();
    await abortWebsocket($route66);
    await wipeCacheAdapter($route66);
    await wipeEventsStore();
    await wipeAppStores();
    await wipeEventsStore();
    $route66.destroy();
    await wipeState();
    StateManager.emit('wipe')
    await delay(1000)
    document.location = '/'
}

const abortWebsocket = async ($route66: Route66) => {
    if(get(isLivesyncing)) {
        await stopLiveSync()
    }
    $route66.adapters.websocketAdapter.unsubscribeAll();
    $route66.adapters.websocketAdapter.abort();
}

export const wipeCacheAdapter = async ($route66: Route66) => {
    await $route66.adapters.cacheAdapter.WIPE();
}

export const wipeState = async () => {
    const StateManager = (await import('@nostrwatch/route66')).StateManager;
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

export type ObjectSizeType = { size: number, unit: 'bytes' | 'KB' | 'MB' }

export const calculateSize = (input: any): ObjectSizeType => {
    function getSizeInBytes(value: any): number {
        const objectList = new Set();
        const stack = [value];
        let bytes = 0;

        while (stack.length) {
            const currentValue = stack.pop();

            if (currentValue === null || currentValue === undefined) {
                bytes += 0;
            } else if (typeof currentValue === 'boolean') {
                bytes += 4;
            } else if (typeof currentValue === 'string') {
                bytes += currentValue.length * 2;
            } else if (typeof currentValue === 'number') {
                bytes += 8;
            } else if (typeof currentValue === 'object') {
                if (!objectList.has(currentValue)) {
                    objectList.add(currentValue);
                    for (const key in currentValue) {
                        if (currentValue.hasOwnProperty(key)) {
                            bytes += key.length * 2;
                            stack.push(currentValue[key]);
                        }
                    }

                    if (currentValue instanceof Map) {
                        currentValue.forEach((v, k) => {
                            stack.push(k);
                            stack.push(v);
                        });
                    } else if (currentValue instanceof Set) {
                        currentValue.forEach(v => stack.push(v));
                    } else if (Array.isArray(currentValue)) {
                        stack.push(...currentValue);
                    }
                }
            }
        }

        return bytes;
    }

    const bytes = getSizeInBytes(input);

    if (bytes >= 1024 * 1024) {
        return { size: bytes / (1024 * 1024), unit: 'MB' };
    } else if (bytes >= 1024) {
        return { size: bytes / 1024, unit: 'KB' };
    } else {
        return { size: bytes, unit: 'bytes' };
    }
}