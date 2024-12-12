import { isBrowser } from '@nostrwatch/utils';

export class CompatibleWebSocket {
    private ws: WebSocket | import('ws').WebSocket;
  
    constructor(url: string, options?: { agent?: any; timeout?: number }) {
      if (isBrowser()) {
        this.ws = new WebSocket(url);
      } else {
        const { WebSocket: NodeWebSocket } = require('ws');
        this.ws = new NodeWebSocket(url, options);
      }
    }
  
    get readyState(): number | undefined {
      return (this.ws as WebSocket).readyState || (this.ws as import('ws').WebSocket).readyState;
    }
  
    on(event: keyof WebSocketEventMap, listener: (...args: any[]) => void): void {
      if ('on' in this.ws) {
        (this.ws as import('ws').WebSocket).on(event, listener);
      } else {
        this.ws.addEventListener(event, listener as EventListener);
      }
    }
  
    send(data: string |  ArrayBuffer | Blob | ArrayBufferView): void {
      if (isBrowser()) {
        (this.ws as WebSocket).send(data);
      } else {
        (this.ws as import('ws').WebSocket).send(Buffer.from(data as string));
      }
    }
  
    close(code?: number, reason?: string): void {
      this.ws.close(code, reason);
    }
  
    terminate(): void {
      if ('terminate' in this.ws) {
        (this.ws as import('ws').WebSocket).terminate();
      } else {
        this.close();
      }
    }
  }
  