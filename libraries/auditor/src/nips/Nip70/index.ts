import type {UniversalWebSocket as WebSocket} from '@nostrwatch/websocket'

import {Suite} from '#base/Suite.js'
import type {ISuite} from '#base/Suite.js'

import type {RelayAuthMessage} from '../Nip42/interfaces/index.js'

export class Nip70 extends Suite implements ISuite {
  public get slug(): string {
    return 'Nip70'
  }

  constructor(socket: WebSocket) {
    super(socket, import.meta.url)
  }

  protected onMessageAuth(message: RelayAuthMessage): void {
    this.state.set('challenge', message[1])
  }
}

export default Nip70
