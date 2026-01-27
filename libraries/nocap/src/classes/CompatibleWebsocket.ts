import { isBrowser } from '@nostrwatch/utils';

export class CompatibleWebSocket {
    private ws?: WebSocket | import('ws').WebSocket;
    private _ready: boolean = false;
  
    constructor(url: string, options?: { agent?: any; timeout?: number }) {
      if (isBrowser()) {
        this.ws = new WebSocket(url);
        this._ready = true;
      } else {
        import('ws').then( ({ WebSocket } ) => {
          this.ws = new WebSocket(url, options);
          this._ready = true;
        })
      }
    }

    async ready(): Promise<void> {
      while (!this._ready) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
    }

    get readyState(): number | undefined {
      return (this.ws as WebSocket).readyState || (this.ws as import('ws').WebSocket).readyState;
    }
  
    on(event: keyof WebSocketEventMap, listener: (...args: any[]) => void): void {
      if (this.ws && 'on' in this.ws) {
        (this.ws as import('ws').WebSocket).on(event, listener);
      } else {
        this.ws?.addEventListener(event, listener as EventListener);
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
      this.ws?.close(code, reason);
    }
  
    terminate(): void {
      if (this.ws && 'terminate' in this.ws) {
        (this.ws as import('ws').WebSocket).terminate();
      } else {
        this.close();
      }
    }
  }
  