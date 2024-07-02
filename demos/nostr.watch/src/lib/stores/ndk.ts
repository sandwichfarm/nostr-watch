import { writable } from "svelte/store";
import NDKSvelte from "@nostr-dev-kit/ndk-svelte";

export const ndk = writable<NDKSvelte | undefined>(undefined);