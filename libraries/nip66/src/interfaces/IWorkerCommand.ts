export interface IWorkerCommand {
  type: string;
  websocketPort?: MessagePort;
  cachePort?: MessagePort;
}