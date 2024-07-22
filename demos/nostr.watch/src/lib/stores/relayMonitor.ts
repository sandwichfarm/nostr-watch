import { writable } from "svelte/store";
// import {   } from "@nostr-dev-kit/ndk-svelte";

export const relayMonitorStore = writable(new Set());