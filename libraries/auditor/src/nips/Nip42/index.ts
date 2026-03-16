import type {UniversalWebSocket as WebSocket} from '@nostrwatch/websocket'

import {Suite} from '#base/Suite.js'
import {SchemaValidator} from '#base/SchemaValidator.js'
import type {ISuite} from '#base/Suite.js'

import {Note} from '../Nip01/interfaces/index.js'
import schemata from './schemata/index.js'
import type {ClientAuthMessage, RelayAuthMessage} from './interfaces/index.js'

export class Nip42ClientMessageGenerator {
  static AUTH(note: Note): Buffer {
    return Buffer.from(JSON.stringify(['AUTH', note] as ClientAuthMessage))
  }
}

export class Nip42RelayMessageGenerator {
  static AUTH(challenge: string): Buffer {
    return Buffer.from(JSON.stringify(['AUTH', challenge] as RelayAuthMessage))
  }
}

export class Nip42 extends Suite implements ISuite {
  public get slug(): string {
    return 'Nip42'
  }

  public readonly messageValidators: Record<string, SchemaValidator<any>> = {
    'AUTH': new SchemaValidator<RelayAuthMessage>(schemata.RelayAuthMessage)
  }

  constructor(socket: WebSocket) {
    super(socket, import.meta.url)
  }

  protected onMessageAuth(message: RelayAuthMessage): void {
    const challenge = message[1]
    this.state.set('challenge', challenge)
    this.state.set('authRequired', true)
  }

  protected beforeResults(): void {
    this.resulter.set('data', {authRequired: this.state.get('authRequired') ?? false})
  }
}

export default Nip42
