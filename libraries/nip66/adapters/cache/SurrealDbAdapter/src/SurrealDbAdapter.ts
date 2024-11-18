import { CacheAdapter } from '@nostrwatch/nip66/core';

import type { 
    ICacheAdapter, 
    AdapterWorkerMessage,
    AdapterCacheWorkerResult
  } from '@nostrwatch/nip66/core';

import RelayDb from './db';

import { applyMixins } from '@nostrwatch/nip66/utils';
import { SurrealDbMethods } from './SurrealDbMethods';
// import { SurrealDbWorkerResult } from './SurrealDbWorker';

//@ts-ignore: it's an import.
import SurrealWorker from './workers/surreal.worker?worker&inline'
import { SurrealDbWorkerResult } from './SurrealDbWorker.fml';
import { IEvent } from '../../../../dist/types/models';

// export interface SurrealDbAdapterWorkerMessage extends AdapterWorkerMessage {
//   table: "event"  | "relay" | "monitor" | "check"  | "nip11" | "ssl" | "geocode";
// }

export class SurrealDbAdapter extends CacheAdapter implements ICacheAdapter {

    readonly slug: string = 'surreal'
    readonly batchSize: number = 10;

    private batch: IEvent[] = [];

  
    private _db?: RelayDb;

    useWorker: boolean = true;
  
    constructor(isMainThread: boolean = true) {
      super()
      console.log('SurrealDbAdapter constructor')
      this._db = new RelayDb({ type: 'memory' });
      if(isMainThread) {
        this.bindWorkerHandlers()
      }
    } 

    async newWorker(channelPort: MessagePort): Promise<Worker> {
      return SurrealWorker();
    }

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

    onMessage(command: AdapterCacheWorkerResult): void {
      const { result } = command
      if(!result) return console.warn('result is not defined')
      const event = this.decode(result)
      if(event instanceof Array) {
        console.warn('bulk adding of events not implemented')
      }
      else {
        this.db.addRawEvent(event)
      }
    }

}

export interface SurrealDbAdapter extends SurrealDbMethods {}
applyMixins(SurrealDbAdapter, [SurrealDbMethods]);

export default SurrealDbAdapter;
