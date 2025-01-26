import type { FeedService } from "$lib/services/FeedService";
import type { UserService } from "$lib/services/UserService";
import { writable, type Writable } from "svelte/store";

export const userService: Writable<UserService | null> = writable(null);
export const feedService: Writable<FeedService | null> = writable(null);