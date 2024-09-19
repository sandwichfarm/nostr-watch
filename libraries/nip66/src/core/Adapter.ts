import type { Workers } from './Workers';

export interface IAdapter {
  worker?: SharedWorker | Worker; 
  workers?: Workers;

  newWorker(): Worker;
  newSharedWorker(): SharedWorker;  
}

interface WorkerPaths {
  workerPath: string;
  sharedWorkerPath: string;
}

// type WorkersArgument = {
//   worker?: Worker;
//   sharedWorker?: SharedWorker;
// };

export class Adapter {
  static slug: string; 
  static metaUrl: string;

  private _workers?: Workers

  set workers(workers: Workers) {
    this._workers = workers;
  }

  get workers(): Workers | undefined {
    return this._workers;
  }

  static newWorker(): Worker {
    return new Worker(this.workerPaths.workerPath, {type: 'module'});
  }

  static newSharedWorker(): SharedWorker {
    return new SharedWorker(this.workerPaths.sharedWorkerPath, {type: 'module'});
  }

  static get workerPaths(): WorkerPaths {
    return this.generatePaths(this.slug, this.metaUrl);
  }

  newWorker(): Worker {
    return new Worker(this._workerPaths().workerPath, {type: 'module'});
  }

  newSharedWorker(): SharedWorker {
    return new SharedWorker(this._workerPaths().sharedWorkerPath, {type: 'module'});
  }

  private _workerPaths(): WorkerPaths {
    const slug = (this.constructor as typeof Adapter).slug;
    const metaUrl = (this.constructor as typeof Adapter).metaUrl;

    return (this.constructor as typeof Adapter).generatePaths(slug, metaUrl); 
  }

  static generatePaths(slug: string, metaUrl: string): WorkerPaths {
    return {
      workerPath: new URL(`./workers/${slug}.worker.js`, metaUrl).toString(),
      sharedWorkerPath: new URL(`./workers/${slug}.shared.worker.js`, metaUrl).toString(),
    };
  }
}
