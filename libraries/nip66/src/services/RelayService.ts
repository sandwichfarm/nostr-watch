import { IWebsocketAdapter, WebsocketAdapterOptions } from '@core/WebsocketAdapter';
import { ICacheAdapter } from '@core/CacheAdapter';
import { IAdaptersArgument } from '@interfaces/IAdaptersArgument';
import { EventEmitter } from 'tseep';
import { Service } from './Service';
import { StateManager } from '@base/managers/StateManager';
import { IEvent } from '@base/interfaces';
import { Filter } from 'nostr-tools';
import { Monitor } from '@base/models';
import { MonitorService } from './MonitorService';

export class RelayService extends Service {
  monitors: MonitorService;
  relay: string = '';
  _ready: boolean = false;

  constructor( adapters: IAdaptersArgument ){
    super(adapters)
    this.monitors = new MonitorService(adapters);
    this.init()
  }

  async init(): Promise<void> {
    await this?.cacheAdapter?.ready();
    await this?.monitors?.init();
  }

  async ready(): Promise<void> {
    while(!this._ready){
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  getRelayFilters(): Filter[] { 
    return []
  }

  async getRelayChecks(): Promise<IEvent[] | boolean | undefined> {
    const filters: Filter[] = this.getRelayFilters();
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
    const result: IEvent[] | boolean | undefined = await this._fetch( { relays, filters, options }, { onevent, onevents } );
    StateManager.emit('bootstrap:checks:complete')
    return result;
  }


}