export type Sendable = string | ArrayBufferLike | Blob | ArrayBufferView;
export type WebSocketData = Sendable | Buffer;

export interface WebSocketEventMap {
  open: Event;
  close: CloseEvent;
  error: Event;
  message: MessageEvent<WebSocketData>;
}

export type WebSocketEventType = keyof WebSocketEventMap;
export type WebSocketListener<K extends WebSocketEventType> = (event: WebSocketEventMap[K]) => void;

export interface UniversalWebSocketOptions {
  agent?: unknown;
  connectTimeout?: number;
  autoConnect?: boolean;
  wsOptions?: Record<string, unknown>;
}

type UnderlyingWebSocket = {
  readonly readyState: number;
  readonly url: string;
  send(data: any): void;
  close(code?: number, reason?: string): void;
  terminate?: () => void;
  addEventListener?: (type: WebSocketEventType, listener: (ev: any) => void) => void;
  removeEventListener?: (type: WebSocketEventType, listener: (ev: any) => void) => void;
  on?: (type: string, listener: (...args: any[]) => void) => void;
  off?: (type: string, listener: (...args: any[]) => void) => void;
  removeListener?: (type: string, listener: (...args: any[]) => void) => void;
};

type BoundUnderlyingListeners = {
  ws: UnderlyingWebSocket;
  open: (ev?: any) => void;
  message: (evOrData?: any, isBinary?: boolean) => void;
  error: (evOrErr?: any) => void;
  close: (evOrCode?: any, reason?: any) => void;
};

const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

const isDenoRuntime = (): boolean =>
  typeof (globalThis as any).Deno !== "undefined" && !!(globalThis as any).Deno?.version?.deno;

const isNodeRuntime = (): boolean =>
  !isDenoRuntime() && typeof process !== "undefined" && !!(process as any)?.versions?.node;

const hasNativeWebSocket = (): boolean => typeof WebSocket !== "undefined";

const toStringMaybe = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof Buffer !== "undefined" && value instanceof Buffer) return value.toString("utf8");
  if (value instanceof ArrayBuffer) {
    if (typeof Buffer !== "undefined") return Buffer.from(value).toString("utf8");
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(new Uint8Array(value));
  }
  if (ArrayBuffer.isView(value)) {
    if (typeof Buffer !== "undefined") return Buffer.from(value.buffer).toString("utf8");
    if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(new Uint8Array(value.buffer));
  }
  return String(value);
};

const makeCloseEvent = (code = 1000, reason = ""): CloseEvent => {
  try {
    return new CloseEvent("close", { code, reason });
  } catch {
    const ev = new Event("close") as any;
    ev.code = code;
    ev.reason = reason;
    return ev as CloseEvent;
  }
};

const makeMessageEvent = (data: WebSocketData): MessageEvent<WebSocketData> => {
  try {
    return new MessageEvent<WebSocketData>("message", { data });
  } catch {
    return { data } as MessageEvent<WebSocketData>;
  }
};

const makeErrorEvent = (err?: unknown): Event => {
  try {
    const ev = new Event("error") as any;
    ev.error = err;
    ev.message = err instanceof Error ? err.message : typeof err === "string" ? err : undefined;
    return ev as Event;
  } catch {
    return new Event("error");
  }
};

const normalizeSend = (data: unknown): Sendable => {
  if (typeof data === "string") return data;
  if (typeof Buffer !== "undefined" && data instanceof Buffer) return data.toString("utf8");
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) return data;
  if (Array.isArray(data)) return JSON.stringify(data);
  if (data && typeof data === "object") return JSON.stringify(data);
  return String(data);
};

export class UniversalWebSocket {
  private ws?: UnderlyingWebSocket;
  private readonly relay: string;
  private readonly protocols?: string | string[];
  private readonly options: UniversalWebSocketOptions;
  private readonly listeners: { [K in WebSocketEventType]: Set<WebSocketListener<K>> } = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set(),
  };
  private bound?: BoundUnderlyingListeners;
  private connectPromise?: Promise<boolean>;
  private didOpen = false;

  constructor(relay: string, protocols?: string | string[], options?: UniversalWebSocketOptions) {
    this.relay = relay;
    this.protocols = protocols;
    this.options = options ?? {};
    if (this.options.autoConnect !== false) {
      void this.connect();
    }
  }

  static async create(
    relay: string,
    protocols?: string | string[],
    options?: UniversalWebSocketOptions
  ): Promise<UniversalWebSocket> {
    const ws = new UniversalWebSocket(relay, protocols, { ...(options ?? {}), autoConnect: false });
    await ws.connect();
    return ws;
  }

  private dispatch<K extends WebSocketEventType>(type: K, event: WebSocketEventMap[K]): void {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }

  on<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void {
    this.listeners[type].add(listener);
  }

  once<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void {
    const wrapped = ((event: WebSocketEventMap[K]) => {
      this.off(type, wrapped as WebSocketListener<K>);
      listener(event);
    }) as WebSocketListener<K>;
    this.on(type, wrapped);
  }

  off<K extends WebSocketEventType>(type?: K, listener?: WebSocketListener<K>): void {
    if (!type) {
      this.listeners.open.clear();
      this.listeners.message.clear();
      this.listeners.error.clear();
      this.listeners.close.clear();
      return;
    }
    if (!listener) {
      this.listeners[type].clear();
      return;
    }
    this.listeners[type].delete(listener);
  }

  addEventListener<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void {
    this.on(type, listener);
  }

  removeEventListener<K extends WebSocketEventType>(type: K, listener: WebSocketListener<K>): void {
    this.off(type, listener);
  }

  private unbindUnderlyingListeners(): void {
    if (!this.bound) return;
    const { ws, open, message, error, close } = this.bound;
    if (typeof ws.removeEventListener === "function") {
      ws.removeEventListener("open", open);
      ws.removeEventListener("message", message);
      ws.removeEventListener("error", error);
      ws.removeEventListener("close", close);
    }
    if (typeof ws.off === "function") {
      ws.off("open", open);
      ws.off("message", message);
      ws.off("error", error);
      ws.off("close", close);
    } else if (typeof ws.removeListener === "function") {
      ws.removeListener("open", open);
      ws.removeListener("message", message);
      ws.removeListener("error", error);
      ws.removeListener("close", close);
    }
    this.bound = undefined;
  }

  private bindUnderlyingListeners(ws: UnderlyingWebSocket): void {
    this.unbindUnderlyingListeners();

    const open = () => {
      this.didOpen = true;
      this.dispatch("open", new Event("open"));
    };
    const close = (evOrCode?: any, reason?: any) => {
      this.didOpen = false;
      if (evOrCode && typeof evOrCode === "object" && "code" in evOrCode) {
        this.dispatch("close", evOrCode as CloseEvent);
        return;
      }
      const code = typeof evOrCode === "number" ? evOrCode : 1000;
      const reasonString = reason ? toStringMaybe(reason) : "";
      this.dispatch("close", makeCloseEvent(code, reasonString));
    };
    const error = (evOrErr?: any) => {
      if (evOrErr instanceof Event) {
        this.dispatch("error", evOrErr);
        return;
      }
      this.dispatch("error", makeErrorEvent(evOrErr));
    };
    const message = (evOrData?: any) => {
      if (evOrData && typeof evOrData === "object" && "data" in evOrData) {
        this.dispatch("message", evOrData as MessageEvent<WebSocketData>);
        return;
      }
      const data = evOrData as WebSocketData;
      this.dispatch("message", makeMessageEvent(data));
    };

    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("open", open);
      ws.addEventListener("message", message);
      ws.addEventListener("error", error);
      ws.addEventListener("close", close);
    } else if (typeof ws.on === "function") {
      ws.on("open", open);
      ws.on("message", message);
      ws.on("error", error);
      ws.on("close", close);
    } else {
      throw new Error("Underlying websocket does not support EventTarget or EventEmitter semantics.");
    }

    this.bound = { ws, open, message, error, close };
  }

  private createUnderlyingWebSocket(): UnderlyingWebSocket | Promise<UnderlyingWebSocket> {
    if (isNodeRuntime() && (this.options.agent || !hasNativeWebSocket())) {
      return import("ws").then(({ default: NodeWebSocket }) => {
        return new NodeWebSocket(
          this.relay,
          this.protocols as any,
          { ...(this.options.wsOptions ?? {}), ...(this.options.agent ? { agent: this.options.agent } : {}) } as any
        ) as unknown as UnderlyingWebSocket;
      });
    }

    if (!hasNativeWebSocket()) {
      throw new Error("WebSocket is not available in this runtime.");
    }

    return new WebSocket(this.relay, this.protocols) as unknown as UnderlyingWebSocket;
  }

  async connect(): Promise<boolean> {
    if (this.CONNECTED) return true;
    if (this.connectPromise) return this.connectPromise;

    const hasActiveSocket =
      this.ws &&
      (this.ws.readyState === WS_READY_STATE.CONNECTING || this.ws.readyState === WS_READY_STATE.OPEN);

    if (!hasActiveSocket) {
      const underlying = this.createUnderlyingWebSocket();
      if (underlying instanceof Promise) {
        this.ws = await underlying;
      } else {
        this.ws = underlying;
      }
      this.bindUnderlyingListeners(this.ws);
    }

    if (this.CONNECTED) {
      if (!this.didOpen) {
        this.didOpen = true;
        this.dispatch("open", new Event("open"));
      }
      return true;
    }

    const connectTimeoutMs = this.options.connectTimeout ?? 10_000;

    this.connectPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const cleanup = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        this.off("open", onOpen);
        this.off("close", onClose);
        this.off("error", onError);
        resolve(ok);
      };

      const onOpen = (_ev: Event) => cleanup(true);
      const onClose = (_ev: CloseEvent) => cleanup(false);
      const onError = (_ev: Event) => cleanup(false);

      this.on("open", onOpen);
      this.on("close", onClose);
      this.on("error", onError);

      timeout = setTimeout(() => {
        this.terminate();
        cleanup(false);
      }, connectTimeoutMs);
    }).finally(() => {
      this.connectPromise = undefined;
    });

    return this.connectPromise;
  }

  async ready(): Promise<void> {
    const ok = await this.connect();
    if (!ok || !this.CONNECTED) {
      throw new Error(`WebSocket connection failed: ${this.relay}`);
    }
  }

  async closed(): Promise<void> {
    if (!this.ws || this.ws.readyState === WS_READY_STATE.CLOSED) return;
    await new Promise<void>((resolve) => this.once("close", () => resolve()));
  }

  send(data: unknown): void {
    if (!this.ws) throw new Error("WebSocket is not connected.");
    this.ws.send(normalizeSend(data));
  }

  close(code?: number, reason?: string): void {
    this.ws?.close(code, reason);
  }

  terminate(): void {
    if (!this.ws) return;
    if (typeof this.ws.terminate === "function") {
      this.ws.terminate();
      return;
    }
    this.ws.close();
  }

  get readyState(): number {
    return this.ws?.readyState ?? WS_READY_STATE.CLOSED;
  }

  get url(): string {
    return this.ws?.url ?? this.relay;
  }

  get CONNECTED(): boolean {
    return this.readyState === WS_READY_STATE.OPEN;
  }

  get CONNECTING(): boolean {
    return this.readyState === WS_READY_STATE.CONNECTING;
  }

  get CLOSING(): boolean {
    return this.readyState === WS_READY_STATE.CLOSING;
  }

  get CLOSED(): boolean {
    return this.readyState === WS_READY_STATE.CLOSED;
  }

  get BUSY(): boolean {
    return this.CONNECTING || this.CLOSING;
  }

  get OPEN(): boolean {
    return this.CONNECTED;
  }

  isConnecting(): boolean {
    return this.CONNECTING;
  }

  isConnected(): boolean {
    return this.CONNECTED;
  }

  isOpen(): boolean {
    return this.CONNECTED;
  }

  isClosing(): boolean {
    return this.CLOSING;
  }

  isClosed(): boolean {
    return this.CLOSED;
  }
}
  
