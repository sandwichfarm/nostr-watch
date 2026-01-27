export interface IWorkerGlobalScope {
  onmessage: ((this: IWorkerGlobalScope, ev: MessageEvent) => any) | null;
  onerror: ((this: IWorkerGlobalScope, ev: ErrorEvent) => any) | null;
  addEventListener(type: 'connect', listener: (this: IWorkerGlobalScope, ev: MessageEvent) => any, options?: boolean | AddEventListenerOptions): void;
  postMessage(message: any, transfer?: Transferable[]): void;
}