import { Nip66Event, type IEvent } from '@base/models';
import { StateManager } from '@base/managers/StateManager';
import { SyncRange, SyncRangeParameter, SyncStateManager } from '@base/managers/SyncStateManager';
import { Filter } from 'nostr-tools';
import { MonitorRegistration } from './MonitorRegistration';
import { MonitorCached } from '@base/managers/MonitorManager';
import { PubkeyProfile } from './PubkeyProfile';
import { PubkeyRelays } from './PubkeyRelays';
import { PFP } from '@base/utils/pfp';

export enum RelayLiveness {
  Online = 'ONLINE',
  Offline = 'OFFLINE',
  Dead = 'DEAD',
}

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
  enabled: boolean = false;   
  priority: number = -1;
  _registration?: MonitorRegistration;
  _profile?: PubkeyProfile
  _relays?: PubkeyRelays;
  state?: SyncStateManager;
  reportedOnline: number = 0;
  deadThreshold: number = 60*60*24*30;  
  _pfp?: string;
  
  private _lastActive: number = -1;
  private _frequencyMutiplier: number = 4;

  constructor(event: IEvent) {
    if(event.kind !== 10166) throw new Error('Monitor must be created from a 10166 event');
    this.addRegistration(event);
    this.state = new SyncStateManager(this.pubkey)
  }

  static fromCache(cached: MonitorCached): Monitor | undefined {
    if(!cached?.registration) {
      console.warn('Monitor.fromCache() called without valid registration event');
      return 
    }
    const monitor = new Monitor(cached.registration);
    if(cached?.profile){
      monitor.addProfile(cached.profile);
    }
    if(cached?.relays){
      monitor.addRelays(cached.relays)
    }
    monitor.enabled = cached.enabled ?? false;
    monitor.priority = cached?.priority ?? 0;
    monitor.lastActive = cached?.lastActive ?? -1;
    return monitor;
  }

  toCache(): MonitorCached {
    const cache: MonitorCached = {
      pubkey: this.pubkey,
      registration: this.registration?.json,
      profile: this.profile?.json,
      relays: this._relays?.json,
      enabled: this.enabled,
      priority: this.priority,
      lastActive: this.lastActive
    }
    ////console.log('monitor cache', cache)
    return cache
  }

  get active(): boolean {
    if(this.lastActive < 0) return false;
    return Math.round(Date.now()/1000)-this.frequency < this.lastActive;
  }

  get registration(): MonitorRegistration | undefined {
    return this._registration;
  }

  private set registration(value: MonitorRegistration) {
    this._registration = value;
  }

  get profile(): PubkeyProfile | undefined {
    return this._profile;
  }

  private set profile(value: PubkeyProfile | undefined) {
    this._profile = value;
  }

  get relays(): string[] {
    return this._relays?.relays || [];
  }

  private set relays(event: IEvent) {
    this._relays = new PubkeyRelays(event);
  }

  get name(): string {
    return this.profile?.name || '';
  }

  get pfp(): string { 
    if(!this._pfp) {
      this._pfp = PFP.generate(this.pubkey)
    }
    return this._pfp as string;
  }

  get photo(): string | undefined {
    return this.profile?.photo || this.pfp;
  }

  get image(): string | undefined  {
    return this.photo;
  }

  get picture(): string | undefined  {
    return this.photo;
  }
  
  get banner(): string | undefined  {
    return this.profile?.banner;
  }

  get checks(): string[] {
    return this.registration?.checks || [];
  }

  set lastActive(value: number) {
    if(!this.lastActive || value > this.lastActive) {
      this._lastActive = value;
      this.emitUpdate('lastActive', value); 
    }
  }

  get lastActive(): number {
    return this._lastActive;
  }

  // set lastSyncSince(rangeParameter: SyncRangeParameter) {
  //   if(!this?.state) this.state = new SyncStateManager(this.pubkey)
  //   this.state.lastSyncSince = rangeParameter;
  // }

  // set lastSyncUntil(rangeParameter: SyncRangeParameter) {
  //   if(!this?.state) this.state = new SyncStateManager(this.pubkey)
  //   this.state.lastSyncUntil = rangeParameter;
  // }

  get pubkey(): string {
    return this.registration?.pubkey as string;
  }

  get networks(): string[] {
    return this.registration?.networks || [];
  } 

  get eventId(): string {
    return this.registration?.id as string;
  }

  get frequencyMultiplier(): number {
    return this._frequencyMutiplier;
  }

  private set frequencyMultiplier(value: number) {
    this.emitUpdate();
    this._frequencyMutiplier = value;
  }

  get frequency(): number {
    const f = this.registration?.frequency;
    return (f || 60*60*12) * this.frequencyMultiplier
  }

  get geocode(): string | null {
    return this.registration?.geocode || null;
  }

  get checkFilter(): Filter {
    const kinds = [30166];
    const since = Math.round(Date.now() / 1000) - this?.frequency;
    const until = Math.round(Date.now() / 1000);
    const authors = [this.pubkey];
    return { kinds, since, until, authors };
  }

  get checkFilterSync(): Filter {
    const kind = 30166
    const kinds = [kind];
    const since = this.getLastSyncSince(kind) || Math.round(Date.now() / 1000) - this?.frequency;
    const authors = [this.pubkey];
    return { kinds, since, authors };
  }

  get checkFilterDead(): Filter {
    // ////console.log(`Monitor:get checkFilter(): ${this?.pubkey}`, this?.frequency);
    const kinds = [30166];
    const since = 0;
    const until = this.isDeadBefore;
    const authors = [this.pubkey];
    return { kinds, since, until, authors };
  }

  get checkFilterOffline(): Filter {
    // ////console.log(`Monitor:get checkFilter(): ${this?.pubkey}`, this?.frequency);
    const kinds = [30166];
    const since = this.isOfflineBetween[0];
    const until = this.isOfflineBetween[1];
    const authors = [this.pubkey];
    return { kinds, since, until, authors };
  }

  get checkFilterNotOnline(): Filter {
    const kinds = [30166];
    const since = 0;
    const until = this.isOnlineAfter-1;
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

  enable(): void {
    this.enabled = true;
    this.emitUpdate();
  }

  disable(): void {
    this.enabled = false;
    this.emitUpdate();
  }

  relayIs(event: IEvent): RelayLiveness {
    if(this.relayIsOnline(event)) return RelayLiveness.Online;
    if(this.relayIsDead(event)) return RelayLiveness.Dead;
    return RelayLiveness.Offline;
  }

  relayIsOffline(event: IEvent): boolean {
    const timestamp = (event.created_at as number);
    return timestamp < this.isOnlineAfter;
  }

  relayIsOnline(event: IEvent): boolean {
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

  maybeUpdateLastActive(event: IEvent | Nip66Event): boolean {
    if(!event?.created_at) return false;
    if(event.created_at > this.lastActive) {
      this.lastActive = event.created_at;
      return true;
    }
    return false;
  }

  getLastSyncSince(kind: number): number | undefined {
    if(!this?.state) this.state = new SyncStateManager(this.pubkey)
    return this.state.getLastSyncSince(kind);
  }

  getLastSyncUntil(kind: number): number | undefined {
    if(!this?.state) this.state = new SyncStateManager(this.pubkey)
    return this.state.getLastSyncUntil(kind);
  }

  getLastSync(kind: number): SyncRange | undefined {
    if(!this?.state) this.state = new SyncStateManager(this.pubkey)
    return this.state.getLastSync(kind);  
  }

  setLastSync(kind: number, rangeKey: 'since' | 'until', value: number): void {
    if(!this?.state) this.state = new SyncStateManager(this.pubkey)
    this.state.setLastSync(kind, rangeKey, value);
  }

  addRegistration(event: IEvent): void {
    this._registration = new MonitorRegistration(event);
    this.emitUpdate('registration', this.registration)
  }

  addProfile(event: IEvent): void {
    this._profile = new PubkeyProfile(event);
    this.emitUpdate('profile', this.profile);
  }

  addRelays(event: IEvent): void {
    this._relays = new PubkeyRelays(event);
    this.emitUpdate('relays', this.relays);
  }

  private emitUpdate(key?: string, value?: any): void {
    if(key && value) {
      StateManager.emit(`monitor:update:${key}`, {pubkey: this.pubkey, value});
    }
    StateManager.emit('monitor:update', this);
  }
}
