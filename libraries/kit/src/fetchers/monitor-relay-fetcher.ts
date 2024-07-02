import import2 from "import2"; 
import { is_node } from "tstl"; 
if (is_node()) (globalThis as any).WebSocket ??= import2("ws");

import NDK, { 
    NDKRelayList, 
    NDKRelay, 
    NDKEvent, 
    NDKKind,
    NDKEventGeoCoded as EventGeoCoded, 
    NDKRelayMonitor, NDKRelayMeta, NDKRelayDiscovery,
    RelayLiveness,  RelayDiscoveryFilters, FetchNearbyRelayOptions 
} from "@nostr-dev-kit/ndk";

import {  } from "@nostr-dev-kit/ndk"

import { getRelayListForUser } from "@nostr-dev-kit/ndk";

import { NostrFetcher } from 'nostr-fetch';
import { ndkAdapter } from '@nostr-fetch/adapter-ndk';

import type { NostrEvent, NDKFilter, NDKUserProfile, NDKUser, NDKSubscription } from "@nostr-dev-kit/ndk";
import { KitCacheRelayMetaInterface, KitCacheRelayMetaDefault } from "../cache/index";

import { popProp } from "../utils";

export type RelayListSet = Set<string> | undefined
export type RelayMonitorSetExt = Set<MonitorRelayFetcher> | undefined
export type RelayDiscoveryResult = Set<NDKRelayDiscovery> | undefined
export type RelayMetaSet = Set<NDKRelayMeta> | undefined

export type LoadRelayStat = {
    count: number;
    mostRecent: number; 
}

export type LoadRelayStats = Map<string, LoadRelayStat>

export interface RelayMetaSubscriptionHandlers {
    onEvent?: ( event: NDKEvent ) => {},
    onEose?: ( sub: NDKSubscription ) => {},
    onDup?: ( event: NDKEvent ) => {},
    onClose?: ( sub: NDKSubscription ) => {}
}

export type RelayMonitorCriterias = {
    kinds: number[], 
    checks: string[]
}

export enum RelayMonitorDiscoveryTags {
    kinds = "k",
    checks = "c"
}

export type RelayMonitorDiscoveryFilters = {
    [K in RelayMonitorDiscoveryTags as `#${K}`]?: string[];
};

export type FetchRelaysOptions = {
    filter?: NDKFilter;
    indexedTags?: RelayDiscoveryFilters;
    geohash?: string,
    nearby?: FetchNearbyRelayOptions;
    activeOnly?: boolean;
    tolerance?: number;
}

/**
 * A `MonitorRelayFetcher` event represents a NIP-66 Relay Monitor.
 * 
 * @author sandwich.farm
 * @extends EventGeoCoded
 * @summary Relay Monitor (NIP-66)
 * @implements NDKKind.MonitorRelayFetcher
 * @example
 * ```javascript
 * import { NDK } from "@nostr-dev-kit/ndk";
 * import { MonitorRelayFetcher } from "@nostr-dev-kit/ndk/dist/events/kinds/nip66/relay-monitor";
 * 
 * const ndk = new NDK();
 * const monitorEvent = {...}
 * const monitor = new MonitorRelayFetcher(ndk, monitorEvent);
 * const online = await monitor.fetchOnlineRelays();
 * 
 * console.log(online)
 * ```
 */
export class MonitorRelayFetcher extends NDKRelayMonitor {
    private _initialized: boolean = false;
    private _cache: KitCacheRelayMetaInterface;
    
    private fetcher: NostrFetcher;
    private _is_fetching: boolean = false
    private abortController: AbortController 
    private abortSignal: AbortSignal;

    public allow_concurrent_fetches: boolean = false;

    protected _relays: NDKRelayList | undefined;
    protected _profile: NDKUserProfile | undefined;

    constructor( ndk: NDK | undefined, event?: NostrEvent, cache?: KitCacheRelayMetaInterface) {
        super(ndk, event);
        this.kind ??= NDKKind.RelayDiscovery; 
        this.ndk = ndk || MonitorRelayFetcher.newNDK()
        this._cache = cache || new KitCacheRelayMetaDefault();
        this.fetcher = NostrFetcher.withCustomPool(ndkAdapter(this.ndk as NDK));

        this.abortController = new AbortController()
        this.abortSignal = this.abortController.signal;
    }

    static from(event: MonitorRelayFetcher): MonitorRelayFetcher {
        return new MonitorRelayFetcher(event.ndk, event.rawEvent());
    }

    static newNDK(): NDK {
        //TODO: apply defaults, etc
        return new NDK();
    }

    get initialized(): boolean {    
        return this._initialized;
    }

    get cache(): KitCacheRelayMetaInterface {
        return this._cache;
    }

    set cache( cache: KitCacheRelayMetaInterface ) {
        console.log('cache set:', cache.constructor.name);
        this._cache = cache;
    }

    set profile(profile: NDKUserProfile) {
        this._profile = profile
    }

    get profile(): NDKUserProfile | undefined {
        return this._profile;
    }

    set relays(relays: NDKRelayList) {
        this._relays = relays;
    }

    get relays(): NDKRelayList | undefined {
        return this._relays;
    }

    async init(cache?: KitCacheRelayMetaInterface): Promise<void> {
        const promises: Promise<any>[] = [];
        if(cache) this.cache = cache;
        promises.push(this.setMonitorProfile());
        promises.push(this.setMonitorRelays());
        await Promise.allSettled(promises);
        this._initialized = true;
    }

    abort(){
        this.abortController.abort();
    }

    public async set(relayMeta: NDKRelayMeta): Promise<void> {
        await this.cache.set(relayMeta)
    }

    public async get(relay: string, monitorPubkey?: string): Promise<NDKRelayMeta | undefined> {
        if(monitorPubkey) {
            return this.cache.get(relay, monitorPubkey)
        }
        return this.cache.list(relay)
    }

    /**
     * @description Populates cache with all known relays from monitor
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a LoadRelayStat including properties count and mostRecent (timestamp)
     * 
     * @public
     * @async
     */
    public async load(livenesses: RelayLiveness[] = [ RelayLiveness.Online ], customFilter: NDKFilter = {}): Promise<LoadRelayStat> {
        let events: RelayMetaSet = new Set<NDKRelayMeta>();
        let mostRecent: number = 0
        for (const liveness of livenesses) {
            console.log(`${this.pubkey} Fetching events for liveness: ${liveness}`);
            events = await this.fetchRelaysMeta(customFilter, liveness);
            if(!events?.size) continue;
            await this.cache.load(events);
        }
        mostRecent = Math.max(...Array.from(events || new Set<NDKRelayMeta>()).map((e: NDKRelayMeta) => e.created_at || 0));
        const count = events?.size || 0
        return {
            count,
            mostRecent
        }
    }

    /**
     * @description Loads cache with all known relays from monitor
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a LoadRelayStat including properties count and mostRecent (timestamp)
     * 
     * @public
     * @async
     */
    public async loadAll( customFilter: NDKFilter = {} ): Promise<LoadRelayStat>  {
        return this.load([RelayLiveness.All], customFilter)
    }

    /**
     * @description Helper to load cache with online relays
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelaysMeta}
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a LoadRelayStat including properties count and mostRecent (timestamp)
     * 
     * @public
     * @async
     */
    public async loadOnline( customFilter: NDKFilter = {} ): Promise<LoadRelayStat> {
        return this.load(undefined, customFilter)
    }

    /**
     * @description Helper to load cache with offline relays
     * 
     * @see {@link MonitorRelayFetcher#fetchOfflineRelaysMeta}
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a LoadRelayStat including properties count and mostRecent (timestamp)
     * 
     * @public
     * @async
     */
    public async loadOffline( customFilter: NDKFilter = {} ): Promise<LoadRelayStat> {
        return this.load([RelayLiveness.Offline], customFilter)
    }

    /**
     * @description Helper to load cache with dead relays
     * 
     * @see {@link MonitorRelayFetcher#fetchOfflineRelaysMeta}
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a LoadRelayStat including properties count and mostRecent (timestamp)
     * 
     * @public
     * @async
     */
    public async loadDead( customFilter: NDKFilter = {} ): Promise<LoadRelayStat> {
        return this.load([RelayLiveness.Dead], customFilter)
    }

    /**
     * @description Generic fetcher method for fetching lists of relays
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    fetchRelaysList(prependFilter?: NDKFilter, appendFilter?: NDKFilter, liveness?: RelayLiveness): Promise<RelayListSet> {
        return new Promise((resolve, reject) => {
            this.fetchRelayMetaEvents(prependFilter, appendFilter, liveness)
                .then((events: Set<NDKEvent>) => {
                    const relayMetaEvents: Set<NDKRelayMeta> = new Set(Array.from(events).map((event: NDKEvent) => NDKRelayMeta.from(event)));
                    resolve(this._reduceRelayEventsToRelayStrings(relayMetaEvents));
                })
                .catch(() => new Set<RelayListSet>())
        });
    }

    /**
     * @description Creates a subscription and accepts handlers
     * 
     * @public
     * @param callback Callbacks to handle subscription events
     * @param filter Additional filters for subscription
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    subscribeRelayMeta( callback?: RelayMetaSubscriptionHandlers, filter?: NDKFilter ): NDKSubscription | undefined {
        console.log('subscribe', this.pubkey)
        if(!this?.ndk) {
            console.warn('Was not instantiated with ndk instance, cannot subscribe')
            return 
        }
        const kinds: NDKKind[] = [this.kinds.includes(NDKKind.RelayDiscovery )? NDKKind.RelayDiscovery: NDKKind.RelayMeta];
        const _filter: NDKFilter = this.nip66Filter(kinds, undefined, filter, RelayLiveness.Online);
        const sub: NDKSubscription = this?.ndk.subscribe(_filter, { closeOnEose: false });
        const wrapEventHandler = async ( event: NDKEvent, callback = (relayMeta: NDKRelayMeta) => {} ) => {
            console.log(event.id)
            const relayMeta: NDKRelayMeta = NDKRelayMeta.from(event);
            await this.set(relayMeta)
            callback(relayMeta)
        }
        
        sub.on("event", (event: NDKEvent) => { wrapEventHandler(event, callback?.onEvent) });
        if(callback?.onEose) sub.on("eose", callback.onEose);
        if(callback?.onClose) sub.on("close", callback.onClose);
        sub.start();
        return sub;
    }
    
    /**
     * @description Fetches a list of all known relays from monitor
     * 
     * @see {@link MonitorRelayFetcher#fetchRelaysList}
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    async fetchAllRelays( filter?: NDKFilter ): Promise<RelayListSet> {
        return this.fetchRelaysList(filter, undefined, RelayLiveness.All)
    }
    
    /**
     * @description Fetches a list of online relays
     * 
     * @see {@link MonitorRelayFetcher#fetchRelaysList}
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    async fetchOnlineRelays( filter?: NDKFilter ): Promise<RelayListSet> {
        return this.fetchRelaysList(filter, undefined, RelayLiveness.Online)
    }

    /**
     * @description Fetches a list of offline relays
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    async fetchOfflineRelays( filter?: NDKFilter ): Promise<RelayListSet> {
        return this.fetchRelaysList(filter, undefined, RelayLiveness.Offline)
    }

    /**
     * @description Fetches a list of dead relays
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    async fetchDeadRelays( filter?: NDKFilter ): Promise<RelayListSet> {
        return this.fetchRelaysList(filter, undefined, RelayLiveness.Dead)
    }

    /**
     * @description Fetches metadata for a specific relay or relays. This method may not work if you
     * provide more relays in the array than the relay storing the relay events allows for in a tag filter. 
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelaysMeta}
     * @param {string[] | string} relays A string or array of strings representing the relay(s) to fetch metadata for.
     * @returns A promise that resolves to the `RelayMetasResult` object(s)
     * 
     * @public
     * @async
     */
    async fetchRelayMeta( relays: string[] | string ): Promise<RelayMetaSet>  {
        if(!Array.isArray(relays)) { 
            relays = [relays];
        }
        const filter: NDKFilter = { "#d": relays } as NDKFilter;
        return this.fetchRelayMetaEvents(filter, undefined, RelayLiveness.Offline)
    }

    /**
     * @description Generic fetcher method for fetching relay events.
     * 
     * @public
     * @param filter A filter to apply additional filtering to subscription.
     * @returns Promise resolves to a relay list
     * 
     * @public
     * @async
     */
    fetchRelayMetaEvents(prependFilter?: NDKFilter, appendFilter?: NDKFilter, liveness?: RelayLiveness): Promise<Set<NDKRelayMeta>> {
        this.maybeWarnInvalid();
        if (!this.kinds.includes(NDKKind.RelayMeta)) {
            return Promise.reject(this._invalidRelayFetch(`MonitorRelayFetcher.fetchRelaysMeta()`, `${this.pubkey} does not publish kind ${NDKKind.RelayMeta}`));
        }

        const kinds: NDKKind[] = [NDKKind.RelayMeta];
        const filter: NDKFilter = this.nip66Filter(kinds, prependFilter, appendFilter, liveness);
        
        const timeRange = popProp(filter, 'since', 'until');

        return new Promise(async (resolve, reject) => {
            if (!this.ndk?.explicitRelayUrls) return reject("explicitRelayUrls not set");
            
            const events = await this.fetcher.fetchAllEvents(
                this.ndk?.explicitRelayUrls,
                filter,
                timeRange,
                { abortSignal: this.abortSignal }
            );
            
            try {
                const relayMetaEvents: Set<NDKRelayMeta> = new Set();
                events.forEach((event: any) => {
                    relayMetaEvents.add(new NDKRelayMeta(this.ndk, event));
                });
                resolve(relayMetaEvents)
            } catch (error) {
                console.error(`${this.pubkey}  fetchRelayMetaEvents() Error fetching relay meta events: ${error}`);
                reject(error);
            }
        });
    }
    /**
     * @description
     * 
     * @see {@link MonitorRelayFetcher#fetchRelayMetaEvents}
     * @param {string[] | string} relays A string or array of strings representing the relay(s) to fetch metadata for.
     * @returns A promise that resolves to the `RelayMetasResult` object(s)
     * 
     * @public
     * @async
     */
    async fetchRelaysMeta(filter?: NDKFilter, liveness: RelayLiveness = RelayLiveness.Online): Promise<RelayMetaSet> {
        return this.fetchRelayMetaEvents(filter, undefined, liveness);
    }

    /**
     * @description Fetches metadata for all relays known by monitor, optionally applying an additional filter.
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelaysMeta}
     * @param {NDKFilter} filter An optional `NDKFilter` object to apply additional filtering criteria.
     * @returns A promise that resolves to a `RelayMetaSet` or undefined if the operation fails.
     * 
     * @public
     * @async
     */
     async fetchAllRelaysMeta( filter?: NDKFilter ): Promise<RelayMetaSet> {
        return this.fetchRelaysMeta(filter, RelayLiveness.Online)
    }

    /**
     * @description Fetches metadata for online relays, optionally applying an additional filter.
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelaysMeta}
     * @param {NDKFilter} filter An optional `NDKFilter` object to apply additional filtering criteria.
     * @returns A promise that resolves to a `RelayMetaSet` or undefined if the operation fails.
     * 
     * @public
     * @async
     */
    async fetchOnlineRelaysMeta( filter?: NDKFilter ): Promise<RelayMetaSet> {
        return this.fetchRelaysMeta(filter, RelayLiveness.Online)
    }

    /**
     * @description Fetches metadata for offline relays, optionally applying an additional filter.
     * 
     * @param {NDKFilter} filter An optional `NDKFilter` object to apply additional filtering criteria.
     * @returns A promise that resolves to a `RelayMetaSet` or undefined if the operation fails.
     * 
     * @public
     * @async
     */
    async fetchOfflineRelaysMeta( filter?: NDKFilter ): Promise<RelayMetaSet> {
        return this.fetchRelaysMeta(filter, RelayLiveness.Offline)
    }

    /**
     * @description Fetches metadata for offline relays, optionally applying an additional filter.
     * 
     * @param {NDKFilter} filter An optional `NDKFilter` object to apply additional filtering criteria.
     * @returns A promise that resolves to a `RelayMetaSet` or undefined if the operation fails.
     * 
     * @public
     * @async
     */
    async fetchDeadRelaysMeta( filter?: NDKFilter ): Promise<RelayMetaSet> {
        return this.fetchRelayMetaEvents(filter, undefined, RelayLiveness.Dead)
    }

    /**
     * @description Fetches a list of online relays by providing one or more NDKFilters using RelayDiscoveryFilters keys.
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelays}
     * @param {RelayDiscoveryFilters} indexedTags A `RelayDiscoveryFilters` value representing the tag to filter by.
     * @param {NDKFilter} filter A string or array of strings representing the key(s) to filter by.
     * @returns {Promise<RelayListSet>} A promise that resolves to a list of online relays as strings or undefined if the operation fails.
     * 
     * @public
     * @async
     */
    async fetchOnlineRelaysBy( indexedTags: RelayDiscoveryFilters, filter?: NDKFilter ): Promise<RelayListSet> {
        this.maybeWarnInvalid();
        if( ![NDKKind.RelayMeta, NDKKind.RelayDiscovery].some(value => this.kinds.includes(value)) ) { 
            return this._invalidRelayFetch(`MonitorRelayFetcher.fetchOnlineRelaysBy()`, `${this.pubkey} does not publish kind ${NDKKind.RelayMeta} or ${NDKKind.RelayDiscovery}`);
        }

        const kinds = [this.kinds.includes(NDKKind.RelayDiscovery )? NDKKind.RelayDiscovery: NDKKind.RelayMeta];
        const _filter: NDKFilter = this.nip66Filter(kinds, filter, indexedTags as NDKFilter);

        return new Promise((resolve, reject ) => { 
            this.fetchOnlineRelays(_filter)
                .then( (events: RelayListSet) => {
                    resolve(events);
                })
                .catch(reject);
        });
    }

    /**
     * @description Fetches metadata for online relays by filtering a specific tag and key, optionally applying an additional filter.
     * 
     * @see {@link MonitorRelayFetcher#fetchOnlineRelaysMeta}
     * @param {RelayDiscoveryFilters} indexedTags A `RelayDiscoveryTags` value representing the tag to filter by.
     * @param {NDKFilter} filter A string or array of strings representing the key(s) to filter by.
     * @returns Promise resolves to an array of `NDKRelayMeta` objects.
     * 
     * @public
     * @async
     */
    async fetchOnlineRelaysMetaBy( indexedTags: RelayDiscoveryFilters, filter?: NDKFilter ): Promise<RelayMetaSet> {
        const _filter = indexedTags as NDKFilter;
        return new Promise((resolve, reject) => {
            this.fetchOnlineRelaysMeta(_filter)
                .then( ( events ) => {
                    resolve( events );
                })
                .catch(reject);
        });    
    }

    /**
     * @description Fetches relay discovery events for online relays, optionally applying an additional filter.
     * 
     * 
     * @param {NDKFilter} filter An optional `NDKFilter` object to apply additional filtering criteria.
     * @returns Promise resolves to a `RelayMetaSet` or undefined if the operation fails.
     * 
     * @public 
     * @async
     */
    async fetchOnlineRelaysDiscovery( filter?: NDKFilter ): Promise<RelayDiscoveryResult> {
        this.maybeWarnInvalid();
        if(this._is_fetching && !this.allow_concurrent_fetches) return this._invalidRelayFetch(`MonitorRelayFetcher.fetchOnlineRelaysDiscovery()`, 'There are already ongoing fetches. Set `allow_concurrent_fetches` to true if you want to override this behavior.')
        if( !this.kinds.includes(NDKKind.RelayDiscovery) ) { 
            return this._invalidRelayFetch(`MonitorRelayFetcher.fetchOnlineRelaysDiscovery()`, `${this.pubkey} does not publish kind ${NDKKind.RelayMeta}`);
        }

        const kinds: NDKKind[] = [NDKKind.RelayDiscovery];
        filter = this.nip66Filter(kinds, filter);
        
        const timeRange = popProp(filter, 'since', 'until');

        return new Promise(async (resolve, reject) => {
            this._is_fetching = true;
            const it = this.fetcher.allEventsIterator(
                [],
                filter || {},
                timeRange,
                { abortSignal: this.abortSignal }
            );
            const relayDiscoveryEvents: Set<NDKRelayDiscovery> = new Set();
            for await (const event of it) {
                relayDiscoveryEvents.add(new NDKRelayDiscovery(this.ndk, event))
            }
            this._is_fetching = false;
            resolve(relayDiscoveryEvents);
        })
    }

    /**
     * @description Fetches relays and sorts by distance with a given geohash
     * 
     * @param {string} geohash The geohash that represents the location to search for relays.
     * @param {number} maxPrecision The maximum precision of the geohash to search for.
     * @param {number} minPrecision The minimum precision of the geohash to search for.
     * @param {number} minResults The minimum number of results to return.
     * @param {boolean} recurse Recusively search for relays until results >= minResults
     * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter. 
     * @returns Promise resolves to an array of `RelayListSet` objects.
     * 
     * @public
     * @async
     */
    async fetchNearbyRelaysList( geohash: string, maxPrecision: number = 5, minPrecision: number = 5, minResults: number = 5, recurse: boolean = false, filter?: NDKFilter ): Promise<RelayListSet> {
        this.maybeWarnInvalid();
        if(geohash.length < minPrecision) { 
            return this._invalidRelayFetch(`MonitorRelayFetcher.fetchNearbyRelaysList()`, `Geohash ${geohash} is too short`);
        }
        if(!this?.ndk){
            return undefined;
        }
        const _filter: NDKFilter = this.nip66Filter([NDKKind.RelayDiscovery], filter);

        const geocodedEvents = await EventGeoCoded.fetchNearby(this.ndk, geohash, _filter, { maxPrecision, minPrecision, minResults, recurse } as FetchNearbyRelayOptions);
        const events: Set<NDKRelayDiscovery> = new Set(Array.from(geocodedEvents || new Set()).map( (event: EventGeoCoded) => (event as NDKRelayDiscovery) ));
        const relayList: RelayListSet = this._reduceRelayEventsToRelayStrings(events);
        return new Promise((resolve) => {
            resolve(relayList);
        });    
    }

    protected setMonitorProfile(): Promise<NDKUserProfile | undefined> {
        return new Promise( async (resolve, reject) => {
            const profile = await this._fetchMonitorProfile()
            if(!profile) return 
            this.profile = profile
            resolve(this.profile)
        })
    }

    protected setMonitorRelays(): Promise<NDKRelayList | undefined> {
        return new Promise( async (resolve, reject) => {
            const relayList = await this._fetchMonitorRelayList()
            if(!relayList) return 
            this.relays = relayList;
            resolve(this.relays)
        })
    }
    
    /**
     * @description Reduces a set of `NDKEvent` objects to a list of relay strings.
     * 
     * @param {Set<NDKRelayDiscovery | NDKRelayMeta | NDKEvent>} events A set of `NDKEvent` objects.
     * @returns Promise resolves to a list of relay strings or undefined.
     * 
     * @private
     */
    private _reduceRelayEventsToRelayStrings( events: Set<NDKRelayDiscovery | NDKRelayMeta | NDKEvent> ): RelayListSet {
        if(typeof events === 'undefined') {
                return new Set() as RelayListSet;
        }
        return new Set(Array.from(events)
            .map( event => {
                return event.tags
                    .filter( tag => tag[0] === 'd')
                    .map( tag => tag[1] )[0];
            })
        );
    }

    /**
     * @description Handles invalid relay fetch operations by logging a warning and returning undefined.
     * 
     * @param {string} caller The name of the calling method.
     * @param {string} err The error message to log.
     * @returns Always undefined, indicating an invalid operation.
     * 
     * @private
     */
    private _invalidRelayFetch( caller: string, err: string ): undefined {
        console.error(`${caller}: ${err}`);
        return undefined;
    }

    /**
     * @description Asynchronously fetches the Relay Monitor's profile information.
     * 
     * @remarks
     * This method is a private helper function intended for internal use within the class to refresh or
     * retrieve the Relay Monitor's profile information.
     * 
     * @private
     * @async
     */
    private async _fetchMonitorProfile(): Promise<NDKUserProfile | null | undefined> {
        const { pubkey } = this 
        const user = this.ndk?.getUser({ pubkey })
        await user?.fetchProfile()
        return user?.profile
    }

    /**
     * @description Asynchronously fetches t    he relay list associated with the Relay Monitor and populates the relay pool.
     * 
     * @remarks
     * - Returns `undefined` if `ndk` is not defined, indicating that the operation cannot be completed.
     * 
     * @returns {Promise<NDKRelayList | undefined>} A promise that resolves to an `NDKRelayList` object containing
     * the list of relays associated with the user, or `undefined` if the operation cannot be completed.
     * 
     * @private
     * @async
     */
    private async _fetchMonitorRelayList(): Promise<NDKRelayList | undefined> { 
        if(!this.ndk) return undefined;
        const relayList: NDKRelayList | undefined = (await getRelayListForUser(this.pubkey, this.ndk)) || undefined;
        if(relayList) {
            relayList?.relays.forEach( (relay) => {
                this.ndk?.pool.addRelay(new NDKRelay(relay));
            });
        }
        return relayList;
    }
}