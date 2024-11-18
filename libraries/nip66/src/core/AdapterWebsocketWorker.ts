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
import { defaultWebsocketAdapterOptions, defaultWebsocketRequest, defaultWebsocketRequestBody, SubscribeHandlers, WebsocketAdapterFetchOptions, WebsocketAdapterOptions, WebsocketRequest, WebsocketRequestBody } from "./WebsocketAdapter";

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
  result: null,
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
  private batchQueue: IEvent[] = []

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
    if(to === 'adapter'){
      if(!this?.mainThread) return console.warn('AdapterWebsocketWorker: mainThread not found')
      this.mainThread.postMessage(args)
      sent++;
    }
    if(to === 'cache'){
      if(!this.channel) return console.warn('AdapterWebsocketWorker: channel not found')
      this.channel.postMessage(args)
      sent++
    }
    if(!sent) console.warn('AdapterWebsocketWorker: respond: did not send to any destination')
  }

  async subscribe( request: WebsocketRequestBody = defaultWebsocketRequestBody ){
    console.log(`AdapterWebsocketWorker: subscribe`, request)
    const { hash, options } = request
    const { stream } = options ?? defaultWebsocketAdapterOptions;
    let callbacks: SubscribeHandlers | undefined;
    const { onevent, oneose } = this.requestCallbacks(request);
    if(stream){
      callbacks = { onevent }
    }
    const result = await this._subscribe(request, callbacks)
    if(stream){
      oneose?.()
    }
    else {
      console.log(`AdapterWebsocketWorker: subscribe: preparing async response`)
      console.log('AdapterWebsocketWorker: response', request, result)
      this.requestAsyncReponse(request, result as IEvent[])
    }
  }

  async _subscribe(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> { 
    throw new Error(`${this.constructor.name}:_subscribe() not implemented!`)
  }

  async fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody){
    console.log(`AdapterWebsocketWorker: fetch`, request)
    const { options } = request
    const { stream } = options ?? defaultWebsocketAdapterOptions;
    let callbacks: SubscribeHandlers | undefined;
    const { onevent, oneose } = this.requestCallbacks(request);
    if(stream){
      callbacks = { onevent }
    }
    // console.log('AdapterWebsocketWorker: fetch: calling this._fetch')
    const result = await this._fetch(request, callbacks)
    // console.log('AdapterWebsocketWorker: fetch: result', result)
    if(stream){
      oneose?.()
    }
    else {
      console.log(`AdapterWebsocketWorker: fetch: preparing async response`)
      this.requestAsyncReponse(request, result as IEvent[])
    }
  }

  async _fetch(request: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    throw new Error(`${this.constructor.name}:_fetch() not implemented!`)
  }

  requestAsyncReponse(request: WebsocketRequestBody, result: IEvent[]){
    const { hash, options } = request
    const { cache, returnResults } = options
    console.log(`AdapterWebsocketWorker: requestAsyncReponse cache: ${cache} returnResults: ${returnResults}`)
    let args: WebsocketResponseBody = {
      type: ResponseType.events, 
      result,
      hash: hash as string
    }
    if(cache === true) {
      this.respond({to: 'cache', args})
    }
    if(returnResults === true){
      this.respond({to: 'adapter', args})
    }
    //complete message.
    args = {
      ...defaultWebsocketResponseBody,
      result: result.length > 0,
      type: ResponseType.complete,
    }
    if(cache === true) {
      this.respond({to: 'cache', args})
    }
    if(returnResults === true){
      this.respond({to: 'adapter', args})
    }
  }

  requestCallbacks(request: WebsocketRequestBody = defaultWebsocketRequestBody): SubscribeHandlers {
    const { options, hash } = request
    let { batch } = options
    let response: WebsocketResponseBody;
    const onevent = (event: unknown) => {
      // if(batch){
      //   if(this.batchQueue.length < (batch as number)) {
      //     console.log('batching', batch, this.batchQueue.length)
      //     this.batchQueue.push(event as IEvent);
      //     return;
      //   }
      //   else {
      //     console.log('sending batch', batch, this.batchQueue.length)
      //     const result = [...this.batchQueue.splice(0, batch)]
      //     response = {
      //       type: ResponseType.events, 
      //       result,
      //       hash: hash as string
      //     }
      //   }
      // }
      if(!response){
        response = {
          type: ResponseType.event, 
          result: event as IEvent,
          hash: hash as string
        }
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
      const { cache, returnResults } = options
      const { batch } = options
      let args: WebsocketResponseBody;
      // if(this.batchQueue.length > 0){
      //   console.log(`sending remainder: ${this.batchQueue.length}`)
      //   const result = this.batchQueue.splice(0, batch)
      //   args = {
      //     type: ResponseType.events, 
      //     result,
      //     hash: hash as string
      //   }
      //   if(cache) {
      //     this.respond({ to: 'cache', args })
      //   }
      //   if(returnResults){
      //     this.respond({ to: 'adapter', args })
      //   }
      // }
      args = {
        type: ResponseType.complete,
        result: null,
        hash: hash as string
      }
      if(cache) {
        this.respond({ to: 'cache', args })
      }
      if(returnResults){
        this.respond({ to: 'adapter', args })
      }
    }
    return { onevent, oneose }
  }
  private _getUniquePubkeys(events: IEvent[]): string[] {
    return Array.from(new Set(events.map(event => event.pubkey)))
  }
 }