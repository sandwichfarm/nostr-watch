import type NDK from '@nostr-dev-kit/ndk';
import { NDKFilter, NDKEventGeoCoded as EventGeoCoded, NDKKind } from '@nostr-dev-kit/ndk';
import type { MonitorRelayFetcher, RelayMonitorSetExt, RelayMonitorDiscoveryFilters, RelayMonitorCriterias  } from './monitor-relay-fetcher';
import { castSet, castSetRelayMonitorFetchers } from '../utils';

export const MonitorFetcherOptionsDefaults: MonitorFetcherOptions = {
  activeOnly: true
}

export type MonitorFetcherOptions = {
  customFilter?: NDKFilter;
  builtinFilter?: RelayMonitorDiscoveryFilters;
  criterias?: RelayMonitorCriterias;
  nearby?: EventGeoCodedGeospatialOptions;
  activeOnly?: boolean;
}

export type EventGeoCodedGeospatialOptions = {
  geohash: string;
  maxPrecision?: number;
  minPrecision?: number; 
  minResults?: number;
  recurse?: boolean;
}

export class MonitorFetcher {
    private _ndk: NDK;
    private _options: MonitorFetcherOptions;

    constructor( ndk: NDK, options: MonitorFetcherOptions = MonitorFetcherOptionsDefaults ){
        this._options = options || {} as MonitorFetcherOptions;
        this._ndk = ndk;
    }

    get ndk(): NDK {
      return this._ndk;
    }

    set ndk(ndk: NDK) {
      this._ndk = ndk;
    }

    get options(): MonitorFetcherOptions {
      return this._options;
    }

    set options( options: MonitorFetcherOptions ) {
        this._options = options;
    }
    
  /**
   * @description Fetches monitors with optional filter and activity discriminator.
   * 
   * @param {NDKFilter} filter The NDK instance to use for fetching events.
   * @param {boolean} activeOnly Return only active monitors.
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   * @async
   */
  public async monitors( filter?: NDKFilter, activeOnly: boolean = true ): Promise<RelayMonitorSetExt> {
    if(!this.ndk){
        return undefined;
    }
    if(activeOnly){
      return this.activeOnly(filter)
    }
    return this.fetchMonitors(filter);
  }

  /**
   * @description Fetches monitors and sorts by distance with a given geohash
   * 
   * @param {NDK} ndk The NDK instance to use for fetching events.
   * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter.
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   * @async
   */
  public async activeOnly( filter?: NDKFilter ): Promise<RelayMonitorSetExt> {
      if(!this.ndk){
          return undefined;
      }
      const events: RelayMonitorSetExt = await this.fetchMonitors(filter);
      if(!events?.size) return undefined;
      let active = await MonitorFetcher.filterActiveMonitors( events );
      return active?.size? active: new Set();
  }

  /**
   * @description Fetches monitors by a MonitorTag
   * 
   * @param {RelayMonitorSetExt} monitors A set of `MonitorRelayFetcher` objects to filter.
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   * @async
   */
    public async byMonitorTags( monitorTags: RelayMonitorDiscoveryFilters, filter?: NDKFilter ): Promise<RelayMonitorSetExt> {
      const _filter: NDKFilter = { ...filter, ...monitorTags };
      const events: RelayMonitorSetExt = await this.fetchMonitors(_filter);
      return new Set(events) as RelayMonitorSetExt;
  }

  /**
   * @description Fetches monitors and sorts by distance with a given geohash
   * 
   * @param {string} geohash The geohash that represents the location to search for relays.
   * @param {number} maxPrecision The maximum precision of the geohash to search for.
   * @param {number} minPrecision The minimum precision of the geohash to search for.
   * @param {number} minResults The minimum number of results to return.
   * @param {boolean} recurse Recusively search for relays until results  >= minResults
   * @param {boolean} activeOnly Filter out inactive monitors.
   * @param {NDKFilter} filter An optional, additional filter to ammend to the default filter. 
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   * @async
   */
  public async nearby( geohash: string, maxPrecision: number = 5, minPrecision: number = 5, minResults: number = 5, recurse: boolean = false, activeOnly: boolean = false, filter?: NDKFilter ): Promise<RelayMonitorSetExt> {
      if(!this.ndk){
          return undefined;
      }
      let cb = async (evs: Set<EventGeoCoded>) => evs;
      if(activeOnly){
          cb = async (events: Set<EventGeoCoded>) => await MonitorFetcher.filterActiveMonitors(events as RelayMonitorSetExt) || new Set();
      }
      const kinds: NDKKind[] = [ NDKKind.RelayMonitor ];
      const _filter: NDKFilter = { ...filter, kinds };
      const geocodedEvents = await EventGeoCoded.fetchNearby(this.ndk, geohash, _filter, { maxPrecision, minPrecision, minResults, recurse, callbackFilter: cb });
      const events: RelayMonitorSetExt= new Set(Array.from(geocodedEvents || new Set()).map( (event: EventGeoCoded) => (event as MonitorRelayFetcher) ));
      return events;
  }

  /**
   * @description Filters monitors by their active state
   * 
   * @param {RelayMonitorSetExt} monitors A set of `MonitorRelayFetcher` objects to filter.
   * @returns Promise resolves to an array of `RelayListSet` objects.
   * 
   * @public
   * @async
   */
  static async filterActiveMonitors( monitors: RelayMonitorSetExt): Promise<RelayMonitorSetExt> {
    if(!monitors?.size) return undefined;
    // const _monitors: RelayMonitorSetExt = new Set(Array.from(monitors)); //deref
    const promises = [];
    const activeMonitors: RelayMonitorSetExt = new Set();
    for ( const $monitor of monitors) {
      const active = await $monitor.isMonitorActive()
      if(active){
        $monitor.active = true;
        activeMonitors.add($monitor);
      }
    }
    return activeMonitors;
  }

  private async fetchMonitors(filter?: NDKFilter): Promise<RelayMonitorSetExt> {
    if(!this.ndk){
      return undefined;
    }
      
    const kinds: NDKKind[] = [ NDKKind.RelayMonitor ];
    const _filter: NDKFilter = { ...filter, kinds };
    const ndkEvents = await this.ndk.fetchEvents(_filter);
    let events: RelayMonitorSetExt = new Set();
    events = castSetRelayMonitorFetchers(ndkEvents);
    // await this.checkActive(events)
    return events
  }

  private async checkActive(monitors: RelayMonitorSetExt){
    const promises: Promise<boolean>[] = [];
    monitors?.forEach( (monitor: MonitorRelayFetcher) => {
      promises.push(monitor.isMonitorActive())
    })
    await Promise.allSettled(promises)
  }
}