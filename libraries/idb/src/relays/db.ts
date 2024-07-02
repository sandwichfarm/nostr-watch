import Dexie, { Table, Middleware, DBCoreTable, DBCoreMutateRequest, DBCoreGetRequest, DBCoreMutateResponse } from 'dexie';
import { IRelay, ICheck, IEvent, IGlobalRtt, INip11, ISsl } from './tables';
import nostrEventToRelayDb from './transform';
import { NDKRelayMeta } from '@nostr-dev-kit/ndk';
import { IGeoCode } from 'src/shared/tables';

const devnull = () => {}

import * as fastq from "fastq";
import type { queueAsPromised } from "fastq";

const queue: queueAsPromised<()=>{}> = fastq.promise(worker, 1)

async function worker (cb: () => {}): Promise<void> {
    cb()
    // console.log('added from worker')
}

export class RelayDb extends Dexie {
  static NAME: string = 'RelayDb'
  readonly VERSION: number = 1;

  relays!: Table<IRelay, string>;
  checks!: Table<ICheck, string>;
  pastChecks!: Table<ICheck, string>;
  nip11s!: Table<INip11, string>;
  geocodes!: Table<IGeoCode, number>;
  globalRtts!: Table<IGlobalRtt, string>;
  ssls!: Table<ISsl, string>;
  events!: Table<IEvent, string>;

  static indices: Record<string, string> = {
    relays: `&relay, lastSeen`,

    checks: `[relay+monitorPubkey], [software+version], 
            nid,
            relay, monitorPubkey, operatorPubkey,
            network, category,
            open, geohash, paymentRequired, authRequired,
            validTo,
            ipv4, isp,
            *geocode, *supportedNips,
            createdAt`,

    nip11s: `[relay+monitorPubkey], monitorPubkey, hash, json`,

    events: `nid, relay, monitorPubkey, kind, createdAt`,

    geocodes: `code, [type+format+type+length], [type+format+type],[type+format], type, format, length`,

    ssls: `relay, monitorPubkey, hash, nid`

    // globalRtts: `&relay, *monitorPubkeys, operatorPubkey, 
    //                 avgAll, avgOpen, avgRead, avgWrite, 
    //                 createdAt`
  };

  constructor() {
    super(RelayDb.NAME);

    try {
      this.version(this.VERSION).stores(RelayDb.indices);
    } catch (error) {
      console.error("Error setting up the database schema:", error);
      Object.entries(RelayDb.indices).forEach(([table, index]) => {
        try {
          this.version(this.VERSION).stores({ [table]: index });
        } catch (innerError) {
          console.error(`Error setting up index for table "${table}" with index "${index}":`, innerError);
        }
      });
    }

    this.open().then(() => {
      console.log('Database opened successfully');
      console.log('Tables:', this.tables.map(table => table.name));
    }).catch((err) => {
      console.error("Failed to open db: " + err.stack || err);
    });

    // this.use({
    //   stack: 'dbcore',
    //   create: (downlevelDatabase) => {
    //     return {
    //       ...downlevelDatabase,
    //       table: (name) => {
    //         const downlevelTable = downlevelDatabase.table(name);
    //         return {
    //           ...downlevelTable,
    //           mutate: async (req) => {
    //             //console.log(`Mutate called on table ${name} with request:`, req);
    //             // req = await this.beforeMutate(name, req)
    //             const result = await downlevelTable.mutate(req);
    //             //console.log(`Mutation result for table ${name}:`, result);
    //             await this.afterMutate(name, req);
    //             return result;
    //           }
    //         };
    //       }
    //     };
    //   }
    // });
  }

  static defaults<T>(): { [K in keyof T]: T[K] | null } {
    const defaultObject = {} as { [K in keyof T]: T[K] | null };
    Object.keys(defaultObject).forEach(key => {
      defaultObject[key as keyof T] = null as any;
    });
    return defaultObject;
  }

  async beforeMutate(tableName: string, req: DBCoreMutateRequest): Promise<DBCoreMutateRequest> {
    // console.log(`beforeMutate called for table ${tableName} with request:`, req);
    try {
      if (tableName === 'checks') {
        req = await this.handleChecksBeforeMutate(req).catch(console.error);
      }
      if (tableName === 'relays') {
        req = await this.handleRelaysBeforeMutate(req).catch(console.error);
      }
    } catch (error) {
      console.error(`Error in beforeMutate for table ${tableName}:`, error);
    }
    return req
  }

  async afterMutate(tableName: string, req: DBCoreMutateRequest) {
    // console.log(`afterMutate called for table ${tableName} with request:`, req);
    try {
      if (tableName === 'events') {
        // console.log('Handling events ');
        await this.handleEventsAfterMutate(req);
      }
      if (tableName === 'checks') {
        await this.handleChecksAfterMutate(req);
      }
      if (tableName === 'relays') {
        await this.handleRelaysAfterMutate(req);
      }
    } catch (error) {
      console.error(`Error in afterMutate for table ${tableName}:`, error);
    }
  }


  async handleEventsAfterMutate(req: DBCoreMutateRequest) {
    if (req.type === 'add' || req.type === 'put') {
      for (const event of req.values) {
        const { event: nostrEvent } = event;
        const { check, relay, nip11, geocodes, ssl } = await nostrEventToRelayDb(nostrEvent);
        if (relay) queue.push( (): void => { this.relays.add(relay).catch( () => console.warn(`${relay.relay} already exists`)) })
        if (check) queue.push( (): void => { this.checks.put(check) })
        // Dexie.waitFor(async () => {
        //   const promises = [];
          
        //   // if (nip11) promises.push(this.nip11s.put(nip11));
        //   // if (geocodes?.length) promises.push(this.geocodes.bulkPut(geocodes).catch(devnull));
        //   // if (ssl) promises.push(this.ssls.put(ssl));
        //   await Promise.all(promises);
        // });
      }
    }

    if (req.type === 'delete') {
      for (const key of req.keys) {
        const oldEvent = await this.events.get(key);
        if (!oldEvent) return;
        const { event: nostrEvent } = oldEvent;
        const { check } = await nostrEventToRelayDb(nostrEvent);

        Dexie.waitFor(async () => {
          const promises = [];
          if (check) {
            const { nid } = check;
            promises.push(this.checks.delete(nid));
            promises.push(this.pastChecks.delete(nid));
          }
          await Promise.all(promises);
        });
      }
    }
  }
  async handleRelaysBeforeMutate(req: DBCoreMutateRequest): Promise<DBCoreMutateRequest> {
    // if (req.type === 'add' || req.type === 'put') {
    //   for (const relay of req.values) {
    //     const { relay: relayKey, lastSeen } = relay;
    //     const transaction = Dexie.currentTransaction;
    //     if (transaction) {
    //       const existingRelay = await this.relays.get(relayKey);
    //       if (existingRelay && existingRelay.lastSeen < lastSeen) {
    //         req.values = req.values.map(value => ({
    //           ...value,
    //           createdAt: lastSeen
    //         }));
    //       }
    //     } else {
    //       console.error('No current transaction found for handleRelaysAfterMutate');
    //     }
    //   }
    // }
    return req
  }

  async handleRelaysAfterMutate(req: DBCoreMutateRequest) {
    // if (req.type === 'add' || req.type === 'put') {
    //   for (const relay of req.values) {
    //     const { relay: relayKey, lastSeen } = relay;
    //     const transaction = Dexie.currentTransaction;
    //     if (transaction) {
    //       transaction.on('complete', async () => {
    //         const existingRelay = await this.relays.get(relayKey);
    //         if (existingRelay && existingRelay.lastSeen < lastSeen) {
    //           await this.relays.where({ relay: relayKey }).modify({ lastSeen });
    //         }
    //       });
    //     } else {
    //       console.error('No current transaction found for handleRelaysAfterMutate');
    //     }
    //   }
    // }

    if (req.type === 'delete') {
      const transaction = Dexie.currentTransaction;

      if (transaction) {
        transaction.on('complete', async () => {
          for (const key of req.keys) {
            const promises = [];
            promises.push(this.checks.where({ relay: key }).delete());
            promises.push(this.pastChecks.where({ relay: key }).delete());
            promises.push(this.globalRtts.where({ relay: key }).delete());
            promises.push(this.events.where({ relay: key }).delete());
            await Promise.all(promises);
          }
        });
      } else {
        console.error('No current transaction found for handleRelaysAfterMutate delete');
      }
    }
  }

  async handleChecksBeforeMutate(req: DBCoreMutateRequest): Promise<DBCoreMutateRequest>{
    // if (req.type === 'add' || req.type === 'put') {
    //   for (const check of req.values) {
    //     const { createdAt: lastSeen, relay, monitorPubkey, nid } = check;
    //     const checksToProcess = await this.checks
    //           .where({ relay, monitorPubkey })
    //           .and(existingCheck => existingCheck.nid !== check.nid)
    //           .toArray();
    //     if(!checksToProcess.length) return req;
    //     await Promise.all(checksToProcess.map(async (existingCheck) => { 
    //         await this.checks.delete(existingCheck.nid)
    //       })
    //     );
    //   }
    // }
    return req
  }

  async handleChecksAfterMutate(req: DBCoreMutateRequest) {
    // if (req.type === 'add' || req.type === 'put') {
    //   for (const check of req.values) {
    //     const transaction = Dexie.currentTransaction;
    //     const { createdAt: lastSeen, relay, monitorPubkey, nid } = check;
    //     if (transaction) {
    //       transaction.on('complete', async () => {
    //         const lastSeenExisting = (await this.relays.get(relay))?.lastSeen
    //         if(lastSeenExisting && (lastSeen > lastSeenExisting) ) await this.relays.where({ relay }).modify({ lastSeen });
    //       });
    //     } else {
    //       console.error('No current transaction found for handleChecksAfterMutate');
    //     }
    //   }
    // }

    if (req.type === 'delete') {
      const transaction = Dexie.currentTransaction;

      if (transaction) {
        transaction.on('complete', async () => {
          for (const key of req.keys) {
            const oldCheck = await this.checks.get(key);
            if (!oldCheck) return;
            await this.pastChecks.put(oldCheck);
          }
        });
      } else {
        console.error('No current transaction found for handleChecksAfterMutate delete');
      }
    }
  }
}

const db: RelayDb = new RelayDb();

db.open()

export default db;
