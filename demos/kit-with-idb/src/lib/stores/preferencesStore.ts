import { setContext } from 'svelte';
import { writable } from 'svelte/store';
import type { preferences } from '.';

export const preferencesStore = writable<Preferences>({});

export type Preferences = {
  primaryMonitor?: string;
  explicitRelayUrls?: string[];
}

const { update } = preferencesStore;

export const setPreference = ( key: string, value: any) => {
  update( store => {
    store[key] = value;
    return store;
  });
}

setPreference('primaryMonitor', 'abcde937081142db0d50d29bf92792d4ee9b3d79a83c483453171a6004711832');
setPreference('explicitRelayUrls', ['wss://purplepag.es', 'wss://user.kindpag.es', 'wss://relaypag.es', 'wss://history.nostr.watch'])