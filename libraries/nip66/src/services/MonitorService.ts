// src/services/MonitorService.ts

import { ICacheAdapter } from '@base/core/CacheAdapter';
import { IWebsocketAdapter } from '@base/core/WebsocketAdapter';
import { IEvent } from '@base/interfaces';
import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { IMonitor } from '@base/models';

export type MonitorPriorities = MonitorPriority[]

export enum MonitorPriority { 
  Follows   = "FOLLOWS",
  Wot       = "WOT",
  Checks    = "CHECKS",
  Geohash   = "GEOHASH",
  Country   = "COUNTRY",
  Network   = "NETWORK"
}

export const DEFAULT_ANON_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Network,
  MonitorPriority.Checks,
  MonitorPriority.Geohash
]

export const DEFAULT_AUTHED_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Follows,
  MonitorPriority.Wot,
  MonitorPriority.Checks
]

export class MonitorService {

  private cacheAdapter: ICacheAdapter
  private websocketAdapter: IWebsocketAdapter

  constructor( adapters: IAdaptersArgument ) {
    this.cacheAdapter = adapters.cacheAdapter
    this.websocketAdapter = adapters.websocketAdapter
  }

  async init(): Promise<void> {
    if(this?.cacheAdapter?.init)
      await this?.cacheAdapter?.init()
  }

  async bootstrap(): Promise<void> {  
    console.log('MonitorService bootstrap')
    this.populateMonitors();
  }

  populateMonitors(): void {
    console.log('populateMonitors')
    this.populateRegistrations();
    // this.populateRelayLists(); 
    // this.populateProfiles();  
  }

  populateRegistrations(): void {
    //console.log('populateRegistrations')
    this.websocketAdapter.populate([
      {
        kinds: [10166]
      }
    ]);
  }

  populateProfiles(): void {
    //console.log('populateProfiles') 
    this.websocketAdapter.populate([
      {
        kinds: [0]
      }
    ]);
  }

  populateRelayLists(): void { 
    //console.log('populateRelayLists')
    this.websocketAdapter.populate([
      {
        kinds: [10002]
      }
    ]);
  }

  async prioritizeMonitors(priority: MonitorPriority): Promise<void> { 
    // return this.cacheAdapter.setMonitorPriorities(priority);
  }

  async populateMonitorChecks(): Promise<void> { 
    // const monitorPubkeys = await this.cacheAdapter.getMonitors();
    // for(const monitorPubkey of monitorPubkeys){
    //   this.websocketAdapter.cacheManyEvents([
    //     {
    //       kinds: [30166],
    //       authors: [monitorPubkey]
    //     }
    //   ]);
    // }
  }

  async ensureMonitorsActive(): Promise<void> {
    // const monitors = await this.cacheAdapter.getMonitors('all');
    // const filters: Filter[] = [];
    // monitorRecords.forEach(async (monitorRecord) => {
    //   const { monitorPubkey, frequency } = monitorRecord;
    //   const limit = 1;
    //   const kinds = [30166];
    //   const since = Math.round(Date.now()/1000)-frequency;
    //   const authors = [monitorPubkey];
    //   filters.push({ limit, kinds, since, authors })
    // });
    // const events: IEvent[] = await this.websocketAdapter.fetchEvents(filters);
    // for(const event of events){
    //   const { pubkey, created_at } = event;
    //   await this.updateCacheMonitorActive(pubkey, created_at)
    // } 
  }

  async getActiveMonitors(): Promise<string[]> {
    const monitors: string[] = []
    return monitors
  }

  async updateCacheMonitorActive(pubkey: string, lastActive: number): Promise<void> { 
    const monitor = { pubkey, lastActive }
    // if(!this.cacheAdapter?.patchMonitor) return console.warn('CacheAdapter does not support patchMonitor');
    // await this.cacheAdapter.patchMonitor(monitor);
  }

  // async _fetchMonitors(): Promise<IEvent[] | undefined> { return }

  // async _determineMonitorLiveness(): Promise<boolean> { return false }
  
  // async getActive(): Promise<Monitor[]> { 
  //   const currentTime = Math.floor(Date.now() / 1000); 

  //   try {
  //     const monitors = await this.cacheAdapter.monitors.toArray();

  //     const activeMonitors = monitors.filter((monitor) => {
  //       return currentTime - monitor.lastActive <= monitor.frequency;
  //     });

  //     return activeMonitors;
  //   } catch (error) {
  //     console.error('MonitorService getActiveMonitors error:', error);
  //     return [];
  //   }
  // }  

  // /**
  //  * Finds monitors closest to a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  * @param options Additional options (e.g., max distance).
  //  */
  // async findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<Monitor[]> {
  //   return await this.cacheAdapter.findMonitorsByGeohash(geohash, options);
  // }

  // /**
  //  * Sorts monitors by distance from a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  */
  // async sortMonitorsByDistance(geohash: string): Promise<Monitor[]> {
  //   return await this.cacheAdapter.sortMonitorsByDistance(geohash);
  // }

  // /**
  //  * Finds monitors conducting specific checks.
  //  * @param checks Array of checks to filter by.
  //  */
  // async findMonitorsByChecks(checks: string[]): Promise<Monitor[]> {
  //   return await this.cacheAdapter.findMonitorsByChecks(checks);
  // } 
}
