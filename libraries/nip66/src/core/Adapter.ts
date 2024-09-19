import type { Workers } from './Workers';

export interface IAdapter {
  worker?: SharedWorker | Worker; 

  newWorker(): Worker;
  newSharedWorker(): SharedWorker;  
}

interface WorkerPaths {
  workerPath: string;
  sharedWorkerPath: string;
}

type WorkersArgument = {
  worker?: Worker;
  sharedWorker?: SharedWorker;
};


export class Adapter {
  static slug: string; 

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
    return this.generatePaths(this.slug);
  }

  newWorker(): Worker {
    return new Worker(this._getWorkerPaths().workerPath, {type: 'module'});
  }

  newSharedWorker(): SharedWorker {
    return new SharedWorker(this._getWorkerPaths().sharedWorkerPath, {type: 'module'});
  }

  private _getWorkerPaths(): WorkerPaths {
    return (this.constructor as typeof Adapter).generatePaths((this.constructor as typeof Adapter).slug); 
  }

  static generatePaths(slug: string): WorkerPaths {
    return {
      workerPath: `./workers/${slug}.worker.js`,
      sharedWorkerPath: `./workers/${slug}.shared.worker.js`,
    };
  }
}
