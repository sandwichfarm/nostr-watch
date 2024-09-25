import { ICacheAdapter } from '@core/CacheAdapter';
import { IWebsocketAdapter } from '@core/WebsocketAdapter';

import { INostrEvent } from '@interfaces/INostrEvent';

// export interface WorkerPayload {
//   type: string;
//   cachePort?: MessagePort;
//   websocketPort?: MessagePort;
// }

export class Workers {
  private _websocketShared?: SharedWorker;
  private _cacheShared?: SharedWorker;

  private _channel: MessageChannel = new MessageChannel();

  private _websocket?: Worker;
  private _cache?: Worker;

  constructor(WebsocketAdapter: IWebsocketAdapter, CacheAdapter: ICacheAdapter){
    this.setupSharedWorkers(WebsocketAdapter, CacheAdapter)
    // this.setupWorkers(WebsocketAdapter, CacheAdapter) 
  }

  get websocketShared(): SharedWorker | undefined {
    return this._websocketShared;
  }

  get cacheShared(): SharedWorker | undefined {
    return this._cacheShared;
  }

  get websocketDedicated(): Worker | undefined {
    return this._websocket;
  }

  get cacheDedicated(): Worker | undefined {
    return this._cache;
  }

  get channel(): MessageChannel {
    return this._channel;
  }

  setupSharedWorkers(WebsocketAdapter: IWebsocketAdapter, CacheAdapter: ICacheAdapter){
    this._websocketShared = WebsocketAdapter.newSharedWorker() as SharedWorker
    this._cacheShared = CacheAdapter.newSharedWorker() as SharedWorker

    this._websocketShared.port.start()
    this._cacheShared.port.start()

    this._websocketShared.port.postMessage({type: 'setup', channelPort: this.channel.port1}, [this.channel.port1]);
    this._cacheShared.port.postMessage({type: 'setup', channelPort: this.channel.port2}, [this.channel.port2]);
  }

  static encodeNostrEventArrayAsBuffer (json: INostrEvent[]): ArrayBufferLike {
    const jsonString = JSON.stringify(json);
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return uint8Array.buffer;
  }

  static decodeNostrEventArrayFromBuffer (arrayBuffer: ArrayBufferLike): INostrEvent[] {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
    const nostrEvents: INostrEvent[] = JSON.parse(jsonString)
    return nostrEvents;
  }

  // setupWorkers(WebsocketAdapter: IWebsocketAdapter, CacheAdapter: ICacheAdapter){
  //   this.setupSharedWorkers(WebsocketAdapter, CacheAdapter)

  //   const payload: IWorkerCommand = { type: 'setup'}
  //   const transferrable: Transferable[]  = []

  //   if(this.cacheShared?.port) {
  //     payload['cachePort'] = this.cacheShared.port
  //     transferrable.push(this.cacheShared.port)
  //   }

  //   if(this.websocketShared?.port) {
  //     payload['websocketPort'] = this.websocketShared.port
  //     transferrable.push(this.websocketShared.port)
  //   }

  //   if(transferrable.length !== 2) {
  //     throw new Error('Could not setup workers')
  //   }
  
  //   this._websocket = WebsocketAdapter.newWorker() as Worker;
  //   this._websocket.postMessage(payload, transferrable);
  
  //   this._cache = CacheAdapter.newWorker() as Worker;
  //   this._cache.postMessage(payload, transferrable);
  // }


}