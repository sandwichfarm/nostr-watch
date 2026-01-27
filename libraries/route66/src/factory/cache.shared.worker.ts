import { ICacheAdapterSharedWorkerCommand } from '@interfaces/ICacheAdapterSharedWorkerCommand';

export default (_AdapterSharedWorker_: any) => {
  return async (event: MessageEvent) => {
    const mainThread = event.ports[0];
    const sharedWorker = new _AdapterSharedWorker_( { mainThread } );
    await sharedWorker.init();
    mainThread.onmessage = function(message: MessageEvent) {
      const command = message.data as ICacheAdapterSharedWorkerCommand;
      sharedWorker.onMessage(command);
    };
    mainThread.onmessageerror = sharedWorker.onMessageError;
  };
}