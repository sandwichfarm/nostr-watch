import { Transport } from './Transport';

export class WebSocketTransport implements Transport {
  private websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
  }

  send(message: string): void {
    this.websocket.send(message);
  }

  onMessage(callback: (message: string) => void): void {
    this.websocket.on('message', (data: WebSocket.Data) => {
      // Assuming data is a string or Buffer
      if (typeof data === 'string') {
        callback(data);
      } else if (data instanceof Buffer) {
        callback(data.toString());
      }
    });
  }
}