import { Adapter } from './Adapter'

export class CacheAdapter extends Adapter {

  private _websocketWorker?: Worker;
  private _websocketSharedWorker?: SharedWorker;

  set workers(workers: { cacheWorker: Worker, cacheSharedWorker: SharedWorker, websocketWorker: Worker, websocketSharedWorker: SharedWorker }) {
    const { cacheWorker, cacheSharedWorker, websocketWorker, websocketSharedWorker } = workers;
    this._workers = { worker: cacheWorker, sharedWorker: cacheSharedWorker };
    this._websocketWorker = websocketWorker;
    this._websocketSharedWorker = websocketSharedWorker;
  }

}