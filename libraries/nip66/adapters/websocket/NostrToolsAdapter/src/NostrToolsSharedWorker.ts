import { AdapterSharedWorker } from "@base/AdapterSharedWorker"
import { ICacheAdapterSharedWorkerCommand } from "@interfaces/ICacheAdapterSharedWorkerCommand";

export interface CacheSharedWorkerOptions {
  mainThread: MessagePort;
}

interface DexieSharedWorkerCommand extends ICacheAdapterSharedWorkerCommand{
  type: "setup" | "subscribeManyAndCache" | "subscribeManyAndReturn";
  filters: Filter[]
  token?: string,
}

export class NostrToolsSharedWorker extends AdapterSharedWorker {

  constructor( options: CacheSharedWorkerOptions, ){
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