import { AdapterSharedWorker, SharedWorkerOptions } from "./AdapterSharedWorker"
import { AdapterSharedWorkerCommand } from "./AdapterSharedWorker";
import { Workers } from "./Workers";
import { NostrEvent } from "@base/models/NostrEvent";

// export interface CacheSharedWorkerOptions extends SharedWorkerOptions {}

export interface AdapterCacheSharedWorkerCommand extends AdapterSharedWorkerCommand {
  type: "setup" | "bulkAddRelays" | "bulkAddMonitors";
  eventsBuffer: ArrayBufferLike;
}

export class AdapterCacheSharedWorker extends AdapterSharedWorker {

  constructor( options?: SharedWorkerOptions ){
    super(options)
  }

  //begin: overloads
  
  setup(command: AdapterCacheSharedWorkerCommand){}
  async bulkAddRelays(events: NostrEvent[]){}
  async bulkAddMonitors(command: NostrEvent[]){}

  //end: overloads
  
  onMessage(command: AdapterCacheSharedWorkerCommand){
    const { type } = command
    switch(type){
      case "setup":
        this._setup(command)
        break;
      case "bulkAddRelays":
        this._bulkAddRelays(command)      
        break;
      case "bulkAddMonitors":
        this._bulkAddMonitors(command)
        break;
    }
  }

  private async _bulkAddRelays(command: AdapterCacheSharedWorkerCommand){
    const { eventsBuffer } = command
    const events = Workers.decodeNostrEventArrayFromBuffer(eventsBuffer)
    await this.bulkAddMonitors(events)
  }

  private async _bulkAddMonitors(command: AdapterCacheSharedWorkerCommand){
    const { eventsBuffer } = command
    const events = Workers.decodeNostrEventArrayFromBuffer(eventsBuffer)
    await this.bulkAddMonitors(events)
    // this.$.bulkAddmonitors(events)s
  }
  
 }