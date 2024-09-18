import { IEvent, IMonitor, IRelay, ICheck } from '@nostrwatch/nip66/models';

import { 
  GetRelaysParameters, 
  GetMonitorParameters, 
  MonitorResultKeys, 
  defaultMonitorResultKeys, 
  RelayResultKeys,
  CacheAdapter, 
  CheckResult, 
  CheckResultKeys, 
  defaultCheckResultKeys, 
  defaultRelayResultKeys, 
  // GeohashOptions, 
  GetCheckParameters, 
  ICacheAdapter, 
  MonitorResult, 
  RelayResult, 
  RelaysResult, 
  ChecksResult,
  GetChecksParameters,
  GetMonitorsParameters,
  MonitorsResult
} from '@nostrwatch/nip66/core';

//adapter
import { DexieQueue, DexieTask } from './DexieQueue';
import { RelayDb } from './db';

// @ts-ignore: No default export error
import DexieWorker from './workers/dexie.worker'

class DexieAdapter extends CacheAdapter implements ICacheAdapter {

  readonly slug: string = 'dexie'
  readonly metaUrl: string = import.meta.url

  private _idb: any;
  // private queue: DexieQueue;

  constructor(isMainThread: boolean = true) {
    super()
    this._idb = new RelayDb();
    
    // this.queue = new DexieQueue( this.dexieTaskWorker.bind(this) )
    //console.log('metaurl', this.metaUrl) 
    if(isMainThread) {
      this.bindWorkerHandlers()
    }
  }

  async init(): Promise<void> {
    await this.idb.init()
    console.log('DexieAdapter init()')
  }

  get db(): RelayDb {
    return this.idb;
  }

  get idb(): RelayDb {
    return this._idb;
  }

  async newWorker(): Promise<Worker> {
    return DexieWorker();
  }

  // async newSharedWorker(): Promise<SharedWorker> {
  //   // const source = `import("${DexieAdapter.generatePaths(this.slug, this.metaUrl).sharedWorkerPath}").then(({ default }) => default())`;
  //   // return new SharedWorker('data:application/javascript;base64,' + btoa(source));
  //   // const blob = await fetch(new URL('./workers/dexie.shared.worker.ts', import.meta.url))
  //   //   .then((response) => response.blob());
  //   // var url = URL.createObjectURL(blob);
  //   // return new SharedWorker(url);
  //   // return new _SharedWorker()
  //   return new DexieWorker({ type: 'module' });
  // }

  // async addEventsToQueue( events: IEvent[] ){
  //   await this.queue.add({ goal: "processEvents", events })
  // }

  // async dexieTaskWorker(task: DexieTask){
  //   const { id, count, goal, events } = task
  //   if(goal === "processEvents"){
  //     for(const event of events){
  //       await this.addEvent(event.id, event).catch(console.warn)
  //     }
  //   }
  // }

  // EVENT: SINGULAR
  async addEvent(event: IEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.addRawEvent(event)
        .then(async () => {
          resolve(void 0)
        })
        .catch(reject)
    })
  }

  async putEvent(event: IEvent): Promise<void> {
    console.warn('cannot putEvent because there are affects and event is immutable', event)
    return this.addEvent(event)
  }

  async getEvent(id: string): Promise<IEvent | null> {
    try {
      const event = await this.idb.events.get(id) as IEvent;
      return event || null;
    } catch (error) {
      console.error(`DexieAdapter getEvent error for id ${id}:`, error);
      return null;
    }
  }

  async eventExists(id: string): Promise<boolean> {
    try {
      const event = await this.idb.events.get(id);
      return !!event;
    } catch (error) {
      console.error(`DexieAdapter eventExists error for id ${id}:`, error);
      return false;
    }
  }
  async deleteEvent(id: string): Promise<void> {
    try {
      await this.idb.events.delete(id);
    } catch (error) {
      console.error(`DexieAdapter deleteEvent error for id ${id}:`, error);
      throw error;
    }
  }

  //EVENTS: PLURAL
  async clearEvents(): Promise<void> {
    try {
      await this.idb.events.clear();
    } catch (error) {
      console.error('DexieAdapter clearEvents error:', error);
      throw error;
    }
  }

  /*events*/
  // Basic CRUD operations for monitors`
  async addMonitor(monitor: IEvent): Promise<void> { 
    return new Promise((resolve, reject) => {
      this.idb.monitors.add(monitor)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async putMonitor(monitor: IEvent): Promise<void> { 
    return new Promise((resolve, reject) => {
      this.idb.monitors.put(monitor)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async patchMonitor(monitor: Partial<IMonitor>): Promise<void> { 
    return new Promise((resolve, reject) => {
      this.idb.monitors.update(monitor.id, monitor)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async getMonitor(params: GetMonitorParameters, resultKeys: MonitorResultKeys = defaultMonitorResultKeys): Promise<MonitorResult> { 
    const result: MonitorResult = {}
    const { monitorPubkey: pubkey } = params
    const kinds: number[] = []

    if(resultKeys.length === 0) {
      console.warn('getMonitor called with no resultKeys')
      return result;
    }

    return new Promise((resolve, reject) => {
      this.idb.monitors.where(params).toArray()
        .then((monitors: IMonitor[]) => {
          for(const monitor of monitors){
            result.record = monitor
          }
        })
        .catch(reject)
      if(resultKeys.includes('registration')) {
        kinds.push(10166)
      }
      if(resultKeys.includes('profile')) {
        kinds.push(0)
      }
      if(resultKeys.includes('relayList')) {
        kinds.push(10002)
      }
      if(kinds.length > 0) {
        const collection = 
          this.idb.events
            .where('pubkey').equals(pubkey)
            .and( (event: IEvent) => {
              kinds.includes(event.kind) 
            })
        const events: IEvent[] = collection.toArray()
        for(const event of events){
          if(event.kind === 10166){
            result.registration = event
          }
          if(event.kind === 0){
            result.profile = event
          }
          if(event.kind === 10002){
            result.relayList = event
          }
        }
      }
      if(!resultKeys.includes('record')){
        delete result.record
      }
      resolve(result)
    })
  }

  async getMonitors(params: GetMonitorsParameters, resultKeys: MonitorResultKeys = defaultMonitorResultKeys): Promise<MonitorsResult> {
    const result: MonitorsResult = {}  
    const kinds: number[] = []

    if(resultKeys.length === 0) {
      console.warn('getMonitors called with no resultKeys')
      return result;
    }

    if(resultKeys.includes('registration')) {
      kinds.push(10166)
    }

    if(resultKeys.includes('profile')) {
      kinds.push(0)
    }

    if(resultKeys.includes('relayList')) {
      kinds.push(10002)
    }

    return new Promise((resolve, reject) => {
      this.idb.monitors.where(params).toArray()
        .then((monitors: IMonitor[]) => {
          for(const monitor of monitors){
            result[monitor.id] = {} as MonitorResult
            result[monitor.id].record = monitor
          }
        })
        .catch(reject)
      if(resultKeys.includes('registration') || resultKeys.includes('profile') || resultKeys.includes('relayList')) {
        this.idb.events
            .where('kinds').anyOf(kinds)
            .and( (event: IEvent) => Object.keys(result).includes(event.pubkey) )
          .toArray()
          .then((events: IEvent[]) => {
            for(const event of events){
              const { pubkey } = event
              // if( !result?.[pubkey] ) {
              //   result[pubkey] = {} as MonitorResult
              // }
              if(event.kind === 0){
                result[pubkey].profile = event;
                continue;
              }
              if(event.kind === 10002){
                result[pubkey].relayList = event;
                continue;
              }
              if(event.kind === 10166){
                result[pubkey].registration = event;
                continue;
              }
            }
          })
          .catch(reject)
      }
      if(!resultKeys.includes('record')){
        delete result.record
      }
      resolve
    })
  }

  async deleteMonitor(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.deleteMonitor(id)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async deleteMonitors(ids: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<void>[] = []
      for(const id of ids){
        promises.push(this.deleteMonitor(id))
      }
      Promise.allSettled(promises)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async clearMonitors(): Promise<void> {
    try {
      await this.idb.monitors.clear();
    } catch (error) {
      console.error('DexieAdapter clearMonitors error:', error);
      throw error;
    }
  }

  async addRelay(relay: DexieWorker): Promise<void> {

  }

  async putRelay(relay: DexieWorker): Promise<void> {

  }

  async patchRelay(relay: Partial<DexieWorker>): Promise<void> {

  }

  async updateRelay(relay: DexieWorker): Promise<void> {
    
  }

  async getRelay(relay: string, resultKeys: RelayResultKeys = defaultRelayResultKeys): Promise<RelayResult> {
    return new Promise( async (resolve, reject) => {
      const result: RelayResult = {}
      if(resultKeys.includes('record')) {
        result.record = await this.idb.relays.get(relay)
      }
      if(resultKeys.includes('checkRecords')) {
        result.checkRecords = await this.idb.events.where({ relay }).toArray()
      }
      if(resultKeys.includes('checks')) {
        result.checks = await this.idb.events.where({ relay }).toArray()
      }
      resolve(result)
    })
  }
  
  async getRelays(params: GetRelaysParameters, resultKeys: RelayResultKeys = defaultRelayResultKeys): Promise<RelaysResult> { 
    const result: RelaysResult = {}

    if(resultKeys.length === 0) {
      console.warn('getRelays called with no resultKeys')
      return result;
    }

    return new Promise((resolve, reject) => {
      this.idb.relays.where(params).toArray()
        .then((relays: IRelay[]) => {
          for(const relay of relays){
            if(! result?.[relay.relay] ) {
              result[relay.relay] = {} as RelayResult
            }
            result[relay.relay].record = relay
          }
        })
        .catch(reject)
      if(resultKeys.includes('checkRecords') || resultKeys.includes('checks')) {
        this.idb.checks.where('relay').anyof(Object.values(result).map(r => r.record.relay)).toArray()  
          .then((events: IEvent[]) => {
            for(const event of events){
              const relay = event.tags.find(t => t[0] === 'd')?.[1]
              if( !relay ) {
                console.warn('no relay[d tag] found for event', event.id)
                continue;
              }
              if( !result?.[relay] ) {
                result[relay] = {} as RelayResult
              }
              if(! result[relay].checkRecords ) {
                result[relay].checkRecords = []
              }
              result[relay].checkRecords.push(event)
            }
          })
          .catch(reject)
      }
      if(resultKeys.includes('checks')) {
        const events = this.idb.events.toArray()
        for(const event of events){
          const relay = event.tags.find((t: string[]) => t[0] === 'd')?.[1]
          if( !relay ) {
            console.warn('no relay[d tag] found for event', event.id)
            continue;
          }
          if( !result?.[relay] ) {
            result[relay] = {} as RelayResult
          }
          if(! result[relay].checks ) {
            result[relay].checks = []
          }
          result[relay].checks.push(event)
        }
      } 
      if(!resultKeys.includes('record')){
        delete result.record
      }
      if(!resultKeys.includes('checkRecords')){
        delete result.checkRecords
      }
      resolve(result)
    })
  }

  async deleteRelay(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.relays.delete(id)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async deleteRelays(ids: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const promises: Promise<void>[] = []
      for(const id of ids){
        promises.push(this.deleteRelay(id))
      }
      Promise.allSettled(promises)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }
  
  async clearRelays(): Promise<void> {
    try {
      await this.idb.relays.clear();
    } catch (error) {
      console.error('DexieAdapter clearRelays error:', error);
      throw error;
    }
  }

  // checks
  async addCheck(event: IEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.addRawCheck(event)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async putCheck(event: IEvent): Promise<void> {
    console.warn('cannot putCheck because there are affects and event is immutable', event)
    return this.addCheck(event)
  }

  async getCheck(params: GetCheckParameters, resultKeys: CheckResultKeys = defaultCheckResultKeys): Promise<CheckResult | null> {
    const result: CheckResult = {}

    if(!resultKeys.length) {
      console.warn('getCheck called with no resultKeys')
      return result;
    }

    return new Promise((resolve, reject) => {
      this.idb.checks.where(params).first()
        .then((check: IEvent) => {
          result.record = check
        })
        .catch(reject)
      if(!result?.record) {
        console.warn('no check found for params', params)
        resolve(null)
      }
      if(resultKeys.includes('check')) {
        const { nid } = result.record
        result.check = this.idb.checks.where({ nid }).first()
      }
      if(!resultKeys.includes('record')){
        delete result.record
      }
      resolve(result)
    })
  }

  async getChecks(params: GetChecksParameters, resultKeys: CheckResultKeys = defaultCheckResultKeys): Promise<ChecksResult> {
    const result: ChecksResult = {}
    const ids: Set<string> = new Set()
    const lt: [keyof ICheck, number][] = [];
    const gt: [keyof ICheck, number][] = [];

    if(!resultKeys.length) {
      console.warn('getChecks called with no resultKeys')
      return result;
    }

    if(params.created_at) {
      gt.push(['created_at', params.created_at])
      delete params.created_at
    }

    if(params.rtt) {
      gt.push(['rtt', params.rtt])
      delete params.rtt
    }

    return new Promise((resolve, reject) => {
      this.idb.checks
        .where(params)
        .filter((check: ICheck) => this.ltgt(check, lt, gt))
        .toArray()
        .then((checkRecords: ICheck[]) => {
          for(const check of checkRecords){
            const { nid, relay } = check 
            if(ids.has(nid)){ 
              result[relay] = {} as CheckResult
              result[relay].record = check
              ids.add(nid)
            }
          }
        })
        .catch(reject)
      if(resultKeys.includes('check')) {
        const checks = this.idb.checks.where('nid').anyOf(Array.from(ids)).toArray()
        for(const check of checks){
          result[check.nid].check = check
        }
      }
      if(!resultKeys.includes('record')){
        delete result.records
      }
      resolve(result)
    })
  }

  ltgt(check: ICheck, lt: [keyof ICheck, number][], gt: [keyof ICheck, number][]): boolean {
    const results: boolean[] = [true];
    if (gt.length) {
      results.push(
        gt.every(([key, value]) => {
          const v = check?.[key]; 
          if(typeof v !== 'number') return true
          return v > value;
        })
      );
    }
    if (lt.length) {
      results.push(
        lt.every(([key, value]) => {
          const v = check?.[key]; 
          if(typeof v !== 'number') return true
          return v < value;
        })
      );
    }
    return results.every(Boolean);
  }

  async deleteCheck(checkParameters: GetCheckParameters): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.deleteCheck(checkParameters)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async deleteChecks(checkParameters: GetCheckParameters): Promise<void> {
    return new Promise((resolve, reject) => {
      this.idb.deleteChecks(checkParameters)
        .then(() => resolve(void 0))
        .catch(reject)
    })
  }

  async clearChecks(): Promise<void> {
    try {
      await this.idb.checks.clear();
    } catch (error) {
      console.error('DexieAdapter clearChecks error:', error);
      throw error;
    }
  }
}

export default DexieAdapter