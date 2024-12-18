import type { WebSocketWrapper as WebSocket } from '#base/WebSocketWrapper.js';

import { Suite } from '#base/Suite.js';
import type { ISuite } from '#base/Suite.js';

//nip01
export class Nip50 extends Suite implements ISuite {

  public get slug(): string {
    return 'Nip50';
  }

  constructor(ws: WebSocket) {
    super(ws, import.meta.url);  
  }
}

export default Nip50;