import { writable, type Writable } from "svelte/store";
import type { IGeocode } from "@nostrwatch/nip66/models"

export const geocodes: Writable<IGeocode[]> = writable([]);