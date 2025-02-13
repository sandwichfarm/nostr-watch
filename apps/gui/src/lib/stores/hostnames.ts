import { derived, type Readable } from "svelte/store";
import { eventsArray } from "./events";
import type { Nip66CheckEvent } from "@nostrwatch/route66/models/Nip66CheckEvent";
import { eventsChecks } from "./checks";


export const pubkeyHostnames: Readable<Map<string, string[]>> = derived(
    eventsArray,
    ($eventsArray) => {
        const hostnamesMap: Map<string, string[]> = new Map();
        $eventsArray.forEach((event) => {
            const rootdomains = hostnamesMap.get(event.pubkey) || [];
            const hostname = (event as Nip66CheckEvent).hostname;
            if(!hostname) return 
            const root = hostname.split('.').reverse().splice(0,2).reverse().join('.')
            rootdomains.push(root);
            hostnamesMap.set(event.pubkey, Array.from(new Set(rootdomains)));
        });
        return hostnamesMap
    }
);

export const hostnameRelays: Readable<Map<string, string[]>> = derived(
    eventsChecks,
    ($eventsChecks) => {
        const hostnamesMap: Map<string, string[]> = new Map();
        $eventsChecks.forEach((event) => {
            const { url } = event;
            if(!url) return;
            const urls = hostnamesMap.get(url) || [];
            const hostname = (event as Nip66CheckEvent).hostname;
            if(!hostname) return 
            const root = hostname.split('.').reverse().splice(0,2).reverse().join('.')
            urls.push(url);
            hostnamesMap.set(root, Array.from(new Set(url)));
        });
        return hostnamesMap
    }
);