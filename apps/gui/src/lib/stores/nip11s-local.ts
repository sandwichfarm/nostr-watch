import { writable, type Writable } from "svelte/store";
import type { Nip11 as Nip11Type } from "@nostrwatch/route66/models";

/**
 * Local NIP-11 store - separated to avoid circular dependency between
 * nip11s.ts and Nip11Service.
 */
export const nip11sLocal: Writable<Map<string, Nip11Type>> = writable(new Map());
