import type { IWebsocketAdapter } from './WebsocketAdapter';
import type { ICacheAdapter } from './CacheAdapter';

import type { RelayService as RelayServiceType } from '../services/RelayService';
import type { MonitorService as MonitorServiceType } from '../services/MonitorService';

import type { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';

import type { Workers } from './Workers';
// import { getInheritanceChainFromInstance } from '../utils/classes';

type AnyAdapter = IWebsocketAdapter | ICacheAdapter;

export default class {

  public relayService?: RelayServiceType;
  public monitorService?: MonitorServiceType;

  private websocketAdapter?: IWebsocketAdapter;  
  private cacheAdapter?: ICacheAdapter;

  constructor(
    private adapters: IAdaptersArgument,
    private relayUrls: string[]
  ) {
    if(adapters?.websocketAdapter)
      this.useAdapter(adapters.websocketAdapter)
    if(adapters?.cacheAdapter)
      this.useAdapter(adapters.cacheAdapter)
  }

  get monitors(): MonitorServiceType | undefined {
    return this.monitorService;
  }

  get relays(): RelayServiceType | undefined {
    return this.relayService;
  }

  async useAdapter(adapter?: ICacheAdapter | IWebsocketAdapter): Promise<void> {
    if(!adapter) {
      return console.warn('No adapter provided')
    }
    if(typeof adapter === 'function') {
      return console.warn('Adapter should be an instantiated CacheAdapter or WebsocketAdapter')
    }
    //console.log(adapter.constructor.name, this.isWebsocketAdapter(adapter), this.isCacheAdapter(adapter))

    if(this.isCacheAdapter(adapter)){
      //console.log('isCacheAdapter', adapter)
      this.cacheAdapter = adapter as ICacheAdapter
      return
    }
    if(this.isWebsocketAdapter(adapter)){
      //console.log('isWebsocketAdapter', adapter)
      this.websocketAdapter = adapter as IWebsocketAdapter
      return
    } 
    console.warn(`Adapter not recognized: ${adapter.constructor.name} [should be instance of WebsocketAdapter or CacheAdapter]`)
  }

  isCacheAdapter(adapter: AnyAdapter): boolean {
    //console.log(adapter, (adapter.constructor as any).type )
    return (adapter.constructor as any).type === 'CacheAdapter';
  }

  isWebsocketAdapter(adapter: AnyAdapter): boolean {
    //console.log(adapter, (adapter.constructor as any).type )
    return (adapter.constructor as any).type === 'WebsocketAdapter';
  }
  
  async init() {
    await this.setupWorkers()
    await this.setupServices()
    await this.adaptersReady()
  }

  async adaptersReady(){
    if(this?.cacheAdapter)
      await this?.cacheAdapter.ready()
    if(this?.websocketAdapter)
      await this?.websocketAdapter.ready()
  }

  async setupWorkers(){
    if(!this?.adapters?.websocketAdapter || !this?.adapters?.cacheAdapter) return 
    const { Workers } = await import('./Workers')
    const workers: Workers = new Workers(this.adapters)
    
    //TODO: Replace with emitter
    while(!workers.ready){ await new Promise(resolve => setTimeout(resolve, 1)) }

    //console.log('workers ready', workers)
    this.adapters.cacheAdapter.workers = workers
    this.adapters.websocketAdapter.workers = workers
  }

  async setupServices(){
    if(!this?.websocketAdapter || !this?.cacheAdapter) return 
    const { cacheAdapter, websocketAdapter } = this
    const { RelayService } = await import('../services/RelayService')
    const { MonitorService } = await import('../services/MonitorService')
    this.relayService = new RelayService({cacheAdapter, websocketAdapter} as IAdaptersArgument);
    this.monitorService = new MonitorService({cacheAdapter, websocketAdapter} as IAdaptersArgument);
    
    this.monitorService.init()
  }

  get cache(): ICacheAdapter | undefined {
    return this.cacheAdapter;
  }


  get websocket(): IWebsocketAdapter | undefined {
    return this.websocketAdapter;
  }

  get wsWorker(): Worker | undefined {
    return this?.websocketAdapter?.workers?.websocketDedicated;
  }

  get wsSharedWorker(): SharedWorker | undefined {  
    return this?.websocketAdapter?.workers?.websocketShared;
  }

  get cacheWorker():  SharedWorker | Worker | undefined {
    return this?.cacheAdapter?.workers?.cacheDedicated;
  }

  get cacheSharedWorker(): SharedWorker | undefined {
    return this?.cacheAdapter?.workers?.cacheShared;
  }

  async bootstrapMonitors(){
    // this.monitorService?.populateMonitors();
    // this.monitorService?.checkMonitorsActive();
  }

  async populateChecksRelays(){
    // if(!this?.monitorService) return console.warn('monitorService not initialized')
    // const activeMonitors = await this.monitorService.getActiveMonitors()
    // for(const monitorPubkey of activeMonitors) {
    //   this.relayService?.getOnlineRelaysByMonitorPubkey(monitorPubkey);
    // }
  }

  ping(): void {
    this.cacheAdapter?.ping()
    this.websocketAdapter?.ping()
  }

  REQ(filters: any): void {
    this.cacheAdapter?.REQ(filters)
    // this.websocketAdapter?.REQ(filters)
  }

  // async getOfflineRelaysByMonitor(){

  // }

  // async getDeadRelaysByMoniitor(){

  // }

  // async getChecksByRelay(){
    
  // }  

  /**
   * Retrieves active monitors.
   */
  // async getActiveMonitors() {
  //   return await this?.monitorService?.getActiveMonitors();
  // }

  /**
   * Finds the monitor closest to a given geohash.
   */
  // async findMonitorClosestToGeohash(geohash: string) {
  //   return await this?.monitorService?.findMonitorClosestToGeohash(geohash);
  // }

  /**
   * Finds monitors conducting specific checks.
   */
  // async findMonitorsBySpecificChecks(checks: string[]) {
  //   return await this?.monitorService?.findMonitorsBySpecificChecks(checks);
  // }

  /**
   * Finds relays based on various criteria.
   * Each method delegates to RelayService's methods.
   */
  // async findRelaysByNips(nips: number[], condition: 'and' | 'or' = 'and') {
  //   return await this?.relayService?.findRelaysByNips(nips, condition);
  // }

  // async findRelaysByISP(isp: string) {
  //   return await this?.relayService?.findRelaysByISP(isp);
  // }

  // async findRelaysByIP(ip: string) {
  //   return await this?.relayService?.findRelaysByIP(ip);
  // }

  // async findRelaysByCountryCode(countryCode: string) {
  //   return await this?.relayService?.findRelaysByCountryCode(countryCode);
  // }

  // async findRelaysByOwner(ownerPubkey: string) {
  //   return await this?.relayService?.findRelaysByOwner(ownerPubkey);
  // }

  // async findRelaysByNetwork(network: string) {
  //   return await this?.relayService?.findRelaysByNetwork(network);
  // }

  // async findRelaysByRTT(
  //   rtt: number,
  //   comparator: '<' | '>' | '<=' | '>=' | '=='
  // ) {
  //   return await this?.relayService?.findRelaysByRTT(rtt, comparator);
  // }

  // async findRelaysByLiveness(
  //   status: 'online' | 'offline' | 'dead',
  //   thresholds?: {
  //     onlineThreshold?: number;
  //     deadThreshold?: number;
  //   }
  // ) {
  //   return await this?.relayService?.findRelaysByLiveness(status, thresholds);
  // }

  // async sortMonitorsByDistance(geohash: string, precision?: number) {
  //   return await this?.relayService?.sortMonitorsByDistance(geohash, precision);
  // }
}
