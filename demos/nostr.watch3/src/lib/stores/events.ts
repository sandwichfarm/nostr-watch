import { writable, type Writable } from "svelte/store";

export const events: Writable<any[]> = writable([]);