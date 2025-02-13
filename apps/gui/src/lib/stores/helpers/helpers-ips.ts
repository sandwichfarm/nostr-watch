import { relayCheckMap } from "$stores/checks"
import { ipRelayMap } from "$stores/ips"
import { derived, get, type Readable } from "svelte/store"

export const relayIpSiblings = (
    relayUrl: string, 
    $relayCheckMap?: Map<string, any>, 
    $ipRelayMap?: Map<string, string[]>
    ): Map<string, string[]> => {
        const { ipv4, ipv6 } = ($relayCheckMap || get(relayCheckMap)).get(relayUrl)
        const ips = [
                ...ipv4, 
                ...ipv6
            ].filter((ip) => !!ip)
        const result = new Map<string, string[]>()
        ips.forEach((ip) => {
            if(!ip) return  
            const siblings = ($ipRelayMap || get(ipRelayMap)).get(ip)
            if(!siblings) return
            result.set(ip, siblings)
        })
        return result;

}

export const relayIpSiblings$ = (relayUrl: string): Readable<Map<string, string[]>> => {
    return derived(
        [relayCheckMap, ipRelayMap],
        ([$relayCheckMap, $ipRelayMap]) => {
            return relayIpSiblings(relayUrl, $relayCheckMap, $ipRelayMap)
        }
    )
}