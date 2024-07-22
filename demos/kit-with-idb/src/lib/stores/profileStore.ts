import NDK from "@nostr-dev-kit/ndk";
import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import { liveQuery, monitorDb } from "@nostrwatch/idb";
import { writable } from "svelte/store";

export type ProfileStore = Map<string, NDKUserProfile>

const profileData = writable(new Map());

export function profiles() {
  const { subscribe, set, update } = profileData

  const sync = async (): Promise<void> => {}

  return {
    subscribe,
    set,
    update,
    sync
  }
}

export const profileStore = profiles()

// liveQuery( () => monitorDb.monitors.toArray()).subscribe( () => profileStore.sync() );
