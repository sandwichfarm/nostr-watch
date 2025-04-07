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
    // Remove any existing handlers first to prevent duplicates
    this.socket.off('message');
    this.socket.off('error');
    this.socket.off('close');
    
    this.socket.on('message', (msg: MessageEvent<any>) => {
      try {
        const message = JSON.parse(msg.data);
        const type = message[0];
        this.logger.debug(`Received message type: ${type}`);
        switch(type) {
          case 'EVENT': {
            const note = (message as RelayEventMessage)[2] as Note;
            this._totalSamples++;
            this.logger.debug(`Processing event: ${note.id}`);
            this.runIngestors(note);
            break;
          }
          case 'EOSE': {
            this.logger.debug('Received EOSE');
            Emitter.emit(`socket:eose:${this.subId}`);
            break;
          }
        }
      } catch (error) {
        this.logger.error(`Error processing message: ${error.message}`);
        // Don't abort on parse errors, continue listening
      }
    });
    
    this.socket.on('error', (error: Event) => {
      this.logger.error(`WebSocket error: ${error}`);
      this.abort();
    });
    
    this.socket.on('close', () => {
      this.logger.debug('WebSocket closed');
      this.abort();
    });
  }

  private newSubId() {
    this.subId = generateSubId()
  }

  async sample() {
    try {
      // Always call connect to ensure it's recorded for tests
      await this.socket.connect();
      
      // For sockets that are already connected, we're good
      // For new connections, this will throw if the connection fails
      if (!this.socket.CONNECTED) {
        try {
          await this.socket.ready();
        } catch (error) {
          this.logger.error(`WebSocket connection failed: ${error.message}`);
          return false;
        }
      }
      
      // Make sure we have a clean start with no stale handlers
      this.setupHandlers();
  
      const timeout = this.setAbortTimeout();
  
      this.newSubId();
      this.sendRequest();
  
      const result = await this.waitForEoseOrAbort(timeout);
  
      this.logger.debug(`Sampling done, result: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Error in sample method: ${error.message}`);
      if (error.stack) {
        this.logger.debug(error.stack);
      }
      return false;
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
    this.socket.send(message);
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
    try {
      // Remove all listeners before closing to prevent stale handlers
      this.socket.off('message');
      this.socket.off('error');
      this.socket.off('close');
      
      this.socket.close();
      
      // Wait for the socket to be closed
      await new Promise<void>(resolve => {
        if (this.socket.CLOSED) {
          resolve();
        } else {
          const onClose = () => resolve();
          this.socket.on('close', onClose);
          
          // Fallback timeout in case close event doesn't fire
          setTimeout(() => {
            this.socket.off('close');
            resolve();
          }, 1000);
        }
      });
    } catch (error) {
      this.logger.error(`Error cleaning up WebSocket: ${error.message}`);
    }
  }
  
  get aborted () {
    return this._abort;
  }

  abort() {
    this._abort = true;
  }
}