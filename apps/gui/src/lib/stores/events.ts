import { writable, derived, type Writable } from "svelte/store";

export const events: Writable<Map<string, any>> = writable(new Map());

export const eventsArray = derived(events, ($events) => Array.from($events?.values() || []));