import type { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';

import { Suite } from '#base/Suite.js';
import type { ISuite } from '#base/Suite.js';

//nip01
export class Nip50 extends Suite implements ISuite {

  public get slug(): string {
    return 'Nip50';
  }

  constructor(socket: WebSocket) {
    super(socket, import.meta.url);  
  }
}

export default Nip50;