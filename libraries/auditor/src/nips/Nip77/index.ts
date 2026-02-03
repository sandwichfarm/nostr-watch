import type { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';

import { Suite } from '#base/Suite.js';
import { SchemaValidator } from '#base/SchemaValidator.js';
import type { ISuite } from '#base/Suite.js';

import type { INip01Filter } from '#src/nips/Nip01/interfaces/index.js';

import schemata from './schemata/index.js';

import type { ClientNegOpenMessage } from './interfaces/ClientNegOpen.js';
import type { NegCloseMessage } from './interfaces/NegClose.js';
import type { NegErrMessage, ReasonCode } from './interfaces/NegErr.js';
import type { NegMsgMessage } from './interfaces/NegMsg.js';

import type { HexString, SubscriptionID } from './interfaces/GenericTypes.js';

export class Nip77ClientMessageGenerator {
  static NEG_OPEN(
    subscriptionId: SubscriptionID,
    filter: INip01Filter,
    initialMessage: HexString
  ): ClientNegOpenMessage {
    return ['NEG-OPEN', subscriptionId, filter, initialMessage];
  }

  static NEG_CLOSE(subscriptionId: SubscriptionID): NegCloseMessage {
    return ['NEG-CLOSE', subscriptionId];
  }

  static NEG_MSG(subscriptionId: SubscriptionID, message: HexString): NegMsgMessage {
    return ['NEG-MSG', subscriptionId, message];
  }
}

export class Nip77RelayMessageGenerator {
  static NEG_ERR(subscriptionId: SubscriptionID, reasonCode: ReasonCode, maxRecords?: number): NegErrMessage {
    const errorMessage: NegErrMessage = ['NEG-ERR', subscriptionId, reasonCode];
    if (maxRecords !== undefined) {
      errorMessage.push(maxRecords);
    }
    return errorMessage;
  }

  static NEG_MSG(subscriptionId: SubscriptionID, message: HexString): NegMsgMessage {
    return ['NEG-MSG', subscriptionId, message];
  }
}

export class Nip77 extends Suite implements ISuite {
  public get slug(): string {
    return 'Nip77';
  }

  public readonly messageValidators: Record<string, SchemaValidator<any>> = {
    'NEG-OPEN': new SchemaValidator<ClientNegOpenMessage>(schemata.NegOpenMessage),
    'NEG-CLOSE': new SchemaValidator<NegCloseMessage>(schemata.NegCloseMessage),
    'NEG-MSG': new SchemaValidator<NegMsgMessage>(schemata.NegMsgMessage),
    'NEG-ERR': new SchemaValidator<NegErrMessage>(schemata.NegErrMessage),
  };

  constructor(socket: WebSocket) {
    super(socket, import.meta.url);
  }
}

export default Nip77;

