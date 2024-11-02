import { Nip01ClientMessageGenerator } from "#src/nips/Nip01";
import { WebSocket } from "ws";
import Logger from '#base/Logger.js';
import { INip01RelayMessage } from "#src/nips/Nip01/interfaces";

export class WebSocketWrapper {
  ws: WebSocket
  relay: string; 
  _ready: boolean = false;
  private logger: Logger = new Logger('@nostrwatch/auditor:WebSocketWrapper'); 

  constructor(relay: string) {
    this.relay = relay;
  }

  on(key: string, fn: (...args: any[]) => void): void {
    this.logger.debug(`binding ${key} event`);
    if(key === 'open' || key === 'close') return console.warn(`Cannot override default ${key} event handler`);
    this.ws.on(key, fn);
  }

  async connect(): Promise<boolean> {
    

    const timeout = setTimeout(() => {
      if(this.CONNECTING) {
        this.logger.debug('Connection timed out');
        this.ws.terminate();
      }
    }, 10000)

    if(this.BUSY) {
      this.logger.debug('Websocket is busy');
      await new Promise(resolve => setTimeout(() => {
        this.logger.debug('retrying connection');
        this.connect().then(resolve);
      }, 500));
      return false;
    }
    else if(this.CONNECTED) {
      // this.logger.warn(`Websocket is already connected to ${this.relay}`);
      return true;
    };
    this.ws = new WebSocket(this.relay);
    this.defaultHandlers();
    while(this.CONNECTING) {
      this.logger.debug(`connecting to ${this.relay}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    clearTimeout(timeout);
    if(this.CLOSED || this.CLOSING) {
      return false
    }
    this.logger.debug(`connected to ${this.relay}`);
    return true
  }

  async ready(): Promise<void> {
    while(!this._ready) {
      return new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async closed(): Promise<void> {
    while(this.BUSY) {
      return new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  off() {
    this.ws.removeAllListeners();
  }

  defaultHandlers() { 
    this.off();
    this.ws.on('open', () => this._ready = true )
    this.ws.on('close', () => this._ready = false )
    this.ws.on('error', (err) => this.logger.debug(`error: ${err}`));
  }

  terminate() {
    this.ws.terminate();
  }

  close() {
    this.ws.close();
  }

  send(data: INip01RelayMessage | Buffer) {
    if(data instanceof Buffer) this.ws.send(data.toString());
    else this.ws.send(JSON.stringify(data));
    
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