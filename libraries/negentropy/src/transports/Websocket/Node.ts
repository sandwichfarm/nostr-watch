import { Transport } from '../Transport';
import WebSocket from 'ws';

export class NodeWebSocketTransport implements Transport {
  private websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
  }

  send(message: string): void {
    this.websocket.send(message);
  }

  onMessage(callback: (message: string) => void): void {
    this.websocket.on('message', (data: WebSocket.Data) => {
      if (typeof data === 'string') {
        callback(data);
      } else if (data instanceof Buffer) {
        callback(data.toString());
      } else if (data instanceof ArrayBuffer) {
        callback(Buffer.from(data).toString());
      } else if (Array.isArray(data)) {
        // Handle array of Buffers (rare case)
        callback(Buffer.concat(data).toString());
      } else {
        // Handle other types if necessary
        callback(String(data));
      }
    });
  }
}
