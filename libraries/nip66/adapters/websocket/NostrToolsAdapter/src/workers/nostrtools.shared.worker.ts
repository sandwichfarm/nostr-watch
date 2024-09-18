/// <reference lib="webworker" />

import { NostrToolsSharedWorker, NostrToolsWorkerCommand } from '../NostrToolsSharedWorker';
import { ISharedWorkerGlobalScope } from "@base/interfaces/ISharedWorkerGlobalScope";

const $self = this as unknown as ISharedWorkerGlobalScope;

$self.onconnect = function(event: MessageEvent) {
  const mainThread = event.ports[0];
  const sharedWorker = new NostrToolsSharedWorker( { mainThread } );
  mainThread.onmessage = function(message: MessageEvent) {
    const command = message.data as NostrToolsWorkerCommand;
    sharedWorker.onMessage(command);
  };
};