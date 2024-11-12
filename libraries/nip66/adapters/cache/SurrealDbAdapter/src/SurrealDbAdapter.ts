import { CacheAdapter } from '@nostrwatch/nip66/core';

import type { 
    ICacheAdapter, 
    AdapterWorkerMessage
  } from '@nostrwatch/nip66/core';

import RelayDb from './db';

import { applyMixins } from '@nostrwatch/nip66/utils';
import { SurrealDbMethods } from './SurrealDbMethods';
// import { SurrealDbWorkerResult } from './SurrealDbWorker';

//@ts-ignore: it's an import.
import SurrealWorker from './workers/surreal.worker'

// export interface SurrealDbAdapterWorkerMessage extends AdapterWorkerMessage {
//   table: "event"  | "relay" | "monitor" | "check"  | "nip11" | "ssl" | "geocode";
// }

export class SurrealDbAdapter extends CacheAdapter implements ICacheAdapter {

    readonly slug: string = 'surreal'
    readonly metaUrl: string = import.meta.url
  
    private _db?: RelayDb;

    // useWorker: boolean = false;
  
    constructor(isMainThread: boolean = true) {
      super()
      console.log('SurrealDbAdapter constructor')
      this._db = new RelayDb({ type: 'idb' });
      if(isMainThread) {
        this.bindWorkerHandlers()
      }
    } 

    // async newWorker(): Promise<Worker> {
    //   return SurrealWorker();
    // }

    get db(): RelayDb {
      if(!this._db) throw new Error('Database not initialized');
      return this._db;
    }

    async init(): Promise<void> {
      await this.ready()
    }

    async ready(): Promise<void> {
      await this.db.ready()
    }

    onMessage(message: SurrealDbWorkerResult): void {
      console.log(`hello`, message)
    }

}

export interface SurrealDbAdapter extends SurrealDbMethods {}
applyMixins(SurrealDbAdapter, [SurrealDbMethods]);

export default SurrealDbAdapter;
