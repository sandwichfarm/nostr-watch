import type { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';

import { Suite } from '#base/Suite.js';
import { SchemaValidator } from '#base/SchemaValidator.js';
import type { ISuite } from '#base/Suite.js';

import type {
  RelayClosedMessage,
  RelayEoseMessage,
  RelayEventMessage,
  RelayNoticeMessage,
  RelayOkMessage,
  Note,
} from '#src/nips/Nip01/interfaces/index.js';

import {
  kind3Schema,
  relayClosedSchema,
  relayEoseSchema,
  relayEventSchema,
  relayNoticeSchema,
  relayOkSchema,
} from '@nostrability/schemata';

export class Nip02 extends Suite implements ISuite {
  public get slug(): string {
    return 'Nip02';
  }

  public readonly messageValidators: Record<string, SchemaValidator<any>> = {
    EVENT: new SchemaValidator<RelayEventMessage>(relayEventSchema),
    CLOSED: new SchemaValidator<RelayClosedMessage>(relayClosedSchema),
    NOTICE: new SchemaValidator<RelayNoticeMessage>(relayNoticeSchema),
    OK: new SchemaValidator<RelayOkMessage>(relayOkSchema),
    EOSE: new SchemaValidator<RelayEoseMessage>(relayEoseSchema),
  };

  public readonly jsonValidators: Record<string, SchemaValidator<any>> = {
    EVENT: new SchemaValidator<Note>(kind3Schema),
  };

  constructor(socket: WebSocket) {
    super(socket, import.meta.url);
  }

  protected onMessageEvent(message: RelayEventMessage): void {
    const note = message?.[2];
    if (!note) return;
    this.validateJson('EVENT', note);
  }

  protected onMessageOk(_message: RelayOkMessage): void {}
  protected onMessageEose(_message: RelayEoseMessage): void {}
  protected onMessageNotice(_message: RelayNoticeMessage): void {}
  protected onMessageClosed(_message: RelayClosedMessage): void {}
}

export default Nip02;
