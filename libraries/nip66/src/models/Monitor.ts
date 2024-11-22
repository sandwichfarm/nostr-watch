import { IEvent } from '@base/interfaces';
import { StateManager } from '@base/managers/StateManager';
import { SyncRange, SyncRangeParameter, SyncStateManager } from '@base/managers/SyncStateManager';
import { n66IEventToIMonitor } from '@base/transform';
import { Filter } from 'nostr-tools';
import { EventEmitter } from 'tseep';

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
  private _forgiveness: number = 1;

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

  addRegistration(event: IEvent): void {
    this.registration = {...defaultMonitor, ...n66IEventToIMonitor(event)};
    StateManager.emit('monitor:update:registration', {pubkey: this.pubkey, value: this.registration});
    StateManager.emit('monitor:update', this);
  }

  addProfile(event: IEvent): void {
    try {
      let profile = JSON.parse(event.content);
      this.profile = profile;
    } catch (e) {
      console.warn('Monitor addProfile error:', e);
    }
    StateManager.emit('monitor:update:profile', {pubkey: this.pubkey, value: this.profile});
    StateManager.emit('monitor:update', this);
  }

  addRelays(event: IEvent): void {
    try {
      let relays = event.tags.filter((t) => t[0] === 'r').map((t) => new URL(t[1]).toString());
      relays = relays ?? [];
      this.relays = relays;
      StateManager.emit('monitor:update:relays', {pubkey: this.pubkey, value: this.relays});
      StateManager.emit('monitor:update', this);
    } catch (e) {
      console.warn('Monitor addRelays error:', e);
    }
  }
}
