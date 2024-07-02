import { writable } from "svelte/store";
import { NDKRelayMeta } from "@nostr-dev-kit/ndk";

export const relayMetaStore = writable<NDKRelayMeta[]>(undefined);