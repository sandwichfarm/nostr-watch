import type { Filter } from 'nostr-tools';

import { Adapter, AdapterMessage, type IAdapter } from './Adapter'
import type { IEvent } from '@models/Event';

export interface IWebsocketAdapterCallbacks {
  onNotice?: (notice: any) => void
  onOk?: (status: any) => void
  onEvent?: (event: IEvent) => void
  onLimits?: (limits: Record<string, any>) => void
  onEose?: () => void
  onClose?: () => void
}

export interface IWebsocketAdapter extends IAdapter {
  populate(filters: Filter[]): void;
}

export interface IWebsocketAdapterMethods {
  connect(): Promise<void>;
  subscribe(filters: Filter[] | Filter): Promise<void>;
  unsubscribe(subId?: string): void;
  disconnect(): void;
  terminate(): void;
  abort(): void;
}

export interface IWebsocketAdapter extends IWebsocketAdapterMethods, IAdapter {}

export class WebsocketAdapter extends Adapter implements IWebsocketAdapter {
  static type = 'WebsocketAdapter';
  static slug: string;
  static metaUrl: string;

  async connect(): Promise<void> {}
  async subscribe(filters: Filter[] | Filter): Promise<void> {}
  disconnect(): void {}
  terminate(): void {}
  abort(): void {}
  unsubscribe(subId?: string): void {}

  get worker(): Worker | undefined {
    return this.workers?.websocketDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.websocketShared
  }

  bindWorkerHandlers(): void {
    if(!this?.workers?.websocketDedicated) return console.warn('[WebsocketAdapter] Error binding worker handlers: no worker found')
    this.workers.websocketDedicated.onmessage = this._onMessage.bind(this);
    this.workers.websocketDedicated.onerror = this._onError.bind(this)
  }

  onMessage(message: AdapterMessage): void {
    //console.log(`!!!! %$%%$% [WebsocketAdapter:${this.constructor.name}] i/i RECV: ${message.type} -> websocketWorker`)
    if(message.result){
      //console.log(`RESULT!`, this.decode(message.result))
    }
  }

  command(destination: string | string[], type: string, filters: Filter[]): void {
    const message: AdapterMessage = {
      type,
      filters
    }
    if(destination.includes('toWorker')){  
      if(!this?.worker) return console.warn('[WebsocketAdapter] Error sending command: no worker found')
      this.worker.postMessage( message )
    }
  }

  populate(filters: Filter[]): void {
    console.log(`[WebsocketAdapter:${this.constructor.name}] populate`, filters)
    const { kinds } = filters[0]
    if(kinds?.includes(10166)) {
      this.command('toWorker', 'subscribeAndCacheAndReturn', filters)
    } 
    else {
      this.command('toWorker', 'subscribeAndCache', filters)
    }
  }

  async fetch(filters: Filter[]): Promise<IEvent[]> {
    this.command('toWorker', 'fetchAndReturnToAdapter', filters)
    return [] as IEvent[]
  }

  ping(): void {
    //console.log(`[WebsocketAdapter:${this.constructor.name}] o/o SEND: PING -> websocketWorker`)
    this.workers?.websocketDedicated?.postMessage({type: 'ping'})
  }

  
  
}