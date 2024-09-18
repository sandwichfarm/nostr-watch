import { IWorkerCommand } from "./IWorkerCommand";

export interface ICacheAdapterSharedWorkerCommand extends IWorkerCommand {
  type: "setup" |  "bulkAddRelays" | "bulkAddMonitors" | "query"
  channelPort?: MessagePort
  mainThreadPort?: MessagePort;
  sharedWorkerPort?: MessagePort;
}