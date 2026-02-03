import { EventEmitter } from "tseep";

import { Ingestor } from "#base/Ingestor.js";
import Logger from "#base/Logger.js";  
import type { UniversalWebSocket as WebSocket } from '@nostrwatch/websocket';

import { Nip01ClientMessageGenerator } from "#src/nips/Nip01/utils/generators.js";
import type { Note, RelayEventMessage } from "#src/nips/Nip01/interfaces/index.js";
import { generateSubId } from "#utils/nostr.js";  
import { Emitter } from "./Emitter";

export class Sampler {
  private socket: WebSocket;
  private subId: string = "test";
  private _maximumSamples: number = 500;
  private _timeout: ReturnType<typeof setTimeout>;
  private _timeoutMs: number = 5000;
  private _totalSamples: number = 0;  
  private _abort: boolean = false;
  // private signal = new EventEmitter();
  private logger: Logger = new Logger('@nostrwatch/auditor:Sampler', {level: 'debug'});
  private _ingestors: Ingestor[] = [];  
  private readonly handleMessage = (msg: MessageEvent<any>) => {
    const message = JSON.parse(msg.data);
    const type = message[0];
    switch(type) {
      case 'EVENT': {
        const note = (message as RelayEventMessage)[2] as Note;
        this._totalSamples++;
        this.runIngestors(note);
        break;
      }
      case 'EOSE': {
        // this.signal.emit('socket:eose');
        Emitter.emit(`socket:eose:${this.subId}`);
        break;
      }
    }
  };

  constructor(socket: WebSocket, maximumSamples?: number, timeout?: number) {
    this.socket = socket;
    if(maximumSamples) this._maximumSamples = maximumSamples;
    if(timeout) this._timeoutMs = timeout
    Emitter.on('all:abort', this.abort.bind(this))
  }

  get ingestors(): Ingestor[] {
    return this._ingestors;
  }

  get samplable() {
    return this.ingestors.length > 0;
  }

  private set ingestor(ingestor: Ingestor) {
    this._ingestors.push(ingestor);
  }

  async runIngestors(note: Note) {
    for(const ingestor of this._ingestors) {
      ingestor.feed(note);
    }
    await Promise.allSettled(this._ingestors.map(ingestor => ingestor.completed()));
    this.abort()
  }

  registerIngestor(ingestor: Ingestor) {
    this.ingestor = ingestor;
  }

  setupHandlers() {
    this.socket.off('message');
    this.socket.on('message', this.handleMessage);
  }

  private newSubId() {
    this.subId = generateSubId()
  }

  async sample(): Promise<boolean> {
    this._abort = false;
    this._totalSamples = 0;

    this.setupHandlers();

    const timeout = this.setAbortTimeout();
    try {
      const ok = await this.socket.connect();
      if (!ok || !this.socket.CONNECTED) return false;

      this.newSubId();

      const wait = this.waitForEoseOrAbort(timeout);
      this.sendRequest();
      return await wait;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in sample method: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeout);
      await this.cleanupWebSocket();
    }
  }
  
  private setAbortTimeout() {
    return setTimeout(() => {
      this.logger.debug('timeout');
      this.abort();
    }, this._timeoutMs);
  }
  
  private sendRequest() {
    const message = Nip01ClientMessageGenerator.REQ(this.subId, [{ limit: this._maximumSamples, since: 0 }]);
    this.socket.send(message);
  }
  
  private async waitForEoseOrAbort(timeout: ReturnType<typeof setTimeout>): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const onEose = () => {
        this.logger.debug('on eose: fulfilled.');
        cleanup();
        resolve(true);
      };
  
      const interval = setInterval(() => {
        if (this._abort || this._totalSamples >= this._maximumSamples) {
          cleanup();
          resolve(false);
        }
      }, 100);
  
      const cleanup = () => {
        Emitter.off(`socket:eose:${this.subId}`, onEose);
        // this.signal.off('socket:eose', onEose);
        clearTimeout(timeout);
        clearInterval(interval);
      };
      
      Emitter.once(`socket:eose:${this.subId}`, onEose);
      // this.signal.once('socket:eose', onEose);
    });
  }
  
  private async cleanupWebSocket() {
    this.socket.close();
    await this.socket.closed();
  }
  
  get aborted () {
    return this._abort;
  }

  abort() {
    this._abort = true;
  }
}
