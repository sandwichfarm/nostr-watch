import { writable } from "svelte/store";

export const recordsChanged = writable(new Map<string, boolean>())