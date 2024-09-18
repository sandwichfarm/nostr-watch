import { AdapterSharedWorker } from "@base/core/AdapterSharedWorker"
import { ICacheAdapterSharedWorkerCommand } from "@base/interfaces/ICacheAdapterSharedWorkerCommand";

export interface CacheSharedWorkerOptions {
  mainThreadPort: MessagePort;
  channelPort?: MessagePort;
  sharedWorkerPort?: MessagePort; 
}

export interface AdapterCacheSharedWorkerCommand extends ICacheAdapterSharedWorkerCommand {
  type: "setup" | "bulkAddRelays" | "bulkAddMonitors";
  dbName: string,
  eventsBuffer: ArrayBufferLike;
}

export class AdapterCacheSharedWorker extends AdapterSharedWorker {

  constructor( options: CacheSharedWorkerOptions, ){
    super(options)
  }

  //begin: overloads
  
  setup(command: AdapterCacheSharedWorkerCommand){}
  async bulkAddRelays(){}
  async bulkAddMonitors(){}

  //end: overloads

  _setup(command: AdapterCacheSharedWorkerCommand){
    const { channelPort } = command
    if(channelPort) {
      this.channel = channelPort
      this.setupChannelHandlers()
    }
    this.setup(command)
  }

  setupChannelHandlers(){
    if(!this.channel) return
    this.channel.onmessage = (message: MessageEvent) => {
      const command = message.data as AdapterCacheSharedWorkerCommand;
      this.onMessage(command)
    }
    this.channel.onmessageerror = this.onMessageError
  }
  
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