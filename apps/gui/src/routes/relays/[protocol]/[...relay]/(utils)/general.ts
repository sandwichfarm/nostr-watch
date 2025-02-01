import { page } from "$app/stores"
import { get } from "svelte/store"

export const getRelayUrl = (): string => new URL(`${get(page).params.protocol}://${get(page).params.relay}`).toString();