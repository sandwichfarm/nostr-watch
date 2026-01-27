import { IWebsocketAdapter, SubscribeHandlers, WebsocketAdapterOptions } from '@core/WebsocketAdapter';
import { ICacheAdapter } from '@core/CacheAdapter';
import { IAdaptersArgument } from '@interfaces/IAdaptersArgument';
import { EventEmitter } from 'tseep';
import { Service } from './Service';
import { StateManager } from '@base/managers/StateManager';
import { IEvent } from '@base/interfaces';
import { Filter } from 'nostr-tools';
import { Monitor, Nip66CheckEvent, NostrEvent } from '@base/models';
import { MonitorService } from './MonitorService';
import { getNormalizedWebsocketVariants, WebsocketUrlType } from '@base/utils/nostr';

export class RelayService extends Service {
  monitors: MonitorService;
  private _relay: string = '';
  protected _ready: boolean = false;

  constructor( adapters: IAdaptersArgument, monitorService?: MonitorService ) {
    super(adapters)
    this.monitors = monitorService ?? new MonitorService(adapters);

    //TODO: Move these to a defaults method in Services that can be used for convenience. 
    //The default relays should be loaded from a config or note.
    this.addRelay('route66', 'wss://relay.nostr.watch');
    this.addRelay('route66', 'wss://relaypag.es');
    this.addRelay('route66', 'wss://monitorlizard.nostr1.com/')
    this.addRelay('userMeta', 'wss://purplepag.es');
    this.addRelay('userMeta', 'wss://user.kindpag.es');
    this.addRelay('userMeta', 'wss://relay.nostr.band');
    this.init()
  }

  async init(): Promise<void> {
    await this?.cacheAdapter?.ready();
    await this?.monitors?.ready();
    this._ready = true;
  }

  async ready(): Promise<void> {
    while(!this._ready){
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  relayFilters(relay: WebsocketUrlType, liveness: string = 'online'): Filter[] { 
    const filters: Filter[] = []
    // console.log('this.monitors.activeMonitors', liveness, this.monitors.activeMonitors.length)
    if( this.monitors.activeMonitors.length === 0 ) return [{ kinds: [30166], "#d": [relay] }]
    const monitors = liveness === 'online'? this.monitors.activeMonitors: this.monitors.array;
    const defaultFilter: Filter = { "#d": getNormalizedWebsocketVariants(relay), kinds: [30166] }
    if(liveness === 'dead') {
      // console.log('relayfilters', filters)
      return [defaultFilter]
    }
    monitors.forEach((monitor) => {
      let filter;
      switch(liveness){
        case 'offline':
          filter = { ...monitor.checkFilterOffline, ...defaultFilter }
          break;
        case 'online': 
          filter = { ...monitor.checkFilter, ...defaultFilter }
      }
      if(!filter) return;
      filters.push(filter)
    })
    // console.log('relayfilters', filters)
    return filters;
  }

  /**
   * Create filters for Kind 1066 delta events for a relay
   * Used for querying relay history and time series data
   *
   * @param relay - Relay URL to create filters for
   * @param options - Optional filter parameters
   * @returns Array of filters for Kind 1066 events
   */
  deltaFilters(relay: WebsocketUrlType, options?: { since?: number; until?: number; limit?: number }): Filter[] {
    const filter: Filter = {
      kinds: [1066],
      '#r': getNormalizedWebsocketVariants(relay),
    };

    if (options?.since) {
      filter.since = options.since;
    }

    if (options?.until) {
      filter.until = options.until;
    }

    if (options?.limit) {
      filter.limit = options.limit;
    }

    return [filter];
  }

  async getRelayData(relay: string, liveness: string = 'online'): Promise<[ Nip66CheckEvent[], Map<string, Monitor> ] | undefined> {
    await this.ready();
    await this.monitors.ready();
    let checks = await this.fetchRelayChecks(relay, liveness);
    if(!checks || !checks?.length) return;
    const monitors: Map<string, Monitor> | undefined = (await this.monitorInstancesFromChecks(checks)) as Map<string, Monitor>;
    if(!monitors) return;
    if(liveness === 'online') {
      checks = checks.filter(check => {
        const monitor = monitors.get(check.pubkey);
        if(!monitor || !monitor.relayIsOnline(check)) return false
        return true
      })
    }
    if(liveness === 'offline') {
      checks = checks.filter(check => {
        const monitor = monitors.get(check.pubkey);
        if(!monitor || !monitor.relayIsOffline(check, true)) return false
        return true
      })
    }
    if(liveness === 'dead') {
      checks = checks.filter(check => {
        const monitor = monitors.get(check.pubkey);
        if(!monitor || !monitor.relayIsDead(check)) return false
        return true
      })
    }
    return [ checks, monitors ];
  }

  async fetchRelayChecks(r: string, liveness: string = 'online'): Promise<Nip66CheckEvent[] | undefined> {
    const relay: string | null = RelayService.formatRelay(r);
    if(!relay) return;
    const filters: Filter[] = this.relayFilters(relay as WebsocketUrlType, liveness);
    const relays = this.nip66Relays;
    const priority = 100;
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: false
    }
    const events: IEvent[] = await this.fetch( { relays, filters, options, hash: `relay:${Math.random()}`, priority } );
    if(!events) return;
    const checks: Nip66CheckEvent[] = events.map((event: IEvent) => new Nip66CheckEvent(event));  
    return checks;
  }

  async fetchOperatorMeta(pubkey: string, callbacks?: SubscribeHandlers, relays: string[] = []): Promise<IEvent[]> {
    const filters: Filter[] = [
      { kinds: [0, 10002], authors: [pubkey] }
    ]
    relays = [...this.userMetaRelays, ...relays];
    const priority = 1000;
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: true,
      batch: 1
    }
    return this.subscribe( { relays, filters, priority, options }, callbacks );
  }

  async monitorInstancesFromChecks(checks: Nip66CheckEvent[], type: 'map' | 'array' = 'map'): Promise<Map<string, Monitor> | Monitor[] | undefined> {
    let filters: Filter[] = []
    const metaPromises: Promise<any>[] = []
    for(const check of checks){
      filters.push({ authors: [check.pubkey], kinds: [10166] })
    }
    let relays = [...this.nip66Relays];
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: true,
      batch: 1
    }
    const monitorsProcessed = new Set()
    const onevent = (event: IEvent) => {
      this.monitors.manager.handleEvent(event)
      if(event.kind === 10166) {
        if(monitorsProcessed.has(event.pubkey)) return;
        metaPromises.push(this.monitors.fetch(
          { 
            relays: [...this.userMetaRelays], 
            filters: [{ authors: [event.pubkey], kinds: [0, 10002] }], 
            options 
          }, 
          { onevent }
        ))
        monitorsProcessed.add(event.pubkey)
      }  
    }
    await this.monitors.subscribe( 
      { relays, filters, options },
      { onevent }
    )
    await Promise.allSettled(metaPromises)
    return type === 'map'? this.monitors.map: this.monitors.array
  }

  static formatRelay(relay: string): string | null { 
    try {
      return new URL(relay).toString();
    }
    catch {
      console.warn (`[RelayService] Invalid relay URL: ${relay}`);
      return '';
    }
  }

  static removeOldChecks (monitors: Map<string, Monitor>, checks: Nip66CheckEvent[]): Nip66CheckEvent[] {
    return checks.filter(check => {
      const monitor = monitors.get(check.pubkey);
      if(monitor && monitor.relayIsOnline(check)) return true
      return false
    })
  }

  async beginLiveSync(relay: string, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
    const filters: Filter[] = []
    this.monitors.enabledMonitors.forEach( (monitor: Monitor ) => {
      const lastSyncUntil = monitor.getLastSync(30166)?.until;
      filters.push({ 
        kinds: [30166], 
        authors: [monitor.pubkey], 
        since: lastSyncUntil, 
        "#d": [relay] 
      });
    }) 
    const hash = `liveSyncMonitorsChecksForRelay`;
    const relays: string[] = this.nip66Relays;
    const options: WebsocketAdapterOptions = {
      cache: true,
      keepAlive: true,
      returnResults: true,
      stream: true,
      batch: 2
    }
    const onevents: SubscribeHandlers['onevents'] = (events: IEvent[]) => {  
      callbacks?.onevents?.(events);
    };
    return this.subscribe({ filters, relays, options, hash }, { onevents });
  }

  async stopLiveSync(): Promise<void> {
    await this.unsubscribe('liveSyncMonitorsChecksForRelay');
  }
}