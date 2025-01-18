import { WebsocketAdapter } from '@nostrwatch/route66/core'

// @ts-ignore: No default export error
import NostrToolsWorker from './workers/nostrtools.worker'

export class NostrToolsAdapter extends WebsocketAdapter {
  readonly slug: string = 'nostrtools'

  constructor() {
    super()
    this.connect();
  }
  
  async newWorker(): Promise<Worker | SharedWorker> {
    return NostrToolsWorker();
  }
}