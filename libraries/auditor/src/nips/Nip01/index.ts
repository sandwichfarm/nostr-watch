import type { WebSocketWrapper as WebSocket } from '@nostrwatch/websocket';

import { Suite } from '#base/Suite.js';
import { SchemaValidator } from '#base/SchemaValidator.js';
import type { ISuite } from '#base/Suite.js';

import schemata from './schemata/index.js';

import type { 
  INip01Filter, 
  RelayEoseMessage, 
  RelayEventMessage, 
  RelayNoticeMessage, 
  RelayOkMessage,
  RelayClosedMessage, 
  ClientReqMessageBase,
  Note,
  ClientEventMessage,
  ClientCloseMessage
} from './interfaces/index.js';

import { 
  noteSchema,
  relayClosedSchema, 
  relayEoseSchema, 
  relayEventSchema, 
  relayNoticeSchema, 
  relayOkSchema 
} from '@nostrwatch/schemata';

//nip01
export class Nip01 extends Suite implements ISuite {

  public get slug(): string {
    return 'Nip01';
  }

  public readonly messageValidators: Record<string, SchemaValidator<any>> = {
    'EVENT': new SchemaValidator<RelayEventMessage>(relayEventSchema),
    'CLOSED': new SchemaValidator<RelayClosedMessage>(relayClosedSchema),
    'NOTICE': new SchemaValidator<RelayNoticeMessage>(relayNoticeSchema),
    'OK': new SchemaValidator<RelayOkMessage>(relayOkSchema),
    'EOSE': new SchemaValidator<RelayEoseMessage>(relayEoseSchema)
  };

  public readonly jsonValidators: Record<string, SchemaValidator<any>> = {
    'EVENT': new SchemaValidator<Note>(noteSchema),
  };

  private subId: string = 'test';

  constructor(ws: WebSocket) {
    super(ws, import.meta.url);  
  }

  protected onMessageEvent(message: RelayEventMessage): void {
    const [key, subid, note] = message;
    if(!note) return
    this.validateJson(key, note);
  }

  protected onMessageOk(message: RelayOkMessage): void {}
  protected onMessageEose(message: RelayEoseMessage): void {}
  protected onMessageNotice(message: RelayNoticeMessage): void {}
  protected onMessageClosed(message: RelayClosedMessage): void {}
}


export default Nip01;