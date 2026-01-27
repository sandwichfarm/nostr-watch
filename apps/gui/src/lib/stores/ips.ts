import { derived, type Readable } from "svelte/store";
import { relayCheckAggregates, relayCheckMap } from "./checks";
import { useWorkerIps, workerIpRelayMap } from "./dimension-stores";

// ============================================================================
// LEGACY STORE (Derived from relayCheckMap)
// ============================================================================

export const ipRelayMap_legacy: Readable<Map<string, string[]>> = derived(
    relayCheckMap,
    ($relayCheckMap) => {
        const map: Map<string, string[]> = new Map();
        for(const [ relay, check ] of $relayCheckMap){
            const { ipv4, ipv6 } = check
            if(ipv4 && ipv4?.length) {
                ipv4.forEach( (ip: string) => {
                    if(!map.has(ip)){
                        map.set(ip, []);
                    }
                    map.get(ip)?.push(relay);
                })
            }
            if(ipv6 && ipv6?.length) {
                ipv6.forEach( (ip: string) => {
                    if(!map.has(ip)){
                        map.set(ip, []);
                    }
                    map.get(ip)?.push(relay);
                })
            }
        }
        return map;
    }
)

// ============================================================================
// HYBRID STORE (Worker-fed with legacy fallback)
// ============================================================================

/** Map of IP address -> array of relay URLs (returns Map for backward compatibility) */
export const ipRelayMap: Readable<Map<string, string[]>> = derived(
    [useWorkerIps, workerIpRelayMap, ipRelayMap_legacy],
    ([$useWorker, $worker, $legacy]) => {
        if ($useWorker && Object.keys($worker).length > 0) {
            // Convert Record to Map for backward compatibility
            return new Map(Object.entries($worker));
        }
        return $legacy;
    }
)