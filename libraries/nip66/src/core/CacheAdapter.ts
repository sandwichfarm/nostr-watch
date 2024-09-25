import { Adapter, IAdapter } from './Adapter'
import { INostrEvent } from '@interfaces/INostrEvent';

export interface GeohashOptions {
  maxDistance?: number; 
}

export interface ICacheAdapter extends IAdapter {

  // Basic CRUD operations for events
  getEvent(id: string): Promise<INostrEvent | null>;
  setEvent(id: string, event: INostrEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  clearEvents(): Promise<void>;

  // Basic CRUD operations for monitors
  getMonitor(id: string): Promise<INostrEvent | null>;
  setMonitor(monitor: INostrEvent): Promise<void>;
  deleteMonitor(id: string): Promise<void>;
  clearMonitors(): Promise<void>;

  // Basic CRUD operations for relays
  getRelay(id: string): Promise<any | null>;
  getRelays(): Promise<INostrEvent[]>;
  deleteRelay(id: string): Promise<void>;
  clearRelays(): Promise<void>;

  // NIP-66 Specific Query Methods
  findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<INostrEvent[]>;
  sortMonitorsByDistance(geohash: string): Promise<INostrEvent[]>;
  findMonitorsByChecks(checks: string[]): Promise<INostrEvent[]>;

  findRelaysByNIPs(nips: string[], condition: 'AND' | 'OR'): Promise<any[]>;
  findRelaysByISP(isp: string): Promise<any[]>;
  findRelaysByIP(ip: string): Promise<any[]>;
  findRelaysByCountryCode(countryCode: string): Promise<any[]>;
  findRelaysByOwner(ownerPubkey: string): Promise<any[]>;
  findRelaysByNetwork(network: string): Promise<any[]>;
  findRelaysByRTTOpen(rttOpen: number): Promise<any[]>;
  findRelaysByLiveness(livenessStatus: 'online' | 'offline' | 'dead'): Promise<any[]>;
}


export class CacheAdapter extends Adapter {

  get dedicatedWorker(): Worker | undefined {
    return this.workers?.cacheDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.cacheShared
  }
  
}