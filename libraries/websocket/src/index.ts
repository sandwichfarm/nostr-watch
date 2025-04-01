  declare global {
    interface GlobalThis {
        Deno?: any;
    }
  }

  type Sendable = string | ArrayBufferLike | Blob | ArrayBufferView;
  
  export class UniversalWebSocket {
    private ws!: WebSocket;
    private isNode: boolean;
    public _url: string;
    private connectTimeout: number;

    constructor(url: string, protocols?: string | string[], options?: { agent?: any, connectTimeout?: number }) {
      this._url = url;
      this.isNode = typeof WebSocket === "undefined";
      this.connectTimeout = options?.connectTimeout || 10000;
      this.connect(protocols, options);
    }
  
    private createWebSocket(protocols?: string | string[], options?: { agent?: any }): WebSocket {
      if (!this.isNode) {
        return new WebSocket(this.url, protocols);
      }
      throw new Error("WebSocket not supported in this environment");
    }
  
    static async create(url: string, protocols?: string | string[], options?: { agent?: any }): Promise<UniversalWebSocket> {
      if (typeof WebSocket !== "undefined") {
        return new UniversalWebSocket(url, protocols, options);
      }
  
      const { default: WS } = await import("ws");
      const protocolString = Array.isArray(protocols) ? protocols.join(",") : protocols;
      const nodeWS = new WS(url, { ...options, ...(protocolString ? { protocol: protocolString } : {}) });
  
      return new UniversalWebSocket(url, protocols, options)._wrapNodeWS(nodeWS);
    }

    public connect(protocols?: string | string[], options?: { agent?: any }) {
      this.ws = this.createWebSocket(protocols, options);
      this.setupEventListeners();
    }
  
    private _wrapNodeWS(nodeWS: any): this {
      this.ws = nodeWS;
      this.setupEventListeners();
      return this;
    }
  
    private setupEventListeners(): void {
      if (typeof (this.ws as any).on === "function") {
        (this.ws as any).on("message", (data: any) => this.onmessage?.(new MessageEvent("message", { data })));
        (this.ws as any).on("error", (err: any) => this.onerror?.(new Event(err)));
        (this.ws as any).on("close", (code: number, reason: string) => this.onclose?.(new CloseEvent("close", { code, reason })));
      }
    }
  
    public send(data: any[] | Sendable) {
      if(data instanceof Array) {
        data = JSON.stringify(data);
      }
      this.ws.send(data);
    }
  
    public close(code?: number, reason?: string) {
      this.ws.close(code, reason);
    }

    public async closed() {
      while(!this.CLOSED) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  
    public async terminate() {
      if (typeof (this.ws as any).terminate === "function") {
        (this.ws as any).terminate();
      } else {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      }
    }

    public get CONNECTED(): boolean {
      return this.isConnected();
    }

    public get CONNECTING(): boolean {
      return this.isConnecting();
    }

    public get CLOSING(): boolean {
      return this.isClosing();
    }

    public get CLOSED(): boolean {
      return this.isClosed();
    }
  
    public isConnecting(): boolean {
      return this.ws.readyState === WebSocket.CONNECTING;
    }

    public isConnected(): boolean {
      return this.isOpen();
    }
  
    public isOpen(): boolean {
      return this.ws.readyState === WebSocket.OPEN;
    }
  
    public isClosing(): boolean {
      return this.ws.readyState === WebSocket.CLOSING;
    }
  
    public isClosed(): boolean {
      return this.ws.readyState === WebSocket.CLOSED;
    }
  
    public async ready(): Promise<void> {
      let timedOut = false;
      const timeout = setTimeout(() => timedOut = true, this.connectTimeout);
      while (!this.isOpen() && !timedOut) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      clearTimeout(timeout);
    }
  
    public get readyState(): number {
      return this.ws.readyState;
    }
  
    public get url(): string {
      return this._url;
    }
  
    public set onopen(callback: ((event: Event) => void) | null) {
      this.ws.onopen = callback;
    }
  
    public set onmessage(callback: ((event: MessageEvent) => void) | null) {
      this.ws.onmessage = callback;
    }
  
    public set onerror(callback: ((event: Event) => void) | null) {
      this.ws.onerror = callback;
    }
  
    public set onclose(callback: ((event: CloseEvent) => void) | null) {
      this.ws.onclose = callback;
    }
  
    public on(event: "open" | "message" | "error" | "close", listener: (...args: any[]) => void) {
      if(event === "open") {
        this.ws.onopen = listener;
      } else if(event === "message") {
        this.ws.onmessage = listener;
      } else if(event === "error") {
        this.ws.onerror = listener;
      }
    }

    public off(event?: "open" | "message" | "error" | "close") {
      if(event === "open") {
        this.ws.onopen = null;
      } else if(event === "message") {
        this.ws.onmessage = null;
      } else if(event === "error") {
        this.ws.onerror = null;
      } else if(event === "close") {
        this.ws.onclose = null;
      } else {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
      }
    }
  }
  