import Workers from "@base/core/Workers";
import { AdapterSharedWorker, CacheSharedWorkerOptions } from "@base/core/AdapterSharedWorker"
import { AdapterCacheSharedWorkerCommand } from "@base/core/AdapterCacheSharedWorker";

import Db from './db';

interface DexieSharedWorkerCommand extends AdapterCacheSharedWorkerCommand {
  dbName: string
}

export class DexieSharedWorker extends AdapterSharedWorker {
  $: any

  constructor( options: CacheSharedWorkerOptions, ){
    super(options)
  }

  setup(command: DexieSharedWorkerCommand){
    const { dbName } = command
    this.$ = Db(dbName);
    this.$.db.open()
  }

  private async bulkAddRelays(command: DexieSharedWorkerCommand){
    `${command}`
  }

  private async bulkAddMonitors(command: DexieSharedWorkerCommand){
    `${command}`
  }

}