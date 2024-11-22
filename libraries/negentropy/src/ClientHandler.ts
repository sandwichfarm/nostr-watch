import type { RecordItem, Range } from "./types";
import { decodeMessage, decodeVarint, encodeMessage } from "./utils/encoding";
import { compareUint8Arrays, computeFingerprint } from "./utils/utils";

export class ClientHandler {
    private records: RecordItem[];
    private websocket: WebSocket;
    private subscriptionId: string;
    private filter: any;
    private serverRecords: RecordItem[] = [];
    private clientNeedsRecords: RecordItem[] = [];
  
    constructor(records: RecordItem[], websocket: WebSocket, filter: any, subscriptionId: string) {
      this.records = records;
      this.websocket = websocket;
      this.filter = filter;
      this.subscriptionId = subscriptionId;
    }
  
    public startSync() {
      const initialMessage = this.generateInitialMessage();
      const messageHex = Buffer.from(initialMessage).toString('hex');
  
      const negOpenMessage = [
        "NEG-OPEN",
        this.subscriptionId,
        this.filter,
        messageHex,
      ];
  
      this.websocket.send(JSON.stringify(negOpenMessage));
    }
  
    public handleMessage(message: string) {
      const parsed = JSON.parse(message);
  
      const messageType = parsed[0];
  
      switch (messageType) {
        case "NEG-MSG":
          this.handleNegMsg(parsed);
          break;
        case "NEG-ERR":
          this.handleNegErr(parsed);
          break;
        case "NEG-CLOSE":
          this.handleNegClose(parsed);
          break;
        default:
          break;
      }
    }
  
    private handleNegMsg(parsed: any[]) {
      const subscriptionId = parsed[1];
      const messageHex = parsed[2];
      if (subscriptionId !== this.subscriptionId) return;
  
      const messageBuffer = Buffer.from(messageHex, 'hex');
      const ranges = decodeMessage(messageBuffer);
  
      this.processRanges(ranges);
  
      const nextMessage = this.generateNextMessage();
      if (nextMessage) {
        const messageHex = Buffer.from(nextMessage).toString('hex');
        const negMsg = ["NEG-MSG", this.subscriptionId, messageHex];
        this.websocket.send(JSON.stringify(negMsg));
      } else {
        this.sendNegClose();
      }
    }
  
    private handleNegErr(parsed: any[]) {
      const subscriptionId = parsed[1];
      const reason = parsed[2];
      if (subscriptionId !== this.subscriptionId) return;
  
      console.error(`NEG-ERR received: ${reason}`);
    }
  
    private handleNegClose(parsed: any[]) {
      const subscriptionId = parsed[1];
      if (subscriptionId !== this.subscriptionId) return;
  
      console.log(`NEG-CLOSE received for subscription ${subscriptionId}`);
    }
  
    private generateInitialMessage(): Uint8Array {
  
      this.records.sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp < b.timestamp ? -1 : 1;
        }
        return compareUint8Arrays(a.id, b.id);
      });
  
      const fingerprint = computeFingerprint(this.records);
  
      const ranges: Range[] = [
        {
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array(),
          },
          mode: 1,
          payload: fingerprint,
        },
      ];
  
      return encodeMessage(ranges);
    }
  
    private generateNextMessage(): Uint8Array | null {
      return null;
    }
  
    private processRanges(ranges: Range[]) {
      for (const range of ranges) {
        if (range.mode === 2) {
          let offset = 0;
          const lengthResult = decodeVarint(range.payload, offset);
          offset += lengthResult.bytesRead;
          const idCount = lengthResult.value;
          const ids: Uint8Array[] = [];
          for (let i = 0; i < idCount; i++) {
            const id = range.payload.subarray(offset, offset + 32);
            ids.push(id);
            offset += 32;
          }
          for (const id of ids) {
            this.clientNeedsRecords.push({ timestamp: BigInt(0), id });
          }
        }
      }
    }
  
    private sendNegClose() {
      const negCloseMessage = ["NEG-CLOSE", this.subscriptionId];
      this.websocket.send(JSON.stringify(negCloseMessage));
    }
  }
  