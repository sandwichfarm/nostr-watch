import { SchemaValidator } from "#src/base/SchemaValidator";
import { Note } from "../Nip01/interfaces";
import schemata from './schemata/index.js';
import type { ClientAuthMessage, RelayAuthMessage } from './interfaces/index.js';

export class Nip42ClientMessageGenerator {
  static AUTH(note: Note): Buffer {
    return Buffer.from(JSON.stringify(['AUTH', note] as ClientAuthMessage));
  }
}

export class Nip42RelayMessageGenerator { 
  static AUTH(challenge: string): Buffer {
    return Buffer.from(JSON.stringify(['AUTH', challenge] as RelayAuthMessage));
  }
}

export class Nip42 {
  public readonly slug: string = 'Nip01';

  readonly messageValidators = {
    'AUTH': new SchemaValidator<RelayAuthMessage>(schemata.RelayAuthMessage),
  }
}