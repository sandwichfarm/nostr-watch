import { SchemaValidator } from "#src/base/SchemaValidator";
import { INip01Filter, Note } from "../Nip01/interfaces";
import schemata from './schemata/index.js';
import type { ClientAuthMessage, RelayAuthMessage } from './interfaces/index.js';

type SubscriptionID = string;
export type ReasonCode = 'RESULTS_TOO_BIG' | 'CLOSED';
export type HexString = string;

export class Nip77ClientMessageGenerator {
  static NEG_OPEN(subscriptionId: SubscriptionID, filter: INip01Filter, initialMessage: HexString): Buffer {
    return Buffer.from(JSON.stringify(['NEG-OPEN', subscriptionId, filter, initialMessage]));
  }

  static NEG_CLOSE(subscriptionId: SubscriptionID): Buffer {
    return Buffer.from(JSON.stringify(['NEG-CLOSE', subscriptionId]));
  }

  static NEG_MSG(subscriptionId: SubscriptionID, message: HexString): Buffer {
    return Buffer.from(JSON.stringify(['NEG-MSG', subscriptionId, message]));
  }
}

export class Nip77RelayMessageGenerator {
  static NEG_ERR(subscriptionId: SubscriptionID, reasonCode: ReasonCode, maxRecords?: number): Buffer {
    const errorMessage = ['NEG-ERR', subscriptionId, reasonCode];
    if (maxRecords !== undefined) {
      errorMessage.push('MAX-RECORDS', maxRecords);
    }
    return Buffer.from(JSON.stringify(errorMessage));
  }

  static NEG_MSG(subscriptionId: SubscriptionID, message: HexString): Buffer {
    return Buffer.from(JSON.stringify(['NEG-MSG', subscriptionId, message]));
  }
}

export class Nip77 {
  public readonly slug: string = 'Nip01';

  readonly messageValidators = {
    'AUTH': new SchemaValidator<RelayAuthMessage>(schemata.RelayAuthMessage),
  }
}