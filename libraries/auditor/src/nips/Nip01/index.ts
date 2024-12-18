import type { WebSocketWrapper as WebSocket } from '#base/WebSocketWrapper.js';

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

//nip01
export class Nip01 extends Suite implements ISuite {

  public get slug(): string {
    return 'Nip01';
  }

  public readonly messageValidators: Record<string, SchemaValidator<any>> = {
    'EVENT': new SchemaValidator<RelayEventMessage>(schemata.RelayEventMessage),
    'CLOSED': new SchemaValidator<RelayClosedMessage>(schemata.RelayClosedMessage),
    'NOTICE': new SchemaValidator<RelayNoticeMessage>(schemata.RelayNoticeMessage),
    'OK': new SchemaValidator<RelayOkMessage>(schemata.RelayOkMessage),
    'EOSE': new SchemaValidator<RelayEoseMessage>(schemata.RelayEoseMessage)
  };

  public readonly jsonValidators: Record<string, SchemaValidator<any>> = {
    'EVENT': new SchemaValidator<Note>(schemata.Note),
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