import { ICheck, IEvent, IMonitor, IRelay } from '@base/models';
import { Adapter, IAdapter } from './Adapter'
import { StateManager } from '@base/managers/StateManager';

export interface GeohashOptions {
  maxDistance?: number; 
  minResults?: number;
}

/******
 * 
 * CHECK
 *    TYPES/INTERFACES/DEFAULTS
 * 
 */

export type GetCheckParameters = GetCheckParameters1 | GetCheckParameters2

interface GetCheckParameters1 {
  relay: string, 
  monitorPubkey: string
}

interface GetCheckParameters2 {
  nid: string, 
}

export interface GetChecksParameters {
  nid?: string, 
  relay?: string, 
  monitorPubkey?: string
  supportedNips?: string[],
  isp?: string,
  asname?: string,  
  as?: string,
  network?: string,
  relayType?: string,
  paymentRequired?: boolean,
  authRequired?: boolean
  
  created_at?: number
  rtt?: number,
}

export interface ChecksResult {
  [key: string]: CheckResult
}

export interface CheckResult {
  record?: ICheck,
  check?: IEvent,
}

export type CheckResultKeys = (keyof CheckResult)[]

export const defaultCheckResultKeys: CheckResultKeys = ['check']

/******
 * 
 * MONITOR
 *    TYPES/INTERFACES/DEFAULTS
 * 
 */

export interface GetMonitorsParameters {
  monitorPubkey?: string, 
  checks?: string[],
  geohash?: string[]
}

export interface GetMonitorParameters {
  monitorPubkey: string 
}

export interface MonitorsResult {
  [key: string]: MonitorResult
}

export interface MonitorResult {
  record?: IMonitor,
  registration?: IEvent,
  profile?: IEvent,
  relayList?: IEvent,  
}

export type MonitorResultKeys = (keyof MonitorResult)[]

export const defaultMonitorResultKeys: MonitorResultKeys = ['profile', 'registration', 'relayList']

/******
 * 
 * RELAY
 *    TYPES/INTERFACES/DEFAULTS
 * 
 */

export interface GetRelaysParameters {
  relay?: string | string[],
  network?: string | string[]
  lastSeen?: number
}

export interface RelaysResult {
  [key: string]: RelayResult
}

export interface RelayResult {
  record?: IRelay,
  checkRecords?: ICheck[],
  checks?: IEvent[]
}

export type RelayResultKeys = (keyof RelayResult)[]

export const defaultRelayResultKeys: RelayResultKeys = ['record']

export interface ICacheAdapter extends IAdapter {
  init?(): Promise<void>;
  ready(): Promise<void>;

  REQ(filters: any[]): Promise<IEvent[]>;
  COUNT(filters: any[]): Promise<number>;
  DELETE(filters: any[]): Promise<string[]>;
  DUMP(): Promise<Uint8Array>;
  CLOSE(subId: string): Promise<boolean>;
  WIPE(): Promise<boolean>;

  addEvent(event: IEvent): Promise<void>;
  addEvents(events: IEvent[]): Promise<void>;
  putEvent(event: IEvent): Promise<void>;

  patchRelay?(relay: Partial<IRelay>): Promise<void>;
  updateRelay?(relay: IRelay): Promise<void>;
}

export class CacheAdapter extends Adapter {
  static type = 'CacheAdapter';
  readonly slug: string = 'CacheAdapter:unset'; 
  protected _ready: boolean = false;

  constructor(worker?: Worker | SharedWorker | URL) {  
    super(worker)
    StateManager.on('destroy', () => {
      if(this.worker instanceof Worker)
        this.worker?.terminate()
    })
    this.init();
  }

  get worker(): Worker | SharedWorker | undefined {
    return this.workers?.cache
  }

  async ready(): Promise<void> {}

  async init(): Promise<void> {
    this._ready = true;
  }

  protected bindWorkerHandlers(): void {
    if(!this?.workers?.cache) return console.warn('[CacheAdapter] Error binding worker handlers: no worker found')
    if(this.workers.cache instanceof Worker)
      this.workers.cache.onmessage = this._onMessage.bind(this);
    else if(this.workers.cache instanceof SharedWorker)
      this.workers.cache.port.onmessage = this._onMessage.bind(this);
    this.workers.cache.onerror = this._onError.bind(this)
  }

  ping(): void {
    //console.log(`[CacheAdapter:${this.constructor.name}] o/o SEND: PING -> cacheWorker`)
    if(this.workers?.cache instanceof Worker)
      this.workers?.cache?.postMessage({type: 'ping'})
    else if (this.workers?.cache instanceof SharedWorker)
      this.workers?.cache?.port.postMessage({type: 'ping'})
  }
}