
import WebSocket from 'modern-isomorphic-ws';

interface WebSocketEventMap {
  open: Event;
  close: CloseEvent;
  error: ErrorEvent;
  message: MessageEvent;
}

export interface IWebSocketWrapper {
  ws: WebSocket | undefined;
  relay: string;
  _ready: boolean;
  on<Key extends keyof WebSocketEventMap>(
    key: Key,
    fn: (event: WebSocketEventMap[Key]) => void
  ): void;
  off(): void;
  connect(): Promise<boolean>;
  ready(): Promise<void>;
  closed(): Promise<void>;
  defaultHandlers(): void;
  terminate(): void;
  close(): void;
  send<T>(data: T | Buffer | string): void;
  get CONNECTED(): boolean;
  get CONNECTING(): boolean;
  get CLOSING(): boolean;
  get CLOSED(): boolean;
  get BUSY(): boolean;
  get OPEN(): boolean;
}

export class WebSocketWrapper implements IWebSocketWrapper {
  ws: WebSocket | undefined;
  relay: string;
  _ready: boolean = false;
  private options?: WebSocket.ClientOptions;
  
  private listeners: {
    [K in keyof WebSocketEventMap]?: Set<EventListener>
  } = {};

  constructor(relay: string, options?: WebSocket.ClientOptions) {
    this.relay = relay;
    this.options = options;
  }

  on<Key extends keyof WebSocketEventMap>(
    key: Key,
    fn: (event: WebSocketEventMap[Key]) => void
  ): void {
    const wrappedFn = (evt: Event) => {
      fn(evt as WebSocketEventMap[Key]);
    };
  
    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    this.listeners[key]!.add(wrappedFn as unknown as EventListener);
  
    (this.ws as any)?.addEventListener(key as any, wrappedFn as any);
  }
  
  

  off(): void {
    for (const [key, handlers] of Object.entries(this.listeners)) {
      const eventKey = key as keyof WebSocketEventMap;
      handlers.forEach((fn) => {
        this.ws?.removeEventListener('message', fn as any);
      });
    }
    this.listeners = {};
  }

  async connect(): Promise<boolean> {
    const timeout = setTimeout(() => {
      if (this.CONNECTING) {
        this.terminate();
      }
    }, 10000);

    if (this.BUSY) {
      await new Promise<boolean>((resolve) =>
        setTimeout(() => {
          this.connect().then(resolve);
        }, 500)
      );
      return false;
    } else if (this.CONNECTED) {
      return true;
    }

    this.ws = new WebSocket(this.relay, this.options);
    this.defaultHandlers();

    while (this.CONNECTING) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    clearTimeout(timeout);

    if (this.CLOSED || this.CLOSING) {
      return false;
    }

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
    this.ws?.addEventListener('open', () => (this._ready = true));
    this.ws?.addEventListener('close', () => (this._ready = false));
  }

  terminate(): void {
    if (typeof (this.ws as any).terminate === 'function') {
      (this.ws as any).terminate();
    } else {
      this.ws?.close();
    }
  }

  close(): void {
    this.ws?.close();
  }

  send<T>(data: T | Buffer | string): void {
    console.log('WebsocketWrapper send', data)
    if (data instanceof Buffer) {
      this.ws?.send(data.toString('utf-8'));
      console.log('WebsocketWrapper send', data.toString('utf-8'))
    } else if (data instanceof Object) {
      this.ws?.send(JSON.stringify(data));
      console.log('WebsocketWrapper send', JSON.stringify(data))
    } else if (typeof data === 'string') {
      this.ws?.send(data);
      console.log('WebsocketWrapper send', data)
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

  get OPEN(): boolean {
    return this.CONNECTED;
  }
}

