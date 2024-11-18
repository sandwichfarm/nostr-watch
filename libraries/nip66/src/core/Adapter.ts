import { IAdapterWorkerCommand } from '@base/interfaces/IAdapterWorkerCommand';
import { Workers } from './Workers';
import { IEvent } from '@base/interfaces';
import { AdapterWorkerCommand, AdapterWorkerMessage } from './AdapterWorker';
import { LocalStorageWrapper } from './LocalStorageWrapper';
import { deterministicHash } from '@base/utils/hash';
import { EventEmitter } from 'tseep'

export interface AdapterMessage {
  type?: string;
  hash?: string;
  args?: any;
  [key: string]: any;
}

export interface IAdapter {
  worker?: SharedWorker | Worker; 
  workers?: Workers;
  useWorker: boolean;

  newWorker(channelPort: MessagePort): Promise<Worker>;

  // command(adapter: "cache" | "websocket", channel: string, type: string, args: any[]): string | undefined;
  // commandResponse(hash: string): Promise<any>;

  bindWorkerHandlers(): void;
  _onMessage(event: MessageEvent): void;
  _onError(error: any): void;

  // overloads
  onMessage(command: IAdapterWorkerCommand): void;
  onError(error: any): void;

  ready(): Promise<void>;

  ping(): void;
}

interface WorkerPaths {
  workerPath: URL;
  sharedWorkerPath: URL;
}


export abstract class Adapter {
  readonly slug: string = 'Adapter:unset'; 

  private _ls: LocalStorageWrapper;
  // private _subscriptions: Map<string, any> = new Map();
  private _workers?: Workers

  protected emitter: EventEmitter = new EventEmitter()
  protected _worker?: Worker | SharedWorker;

  useWorker: boolean = true;

  constructor() {
    this._ls = new LocalStorageWrapper(['nip66', this.slug])
  }

  get localStorage(): LocalStorageWrapper {
    return this._ls;
  }

  set workers(workers: Workers) {
    this._workers = workers;
    this._bindWorkerHandlers()
    // setTimeout( () => this._bindWorkerHandlers(), 1000 )
  }

  get workers(): Workers | undefined {
    return this._workers;
  }

  async ready(): Promise<void> {}

  private _bindWorkerHandlers(): void {
    //console.log('bindWorkerHandlers()')
    this.bindWorkerHandlers()
  }

  bindWorkerHandlers(): void {
    console.warn('bindWorkerHandlers is not implemented by class that extends Adapter')
  }

  listenPong(command: AdapterWorkerCommand): void {
    if(command.type == 'pong') {
      console.log(`[Adapter:${this.constructor.name}] i/i RECV: PONG <- worker`)
    }
  }

  _onMessage(event: MessageEvent): void {
    const message = event.data as AdapterMessage;
    this.listenPong(message)
    this.onMessage(message);
    // if(message.hash) {
    //   const subscription = this._subscriptions.get(message.hash)
    //   if(subscription) {
    //     subscription.result = message.result
    //     this._subscriptions.set(message.hash, subscription)
    //   }
    // }
  }

  _onError(error: any): void {
    //console.log('Adapter.ts: ERROR', error)  
    this.onError()
  }
  
  //overloads
  onMessage(message: AdapterWorkerMessage): void {} 
  onError(): void {}

  // command(adapter: "cache" | "websocket", channel: "main" | "worker", type: string, _args: any[]): string | undefined {
  //   const hash = deterministicHash(_args)
  //   const args = this.encode(_args) as ArrayBuffer
  //   if(this._subscriptions.has(hash)) {
  //     console.warn(`[Adapter:${this.constructor.name}] Error sending command to ${adapter} hash already exists`)
  //     return
  //   }
  //   this._subscriptions.set(hash, { args, result: null })
  //   const message: AdapterMessage = {
  //     type,
  //     hash,
  //     args
  //   }
  //   const portNumber = adapter === 'websocket'? 1 : 2
  //   const port: Worker | MessagePort | undefined = channel === 'main'? this.workers?.[`${adapter}Dedicated`] : this.workers?.channel?.[`port${portNumber}`]
  //   if(!port) {
  //     console.warn(`[Adapter:${this.constructor.name}] Error sending command to ${adapter} no port found`)
  //     return 
  //   }
  //   port.postMessage(message)
  //   return hash
  // }

  // commandResponse(hash: string): Promise<any> {
  //   return new Promise((resolve, reject) => {
  //     const interval = setInterval(() => {
  //       const subscription = this._subscriptions.get(hash)
  //       if(subscription?.result) {
  //         clearInterval(interval)
  //         this._subscriptions.delete(hash)
  //         const result = this.decode(subscription.result)
  //         resolve(result)
  //       }
  //     }, 100)
  //   })
  // }

  // postMessageWorker( command: AdapterWorkerMessage, transfer?: Transferable[] ): void {
  //   if(!this?.mainThread) return console.warn(`cannot send message to mainThread: undefined`)
  //   this.mainThread.postMessage( command, transfer )
  // }

  // postMessageChannel( command: AdapterWorkerMessage, transfer?: Transferable[]  ): void {
  //   if(!this?.channel) return console.warn(`cannot send message through message channel: undefined`)
  //   if(transfer) {
  //     return this.channel.postMessage( command, transfer )
  //   }
  //   this.channel.postMessage( command )
  // }


  async newWorker(channelPort: MessagePort): Promise<any> {
    // const slug = (<any>this).slug;
    // const metaUrl = (<any>this).metaUrl;

    // if(!slug) {
    //   throw new Error(`slug is not set in ${this.constructor.name}`);
    // }
    // if(!metaUrl) {
    //   throw new Error(`metaUrl is not set in ${this.constructor.name}`);
    // }
    // return new Worker(Adapter.generatePaths(slug, metaUrl).workerPath, {type: 'module'});
  }

  // async newSharedWorker(): Promise<SharedWorker> {
  //   //console.log('newSharedWorker', this)
  //   const slug = (<any>this).slug;
  //   const metaUrl = (<any>this).metaUrl;

  //   if(!slug) {
  //     throw new Error(`slug is not set in ${this.constructor.name}`);
  //   }
  //   if(!metaUrl) {
  //     throw new Error(`metaUrl is not set in ${this.constructor.name}`);
  //   }
  //   const swURL = Adapter.generatePaths(slug, metaUrl).sharedWorkerPath
  //   return new SharedWorker(swURL.href, { type: 'module' });
  // }

  // private _workerPaths(): WorkerPaths {
  //   const constructor = this.constructor;
  //   //console.log('this.constructor:', constructor);
  
  //   const slug = (constructor as typeof Adapter).slug;
  //   const metaUrl = (constructor as typeof Adapter).metaUrl;
  
  //   //console.log('_workerPaths slug:', slug); 
  //   //console.log('_workerPaths metaUrl:', metaUrl);
  
  //   if (!slug) {
  //     throw new Error('slug is not set');
  //   }
  //   if (!metaUrl) {
  //     throw new Error('metaUrl is not set');
  //   }
  
  //   return (constructor as typeof Adapter).generatePaths(slug, metaUrl);
  // }

  // static generatePaths(slug: string, metaUrl: string): WorkerPaths {
  //   //console.log('generatePaths', slug, metaUrl)
  //   const packageBase = new URL(metaUrl).pathname.split('/').slice(0, -2).join('/');
  //   const workerPath = new URL(`${packageBase}/workers/${slug}.worker.js`, metaUrl);
  //   const sharedWorkerPath = new URL(`${packageBase}/workers/${slug}.shared.worker.js`, metaUrl);

  //   return {
  //     workerPath,
  //     sharedWorkerPath,
  //   };
  // }

  encode (json: IEvent[] | IEvent ): ArrayBuffer {
    return Workers.encodeNostrEventArrayAsBuffer(json)
  }

  decode (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer)
  }
}
