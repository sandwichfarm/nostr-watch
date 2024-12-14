import type { IWebsocketAdapter } from './WebsocketAdapter';
import type { ICacheAdapter } from './CacheAdapter';

import type { RelayService as RelayServiceType } from '../services/RelayService';
import type { MonitorService as MonitorServiceType } from '../services/MonitorService';

import type { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';

import type { Workers } from './Workers';
import { StateManager } from '@base/managers/StateManager';
import { delay } from '@nostrwatch/utils';

type AnyAdapter = IWebsocketAdapter | ICacheAdapter;

export type Nip66Services = { 
  monitors?: MonitorServiceType, 
  relay?: RelayServiceType,
} 

export default class {

  public relayService?: RelayServiceType;
  public monitorService?: MonitorServiceType;

  private websocketAdapter?: IWebsocketAdapter;  
  private cacheAdapter?: ICacheAdapter;

  private _initialized: boolean = false;  

  constructor(
    private _adapters: IAdaptersArgument,
    // private relayUrls: string[]
  ) {
    if(_adapters?.websocketAdapter)
      this.useAdapter(_adapters.websocketAdapter)
    if(_adapters?.cacheAdapter)
      this.useAdapter(_adapters.cacheAdapter)
  }

  get adapters(): IAdaptersArgument {
    return this._adapters;
  }

  get services(): Nip66Services {
    return {
      monitors: this.monitorService,
      relay: this.relayService
    }
  }

  get monitors(): MonitorServiceType | undefined {
    return this.monitorService;
  }

  get relays(): RelayServiceType | undefined {
    return this.relayService;
  }

  private set initialized(value: boolean) {
    this._initialized = value;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  async ready(): Promise<void> {
    while(!this.initialized){
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    StateManager.on(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    StateManager.once(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    StateManager.off(event, listener);
  }

  destroy(): void {
    StateManager.emit('destroy');
  }

  async boot(): Promise<void> {
    this.init();
    await this.ready();
    await this.monitorService?.bootstrap();
  }

  async shutdown(): Promise<void> {
    await this.adapters.cacheAdapter.shutdown();
    await this.adapters.websocketAdapter.shutdown();
  }

  async restart(): Promise<void> {
    await this.shutdown();
    await delay(1000);
    await this.boot();
  }

  async useAdapter(adapter?: ICacheAdapter | IWebsocketAdapter): Promise<void> {
    if(!adapter) {
      return console.warn('No adapter provided')
    }
    if(typeof adapter === 'function') {
      return console.warn('Adapter should be an instantiated CacheAdapter or WebsocketAdapter')
    }
    if(this.isCacheAdapter(adapter)){
      this.cacheAdapter = adapter as ICacheAdapter
      return
    }
    if(this.isWebsocketAdapter(adapter)){
      this.websocketAdapter = adapter as IWebsocketAdapter
      return
    } 
    console.warn(`Adapter not recognized: ${adapter.constructor.name} [should be instance of WebsocketAdapter or CacheAdapter]`)
  }

  isCacheAdapter(adapter: AnyAdapter): boolean {
    return (adapter.constructor as any).type === 'CacheAdapter';
  }

  isWebsocketAdapter(adapter: AnyAdapter): boolean {
    return (adapter.constructor as any).type === 'WebsocketAdapter';
  }
  
  async init() {
    await this.setupWorkers()
    await this.setupServices()
    await this.adaptersReady()
    this.initialized = true;
  }

  async adaptersReady(){
    if(this?.cacheAdapter)
      await this?.cacheAdapter.ready()
    if(this?.websocketAdapter)
      await this?.websocketAdapter.ready()
  }

  async setupWorkers(){
    const { Workers } = await import('./Workers')
    const workers: Workers = new Workers(this.adapters)
    
    //TODO: Replace with emitter
    while(!workers.ready){ await new Promise(resolve => setTimeout(resolve, 100)) }

    ////console.log('workers ready', workers)
    if(this?.adapters?.cacheAdapter)
      this.adapters.cacheAdapter.workers = workers
    if(this?.adapters?.websocketAdapter)
      this.adapters.websocketAdapter.workers = workers
  }

  async setupServices(){
    if(!this?.websocketAdapter || !this?.cacheAdapter) return 
    const { cacheAdapter, websocketAdapter } = this
    const { RelayService } = await import('../services/RelayService')
    const { MonitorService } = await import('../services/MonitorService')
    this.monitorService = new MonitorService({cacheAdapter, websocketAdapter} as IAdaptersArgument);
    this.relayService = new RelayService({cacheAdapter, websocketAdapter} as IAdaptersArgument, this.monitorService);
    await this.monitorService.ready();
    await this.relayService.ready();
  }

  get state(): StateManager {
    return StateManager;
  } 

  get cache(): ICacheAdapter | undefined {
    return this.cacheAdapter;
  }

  get websocket(): IWebsocketAdapter | undefined {
    return this.websocketAdapter;
  }

  get wsWorker(): Worker | SharedWorker | undefined {
    return this?.websocketAdapter?.workers?.websocket;
  }
  get cacheWorker():  SharedWorker | Worker | undefined {
    return this?.cacheAdapter?.workers?.cache;
  }

  // async bootstrap(){
    
  // }

  ping(): void {
    this.cacheAdapter?.ping()
    this.websocketAdapter?.ping()
  }

  REQ(filters: any): void {
    this.cacheAdapter?.REQ(filters)
  }
}
