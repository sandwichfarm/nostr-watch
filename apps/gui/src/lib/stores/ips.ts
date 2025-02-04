import { derived, type Readable } from "svelte/store";
import { relayCheckAggregates } from "./checks";

export const ipRelayMap: Readable<Map<string, string[]>> = derived(
    relayCheckAggregates, 
    ($relayCheckAggregates) => {
        const map: Map<string, string[]> = new Map();
        for(const { relay, checks } of $relayCheckAggregates){
            for(const { ipv4, ipv6 } of checks){
                if(ipv4 && ipv4?.length) {
                    ipv4.forEach( (ip) => {
                        if(!map.has(ip)){
                            map.set(ip, []);
                        }
                        map.get(ip)?.push(relay);
                    })
                }
                if(ipv6 && ipv6?.length) {
                    ipv6.forEach( (ip) => {
                        if(!map.has(ip)){
                            map.set(ip, []);
                        }
                        map.get(ip)?.push(relay);
                    })
                }
            }
        }
        return map;
    }
)