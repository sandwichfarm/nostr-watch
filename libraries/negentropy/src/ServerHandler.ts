// src/ServerHandler.ts

import { Range, RecordItem } from './types';
import { decodeMessage, encodeMessage, encodeVarint } from './utils/encoding';
import { Transport } from './transports/Transport';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';

type ApplyFilterFunction = (records: RecordItem[], filter: any) => Promise<RecordItem[]>;

export class ServerHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptions: Map<string, any>;
  private applyFilter: ApplyFilterFunction;

  constructor(records: RecordItem[], transport: Transport, applyFilter: ApplyFilterFunction) {
    this.records = records;
    this.transport = transport;
    this.subscriptions = new Map();
    this.applyFilter = applyFilter;

    // Set up message handling
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  public async handleMessage(message: string) {
    const parsed = JSON.parse(message);

    const messageType = parsed[0];

    switch (messageType) {
      case 'NEG-OPEN':
        await this.handleNegOpen(parsed);
        break;
      case 'NEG-MSG':
        await this.handleNegMsg(parsed);
        break;
      case 'NEG-CLOSE':
        this.handleNegClose(parsed);
        break;
      default:
        break;
    }
  }

  private async handleNegOpen(parsed: any[]) {
    const subscriptionId = parsed[1];
    const filter = parsed[2];
    const initialMessageHex = parsed[3];

    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
    }

    // Apply filter to server records (asynchronous)
    let filteredRecords: RecordItem[];
    try {
      filteredRecords = await this.applyFilter(this.records, filter);
    } catch (error) {
      // Send NEG-ERR if filter application fails
      const negErr = ['NEG-ERR', subscriptionId, 'error: failed to apply filter'];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    // Decode client's initial message
    let clientRanges: Range[];
    try {
      const clientMessageBuffer = hexToUint8Array(initialMessageHex);
      clientRanges = decodeMessage(clientMessageBuffer);
    } catch (error) {
      // Send NEG-ERR if message cannot be decoded
      const negErr = ['NEG-ERR', subscriptionId, 'invalid: failed to decode initial message'];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    // Generate server response
    const serverMessageBuffer = await this.generateResponseMessage(filteredRecords, clientRanges);
    const messageHex = uint8ArrayToHex(serverMessageBuffer);

    // Send NEG-MSG back to client
    const negMsg = ['NEG-MSG', subscriptionId, messageHex];
    this.transport.send(JSON.stringify(negMsg));

    // Store subscription state
    this.subscriptions.set(subscriptionId, {
      filteredRecords,
      clientRanges,
    });
  }

  private async handleNegMsg(parsed: any[]) {
    const subscriptionId = parsed[1];
    const messageHex = parsed[2];

    if (!this.subscriptions.has(subscriptionId)) {
      // Send NEG-ERR: closed
      const negErr = ['NEG-ERR', subscriptionId, 'closed: subscription not found'];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    const subscription = this.subscriptions.get(subscriptionId);

    // Decode client's message
    let clientRanges: Range[];
    try {
      const clientMessageBuffer = hexToUint8Array(messageHex);
      clientRanges = decodeMessage(clientMessageBuffer);
    } catch (error) {
      // Send NEG-ERR if message cannot be decoded
      const negErr = ['NEG-ERR', subscriptionId, 'invalid: failed to decode message'];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    // Generate server response
    const serverMessageBuffer = await this.generateResponseMessage(subscription.filteredRecords, clientRanges);
    const messageHexResponse = uint8ArrayToHex(serverMessageBuffer);

    // Send NEG-MSG back to client
    const negMsg = ['NEG-MSG', subscriptionId, messageHexResponse];
    this.transport.send(JSON.stringify(negMsg));

    // Update subscription state
    subscription.clientRanges = clientRanges;
  }

  private handleNegClose(parsed: any[]) {
    const subscriptionId = parsed[1];
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
    }
  }

  private async generateResponseMessage(serverRecords: RecordItem[], clientRanges: Range[]): Promise<Uint8Array> {
    // For simplicity, we'll send an IdList of all server records
    const idCount = serverRecords.length;
    const idCountVarint = encodeVarint(idCount);

    // Concatenate all IDs
    const idsBuffer = new Uint8Array(32 * idCount);
    for (let i = 0; i < idCount; i++) {
      idsBuffer.set(serverRecords[i].id, i * 32);
    }

    const payload = new Uint8Array(idCountVarint.length + idsBuffer.length);
    payload.set(idCountVarint, 0);
    payload.set(idsBuffer, idCountVarint.length);

    const ranges: Range[] = [
      {
        upperBound: {
          timestampOffset: BigInt(0), // Infinity timestamp encoded as 0
          idPrefix: new Uint8Array(),
        },
        mode: 2, // IdList
        payload: payload,
      },
    ];

    return encodeMessage(ranges);
  }
}
