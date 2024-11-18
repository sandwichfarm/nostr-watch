import { Filter } from "nostr-tools";
import PQueue from 'p-queue';

import { 
  AdapterWebsocketWorkerCommand,
} from "@base/interfaces/IAdapterWebsocketWorker";

import { 
  AdapterWorker, 
  AdapterWorkerCommand, 
  AdapterWorkerResultType, 
  WorkerOptions 
} from "./AdapterWorker"
import { IEvent } from "@base/models";
import { defaultSubscribeOptions, defaultWebsocketRequest, defaultWebsocketRequestBody, SubscribeHandlers, WebsocketAdapterFetchOptions, WebsocketAdapterSubscribeOptions, WebsocketRequest, WebsocketRequestBody } from "./WebsocketAdapter";

export enum ResponseType {
  event = 'event',
  events = 'events',
  complete = 'complete'
}

interface WebsocketResponse extends WebsocketResponseHeaders {
  args: WebsocketResponseBody
}

interface WebsocketResponseHeaders {
  to: 'cache' | 'adapter',
}

export type WebsocketResponseBody = {
  type: 'event' | 'events' | 'complete',
  result: any,
  hash: string
}

export const defaultWebsocketResponseHeaders: WebsocketResponseHeaders = { 
  to: 'cache'
}

export const defaultWebsocketResponseBody: WebsocketResponseBody = {
  type: 'event',
  result: {},
  hash: ''
}

export const defaultWebsocketResponse: WebsocketResponse = {
  ...defaultWebsocketResponseHeaders,
  args: defaultWebsocketResponseBody
}

export type WebsocketAdapterResult = void | undefined | IEvent | IEvent[];

export interface IAdapterWebsocketWorker {
  setup(command: AdapterWebsocketWorkerCommand): Promise<void>;
  subscribe( request: WebsocketRequestBody ): Promise<void>;
  fetch( request: WebsocketRequestBody ): Promise<void>;
}


export class AdapterWebsocketWorker extends AdapterWorker {
  protected relays: string[] = ['wss://relaypag.es/', 'wss://relay.nostr.watch/']
  private queue: PQueue = new PQueue({concurrency: 1})

  constructor( options?: WorkerOptions ){
    console.log ('AdapterWebsocketWorker', options)
    super(options)
  }

  async _setup(command: AdapterWorkerCommand): Promise<void>{
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

  async onMainThreadMessage(request: WebsocketRequest): Promise<void> {
    this.onMessage(request)
  }

  async onChannelMessage(request: WebsocketRequest): Promise<void>  {
    this.onMessage(request)
  }

  onMessage(request: WebsocketRequest = defaultWebsocketRequest){
    console.log('AdapterWebsocketWorker: onMessage', request) 
    const { use, args } = request
    if(use === 'subscribe'){
      console.log('AdapterWebsocketWorker: onMessage: subscribe')
      return this.subscribe(args)
    }
    if(use === 'fetch'){
      console.log('AdapterWebsocketWorker: onMessage: fetch')
      return this.fetch(args)
    }
    console.warn('AdapterWebsocketWorker: onMessage: did not match any command')
  }

  respond(response: WebsocketResponse = defaultWebsocketResponse){
    const { to, args } = response
    let sent = 0
    if(to === 'cache'){
      if(!this?.mainThread) return console.warn('AdapterWebsocketWorker: mainThread not found')
      this.mainThread.postMessage(args)
      sent++;
    }
    if(to === 'adapter'){
      if(!this.channel) return console.warn('AdapterWebsocketWorker: channel not found')
      this.channel.postMessage(args)
      sent++
    }
    if(!sent) console.warn('AdapterWebsocketWorker: respond: did not send to any destination')
  }

  async subscribe( request: WebsocketRequestBody = defaultWebsocketRequestBody ){
    console.log(`AdapterWebsocketWorker: subscribe`, request)
    const { hash, options } = request
    const { stream } = options ?? defaultSubscribeOptions;
    let callbacks: SubscribeHandlers | undefined;
    if(stream){
      callbacks = this.requestCallbacks(request);
    }
    const result = await this._subscribe(request, callbacks)
    if(!stream){
      console.log(`AdapterWebsocketWorker: subscribe: preparing async response`)
      this.requestAsyncReponse(request, result as IEvent[])
    }
  }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> { 
    throw new Error(`${this.constructor.name}:_subscribe() not implemented!`)
  }

  async fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody){
    console.log(`AdapterWebsocketWorker: fetch`, request)
    const { hash, options } = request
    const { stream } = options ?? defaultSubscribeOptions;
    let callbacks: SubscribeHandlers | undefined;
    if(stream){
      callbacks = this.requestCallbacks(request);
    }
    console.log('AdapterWebsocketWorker: fetch: calling this._fetch')
    const result = await this._fetch(request, callbacks)
    console.log('AdapterWebsocketWorker: fetch: result', result)
    if(!stream){
      console.log(`AdapterWebsocketWorker: fetch: preparing async response`)
      this.requestAsyncReponse(request, result as IEvent[])
    }
  }

  async _fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    throw new Error(`${this.constructor.name}:_fetch() not implemented!`)
  }

  requestAsyncReponse(request: WebsocketRequestBody, result: IEvent[]){
    const { hash, options } = request
    let args: WebsocketResponseBody = {
      type: ResponseType.events, 
      result,
      hash: hash as string
    }
    if(options.cache) {
      this.respond({to: 'cache', args})
    }
    if(options.returnResults){
      this.respond({to: 'adapter', args})
    }
    //complete message.
    args = {
      ...defaultWebsocketResponseBody,
      type: ResponseType.complete,
    }
    if(options.cache) {
      this.respond({to: 'cache', args})
    }
    if(options.returnResults){
      this.respond({to: 'adapter', args})
    }
  }

  requestCallbacks(request: WebsocketRequestBody = defaultWebsocketRequestBody): SubscribeHandlers {
    const { options, hash } = request
    const onevent = (event: unknown) => {
      const response = {
        type: ResponseType.event, 
        result: event as IEvent,
        hash: hash as string
      }
      const { cache, returnResults } = options
      if(cache) {
        this.respond({to: 'cache', args: response})
      }
      if(returnResults){
        this.respond({to: 'adapter', args: response})
      }
    }
    const oneose = () => {
      this.respond({
        to: 'cache',
        args: {
          type: ResponseType.complete,
          result: null,
          hash: hash as string
        }
      })
    }
    return { onevent, oneose }
  }

  // calculatePriority(command: AdapterWebsocketWorkerCommand): number {
  //   const { filters, type } = command
  //   const { kinds } = filters[0]

  //   let priority = 50;
    
  //   if(kinds){
  //     if(kinds.includes(10166)){
  //       priority += 30
  //     }
  //     else if(kinds.includes(10002) || kinds?.includes(0)){
  //       priority += 20
  //     }
  //     else if(kinds.includes(30166)){ 
  //       priority += 10
  //     }
  //   }

  //   if(type.toLowerCase().includes('return')){
  //     priority += 10
  //   } 

  //   return priority
  // }

  // async addToQueue( command: AdapterWebsocketWorkerCommand){
  //   const priority = this.calculatePriority(command)

  //   this.queue.add(async () => {
  //     const { type } = command
  //     if(!this?.[`_${type}`]) return console.warn(`[AdapterWebsocketWorker] Error: method ${type} is not defined`)
  //     //console.log(`[AdapterWebsocketWorker] calling this._${type}`)
  //     const result = this[`_${type}`](command)
  //     //console.log(`[AdapterWebsocketWorker] result:`, result)
  //     return result;
  //   }, { priority })
  // }
  

  // async onMessage(command: AdapterWebsocketWorkerCommand): Promise<void>{
  //   //console.log('AdapterWebsocketWorker: onMessage', command) 

  //   const { filters } = command 
  //   const kinds = filters
  //     .map( (filter: Filter) => filter?.kinds ?? undefined )
  //     .filter( (kinds: number[] | undefined) => kinds !== undefined ).flat()

  //   this.addToQueue(command)

  //   if(kinds?.includes(10166)){
  //     //console.log('AdapterWebsocketWorker: adding check subscription for 10166')    
  //     this.queue.on('completed', (result: IEvent[]) => {
  //       //console.log('AdapterWebsocketWorker: completed', result)
  //       const registrations = result.filter( ( event: IEvent) => event.kind === 10166 )
  //       for(const registration of registrations){
  //         //console.log('AdapterWebsocketWorker: registration', registration)
  //         const authors = [registration.pubkey]
  //         const frequency = registration.tags.find( (tag: string[]) => {
  //           return tag[0] === 'frequency'
  //         })?.[1]
  //         if(!frequency) continue
  //         let since: number;
  //         try {
  //           since = Math.round(Date.now()/1000)-parseInt(frequency)  
  //         } catch (error) { 
  //           console.warn('AdapterWebsocketWorker: error parsing frequency:', frequency, error)
  //           continue;
  //         }
  //         // console.log(`AdapterWebsocketWorker: adding check subscription for ${authors} with kinds 0 and 10002`)
  //         this.addToQueue({ 
  //           type: 'subscribeAndCache', 
  //           filters: [{ authors, kinds: [0, 10002] }]
  //         })
  //         // console.log(`AdapterWebsocketWorker: adding check subscription for ${authors} since ${since}, with kinds 30166`)
  //         this.addToQueue({ 
  //           type: 'subscribeAndCache', 
  //           filters: [
  //             { authors, since, kinds: [30166] },
  //           ] 
  //         })
  //       }
  //     })
  //   };
  // }

  // private async _subscribeAndCache(command: AdapterWebsocketWorkerCommand) {
  //   //console.log('AdapterWebsocketWorker: _subscribeAndCache', command)
  //   const { filters } = command
  //   return this.subscribeAndCache(filters)
  // }

  // private async _subscribeAndReturn(command: AdapterWebsocketWorkerCommand): Promise<IEvent[] | void>{
  //   const { filters } = command
  //   return this.subscribeAndReturn(filters)
  // }

  // private async _subscribeAndCacheAndReturn(command: AdapterWebsocketWorkerCommand): Promise<IEvent[] | void>{
  //   const { filters } = command
  //   return this.subscribeAndCacheAndReturn(filters)
  // }



  // //begin: overload these
  // async setup(command: AdapterWebsocketWorkerCommand): Promise<void> { 
  //   //console.log('AdapterWebsocketWorker: setup', command)  
  //   return void 0 
  // }
  // async subscribeAndCache(filters: Filter[] | Filter): Promise<void | IEvent[]> {
  //   console.warn('AdapterWebsocketWorker: subscribeAndCache is not implemented')
  // }
  // async subscribeAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]> {
  //   //console.log('AdapterWebsocketWorker: subscribeAndReturn', filters)
  // }
  // async subscribeAndCacheAndReturn(filters: Filter[] | Filter): Promise<void | IEvent[]>{
  //   console.warn('AdapterWebsocketWorker: subscribeAndCacheAndReturn is not implemented')
  // }
  //end: overload these


  private _getUniquePubkeys(events: IEvent[]): string[] {
    return Array.from(new Set(events.map(event => event.pubkey)))
  }
 }