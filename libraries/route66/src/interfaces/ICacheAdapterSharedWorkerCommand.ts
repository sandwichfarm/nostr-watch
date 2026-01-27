import { ISharedWorkerGlobalScope } from "./ISharedWorkerGlobalScope";
import { IWorkerCommand } from "./IWorkerCommand";
import { IWorkerGlobalScope } from "./IWorkerGlobalScope";

export interface ICacheAdapterSharedWorkerCommand extends IWorkerCommand {
  channelPort?: MessagePort
  mainThread?: IWorkerGlobalScope | ISharedWorkerGlobalScope;
}