// src/services/RelayService.ts

import { IWebsocketAdapter } from '@core/WebsocketAdapter';
import { ICacheAdapter } from '@core/CacheAdapter';
import { IAdaptersArgument } from '@interfaces/IAdaptersArgument';
// import { IEvent } from '../models/IEvent';

export class RelayService {
  
  private cacheAdapter: ICacheAdapter
  private websocketAdapter: IWebsocketAdapter

  constructor( adapters: IAdaptersArgument ) {
    this.cacheAdapter = adapters.cacheAdapter
    this.websocketAdapter = adapters.websocketAdapter
  }

  getOnlineRelaysByMonitorPubkey(monitorPubkey: string){

  }
}



  // /**
  //  * Fetches recent 30166 events for active monitors based on their frequency.
  //  * @param activeMonitors Array of active monitors.
  //  */
  // async fetchRecent30166Events(activeMonitors: { pubkey: string }[]): Promise<void> {
  //   const currentTime = Math.floor(Date.now() / 1000);

  //   for (const monitor of activeMonitors) {
  //     const monitorData = await this.cacheAdapter.getMonitor(monitor.pubkey);
  //     if (!monitorData) continue;

  //     const since = currentTime - monitorData.frequency;

  //     try {
  //       const relays = await this.cacheAdapter.relays
  //         .where('monitorId')
  //         .equals(monitorData.id)
  //         .and((relay) => relay.livenessStatus === 'online' && relay.created_at >= since)
  //         .toArray();

  //       // TOODOO: Process relays
  //     } catch (error) {
  //       console.error(`RelayService fetchRecent30166Events error for monitor ${monitor.pubkey}:`, error);
  //     }
  //   }
  // }
