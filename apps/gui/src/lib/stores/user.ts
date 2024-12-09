import type { UserService } from "$lib/services/UserService";
import { writable, type Writable } from "svelte/store";

export const userService: Writable<UserService | null> = writable(null);