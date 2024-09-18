import { AdapterCacheWorker, AdapterWorker, CacheAdapter } from '@base/core';
import { IWorkerGlobalScope } from '@base/interfaces';
import { IAdapterWorkerCommand } from '@interfaces/IAdapterWorkerCommand';

export interface ICacheAdapterWorker {
  onMessage: (command: IAdapterWorkerCommand) => void;
  onError: (error: any) => void;
  onMessageError: (error: any) => void;
}

export default (_AdapterWorker_: typeof AdapterWorker, root: IWorkerGlobalScope): any  => {
  return new _AdapterWorker_( { mainThread: root } );
}