import { NDK_CONTEXT } from "$lib/contextKeys";
import { profileStore } from "$lib/stores/profileStore";
import type { NDKUserProfile } from "@nostr-dev-kit/ndk";
import type NDK from "@nostr-dev-kit/ndk";
import { monitorDb } from "@nostrwatch/idb";
import { getContext } from "svelte";

let profiles: Map<string, NDKUserProfile> = new Map()

profileStore.subscribe( store => profiles = store )

export const updateProfiles = async (ndk: NDK) => {
  const monitors = await monitorDb.monitors.toArray()
  const profiles = new Map()
  monitors.forEach(async (monitor) => {
    const pubkey = monitor.monitorPubkey
    if(profiles.get(pubkey)) return
    const user = ndk.getUser({pubkey})
    await user.fetchProfile()
    profiles.set(pubkey, user.profile)
    console.log('profile', user.profile)
  }); 
  profileStore.set(profiles)
}