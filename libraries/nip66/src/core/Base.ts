// src/index.ts

import { IndexedDbAdapter } from '../adapters/cache/IndexedDbAdapter/src';
import { LocalStorageAdapter } from '../adapters/cache/LocalStorageAdapter/src';
import { ICacheAdapter } from './interfaces/ICacheAdapter';
import { RelayService } from './services/RelayService';
import { MonitorService } from './services/MonitorService';
import { IWebSocketAdapter } from './interfaces/IWebsocketAdapter';
import { NostrToolsAdapter } from '../adapters/websocket/NostrToolsAdapter/src';

import N66Workers from './Workers';

export default class {

  private relayService: RelayService;
  private monitorService: MonitorService;

  private websocketAdapter: IWebSocketAdapter;  
  private cacheAdapter: ICacheAdapter;

  constructor(
    private relayUrls: string[]
  ) {

  }

  useAdapter(adapter: ICacheAdapter | IWebSocketAdapter){
    if(adapter instanceof IWebSocketAdapter){
      this.websocketAdapter = adapter as IWebSocketAdapter
    } else if(adapter instanceof ICacheAdapter){
      this.cacheAdapter = adapter as ICacheAdapter
    }
  }

  setupWorkers(){
    const { websocket, cache, websocketShared, cacheShared, channel } = new N66Workers(this.websocketAdapter, this.cacheAdapter)
    if(websocket && websocketShared){
      this.websocketAdapter.workers = { worker: websocket, sharedWorker: websocketShared }
    }
    if(cache && cacheShared){
      this.cacheAdapter.workers = { worker: cache, sharedWorker: cacheShared }
    }
  }

  setupServices(){
    this.relayService = new RelayService(
      this.websocketAdapter,
      this.cacheAdapter
    );
    this.monitorService = new MonitorService(
      this.websocketAdapter,
      this.cacheAdapter
    );
  }
  

  /**
   * Initializes the library by connecting to relays and setting up subscriptions.
   */
  async initialize() {
    
    await this.relayService.initialize(this.relayUrls);
    // Additional initialization steps if needed
  }

  get wsWorker(): SharedWorker | Worker | undefined {
    return this.websocketAdapter.worker;
  }

  get cacheWorker():  SharedWorker | Worker | undefined {
    return this.cacheAdapter.worker;
  }

  /**
   * Retrieves active monitors.
   */
  async getActiveMonitors() {
    return await this.monitorService.getActiveMonitors();
  }

  /**
   * Finds the monitor closest to a given geohash.
   */
  async findMonitorClosestToGeohash(geohash: string) {
    return await this.monitorService.findMonitorClosestToGeohash(geohash);
  }

  /**
   * Finds monitors conducting specific checks.
   */
  async findMonitorsBySpecificChecks(checks: string[]) {
    return await this.monitorService.findMonitorsBySpecificChecks(checks);
  }

  /**
   * Finds relays based on various criteria.
   * Each method delegates to RelayService's methods.
   */
  async findRelaysByNips(nips: number[], condition: 'and' | 'or' = 'and') {
    return await this.relayService.findRelaysByNips(nips, condition);
  }

  async findRelaysByISP(isp: string) {
    return await this.relayService.findRelaysByISP(isp);
  }

  async findRelaysByIP(ip: string) {
    return await this.relayService.findRelaysByIP(ip);
  }

  async findRelaysByCountryCode(countryCode: string) {
    return await this.relayService.findRelaysByCountryCode(countryCode);
  }

  async findRelaysByOwner(ownerPubkey: string) {
    return await this.relayService.findRelaysByOwner(ownerPubkey);
  }

  async findRelaysByNetwork(network: string) {
    return await this.relayService.findRelaysByNetwork(network);
  }

  async findRelaysByRTT(
    rtt: number,
    comparator: '<' | '>' | '<=' | '>=' | '=='
  ) {
    return await this.relayService.findRelaysByRTT(rtt, comparator);
  }

  async findRelaysByLiveness(
    status: 'online' | 'offline' | 'dead',
    thresholds?: {
      onlineThreshold?: number;
      deadThreshold?: number;
    }
  ) {
    return await this.relayService.findRelaysByLiveness(status, thresholds);
  }

  async sortMonitorsByDistance(geohash: string, precision?: number) {
    return await this.relayService.sortMonitorsByDistance(geohash, precision);
  }
}
