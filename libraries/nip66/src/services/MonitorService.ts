import { defaultWebsocketAdapterOptions, SubscribeHandlers, WebsocketAdapterOptions, WebsocketRequestBody } from '@base/core/WebsocketAdapter';
import { IEvent } from '@base/interfaces';
import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { Monitor } from '@base/models';
import { Filter } from 'nostr-tools';
import { MonitorManager } from '../managers/MonitorManager';
import { FetchOptions, Service } from './Service';
import { StateManager } from '@base/managers/StateManager';
import { MonitorRegistration } from '@base/models/MonitorRegistration';

export interface MonitorFetchOptions extends WebsocketRequestBody {
  alwaysCheckRelay?: boolean;
}

export class MonitorService extends Service {
  private _manager: MonitorManager;

  constructor(adapters: IAdaptersArgument) {
    super(adapters)
    this._manager = MonitorManager.getInstance();
    this.addRelay('nip66', 'wss://relay.nostr.watch');
    this.addRelay('nip66', 'wss://relaypag.es');
    this.addRelay('nip66', 'wss://monitorlizard.nostr1.com/')
    this.addRelay('userMeta', 'wss://purplepag.es');
    this.addRelay('userMeta', 'wss://user.kindpag.es');
    this.addRelay('userMeta', 'wss://relay.nostr.band');
    this.init()
  }

  async init(): Promise<void> {
    //console.log('MonitorService init');
    await this?.cacheAdapter?.ready();
    //console.log('cacheadapter ready')
    this._ready = true;
  }

  async ready(): Promise<void> {
    while(!this._ready){
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  get manager(){
    return this._manager;
  }
 

  get monitors() {
    return this.manager.monitorsMap;
  }

  get array(): Monitor[] {
    return this.manager.array;
  }

  get map(): Map<string, Monitor> {
    return this.manager.monitorsMap;
  }
  
  get sortedMonitors() {
    return this.manager.sortedMonitors;
  }

  get enabledMonitors() {
    return this.manager.enabledMonitors;
  } 

  get disabledMonitors() {
    return this.manager.disabledMonitors;
  }

  get disabledActiveMonitors() {
    return this.manager.disabledActiveMonitors;
  }

  get disabledInactiveMonitors() {
    return this.manager.disabledInactiveMonitors;
  }
  

  get activeMonitors() {
    return this.manager.activeMonitors;
  }

  loadMonitors(monitors: any[] ) {
    this.manager.loadMonitors(monitors);
  }

  async fetch(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean | undefined> {
    const { filters, relays, options } = args;
    const message: WebsocketRequestBody = { filters, relays, options };
    const result = await this._fetch(message, callbacks);
    return result;
  }
  
  async sync(args: FetchOptions, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    let index = 0
    let checkCounts = new Map();
    const updateCounts = (events: IEvent[]) => {
      for(const event of events){
        const { pubkey, kind } = event;
        const key = `${pubkey}:${kind}`;
        const count = checkCounts.get(key) || 0;
        checkCounts.set(key, count + 1);
      }
    }
    const onevent = (event: IEvent) => { 
      updateCounts([event]);
      callbacks?.onevent?.(event)
    };
    const onevents = (events: IEvent[]) => {
      updateCounts(events);
      callbacks?.onevents?.(events);
    }
    const oneose = () => { 
      this.updateCheckpoint(args?.filters![index], checkCounts); 
      index++;
      callbacks?.oneose?.();
    }
    args.sync = true;
    const results = await this._fetch(args, { onevents, oneose, onevent });
    this.updateCheckpoints(args?.filters || [], checkCounts);
    //console.log(`sync complete: ${results.length} events`);
    return results;
  }

  updateCheckpoint(filter: Filter, counts: Map<string, number>): void {
    const { authors, kinds, since, until } = filter;
    //console.log(`updateCheckpoints: authors: ${authors} kinds: ${kinds} since: ${since} until: ${until}`);
    for(const pubkey of authors! || []){
      const monitor = this.monitors.get(pubkey);
      if (!monitor) {
        console.error(`Monitor not found for pubkey: ${pubkey}`);
        continue;
      }
      for(const kind of kinds! || []){
        const key = `${pubkey}:${kind}`;
        const count = counts.get(key) || 0;
        if(count > 0){
          if(since){
            monitor.setLastSync(kind, 'since', since);
          }
          if(until){
            monitor.setLastSync(kind, 'until', until);
          } 
        }
      }
    }
  }

  updateCheckpoints(filters: Filter[], counts: Map<string, number>): void {
    //console.log(`updateCheckpoints`, filters.length);
    for (const filter of Array.from(filters)) {
      this.updateCheckpoint(filter, counts)
    }    
  }

  async modifyCacheFilters(filters: Filter[]): Promise<Filter[]> {
    return filters.map((filter) => {
      const { authors, kinds, since:requestedSince, until:requestedUntil } = filter;
      for(const pubkey of authors || []) {
        //console.log(`modifyCacheFilters: pubkey: ${pubkey}`);
        const monitor = this.monitors.get(pubkey);
        for(const kind of kinds || []) {
          //console.log(`modifyCacheFilters: kind: ${kind}`);
          const cachedRange = monitor?.getLastSync(kind);
          //console.log(`modifyCacheFilters: cachedRange: ${JSON.stringify(cachedRange)}`);
          if(cachedRange?.since){
            if(requestedSince && cachedRange.since < requestedSince) {
              //console.log(`modifyCacheFilters: since before: ${filter.since} since after: ${cachedRange.since} requested: ${requestedSince} `);
              filter.since = cachedRange.since;
            }
          }
          else {
            //console.log(`modifyCacheFilters: no cached range for kind: ${kind}`);
          }
        }
      }
      return filter;
    });
  }

  async modifyWebsocketFilters(filters: Filter[]): Promise<Filter[]> {
    // return filters;
    return filters.map((filter) => {
      const { authors, kinds, since:requestedSince, until:requestedUntil } = filter;
      for(const pubkey of authors || []) {
        //console.log(`modifyWebsocketFilters: pubkey: ${pubkey}`);
        const monitor = this.monitors.get(pubkey);
        for(const kind of kinds || []) {
          //console.log(`modifyWebsocketFilters: kind: ${kind}`);
          const cachedRange = monitor?.getLastSync(kind);
          //console.log(`modifyWebsocketFilters: cachedRange: ${JSON.stringify(cachedRange)}`);
          if(cachedRange?.until){
            if(requestedSince && cachedRange.until > requestedSince) {
              //console.log(`modifyWebsocketFilters: since before: ${filter.since} since after: ${cachedRange.until} requested: ${requestedSince} `);
              filter.since = cachedRange.until;
            }
            else {
              //console.log(`modifyWebsocketFilters: since unchanged`);
            }
          }
        }
      }
      return filter;
    });
  }

  async bootstrapMonitors(): Promise<void> {
    //console.log('bootstrapMonitors'); 
    await this.fetchMonitorRegistrations();
    //console.log('bootstrapMonitorRegistrations complete');
    await this.fetchMonitorMeta();
    //console.log('bootstrapMonitorMeta complete');
    await this.ensureMonitorsActive();
    //console.log('ensureMonitorsActive complete');
    // this.prioritizeMonitors();
    // //console.log('prioritizeMonitors complete');
  }

  async bootstrap(): Promise<void> {
    await this.bootstrapMonitors();
    await this.fetchMonitorsChecks().then( async () => {
      console.log('!!! FETCH MONITORS CHECKS RESOLVED') 
      // this.fetchDisabledMonitorsChecks().then( () => { 
      //   console.log('!!! FETCH DISABLED MONITORS CHECKS RESOLVED') 
      // });
    });
  }

  async fetchDisabledMonitorsChecks(): Promise<IEvent[] | boolean | undefined> {
    return this.fetchMonitorsChecks({
      cache: true,
      returnResults: false, 
      keepAlive: false,
      stream: false,
      batch: 20
    }, false)
  }

  async countMonitorChecksInCache(enabled?: boolean): Promise<Map<string, number>> {
    const filters = this.getMonitorCheckFilters(enabled);
    const result = new Map<string, number>()
    const promises: Promise<void>[] = [];
    for(const filter of filters){
      const monitorPk = filter.authors?.[0];
      if(!monitorPk) continue;
      promises.push(
        this.cacheAdapter.COUNT([filter])
          .then( (count: number) => {
            result.set(monitorPk, count)
          })
      )
    }
    await Promise.allSettled(promises);
    return result;
  }
  
  async fetchMonitorRegistrations(): Promise<void> {
    const onevent = (event: IEvent) => {
        if(event.kind !== 10166) return;
        this.manager.handleEvent(event);
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
  }

  async fetchMonitorMeta(): Promise<void> {
    //console.log('bootstrapMonitorMeta');
    const monitors = [...this.array.map((m) => m.registration)].filter(registration => typeof registration !== 'undefined');
    const authors = monitors.map((monitor: MonitorRegistration) => monitor.pubkey as string);
    const onevent = this.manager.handleEvent.bind(this.manager);
    const onevents = (events: IEvent[]) => { events.forEach(onevent) };
    const filters = authors.map(author => ({ authors: [author], kinds: [0, 10002] }))
    await this.fetch(
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
    this.array.forEach((monitor) => {
      monitor.relays.forEach((relay:string) => this.addRelay('nip66', relay));
    });
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

  async fetchMonitorsChecks(options?: Partial<WebsocketAdapterOptions>, enabled?: boolean): Promise<IEvent[] | boolean | undefined> {
    const filters: Filter[] = this.getMonitorCheckFilters(enabled);
    const defaultOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: true,
      batch: 100
    }
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
    if(!options) {
      options = {...defaultOptions}
    }
    else {
      options = {...defaultOptions, ...options}
    }
    const result: IEvent[] | boolean | undefined = await this.sync( { relays, filters, options: options as WebsocketAdapterOptions }, { onevent, onevents } );
    // StateManager.emit('bootstrap:checks:complete')
    return result;
  }

  async countMonitorChecksFromCache(pubkey: string, _options?: Partial<WebsocketAdapterOptions>): Promise<number> { 
    const monitor = this.monitors.get(pubkey);
    if (!monitor) return 0;
    const checkFilter = {...monitor.checkFilter};
    const filters = [checkFilter];
    return this.countFromCache(filters)
  }

  async fetchMonitorChecksFromCache(pubkey: string, _options?: Partial<WebsocketAdapterOptions>): Promise<IEvent[]> { 
    return this.fetchMonitorChecks(pubkey, _options, 'cache');
  }

  async fetchMonitorChecksFromWebsocket(pubkey: string, _options?: Partial<WebsocketAdapterOptions>): Promise<IEvent[]> {
    return this.fetchMonitorChecks(pubkey, _options, 'websocket');
  }

  async fetchMonitorChecks(pubkey: string, _options?: Partial<WebsocketAdapterOptions>, from?: 'cache' | 'websocket'): Promise<IEvent[]> { 
    const monitor = this.monitors.get(pubkey);
    if (!monitor) return [];
    let checkFilter: Filter;
    if(from === 'cache')  {
      checkFilter = {...monitor.checkFilterSync}
    }
    else {
      checkFilter = {...monitor.checkFilter};
    }
    const filters = [checkFilter];
    const options: WebsocketAdapterOptions = (_options? {...defaultWebsocketAdapterOptions, ..._options}: defaultWebsocketAdapterOptions) as WebsocketAdapterOptions;
    const relays = this.nip66Relays;
    let result;
    switch(from){
      case 'cache':
        return this.fetchFromCache(filters);
      case 'websocket':
        return await this.fetchFromWebsocket({ filters, relays, options });
      default: 
        return this.fetch({ filters, relays, options }) as Promise<IEvent[]>;
    }
  }

  async ensureMonitorsActive(pubkeys?: string | string[]): Promise<void> {
    const MAX_FILTERS = 10; //TODO: try to derive from NIP-11

    let monitors = [...this.array];
  
    if (pubkeys) {
      if (typeof pubkeys === 'string') pubkeys = [pubkeys];
      monitors = monitors.filter((m) => (pubkeys as string[]).includes(m.pubkey));
    }
  
    const filters: Filter[] = [];
    const events: IEvent[] = [];
    const until = Math.round(Date.now() / 1000);
  
    monitors.forEach((monitor) => {
      filters.push({ authors: [monitor.pubkey], limit: 1, until });
    });
  
    const chunkArray = (arr: Filter[], size: number): Filter[][] => {
      const chunks: Filter[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };
  
    const filterChunks = chunkArray(filters, MAX_FILTERS);
  
    const onevent = (event: IEvent) => {
      console.log('MonitorService: ensureMonitorsActive:', `event: ${event.pubkey}`, `kind: ${event.kind}`);
      events.push(event);
    };
  
    const callbacks: SubscribeHandlers = { onevent };
    const relays = this.nip66Relays;
  
    for (const filterChunk of filterChunks) {
      await this.websocketAdapter.subscribe(
        {
          relays,
          filters: filterChunk,
          options: {
            cache: true,
            returnResults: true,
            keepAlive: false,
            stream: false,
          },
        },
        callbacks
      );
    }

    for (const event of events) {
      const { pubkey, created_at } = event;
      const monitor = this.monitors.get(pubkey);
      console.log('MonitorService: ensureMonitorsActive:', `pubkey: ${pubkey}`, 'monitor:', monitor);
      if (monitor?.registration) {
        if (created_at) monitor.lastActive = created_at;
      }
    }

    console.log('MonitorService: ensureMonitorsActive:', `active monitors: ${this.activeMonitors.length}`, `total monitors: ${this.array.length}`);
  }
  

  // prioritizeMonitors(): void {
  //   this.manager.prioritizeMonitors();
  // }

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

  getMonitorCheckFilters(enabled?: boolean): Filter[] {
    let monitors: Monitor[] = [];
    if(enabled === undefined) {
      monitors = this.enabledMonitors?.length > 0? this.enabledMonitors: this.sortedMonitors.slice(0, 3);
    }
    else if(typeof enabled === 'boolean') {
      monitors = enabled? this.enabledMonitors: this.disabledActiveMonitors;
    }
    let filters: Filter[] = [];
    const until = Math.round(Date.now()/1000);
    monitors.forEach((monitor) => {
      filters.push({...monitor.checkFilter, until});
    });
    return filters;
  }

  

  async modifyReturnedEvents(events: IEvent[]): Promise<IEvent[]> {
    // return events;
    return this.removeStaleChecks(events);  
  }

  async removeStaleChecks(events: IEvent[]): Promise<IEvent[]> {
    const monitors = Array.from(this.monitors.values());
    const deleteFilters: Filter[] = []
    let timelyChecks: IEvent[] = []
    for(const monitor of monitors){
      const {pubkey, frequency} = monitor;
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
    // const events = await this.fetch({filters: [filter], options, relays}, this.manager.handleEvent.bind(this.manager) );
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
    //console.log(`total monitors in array: ${this.sortedMonitors.length}`)
    return this.sortedMonitors.map((monitor) => monitor.pubkey);
  }
}
