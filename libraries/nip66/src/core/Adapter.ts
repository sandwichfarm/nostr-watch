
import { Workers } from './Workers';
import { LocalStorageWrapper } from './LocalStorageWrapper';

import type { IEvent } from '@base/interfaces';
import type { IAdapterWorkerCommand } from '@base/interfaces/IAdapterWorkerCommand';
import type { AdapterWorkerCommand, AdapterWorkerMessage } from './AdapterWorker';

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

  newWorker(): Promise<Worker | SharedWorker>;

  // bindWorkerHandlers(): void;
  // _onMessage(event: MessageEvent): void;
  // _onError(error: any): void;

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

  protected _overloadWorker?: Worker | SharedWorker;

  protected _ready: boolean = false;

  useWorker: boolean = true;

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
    this._ls = new LocalStorageWrapper(['nip66', this.slug])
  }

  async newWorker(): Promise<any> {
    if(this?.overloadWorker) {
      return this.overloadWorker;
    }
    throw new Error('Method not implemented.');
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

  async ready(): Promise<void> {
    return;
  }

  private _bindWorkerHandlers(): void {
    this.bindWorkerHandlers()
  }

  protected _onMessage(event: MessageEvent): void {
    //console.log(`[Adapter:${this.constructor.name}] i/i RECV: <- worker`, event.data)
    const message = event.data as AdapterMessage;
    this.listenPong(message)
    this.onMessage(message);
  }

  protected _onError(error: any): void {
    this.onError()
  }

  protected bindWorkerHandlers(): void {
    console.warn('bindWorkerHandlers is not implemented by class that extends Adapter')
  }

  listenPong(command: AdapterWorkerCommand): void {
    if(command.type == 'pong') {
      //console.log(`[Adapter:${this.constructor.name}] i/i RECV: PONG <- worker`)
    }
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
