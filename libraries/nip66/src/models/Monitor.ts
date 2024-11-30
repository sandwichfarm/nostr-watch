import { type IEvent } from '@base/models';
import { StateManager } from '@base/managers/StateManager';
import { SyncRange, SyncRangeParameter, SyncStateManager } from '@base/managers/SyncStateManager';
import { n66IEventToIMonitor } from '@base/transform';
import { Filter } from 'nostr-tools';
import { EventEmitter } from 'tseep';

export type IRelaysByLiveness = {
  online: IEvent[],
  offline: IEvent[],
  dead: IEvent[],
}


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
  deadThreshold: number = 60*60*24*30;  
  private _frequencyForgivenessMultiplier: number = 4;

  constructor(event: IEvent) {
    if(event?.kind !== 10166) throw new Error('Needs to be instantiated with a Monitor Registration event [kind: 10166');
    this.priority = 0;
    this.registration = {} as IMonitor;
    this.profile = {};
    this.relays = [];
    this.addRegistration(event);
    this.state = new SyncStateManager(this.pubkey)
  }

  set lastActive(value: number) {
    if(!this.registration.lastActive || value > this.registration.lastActive){
      this.registration.lastActive = value;
      this.emitUpdate();
    }   
  }

  get checks(): string[] {
    return this.registration.checks || [];
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
    return (f || 60*60*12) * this._frequencyForgivenessMultiplier
  }

  get geohash(): string {
    return this.registration.geohash || '';
  }

  get geocode(): string[] {
    return this.registration.geocode || [];
  }

  get checkFilter(): Filter {
    // console.log(`Monitor:get checkFilter(): ${this?.pubkey}`, this?.frequency);
    const kinds = [30166];
    const since = Math.round(Date.now() / 1000) - this?.frequency;
    const until = Math.round(Date.now() / 1000);
    const authors = [this.pubkey];
    return { kinds, since, until, authors };
  }

  get isDeadBefore(): number {
    return Math.round(Date.now() / 1000) - this.deadThreshold;
  }

  get isOnlineAfter(): number {
    return Math.round(Date.now() / 1000) - this.frequency;
  }

  get isOfflineBetween(): [number, number] {
    return [this.isDeadBefore, this.isOnlineAfter];
  }

  relayIsOffline(event: IEvent): boolean {
    const timestamp = (event.created_at as number);
    return timestamp < this.isOnlineAfter;
  }

  relayIsOnline(event: IEvent): boolean {
    console.assert(this !== undefined, '`this` is undefined in relayIsOnline!');
    console.assert(this.isOnlineAfter !== undefined, '`this.isOnlineAfter` is undefined!');
    const timestamp = (event.created_at as number);
    return timestamp >= this.isOnlineAfter;
  }

  relayIsDead(event: IEvent): boolean {
    const timestamp = (event.created_at as number);
    return timestamp < this.isDeadBefore;
  }

  async returnOnlineRelays(events: IEvent[]): Promise<IEvent[]> {
    return events.filter(this.relayIsOnline.bind(this));
  }

  async returnOfflineRelays(events: IEvent[]): Promise<IEvent[]> {
    return events.filter(this.relayIsOffline.bind(this));
  }

  async returnDeadRelays(events: IEvent[]): Promise<IEvent[]> {
    return events.filter(this.relayIsDead.bind(this));
  }
  
  async relaysByLiveness(events: IEvent[]): Promise<IRelaysByLiveness> {
    const results: IRelaysByLiveness = {
      online: [],
      offline: [],
      dead: [],
    };
    if(!this?.frequency) {
      results.online = events;
      return results;
    }
    events.forEach((event) => {
      if(this.relayIsOnline(event)) {
        results.online.push(event);
      } else if(this.relayIsOffline(event)) {
        results.offline.push(event);
      } else if(this.relayIsDead(event)) {
        results.dead.push(event);
      }
    });
    return results;
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
    this.emitUpdate('registration', this.registration)
  }

  addProfile(event: IEvent): void {
    try {
      let profile = JSON.parse(event.content);
      this.profile = profile;
    } catch (e) {
      console.warn('Monitor addProfile error:', e);
    }
    this.emitUpdate('profile', this.profile);
  }

  addRelays(event: IEvent): void {
    try {
      let relays = event.tags.filter((t) => t[0] === 'r').map((t) => new URL(t[1]).toString());
      relays = relays ?? [];
      this.relays = relays;
      this.emitUpdate('relays', this.relays);
    } catch (e) {
      console.warn('Monitor addRelays error:', e);
    }
  }

  private emitUpdate(key?: string, value?: any): void {
    if(key && value) {
      StateManager.emit(`monitor:update:${key}`, {pubkey: this.pubkey, value});
    }
    
    StateManager.emit('monitor:update', this);
  }
}
