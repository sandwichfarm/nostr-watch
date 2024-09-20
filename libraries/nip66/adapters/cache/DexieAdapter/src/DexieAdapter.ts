//base 
import { CacheAdapter, GeohashOptions, ICacheAdapter } from '@nostrwatch/nip66/core/CacheAdapter';
import { INostrEvent } from '@nostrwatch/nip66/interfaces/INostrEvent';

//adapter
import { DexieQueue, DexieTask } from './DexieQueue';
import { transform30166 } from './processing/relay.transform';
import { IEvent } from './models/index'
import { RelayDb } from './db';

class DexieAdapter extends CacheAdapter implements ICacheAdapter {

  readonly slug: string = 'dexie'
  readonly metaUrl: string = import.meta.url

  private idb: any;
  private queue: DexieQueue;

  constructor(dbName: string = 'Relays') {
    super()
    this.idb = new RelayDb( dbName) ;
    this.queue = new DexieQueue( this.dexieTaskWorker.bind(this) )
  }

  async getRelays(): Promise<INostrEvent[]> {
    return []
  }

  async addEventsToQueue( events: INostrEvent[] ){
    await this.queue.add({ goal: "processEvents", events })
  }

  async dexieTaskWorker(task: DexieTask){
    const { id, count, goal, events } = task
    if(goal === "processEvents"){
      for(const event of events){
        await this.setEvent(event.id, event)
      }
    }
  }

  async setEvents(events: INostrEvent[]): Promise<void> {
    for(const event of events){
      await this.addEventsToQueue([event])
    }
  }

  async setEvent(id: string, event: INostrEvent): Promise<void> {
    try {
      await this.idb.events.put(event);
      if(event.kind === 30166){
        await this.idb.addCheck(event).catch(console.warn)
      }
      if(event.kind === 10166){
        await this.idb.addMonitor(event).catch(console.warn)
      }
    } catch (error) {
      console.error(`DexieAdapter setEvent error for id ${id}:`, error);
      throw error;
    }
  }

  async deleteEvent(id: string): Promise<void> {
    
  }
  
  async addRelayEvent( event: INostrEvent ){
    const errors = []
    const catchErrors = (error: any) => { errors.push(error) }
    const { check, nip11, geocodes } = await transform30166(event)
    this.idb.addCheck(check).catch(catchErrors)
    this.idb.addGeocodes(geocodes).catch(catchErrors)
  }

  async removeRelayEvent( eventId: string ){
    const errors = []
    await this.idb.removeCheck(eventId).catch((error: any) => { errors.push(error) })
  }

  /*events*/
  async getEvent(id: string): Promise<INostrEvent | null> {
    try {
      const event = await this.idb.events.get(id) as INostrEvent;
      return event || null;
    } catch (error) {
      console.error(`DexieAdapter getEvent error for id ${id}:`, error);
      return null;
    }
  }

  async deleteEvents(ids: string[]): Promise<void> {
    try {
      await this.idb.events.bulkDelete(ids);
    } catch (error) {
      console.error('DexieAdapter deleteEvents error:', error);
      throw error;
    }
  }

  async eventExists(id: string): Promise<boolean> {
    try {
      const event = await this.idb.events.get(id);
      return !!event;
    } catch (error) {
      console.error(`DexieAdapter eventExists error for id ${id}:`, error);
      return false;
    }
  }

  async clearEvents(): Promise<void> {
    try {
      await this.idb.events.clear();
    } catch (error) {
      console.error('DexieAdapter clearEvents error:', error);
      throw error;
    }
  }

  // Basic CRUD operations for monitors`
  async getMonitor(eventId: string): Promise<INostrEvent | null> { return null }
  async getMonitorsWithIds(eventIds: string[]): Promise<INostrEvent[]> { return [] }
  async setMonitor(monitor: INostrEvent): Promise<void> {}
  async deleteMonitor(id: string): Promise<void> {}
  async clearMonitors(): Promise<void> {}

  // Basic CRUD operations for relays
  async getRelay(id: string): Promise<INostrEvent | null> { return null }
  async getRelaysWithIds(eventIds: string[]): Promise<INostrEvent[] | null> { return null }
  async getRelaysWithMonitorIds(eventIds: string[]): Promise<INostrEvent[] | null> { return null }
  async deleteRelay(id: string): Promise<void> {}
  async clearRelays(): Promise<void> {}

  // // Advanced Queries: Monitors
  async findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<INostrEvent[]> { return [] }
  async sortMonitorsByDistance(geohash: string): Promise<INostrEvent[]> { return [] }
  async findMonitorsByChecks(checks: string[]): Promise<INostrEvent[]> { return [] }

  // Advanced Queries: Relays
  async findRelaysByNIPs(nips: string[], condition: 'AND' | 'OR'): Promise<INostrEvent[]> { return [] }
  async findRelaysByISP(isp: string): Promise <INostrEvent[]> { return [] }
  async findRelaysByIP(ip: string): Promise<INostrEvent[]> { return [] }
  async findRelaysByCountryCode(countryCode: string): Promise<INostrEvent[]> { return [] }
  async findRelaysByOwner(ownerPubkey: string): Promise<INostrEvent[]> { return [] }
  async findRelaysByNetwork(network: string): Promise<INostrEvent[]> { return [] }
  async findRelaysByRTTOpen(rttOpen: number): Promise<any[]> { return [] }
  async findRelaysByLiveness(livenessStatus: 'online' | 'offline' | 'dead'): Promise<any[]> { return [] }

  // async setEvent(id: string, event: Event): Promise<void> {
  //   try {
  //     await this.idb.transaction('rw', this.events, this.monitors, this.relays, async () => {
  //       await this.events.put(event);
  //       if (event.kind === 10166) {
  //         const monitor = this.extractMonitorData(event);
  //         if (monitor) {
  //           await this.monitors.put(monitor); 
  //         }
  //       } else if (event.kind === 30166) {
  //         const relay = this.extractRelayData(event);
  //         if (relay) {
  //           await this.relays.put(relay); 
  //         }
  //       }
  //     });
  //   } catch (error) {
  //     console.error(`DexieAdapter setEvent error for id ${id}:`, error);
  //     throw error;
  //   }
  // }

  // async deleteEvent(id: string): Promise<void> {
  //   try {
  //     await this.idb.transaction('rw', this.events, this.monitors, this.relays, async () => {
  //       await this.events.delete(id);
  //       const monitorsToDelete = await this.monitors.where('eventId').equals(id).toArray();
  //       for (const monitor of monitorsToDelete) {
  //         await this.monitors.delete(monitor.id);
  //         await this.relays.where('monitorId').equals(monitor.id).delete();
  //       }
  //       await this.relays.where('eventId').equals(id).delete();
  //     });
  //   } catch (error) {
  //     console.error(`DexieAdapter deleteEvent error for id ${id}:`, error);
  //     throw error;
  //   }
  // }

  // async clearEvents(): Promise<void> {
  //   try {
  //     await this.idb.transaction('rw', this.events, this.monitors, this.relays, async () => {
  //       await this.events.clear();
  //       await this.monitors.clear();
  //       await this.relays.clear();
  //     });
  //   } catch (error) {
  //     console.error('DexieAdapter clearEvents error:', error);
  //     throw error;
  //   }
  // }

  // async getMonitor(id: string): Promise<Monitor | null> {
  //   try {
  //     const monitor = await this.monitors.get(id);
  //     return monitor || null;
  //   } catch (error) {
  //     console.error(`DexieAdapter getMonitor error for id ${id}:`, error);
  //     return null;
  //   }
  // }

  // async setMonitor(monitor: Monitor): Promise<void> {
  //   try {
  //     await this.monitors.put(monitor);
  //   } catch (error) {
  //     console.error(`DexieAdapter setMonitor error for id ${monitor.id}:`, error);
  //     throw error;
  //   }
  // }

  // async deleteMonitor(id: string): Promise<void> {
  //   try {
  //     await this.idb.transaction('rw', this.monitors, this.relays, async () => {
  //       await this.monitors.delete(id);
  //       // Delete associated relays
  //       await this.relays.where('monitorId').equals(id).delete();
  //     });
  //   } catch (error) {
  //     console.error(`DexieAdapter deleteMonitor error for id ${id}:`, error);
  //     throw error;
  //   }
  // }

  // async clearMonitors(): Promise<void> {
  //   try {
  //     await this.idb.transaction('rw', this.monitors, this.relays, async () => {
  //       await this.monitors.clear();
  //       await this.relays.clear();
  //     });
  //   } catch (error) {
  //     console.error('DexieAdapter clearMonitors error:', error);
  //     throw error;
  //   }
  // }

  // async getRelay(id: string): Promise<any | null> {
  //   try {
  //     const relay = await this.relays.get(id);
  //     return relay || null;
  //   } catch (error) {
  //     console.error(`DexieAdapter getRelay error for id ${id}:`, error);
  //     return null;
  //   }
  // }

  // async setRelay(relay: any): Promise<void> {
  //   try {
  //     await this.relays.put(relay);
  //   } catch (error) {
  //     console.error(`DexieAdapter setRelay error for id ${relay.id}:`, error);
  //     throw error;
  //   }
  // }

  // async deleteRelay(id: string): Promise<void> {
  //   try {
  //     await this.relays.delete(id);
  //   } catch (error) {
  //     console.error(`DexieAdapter deleteRelay error for id ${id}:`, error);
  //     throw error;
  //   }
  // }

  // async clearRelays(): Promise<void> {
  //   try {
  //     await this.relays.clear();
  //   } catch (error) {
  //     console.error('DexieAdapter clearRelays error:', error);
  //     throw error;
  //   }
  // }

  // // -------------------------
  // // NIP-66 Specific Query Methods
  // // -------------------------


  

  // /**
  //  * Finds monitors closest to a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  * @param options Additional options (e.g., max distance).
  //  */
  // async findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<Monitor[]> {
  //   try {
  //     // For simplicity, find monitors with geohash starting with the provided geohash
  //     const monitors = await this.monitors
  //       .where('geohash')
  //       .startsWith(geohash)
  //       .toArray();

  //     // If maxDistance is specified, further filter based on actual distance
  //     if (options?.maxDistance) {
  //       return monitors.filter((monitor) => {
  //         const distance = this.computeGeohashDistance(geohash, monitor.geohash || '');
  //         return distance <= options.maxDistance!;
  //       });
  //     }

  //     return monitors;
  //   } catch (error) {
  //     console.error('DexieAdapter findMonitorsByGeohash error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Sorts monitors by distance from a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  */
  // async sortMonitorsByDistance(geohash: string): Promise<NostrEvents[]> {
  //   try {
  //     const allMonitors = await this.idb.monitors.where('geohash').isNotNull().toArray();

  //     // Calculate distances
  //     const monitorsWithDistance = allMonitors.map((monitor: INostrEvent) => {
  //       const distance = this.computeGeohashDistance(geohash, monitor.tags.find(t => t[0] === 'g')?.[1] || '');
  //       return { monitor, distance };
  //     });

  //     // Sort by distance
  //     monitorsWithDistance.sort((a, b) => a.distance - b.distance);

  //     // Return sorted monitors
  //     return monitorsWithDistance.map((item) => item.monitor);
  //   } catch (error) {
  //     console.error('DexieAdapter sortMonitorsByDistance error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds monitors conducting specific checks.
  //  * @param checks Array of checks to filter by.
  //  */
  // async findMonitorsByChecks(checks: string[]): Promise<Monitor[]> {
  //   try {
  //     const monitors = await this.monitors.toArray();
  //     return monitors.filter(
  //       (monitor) => monitor.checks && checks.every((check) => monitor.checks!.includes(check))
  //     );
  //   } catch (error) {
  //     console.error('DexieAdapter findMonitorsByChecks error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays supporting certain NIPs.
  //  * @param nips Array of NIPs to filter by.
  //  * @param condition 'AND' or 'OR' condition.
  //  */
  // async findRelaysByNIPs(nips: string[], condition: 'AND' | 'OR'): Promise<any[]> {
  //   try {
  //     let relays: Relay[] = [];
  //     if (condition === 'AND') {
  //       relays = await this.relays.where('nips').equals(nips).toArray();
  //     } else {
  //       relays = await this.relays
  //         .filter((relay) => relay.nips && relay.nips.some((nip) => nips.includes(nip)))
  //         .toArray();
  //     }
  //     return relays;
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByNIPs error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by ISP.
  //  * @param isp The ISP to filter by.
  //  */
  // async findRelaysByISP(isp: string): Promise<any[]> {
  //   try {
  //     return await this.relays.where('isp').equalsIgnoreCase(isp).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByISP error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by IP address.
  //  * @param ip The IP address to filter by.
  //  */
  // async findRelaysByIP(ip: string): Promise<any[]> {
  //   try {
  //     return await this.relays.where('ip').equals(ip).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByIP error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by country code.
  //  * @param countryCode The country code to filter by.
  //  */
  // async findRelaysByCountryCode(countryCode: string): Promise<any[]> {
  //   try {
  //     return await this.relays.where('countryCode').equalsIgnoreCase(countryCode).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByCountryCode error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by owner pubkey.
  //  * @param ownerPubkey The owner's public key.
  //  */
  // async findRelaysByOwner(ownerPubkey: string): Promise<any[]> {
  //   try {
  //     return await this.relays.where('ownerPubkey').equals(ownerPubkey).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByOwner error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by network type (e.g., clearnet, tor).
  //  * @param network The network type to filter by.
  //  */
  // async findRelaysByNetwork(network: string): Promise<any[]> {
  //   try {
  //     return await this.relays.where('network').equalsIgnoreCase(network).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByNetwork error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by RTT (round-trip time) open value.
  //  * @param rttOpen The maximum RTT open value.
  //  */
  // async findRelaysByRTTOpen(rttOpen: number): Promise<any[]> {
  //   try {
  //     return await this.relays.where('rttOpen').belowOrEqual(rttOpen).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByRTTOpen error:', error);
  //     return [];
  //   }
  // }

  // /**
  //  * Finds relays by liveness status.
  //  * @param livenessStatus 'online', 'offline', or 'dead'.
  //  */
  // async findRelaysByLiveness(livenessStatus: 'online' | 'offline' | 'dead'): Promise<any[]> {
  //   try {
  //     return await this.relays.where('livenessStatus').equals(livenessStatus).toArray();
  //   } catch (error) {
  //     console.error('DexieAdapter findRelaysByLiveness error:', error);
  //     return [];
  //   }
  // }

  // // -------------------------
  // // Helper Methods
  // // -------------------------

  // /**
  //  * Extracts monitor data from a 10166 event.
  //  * @param event The event to extract from.
  //  */
  // private extractMonitorData(event: Event): Monitor | null {
  //   if (event.kind !== 10166) return null;

  //   const frequencyTag = event.tags.find((tag) => tag[0] === 'frequency');
  //   if (!frequencyTag) return null;

  //   const frequency = parseInt(frequencyTag[1], 10);
  //   if (isNaN(frequency) || frequency <= 0) return null;

  //   const geohashTag = event.tags.find((tag) => tag[0] === 'g');
  //   const geohash = geohashTag ? geohashTag[1] : undefined;

  //   const checks = event.tags
  //     .filter((tag) => tag[0] === 'c')
  //     .map((tag) => tag[1]);

  //   return {
  //     id: event.pubkey, // Using pubkey as monitor ID
  //     eventId: event.id,
  //     frequency,
  //     lastActive: event.created_at,
  //     geohash,
  //     checks,
  //   };
  // }

  // /**
  //  * Extracts relay data from a 30166 event.
  //  * @param event The event to extract from.
  //  */
  // private extractRelayData(event: Event): Relay | null {
  //   if (event.kind !== 30166) return null;

  //   const relayTag = event.tags.find((tag) => tag[0] === 'd');
  //   if (!relayTag) return null;

  //   const relayId = relayTag[1]; // Assuming relay URL as ID

  //   const nips = event.tags
  //     .filter((tag) => tag[0] === 'N')
  //     .map((tag) => tag[1]);

  //   const ispTag = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'host.isp');
  //   const isp = ispTag ? ispTag[1][1] : undefined;

  //   const ipTag = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'dns.ipv4');
  //   const ip = ipTag ? ipTag[1] : undefined;

  //   const countryCodeTag = event.tags.find((tag) => tag[0] === 'l' && tag[2] === 'countryCode');
  //   const countryCode = countryCodeTag ? countryCodeTag[1] : undefined;

  //   const ownerTag = event.tags.find((tag) => tag[0] === 'p');
  //   const ownerPubkey = ownerTag ? ownerTag[1] : undefined;

  //   const networkTag = event.tags.find((tag) => tag[0] === 'n');
  //   const network = networkTag ? networkTag[1] : undefined;

  //   const rttOpenTag = event.tags.find((tag) => tag[0] === 'rtt-open');
  //   const rttOpen = rttOpenTag ? parseInt(rttOpenTag[1], 10) : undefined;

  //   // Liveness status is determined elsewhere based on thresholds

  //   return {
  //     id: relayId,
  //     eventId: event.id,
  //     monitorId: event.pubkey, // Assuming relay is associated with the monitor's pubkey
  //     nips,
  //     isp,
  //     ip,
  //     countryCode,
  //     ownerPubkey,
  //     network,
  //     rttOpen
  //   };
  // }

  // /**
  //  * Computes the approximate distance between two geohashes.
  //  * This is a placeholder function; implement actual geohash distance calculation.
  //  */
  // private computeGeohashDistance(geohash1: string, geohash2: string): number {
  //   return Math.abs(geohash1.length - geohash2.length);
  // }
}

export default DexieAdapter