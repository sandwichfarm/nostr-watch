import { AdapterSharedWorker, SharedWorkerOptions } from "@core/AdapterSharedWorker"
import { AdapterCacheSharedWorkerCommand } from "@core/AdapterCacheSharedWorker";

import { RelayDb } from './db';

interface DexieSharedWorkerCommand extends AdapterCacheSharedWorkerCommand {
  dbName: string
}

export class DexieSharedWorker extends AdapterSharedWorker {
  idb: any

  constructor( options: SharedWorkerOptions, ){
    super(options)
  }

  setup(command: DexieSharedWorkerCommand){
    const { dbName } = command
    this.idb = new RelayDb(dbName);
    this.idb.open()
  }

  private async bulkAddRelays(command: DexieSharedWorkerCommand){
    `${command}`
  }

  private async bulkAddMonitors(command: DexieSharedWorkerCommand){
    `${command}`
  }

}