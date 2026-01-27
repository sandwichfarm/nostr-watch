export interface ISharedWorkerGlobalScope {
  onconnect: ((this: ISharedWorkerGlobalScope, ev: MessageEvent) => any) | null;
  addEventListener(type: 'connect', listener: (this: ISharedWorkerGlobalScope, ev: MessageEvent) => any, options?: boolean | AddEventListenerOptions): void;
  postMessage(message: any, transfer?: Transferable[]): void;
  port: MessagePort;
}