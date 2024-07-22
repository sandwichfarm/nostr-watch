import { NDKRelayMeta, RelayMetaSet } from "@nostr-dev-kit/ndk";

// Define the KitCacheRelayMetaInterface interface
export interface KitCacheRelayMetaInterface {
    set: (relayMetaEvent: NDKRelayMeta) => Promise<boolean>;
    get: (relayUrl: string, monitorPubkey: string) => Promise<NDKRelayMeta | undefined>;
    remove: (relayUrl: string) => Promise<boolean>;
    keys: () => Promise<Set<string>>;
    load: (relayUrl: RelayMetaSet) => Promise<Record<string, number>>;
    dump: (monitorPubkey: string) => Promise<RelayMetaSet>;
    reset: () => Promise<void>;
    [key: string]: any;
  }

type MonitorRelayMap = Map<string, NDKRelayMeta>
type RelayMap = Map<string, MonitorRelayMap>

export class KitCacheRelayMetaDefault implements KitCacheRelayMetaInterface {
    private _events: RelayMap

    constructor() {
        this._events = new Map()
    }

    get relays(): RelayMap {
        return this._events
    }   

    maybeInitRelay(relayUrl: string) {
        const relayMap = this.relays.get(relayUrl)
        if (!relayMap) {
            const map: MonitorRelayMap = new Map()
            this.relays.set(relayUrl, map)
        }
    }

    async set( relayMetaEvent: NDKRelayMeta ): Promise<boolean> {
        const {url} = relayMetaEvent
        if(!url) return false
        this.maybeInitRelay(url)
        this.relays.get(url)?.set(relayMetaEvent.pubkey, relayMetaEvent)
        return true
    }

    async get( relayUrl: string, monitorPubkey: string ): Promise<NDKRelayMeta | undefined> {
        return this.relays.get(relayUrl)?.get(monitorPubkey)
    }

    async list(relayUrl: string): Promise<NDKRelayMeta[] | undefined> {
        const values = this.relays.get(relayUrl)?.values()
        if(!values) return
        return Array.from(values) 
    }

    async keys(): Promise<Set<string>> {
        return new Set(Array.from(this.relays.keys()));
    }

    async load( relayEvents: RelayMetaSet ): Promise<Record<string, number>> {
        console.log('default cache')
        let mostRecent = 0
        relayEvents?.forEach( relayMetaEvent => {
            const {url, created_at} = relayMetaEvent
            if(!url) return false
            this.relays.get( url )?.set( relayMetaEvent.pubkey, relayMetaEvent as NDKRelayMeta );
            if(created_at && created_at > mostRecent) {
                mostRecent = created_at
            }
        });
        return { events: mostRecent }
    }

    async dump( monitorPubkey: string ): Promise<RelayMetaSet> {
        const relayEvents: RelayMetaSet = new Set()
        this.relays.forEach( (relayMap, relayUrl) => {
            relayMap.forEach( (relayMeta, pubkey) => {
                if( pubkey === monitorPubkey ) {
                    relayEvents.add(relayMeta)
                }
            })
        })
        return relayEvents
    }

    async dumpAll(): Promise<RelayMetaSet> {
        const relayEvents: RelayMetaSet = new Set()
        this.relays.forEach( (relayMap, relayUrl) => {
            relayMap.forEach( (relayMeta) => {
                relayEvents.add(relayMeta)
            })
        })
        return relayEvents
    }

    async remove(relayUrl: string): Promise<boolean> {
        this.relays.delete(relayUrl);
        return true
    }

    async reset(): Promise<void> {
        this.relays.clear();
    }
}