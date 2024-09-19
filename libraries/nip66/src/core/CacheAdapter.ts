import { Adapter, IAdapter } from './Adapter'


import { NostrEvent } from '@models/NostrEvent';

export interface GeohashOptions {
  maxDistance?: number; 
}

export interface ICacheAdapter extends IAdapter {

  // Basic CRUD operations for events
  getEvent(id: string): Promise<NostrEvent | null>;
  setEvent(id: string, event: NostrEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  clearEvents(): Promise<void>;

  // Basic CRUD operations for monitors
  getMonitor(id: string): Promise<NostrEvent | null>;
  setMonitor(monitor: NostrEvent): Promise<void>;
  deleteMonitor(id: string): Promise<void>;
  clearMonitors(): Promise<void>;

  // Basic CRUD operations for relays
  getRelay(id: string): Promise<any | null>;
  getRelays(): Promise<NostrEvent[]>;
  deleteRelay(id: string): Promise<void>;
  clearRelays(): Promise<void>;

  // NIP-66 Specific Query Methods
  findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<NostrEvent[]>;
  sortMonitorsByDistance(geohash: string): Promise<NostrEvent[]>;
  findMonitorsByChecks(checks: string[]): Promise<NostrEvent[]>;

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