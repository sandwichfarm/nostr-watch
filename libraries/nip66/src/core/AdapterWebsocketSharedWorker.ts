import { IEvent } from "@base/interfaces";
import { AdapterSharedWorker, AdapterSharedWorkerCommand, SharedWorkerOptions } from "./AdapterSharedWorker"
import { Filter } from "nostr-tools";

export interface AdapterWebsocketSharedWorkerCommand extends AdapterSharedWorkerCommand {
  type: "setup" | "subscribeManyAndCache" | "subscribeManyAndReturn";
  filters: Filter[];
  token?: string,
}

export class AdapterWebsocketSharedWorker extends AdapterSharedWorker {

  constructor( options?: SharedWorkerOptions ){
    super(options)
  }

  //begin: overloads\
  
  setup(command: AdapterWebsocketSharedWorkerCommand){}
  async subscribeManyAndCache(filters: Filter[], subId: string){}
  async subscribeManyAndReturn(filters: Filter[], subId: string): Promise<IEvent[]>{
    return [] as IEvent[]
  }

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
    if(!token) return
    return this.subscribeManyAndCache(filters, token)
  }

  private async _subscribeManyAndReturn(command: AdapterWebsocketSharedWorkerCommand){
    const { filters, token } = command
    if(!token) return
    return this.subscribeManyAndReturn(filters, token)
  }
  
 }