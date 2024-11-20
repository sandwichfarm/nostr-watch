import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { IEvent } from '@models/Event';


export class Workers {
  private _websocketShared?: SharedWorker;
  private _cacheShared?: SharedWorker;

  private _channel: MessageChannel = new MessageChannel();

  private _websocket?: Worker;
  private _cache?: Worker;

  private _ready: boolean = false;

  constructor( adapters: IAdaptersArgument ){
    this.setupWorkers( adapters )
  }

  get ready(): boolean {
    return this._ready;
  }

  get websocketWorkers(): Partial<Workers> {
    const { websocketShared, websocketDedicated, channel } = this;
    return { websocketShared, websocketDedicated, channel };
  }

  get cacheWorkers(): Partial<Workers> {
    const { cacheShared, cacheDedicated, channel } = this;
    return { cacheShared, cacheDedicated, channel };
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

  set websocketDedicated(worker: Worker | undefined){
    this._websocket = worker;
  }

  get cacheDedicated(): Worker | undefined {
    return this._cache;
  }

  set cacheDedicated(worker: Worker | undefined){
    this._cache = worker;
  }

  get channel(): MessageChannel {
    return this._channel;
  }

  async setupWorkers(adapters: IAdaptersArgument){
    if(adapters.cacheAdapter.useWorker){
      this.cacheDedicated = (await adapters.cacheAdapter.newWorker(this.channel.port2)) as Worker
    }
    if(adapters.websocketAdapter.useWorker){
      this.websocketDedicated = (await adapters.websocketAdapter.newWorker(this.channel.port1)) as Worker
    }
    if(adapters.cacheAdapter.useWorker && adapters.websocketAdapter.useWorker){
      if(this.cacheDedicated?.postMessage){
        const message = {type: 'setup', channelPort: this.channel.port2}
        console.log(`[Workers] setupWorkers() -> cacheDedicated.postMessage()`, message)
        this.cacheDedicated.postMessage(message, [this.channel.port2]);  
      }
      else {
        console.warn('Cache Worker not defined')
      }
      if(this.websocketDedicated?.postMessage){
        this.websocketDedicated?.postMessage({type: 'setup', channelPort: this.channel.port1}, [this.channel.port1]);
      }
      else {
        console.warn('Websocket Worker not defined')
      }
    }
    this._ready = true;
  }

  static encodeNostrEventArrayAsBuffer (json: IEvent[] | IEvent): ArrayBuffer {
    if(json instanceof ArrayBuffer) return json as unknown as ArrayBuffer;
    const jsonString = JSON.stringify(json);
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return uint8Array.buffer; 
  }

  static decodeNostrEventArrayFromBuffer (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    if(!(arrayBuffer instanceof ArrayBuffer)) return arrayBuffer as IEvent[] | IEvent;
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
    const nostrEvents: IEvent[] | IEvent = JSON.parse(jsonString)
    return nostrEvents;
  }
}