// src/ClientHandler.ts

import { Transport } from './transports/Transport';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';
import { decodeMessage, decodeVarint, encodeMessage } from './utils/encoding';
import { compareUint8Arrays, computeFingerprint } from './utils/helpers';
import type { RecordItem, Range } from './types';

export class ClientHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptionId: string;
  private filter: any;
  private serverRecords: RecordItem[] = [];
  private clientNeedsRecords: RecordItem[] = [];

  constructor(records: RecordItem[], transport: Transport, filter: any, subscriptionId: string) {
    this.records = records;
    this.transport = transport;
    this.filter = filter;
    this.subscriptionId = subscriptionId;

    // Set up message handling
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  public startSync() {
    const initialMessage = this.generateInitialMessage();
    const messageHex = uint8ArrayToHex(initialMessage);

    const negOpenMessage = [
      "NEG-OPEN",
      this.subscriptionId,
      this.filter,
      messageHex,
    ];

    this.transport.send(JSON.stringify(negOpenMessage));
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

    const messageBuffer = hexToUint8Array(messageHex);
    const ranges = decodeMessage(messageBuffer);

    this.processRanges(ranges);

    const nextMessage = this.generateNextMessage();
    if (nextMessage) {
      const messageHex = uint8ArrayToHex(nextMessage);
      const negMsg = ["NEG-MSG", this.subscriptionId, messageHex];
      this.transport.send(JSON.stringify(negMsg));
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
    // Implement logic to generate next message
    return null;
  }

  private processRanges(ranges: Range[]) {
    for (const range of ranges) {
      if (range.mode === 2) {
        let offset = 0;
        const lengthResult = decodeVarint(range.payload, offset);
        offset += lengthResult.bytesRead;
        const idCount = lengthResult.value;
        for (let i = 0; i < idCount; i++) {
          const id = range.payload.subarray(offset, offset + 32);
          offset += 32;
          this.clientNeedsRecords.push({ timestamp: BigInt(0), id });
        }
      }
    }
  }

  private sendNegClose() {
    const negCloseMessage = ["NEG-CLOSE", this.subscriptionId];
    this.transport.send(JSON.stringify(negCloseMessage));
  }
}
