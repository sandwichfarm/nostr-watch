import { EventEmitter } from "tseep";

import { Ingestor } from "#base/Ingestor.js";
import Logger from "#base/Logger.js";  
import type { WebSocketWrapper as WebSocket } from '#base/WebSocketWrapper.js';

import { Nip01ClientMessageGenerator } from "#src/nips/Nip01/utils/generators.js";
import type { Note, RelayEventMessage } from "#src/nips/Nip01/interfaces/index.js";
import { generateSubId } from "#utils/nostr.js";  

export class Sampler {
  private ws: WebSocket;
  private subId: string = "test";
  private _maximumSamples: number = 500;
  private _timeout: ReturnType<typeof setTimeout>;
  private _timeoutMs: number = 5000;
  private _totalSamples: number = 0;  
  private _abort: boolean = false;
  private signal = new EventEmitter();
  private logger: Logger = new Logger('@nostrwatch/auditor:Sampler');
  private _ingestors: Ingestor[] = [];  

  constructor(ws: WebSocket, maximumSamples?: number, timeout?: number) {
    this.ws = ws;
    if(maximumSamples) this._maximumSamples = maximumSamples;
    if(timeout) this._timeoutMs = timeout
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
    this.ws.on('message', (msg: MessageEvent<any>) => {
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
          this.signal.emit('WS:EOSE');
          break;
        }
      }
    });
  }

  private newSubId() {
    this.subId = generateSubId()
  }

  async sample() {
    try {
      await this.ws.connect();
      this.setupHandlers();
  
      const timeout = this.setAbortTimeout();
  
      this.newSubId();
      this.sendRequest();
  
      const result = await this.waitForEoseOrAbort(timeout);
  
      this.logger.debug(`done`);
    } catch (error) {
      this.logger.error(`Error in sample method: ${error.message}`);
    } finally {
      this.cleanupWebSocket();
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
    this.ws.send(message);
  }
  
  private async waitForEoseOrAbort(timeout: NodeJS.Timeout): Promise<boolean> {
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
        this.signal.off('WS:EOSE', onEose);
        clearTimeout(timeout);
        clearInterval(interval);
      };
  
      this.signal.once('WS:EOSE', onEose);
    });
  }
  
  private async cleanupWebSocket() {
    this.ws.terminate();
    await this.ws.closed();
  }
  
  get aborted () {
    return this._abort;
  }

  abort() {
    this._abort = true;
  }
}