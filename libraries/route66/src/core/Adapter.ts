
import { Workers } from './Workers';
import { LocalStorageWrapper } from './LocalStorageWrapper';

import type { IEvent } from '@base/interfaces';
import type { IAdapterWorkerCommand } from '@base/interfaces/IAdapterWorkerCommand';
import type { AdapterWorkerCommand, AdapterWorkerMessage } from './AdapterWorker';
import { EventEmitter } from 'tseep';

export interface AdapterMessage {
  type?: string;
  hash?: string;
  args?: any;
  [key: string]: any;
}

export interface IAdapter {
  workers?: Workers;
  worker?: Worker | SharedWorker;
  useWorker: boolean;

  newWorker(): Promise<Worker | SharedWorker>;

  ping(): void;

  abort(): Promise<boolean>
  shutdown(): Promise<void>

  // overloads
  onMessage(command: IAdapterWorkerCommand): void;
  onError(error: any): void;
  ready(): Promise<void>;
}

interface WorkerPaths {
  workerPath: URL;
  sharedWorkerPath: URL;
}

export abstract class Adapter {
  readonly slug: string = 'Adapter:unset'; 

  private _ls: LocalStorageWrapper;
  private _workers?: Workers
  private _worker?: Worker | SharedWorker;

  protected _overloadWorker?: Worker | SharedWorker;

  protected _ready: boolean = false;

  useWorker: boolean = true;

  protected emitter: EventEmitter = new EventEmitter();

  constructor( worker?: Worker | SharedWorker | URL, shared?: boolean ) {
    if (worker instanceof Worker) {
      this.overloadWorker = worker;
    } else if(worker instanceof URL) {
      if(shared) {
        this.overloadWorker = new SharedWorker(worker, { type: "module" });
      }
      else {
        this.overloadWorker = new Worker(worker, { type: "module" });
      }
    }
    this._ls = new LocalStorageWrapper(['route66', this.slug])
  }

  get overloadWorker(): Worker | SharedWorker | undefined {
    return this._overloadWorker;
  }

  private set overloadWorker(worker: Worker | SharedWorker) {
    this._overloadWorker = worker;
  }

  get localStorage(): LocalStorageWrapper {
    return this._ls;
  }

  set workers(workers: Workers) {
    this._workers = workers;
    this._bindWorkerHandlers()
  }

  get workers(): Workers | undefined {
    return this._workers;
  }

  get worker(): Worker | SharedWorker | undefined {
    return undefined;
  }

  async healthCheck(): Promise<boolean> {
    if(this.workers?.cache) {
      this.ping()
    }
    const healthy = await this.pong();
    return healthy;
  }

  ping(): void {
    if(this.workers?.cache instanceof Worker) {
      this.workers?.cache?.postMessage({ type: 'ping'})
    }
    else if (this.workers?.cache instanceof SharedWorker) {
      this.workers?.cache?.port.postMessage({ type: 'ping' })
    }
  }

  async pong(): Promise<boolean> {
    return new Promise( resolve => {
      const timeout = setTimeout(() => {
        resolve(false)
      }, 1000)
      const listener = (event: MessageEvent) => {
        const message = event.data as AdapterMessage;
        if(message.type == 'pong') {
          clearTimeout(timeout)
          resolve(true)
        }
      }
      this.emitter.once('pong', listener)
    })
  }

  async shutdown(): Promise<void> {
    if(this?.worker) {
      if(this?.worker instanceof Worker){
        this.worker?.terminate()
      }
    }
    // this.emitter.emit('shutdown')
  }

  async newWorker(): Promise<any> {
    if(this?.overloadWorker) {
      return this.overloadWorker;
    }
    throw new Error('Method not implemented.');
  }

  async ready(): Promise<void> {
    this._ready = true;
    return;
  }

  get isReady(): boolean { 
    return this._ready;
  }

  private _bindWorkerHandlers(): void {
    this.bindWorkerHandlers()
  }

  protected _onMessage(event: MessageEvent): void {
    const message = event.data as AdapterMessage;
    this.onMessage(message);
  }

  protected _onError(error: any): void {
    this.onError()
  }

  protected bindWorkerHandlers(): void {
    console.warn('bindWorkerHandlers is not implemented by class that extends Adapter')
  }
  
  //overloads
  onMessage(message: AdapterWorkerMessage): void {} 
  onError(): void {}

  encode (json: IEvent[] | IEvent ): ArrayBuffer {
    return Workers.encodeNostrEventArrayAsBuffer(json)
  }

  decode (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer)
  }
}
