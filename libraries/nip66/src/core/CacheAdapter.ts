import { Adapter } from './Adapter'


import { NostrEvent } from '@models/NostrEvent';
import { Monitor } from '@models/Monitor';
import { IAdapter } from '@interfaces/IAdapter';

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
  getMonitor(id: string): Promise<Monitor | null>;
  setMonitor(monitor: Monitor): Promise<void>;
  deleteMonitor(id: string): Promise<void>;
  clearMonitors(): Promise<void>;

  // Basic CRUD operations for relays
  getRelay(id: string): Promise<any | null>;
  setRelay(relay: any): Promise<void>;
  deleteRelay(id: string): Promise<void>;
  clearRelays(): Promise<void>;

  // NIP-66 Specific Query Methods
  findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<Monitor[]>;
  sortMonitorsByDistance(geohash: string): Promise<Monitor[]>;
  findMonitorsByChecks(checks: string[]): Promise<Monitor[]>;
  
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