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
    private _eventListenersSet: boolean = false;
    private _ready: boolean = false;
    private _listeners: Map<string, Set<Function>> = new Map();

    constructor(url: string, protocols?: string | string[], options?: { agent?: any, connectTimeout?: number }) {
      this._url = url;
      this.isNode = typeof WebSocket === "undefined";
      this.connectTimeout = options?.connectTimeout || 60000;
      this.connect(protocols, options);
    }
  
    private createWebSocket(protocols?: string | string[], options?: { agent?: any }): WebSocket {
      if (!this.isNode) {
        return new WebSocket(this.url, protocols);
      }
      
      // This will be handled by the static create method for Node/Deno
      throw new Error("WebSocket not supported in this environment. Use UniversalWebSocket.create() for Node.js/Deno environments");
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

    public connect(protocols?: string | string[], options?: { agent?: any }): void {
      if (this.ws && (this?.isConnecting() || this?.isOpen())) {
        return;
      }
      
      this.ws = this.createWebSocket(protocols, options);
      this.setupEventListeners();
    }
  
    private _wrapNodeWS(nodeWS: any): this {
      this.ws = nodeWS;
      this.setupEventListeners();
      return this;
    }
  
    private setupEventListeners(): void {
      if (this._eventListenersSet) {
        return;
      }

      const setupListener = (eventName: string, handler: (event: any) => void) => {
        // Use addEventListener if available (browser)
        if (typeof this.ws.addEventListener === 'function') {
          this.ws.addEventListener(eventName, handler);
        }
        // Fallback to property-based events (Node.js)
        else if (typeof (this.ws as any).on === 'function') {
          (this.ws as any).on(eventName, handler);
        }
        // Last resort fallback
        else {
          (this.ws as any)[`on${eventName}`] = handler;
        }
      };

      // Handle open event
      setupListener('open', (event: Event) => {
        this._onopen();
        this._triggerEvent('open', event);
      });

      // Handle message event
      setupListener('message', (data: any) => {
        let eventData;
        if (typeof data === 'string') {
          eventData = data;
        } else if (data instanceof Buffer) {
          eventData = data.toString();
        } else if (data.data) {
          eventData = data.data;
        } else {
          eventData = data;
        }
        this._triggerEvent('message', new MessageEvent('message', { data: eventData }));
      });

      // Handle error event
      setupListener('error', (event: Event) => {
        this._triggerEvent('error', event);
      });

      // Handle close event
      setupListener('close', (event: any) => {
        // Handle both Node.js style (code, reason) and browser style (event object)
        const closeEvent = event instanceof CloseEvent ? event : 
          new CloseEvent('close', { 
            code: typeof event === 'number' ? event : event?.code || 1000,
            reason: typeof event === 'string' ? event : event?.reason || ''
          });
        this._triggerEvent('close', closeEvent);
      });

      this._eventListenersSet = true;
    }

    private _triggerEvent(eventName: string, event: Event) {
      // Call property-based handlers if they exist
      const handler = (this.ws as any)[`on${eventName}`];
      if (typeof handler === 'function') {
        handler(event);
      }

      // Call all registered event listeners
      const listeners = this._listeners.get(eventName);
      if (listeners) {
        listeners.forEach(listener => listener(event));
      }
    }

    public addEventListener(event: string, listener: EventListener): void {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event)!.add(listener);
    }

    public removeEventListener(event: string, listener: EventListener): void {
      const listeners = this._listeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    }

    public on(event: "open" | "message" | "error" | "close", listener: (...args: any[]) => void) {
      this.addEventListener(event, listener as EventListener);
    }

    public off(event?: "open" | "message" | "error" | "close") {
      if (event) {
        this._listeners.delete(event);
      } else {
        this._listeners.clear();
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
      return this.ws?.readyState === WebSocket.CONNECTING;
    }

    public isConnected(): boolean {
      return this.isOpen();
    }
  
    public isOpen(): boolean {
      return this.ws?.readyState === WebSocket.OPEN;
    }
  
    public isClosing(): boolean {
      return this.ws?.readyState === WebSocket.CLOSING;
    }
  
    public isClosed(): boolean {
      return this.ws?.readyState === WebSocket.CLOSED;
    }
  
    public async ready(): Promise<void> {
      let timedOut = false;
      const timeout = setTimeout(() => timedOut = true, this.connectTimeout);
      while (!this.isOpen() && !timedOut) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      clearTimeout(timeout);
      
      if (timedOut && !this.isOpen()) {
        throw new Error(`WebSocket connection timeout after ${this.connectTimeout}ms`);
      }
    }
  
    public get readyState(): number {
      return this.ws.readyState;
    }
  
    public get url(): string {
      return this._url;
    }
  
    public set onopen(callback: ((event: Event) => void) | null) {
      if (callback) {
        this.addEventListener('open', callback);
      } else {
        this.off('open');
      }
    }
  
    public set onmessage(callback: ((event: MessageEvent) => void) | null) {
      if (callback) {
        this.addEventListener('message', callback);
      } else {
        this.off('message');
      }
    }
  
    public set onerror(callback: ((event: Event) => void) | null) {
      if (callback) {
        this.addEventListener('error', callback);
      } else {
        this.off('error');
      }
    }
  
    public set onclose(callback: ((event: CloseEvent) => void) | null) {
      if (callback) {
        this.addEventListener('close', callback);
      } else {
        this.off('close');
      }
    }

    private _onopen() {
      this._ready = true;
    }
  }
  