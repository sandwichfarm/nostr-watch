
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKFilter, NDKSubscription, NDKRelayMonitor } from '@nostr-dev-kit/ndk';

import { NDKEventGeoCoded as EventGeoCoded, NDKRelayMeta } from '@nostr-dev-kit/ndk';
import type { Coords } from '@nostr-dev-kit/ndk';

import { MonitorRelayFetcher, RelayMonitorDiscoveryTags } from './monitor-relay-fetcher';
import type { RelayMonitorSetExt, RelayListSet, RelayMonitorDiscoveryFilters, RelayMonitorCriterias, RelayMetaSubscriptionHandlers, LoadRelayStat, LoadRelayStats } from './monitor-relay-fetcher';

import { KitCacheRelayMonitorInterface, KitCacheRelayMonitorDefault, KitCacheRelayMetaDefault, KitCacheRelayMetaInterface } from '../cache/index';

import { MonitorFetcher, MonitorFetcherOptions, MonitorFetcherOptionsDefaults } from './monitor-fetcher';

type RelayAggregateMixed = RelayListSet | Set<NDKRelayMeta> | undefined;

type MonitorManagerOptions = {
    primaryMonitor?: string;
    monitorCache?: KitCacheRelayMonitorInterface;
    relayCache?: KitCacheRelayMetaInterface;
}

type MonitorSubs = Map<string, NDKSubscription>;

/**
 * @class MonitorManager
 */
export class MonitorManager {

    private _ndk: NDK;
    private _fetcher: MonitorFetcher;
    private _monitorCache: KitCacheRelayMonitorInterface;
    private _relayCache: KitCacheRelayMetaInterface;
    private _relayFetcherFilters: Record<string, NDKFilter>;
    private _primaryMonitor: string | undefined;

    constructor( ndk: NDK, options?: MonitorManagerOptions, monitorFetcherOptions: MonitorFetcherOptions = MonitorFetcherOptionsDefaults, relayFetcherFilters: Record<string, NDKFilter> = {} ) {
        this._ndk = ndk;
        this._fetcher = new MonitorFetcher(this.ndk, monitorFetcherOptions || {} as MonitorFetcherOptions)
        this._relayFetcherFilters = relayFetcherFilters
        this._primaryMonitor = options?.primaryMonitor || undefined;
        this._monitorCache = options?.monitorCache || new KitCacheRelayMonitorDefault();
        this._relayCache = options?.relayCache || new KitCacheRelayMetaDefault();
    }

    get ndk(): NDK {
        return this._ndk;
    }

    get fetch(): MonitorFetcher {
        return this._fetcher;
    }

    set fetchOptions( options: MonitorFetcherOptions ) {
        this.fetch.options = options;
    }

    set monitor( monitor: MonitorRelayFetcher ) {
        this.cache.set( monitor );
    }

    get monitors(): Promise<RelayMonitorSetExt> {
        return new Promise(async (resolve) => {
            const monitors = await this.cache.dump()
            console.log('dump', monitors)
            const promises = []
            monitors?.forEach(monitor => { 
                monitor.cache = this._relayCache;
                promises.push(monitor.init());
            })
            Promise.allSettled(promises).then(() => {
                resolve(this.sortMonitorsByPrimary( monitors ));
            })
        });
    }

    get monitorKeys(): Promise<Set<string>> {
        return this.cache.keys();
    }

    set monitors( monitors: RelayMonitorSetExt) {
        if(!monitors?.size) return;
        this.cache.reset();
        this.cache.load( monitors )
    }

    get cache(): KitCacheRelayMonitorInterface {
        return this._monitorCache;
    }

    set cache( cache: KitCacheRelayMonitorInterface ) {
        this._monitorCache = cache;
    }

    resetMonitors(): void {
        this.cache.reset();
    }

    async getMonitor( key: string ): Promise<MonitorRelayFetcher | undefined> {
        const monitor = await this.cache.get( key );
        if(!monitor) return undefined
        monitor.cache = this._relayCache 
        return monitor
    }

    async abortAll(): Promise<void> {
        (await this.monitors)?.forEach( monitor => {
            monitor.abort()
        })
    }

    async init(): Promise<LoadRelayStats> {
        const activeMonitors: RelayMonitorSetExt = await this.fetch.monitors(undefined, false)
        const sortedMonitors = await this.sortMonitorsByData(activeMonitors)
        await this.initMonitors(sortedMonitors)
        await this.populateMonitors(sortedMonitors)
        // return this.populateRelays(sortedMonitors)
    }

    async fetchMonitors( filter?: NDKFilter, force?: boolean ): Promise<RelayMonitorSetExt> {
        return this.fetch.monitors(filter, force)
    }

    async initMonitors( monitors: RelayMonitorSetExt ): Promise<void> {
        if(!monitors) return
        const promises: Promise<void>[] = []
        monitors.forEach( async (monitor: MonitorRelayFetcher) => {
            promises.push(monitor.init(this._relayCache))
        })
        await Promise.allSettled(promises)
    }

    // async updateMonitorStat(monitorPubkey: string, stat: LoadRelayStat): Promise<void> {
    //     return this.cache.db.where({monitorPubkey}).modify(stat)
    // }

    // async updateMonitorsStats( stats: Map<string, LoadRelayStat> ): Promise<void> {
    //     const promises: Promise<void>[] = []
    //     const it = stats.keys()
    //     for(let i=0; i<stats.size; i++) {
    //         const monitorPubkey = it.next().value
    //         const stat = stats.get(monitorPubkey)
    //         if(!stat) continue
    //         promises.push(this.updateMonitorStat(monitorPubkey, stat))
    //     }
    //     await Promise.allSettled(promises)
    // }

    async populateMonitors( monitors: RelayMonitorSetExt ): Promise<void> {
        console.log('found monitors', monitors?.size)
        if(!monitors?.size) return;
        await this.cache.load( monitors );
        console.log('dumped monitors', await this.cache.dump())
    }

    async populateRelays( _monitors?: RelayMonitorSetExt ): Promise<LoadRelayStats> { 
        const monitors = _monitors || await this.monitors;
        const stats: LoadRelayStats = new Map()
        if (monitors) {
            for await (const monitor of monitors) {
                console.log('populating relays for ', monitor.pubkey)
                stats.set(monitor.pubkey, await monitor.load(undefined, this._relayFetcherFilters?.[monitor.pubkey]));
            }
        }
        return stats
    }

    async populateRelaysParallel(): Promise<LoadRelayStats>  { 
        const promises: Promise<number>[] = new Array();
        const monitors = await this.monitors;
        const stats: LoadRelayStats = new Map()
        monitors?.forEach( async (monitor) => {
            stats.set(monitor.pubkey, await monitor.load());
        })
        return stats 
    }

    async subscribeToMonitor(pubkey: string, filter?: NDKFilter, callbacks?: RelayMetaSubscriptionHandlers): Promise<NDKSubscription | undefined> {
        const monitor = await this.cache.get(pubkey)
        if(!monitor) return
        return monitor.subscribeRelayMeta(callbacks, filter)
    }

    async subscribeToMonitors(callbacks?: RelayMetaSubscriptionHandlers): Promise<MonitorSubs | undefined> {
        const monitorFeeds: MonitorSubs = new Map<string, NDKSubscription>();
        const monitors = await this.monitors
        console.log(monitors)
        if(!monitors) return
        Array.from(monitors).forEach( monitor => {
            const sub = monitor.subscribeRelayMeta(callbacks)
            if(!sub) return
            monitorFeeds.set(monitor.pubkey, sub)
        })
        return monitorFeeds
    }

    async sortMonitorsByPrimary(monitors: RelayMonitorSetExt): Promise<RelayMonitorSetExt> {
        if (!monitors) return undefined;
        let monitorsArray: NDKRelayMonitor[] = Array.from(monitors);
        const primary = monitorsArray.find(monitor => monitor.pubkey === this._primaryMonitor);
        monitorsArray.unshift(primary)
        return new Set(monitorsArray) as RelayMonitorSetExt;
    }

    async sortMonitorsByData(monitors: RelayMonitorSetExt): Promise<RelayMonitorSetExt> {
        if (!monitors) return undefined;
        const monitorsArray: NDKRelayMonitor[] = Array.from(monitors);
        monitorsArray.sort((a, b) => b.checks.length - a.checks.length);
        return new Set(monitorsArray) as RelayMonitorSetExt;
    }
    
    /**
     * @description Aggregates relay data based on the specified fetch method and options.
     * This method collects data from each monitor that meets the specified criteria
     * and aggregates it based on the `fetchAggregate` parameter.
     *
     * @param fetchAggregate - The aggregation method to be used for fetching data.
     * @param opts - Optional parameters including custom filters, criteria for monitor selection, and geospatial options for nearby search.
     * @returns A promise that resolves to a mixed set of relay data based on the specified aggregation method.
     * 
     * @todo fetchAggregate -> enum
     * @public
     * @async
     */
    async aggregate(fetchAggregate: string, opts?: MonitorFetcherOptions): Promise<RelayAggregateMixed | undefined> {
        const promises: Promise<RelayAggregateMixed>[] = [];
        const criterias = opts?.criterias || this.fetch.options?.criterias as RelayMonitorCriterias || undefined;
        const monitors: RelayMonitorSetExt = criterias ? await this.meetsCriterias(criterias) : await this.cache.dump();
    
        if (!monitors || monitors.size === 0) return undefined;
    
        monitors.forEach( (monitor: MonitorRelayFetcher) => {
            let result: Promise<RelayAggregateMixed> = Promise.resolve(undefined);
            switch (fetchAggregate) {
                case 'onlineList':
                    result = monitor.fetchOnlineRelays(opts?.customFilter);
                    break;
                case 'onlineMeta':
                    result = monitor.fetchOnlineRelaysMeta(opts?.customFilter);
                    break;
                case 'onlineListNearby':
                    if (!opts?.nearby) break;
                    result = monitor.fetchNearbyRelaysList(
                        opts?.nearby.geohash,
                        opts?.nearby?.maxPrecision,
                        opts?.nearby?.minPrecision,
                        opts?.nearby?.minResults,
                        opts?.nearby?.recurse,
                        opts?.customFilter
                    );
                    break;
            }
            promises.push(result);
        });
    
        const settledPromises = await Promise.allSettled(promises);
    
        const results = new Set<RelayAggregateMixed>();
        settledPromises.forEach((settled) => {
            if (settled.status === 'fulfilled' && settled.value) {
                results.add(settled.value);
            }
        });
    
        return results as unknown as RelayAggregateMixed; // Cast to the appropriate type
    }

    /**
     * @description Populates the internal set of monitors based on a custom filter and optionally filters for only active monitors.
     * This method fetches relay monitors matching the provided filter and updates the internal set of monitors.
     *
     * @param customFilter - A custom filter to apply when fetching monitors.
     * @param activeOnly - If true, only active monitors are considered.
     * @returns A promise that resolves once the internal set of monitors is populated.
     * 
     * @async
     */
    public async populate( customFilter: NDKFilter = {}, activeOnly: boolean = true ) {
        this.cache.reset(); 
        const events: RelayMonitorSetExt = await this.fetch.monitors(customFilter, activeOnly);
        if(!events?.size) return undefined;
        await this.cache.load(events)
        await this._initMonitors();
    }

    /**
     * @description Populates the internal set of monitors based on specified criteria and optionally filters for only active monitors.
     * This method constructs a filter from the given criteria and fetches relay monitors that meet these criteria.
     *
     * @param criterias - Criteria used to filter the monitors.
     * @param activeOnly - If true, only active monitors are considered.
     * @returns A promise that resolves once the internal set of monitors is populated based on the criteria.
     * 
     * @async
     */
    public async populateByCriterias( criterias: RelayMonitorCriterias, activeOnly: boolean = true ) {
        const filter: NDKFilter = this._generateCriteriasFilter(criterias);
        this.populate( filter, activeOnly );
    }

    /**
     * @description Populates the internal set of monitors based on proximity to a given geohash and optionally appends a custom filter.
     * This method fetches relay monitors that are nearby the specified geohash and meets any additional specified criteria.
     *
     * @param geohash - The geohash representing the location to search near.
     * @param maxPrecision - The maximum precision of the geohash to consider.
     * @param minPrecision - The minimum precision of the geohash to consider.
     * @param minResults - The minimum number of results to return.
     * @param recurse - If true, recursively search for relays until the minimum number of results is met.
     * @param appendFilter - An optional filter to append to the default filter.
     * @param activeOnly - If true, only considers active monitors.
     * @returns A promise that resolves once the internal set of monitors is populated based on proximity.
     * @public
     * @async
     */
    public async populateNearby( geohash: string, maxPrecision: number = 5, minPrecision: number = 5, minResults: number = 5, recurse: boolean = false, appendFilter?: NDKFilter, activeOnly: boolean = false ) {
        this.cache.reset();  
        const _builtinFilter: NDKFilter = this._generateCriteriasFilter();
        const events: RelayMonitorSetExt = await this.fetch.nearby(geohash, maxPrecision, minPrecision, minResults, recurse, activeOnly, { ..._builtinFilter, ...appendFilter  });
        if(!events?.size) return undefined;
        this.cache.load(events)
        this._initMonitors();
    }

    /**
     * @description Filters the internal set of monitors based on the specified criteria.
     *
     * @param criterias - The criteria used to filter the monitors.
     * @returns A set of relay monitors that meet the specified criteria or undefined if no monitors meet the criteria.
     * @public
     */
    public async meetsCriterias( criterias: RelayMonitorCriterias ): Promise<RelayMonitorSetExt| undefined> {
        let monitors = await this.cache.dump()
        if(!monitors?.size) return undefined;
        return new Set(Array.from(monitors).filter( (monitor: MonitorRelayFetcher) => monitor.meetsCriterias(criterias) ));
    }

    /**
     * @description Retrieves the closest monitor to the specified coordinates that meets any provided criteria.
     * If no monitors meet the criteria or are close enough, returns undefined.
     *
     * @param coords - The coordinates used to find the closest monitor.
     * @param criterias - Optional criteria to filter monitors.
     * @param populate - If true, populates the internal set of monitors based on the criteria before searching.
     * @returns A promise that resolves to the closest monitor meeting the criteria, or undefined if no suitable monitor is found.
     * @public
     * @async
     */
    public async getClosestMonitor( coords: Coords, criterias?: RelayMonitorCriterias, populate: boolean = false ): Promise<MonitorRelayFetcher | undefined> {
        const _criterias = criterias || this.fetch.options?.criterias || {} as RelayMonitorCriterias;
        let monitors = await this.monitors
        if(!monitors?.size || populate) {
            await this.populateByCriterias( criterias || this?.fetch.options?.criterias as RelayMonitorCriterias);
        }
        monitors = await this.meetsCriterias(_criterias);
        if(!monitors?.size) return undefined;
        const sorted: RelayMonitorSetExt = MonitorManager.sortMonitorsByProximity(coords, monitors);
        return sorted?.values().next().value;
    };

    /**
     * @description Sorts monitors based on provided coordinates (DD or geohash) relative to the monitor's coordinates (if available)
     * 
     * @param {Coords} coords The coordinates to use for sorting.
     * @param {RelayMonitorSetExt} monitors A set of `MonitorRelayFetcher` objects to filter.
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @static
     * @async
     */
    static sortMonitorsByProximity( coords: Coords, monitors: RelayMonitorSetExt ): RelayMonitorSetExt | undefined {
        if(!monitors?.size) return undefined;
        const monitorsSorted = EventGeoCoded.sortGeospatial( coords, monitors as Set<EventGeoCoded> );
        return monitorsSorted as RelayMonitorSetExt;
    }

    /**
     * @description Initializes monitors by calling their `init` method if they have not been initialized yet.
     * This method iterates through all monitors and initializes each that hasn't been initialized.
     * The initialization process for each monitor is performed asynchronously, and this method
     * waits for all initialization promises to settle before completing.
     * 
     * @private
     * @async
     */
    private async _initMonitors(){
        const promises: Promise<void>[] = [];
        let monitors = await this.monitors
        if(!monitors?.size) return;
        monitors?.forEach( async (monitor: MonitorRelayFetcher) => {
            if(!monitor.initialized){
                promises.push(monitor.init());
            }
        });
        await Promise.allSettled(promises);
    }

    /**
     * @description Generates a filter for relay monitor discovery based on specified criteria.
     * The method maps the provided criteria to their corresponding discovery tags
     * and constructs a filter object that can be used for relay monitor discovery.
     * If no criteria are provided, it defaults to using the criteria specified in
     * the instance's options, if available.
     * 
     * @param criterias - Optional. The criteria to generate the filter from.
     * @returns An object representing the filter for relay monitor discovery.
     * 
     * @private
     */
    private _generateCriteriasFilter( criterias?: RelayMonitorCriterias ): RelayMonitorDiscoveryFilters {
        const filter: RelayMonitorDiscoveryFilters = {};
        criterias = criterias || this.fetch.options?.criterias;
        if (!criterias) return filter;
        const keyMapping: Record<keyof RelayMonitorCriterias, RelayMonitorDiscoveryTags> = {
            kinds: RelayMonitorDiscoveryTags.kinds,
            checks: RelayMonitorDiscoveryTags.checks,
        };
        Object.entries(keyMapping).forEach(([optionKey, tagValue]) => {
            const filterKey = `#${tagValue}` as keyof RelayMonitorDiscoveryFilters;
            const originalValue = criterias?.[optionKey as keyof RelayMonitorCriterias];
            if (originalValue) {
                filter[filterKey] = originalValue.map(String);
            }
        });
        return filter;
    }
}