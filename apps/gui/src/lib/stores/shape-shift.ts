import { writable, type Writable } from "svelte/store";

export const shapeshift: Writable<Record<string, boolean>> = writable({})