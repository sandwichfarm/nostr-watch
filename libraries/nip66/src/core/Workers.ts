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

  get cacheDedicated(): Worker | undefined {
    return this._cache;
  }

  get channel(): MessageChannel {
    return this._channel;
  }

  // async setupSharedWorkers(adapters: IAdaptersArgument){
  //   //console.log('setupSharedWorkers', adapters)
  //   this._cacheShared = (await adapters.cacheAdapter.newSharedWorker()) as SharedWorker
  //   this._websocketShared = (await adapters.websocketAdapter.newSharedWorker()) as SharedWorker

  //   this._websocketShared.port.start()
  //   this._cacheShared.port.start()

  //   this._websocketShared.port.postMessage({type: 'setup', channelPort: this.channel.port1}, [this.channel.port1]);
  //   this._cacheShared.port.postMessage({type: 'setup', channelPort: this.channel.port2}, [this.channel.port2]);
  // }

  async setupWorkers(adapters: IAdaptersArgument){
    //console.log('setupWorkers', adapters)
    this._cache = (await adapters.cacheAdapter.newWorker()) as Worker
    this._websocket = (await adapters.websocketAdapter.newWorker()) as Worker

    this.websocketDedicated?.postMessage({type: 'setup', channelPort: this.channel.port1}, [this.channel.port1]);
    this.cacheDedicated?.postMessage({type: 'setup', channelPort: this.channel.port2}, [this.channel.port2]);
    this._ready = true;
  }

  static encodeNostrEventArrayAsBuffer (json: IEvent[] | IEvent): ArrayBuffer {
    const jsonString = JSON.stringify(json);
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return uint8Array.buffer; 
  }

  static decodeNostrEventArrayFromBuffer (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(new Uint8Array(arrayBuffer));
    const nostrEvents: IEvent[] | IEvent = JSON.parse(jsonString)
    return nostrEvents;
  }
}