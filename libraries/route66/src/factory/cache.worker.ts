import { AdapterWorker } from '@base/core';
import type { ISharedWorkerGlobalScope, IWorkerGlobalScope } from '@interfaces/index';
import type { IAdapterWorkerCommand } from '@interfaces/IAdapterWorkerCommand';

export interface ICacheAdapterWorker {
  onMessage: (command: IAdapterWorkerCommand) => void;
  onError: (error: any) => void;
  onMessageError: (error: any) => void;
}

export default (_AdapterWorker_: typeof AdapterWorker, mainThread: IWorkerGlobalScope | ISharedWorkerGlobalScope): any  => {
  return new _AdapterWorker_( { mainThread } );
}