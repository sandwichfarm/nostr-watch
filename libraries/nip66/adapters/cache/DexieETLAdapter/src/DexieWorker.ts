
import { 
  WorkerOptions, 
  AdapterCacheWorkerCommand, 
  AdapterCacheWorker, 
  IAdapterCacheWorker
} from "@nostrwatch/nip66/core"

import { IEvent } from "@nostrwatch/nip66/interfaces";

import { RelayDb, type IRelayDb } from './db';

import { DexieQueue, DexieTask } from './DexieQueue';
import PQueue from "p-queue";

interface DexieWorkerCommand extends AdapterCacheWorkerCommand {
  dbName: string;
}
export class DexieWorker extends AdapterCacheWorker implements IAdapterCacheWorker {
  idb: IRelayDb;

  constructor( options: WorkerOptions ){
    super(options)
    this.idb = new RelayDb('RelayDb');
  }

  async addEvent(event: IEvent): Promise<void> {
    //console.log('DexieWorker: _addEvent', event)
    if(!this?.idb) return console.warn('DexieWorker: idb is not defined')
    await this.idb.addRawEvent(event)
  }

  async addEvents(events: IEvent[]): Promise<void> {
    for(const event of events){
      await this.addEvent(event)
    }
  }

  //overload.
  async setup(command: DexieWorkerCommand){
    const { dbName } = command 
    //console.log('DexieWorker setup', dbName)
    this.idb = new RelayDb(dbName); 
    await this.idb.init()
  }

}