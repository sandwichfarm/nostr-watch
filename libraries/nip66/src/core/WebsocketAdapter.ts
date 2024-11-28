import type { Filter } from 'nostr-tools';

import { Adapter, AdapterMessage, type IAdapter } from './Adapter'
import type { IEvent } from '@models/Event';
import { deterministicHash } from '@base/utils/hash';
import { defaultWebsocketResponseBody, WebsocketResponseBody } from './AdapterWebsocketWorker';
import { StateManager } from '@base/managers/StateManager';

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
  use: string,
}

export type WebsocketRequestBody = {
  filters: Filter[],
  options: WebsocketAdapterOptions,
  hash?: string,
  relays?: string[],
}

export const defaultWebsocketRequestHeader: WebsocketRequestHeader = {
  adapter: 'websocket',
  from: 'worker',
  use: 'fetch',
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
  unsubscribe(subId?: string): void;
  disconnect(): void;
  terminate(): void;
  bootstrap(filters: Filter[], relays?: string[], callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;
}

export interface IWebsocketAdapter extends IWebsocketAdapterMethods, IAdapter {}

export class WebsocketAdapter extends Adapter implements IWebsocketAdapter {
  static type = 'WebsocketAdapter';
  readonly slug: string = 'WebsocketAdapter:unset';
  private _subscriptions: Set<string> = new Set()
  private _hashData: Record<string, any> = {}

  constructor(worker?: Worker | URL) {
    super(worker)
    StateManager.on('destroy', () => {
      this.worker?.terminate()
    })
  }

  get worker(): Worker | undefined {
    return this.workers?.websocketDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.websocketShared
  }

  get subscriptions(): Set<string> {
    return this._subscriptions
  }

  async connect(): Promise<void> {}
  disconnect(): void {}
  terminate(): void {}
  unsubscribe(subId?: string): void {}

  newWorker(): Promise<Worker> {
    throw new Error('Method not implemented.');
  }

  protected bindWorkerHandlers(): void {
    if(!this?.workers?.websocketDedicated) return console.warn('[WebsocketAdapter] Error binding worker handlers: no worker found')
    this.workers.websocketDedicated.onmessage = this._onMessage.bind(this);
    this.workers.websocketDedicated.onerror = this._onError.bind(this)
  }

  onMessage(response: WebsocketResponseBody): void {
    console.log(`[WebsocketAdapter:${this.constructor.name}] i/i RECEIVE: ${response.type} <- websocketWorker`, response)
    const { hash } = response
    // response.result = this.decode(response.result)
    // if(!response?.result) return console.warn(`[WebsocketAdapter] Error: no result found in response`)
    // console.log(`[WebsocketAdapter]:${this.constructor.name}] ${hash} is valid: ${hash && this.subscriptions.has(hash)}`, response)
    // if(hash && this.subscriptions.has(hash)){
    StateManager.emit(hash, response)
    //   if(hash === 'c9dc5037'){
    //     console.log(hash, response)
    //   }
    // }
  } 

  async subscribe(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>{
    if(callbacks && Object.keys(callbacks).length > 0) {
      args.options.stream = true
    }
    const hash = this.request({
      use: 'subscribe',
      args
    })
    return this.response(hash, callbacks) as Promise<IEvent[] | boolean>
  }

  async fetch(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    if(callbacks && Object.keys(callbacks).length > 0) {
      args.options.stream = true
    }
    const hash = this.request({
      use: 'fetch',
      args
    })
    const result = this.response(hash, callbacks) as Promise<IEvent[] | boolean>
    console.log(`[WebsocketAdapter:${this.constructor.name}] fetch result:`, result)  
    return result;
  } 

  setHashData(hash: string, key: string, value: any): void {
    if(!this._hashData[hash]) this._hashData[hash] = {}
    this._hashData[hash][key] = value
  }

  request(message: Partial<WebsocketRequest> = defaultWebsocketRequest): string {
    if(!message?.args) throw new Error('No args found in message')
    const hash = deterministicHash(message?.args?.filters ?? {})
    message.args.hash = hash;
    if(!this?.worker) {
      console.warn('[WebsocketAdapter] Error sending command: no worker found')
      return hash
    }
    console.log(`[WebsocketAdapter:${this.constructor.name}] o/o SEND: ${message.use} -> websocketWorker`)
    this.subscriptions.add(hash)
    this.worker.postMessage(message)
    return hash
  }

  async response(hash: string, callbacks?: SubscribeHandlers): Promise<boolean | any[]>{
    return new Promise( resolve => {
      const results: any[] = []
      const responseHandler = (message: WebsocketResponseBody) => {
        let { result, type } = message
        if(type === 'events') {
          if(callbacks?.onevents){
            callbacks.onevents(result)
            return
          }
          for(let event of result){
            if(callbacks?.onevent){
              callbacks.onevent(event)
            }
            else {
              results.push(...event)
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
          console.log('[WebsocketAdapter] complete')
          if(callbacks?.onevent){
            resolve(true)
          }
          else {
            resolve(results)
          }
          // this.subscriptions.delete(hash)
          // StateManager.off(hash)
        }
        else {
          console.warn(`[WebsocketAdapter] Unknown response type: ${type}`)
          console.log(message)
        }
      }
      StateManager.on(hash, responseHandler)
    });
  }

  bootstrap(filters: Filter[], relays?: string[], callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    console.log(`[WebsocketAdapter:${this.constructor.name}] populate`, filters)
    const { kinds } = filters[0]
    const hash = this.request({
      use: 'fetch',
      args: {
        options: {
          cache: true,
          returnResults: true,  
          keepAlive: true,
          stream: true
        },
        filters,
        relays
      }
    })
    console.log(`[WebsocketAdapter:${this.constructor.name}] request hash: ${hash}`)
    return this.response(hash, callbacks)
  }

  ping(): void {
    console.log(`[WebsocketAdapter:${this.constructor.name}] o/o SEND: PING -> websocketWorker`)
    this.workers?.websocketDedicated?.postMessage({type: 'ping'})
  }
  
}