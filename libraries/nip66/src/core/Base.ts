// src/index.ts

import { WebsocketAdapter, IWebsocketAdapter } from './WebsocketAdapter';
import { CacheAdapter, ICacheAdapter } from './CacheAdapter';

import { RelayService } from '../services/RelayService';
import { MonitorService } from '../services/MonitorService';

import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';

import { Workers } from './Workers';
import { getInheritanceChainFromInstance } from '../utils/general';

export default class {

  private relayService?: RelayService;
  private monitorService?: MonitorService;

  private websocketAdapter?: IWebsocketAdapter;  
  private cacheAdapter?: ICacheAdapter;

  constructor(
    private adapters: IAdaptersArgument,
    private relayUrls: string[]
  ) {
    this.useAdapter(adapters.websocketAdapter)
    this.useAdapter(adapters.cacheAdapter)
  }

  useAdapter(adapter?: ICacheAdapter | IWebsocketAdapter): void {
    if(!adapter) return console.warn('No adapter provided')
    if(this.isWebsocketAdapter(adapter)){
      this.websocketAdapter = adapter as IWebsocketAdapter
      return
    } 
    if(this.isCacheAdapter(adapter)){
      this.cacheAdapter = adapter as ICacheAdapter
      return
    }
    console.warn(`Adapter not recognized: ${adapter.constructor.name} [should be instance of WebsocketAdapter or CacheAdapter]`)
  }

  isWebsocketAdapter(adapter: ICacheAdapter | IWebsocketAdapter): boolean {
    const chain = getInheritanceChainFromInstance(adapter)
    return chain.includes('WebsocketAdapter')
  }

  isCacheAdapter(adapter: ICacheAdapter | IWebsocketAdapter): boolean {
    const chain = getInheritanceChainFromInstance(adapter)
    return chain.includes('CacheAdapter')
  }

  setupWorkers(){
    if(!this?.websocketAdapter || !this?.cacheAdapter) return 
    const workers = new Workers(this.websocketAdapter, this.cacheAdapter)
    this.websocketAdapter.workers = workers
    this.cacheAdapter.workers = workers
  }

  setupServices(){
    if(!this?.websocketAdapter || !this?.cacheAdapter) return 
    const { cacheAdapter, websocketAdapter } = this
    this.relayService = new RelayService({cacheAdapter, websocketAdapter} as IAdaptersArgument);
    this.monitorService = new MonitorService({cacheAdapter, websocketAdapter} as IAdaptersArgument);
  }
  
  /**
   * Initializes the library by connecting to relays and setting up subscriptions.
   */
  async init() {
    this.setupWorkers()
    this.setupServices()
  }

  get wsWorker(): SharedWorker | Worker | undefined {
    return this?.websocketAdapter?.worker;
  }

  get cacheWorker():  SharedWorker | Worker | undefined {
    return this?.cacheAdapter?.worker;
  }

  async bootstrapMonitors(){}
  async getOnlineRelaysByMonitor(){}
  async getOfflineRelaysByMonitor(){}
  async getDeadRelaysByMoniitor(){}
  async getChecksByRelay(){}  

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
