import { IWebsocketAdapter, SubscribeHandlers, WebsocketAdapterOptions } from '@core/WebsocketAdapter';
import { ICacheAdapter } from '@core/CacheAdapter';
import { IAdaptersArgument } from '@interfaces/IAdaptersArgument';
import { EventEmitter } from 'tseep';
import { Service } from './Service';
import { StateManager } from '@base/managers/StateManager';
import { IEvent } from '@base/interfaces';
import { Filter } from 'nostr-tools';
import { Monitor, Nip66Event, NostrEvent } from '@base/models';
import { MonitorService } from './MonitorService';

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

  // get relay (): string {
  //   return this._relay;
  // }

  // set relay(relay: string) {
  //   try {
  //     relay = new URL(relay).toString();
  //     this._relay = relay;
  //   }
  //   catch {
  //     console.warn (`[RelayService] Invalid relay URL: ${relay}`);
  //   }
  // }

  relayFilters(relay: string): Filter[] { 
    return [ 
      { kinds: [30166], "#d": [relay] }
    ]
  }

  async getRelayData(relay: string): Promise<[ Nip66Event[], Map<string, Monitor> ] | undefined> {
    await this.ready();
    let checks = await this.fetchRelayChecks(relay);
    if(!checks || !checks?.length) return;
    const monitors: Map<string, Monitor> | undefined = (await this.monitorInstancesFromChecks(checks)) as Map<string, Monitor>;
    ////console.log('typeof monitors', typeof monitors, monitors);
    if(!monitors) return;
    checks = RelayService.removeOldChecks(monitors, checks);
    return [ checks, monitors ];
  }

  async fetchRelayChecks(r: string): Promise<Nip66Event[] | undefined> {
    const relay: string | null = RelayService.formatRelay(r);
    if(!relay) return;
    const filters: Filter[] = this.relayFilters(relay);
    const relays = this.nip66Relays;
    const options: WebsocketAdapterOptions = {
      cache: true,
      returnResults: true, 
      keepAlive: false,
      stream: false
    }
    const events: IEvent[] = await this.fetch( { relays, filters, options } );
    if(!events) return;
    const checks: Nip66Event[] = events.map((event: IEvent) => new Nip66Event(event));  
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
      batch: 1,
    }
    return this.subscribe( { relays, filters, priority, options }, callbacks );
  }

  async monitorInstancesFromChecks(checks: Nip66Event[], type: 'map' | 'array' = 'map'): Promise<Map<string, Monitor> | Monitor[] | undefined> {
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

  static removeOldChecks (monitors: Map<string, Monitor>, checks: Nip66Event[]): Nip66Event[] {
    return checks.filter(check => {
      const monitor = monitors.get(check.pubkey);
      if(monitor && monitor.relayIsOnline(check)) return true
      return false
    })
  }
}