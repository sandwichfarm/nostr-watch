import type {UniversalWebSocket as WebSocket} from '@nostrwatch/websocket'

import {Suite} from '#base/Suite.js'
import type {ISuite} from '#base/Suite.js'

export class Nip40 extends Suite implements ISuite {
  public get slug(): string {
    return 'Nip40'
  }

  constructor(socket: WebSocket) {
    super(socket, import.meta.url)
  }
}

export default Nip40
