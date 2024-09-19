// // src/interfaces/ICacheAdapter.ts

// import { Event } from '../models/NostrEvent';
// import { Monitor } from '../models/Monitor';
// import { IAdapter } from './IAdapter';

// export interface GeohashOptions {
//   maxDistance?: number; 
// }

// export interface ICacheAdapter extends IAdapter {

//   // Basic CRUD operations for events
//   getEvent(id: string): Promise<Event | null>;
//   setEvent(id: string, event: Event): Promise<void>;
//   deleteEvent(id: string): Promise<void>;
//   clearEvents(): Promise<void>;

//   // Basic CRUD operations for monitors
//   getMonitor(id: string): Promise<Monitor | null>;
//   setMonitor(monitor: Monitor): Promise<void>;
//   deleteMonitor(id: string): Promise<void>;
//   clearMonitors(): Promise<void>;

//   // Basic CRUD operations for relays
//   getRelay(id: string): Promise<any | null>;
//   deleteRelay(id: string): Promise<void>;
//   clearRelays(): Promise<void>;

//   // NIP-66 Specific Query Methods
//   findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<Monitor[]>;
//   sortMonitorsByDistance(geohash: string): Promise<Monitor[]>;
//   findMonitorsByChecks(checks: string[]): Promise<Monitor[]>;
//   findRelaysByNIPs(nips: string[], condition: 'AND' | 'OR'): Promise<any[]>;
//   findRelaysByISP(isp: string): Promise<any[]>;
//   findRelaysByIP(ip: string): Promise<any[]>;
//   findRelaysByCountryCode(countryCode: string): Promise<any[]>;
//   findRelaysByOwner(ownerPubkey: string): Promise<any[]>;
//   findRelaysByNetwork(network: string): Promise<any[]>;
//   findRelaysByRTTOpen(rttOpen: number): Promise<any[]>;
//   findRelaysByLiveness(livenessStatus: 'online' | 'offline' | 'dead'): Promise<any[]>;
// }
