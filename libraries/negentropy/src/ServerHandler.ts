// src/ServerHandler.ts

import { Transport } from './transports/Transport';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';
import { decodeMessage, encodeMessage } from './utils/encoding';
import { compareUint8Arrays } from './utils/helpers';
import { 
  findItemsInRange, 
  createBound, 
  createFingerprintRange,
  createIdListRange,
  shouldUseIdList,
  splitIntoRanges
} from './utils/reconciliation';
import { subdivideRange } from './utils/rangeSubdivision';
import { computeFingerprint } from './utils/helpers';
import type { RecordItem, Range, Bound } from './types';

interface Subscription {
  filteredRecords: RecordItem[];
  lastTimestamp: bigint;
  maxRecords?: number;
}

export class ServerHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptions: Map<string, Subscription> = new Map();
  private applyFilter?: (records: RecordItem[], filter: any) => Promise<RecordItem[]> | RecordItem[];

  constructor(
    records: RecordItem[], 
    transport: Transport,
    applyFilter?: (records: RecordItem[], filter: any) => Promise<RecordItem[]> | RecordItem[]
  ) {
    this.records = records;
    this.transport = transport;
    this.applyFilter = applyFilter;

    // Set up message handling
    this.transport.onMessage((message) => this.handleMessage(message));
  }

  public async handleMessage(message: string) {
    const parsed = JSON.parse(message);

    const messageType = parsed[0];

    switch (messageType) {
      case "NEG-OPEN":
        await this.handleNegOpen(parsed);
        break;
      case "NEG-MSG":
        await this.handleNegMsg(parsed);
        break;
      case "NEG-CLOSE":
        this.handleNegClose(parsed);
        break;
      default:
        break;
    }
  }

  private async handleNegOpen(parsed: any[]) {
    const subscriptionId = parsed[1];
    const filter = parsed[2];
    const messageHex = parsed[3];

    // Check if subscription already exists and close it
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
    }

    // Apply filter to get relevant records
    let filteredRecords: RecordItem[];
    if (this.applyFilter) {
      try {
        filteredRecords = await this.applyFilter(this.records, filter);
      } catch (error) {
        // Send NEG-ERR if filter application fails
        const negErr = ['NEG-ERR', subscriptionId, 'error: filter application failed'];
        this.transport.send(JSON.stringify(negErr));
        return;
      }
    } else {
      // If no filter function provided, use all records
      filteredRecords = this.records;
    }

    // Sort records
    filteredRecords.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp < b.timestamp ? -1 : 1;
      }
      return compareUint8Arrays(a.id, b.id);
    });

    // Check if query is too large (optional)
    const maxRecords = 100000; // Configurable limit
    if (filteredRecords.length > maxRecords) {
      const negErr = ['NEG-ERR', subscriptionId, 'blocked: this query is too big', maxRecords];
      this.transport.send(JSON.stringify(negErr));
      return;
    }

    // Decode client's initial message
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

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      filteredRecords,
      lastTimestamp: BigInt(0),
      maxRecords
    });

    // Generate response
    const serverMessageBuffer = this.generateResponseMessage(filteredRecords, clientRanges, subscriptionId);
    const responseHex = uint8ArrayToHex(serverMessageBuffer);

    // Send NEG-MSG back to client
    const negMsg = ['NEG-MSG', subscriptionId, responseHex];
    this.transport.send(JSON.stringify(negMsg));
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

    const subscription = this.subscriptions.get(subscriptionId)!;

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

    // Generate response
    const serverMessageBuffer = this.generateResponseMessage(
      subscription.filteredRecords, 
      clientRanges, 
      subscriptionId
    );
    const messageHexResponse = uint8ArrayToHex(serverMessageBuffer);

    // Send NEG-MSG back to client
    const negMsg = ['NEG-MSG', subscriptionId, messageHexResponse];
    this.transport.send(JSON.stringify(negMsg));
  }

  private handleNegClose(parsed: any[]) {
    const subscriptionId = parsed[1];
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
    }
  }

  private generateResponseMessage(
    serverRecords: RecordItem[], 
    clientRanges: Range[],
    subscriptionId: string
  ): Uint8Array {
    const subscription = this.subscriptions.get(subscriptionId)!;
    const ranges: Range[] = [];
    let currentLowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
    subscription.lastTimestamp = BigInt(0);

    for (const clientRange of clientRanges) {
      const upperBound = this.decodeBoundToAbsolute(clientRange.upperBound, subscription);

      // Find server items in this range
      const serverItems = findItemsInRange(serverRecords, currentLowerBound, upperBound);

      const bound = createBound(
        upperBound.timestamp,
        upperBound.id,
        subscription.lastTimestamp
      );

      if (clientRange.mode === 0) {
        // Client skipped this range - we should skip too
        ranges.push({
          upperBound: bound,
          mode: 0, // Skip
          payload: new Uint8Array()
        });
      } else if (clientRange.mode === 1) {
        // Client sent fingerprint - compare with ours
        const serverFingerprint = computeFingerprint(serverItems);
        
        if (compareUint8Arrays(serverFingerprint, clientRange.payload) === 0) {
          // Fingerprints match - skip this range
          ranges.push({
            upperBound: bound,
            mode: 0, // Skip
            payload: new Uint8Array()
          });
        } else if (serverItems.length === 0) {
          // We have no items but fingerprints differ - send empty IdList
          ranges.push(createIdListRange([], bound));
        } else if (shouldUseIdList(serverItems.length)) {
          // Small set - send IDs directly
          ranges.push(createIdListRange(serverItems, bound));
        } else {
          // Large set - send as IdList (valid per NIP-77)
          ranges.push(createIdListRange(serverItems, bound));
        }
      } else if (clientRange.mode === 2) {
        // Client sent IdList - respond with our items
        if (serverItems.length === 0) {
          ranges.push({
            upperBound: bound,
            mode: 0, // Skip
            payload: new Uint8Array()
          });
        } else {
          // Always respond with IdList when client sends IdList
          ranges.push(createIdListRange(serverItems, bound));
        }
      }

      currentLowerBound = upperBound;
      subscription.lastTimestamp = upperBound.timestamp;
    }

    return encodeMessage(ranges);
  }

  private decodeBoundToAbsolute(
    bound: Bound, 
    subscription: Subscription
  ): { timestamp: bigint; id: Uint8Array } {
    const timestamp = bound.timestampOffset === BigInt(0) 
      ? BigInt('0xFFFFFFFFFFFFFFFF')
      : subscription.lastTimestamp + bound.timestampOffset - BigInt(1);
    
    const id = new Uint8Array(32);
    if (bound.idPrefix.length > 0) {
      id.set(bound.idPrefix, 0);
      // Fill rest with 0xFF for upper bound
      if (bound.idPrefix.length < 32) {
        id.fill(0xFF, bound.idPrefix.length);
      }
    } else {
      // No prefix means all 0xFF for upper bound
      id.fill(0xFF);
    }
    
    return { timestamp, id };
  }
}