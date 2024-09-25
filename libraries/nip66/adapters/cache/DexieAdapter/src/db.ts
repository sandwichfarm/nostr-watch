import Dexie, { Table } from 'dexie';

import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from './models/index'


export interface IRelayDb {
  monitors: Table<IMonitor, string>;
  events: Table<IEvent, string>;
  relays: Table<IRelay, string>;
  checks: Table<ICheck, string>;
  pastChecks: Table<ICheck, string>;
  nip11s: Table<INip11, string>;
  geocodes: Table<IGeocode, number>;

  init(): Promise<Table<any, any, any>[]>;

  addMonitor(monitor: IMonitor): Promise<void | undefined>;
  removeMonitor(monitorPubkey: string): Promise<void | undefined>;
  
  addCheck(check: ICheck, relayRecord: IRelay): Promise<void | undefined>;
  removeCheck(check: ICheck): Promise<void | undefined>;

  removeRelay(relay: string): Promise<void | undefined>;

  addNip11(nip11: INip11): Promise<void | undefined>;
  removeNip11(params: { relay?: string, monitorPukey: string, hash: string }): Promise<void | undefined>;
  removeNip11ByRelay(relay: string): Promise<void | undefined>;
  removeNip11ByMonitorPubkey(monitorPubkey: string): Promise<void | undefined>;
  removeNip11ByHash(hash: string): Promise<void | undefined>;

  addGeocodes(geocodes: IGeocode[]): Promise<void>;
}

export class RelayDb extends Dexie implements IRelayDb {
  static NAME: string = 'RelayDb'
  readonly VERSION: number = 1;

  monitors!: Table<IMonitor, string>;
  events!: Table<IEvent, string>;
  relays!: Table<IRelay, string>;
  checks!: Table<ICheck, string>;
  pastChecks!: Table<ICheck, string>;
  nip11s!: Table<INip11, string>;
  geocodes!: Table<IGeocode, number>;

  static indices: Record<string, string> = {
    events: `id, pubkey, kind, created_at`,
    monitors: '&id, eventId, frequency, lastActive, geohash',
    relays: '&relay, lastSeen',
    checks: `[monitorPubkey+relay], [software+version], 
      nid,
      relay, monitorPubkey,
      network, 
      relayType,
      rtt, 
      paymentRequired, authRequired,
      validTo,
      ipv4, isp,
      *geohash,
      *geocode, 
      *supportedNips,
      created_at`,
    pastChecks: `&relay, monitorPubkey, nid`,
    nip11s: `[relay+monitorPubkey+hash], relay, monitorPubkey, hash`,
    geocodes: `&code, [type+format+length], [type+format+type],[type+format], type, format, length`,
    ssls: `&relay, monitorPubkey, hash, nids`
  };

  constructor(dbName: string = RelayDb.NAME) {
    super(dbName);
    try {
      this.version(this.VERSION).stores(RelayDb.indices);
    } catch (error) {
      console.error("Error setting up the database schema:", error);
      // Object.entries(RelayDb.indices).forEach(([table, index]) => {
      //   try {
      //     this.version(this.VERSION).stores({ [table]: index });
      //   } catch (innerError) {
      //     console.error(`Error setting up index for table "${table}" with index "${index}":`, innerError);
      //   }
      // });
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

  // MONITORS

  async addMonitor( monitor: IMonitor ): Promise<void | undefined> {
    await this.monitors.put(monitor);
  }

  async removeMonitor( monitorPubkey: string ): Promise<void | undefined> {
    await this.events.where({ pubkey: monitorPubkey }).delete();
    await this.monitors.where({ id: monitorPubkey }).delete();
    await this.checks.where({ monitorPubkey }).delete();
    await this.pastChecks.where({ monitorPubkey }).delete();
  }

  // CHECKS 

  async addCheck( check: ICheck, relayRecord: IRelay ): Promise<void | undefined> {
    const { created_at, relay, monitorPubkey } = check;
    const existingChecks = await this.checks
          .where({ relay, monitorPubkey })
          .and(existingCheck => existingCheck.nid !== check.nid)
          .toArray();
    await Promise.all(existingChecks.map(async (existingCheck) => {
        await this.pastChecks.add(existingCheck)
      })
    );
    await Promise.all(existingChecks.map(async (existingCheck) => { 
        await this.checks.where({ nid: existingCheck.nid }).delete()
      })
    );
    const existingRelay = await this.relays.get(relay);
    if(!existingRelay) {
      await this.relays.put(relayRecord);
    }
    else {
      const checkIsNewer = existingRelay.lastSeen < created_at;
      if (checkIsNewer) {
        existingRelay.lastSeen = created_at;
        await this.relays.put(existingRelay);
      }
    }
  }
  
  async removeCheck( check: ICheck ): Promise<void | undefined> {
    const { relay, monitorPubkey, nid } = check;
    const existingCheck = await this.checks.get(nid);
    if(!existingCheck) return;
    await this.pastChecks.add(existingCheck);
    await this.checks.delete(nid);
  }

  // RELAYS

  async removeRelay( relay: string ): Promise<void | undefined> {
    await this.relays.delete(relay);
  }

  async addNip11(nip11: INip11): Promise<void | undefined> {
    await this.nip11s.put(nip11);
  }

  async removeNip11( params:{ relay?: string, monitorPukey: string, hash: string }): Promise<void | undefined> {
    await this.nip11s.where(params).delete();
  }

  async removeNip11ByRelay(relay: string): Promise<void | undefined> {
    await this.nip11s.where({ relay }).delete();
  }

  async removeNip11ByMonitorPubkey(monitorPubkey: string): Promise<void | undefined> {
    await this.nip11s.where({ monitorPubkey }).delete();
  }

  async removeNip11ByHash(hash: string): Promise<void | undefined> {
    await this.nip11s.where({ hash }).delete();
  }

  async addGeocodes(geocodes: IGeocode[]): Promise<void> {
    if(!geocodes.length) return;
    for(const geocode of geocodes){
      this.geocodes.add(geocode).catch(console.warn)
    }
  }
}







// import Dexie from 'dexie';
// // import { IEvent, IMonitor, IRelay, ICheck, INip11, IGeocode } from './models/index'

// export const defaults = <T>(): { [K in keyof T]: T[K] | null } => {
//   const defaultObject = {} as { [K in keyof T]: T[K] | null };
//   Object.keys(defaultObject).forEach(key => {
//     defaultObject[key as keyof T] = null as any;
//   });
//   return defaultObject;
// }

// export default ( dbName: string = 'relays', version: number = 1 ) => {
//   const db = new Dexie(dbName);
  
//   db.version(version).stores({
//     events: `id, pubkey, tags, kind, created_at`,
//     monitors: '&id, eventId, frequency, lastActive, geohash',
//     relays: '&relay, last_seen',
//     checks: `[relay+monitorPubkey], [software+version], 
//       nid,
//       relay, monitorPubkey, operatorPubkey,
//       network, 
//       relayType,
//       open, 
//       paymentRequired, authRequired,
//       validTo,
//       ipv4, isp,
//       *geohash,
//       *geocode, 
//       *supportedNips,
//       created_at`,
//     nip11s: `[relay+monitorPubkey], monitorPubkey, hash`,
//     geocodes: `&code, [type+format+length], [type+format+type],[type+format], type, format, length`,
//     ssls: `&relay, monitorPubkey, hash, nid`
//   });

//   return {
//     db,
//     events: db.table('events') as Dexie.Table<IEvent, string>,
//     monitors: db.table('monitors') as Dexie.Table<IMonitor, string>,
//     relays: db.table('relays') as Dexie.Table<IRelay, string>,
//     checks: db.table('checks') as Dexie.Table<ICheck, string>,
//     nip11s: db.table('nip11s') as Dexie.Table<INip11, string>,
//     geocodes: db.table('geocodes') as Dexie.Table<IGeocode, string>
//   };
// }
