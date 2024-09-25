import { Filter } from "nostr-tools";

import { SharedWorkerOptions} from "@core/AdapterSharedWorker";
import { AdapterWebsocketSharedWorker, AdapterWebsocketSharedWorkerCommand } from "@base/core/AdapterWebsocketSharedWorker";
import { ICacheAdapterSharedWorkerCommand } from "@interfaces/ICacheAdapterSharedWorkerCommand";

export interface CacheSharedWorkerOptions extends SharedWorkerOptions {
  mainThread: MessagePort;
}

export interface NostrToolsWorkerCommand extends AdapterWebsocketSharedWorkerCommand {
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