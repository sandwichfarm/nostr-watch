export interface IAdapter {
  worker?: SharedWorker | Worker; 

  newWorker(): Worker;
  newSharedWorker(): SharedWorker;  

  // set workers(worker: { worker: Worker, sharedWorker: SharedWorker });
}