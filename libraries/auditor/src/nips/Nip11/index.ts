import type { WebSocketWrapper as WebSocket } from '#base/WebSocketWrapper.js';
import fetch from 'cross-fetch';

import { Suite } from '#base/Suite.js';
import type { ISuite, ISuiteResult } from '#base/Suite.js';

import nip11Schema from './schemata/nip11.schema.json' with { type: "json" };
import { SchemaValidator } from '#src/base/SchemaValidator.js';

//nip01
export class Nip11 extends Suite implements ISuite {

  public readonly slug: string = 'Nip11';

  readonly jsonValidators: Record<string, SchemaValidator<any>> = {
    'NIP11': new SchemaValidator<any>(nip11Schema),
  }

  //overwrite, don't need websocket.
  readonly requires: string[] = [];
  readonly pretest: boolean = true;

  constructor(ws: WebSocket) {
    super(ws, import.meta.url);  
  }
  
}

export default Nip11;