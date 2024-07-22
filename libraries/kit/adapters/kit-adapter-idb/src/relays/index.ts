import NDK, { NDKEvent, NDKRelayMeta, RelayMetaSet } from "@nostr-dev-kit/ndk";
import { KitCacheRelayMetaInterface } from "@nostrwatch/kit";
import { ICheck, IEvent, INip11, IRelay, ISsl, relayDb, RelayDb, relayMetaToIEvent, RelayTransform } from "@nostrwatch/idb";
import murmurhash from "murmurhash";

import * as fastq from "fastq";
import type { queueAsPromised } from "fastq";
import { IGeoCode } from "@nostrwatch/idb/src/shared/tables";

const setQueue: queueAsPromised<IEvent> = fastq.promise(setWorker, 10)

async function setWorker (event: IEvent): Promise<void> {
    let err = false 
    
    const onErr = () => { 
        err = true
        console.error('Error setting monitor data', err)
    }
    await relayDb.events.put(event).catch(onErr)
}

export class RelayCacheIdbAdapter implements KitCacheRelayMetaInterface {

    db: RelayDb;
    ndk: NDK | undefined;

    constructor(ndk?: NDK) {   
        //console.log('RelayCacheIdbAdapter constructor')  
        this.db = relayDb;
        this.ndk = ndk 
    }

    async set( relayMetaEvent: NDKRelayMeta ): Promise<boolean> {
      let err = false 
    
      const onErr = () => { 
          err = true
          console.error('Error setting monitor data', err)
      }
      // console.log('adding from worker')
      await relayDb.events.put(relayMetaToIEvent( relayMetaEvent )).catch(onErr)

      return !err
      // const record = relayMetaToIEvent( relayMetaEvent )
      // await setQueue.push(record).catch((err) => console.error(err))
      // return true
    }

    async get( relay: string, monitorPubkey: string ): Promise<NDKRelayMeta | undefined> {
      const rid = murmurhash.v3( relay )
      const event = await this.db.events.get({rid, monitorPubkey})
      return new NDKRelayMeta(this.ndk, event?.event)
    }

    async list(relay: string): Promise<NDKRelayMeta[] | undefined> {
      const rid = murmurhash.v3( relay )
      const events = await this.db.events.where({rid}).toArray()
      return events.map( ( event ) => new NDKRelayMeta(this.ndk, event.event))
    }

    async remove( relay: string ): Promise<boolean> {
      const rid = murmurhash.v3( relay )
      return (await this.db.events.where({rid}).delete())? true : false
    }

    async keys(): Promise<Set<string>> {
      const keys = (await this.db.relays.toArray())?.map(relay => relay.relay)
      return new Set(keys)
    }

    async load( relayMetaEvents: RelayMetaSet ): Promise<Record<string, number>> {
      let monitorPubkey: string | undefined;
      const begin = Date.now()
      if(!relayMetaEvents) return;
      //console.log(`load(): loading ${relayMetaEvents.size} relays`)
      const promises: Promise<boolean>[] = [] 
      const iEvents: IEvent[] = []
      Array.from(relayMetaEvents).forEach((meta: NDKRelayMeta) => { 
        promises.push(this.set(meta))
        iEvents.push( relayMetaToIEvent( meta ) )
        if(!monitorPubkey) monitorPubkey = meta.pubkey
      })
      await Promise.allSettled(promises)

      await new Promise( resolve => setTimeout(resolve, 1000) )

      console.log(`processing ${iEvents.length} events`)

      return await updateRelayData(iEvents)

      console.log(`${relayMetaEvents?.size} loaded. Took ${Math.round((Date.now() - begin)/1000)} seconds.`)
    }

    async dump(monitorPubkey: string): Promise<RelayMetaSet> {
        const ievents: IEvent[] = (await this.db.events.toArray())
        const metas: NDKRelayMeta[] = ievents.map( ( meta ) => new NDKRelayMeta(this.ndk, meta.event))
        return new Set(metas) as RelayMetaSet
    }

    async reset(): Promise<void> {
      await Promise.allSettled([
        this.db.relays.clear(),
        this.db.checks.clear(),
        this.db.pastChecks.clear(),
        this.db.events.clear()
      ])
    }
}

export const updateRelayData = async (events: IEvent[]) => {
  const stats: Record<string, number> = {}
  const t = tables(events)
  for(let i = 0; i < t.length; i++) {
    const table = t[i]
    const {tableName, transformProperty, events} = table
    stats[tableName] = await populateData(tableName as keyof RelayDb, transformProperty as keyof IdbReadyRelayData, events)
  }
  return stats
}

const tables = (events: IEvent[]) => {
  return [
    {
      tableName: 'relays',
      transformProperty: 'relay',
      events 
    },
    {
      tableName: 'checks', 
      transformProperty: 'check',
      events 
    },
    {
      tableName: 'nip11s', 
      transformProperty: 'nip11',
      events 
    },
    {
      tableName: 'ssls', 
      transformProperty: 'ssl',
      events 
    }
  ]
} 


interface IdbReadyRelayData {
  event?: IEvent;
  relay?: IRelay;
  check?: ICheck;
  ssl?: ISsl;
  geocodes?: IGeoCode;
  nip11?: INip11;
}


// interface RelayDb {
//   [tableName: string]: {
//     put: (item: any) => Promise<void>;
//   };
// }

interface TableOperations<T> {
  put: (item: T) => Promise<void>;
  bulkPut: (items: T[]) => Promise<void>;
}

// interface RelayDb {
//   ssls: TableOperations<ISsl>;
//   geocodes: TableOperations<IGeoCode>;
//   relays: TableOperations<IRelay>;
//   checks: TableOperations<ICheck>;
//   events: TableOperations<IEvent> & {
//     where: (criteria: object) => { toArray: () => Promise<any[]> };
//     put: (item: IEvent) => Promise<void>;
//   };
// }

// Generic function to populate a database table from event data
export const populateData = async <T extends keyof RelayDb>(
  tableName: T,
  transformProperty: keyof IdbReadyRelayData,  // Adjust if the property name needs to be dynamic
  events: IEvent[]
): Promise<number> => {
  let mostRecent = 0;

  events.forEach( async (event) => {
    const timestamp = await processEvent(event, tableName, transformProperty)
    if (timestamp && timestamp > mostRecent) {
      mostRecent = timestamp;
    }
  })
  return mostRecent;
};

export const processEvent = async <T extends keyof RelayDb>(event: IEvent, tableName: T, transformProperty: keyof IdbReadyRelayData): Promise<number> => {
  const data = await RelayTransform(event.event);
  const item = data[transformProperty] as any;  // Cast to any if specific typing is not feasible
  if (item) {
    console.log(`adding ${String(transformProperty)} ${item.nid}`);
    if(item instanceof Array) {
      relayDb[tableName].bulkPut(item);
      // console.log('finished bulk put', tableName, transformProperty)
    }
    else {
      relayDb[tableName].put(item);
      // console.log('finished put', tableName, transformProperty)
    }
    return item.createdAt;
  }
}