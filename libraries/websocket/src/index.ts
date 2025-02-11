declare global {
    interface GlobalThis {
        Deno?: any;
    }
  }
  
  export class UniversalWebSocket {
    private ws: WebSocket;
    private isNode: boolean;
  
    constructor(url: string, protocols?: string | string[], options?: { agent?: any }) {
      this.isNode = typeof WebSocket === "undefined";
      this.ws = this.createWebSocket(url, protocols, options);
      this.setupEventListeners();
    }
  
    private createWebSocket(url: string, protocols?: string | string[], options?: { agent?: any }): WebSocket {
      if (!this.isNode) {
        return new WebSocket(url, protocols);
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
  
    private _wrapNodeWS(nodeWS: any): this {
      this.ws = nodeWS;
      this.setupEventListeners();
      return this;
    }
  
    private setupEventListeners(): void {
      if (typeof (this.ws as any).on === "function") {
        (this.ws as any).on("open", () => this.onopen?.(new Event("open")));
        (this.ws as any).on("message", (data: any) => this.onmessage?.(new MessageEvent("message", { data })));
        (this.ws as any).on("error", (err: any) => this.onerror?.(new Event("error")));
        (this.ws as any).on("close", (code: number, reason: string) => this.onclose?.(new CloseEvent("close", { code, reason })));
      }
    }
  
    public send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      this.ws.send(data);
    }
  
    public close(code?: number, reason?: string) {
      this.ws.close(code, reason);
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
  
    public isConnecting(): boolean {
      return this.ws.readyState === WebSocket.CONNECTING;
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
      while (!this.isOpen()) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  
    public get readyState(): number {
      return this.ws.readyState;
    }
  
    public get url(): string {
      return this.ws.url;
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
      if (typeof (this.ws as any).on === "function") {
        (this.ws as any).on(event, listener);
      }
    }
  }
  