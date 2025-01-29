import type { WebSocketWrapper as WebSocket } from '@nostrwatch/websocket';

import { Suite } from '#base/Suite.js';
import type { ISuite } from '#base/Suite.js';

import { nip11Schema } from '@nostrwatch/schemata';
import { SchemaValidator } from '#src/base/SchemaValidator.js';

//nip01
export class Nip11 extends Suite implements ISuite {

  public get slug(): string {
    return 'Nip11';
  }

  readonly jsonValidators: Record<string, SchemaValidator<any>> = {
    'NIP11': new SchemaValidator<any>(nip11Schema),
  }

  //overwrite, don't need websocket.
  readonly requires: string[] = [];
  readonly pretest: boolean = true;

  constructor(socket: WebSocket) {
    super(socket, import.meta.url);  
  }
  
}

export default Nip11;