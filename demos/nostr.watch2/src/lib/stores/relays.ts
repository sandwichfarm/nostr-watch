import { writable, type Writable } from "svelte/store";

export const relays: Writable<any[]> = writable([]);