interface WorkerPaths {
  workerPath: string;
  sharedWorkerPath: string;
}

export class Adapter {
  static slug: string; 

  protected _worker?: Worker;
  protected _sharedWorker?: SharedWorker;

  set _workers(workers: { worker: Worker, sharedWorker: SharedWorker }) {
    const { worker, sharedWorker } = workers;
    this._worker = worker;
    this._sharedWorker = sharedWorker;
  }

  get worker(): Worker | undefined {
    return this._worker;
  }

  get sharedWorker(): SharedWorker | undefined {
    return this._sharedWorker;
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
