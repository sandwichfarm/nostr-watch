import { WebsocketAdapter } from '@nostrwatch/nip66/core'

// @ts-ignore: No default export error
import NostrToolsWorker from './workers/nostrtools.worker'

import hashObject from 'jwt-encode'

import { applyMixins } from '@nostrwatch/nip66/utils'
import { NostrToolsMethods } from './NostrToolsMethods'

export class NostrToolsAdapter extends WebsocketAdapter {
  readonly slug: string = 'nostrtools'

  constructor() {
    super()
    this.connect();
  }

  async newWorker(): Promise<Worker> {
    return NostrToolsWorker();
  }
}

// export interface NostrToolsAdapter extends NostrToolsMethods {}
// applyMixins(NostrToolsAdapter, [NostrToolsMethods]);