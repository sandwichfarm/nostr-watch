import { derived, type Readable } from "svelte/store";
import { relayCheckAggregates, relayCheckMap } from "./checks";

export const ipRelayMap: Readable<Map<string, string[]>> = derived(
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