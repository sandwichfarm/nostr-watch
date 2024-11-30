import { ISharedWorkerGlobalScope } from "./ISharedWorkerGlobalScope";
import { IWorkerCommand } from "./IWorkerCommand";
import { IWorkerGlobalScope } from "./IWorkerGlobalScope";

export interface IAdapterWorkerCommand extends IWorkerCommand {
  channelPort?: MessagePort
  mainThread?: IWorkerGlobalScope | ISharedWorkerGlobalScope;
}