import { IAdaptersArgument } from '@base/interfaces/IAdaptersArgument';
import { IEvent } from '@models/Event';


export class Workers {
  private _websocketShared?: SharedWorker;
  private _cacheShared?: SharedWorker;

  private _channel: MessageChannel = new MessageChannel();

  private _websocket?: Worker | SharedWorker;
  private _cache?: Worker | SharedWorker;

  private _ready: boolean = false;

  constructor( adapters: IAdaptersArgument ){
    this.setupWorkers( adapters )
  }

  get ready(): boolean {
    return this._ready;
  }

  get websocketWorkers(): Partial<Workers> {
    const { websocket, channel } = this;
    return { websocket, channel };
  }

  get cacheWorkers(): Partial<Workers> {
    const { cache, channel } = this;
    return { cache, channel };
  }

  get websocket(): Worker | SharedWorker | undefined {
    return this._websocket;
  }

  set websocket(worker: Worker | SharedWorker | undefined){
    this._websocket = worker;
  }

  get cache(): Worker | SharedWorker | undefined {
    return this._cache;
  }

  set cache(worker: Worker | SharedWorker | undefined){
    this._cache = worker;
  }

  get channel(): MessageChannel {
    return this._channel;
  }

  async setupWorkers(adapters: IAdaptersArgument){
    if(adapters.cacheAdapter.useWorker){
      this.cache = (await adapters.cacheAdapter.newWorker()) as Worker | SharedWorker
      //console.log('cacheAdapter.newWorker()', this.cache)
    }
    if(adapters.websocketAdapter.useWorker){
      this.websocket = (await adapters.websocketAdapter.newWorker()) as Worker | SharedWorker
      //console.log('websocketAdapter.newWorker()', this.websocket)
    }
    if(adapters.cacheAdapter.useWorker && adapters.websocketAdapter.useWorker){
      const cacheAdapterChannelPort = this.channel.port2;
      const websocketAdapterChannelPort = this.channel.port1;
      if(this.cache instanceof Worker || this.cache instanceof SharedWorker){
        const message = {type: 'setup', channelPort: cacheAdapterChannelPort}
        if(this.cache instanceof Worker) {
          //console.log(`[Workers] setupWorkers() -> cache.postMessage() to Worker`, this.cache, message)
          this.cache.postMessage(message, [cacheAdapterChannelPort]);  
        }
        else if (this.cache instanceof SharedWorker) {
          //console.log(`[Workers] setupWorkers() -> cache.port.postMessage() to SharedWorker`, this.cache, message)
          this.cache.port.postMessage(message, [cacheAdapterChannelPort]);
        }
        
      }
      else {
        console.warn('Cache Worker not defined')
      }
      if(this.websocket instanceof Worker || this.websocket instanceof SharedWorker){
        const message = {type: 'setup', channelPort: websocketAdapterChannelPort}
        if(this.websocket instanceof Worker) {
          //console.log(`[Workers] setupWorkers() [websocket] -> websocket.postMessage() to Worker`, message)
          this.websocket.postMessage(message, [websocketAdapterChannelPort]);
        }
        else if(this.websocket instanceof SharedWorker) {
          //console.log(`[Workers] setupWorkers() [websocket] -> websocket.port.postMessage() to SharedWorker`, message)
          this.websocket.port.postMessage(message, [websocketAdapterChannelPort]);
        }
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