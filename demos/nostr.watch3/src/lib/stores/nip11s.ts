import { writable, type Writable } from "svelte/store";
import type { INip11 } from "@nostrwatch/nip66/models"

export const nip11s: Writable<Map<string, INip11>> = writable(new Map());