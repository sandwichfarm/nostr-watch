import { writable, type Writable } from "svelte/store";

export const doBootstrap: Writable<boolean | undefined> = writable(undefined);
