import { Filter } from "nostr-tools";
import PQueue from 'p-queue';

import { 
  AdapterWebsocketWorkerCommand,
} from "@base/interfaces/IAdapterWebsocketWorker";

import { 
  AdapterWorker, 
  AdapterWorkerCommand, 
  WorkerOptions 
} from "./AdapterWorker"
import { IEvent } from "@base/models";

export interface IAdapterWebsocketWorker {

  setup(command: AdapterWebsocketWorkerCommand): Promise<void>;
  subscribeAndCache(filters: Filter[] | Filter): Promise<void>;
  subscribeAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>;
  subscribeAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>;

  fetchAndCache(filters: Filter[] | Filter): Promise<void>;
  fetchAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>;
  fetchAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>;

  onMainThreadMessage(command: AdapterWebsocketWorkerCommand): void;
  onChannelMessage(command: AdapterWebsocketWorkerCommand): void;
}

export class AdapterWebsocketWorker extends AdapterWorker {

  protected relays: string[] = ['wss://relaypag.es', 'wss://relay.nostr.watch']
  private queue: PQueue = new PQueue({concurrency: 1})

  constructor( options?: WorkerOptions ){
    //console.log ('AdapterWebsocketWorker', options)
    super(options)
  }

  async _setup(command: AdapterWorkerCommand): Promise<void>{
    //console.log('AdapterWebsocketWorker: _setup', command)
    const { options } = command
    let connectToRelays 
    if(options){
      connectToRelays = options.connectToRelays
    }
    if( connectToRelays ){
      this.relays = connectToRelays
    }
    if( !this.relays.length  ){
      console.warn('AdapterWebsocketWorker: cannot connect to relays, length is 0')
    }
  }

  async onMainThreadMessage(command: AdapterWebsocketWorkerCommand): Promise<void> {
    //console.log('AdapterWebsocketWorker: onMainThreadMessage', command) 
    this.onMessage(command)
    return void 0;
  }

  async onChannelMessage(command: AdapterWebsocketWorkerCommand): Promise<void>  {
    //console.log('AdapterWebsocketWorker: onChannelMessage (NOT IMPLEMENTED!!!!)', command)
    return void 0;
  }

  calculatePriority(command: AdapterWebsocketWorkerCommand): number {
    const { filters, type } = command
    const { kinds } = filters[0]

    let priority = 50;
    
    if(kinds){
      if(kinds.includes(10166)){
        priority += 30
      }
      else if(kinds.includes(10002) || kinds?.includes(0)){
        priority += 20
      }
      else if(kinds.includes(30166)){ 
        priority += 10
      }
    }

    if(type.toLowerCase().includes('return')){
      priority += 10
    } 

    return priority
  }

  async addToQueue( command: AdapterWebsocketWorkerCommand){
    const priority = this.calculatePriority(command)

    this.queue.add(async () => {
      const { type } = command
      if(!this?.[`_${type}`]) return console.warn(`[AdapterWebsocketWorker] Error: method ${type} is not defined`)
      //console.log(`[AdapterWebsocketWorker] calling this._${type}`)
      const result = this[`_${type}`](command)
      //console.log(`[AdapterWebsocketWorker] result:`, result)
      return result;
    }, { priority })
  }

  async onMessage(command: AdapterWebsocketWorkerCommand): Promise<void>{
    //console.log('AdapterWebsocketWorker: onMessage', command) 

    const { filters } = command 
    const kinds = filters
      .map( (filter: Filter) => filter?.kinds ?? undefined )
      .filter( (kinds: number[] | undefined) => kinds !== undefined ).flat()

    this.addToQueue(command)

    if(kinds?.includes(10166)){
      //console.log('AdapterWebsocketWorker: adding check subscription for 10166')    
      this.queue.on('completed', (result: IEvent[]) => {
        //console.log('AdapterWebsocketWorker: completed', result)
        const registrations = result.filter( ( event: IEvent) => event.kind === 10166 )
        for(const registration of registrations){
          //console.log('AdapterWebsocketWorker: registration', registration)
          const authors = [registration.pubkey]
          const frequency = registration.tags.find( (tag: string[]) => {
            return tag[0] === 'frequency'
          })?.[1]
          if(!frequency) continue
          let since: number;
          try {
            since = Math.round(Date.now()/1000)-parseInt(frequency)  
          } catch (error) { 
            console.warn('AdapterWebsocketWorker: error parsing frequency:', frequency, error)
            continue;
          }
          // console.log(`AdapterWebsocketWorker: adding check subscription for ${authors} with kinds 0 and 10002`)
          this.addToQueue({ 
            type: 'subscribeAndCache', 
            filters: [{ authors, kinds: [0, 10002] }]
          })
          // console.log(`AdapterWebsocketWorker: adding check subscription for ${authors} since ${since}, with kinds 30166`)
          this.addToQueue({ 
            type: 'subscribeAndCache', 
            filters: [
              { authors, since, kinds: [30166] },
            ] 
          })
        }
      })
    };
  }

  private async _subscribeAndCache(command: AdapterWebsocketWorkerCommand) {
    //console.log('AdapterWebsocketWorker: _subscribeAndCache', command)
    const { filters } = command
    return this.subscribeAndCache(filters)
  }

  private async _subscribeAndReturn(command: AdapterWebsocketWorkerCommand): Promise<IEvent[] | void>{
    const { filters } = command
    return this.subscribeAndReturn(filters)
  }

  private async _subscribeAndCacheAndReturn(command: AdapterWebsocketWorkerCommand): Promise<IEvent[] | void>{
    const { filters } = command
    return this.subscribeAndCacheAndReturn(filters)
  }

  private _getUniquePubkeys(events: IEvent[]): string[] {
    return Array.from(new Set(events.map(event => event.pubkey)))
  }

  //begin: overload these
  async setup(command: AdapterWebsocketWorkerCommand): Promise<void> { 
    //console.log('AdapterWebsocketWorker: setup', command)  
    return void 0 
  }
  async subscribeAndCache(filters: Filter[] | Filter): Promise<void | IEvent[]> {
    console.warn('AdapterWebsocketWorker: subscribeAndCache is not implemented')
  }
  async subscribeAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]> {
    //console.log('AdapterWebsocketWorker: subscribeAndReturn', filters)
  }
  async subscribeAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
    console.warn('AdapterWebsocketWorker: subscribeAndCacheAndReturn is not implemented')
  }
  //end: overload these
 }