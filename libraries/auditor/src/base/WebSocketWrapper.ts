// src/base/WebSocketWrapper.ts

import WebSocket from 'modern-isomorphic-ws';
import Logger from '#base/Logger.js';
import { INip01RelayMessage } from "#src/nips/Nip01/interfaces";

// Define WebSocketEventMap
interface WebSocketEventMap {
  open: Event;
  close: CloseEvent;
  error: ErrorEvent;
  message: MessageEvent;
}

export class WebSocketWrapper {
  ws: WebSocket;
  relay: string;
  _ready: boolean = false;
  private logger: Logger = new Logger('@nostrwatch/auditor:WebSocketWrapper');
  private listeners: {
    [K in keyof WebSocketEventMap]?: Set<EventListener>
  } = {};

  constructor(relay: string) {
    this.relay = relay;
  }

  on<Key extends keyof WebSocketEventMap>(
    key: Key,
    fn: (event: WebSocketEventMap[Key]) => void
  ): void {
    this.logger.debug(`binding ${key} event`);

    if (key === 'open' || key === 'close') {
      return console.warn(`Cannot override default ${key} event handler`);
    }

    const wrappedFn: EventListener = (event: Event) => {
      fn(event as WebSocketEventMap[Key]);
    };

    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    this.listeners[key]?.add(wrappedFn);
    this.ws.addEventListener(key, wrappedFn as any);
  }

  off(): void {
    for (const [key, handlers] of Object.entries(this.listeners)) {
      const eventKey = key as keyof WebSocketEventMap;
      handlers.forEach((fn) => {
        this.ws.removeEventListener(eventKey, fn as any);
      });
    }
    this.listeners = {};
  }

  async connect(): Promise<boolean> {
    const timeout = setTimeout(() => {
      if (this.CONNECTING) {
        this.logger.debug('Connection timed out');
        this.terminate();
      }
    }, 10000);

    if (this.BUSY) {
      this.logger.debug('Websocket is busy');
      await new Promise<boolean>((resolve) =>
        setTimeout(() => {
          this.logger.debug('retrying connection');
          this.connect().then(resolve);
        }, 500)
      );
      return false;
    } else if (this.CONNECTED) {
      return true;
    }

    this.ws = new WebSocket(this.relay);
    this.defaultHandlers();

    while (this.CONNECTING) {
      this.logger.debug(`connecting to ${this.relay}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    clearTimeout(timeout);

    if (this.CLOSED || this.CLOSING) {
      return false;
    }

    this.logger.debug(`connected to ${this.relay}`);
    return true;
  }

  async ready(): Promise<void> {
    while (!this._ready) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }

  async closed(): Promise<void> {
    while (this.BUSY) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }

  defaultHandlers(): void {
    this.off();
    this.ws.addEventListener('open', () => (this._ready = true));
    this.ws.addEventListener('close', () => (this._ready = false));
    this.ws.addEventListener('error', (err) => this.logger.debug(`error: ${err}`));
  }

  terminate(): void {
    if (typeof (this.ws as any).terminate === 'function') {
      (this.ws as any).terminate();
    } else {
      this.ws.close();
    }
  }

  close(): void {
    this.ws.close();
  }

  send(data: INip01RelayMessage | Buffer): void {
    if (data instanceof Buffer) {
      this.ws.send(data.toString());
    } else {
      this.ws.send(JSON.stringify(data));
    }
  }

  get CONNECTED(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get CONNECTING(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }

  get CLOSING(): boolean {
    return this.ws?.readyState === WebSocket.CLOSING;
  }

  get CLOSED(): boolean {
    return this.ws?.readyState === WebSocket.CLOSED;
  }

  get BUSY(): boolean {
    return this.CONNECTING || this.CLOSING;
  }
}
