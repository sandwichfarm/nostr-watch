import type { Filter } from 'nostr-tools';

import { Adapter, AdapterMessage, type IAdapter } from './Adapter'
import type { IEvent } from '@models/Event';
import { deterministicHash } from '@base/utils/hash';
import { WebsocketResponseBody } from './AdapterWebsocketWorker';
import { StateManager } from '@base/managers/StateManager';
import { delay } from '@nostrwatch/utils';

export interface SubscribeHandlers {
  onevent?: (event: any) => void
  onevents?: (events: any[]) => void
  oneose?: () => void
  onclose?: () => void
}
export interface IWebsocketAdapterCallbacks {
  onNotice?: (notice: any) => void
  onOk?: (status: any) => void
  onEvent?: (event: IEvent) => void
  onLimits?: (limits: Record<string, any>) => void
  onEose?: () => void
  onClose?: () => void
}

export interface WebsocketAdapterOptions {
 keepAlive: boolean,
 returnResults: boolean,
 cache: boolean,
 stream: boolean,
 batch?: number
}

export const defaultWebsocketAdapterOptions: WebsocketAdapterOptions = {
  keepAlive: false,
  returnResults: false,
  cache: true,
  stream: true
}

export interface WebsocketRequest extends WebsocketRequestHeader {
  args: WebsocketRequestBody
}

export interface WebsocketRequestHeader {
  adapter: string,
  from: string,
  action: string,
}

export type WebsocketRequestBody = {
  filters: Filter[],
  options: WebsocketAdapterOptions,
  hash?: string,
  relays?: string[],
  priority?: number
}

export const defaultWebsocketRequestHeader: WebsocketRequestHeader = {
  adapter: 'websocket',
  from: 'worker',
  action: 'fetch',
}

export const defaultWebsocketRequestBody: WebsocketRequestBody = {
  filters: [],
  options: defaultWebsocketAdapterOptions,
  hash: '',
  relays: []
}

export const defaultWebsocketRequest: WebsocketRequest = {
  ...defaultWebsocketRequestHeader,
  args: defaultWebsocketRequestBody
}

export interface WebsocketAdapterFetchOptions {
  cache: boolean
 }

export interface IWebsocketAdapterMethods {
  connect(): Promise<void>;
  subscribe(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;
  fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;
  unsubscribe(hash?: string): void;
  unsubscribeAll(): void; 
  disconnect(): void;
  terminate(): void;
  // bootstrap(filters: Filter[], relays?: string[], callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;

  abort(): Promise<boolean>;
}

export interface IWebsocketAdapter extends IWebsocketAdapterMethods, IAdapter {}

export class WebsocketAdapter extends Adapter implements IWebsocketAdapter {
  static type = 'WebsocketAdapter';
  readonly slug: string = 'WebsocketAdapter:unset';
  private _subscriptions: Set<string> = new Set()
  private _hashData: Record<string, any> = {}

  constructor(worker?: Worker | SharedWorker | URL) {
    super(worker)
    StateManager.on('destroy', () => {
      if(this.worker instanceof Worker)
        this.worker?.terminate()
    })
  }

  get worker(): Worker | SharedWorker | undefined {
    return this.workers?.websocket
  }

  get subscriptions(): Set<string> {
    return this._subscriptions
  }

  async connect(): Promise<void> {}
  disconnect(): void {}
  terminate(): void {}

  async unsubscribe(hash?: string): Promise<boolean> {
    if(hash && !this.subscriptions.has(hash)) return true;
    const unsub = this.request({
      action: 'unsubscribe',
      args: {
        ...defaultWebsocketRequestBody, 
        hash
      }
    })
    return this.response(unsub) as Promise<boolean>
  }

  async unsubscribeAll(hash?: string): Promise<boolean> {
    const hashes = [...Array.from(this.subscriptions)]
    for(let hash of hashes){
      await this.unsubscribe(hash)
    }
    return true;
  }

  async shutdown(): Promise<void> {
    await this.unsubscribeAll();
    await this.abort();
    await delay(1000);
    this.terminate()
  }

  async abort(): Promise<boolean> {
    const abort = this.request({
      action: 'abort',
      args: { 
        ...defaultWebsocketRequestBody,
        hash: 'abort',
      }
    })
    return this.response(abort) as Promise<boolean>
  }

  newWorker(): Promise<Worker | SharedWorker> {
    throw new Error('Method not implemented.');
  }

  protected bindWorkerHandlers(): void {
    if(!this?.workers?.websocket) return console.warn('[WebsocketAdapter] Error binding worker handlers: no worker found')
    if(this.workers.websocket instanceof Worker)
      this.workers.websocket.onmessage = this._onMessage.bind(this);
    this.workers.websocket.onerror = this._onError.bind(this)
  }

  onMessage(response: WebsocketResponseBody): void {
    const { hash } = response
    //console.log('got the fucking message.', hash)
    if(hash && this.subscriptions.has(hash)){
      StateManager.emit(hash, response)
    }
    else {
      console.warn(`[WebsocketAdapter] No subscription found for hash: ${hash}`)
    }
  } 

  async subscribe(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>{
    if(callbacks && Object.keys(callbacks).length > 0) {
      args.options.stream = true
    }
    const hash = this.request({
      action: 'subscribe',
      args
    })
    if(this.subscriptions.has(hash)) {
      console.warn(`[WebsocketAdapter] Already subscribed to ${hash}`)
      return true;
    }
    this.subscriptions.add(hash)
    return this.response(hash, callbacks) as Promise<IEvent[] | boolean>
  }

  async fetch(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    if(callbacks && Object.keys(callbacks).length > 0) {
      args.options.stream = true
    }
    const hash = this.request({
      action: 'fetch',
      args
    })
    if(this.subscriptions.has(hash)) {
      console.warn(`[WebsocketAdapter] Already subscribed to ${hash}`)
      return true;
    }
    this.subscriptions.add(hash)
    const result = this.response(hash, callbacks) as Promise<IEvent[] | boolean> 
    return result;
  } 

  setHashData(hash: string, key: string, value: any): void {
    if(!this._hashData[hash]) this._hashData[hash] = {}
    this._hashData[hash][key] = value
  }

  request(message: Partial<WebsocketRequest> = defaultWebsocketRequest): string {
    if(!message?.args) throw new Error('No args found in message')
    if(!message?.args?.hash) {
      message.args.hash = deterministicHash(message?.args?.filters ?? {})  
    }
    const { hash } = message.args
    //console.log('HASH', hash)
    if(!this?.worker) {
      console.warn('[WebsocketAdapter] Error sending command: no worker found')
      return hash
    }
    //console.log('adding subscription', hash)  
    
    
    //console.log(`[WebsocketAdapter:${this.constructor.name}] o/o SEND: ${message.action} -> websocketWorker`, message.args.filters)
    if(this.worker instanceof Worker)
      this.worker.postMessage(message)
    else if(this.worker instanceof SharedWorker)
      this.worker.port.postMessage(message)
    return hash
  }

  async response(hash: string, callbacks?: SubscribeHandlers): Promise<boolean | any[]>{
    //console.log('response', hash)
    return new Promise( resolve => {
      const results: any[] = []
      const responseHandler = (message: WebsocketResponseBody) => {
        //console.log('websocket adapter response handler...')
        let { result, type } = message
        if(type === 'unsubscribed'){
          return true
        }
        if(type === 'aborted'){
          return true
        }
        if(type === 'events') {
          //console.log(`websocket adapter: events`)
          if(callbacks?.onevents){
            //console.log(`websocket adapter: onevents(${result.length})`)
            callbacks.onevents(result)
            return
          }
          for(let event of result){
            if(callbacks?.onevent){
              callbacks.onevent(event)
            }
            else {
              results.push(event)
            }
          }
        }
        else if(type === 'event'){
          if(callbacks?.onevent){
            callbacks.onevent(result)
          }
          else {
            results.push(result)  
          }
        }
        else if(type == 'complete'){
          //console.log('deleting subscription:', hash)
          this.subscriptions.delete(hash)
          //console.log('complete: removing handler.', hash)
          StateManager.off(hash)
          if(callbacks?.onevent){
            //console.log('result:complete', hash, 'resolve: true')
            resolve(true)
          }
          else {
            //console.log('result:complete', hash, `resolve: ${results.length} events`, results)
            resolve(results)
          }
        }
        else {
          console.warn(`[WebsocketAdapter] Unknown response type: ${type}`)
        }
      }
      StateManager.on(hash, responseHandler)
    });
  }

  // bootstrap(filters: Filter[], relays?: string[], callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
  //   const { kinds } = filters[0]
  //   const hash = this.request({
  //     action: 'fetch',
  //     args: {
  //       options: {
  //         cache: true,
  //         returnResults: true,  
  //         keepAlive: true,
  //         stream: true
  //       },
  //       filters,
  //       relays
  //     }
  //   })
  //   return this.response(hash, callbacks)
  // }

  ping(): void {
    if(this.worker instanceof Worker) {
      (this.workers?.websocket as Worker)?.postMessage({type: 'ping'})
    }
    else if(this.worker instanceof SharedWorker) {
      (this.workers?.websocket as SharedWorker)?.port.postMessage({type: 'ping'})
    }
      
  }
  
}