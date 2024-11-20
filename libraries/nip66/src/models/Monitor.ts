import { IEvent } from '@base/interfaces';
import { SyncRange, SyncRangeParameter, SyncStateManager } from '@base/managers/SyncStateManager';
import { n66IEventToIMonitor } from '@base/transform';
import { Filter } from 'nostr-tools';

export type IMonitor = {
  pubkey: string; 
  eventId: string; 
  lastActive: number;
  frequency?: number;
  geohash?: string;
  geocode?: string[];
  checks?: string[];
}

const defaultMonitor: IMonitor = {
  pubkey: '',
  eventId: '',
  lastActive: -1,
}

export class Monitor {
  priority: number = -1;
  registration: IMonitor;
  profile: any;
  relays: string[];
  state: SyncStateManager;

  constructor(event: IEvent) {
    if(event.kind !== 10166) throw new Error('Needs to be instantiated with a Monitor Registration event [kind: 10166');
    this.priority = 0;
    this.registration = {} as IMonitor;
    this.profile = {};
    this.relays = [];
    this.addRegistration(event);
    this.state = new SyncStateManager(this.pubkey)
  }

  set lastActive(value: number) {
    this.registration.lastActive = value ? value : -1;
  }

  get lastActive(): number {
    return this.registration.lastActive || -1;
  }

  set lastSyncSince(rangeParameter: SyncRangeParameter) {
    this.state.lastSyncSince = rangeParameter;
  }

  set lastSyncUntil(rangeParameter: SyncRangeParameter) {
    this.state.lastSyncUntil = rangeParameter;
  }

  getLastSyncSince(kind: number): number {
    return this.state.getLastSyncSince(kind);
  }

  getLastSyncUntil(kind: number): number | undefined {
    return this.state.getLastSyncUntil(kind);
  }

  getLastSync(kind: number): SyncRange {
    return this.state.getLastSync(kind);  
  }

  setLastSync(kind: number, rangeKey: 'since' | 'until', value: number): void {
    this.state.setLastSync(kind, rangeKey, value);
  }

  get pubkey(): string {
    return this.registration.pubkey;
  }

  get eventId(): string {
    return this.registration.eventId;
  }

  get frequency(): number {
    const f = this.registration.frequency
    return (f || 60*60*12) * 24
  }

  get geohash(): string {
    return this.registration.geohash || '';
  }

  get geocode(): string[] {
    return this.registration.geocode || [];
  }

  get checkFilter(): Filter {
    const frequency = this?.frequency;
    console.log(`ensureMonitorsActive: ${this?.pubkey}`, frequency);
    const kinds = [30166];
    const since = Math.round(Date.now() / 1000) - frequency;
    const authors = [this.pubkey];
    return { kinds, since, authors };
  }

  addRegistration(event: IEvent): void {
    this.registration = {...defaultMonitor, ...n66IEventToIMonitor(event)};
    console.log(`Monitor: addRegistration:`, this.registration);
  }

  addProfile(event: IEvent, hook?: any): void {
    try {
      let profile = JSON.parse(event.content);
      if (hook?.beforeAddProfile) {
        profile = hook.beforeAddProfile(profile);
      }
      this.profile = profile;
      hook?.afterAddProfile?.(profile);
    } catch (e) {
      console.warn('Monitor addProfile error:', e);
    }
  }

  addRelays(event: IEvent, hook?: any): void {
    try {
      let relays = event.tags.filter((t) => t[0] === 'r').map((t) => new URL(t[1]).toString());
      relays = relays ?? [];
      if (hook?.beforeAddRelays) {
        relays = hook.beforeAddRelays(relays);
      }
      this.relays = relays;
      hook?.afterAddRelays?.(relays);
    } catch (e) {
      console.warn('Monitor addRelays error:', e);
    }
  }
}
