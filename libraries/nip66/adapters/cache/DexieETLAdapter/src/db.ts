import Dexie from 'dexie';
import type { Table } from 'dexie';
import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from '@nostrwatch/nip66/models';
import { transform30166, transform10166,  } from '@nostrwatch/nip66/transform';
import { delay } from '@nostrwatch/utils';
import PQueue from 'p-queue';
import { TransformEvent } from '@nostrwatch/nip66/transform';

const devnull = () => {}

export interface IRelayDb {
  monitors: Table<IMonitor, string>;
  events: Table<IEvent, string>;
  relays: Table<IRelay, string>;
  checks: Table<ICheck, string>;
  pastChecks: Table<ICheck, string>;
  nip11s: Table<INip11, string>;
  geocodes: Table<IGeocode, number>;

  init(): Promise<Table<any, any, any>[]>;

  addEvent(event: IEvent): Promise<void | undefined>; 

  addRawEvent(event: IEvent): Promise<void | undefined>;

  addRawMonitor(event: IEvent): Promise<void | undefined>;
  addMonitor(monitor: IMonitor): Promise<void | undefined>;
  deleteMonitor(monitorPubkey: string): Promise<void | undefined>;
  
  addRawCheck(event: IEvent): Promise<void | undefined>;
  addCheck(check: ICheck, relayRecord: IRelay): Promise<void | undefined>;
  deleteCheck(check: ICheck): Promise<void | undefined>;

  deleteRelay(relay: string): Promise<void | undefined>;

  addNip11(nip11: INip11, monitorPubkey: string): Promise<void | undefined>;
  deleteNip11(params: Nip11Parameters ): Promise<void | undefined>;
  deleteNip11ByRelay(relay: string): Promise<void | undefined>;
  deleteNip11ByMonitorPubkey(monitorPubkey: string): Promise<void | undefined>;
  deleteNip11ByHash(hash: string): Promise<void | undefined>;

  addGeocodes(geocodes: IGeocode[]): Promise<void>;
}

interface Nip11Parameters {
  relay?: string;
  monitorPubkey?: string;
  hash?: string;
}

export class RelayDb extends Dexie implements IRelayDb {
  static NAME: string = 'RelayDb'
  readonly VERSION: number = 1;

  private queue: PQueue = new PQueue({concurrency: 1})
  private monitorOrder: string[] = []

  monitors!: Table<IMonitor, string>;
  events!: Table<IEvent, string>;
  relays!: Table<IRelay, string>;
  checks!: Table<ICheck, string>;
  pastChecks!: Table<ICheck, string>;
  nip11s!: Table<INip11, string>;
  geocodes!: Table<IGeocode, number>;

  static indices: Record<string, string> = {
    monitors: '&id, eventId, frequency, checks, lastActive, geohash',
    events: `id, pubkey, kind, created_at`,
    relays: '&relay, network, lastSeen',
    checks: `[monitorPubkey+relay], 
      nid,
      relay, monitorPubkey,
      network, 
      relayType,
      rtt, 
      software,
      version,
      paymentRequired, authRequired,
      validTo,
      isp,
      *geohash,
      *geocode, 
      *supportedNips,
      created_at`,
    pastChecks: `&relay, monitorPubkey, nid`,
    nip11s: `hash, [relay+monitorPubkey+hash], [relay+monitorPubkey]`,
    geocodes: `&code, [type+format+length], [type+format+type],[type+format], type, format, length`,
    ssls: `&relay, monitorPubkey, hash, nids`
  };

  constructor(dbName: string = RelayDb.NAME) {
    super(dbName);
    try {
      this.version(this.VERSION).stores(RelayDb.indices);
    } catch (error) {
      console.error("Error setting up the database schema:", error);
    }
  }

  async init(): Promise<Table<any, any, any>[]> {
    return new Promise( (resolve, reject) => {
      this.open()
        .then(() => {
          const tables = this.tables
          console.log('Database opened successfully');
          console.log('Tables:', tables.map(table => table.name));  
          resolve(tables);
        })
        .catch((err) => {
          console.error("Failed to open db: " + err.stack || err);
          reject(err)
        });
    })
  }

  static defaults<T>(): { [K in keyof T]: T[K] | null } {
    const defaultObject = {} as { [K in keyof T]: T[K] | null };
    Object.keys(defaultObject).forEach(key => {
      defaultObject[key as keyof T] = null as any;
    });
    return defaultObject;
  }

  getMonitorPriority(monitorPubkey: string): number {
    return this.monitorOrder.indexOf(monitorPubkey);
  }

  async eventExists(event: IEvent): Promise<boolean> {
    const { id } = event;
    return this.events.where({ id }).count().then(count => count > 0); 
  }

  async checkExists(check: ICheck): Promise<boolean> {
    const { nid } = check;
    return this.checks.where({ nid }).count().then(count => count > 0);
  }

  async relayExists(relay: string): Promise<boolean> {
    return this.relays.where({ relay }).count().then(count => count > 0);
  }

  async monitorExists(monitor: IMonitor): Promise<boolean> {
    const { id } = monitor;
    return this.monitors.where({ id }).count().then(count => count > 0);
  }

  async nip11Exists(nip11: INip11): Promise<boolean> {
    const { hash } = nip11;
    return this.nip11s.where({hash}).count().then(count => count > 0);
  }

  async geocodeExists(geocode: IGeocode): Promise<boolean> {
    const { code } = geocode;
    return this.geocodes.where({ code }).count().then(count => count > 0);
  }

  async addEvent( event: IEvent ): Promise<void> {
    this.queue.add( async() => {
      const exists = await this.eventExists(event);
      if(exists) return 
      this.events.add(TransformEvent(event)).catch(devnull)
    }, { priority: 60-this.getMonitorPriority(event.pubkey) } )
  }

  async addRawEvent( event: IEvent ): Promise<void | undefined> { 
    if(await this.eventExists(event)) return
    if(event.kind === 10166){
      return this.addRawMonitor(event);  
    }
    if(event.kind === 30166){
      return this.addRawCheck(event);
    }
    this.addEvent(event);
  }

  async addRawCheck(ev: IEvent): Promise<void | undefined> {
    const { check, relay, nip11, event, geocodes } = await transform30166(ev);
    if(!check || !relay) return console.warn('Error transforming RELAY EVENT to check/relay records:', event);
    await this.addEvent(event);
    await this.addCheck(check, relay);
    if(nip11) 
      await this.addNip11(nip11, event.pubkey);
    if(geocodes?.length) {
      await this.addGeocodes(geocodes);
    }
      
  }

  async addRawMonitor(event: IEvent): Promise<void | undefined> {
    const { monitor } = await transform10166(event);
    if(!monitor) return console.warn('Error transforming MONITOR EVENT to check/relay records:', event);
    if(!this.monitorOrder.includes(monitor.id)) this.monitorOrder.push(event.pubkey);
    await this.addMonitor(monitor);
    //await(delay(0));
  }

  // MONITORS
  async addMonitor( monitor: IMonitor ): Promise<void | undefined> {
    if(await this.monitorExists(monitor)) return;
    await this.monitors.add(monitor).catch(devnull);
    //await(delay(0));
  }

  async deleteMonitor( monitorPubkey: string ): Promise<void | undefined> {
    await this.monitors.where({ id: monitorPubkey }).delete();
    await this.events.where({ pubkey: monitorPubkey }).delete();
    await this.checks.where({ monitorPubkey }).delete();
    await this.pastChecks.where({ monitorPubkey }).delete();  
    //await(delay(0));
  }

  // CHECKS
  async addCheck( check: ICheck, relayRecord: IRelay ): Promise<void | undefined> {
    const { created_at, relay, monitorPubkey } = check;

    //populate relays first.
    this.queue.add( async() => {
      const updated = await this.relays.update(relay, (existing: IRelay) => {
        if (existing && existing.lastSeen < created_at) {
          existing.lastSeen = created_at;
          return true;
        }
      });
      if (!updated) {
        await this.relays.put(relayRecord);
      }
    }, { priority: 90-this.getMonitorPriority(monitorPubkey) } )

    //populate checks
    this.queue.add( async() => {
      const existingChecks = await this.checks
        .where({ relay, monitorPubkey })
        .and(existingCheck => existingCheck.nid !== check.nid)
        .toArray();

      // await this.pastChecks.bulkAdd(existingChecks).catch(devnull);
      const nidsToDelete = existingChecks.map(existingCheck => existingCheck.nid);
      await this.checks.bulkDelete(nidsToDelete); 

      await this.checks.add(check).catch(devnull);
      // if (!(await this.checkExists(check))) {
      //   await this.checks.add(check).catch(devnull);
      // }
    }, { priority: 70-this.getMonitorPriority(monitorPubkey) } )
    
  }
  
  async deleteCheck( check: ICheck ): Promise<void | undefined> {
    const { nid } = check;
    const existingCheck = await this.checks.get(nid);
    if(!existingCheck) return;
    await this.pastChecks.add(existingCheck).catch(devnull);
    await this.checks.delete(nid);
    //await(delay(0));
  }

  // RELAYS

  async deleteRelay( relay: string ): Promise<void | undefined> {
    await this.relays.delete(relay);
    //await(delay(0));
  }

  async addNip11(nip11: INip11, monitorPubkey: string): Promise<void | undefined> {
    this.queue.add( async() => {
      if(await this.nip11Exists(nip11)) return 
      await this.nip11s.put(nip11).catch();
    }, { priority: 80-this.getMonitorPriority(monitorPubkey) } )
  }

  async deleteNip11( params: Nip11Parameters ): Promise<void | undefined> {
    await this.nip11s.where(params).delete();
    //await(delay(0));
  }

  async deleteNip11ByRelay(relay: string): Promise<void | undefined> {
    await this.nip11s.where({ relay }).delete();
    //await(delay(0));
  }

  async deleteNip11ByMonitorPubkey(monitorPubkey: string): Promise<void | undefined> {
    await this.nip11s.where({ monitorPubkey }).delete();
    //await(delay(0));
  }

  async deleteNip11ByHash(hash: string): Promise<void | undefined> {
    await this.nip11s.where({ hash }).delete();
    //await(delay(0));
  }

  async addGeocodes(geocodes: IGeocode[]): Promise<void> {
    if(!geocodes?.length) return;
    for(const geocode of geocodes){
      if(await this.geocodeExists(geocode)) continue
      await this.geocodes.add(geocode).catch(console.warn)
    }
  }
}