// src/services/MonitorService.ts

import { ICacheAdapter } from '@base/core/CacheAdapter';
import { IWebsocketAdapter, SubscribeHandlers } from '@base/core/WebsocketAdapter';
import { IEvent } from '@base/interfaces';
import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { ICheck, IMonitor } from '@base/models';
import { k30166ToICheck, n66IEventToIMonitor } from '@base/transform';
import { Filter } from 'nostr-tools';

export type MonitorPriorities = MonitorPriority[]

export enum MonitorPriority { 
  Follows   = "FOLLOWS",
  Wot       = "WOT",
  Checks    = "CHECKS",
  Geohash   = "GEOHASH",
  Country   = "COUNTRY",
  Network   = "NETWORK"
}

export const DEFAULT_ANON_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Network,
  MonitorPriority.Checks,
  MonitorPriority.Geohash
]

export const DEFAULT_AUTHED_MONITOR_PRIORITIES: MonitorPriorities = [
  MonitorPriority.Follows,
  MonitorPriority.Wot,
  MonitorPriority.Checks
]

export type PrioritizedMonitors = {
  primary?: IMonitor,
  secondary?: IMonitor,
  tertiary?: IMonitor
  quaternary?: IMonitor
}

export interface IGroupedRelays {
  userMeta?: string[];
  nip66?: string[];
}

export interface IMonitorsMap extends Map<string, IMonitorResult> {}

export interface IMonitorResult {
  priority: number;
  registration: IMonitor,
  profile: any,
  relays: string[]
}

export const defaultMonitorResult: IMonitorResult = {
  priority: 0,
  registration: {} as IMonitor,
  profile: {},
  relays: []
}

export type IServiceHook = (...args: any[]) => void | undefined | any;
export type TServiceHooks = Record<string, IServiceHook>;

export class MonitorService {

  private cacheAdapter: ICacheAdapter
  private websocketAdapter: IWebsocketAdapter
  private _monitors: IMonitorsMap = new Map()
  private _hooks: TServiceHooks = {}
  private _groupedRelays: IGroupedRelays = {}

  constructor( adapters: IAdaptersArgument ) {
    this.cacheAdapter = adapters.cacheAdapter
    this.websocketAdapter = adapters.websocketAdapter
  }

  async init(): Promise<void> {
    if(this?.cacheAdapter?.init)
      await this?.cacheAdapter?.init()
  }

  async bootstrap(): Promise<void> {  
    console.log('MonitorService bootstrap')
    this.populateMonitors();
  }

  get hook() {
    return this._hooks
  }

  get monitors(): IMonitorsMap {
    return this._monitors
  }

  get monitorsArray(): IMonitorResult[] {
    return Array.from(this._monitors).map(r => r[1]).sort((a, b) => a.priority - b.priority)
  }

  get primary(): IMonitorResult | undefined {
    return this.monitorsArray!.find((monitor) => monitor.priority === 1)
  }

  get secondary(): IMonitorResult | undefined {
    return this.monitorsArray!.find((monitor) => monitor.priority === 2)
  }

  get tertiary(): IMonitorResult | undefined {
    return this.monitorsArray!.find((monitor) => monitor.priority === 3)
  }

  get quaternary(): IMonitorResult | undefined {
    return this.monitorsArray!.find((monitor) => monitor.priority === 4)
  }

  get nip66Relays(): string[] | undefined {
    return this._groupedRelays?.nip66
  }

  get userMetaRelays(): string[] | undefined {
    return this._groupedRelays?.userMeta
  }

  addRelay(to: keyof IGroupedRelays, relay: string): void {
    if(!this._groupedRelays?.[to])
      this._groupedRelays[to] = []
    this._groupedRelays?.[to].push(relay);
  }

  removeRelay(from: keyof IGroupedRelays, relay: string): void {
    if(!this._groupedRelays?.[from]) return;
    this._groupedRelays[from] = this._groupedRelays[from].filter((r) => r !== relay);
  }

  private addMonitorRegistration(event: IEvent): void {
    let registration = n66IEventToIMonitor(event);
    if(this.hook?.beforeAddRegistration) {
      registration = this.hook?.beforeAddRegistration?.(registration)
    }
    this.monitors.set(event.pubkey, { ...defaultMonitorResult, registration })
    this.hook?.afterAddRegistration?.(registration)
  }

  private addMonitorProfile(profileEvent: IEvent): void {
    try {
      let profile = JSON.parse(profileEvent.content);
      if(this.hook?.beforeAddProfile) {
        profile = this.hook?.beforeAddProfile(profile)
      }
      this.monitors.set(profileEvent.pubkey, { ...defaultMonitorResult, profile })
      this.hook?.afterAddProfile?.(profile)
    }
    catch(e) {
      console.warn('MonitorService addMonitorProfile error:', e)
    }
  }

  private addMonitorRelays(event: IEvent): void {
    try {
      let relays = event.tags.filter(t=>t[0] === 'r').map(t=>new URL(t[1]).toString());
      if(this.hook?.beforeAddRelays) {
        relays = this.hook?.beforeAddRelays(relays)
      }
      this.monitors.set(event.pubkey, { ...defaultMonitorResult, relays })
      this.hook?.afterAddRelays?.(relays)
    }
    catch(e) {
      console.warn('MonitorService addMonitorProfile error:', e)
    }
  }

  async populateMonitors(): Promise<void> {
    console.log('populateMonitors')
    await this.populateMonitorRegistrations();
    await this.populateMonitorData();
    await this.ensureMonitorsActive();
    await this.prioritizeMonitors();
  }

  async populateMonitorRegistrations(): Promise<void> {
    console.log('populateMonitorRegistrations')
    const callbacks = {
      onevent: (Event10166: IEvent) => {
        console.log('populateMonitorRegistrations: Event10166', Event10166.id)
        this.addMonitorRegistration(Event10166)
      }
    }
    console.log('populateMonitorRegistrations: awaiting populate')
    await this.websocketAdapter.populate(
      [{ kinds: [10166] }],
      this.nip66Relays,
      callbacks
    );
    console.log('populateMonitorRegistrations: done')
  }

  async populateMonitorData(): Promise<void>  { 
    const monitors = [...this.monitorsArray.map(m => m.registration)];
    const authors = monitors.map( (monitor: IMonitor) => monitor.pubkey )
    authors.length = authors.length > 4? 4: authors.length
    const callbacks = {
      onevent: (event: IEvent) => {
        const { kind} = event;
        if(kind === 0) {
          this.addMonitorProfile(event)
        }
        if(kind === 10002) {
          this.addMonitorRelays(event)
        }
      }
    }
    await this.websocketAdapter.populate(
      [{
          authors,
          kinds: [0, 10002]
      }],
      this.userMetaRelays,
      callbacks
    )
  }

  async ensureMonitorsActive(): Promise<void> {
    const monitors = this.monitorsArray.map( (monitor) => [monitor.registration.pubkey, monitor.registration.frequency] as [ string, number ] )
    const filters: Filter[] = [];
    const events: IEvent[] = [];
    monitors.forEach(async ([monitorPubkey, monitorFrequency]) => {
      const limit = 1;
      const kinds = [30166];
      const since = Math.round(Date.now()/1000)-monitorFrequency;
      const authors = [monitorPubkey];
      filters.push({ limit, kinds, since, authors })
    });
    const onevent = (event: IEvent) => {
      events.push(event)
    }
    const callbacks: SubscribeHandlers = {}
    await this.websocketAdapter.subscribe({
        filters,
        options: {
          cache: false,
          returnResults: true,
          keepAlive: false,
          stream: false
        }
      },
      callbacks
    );  
    for(const event of events){
      const { pubkey, created_at } = event;
      const monitor = this.monitors.get(pubkey)
      if(monitor) {
        const lastActiveOld = monitor.registration.lastActive;
        const lastActiveNew = created_at as number;
        const updateWithNew = !lastActiveOld || lastActiveNew > lastActiveOld
        monitor.registration.lastActive = updateWithNew? lastActiveNew: lastActiveOld;
        this.monitors.set(pubkey, monitor)
      }
    } 
  }

  async prioritizeMonitors(priority?: MonitorPriority): Promise<void> { 
    if(!priority) { 
      priority = MonitorPriority.Checks;
    }
    const monitors = this.monitorsArray.filter((monitor) => {
      if(!monitor?.registration?.lastActive) return false;
      return monitor.registration.lastActive > 0
    });
    for(const monitor of monitors){
      const sortedMonitors = monitors.sort((a, b) => {
        const checksA = a?.registration?.checks?.length || 0;
        const checksB = b?.registration?.checks?.length || 0;
        return checksA - checksB;
      });
      sortedMonitors.forEach((sortedMonitor, index) => {
        sortedMonitor.priority = index + 1;
      });
    }
  }

  async populateMonitorChecks(): Promise<void> { 
    const monitors = this.monitorsArray.slice(0, 3);
    const filters: Filter[] = [];
    monitors.forEach( (monitor) => {
      const authors = [monitor.registration.pubkey];
      const frequency = monitor.registration.frequency;
      const since = Math.round(Date.now()/1000)-frequency;
      filters.push({ authors, since, kinds: [30166] });
    });
    const onevent = (event: IEvent) => {
      this?.hook?.onMonitorCheckEvent?.(event);
      if(this?.hook?.onMonitorCheck) {
        const check: ICheck = k30166ToICheck(event);
        this?.hook?.onMonitorCheck?.(check);
      }
    }
    const callbacks: SubscribeHandlers = { onevent }
    const result: IEvent[] | boolean = await this.websocketAdapter.fetch({
        filters,
        options: {
          cache: true,
          returnResults: true,
          keepAlive: true,
          stream: true
        }
      },
      callbacks
    );
    if(result instanceof Array){
      for(const event of result){
        const { pubkey, content } = event;
        const monitor = this.monitors.get(pubkey)
        if(monitor) {
          monitor.registration.checks = JSON.parse(content)
          this.monitors.set(pubkey, monitor)
        }
      } 
    }
  }

  async getActiveMonitors(): Promise<string[]> {
    const monitors: string[] = []
    return monitors
  }

  async updateCacheMonitorActive(pubkey: string, lastActive: number): Promise<void> { 
    const monitor = { pubkey, lastActive }
    // if(!this.cacheAdapter?.patchMonitor) return console.warn('CacheAdapter does not support patchMonitor');
    // await this.cacheAdapter.patchMonitor(monitor);
  }

  // async _fetchMonitors(): Promise<IEvent[] | undefined> { return }

  // async _determineMonitorLiveness(): Promise<boolean> { return false }
  
  // async getActive(): Promise<Monitor[]> { 
  //   const currentTime = Math.floor(Date.now() / 1000); 

  //   try {
  //     const monitors = await this.cacheAdapter.monitors.toArray();

  //     const activeMonitors = monitors.filter((monitor) => {
  //       return currentTime - monitor.lastActive <= monitor.frequency;
  //     });

  //     return activeMonitors;
  //   } catch (error) {
  //     console.error('MonitorService getActiveMonitors error:', error);
  //     return [];
  //   }
  // }  

  // /**
  //  * Finds monitors closest to a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  * @param options Additional options (e.g., max distance).
  //  */
  // async findMonitorsByGeohash(geohash: string, options?: GeohashOptions): Promise<Monitor[]> {
  //   return await this.cacheAdapter.findMonitorsByGeohash(geohash, options);
  // }

  // /**
  //  * Sorts monitors by distance from a specific geohash.
  //  * @param geohash The geohash to compare against.
  //  */
  // async sortMonitorsByDistance(geohash: string): Promise<Monitor[]> {
  //   return await this.cacheAdapter.sortMonitorsByDistance(geohash);
  // }

  // /**
  //  * Finds monitors conducting specific checks.
  //  * @param checks Array of checks to filter by.
  //  */
  // async findMonitorsByChecks(checks: string[]): Promise<Monitor[]> {
  //   return await this.cacheAdapter.findMonitorsByChecks(checks);
  // } 
}
