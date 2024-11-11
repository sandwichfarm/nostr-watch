import { IAdapterWorkerCommand } from '@base/interfaces/IAdapterWorkerCommand';
import { Workers } from './Workers';
import { IEvent } from '@base/interfaces';
import { AdapterWorkerCommand, AdapterWorkerMessage } from './AdapterWorker';

export interface AdapterMessage {
  type?: string;
  [key: string]: any;
}

export interface IAdapter {
  worker?: SharedWorker | Worker; 
  workers?: Workers;
  useWorker: boolean;

  newWorker(): Promise<Worker>;

  bindWorkerHandlers(): void;
  _onMessage(event: MessageEvent): void;
  _onError(error: any): void;

  // overloads
  onMessage(command: IAdapterWorkerCommand): void;
  onError(error: any): void;

  ping(): void;
}

interface WorkerPaths {
  workerPath: URL;
  sharedWorkerPath: URL;
}


export class Adapter {
  static slug: string; 
  static metaUrl: string;

  private _workers?: Workers

  useWorker: boolean = true;

  set workers(workers: Workers) {
    this._workers = workers;
    this._bindWorkerHandlers()
    // setTimeout( () => this._bindWorkerHandlers(), 1000 )
  }

  get workers(): Workers | undefined {
    return this._workers;
  }

  private _bindWorkerHandlers(): void {
    //console.log('bindWorkerHandlers()')
    this.bindWorkerHandlers()
  }

  bindWorkerHandlers(): void {
    console.warn('bindWorkerHandlers is not implemented by class that extends Adapter')
  }

  listenPong(command: AdapterWorkerCommand): void {
    //console.log('listenPong', command)  
    if(command.type == 'pong') {
      //console.log(`[Adapter:${this.constructor.name}] i/i RECV: PONG <- worker`)
    }
  }

  _onMessage(event: MessageEvent): void {
    //console.log(`Adapter._onMessage()`, event.data)
    const message = event.data as AdapterWorkerMessage;
    this.listenPong(message)
    this.onMessage(message);
  }

  _onError(error: any): void {
    //console.log('Adapter.ts: ERROR', error)  
    this.onError()
  }
  
  //overloads
  onMessage(message: AdapterWorkerMessage): void {} 
  onError(): void {}

  async newWorker(): Promise<Worker> {
    //console.log('Adapter.ts: newWorker()', this)
    const slug = (<any>this).slug;
    const metaUrl = (<any>this).metaUrl;

    if(!slug) {
      throw new Error(`slug is not set in ${this.constructor.name}`);
    }
    if(!metaUrl) {
      throw new Error(`metaUrl is not set in ${this.constructor.name}`);
    }
    return new Worker(Adapter.generatePaths(slug, metaUrl).workerPath, {type: 'module'});
  }

  async newSharedWorker(): Promise<SharedWorker> {
    //console.log('newSharedWorker', this)
    const slug = (<any>this).slug;
    const metaUrl = (<any>this).metaUrl;

    if(!slug) {
      throw new Error(`slug is not set in ${this.constructor.name}`);
    }
    if(!metaUrl) {
      throw new Error(`metaUrl is not set in ${this.constructor.name}`);
    }
    const swURL = Adapter.generatePaths(slug, metaUrl).sharedWorkerPath
    return new SharedWorker(swURL.href, { type: 'module' });
  }

  private _workerPaths(): WorkerPaths {
    const constructor = this.constructor;
    //console.log('this.constructor:', constructor);
  
    const slug = (constructor as typeof Adapter).slug;
    const metaUrl = (constructor as typeof Adapter).metaUrl;
  
    //console.log('_workerPaths slug:', slug); 
    //console.log('_workerPaths metaUrl:', metaUrl);
  
    if (!slug) {
      throw new Error('slug is not set');
    }
    if (!metaUrl) {
      throw new Error('metaUrl is not set');
    }
  
    return (constructor as typeof Adapter).generatePaths(slug, metaUrl);
  }

  static generatePaths(slug: string, metaUrl: string): WorkerPaths {
    //console.log('generatePaths', slug, metaUrl)
    const packageBase = new URL(metaUrl).pathname.split('/').slice(0, -2).join('/');
    const workerPath = new URL(`${packageBase}/workers/${slug}.worker.js`, metaUrl);
    const sharedWorkerPath = new URL(`${packageBase}/workers/${slug}.shared.worker.js`, metaUrl);

    return {
      workerPath,
      sharedWorkerPath,
    };
  }

  encode (json: IEvent[] | IEvent ): ArrayBuffer {
    return Workers.encodeNostrEventArrayAsBuffer(json)
  }

  decode (arrayBuffer: ArrayBuffer): IEvent[] | IEvent {
    return Workers.decodeNostrEventArrayFromBuffer(arrayBuffer)
  }
}
