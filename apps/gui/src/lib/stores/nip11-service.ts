import { writable, type Writable } from "svelte/store";
import { Nip11Service } from "$lib/services/Nip11Service";

/**
 * NIP-11 service store - separated to avoid circular dependency.
 */
export const nip11Service: Writable<Nip11Service> = writable(new Nip11Service());
