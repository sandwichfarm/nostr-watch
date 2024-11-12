import PQueue from "p-queue";
import { AdapterWorker, AdapterWorkerResult, WorkerOptions } from "./AdapterWorker"
import { AdapterWorkerCommand } from "./AdapterWorker";
import { Workers } from "./Workers";
import type { IEvent } from "@models/Event";

export interface AdapterCacheWorkerCommand extends AdapterWorkerCommand {
  type: "setup" | "cacheEvent" | "cacheEvents";
}

export interface AdapterCacheWorkerResult extends AdapterWorkerResult {
  type: "events" | "event" | "eventsBuffer" | "record" ;
}

export interface IAdapterCacheWorker {
  useWorker: boolean;
  
  setup(command: AdapterCacheWorkerCommand): void;
  addEvent(events: IEvent): Promise<void>;
  addEvents(events: IEvent[]): Promise<void>;
}


export class AdapterCacheWorker extends AdapterWorker {

  private queue: PQueue = new PQueue({concurrency: 20})

  constructor( options?: WorkerOptions ){
    super(options)
  }

  //begin: overloads
  async setup(command: AdapterCacheWorkerCommand): Promise<void> { return void 0 }
  async addEvent(event: IEvent): Promise<void> { return void 0 }
  async addEvents(events: IEvent[]): Promise<void> { return void 0 }    
  
  //end: overloads

  async addToQueue( command: AdapterCacheWorkerCommand){
    const priority = 10

    this.queue.add(async () => {
      const { result } = command
      if(!result) return console.warn('result is not defined')
      const event = this.decode(result)
      if(event instanceof Array) {
        await this.addEvents(event)
      }
      else {
        await this.addEvent(event)
      }
    }, { priority })
  }

  async onMessage(command: AdapterCacheWorkerCommand): Promise<void>{
    const { result } = command
    if(!result) return console.warn('result is not defined')
    const event = this.decode(result)
    if(event instanceof Array) {
      await this.addEvents(event)
    }
    else {
      await this.addEvent(event)
    }
  }

  async onMainThreadMessage(command: AdapterCacheWorkerCommand): Promise<void> {
    return void 0;
  }

  async onChannelMessage(command: AdapterCacheWorkerCommand): Promise<void>  {
    //console.log('AdapterCacheWorker: onChannelMessage', command)
    this.onMessage(command)
  }





  // private async _bulkAddRelays(command: AdapterCacheWorkerCommand): Promise<void> {
  //   const { eventsBuffer } = command
  //   if(!eventsBuffer) return console.warn('eventsBuffer is not defined')
  //   const events = Workers.decodeNostrEventArrayFromBuffer(eventsBuffer)
  //   await this.bulkAddRelays(events)
  // }

  // private async _bulkAddMonitors(command: AdapterCacheWorkerCommand): Promise<void> {
  //   const { eventsBuffer } = command
  //   if(!eventsBuffer) return console.warn('eventsBuffer is not defined')
  //   const events = Workers.decodeNostrEventArrayFromBuffer(eventsBuffer)
  //   await this.bulkAddMonitors(events)
  // }
  
 }