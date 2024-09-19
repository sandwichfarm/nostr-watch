import { AdapterSharedWorker } from "@base/AdapterSharedWorker"
import { ICacheAdapterSharedWorkerCommand } from "@interfaces/ICacheAdapterSharedWorkerCommand";
import { Filter } from "nostr-tools";
import { AdapterWebsocketSharedWorker, AdapterWebsocketSharedWorkerCommand } from "@base/core/AdapterWebsocketSharedWorker";

export interface CacheSharedWorkerOptions {
  mainThread: MessagePort;
}

interface DexieSharedWorkerCommand extends AdapterWebsocketSharedWorkerCommand {
  filters: Filter[]
}

export class NostrToolsSharedWorker extends AdapterWebsocketSharedWorker {

  constructor( options: CacheSharedWorkerOptions ){
    super(options)
  }

  get cachePort(): MessagePort | undefined {
    const port = this?.channel
    if(!port) return undefined 
    return port as MessagePort
  }
  
  onMessage(command: ICacheAdapterSharedWorkerCommand){
    const { type } = command
    switch(type){
      case "setup":
        break;
      case "subscribeManyAndCache":
        break;
      case "subscribeManyAndReturn":
        break;
    }
  }
  
  onMessageError(){}

  onError(){}

}