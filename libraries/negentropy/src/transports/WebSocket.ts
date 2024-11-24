import { Transport } from './Transport';

export class BrowserWebSocketTransport implements Transport {
  private websocket: WebSocket;

  constructor(websocket: WebSocket) {
    this.websocket = websocket;
  }

  send(message: string): void {
    this.websocket.send(message);
  }

  onMessage(callback: (message: string) => void): void {
    this.websocket.onmessage = (event: MessageEvent) => {
      callback(event.data);
    };
  }
}