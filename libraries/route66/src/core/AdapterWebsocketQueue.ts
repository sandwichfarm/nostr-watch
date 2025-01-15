import { 
  AdapterWebsocketWorkerCommand 
} from "@base/core";

import { 
  Queue
} from "@nostrwatch/route66/core";  

const DEFAULT_CONCURRENCY = 1;

export type AdapterWebsocketQueueWorker = (task: AdapterWebsocketWorkerCommand) => Promise<void>;

export class AdapterWebsocketQueue extends Queue<AdapterWebsocketWorkerCommand> {
  constructor(
    taskWorker: AdapterWebsocketQueueWorker, 
    concurrency: number = DEFAULT_CONCURRENCY) 
  {
    super(taskWorker, concurrency);
  }
}