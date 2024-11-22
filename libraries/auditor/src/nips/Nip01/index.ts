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
import { MachineReadableStatus } from './interfaces/MachineReadableStatus.js';
import { HumanReadableStatus } from './interfaces/HumanReadableStatus.js';

export class Nip01ClientMessageGenerator {
  static EVENT(note: Note): Buffer {
    return Buffer.from(JSON.stringify(['EVENT', note] as ClientEventMessage));
  }

  static REQ<T extends INip01Filter>(subscriptionId: string, filters: T[]): Buffer {
    return Buffer.from(JSON.stringify(['REQ', subscriptionId, ...filters] as ClientReqMessageBase));
  }

  static CLOSE(subId: string): Buffer {
    return Buffer.from(JSON.stringify(['CLOSE', subId] as ClientCloseMessage));
  }
}

export class Nip01RelayMessageGenerator { 
  static EVENT(subId: string, note: Note): Buffer {
    return Buffer.from(JSON.stringify(['EVENT', subId, note] as RelayEventMessage));
  }

  static OK(subId: string, status: boolean, message: MachineReadableStatus): Buffer {
    return Buffer.from(JSON.stringify(['OK', subId, status, message] as RelayOkMessage));
  }

  static EOSE(subId: string): Buffer {
    return Buffer.from(JSON.stringify(['EOSE', subId] as RelayEoseMessage));
  }

  static NOTICE(subId: string, message: HumanReadableStatus): Buffer {
    return Buffer.from(JSON.stringify(['NOTICE', message] as RelayNoticeMessage));
  }

  static CLOSED(subId: string, message: MachineReadableStatus): Buffer {
    return Buffer.from(JSON.stringify(['CLOSED', subId, message] as RelayClosedMessage));
  }
}

//nip01
export class Nip01 extends Suite implements ISuite {

  public readonly slug: string = 'Nip01';

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