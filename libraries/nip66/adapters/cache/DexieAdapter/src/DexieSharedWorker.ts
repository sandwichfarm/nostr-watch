import { AdapterSharedWorker, SharedWorkerOptions, AdapterCacheSharedWorkerCommand } from "@nostrwatch/nip66/core"

import { RelayDb, type IRelayDb } from './db';

interface DexieSharedWorkerCommand extends AdapterCacheSharedWorkerCommand {
  dbName: string
}

export class DexieSharedWorker extends AdapterSharedWorker {
  idb: IRelayDb | undefined;

  constructor( options: SharedWorkerOptions, ){
    super(options)
  }

  //overload.
  async setup(command: DexieSharedWorkerCommand){
    //Adapter Specific Setup
    const { dbName, channelPort } = command
    this.idb = new RelayDb(dbName);
    await this.idb.init()
  }

  protected async bulkAddRelays(command: DexieSharedWorkerCommand){
    `${command}`
  }

  protected async bulkAddMonitors(command: DexieSharedWorkerCommand){
    `${command}`
  }

}