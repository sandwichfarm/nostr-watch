import { hostnameRelays } from "$stores/hostnames"
import { derived, get, type Readable } from "svelte/store"

export const relayHostnameSiblings = (relayUrl: string): string[] => {
    const hostname: string = new URL(relayUrl).hostname
    return get(hostnameRelays).get(hostname) || []
}

export const relayHostnameSiblings$ = (relayUrl: string): Readable<string[]> => {
    return derived(
        hostnameRelays,
        ($hostnameRelays) => {
            const hostname: string = new URL(relayUrl).hostname
            return $hostnameRelays.get(hostname) || []
        }
    )
}