// src/services/MonitorService.ts

import { ICacheAdapter } from '@base/core/CacheAdapter';
import { Subscriber } from '@base/core/Subscriber';
import { defaultWebsocketAdapterOptions, IWebsocketAdapter, SubscribeHandlers, WebsocketAdapterOptions, WebsocketRequestBody } from '@base/core/WebsocketAdapter';
import { IEvent } from '@base/interfaces';
import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { ICheck, IMonitor } from '@base/models';
import { Filter } from 'nostr-tools';
import { MonitorManager } from '../managers/MonitorManager';
import { Monitor } from '@base/models/Monitor';
import { FetchOptions, Service } from './Service';
import PQueue from 'p-queue';
import { SyncStateManager } from '@base/managers/SyncStateManager';
import { StateManager } from '@base/managers/StateManager';

export interface IGroupedRelays {
  userMeta?: string[];
  nip66?: string[];
}


export interface MonitorFetchOptions extends WebsocketRequestBody {
  alwaysCheckRelay?: boolean;
}

export class MonitorService extends Service {
  private monitorManager: MonitorManager;
  private _groupedRelays: IGroupedRelays = {};

  constructor(adapters: IAdaptersArgument) {
    super(adapters)
    this.monitorManager = MonitorManager.getInstance();
    this.addRelay('nip66', 'wss://relay.nostr.watch');
    this.addRelay('nip66', 'wss://relaypag.es');
    this.addRelay('userMeta', 'wss://purplepag.es');
    this.addRelay('userMeta', 'wss://user.kindpag.es');
    this.addRelay('userMeta', 'wss://relay.nostr.band');
  }

  async init(): Promise<void> {
    if (this?.cacheAdapter?.init) await this?.cacheAdapter?.init();
  }

  get monitors() {
    return this.monitorManager.monitorsMap;
  }

  loadMonitors(monitorsArray: any[] ) {
    this.monitorManager.loadMonitors(monitorsArray);
  }

  get monitorsArray() {
    return this.monitorManager.monitorsArray;
  }

  get sortedMonitors() {
    return this.monitorManager.sortedMonitors;
  }

  get enabledMonitors() {
    return this.monitorManager.enabledMonitors;
  }

  get activeMonitors() {
    return this.monitorManager.activeMonitors;
  }

  get primary() {
    return this.monitorManager.primary;
  }

  get secondary() {
    return this.monitorManager.secondary;
  }

  get tertiary() {
    return this.monitorManager.tertiary;
  }

  get quaternary() {
    return this.monitorManager.quaternary;
  }

  get nip66Relays(): string[] {
    return this._groupedRelays?.nip66 || [];
  }

  get userMetaRelays(): string[]{
    return this._groupedRelays?.userMeta || [];
  }

  addRelay(to: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[to]) this._groupedRelays[to] = [];
    this._groupedRelays?.[to].push(relay);
  }

  removeRelay(from: keyof IGroupedRelays, relay: string): void {
    if (!this._groupedRelays?.[from]) return;
    this._groupedRelays[from] = this._groupedRelays[from].filter((r) => r !== relay);
  }

  async fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean | undefined> {
    const { filters, relays, options } = args;
    const message: WebsocketRequestBody = { filters, relays, options };
    const result = await this._fetch(message, callbacks);
    return result;
  }

  async subscribe(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean | undefined> {
    const { filters, relays, options } = args;
    const message: WebsocketRequestBody = { filters, relays, options };
    const result = await this.websocketAdapter.subscribe(message, callbacks);
    return result;
  }
  
  async sync(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    let index = 0
    const onevent = (event: IEvent) => callbacks?.onevent?.(event);
    const onevents = (events: IEvent[]) => callbacks?.onevents?.(events);
    const oneose = () => { 
      this.updateCheckpoint(args?.filters![index]); 
      index++;
      callbacks?.oneose?.();
    }
    args.sync = true;
    const results = await this._fetch(args, { onevents, oneose, onevent });
    this.updateCheckpoints(args?.filters || []);
    console.log(`sync complete: ${results.length} events`);
    return results;
  }

  updateCheckpoint(filter: Filter): void {
    const { authors, kinds, since, until } = filter;
    console.log(`updateCheckpoints: authors: ${authors} kinds: ${kinds} since: ${since} until: ${until}`);
    for(const pubkey of authors! || []){
      const monitor = this.monitors.get(pubkey);
      if (!monitor) {
        console.error(`Monitor not found for pubkey: ${pubkey}`);
        continue;
      }
      for(const kind of kinds! || []){
        if(since){
          monitor.setLastSync(kind, 'since', since);
        }
        if(until){
          monitor.setLastSync(kind, 'until', until);
        } 
      }
    }
  }

  updateCheckpoints(filters: Filter[]): void {
    console.log(`updateCheckpoints`, filters.length);
    for (const filter of Array.from(filters)) {
      this.updateCheckpoint(filter)
    }    
  }

  async modifyCacheFilters(filters: Filter[]): Promise<Filter[]> {
    return filters.map((filter) => {
      const { authors, kinds, since:requestedSince, until:requestedUntil } = filter;
      for(const pubkey of authors || []) {
        console.log(`modifyCacheFilters: pubkey: ${pubkey}`);
        const monitor = this.monitors.get(pubkey);
        for(const kind of kinds || []) {
          console.log(`modifyCacheFilters: kind: ${kind}`);
          const cachedRange = monitor?.getLastSync(kind);
          console.log(`modifyCacheFilters: cachedRange: ${JSON.stringify(cachedRange)}`);
          if(cachedRange?.since){
            if(requestedSince && cachedRange.since < requestedSince) {
              console.log(`modifyCacheFilters: since before: ${filter.since} since after: ${cachedRange.since} requested: ${requestedSince} `);
              filter.since = cachedRange.since;
            }
          }
          else {
            console.log(`modifyCacheFilters: no cached range for kind: ${kind}`);
          }
        }
      }
      return filter;
    });
  }

  async modifyWebsocketFilters(filters: Filter[]): Promise<Filter[]> {
    return filters.map((filter) => {
      const { authors, kinds, since:requestedSince, until:requestedUntil } = filter;
      for(const pubkey of authors || []) {
        console.log(`modifyWebsocketFilters: pubkey: ${pubkey}`);
        const monitor = this.monitors.get(pubkey);
        for(const kind of kinds || []) {
          console.log(`modifyWebsocketFilters: kind: ${kind}`);
          const cachedRange = monitor?.getLastSync(kind);
          console.log(`modifyWebsocketFilters: cachedRange: ${JSON.stringify(cachedRange)}`);
          if(cachedRange?.until){
            if(requestedSince && cachedRange.until > requestedSince) {
              console.log(`modifyWebsocketFilters: since before: ${filter.since} since after: ${cachedRange.until} requested: ${requestedSince} `);
              filter.since = cachedRange.until;
            }
            else {
              console.log(`modifyWebsocketFilters: since unchanged`);
            }
          }
        }
      }
      return filter;
    });
  }

  async bootstrapMonitors(): Promise<void> {
    console.log('bootstrapMonitors'); 
    await this.bootstrapMonitorRegistrations();
    console.log('bootstrapMonitorRegistrations complete');
    await this.bootstrapMonitorMeta();
    console.log('bootstrapMonitorMeta complete');
    await this.ensureMonitorsActive();
    console.log('ensureMonitorsActive complete');
    this.prioritizeMonitors();
    console.log('prioritizeMonitors complete');
  }

  async bootstrap(): Promise<void> {
    console.log('bootstrap');
    await this.bootstrapMonitors();
    await this.bootstrapMonitorChecks();
    console.log('bootstrapMonitorChecks complete');
  }

  async bootstrapMonitorRegistrations(): Promise<void> {
    const onevent = (event: IEvent) => {
        if(event.kind !== 10166) return;
        this.monitorManager.handleEvent(event);
    }
    const result = await this.fetch(
      {
        filters: [{kinds: [10166]}], 
        relays: this.nip66Relays, 
        options: {
          cache: true,
          returnResults: true,
          keepAlive: false,
          stream: true,
        }
      }, 
      { onevent } );

    // StateManager.emit(`bootstrap:monitorRegistrations`, { complete: true, status: "success" || 0 });
  }

  async bootstrapMonitorMeta(): Promise<void> {
    console.log('bootstrapMonitorMeta');
    const monitors = [...this.monitorsArray.map((m) => m.registration)];
    const authors = monitors.map((monitor: IMonitor) => monitor.pubkey);
    const onevent = this.monitorManager.handleEvent.bind(this.monitorManager);
    const onevents = (events: IEvent[]) => { events.forEach(onevent) };
    const filters = authors.map(author => ({ authors: [author], kinds: [0, 10002] }))
    const result = await this.fetch(
      {
        filters, 
        relays: this.userMetaRelays,
        options: {
          cache: true,
          returnResults: true,
          keepAlive: false,
          stream: true
        }
      }, 
      { onevent, onevents } );
  }

  async isMonitorActive(pubkey: string): Promise<boolean> {
    const monitor = this.monitors.get(pubkey);
    if (!monitor) return false;
    const checkFilter = {...monitor.checkFilter, limit: 1};
    const filters = [checkFilter];
    const options = defaultWebsocketAdapterOptions;
    const relays = this.nip66Relays;
    const result = await this.fetch({ filters, relays, options });
    return (result instanceof Array)? result.length > 0: (result as unknown as boolean)
  }

  async getMonitorChecks(pubkey: string): Promise<IEvent[]> { 
    const monitor = this.monitors.get(pubkey);
    if (!monitor) return [];
    const checkFilter = {...monitor.checkFilter};
    const filters = [checkFilter];
    const options = defaultWebsocketAdapterOptions;
    const relays = this.nip66Relays;
    const result = await this.fetch({ filters, relays, options });
    return (result as IEvent[]);
  }

  async ensureMonitorsActive(pubkeys?: string | string[]): Promise<void> {
    let monitors = [...this.monitorsArray]
    if(pubkeys) {
      if(typeof pubkeys === 'string') pubkeys = [pubkeys];
      monitors = monitors.filter((m) => (pubkeys as string[]).includes(m.registration.pubkey));
    }
    const filters: Filter[] = [];
    const events: IEvent[] = [];
    monitors.forEach(async (monitor) => {
      filters.push({...monitor.checkFilter, limit: 1});
    });
    const onevent = (event: IEvent) => {
      events.push(event);
    };
    const callbacks: SubscribeHandlers = { onevent };
    const relays = this.nip66Relays;
    await this.websocketAdapter.subscribe(
      {
        relays,
        filters,
        options: {
          cache: false,
          returnResults: true,
          keepAlive: false,
          stream: false,
        },
      },
      callbacks
    );
    for (const event of events) {
      const { pubkey, created_at } = event;
      const monitor = this.monitors.get(pubkey);
      if (monitor?.registration) {
        if(created_at)
          monitor.lastActive = created_at;
        }
    }
  }

  prioritizeMonitors(): void {
    this.monitorManager.prioritizeMonitors();
  }

  optimizeFilters(filters: Filter[]): Filter[] {
    const filterMap: Map<string, Filter> = new Map();
  
    for (const filter of filters) {
      const key = JSON.stringify({
        since: filter.since ?? null,
        until: filter.until ?? null,
        kinds: filter.kinds ?? null,
      });
  
      if (filterMap.has(key)) {
        const existingFilter = filterMap.get(key)!;
        existingFilter.authors = [...Array.from(new Set([...(existingFilter.authors || []), ...(filter.authors || [])]))];
      } else {
        filterMap.set(key, { ...filter, authors: [...(filter.authors || [])] });
      }
    }
  
    return Array.from(filterMap.values());
  }

  getMonitorCheckFilters(): Filter[] {
    if (!this.enabledMonitors.length) {
      console.warn('MonitorService getMonitorCheckFilters: no monitors');
      return [];
    }
    const monitors = this.enabledMonitors;
    let filters: Filter[] = [];
    const until = Math.round(Date.now()/1000);
    monitors.forEach((monitor) => {
      filters.push({...monitor.checkFilter, until});
    });
    return filters;
  }

  async bootstrapMonitorChecks(): Promise<IEvent[] | boolean | undefined> {
    const filters: Filter[] = this.getMonitorCheckFilters();
    let count = 0;
    const onevent = (event: IEvent) => {
      count++;
      StateManager.emit(`event`, event);
      // StateManager.emit(`event:${event.kind}`, event);
    };
    const onevents = (events: IEvent[]) => {
      StateManager.emit(`events`, events);
    };
    const relays = this.nip66Relays;
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: true,
      batch: 100
    }
    const result: IEvent[] | boolean | undefined = await this.sync( { relays, filters, options }, { onevent, onevents } );
    return result;
  }

  async modifyReturnedEvents(events: IEvent[]): Promise<IEvent[]> {
    return events;
    // return this.removeStaleChecks(events);  
  }

  async removeStaleChecks(events: IEvent[]): Promise<IEvent[]> {
    const monitors = Array.from(this.monitors.values());
    const deleteFilters: Filter[] = []
    let timelyChecks: IEvent[] = []
    for(const monitor of monitors){
      const {pubkey, frequency} = monitor.registration;
      if(!frequency) {
        continue;
      }
      const until = monitor.isOnlineAfter;
      deleteFilters.push({ authors: [ pubkey ], until })
      this.cacheAdapter.DELETE(deleteFilters)
      const onlineRelays = await monitor.returnOnlineRelays(events.filter(event => event.pubkey === monitor.pubkey));
      timelyChecks = [...timelyChecks, ...onlineRelays]
    }
    return timelyChecks;
  }

  async getMonitor(pubkey: string): Promise<Monitor | undefined> {
    if (this.monitors.has(pubkey)) {
      return this.monitors.get(pubkey);
    }
    const monitorKinds = [10166, 0, 10002];
    const filter: Filter = { authors: [pubkey], kinds: monitorKinds };
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true,
      keepAlive: false,
      stream: false,
    };
    const relays: string[] = [
      ...this.nip66Relays,
      ...this.userMetaRelays,
      ...this.getMonitorRelays(pubkey),
    ];
    // const events = await this.fetch({filters: [filter], options, relays}, this.monitorManager.handleEvent.bind(this.monitorManager) );
    return this.monitors.get(pubkey);
  }

  // async getMonitorChecks(pubkey: string): Promise<ICheck[]> {
  //   const monitor = await this.getMonitor(pubkey);
  //   const filter: Filter = { authors: [pubkey], kinds: [30166] };
  //   const options: WebsocketAdapterOptions = {
  //     cache: true,
  //     returnResults: true,
  //     keepAlive: false,
  //     stream: false,
  //   };
  //   const relays: string[] = [
  //     ...this.nip66Relays,
  //     ...this.userMetaRelays,
  //     ...this.getMonitorRelays(pubkey),
  //   ];
  //   const events = await this.fetch({filters: [filter], options, relays});
  //   const checks = events.map((event) => k30166ToICheck(event));
  //   return checks
  // }

  getMonitorRelays(pubkey: string): string[] {
    return this.monitors.get(pubkey)?.relays || [];
  }

  getMonitorPubkeys(): string[] {
    if (!this.sortedMonitors.length) {
      console.warn('MonitorService getMonitorPubkeys: no monitors');
      return [];
    }
    console.log(`total monitors in array: ${this.sortedMonitors.length}`)
    return this.sortedMonitors.map((monitor) => monitor.registration.pubkey);
  }

  async getActiveMonitors(): Promise<string[]> {
    const monitors: string[] = [];
    return monitors;
  }
}
