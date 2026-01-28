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
  onclose?: (subId: string) => void
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
  options: WebsocketAdapterOptions,
  filters?: Filter[],
  note?: IEvent,
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

export interface IWebsocketAdapterMethods extends IAdapter {
  connect(): Promise<void>;
  publish(args: Partial<WebsocketRequestBody>): Promise<boolean>;
  subscribe(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;
  fetch(args: WebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>;
  unsubscribe(hash?: string): void;
  unsubscribeAll(): void; 
  disconnect(): void;
  terminate(): void;

  abort(): Promise<boolean>;

  handleSetupInternally?: boolean;
}

export interface IWebsocketAdapter extends IWebsocketAdapterMethods, IAdapter {}

export class WebsocketAdapter extends Adapter implements IWebsocketAdapter {
  static type = 'WebsocketAdapter';
  readonly slug: string = 'WebsocketAdapter:unset';
  private _subscriptions: Set<string> = new Set()
  private _hashData: Record<string, any> = {}

  private static readonly DEFAULT_RESPONSE_TIMEOUT_MS = 120_000;

  constructor(worker?: Worker | SharedWorker | URL) {
    super(worker)
    // StateManager.on('destroy', () => {
    //   if(this.worker instanceof Worker)
    //     this.worker?.terminate()
    // })
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

  async publish(args: Partial<WebsocketRequestBody> = defaultWebsocketRequestBody): Promise<boolean> {
    const pub = this.request({
      action: 'publish',
      args: {
        ...defaultWebsocketRequestBody,
        ...args
      }
    })
    return this.response(pub) as Promise<boolean>
  }

  async unsubscribe(hash?: string): Promise<boolean> {
    if(!hash) return true;

    // Best-effort local cleanup first to avoid leaks/stale subscription state,
    // even if the worker never acknowledges the unsubscribe.
    this.subscriptions.delete(hash);
    try { delete this._hashData[hash]; } catch {}

    // Resolve any in-flight `response()` waiters for this hash.
    try {
      StateManager.emit(hash, { type: 'unsubscribed', result: true, hash } as any);
    } catch {}
    try {
      StateManager.off(hash);
    } catch {}

    // Fire-and-forget worker unsubscribe (worker implementations may not reply).
    this.request({
      action: 'unsubscribe',
      args: {
        ...defaultWebsocketRequestBody,
        hash,
        options: {
          ...defaultWebsocketAdapterOptions,
          returnResults: false,
        },
      },
    });

    return true;
  }

  async unsubscribeAll(hash?: string): Promise<boolean> {
    const hashes = [...Array.from(this.subscriptions)]
    for(const hash of hashes){
      void this.unsubscribe(hash)
    }
    return true;
  }

  async shutdown(): Promise<void> {
    console.log('WebsocketAdapter:shutdown')
    // console.log('WebsocketAdapter:shutdown:unsubscribing', this.subscriptions.size)
    // await this.unsubscribeAll();
    // console.log('WebsocketAdapter:shutdown:unsubscribed', this.subscriptions.size)
    // await this.abort();
    // console.log('WebsocketAdapter:shutdown:aborted')
    // await delay(1000);
    this.terminate()
    console.log('WebsocketAdapter:shutdown:terminated')
    await delay(100);
  }

  async abort(): Promise<boolean> {
    const abort = this.request({
      action: 'abort',
      args: { 
        ...defaultWebsocketRequestBody,
        hash: 'abort',
        options: {
          ...defaultWebsocketAdapterOptions,
          returnResults: true
        }
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
    const { hash, type, result } = response
    console.log(`[WebsocketAdapter] onMessage: type=${type}, hash=${hash?.slice(0,8)}, result=`, Array.isArray(result) ? `${result.length} items` : typeof result);
    StateManager.emit(hash, response)
  } 

  async subscribe(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean>{
    let { hash } = args
    console.log(`[WebsocketAdapter] subscribe called: hash=${hash?.slice(0,8)}, hasWorker=${!!this.worker}`);
    const hasCallbacks = Boolean(callbacks && Object.keys(callbacks).length > 0);
    if (hasCallbacks) {
      args.options.stream = true;
      // Streamed callbacks require the worker to forward results to the adapter.
      args.options.returnResults = true;
    } else {
      // Without callbacks, stream mode provides no benefit and can hang when
      // `returnResults=false` (worker won't forward streamed messages).
      args.options.stream = false;
    }
    if (args?.options?.keepAlive && !hasCallbacks) {
      throw new Error('WebsocketAdapter.subscribe: keepAlive requires callbacks');
    }
    console.log(`[WebsocketAdapter] subscribe: calling request()`);
    const hash_ = this.request({
      action: 'subscribe',
      args
    })
    console.log(`[WebsocketAdapter] subscribe: request() returned hash=${hash_?.slice(0,8)}`);
    if(!hash) hash = hash_
    if(this.subscriptions.has(hash)) {
      console.warn(`[WebsocketAdapter] Already subscribed to ${hash}`)
      return true;
    }
    this.subscriptions.add(hash)
    if (args?.options?.keepAlive) {
      // Do not await completion for keepAlive subscriptions; keep the listener running.
      this.listen(hash, callbacks);
      return true;
    }
    console.log(`[WebsocketAdapter] subscribe: awaiting response()`);
    return this.response(hash, callbacks, { timeoutMs: WebsocketAdapter.DEFAULT_RESPONSE_TIMEOUT_MS }) as Promise<IEvent[] | boolean>
  }

  async fetch(args: WebsocketRequestBody = defaultWebsocketRequestBody, callbacks?: SubscribeHandlers): Promise<IEvent[] | boolean> {
    const hasCallbacks = Boolean(callbacks && Object.keys(callbacks).length > 0);
    if (hasCallbacks) {
      args.options.stream = true;
      args.options.returnResults = true;
    } else {
      args.options.stream = false;
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
    const result = this.response(hash, callbacks, { timeoutMs: WebsocketAdapter.DEFAULT_RESPONSE_TIMEOUT_MS }) as Promise<IEvent[] | boolean> 
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
    console.log(`[WebsocketAdapter] request: action=${message?.action}, hash=${hash?.slice(0,8)}, workerExists=${!!this?.worker}`);
    if(!this?.worker) {
      console.warn('[WebsocketAdapter] Error sending command: no worker found')
      return hash
    }
    if(this.worker instanceof Worker) {
      console.log(`[WebsocketAdapter] request: posting to Worker`);
      this.worker.postMessage(message)
    } else if(this.worker instanceof SharedWorker) {
      console.log(`[WebsocketAdapter] request: posting to SharedWorker`);
      this.worker.port.postMessage(message)
    }
    return hash
  }

  private listen(hash: string, callbacks?: SubscribeHandlers): void {
    const responseHandler = (message: WebsocketResponseBody) => {
      let { result, type } = message
      if(type === 'events') {
        if(callbacks?.onevents){
          callbacks.onevents(result)
          return
        }
        for(let event of result){
          callbacks?.onevent?.(event)
        }
      }
      else if(type === 'event'){
        callbacks?.onevent?.(result)
      }
      else if(type === 'complete'){
        // Call oneose when complete is received (EOSE from relay)
        callbacks?.oneose?.();
        this.subscriptions.delete(hash)
        try { delete this._hashData[hash]; } catch {}
        StateManager.off(hash)
        callbacks?.onclose?.(hash)
      }
      else if(type === 'unsubscribed' || type === 'aborted' || type === 'terminated'){
        this.subscriptions.delete(hash)
        try { delete this._hashData[hash]; } catch {}
        StateManager.off(hash)
        callbacks?.onclose?.(hash)
      }
      else {
        console.warn(`[WebsocketAdapter] Unknown response type: ${type}`)
      }
    }
    StateManager.on(hash, responseHandler)
  }

  async response(
    hash: string,
    callbacks?: SubscribeHandlers,
    options?: { timeoutMs?: number }
  ): Promise<boolean | any[]>{
    const timeoutMs = options?.timeoutMs;
    return new Promise( (resolve) => {
      const results: any[] = []
      let resolved = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finish = (value: boolean | any[]) => {
        if(resolved) return;
        resolved = true;
        if(timeout) clearTimeout(timeout)
        cleanup();
        resolve(value)
      }

      const responseHandler = (message: WebsocketResponseBody) => {
        let { result, type } = message
        if(type === 'unsubscribed' || type === 'aborted' || type === 'terminated'){
          callbacks?.onclose?.(hash)
          return finish(true)
        }
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
          // Call oneose when complete is received (EOSE from relay)
          callbacks?.oneose?.();
          if(callbacks?.onevent){
            return finish(true)
          }
          else if(results){
            return finish(results)
          }
        }
        else {
          console.warn(`[WebsocketAdapter] Unknown response type: ${type}`)
        }
      }

      const cleanup = () => {
        this.subscriptions.delete(hash)
        try { delete this._hashData[hash]; } catch {}
        try {
          StateManager.off(hash, responseHandler as any)
        } catch {
          try { StateManager.off(hash) } catch {}
        }
      }

      if(typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeout = setTimeout(() => {
          if(callbacks?.onevent || callbacks?.onevents) {
            finish(true)
          }
          else {
            finish(results)
          }
        }, timeoutMs)
      }
      StateManager.on(hash, responseHandler)
    });
  }

  ping(): void {
    if(this.worker instanceof Worker) {
      (this.workers?.websocket as Worker)?.postMessage({type: 'ping'})
    }
    else if(this.worker instanceof SharedWorker) {
      (this.workers?.websocket as SharedWorker)?.port.postMessage({type: 'ping'})
    }
      
  }
  
}
