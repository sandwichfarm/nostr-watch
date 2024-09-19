// src/services/MonitorService.ts

import { ICacheAdapter } from '../interfaces/ICacheAdapter';
import { Monitor } from '../models/Monitor';
import { NostrEvent } from '@models/NostrEvent';

export class MonitorService {

  private cacheAdapter: ICacheAdapter
  private websocketAdapter: IWebSocketAdapter

  constructor( adapters: AdaptersArgument ) {
    this.cacheAdapter = adapters.cacheAdapter
    this.websocketAdapter = adapters.websocketAdapter
  }

  // async populateMonitors(): Promise<void> {
  //   const monitors = await this.websocketAdapter.fetchMonitors()
  // }

  // async _fetchMonitors(): Promise<NostrEvent[] | undefined> { return }

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
