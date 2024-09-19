import { Adapter } from './Adapter'

export class WebsocketAdapter extends Adapter {

  get dedicatedWorker(): Worker | undefined {
    return this.workers?.websocketDedicated
  }

  get sharedWorker(): SharedWorker | undefined {
    return this.workers?.websocketShared
  }
  
}