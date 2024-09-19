import { AdapterSharedWorker, AdapterSharedWorkerCommand, SharedWorkerOptions } from "@base/core/AdapterSharedWorker"
import { Filter } from "nostr-tools";

export interface AdapterWebsocketSharedWorkerCommand extends AdapterSharedWorkerCommand {
  type: "setup" | "subscribeManyAndCache" | "subscribeManyAndReturn";
  filters: Filter[];
  token?: string,
}
a
export class AdapterWebsocketSharedWorker extends AdapterSharedWorker {

  constructor( options?: SharedWorkerOptions ){
    super(options)
  }

  //begin: overloads\
  
  setup(command: AdapterWebsocketSharedWorkerCommand){}
  async subscribeManyAndCache(filters: Filter[], subId: string){}
  async subscribeManyAndReturn(filters: Filter[], subId: string){}

  //end: overloads
  onMessage(command: AdapterWebsocketSharedWorkerCommand){
    const { type } = command
    switch(type){
      case "setup":
        this._setup(command)
        break;
      case "subscribeManyAndCache":
        this._subscribeManyAndCache(command)
        break;
      case "subscribeManyAndReturn":
        this._subscribeManyAndReturn(command)
        break;
    }
  }

  private async _subscribeManyAndCache(command: AdapterWebsocketSharedWorkerCommand){
    const { filters, token } = command
    return this.subscribeManyAndCache(filters, token)
  }

  private async _subscribeManyAndReturn(command: AdapterWebsocketSharedWorkerCommand){
    const { filters, token } = command
    return this.subscribeManyAndReturn(filters, token)
  }
  
 }