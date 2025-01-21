import { writable, type Writable, type Readable, get } from "svelte/store";
import { Nip66CheckEvent, Geocoded, NostrEvent, type IEvent, Monitor } from '@nostrwatch/route66/models'
import { Route66 } from "@nostrwatch/route66";
import { SvelteMemoryRelay } from "@nostrwatch/memory-relay"
import { route66 } from "../route66";
import { events, type StoreEventType } from "../events";
import { eventsStoreMemoryRelay } from "./memory-relay-events";

let $route66: Route66 | null = null;
route66.subscribe(value => $route66 = value);

type InputEventType = IEvent | StoreEventType
type OutputEventType = StoreEventType

export type RelayChecksMemoryRelayType = SvelteMemoryRelay<InputEventType, OutputEventType>

const relayChecks: Writable<Map<string, OutputEventType>> = writable(new Map());

const qualifyEvent = (event: InputEventType, key: string, $memoryRelay?: any): boolean => {
    if(event.kind !== 30166 && event.kind !== 10166) return false;
    const monitor = $route66?.services?.monitors?.map.get(event.pubkey);
    const online = monitor?.relayIsOnline(event);
    monitor?.maybeUpdateLastActive?.(event);
    if(!online){
        if($memoryRelay && $memoryRelay?.store?.has(key)){
            $memoryRelay.store.update(($store: Map<any, any>) => {
                $store.delete(key);
                return $store;
            })
        }
        return false;
    }
    return true
}

get(eventsStoreMemoryRelay).store.subscribe($eventsStore => {
    const checksMap: Map<string, StoreEventType> = new Map();
    $eventsStore.entries().forEach(([key, event]) => {
        if(!qualifyEvent(event, key, get(eventsStoreMemoryRelay))) return;
        checksMap.set(key, event);
    })
    relayChecks.update($checks => checksMap);
})

const init = (): RelayChecksMemoryRelayType => {
    const relay = new SvelteMemoryRelay<InputEventType, OutputEventType>( relayChecks )

    relay.on('instantiate', (event: InputEventType) => { 
        if(event.kind === 30166){
            if(event instanceof Nip66CheckEvent) return event;
            return new Nip66CheckEvent(event);
        }

        console.warn('relayChecksMemoryRelay_ instantiate: unknown event kind', event.kind);
        return new NostrEvent(event);
    });
    
    relay.on('qualify', (event: InputEventType, key: string, $memoryRelay: RelayChecksMemoryRelayType) => {
        return qualifyEvent(event, key, $memoryRelay);
    });

    return relay;    
}


export const relayChecksMemoryRelay: Writable<RelayChecksMemoryRelayType> = writable( init() );