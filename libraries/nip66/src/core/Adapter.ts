
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

  newWorker(): Promise<Worker>;

  // bindWorkerHandlers(): void;
  // _onMessage(event: MessageEvent): void;
  // _onError(error: any): void;

  ping(): void;

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

  private _overloadWorker?: Worker;

  useWorker: boolean = true;

  constructor( worker?: Worker | URL ) {
    if (worker instanceof Worker) {
      this.overloadWorker = worker;
    } else if(worker instanceof URL) {
      this.overloadWorker = new Worker(worker, { type: "module" });
    }
    this._ls = new LocalStorageWrapper(['nip66', this.slug])
  }

  async newWorker(): Promise<any> {
    if(this?._overloadWorker) {
      return this._overloadWorker;
    }
    throw new Error('Method not implemented.');
  }

  set overloadWorker(worker: Worker) {
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

  async ready(): Promise<void> {}

  private _bindWorkerHandlers(): void {
    this.bindWorkerHandlers()
  }

  protected _onMessage(event: MessageEvent): void {
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
      console.log(`[Adapter:${this.constructor.name}] i/i RECV: PONG <- worker`)
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
