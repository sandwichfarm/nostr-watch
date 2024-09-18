import type { WebSocketWrapper as WebSocket } from '#base/WebSocketWrapper.js';

import { Suite } from '#base/Suite.js';
import type { ISuite } from '#base/Suite.js';

import type { 
  RelayEoseMessage, 
  RelayEventMessage, 
  RelayNoticeMessage, 
  RelayOkMessage,
  RelayClosedMessage, 
} from '#nips/Nip01/interfaces/index.js';

//nip01
export class Nip50 extends Suite implements ISuite {

  public readonly slug: string = 'Nip50';

  constructor(ws: WebSocket) {
    super(ws, import.meta.url);  
  }
  protected onMessageEvent(message: RelayEventMessage): void {}
  protected onMessageOk(message: RelayOkMessage): void {}
  protected onMessageEose(message: RelayEoseMessage): void {}
  protected onMessageNotice(message: RelayNoticeMessage): void {}
  protected onMessageClosed(message: RelayClosedMessage): void {}
}

export default Nip50;