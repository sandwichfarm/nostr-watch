import { IWorkerCommand } from "./IWorkerCommand";

export interface ICacheAdapterSharedWorkerCommand extends IWorkerCommand {
  channelPort?: MessagePort
  mainThreadPort?: MessagePort;
  sharedWorkerPort?: MessagePort;
}