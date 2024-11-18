// src/services/MonitorService.ts

import { ICacheAdapter } from '@base/core/CacheAdapter';
import { Subscriber } from '@base/core/Subscriber';
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
  private subscriber: Subscriber = new Subscriber()

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
    this.bootstrapMonitors();
  }

  get hook() {
    return this._hooks
  }

  get monitors(): IMonitorsMap {
    return this._monitors
  }

  get monitorsArray(): IMonitorResult[] {
    return Array.from(this._monitors).map(r => r[1]).sort((a, b) => b.priority - a.priority)
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

  addHook(name: string, hook: IServiceHook): void {
    this._hooks[name] = hook
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
    let monitor = this.monitors.get(event.pubkey)
    if(!monitor) {
      monitor = structuredClone(defaultMonitorResult);
    }
    let registration = n66IEventToIMonitor(event);
    console.log(`MonitorService: addMonitorRegistration:`, registration)
    monitor.registration = registration;
    // if(this.hook?.beforeAddRegistration) {
    //   registration = this.hook?.beforeAddRegistration?.(registration)
    // }
    this.monitors.set(event.pubkey, monitor)
    // this.hook?.afterAddRegistration?.(registration)
  }

  private addMonitorProfile(event: IEvent): void {
    try {
      const monitor = this.monitors.get(event.pubkey)
      if(!monitor) return console.warn('MonitorService addMonitorRelays: monitor not found')
      let profile = JSON.parse(event.content);
      if(this.hook?.beforeAddProfile) {
        profile = this.hook?.beforeAddProfile(profile)
      }
      monitor.profile = profile
      this.monitors.set(event.pubkey, monitor)
      this.hook?.afterAddProfile?.(profile)
    }
    catch(e) {
      console.warn('MonitorService addMonitorProfile error:', e)
    }
  }

  private addMonitorRelays(event: IEvent): void {
    try {
      const monitor = this.monitors.get(event.pubkey)
      if(!monitor) return console.warn('MonitorService addMonitorRelays: monitor not found')
      let relays = event.tags.filter(t=>t[0] === 'r').map(t=>new URL(t[1]).toString());
      relays = relays ?? []
      if(this.hook?.beforeAddRelays) {
        relays = this.hook?.beforeAddRelays(relays)
      }
      monitor.relays = relays;
      this.monitors.set(event.pubkey, monitor)
      this.hook?.afterAddRelays?.(relays)
    }
    catch(e) {
      console.warn('MonitorService addMonitorProfile error:', e)
    }
  }

  async sync(): Promise<void> {
    const begin = Date.now()
    const filters: Filter[] = this.getMonitorCheckFilters();
    const hash = this.subscriber.request(filters);
    const eventIds = new Set()
    const onevent = (event: IEvent) => {
      if(eventIds.has(event.id)) return;
      eventIds.add(event.id)
      this.hook?.onMonitorCheckEvent?.(event);
    }

    const callbacks: SubscribeHandlers = { onevent }
    this.websocketAdapter.subscribe({
      relays: this.nip66Relays,
      filters,
      options: {
        cache: true,
        returnResults: true,
        keepAlive: false,
        stream: true
      }
    },
    callbacks);

    this.cacheAdapter.REQ(filters).then((events) => {
      console.log(`MonitorService sync: cache events: ${events.length}, took: ${(Date.now()-begin)/1000} seconds`)
      for(const event of events){
        if(eventIds.has(event.id)) continue;
        onevent(event)
      }
    })

  }

  async bootstrapMonitors(): Promise<void> {
    console.log('bootstrapMonitors')
    await this.bootstrapMonitorRegistrations();
    await this.bootstrapMonitorData();
    await this.ensureMonitorsActive();
    await this.prioritizeMonitors();
    await this.bootstrapMonitorChecks();
  }

  async bootstrapMonitorRegistrations(): Promise<void> {
    console.log('bootstrapMonitorRegistrations')
    const callbacks = {
      onevent: (Event10166: IEvent) => {
        console.log('bootstrapMonitorRegistrations: Event10166', Event10166.id)
        this.addMonitorRegistration(Event10166)
      }
    }
    console.log('bootstrapMonitorRegistrations: awaiting bootstrap')
    await this.websocketAdapter.bootstrap(
      [{ kinds: [10166] }],
      this.nip66Relays,
      callbacks
    );
    console.log('bootstrapMonitorRegistrations: done')
  }

  async bootstrapMonitorData(): Promise<void>  { 
    console.log('bootstrapMonitorData')
    const monitors = [...this.monitorsArray.map(m => m.registration)];
    const authors = monitors.map( (monitor: IMonitor) => monitor.pubkey )
    authors.length = authors.length > 4? 4: authors.length
    const onevent = (event: IEvent) => {
      const { kind} = event;
      if(kind === 0) {
        this.addMonitorProfile(event)
      }
      if(kind === 10002) {
        this.addMonitorRelays(event)
      }
    }
    const callbacks = { onevent}
    await this.websocketAdapter.bootstrap(
      [{
          authors,
          kinds: [0, 10002]
      }],
      this.userMetaRelays,
      callbacks
    )
  }

  async ensureMonitorsActive(): Promise<void> {
    console.log('ensureMonitorsActive')
    const monitors = this.monitorsArray.map( (monitor) => [monitor.registration.pubkey, monitor.registration.frequency] as [ string, number ] )
    const filters: Filter[] = [];
    const events: IEvent[] = [];
    monitors.forEach(async ([monitorPubkey, monitorFrequency]) => {
      if(!monitorPubkey) return;
      monitorFrequency = monitorFrequency || 60*60;
      console.log(`ensureMonitorsActive: ${monitorPubkey}`, monitorFrequency)
      const limit = 1;
      const kinds = [30166];
      const since = Math.round(Date.now()/1000)-monitorFrequency;
      const authors = [monitorPubkey];
      filters.push({ limit, kinds, since, authors })
    });
    const onevent = (event: IEvent) => {
      events.push(event)
    }
    const callbacks: SubscribeHandlers = { onevent }
    const relays = this.nip66Relays;
    await this.websocketAdapter.subscribe({
        relays,
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
    console.log(`ensureMonitorsActive: events: ${events.length}`)
    for(const event of events){
      const { pubkey, created_at } = event;
      const monitor = this.monitors.get(pubkey)
      console.log(`ensureMonitorsActive: monitor exists: ${monitor?.registration?.pubkey}`)
      if(monitor?.registration) {
        const lastActiveOld = monitor.registration.lastActive;
        const lastActiveNew = created_at as number;
        const updateWithNew = !lastActiveOld || lastActiveNew > lastActiveOld
        monitor.registration.lastActive = updateWithNew? lastActiveNew: lastActiveOld;
        this.monitors.set(pubkey, monitor)
      }
    } 
  }

  async prioritizeMonitors(priority: MonitorPriority = MonitorPriority.Checks ): Promise<void> { 
    const goodMonitors: IMonitorResult[] = this.monitorsArray.filter((monitor) => {
      if(!monitor?.registration?.lastActive) return false;
      if(!monitor?.registration?.checks?.length) return false;
      if(!monitor?.profile) return false;
      if(!monitor?.relays) return false;
      return monitor.registration.lastActive > 0
    });
    const scores: Record<string, number> = {}
    goodMonitors.forEach((monitor) => {
      let score = 0;
      if(!monitor?.registration?.pubkey) return;
      if(monitor?.registration) score++;
      if(monitor?.registration?.checks?.length) score += monitor?.registration?.checks?.length;
      if(monitor?.profile) score++;
      if(monitor?.relays) score++;
      console.log(`prioritizeMonitors: ${monitor.registration.pubkey} score: ${score}`)
      scores[monitor.registration.pubkey] = score;
    })
    goodMonitors.sort((a, b) => {
      const scoreA = scores?.[a.registration.pubkey] || 0;
      const scoreB = scores?.[b.registration.pubkey] || 0;
      return scoreB - scoreA;
    });
    console.log(`prioritizeMonitors: monitors sorted:`, goodMonitors )
    goodMonitors.forEach((sortedMonitor, index) => {
      sortedMonitor.priority = index + 1;
    });
  }

  getMonitorCheckFilters(): Filter[] {
    if(!this.monitorsArray.length) {
      console.warn('MonitorService getMonitorCheckFilters: no monitors')
      return []
    }
    const monitors = this.monitorsArray.slice(0, 4);
    const filters: Filter[] = [];
    monitors.forEach( (monitor) => {
      const authors = [monitor.registration.pubkey];
      const frequency = monitor.registration.frequency;
      const since = Math.round(Date.now()/1000)-frequency;
      filters.push({ authors, since, kinds: [30166] });
    });
    return filters
  }

  async bootstrapChecksFromWebsocket(): Promise<IEvent[] | boolean | undefined> {
    const filters: Filter[] = this.getMonitorCheckFilters();
    let count = 0;
    const onevent = (event: IEvent) => {
      count++;
      this?.hook?.onMonitorCheckEvent?.(event);
      if(this?.hook?.onMonitorCheck) {
        const check: ICheck = k30166ToICheck(event);
        this?.hook?.onMonitorCheck?.(check);
      }
    }
    const callbacks: SubscribeHandlers = { onevent }
    const relays = this.nip66Relays;
    const result: IEvent[] | boolean = await this.websocketAdapter.fetch({
        relays,
        filters,
        options: {
          cache: true,
          returnResults: true,
          keepAlive: false,
          stream: true
        }
      },
      callbacks
    );
    return result;
  }

  async bootstrapMonitorChecks(): Promise<void> { 
    console.log('bootstrapMonitorChecks')
    const result = await this.bootstrapChecksFromWebsocket();
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
}
