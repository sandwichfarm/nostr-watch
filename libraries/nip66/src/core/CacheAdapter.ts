import { ICheck, IEvent, IMonitor, IRelay } from '@base/models';
import { Adapter, IAdapter } from './Adapter'

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

  /***********
   * 
   * EVENTS
   * 
   */

  // C 
    addEvent(event: IEvent): Promise<void>;
    putEvent(event: IEvent): Promise<void>;

  // R
    getEvent(id: string): Promise<IEvent | null>;
    eventExists?(id: string): Promise<boolean>;

  // U 
    // Events are immutable, no updates

  // D
    deleteEvent(id: string): Promise<void>;
    clearEvents(): Promise<void>;
  
  /* end: EVENTS */

  /***********
   * 
   * MONITORS
   * 
   */

  // C 
    addMonitor(monitor: IEvent): Promise<void>;
    putMonitor(monitor: IEvent): Promise<void>;

  // R
    getMonitor(params: GetMonitorParameters, resultKeys: MonitorResultKeys): Promise<MonitorResult | null>;
      getMonitorRecord?(params: GetMonitorParameters): Promise<IMonitor>;
      getMonitorRegistration?(params: GetMonitorParameters): Promise<IEvent>;
      getMonitorProfile?(params: GetMonitorParameters): Promise<IEvent>;
      getMonitorRelayList?(params: GetMonitorParameters): Promise<IEvent>;
    getMonitors(params: GetMonitorsParameters, resultKeys: MonitorResultKeys): Promise<MonitorsResult>;
      getMonitorsRecords?(params: GetMonitorsParameters): Promise<IMonitor[]>;
      getMonitorsRegistrations?(params: GetMonitorsParameters): Promise<IEvent[]>;
      getMonitorsProfiles?(params: GetMonitorsParameters): Promise<IEvent[]>;
      getMonitorsRelayLists?(params: GetMonitorsParameters): Promise<IEvent[]>;
      //
      getMonitorsByChecks?(checks: string[]): Promise<IEvent[]>;
      getMonitorsByDistance?(targetGeohash: string, options: GeohashOptions): Promise<IEvent[]>;
      getMonitorsByFrequency?(frequency: number, operator: ">" | "<"): Promise<IEvent[]>;
    ensureMonitorExists?(id: string): Promise<boolean>;
    ensureMonitorActive?(id: string): Promise<boolean>;

  // U
    patchMonitor?(monitor: Partial<IMonitor>): Promise<void>;
    updateMonitor?(monitor: IMonitor): Promise<void>; //alias for putMonitor

  // D
    deleteMonitor(id: string): Promise<void>;
    deleteMonitors(ids: string[]): Promise<void>;
    clearMonitors(): Promise<void>;

  /* end: MONITORS */

  /***********
   * 
   * RELAYS
   * 
   */

  // C
    addRelay(relay: IRelay): Promise<void>;
    putRelay(relay: IRelay): Promise<void>;
    
  // R
    //methods
    getRelay(relay: string, resultKeys: RelayResultKeys): Promise<RelayResult | null>;
      getRelayRecord?(relay: string, resultKeys: RelayResultKeys): Promise<IRelay>;
      getRelayCheckRecords?(relay: string, resultKeys: RelayResultKeys): Promise<ICheck[]>;
      getRelayCheckEvents?(relay: string, resultKeys: RelayResultKeys): Promise<IEvent[]>
    getRelays(params: GetRelaysParameters, resultKeys: RelayResultKeys): Promise<RelaysResult>;
      getRelaysRecords?(params: GetRelaysParameters): Promise<IRelay[]>;
      getRelaysCheckRecords?(params: GetRelaysParameters): Promise<ICheck[][]>;
      getRelaysCheckEvents?(params: GetRelaysParameters): Promise<IEvent[][]>;

  // U
    patchRelay?(relay: Partial<IRelay>): Promise<void>;
    updateRelay?(relay: IRelay): Promise<void>; //alias for patchRelay

  // D
    deleteRelay(id: string): Promise<void>;
    deleteRelays(relays: string[]): Promise<void>;
    clearRelays(): Promise<void>;

  /* end: RELAYS */

  /***********
   * 
   * CHECKS
   * 
   */

  // C  
    addCheck(check: IEvent): Promise<void>;
    putCheck(check: IEvent): Promise<void>;

  // R
    getCheck(checkParameters: GetCheckParameters, resultKeys: CheckResultKeys): Promise<CheckResult | null>;
      getCheckRecord?(checkParameters: GetCheckParameters): Promise<ICheck>;
      getCheckEvent?(checkParameters: GetCheckParameters): Promise<IEvent>;
    getChecks(checksParameters: GetChecksParameters, resultKeys: CheckResultKeys): Promise<ChecksResult>;
      getChecksRecords?(checksParameters: GetChecksParameters): Promise<ICheck[]>;
      getChecksEvents?(checksParameters: GetChecksParameters): Promise<IEvent[]>;

  // U
    //Checks don't have updates, they are immutable
  
  // D
    deleteCheck(checkParameters: GetCheckParameters): Promise<void>;
    deleteChecks(checksParameters: GetChecksParameters): Promise<void>;
    clearChecks(): Promise<void>;

  /* end: CHECKS */
}

export class CacheAdapter extends Adapter {
  static type = 'CacheAdapter';
  static slug: string; 
  static metaUrl: string;

  get dedicatedWorker(): Worker | undefined {
    return this.workers?.cacheDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.cacheShared
  }

  bindWorkerHandlers(): void {
    if(!this?.workers?.cacheDedicated) return console.warn('[CacheAdapter] Error binding worker handlers: no worker found')
    this.workers.cacheDedicated.onmessage = this._onMessage.bind(this);
    this.workers.cacheDedicated.onerror = this._onError.bind(this)
  }

  ping(): void {
    //console.log(`[CacheAdapter:${this.constructor.name}] o/o SEND: PING -> cacheWorker`)
    this.workers?.cacheDedicated?.postMessage({type: 'ping'})
  }
}

class CacheAdapterMethods {

  /***********
   * 
   * EVENTS
   * 
   */

  // C 
  //@overload
  async addEvent(event: IEvent): Promise<void> {
    return void 0;
  }
  //@overload
  async putEvent(event: IEvent): Promise<void> {
    return void 0;
  }

  // R
  //@overload
  async getEvent(id: string): Promise<IEvent | null> {
    return {} as IEvent;
  }
  //@overload
  async eventExists(id: string): Promise<boolean> {
    return false;
  }

  // U
    // Events are immutable, no updates

  // D
  //@overload
  async deleteEvent(id: string): Promise<void> {
    return void 0;
  }
  //@overload
  async clearEvents(): Promise<void> {
    return void 0;
  }

  /***********
   * 
   * MONITORS
   * 
   */

  // C
  //@overload
  async addMonitor(monitor: IMonitor): Promise<void> {
    return void 0;
  }

  //@overload
  async putMonitor(monitor: IMonitor): Promise<void> {
    return void 0;
  }

  // R

  //@overload
  async getMonitor(params: GetMonitorParameters, resultKeys: MonitorResultKeys = defaultMonitorResultKeys): Promise<MonitorResult | null> {
    return {} as MonitorResult;
  }

    //@built-in:helper
    async getMonitorRecord(params: GetMonitorParameters): Promise<IMonitor | void> {
      const monitor = await this.getMonitor(params, ['record'])
      if(!monitor) return console.warn('Error getting monitor record: no monitor found', params)
      return monitor.record as IMonitor
    }

    //@built-in:helper
    async getMonitorRegistration(params: GetMonitorParameters): Promise<IEvent | void> {
      const monitor = await this.getMonitor(params, ['registration'])
      if(!monitor) return console.warn('Error getting monitor registration: no monitor found', params)
      return monitor.registration
    }

    //@built-in:helper
    async getMonitorProfile(params: GetMonitorParameters): Promise<IEvent | void> {
      const monitor = await this.getMonitor(params, ['profile'])
      if(!monitor) return console.warn('Error getting monitor profile: no monitor found', params)
      return monitor.profile
    }

    //@built-in:helper
    async getMonitorRelayList(params: GetMonitorParameters): Promise<IEvent | void> {
      const monitor = await this.getMonitor(params, ['relayList'])
      if(!monitor) return console.warn('Error getting monitor relay list: no monitor found', params)
      return monitor.relayList
    }


  //@overload
  async getMonitors(params: GetMonitorsParameters, resultKeys: MonitorResultKeys = defaultMonitorResultKeys): Promise<MonitorsResult> {
    return {} as MonitorsResult;
  }

    //@built-in:helper
    async getMonitorsRecords(params: GetMonitorsParameters): Promise<IMonitor[]> {
      const records = this.getMonitors(params, ['record'])
      return Object.values(records).map( result => result.record as IMonitor)
    }

    //@built-in:helper
    async getMonitorsRegistrations(params: GetMonitorsParameters): Promise<IEvent[]> {
      const events = this.getMonitors(params, ['registration'])
      return Object.values(events).map( result => result.registration )
    }

    //@built-in:helper
    async getMonitorsProfiles(params: GetMonitorsParameters): Promise<IEvent[]> {
      const events = this.getMonitors(params, ['profile'])
      return Object.values(events).map( result => result.profile )
    }

    //@built-in:helper
    async getMonitorsRelayLists(params: GetMonitorsParameters): Promise<IEvent[]> {
      const events = this.getMonitors(params, ['relayList'])
      return Object.values(events).map( result => result.relayList )
    }

  //@built-in:helper
  async getMonitorsByChecks(checks: string[]): Promise<IEvent[]> {
    return [] as IEvent[];
  }
  //@built-in:helper
  async getMonitorsByDistance(targetGeohash: string, options: GeohashOptions): Promise<IEvent[]> {
    return [] as IEvent[];
  }

  //@built-in:helper
  async getMonitorsByFrequency(frequency: number, operator: ">" | "<"): Promise<IEvent[]> {
    return [] as IEvent[];
  }

  //@built-in:helper
  async ensureMonitorExists(id: string): Promise<boolean> {
    const result = await this.getMonitor({ monitorPubkey: id }, ['record'])
    return !!result
  }

  // U
  //@built-in:helper
  async patchMonitor(monitor: Partial<IMonitor>): Promise<void> {
    if(!monitor?.id) return console.warn('Error patching monitor: no id provided', monitor)
    const existingRecord = (await this.getMonitor({ monitorPubkey: monitor.id }, ['record']))?.record
    if(!existingRecord) return console.warn('Error patching monitor: no record found', monitor)
    const monitorRecord: IMonitor = {...existingRecord, ...monitor } as IMonitor
    return this.putMonitor(monitorRecord)
  }

  //@built-in:helper
  async updateMonitor(monitor: IMonitor): Promise<void> {
    if(!(await this.ensureMonitorExists(monitor.id))) return console.warn('Error updating monitor: record not found', monitor)
    return this.putMonitor(monitor)
  }

  // D
  //@overload
  async deleteMonitor(id: string): Promise<void> {
    return void 0;
  } 

  //@overload
  async deleteMonitors(ids: string[]): Promise<void> {
    return void 0;
  }

  //@overload
  async clearMonitors(): Promise<void> {
    return void 0;
  }

  /***********
   * 
   * Relays
   * 
   */

  // C 
  //@overload
  async addRelay(relay: IRelay): Promise<void> { 
    return void 0;
  }
  //@overload
  async putRelay(relay: IRelay): Promise<void> { 
    return void 0;
  }

  // R
  //@overload
  async getRelay(relay: string, resultKeys: RelayResultKeys = defaultRelayResultKeys): Promise<RelayResult | null> {
    return {} as RelayResult;
  }
    //@built-in:helper
    async getRelayRecord(params: GetRelaysParameters): Promise<IRelay | void> {
      const relay = params?.relay?.[0]
      if(!relay) return console.warn('Error getting relay record: no relay provided', params)
      const record = (await this.getRelay(relay))?.record
      if(!record) return console.warn('Error getting relay record: no record found', params)
      return record as IRelay
    
    }
    //@built-in:helper
    async getRelayCheckEvents(params: GetRelaysParameters): Promise<IEvent[] | void> {
      let { relay } = params
      if(!relay) return console.warn('Error getting relay check events: no relay provided:', params)
      if(relay instanceof Array) {
        relay = relay[0]
      }
      const result = await this.getRelay(relay, ['checks'])
      if(!result || !result?.checks) return console.warn('Error getting relay check events: no result found:', params)
      const checkEvents = result.checks
      return checkEvents as IEvent[]
    }
    //@built-in:helper
    async getRelayCheckRecords(params: GetRelaysParameters): Promise<ICheck[] | void> {
      let { relay } = params
      if(!relay) return console.warn('Error getting relay check records: no relay provided:', params)
      if(relay instanceof Array) {
        relay = relay[0]
      }
      const result = await this.getRelay(relay, ['checkRecords'])
      if(!result || !result?.checkRecords) return console.warn('Error getting relay check records: no result found:', params)
      const checkRecords = result.checkRecords
      return checkRecords as ICheck[]
    }


  //@overload
  async getRelays(params: GetRelaysParameters, resultKeys: RelayResultKeys = defaultRelayResultKeys): Promise<RelaysResult> {
    return {} as RelaysResult;
  }
    //@built-in:helper
    async getRelaysRecords(params: GetRelaysParameters): Promise<IRelay[]> {
      return Object.values(await this.getRelays(params, ['record'])).map( result => result.record as IRelay)
    }
    //@built-in:helper
    async getRelaysChecks(params: GetRelaysParameters): Promise<IEvent[][]>  {
      const arr = Object.values(await this.getRelays(params, ['checks']))
      return arr
              .map( result => result?.checks? result.checks as IEvent[]: undefined)
              .filter( check => !!check )
    }
    //@built-in:helper
    async getRelaysCheckRecords(params: GetRelaysParameters): Promise<ICheck[][]> {
      const arr = Object.values(await this.getRelays(params, ['checkRecords']))
      return arr
              .map( result => result?.checkRecords? result.checkRecords as ICheck[]: undefined)
              .filter( check => !!check )
    }

  //@built-in:helper
  async relayExists(id: string): Promise<boolean> {
    return !!await this.getRelay(id)
  }

  // U 
  //@built-in:helper
  async patchRelay(relayPartial: Partial<IRelay>): Promise<void> {
    if(!relayPartial?.relay) return console.warn('Error patching relay: no id provided', relayPartial)
    const existingRecord = await this.getRelay(relayPartial.relay)
    if(!existingRecord) return console.warn('Error patching relay: no record found', relayPartial)
    const relayRecord: IRelay = {...existingRecord, ...relayPartial } as IRelay
    return this.putRelay(relayRecord)
  }
  
  //@built-in:helper
  async updateRelay(relay: IRelay): Promise<void> {
    if(!(await this.relayExists(relay.relay))) return console.warn('Error updating relay: record not found', relay)
    return this.putRelay(relay)
  }

  // D
  //@overload
  async deleteRelay(id: string): Promise<void> {
    return void 0;
  }
  //@overload
  async deleteRelays(relays: string[]): Promise<void> {
    return void 0;
  }
  //@overload
  async clearRelays(): Promise<void> {
    return void 0;
  }

  /***********
   * 
   * CHECKS
   * 
   */
  
  // C
  //@overload
  async addCheck(check: IEvent): Promise<void> {
    return void 0;
  }

  //@overload
  async putCheck(check: IEvent): Promise<void> {
    return void 0;
  }

  // R

  //@overload
  async getCheck(checkParameters: GetCheckParameters, resultKeys: CheckResultKeys = defaultCheckResultKeys): Promise<CheckResult | null> {
    return {} as CheckResult;
  }
    //@built-in:helper
    async getCheckRecord(checkParameters: GetCheckParameters): Promise<ICheck | void> {
      const check = await this.getCheck(checkParameters, ['record'])
      if(!check) return console.warn('Error getting check record: no check found', checkParameters)
      return check.record as ICheck
    }
    //@built-in:helper
    async getCheckEvent(checkParameters: GetCheckParameters): Promise<IEvent | void> {
      const check = await this.getCheck(checkParameters, ['check'])
      if(!check) return console.warn('Error getting check event: no check found', checkParameters)
      return check.check as IEvent
    }
  
  //@overload 
  async getChecks(checksParameters: GetChecksParameters, resultKeys: CheckResultKeys = defaultCheckResultKeys): Promise<ChecksResult> {
    return {} as ChecksResult;
  }
    //@built-in:helper
    async getChecksRecords(checksParameters: GetChecksParameters): Promise<ICheck[] | void> {
      const checks = this.getChecks(checksParameters, ['record'])
      if(!checks) return console.warn('Error getting check records: no checks found', checksParameters)
      return Object.values(checks).map( result => result.checkRecords as ICheck)
    }

    //@built-in:helper
    async getChecksEvents(checksParameters: GetChecksParameters): Promise<IEvent[] | void> {
      const checks = this.getChecks(checksParameters, ['check'])
      if(!checks) return console.warn('Error getting check events: no checks found', checksParameters)
      return Object.values(checks).map( result => result.check as IEvent)
    }

  // U
    //Checks don't have updates, they are immutable

  // D

  //@overload
  async deleteCheck(checkParameters: GetCheckParameters): Promise<void> {
    return void 0;
  }

  //@overload
  async deleteChecks(checksParameters: GetChecksParameters): Promise<void> {
    return void 0;
  }

  //@overload
  async clearChecks(): Promise<void> {
    return void 0;
  }

}