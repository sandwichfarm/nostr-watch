import { MonitorRelayFetcher, RelayMonitorSetExt } from "..";

type RelayMonitorMap = Map<string, MonitorRelayFetcher>;

export interface KitCacheRelayMonitorInterface {
    set: (monitorEvent: MonitorRelayFetcher) => Promise<boolean>;
    get: (monitorPubkey: string) => Promise<MonitorRelayFetcher | undefined>;
    remove: (monitorPubkey: string) => Promise<boolean>;
    keys: () => Promise<Set<string>>;
    load: (monitorEvents: RelayMonitorSetExt) => Promise<void>;
    dump: () => Promise<RelayMonitorSetExt>;
    reset: () => Promise<void>;
    [key: string]: any;
}

export class KitCacheRelayMonitorDefault implements KitCacheRelayMonitorInterface {
    monitors: RelayMonitorMap;

    constructor() {
        this.monitors = new Map();
    }

    async set( monitorEvent: MonitorRelayFetcher ): Promise<boolean> {
        this.monitors.set( monitorEvent.pubkey, monitorEvent as MonitorRelayFetcher );
        return true;
    }

    async get( monitorPubkey: string ): Promise<MonitorRelayFetcher | undefined> {
        return this.monitors.get(monitorPubkey)
    }

    async remove( monitorPubkey: string ): Promise<boolean> {
        return this.monitors.delete(monitorPubkey);
    }

    async keys(): Promise<Set<string>> {
        const arr = Array.from(this.monitors.values());
        const urls = arr.map(event => event.tags.find(tag => tag[0] === 'd')?.[1])
        return new Set(urls.filter((tag): tag is string => tag !== undefined));
    }

    async load( monitorEvents: RelayMonitorSetExt ): Promise<void> {
        monitorEvents?.forEach( event => {
            this.monitors.set( event.pubkey, event as MonitorRelayFetcher );
        })
    }

    async dump(): Promise<RelayMonitorSetExt> {
        return new Set(this.monitors.values())
    }

    async reset(): Promise<void> {
        this.monitors.clear();
    }
}