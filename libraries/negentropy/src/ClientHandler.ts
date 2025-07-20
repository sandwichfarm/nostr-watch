// src/ClientHandler.ts

import { Transport } from './transports/Transport';
import { hexToUint8Array, uint8ArrayToHex } from './utils/hex';
import { decodeMessage, decodeVarint, encodeMessage } from './utils/encoding';
import { compareUint8Arrays, computeFingerprint } from './utils/helpers';
import { 
  splitIntoRanges, 
  findItemsInRange, 
  createBound, 
  createFingerprintRange,
  createIdListRange,
  shouldUseIdList
} from './utils/reconciliation';
import { subdivideRange } from './utils/rangeSubdivision';
import type { RecordItem, Range, Bound } from './types';

interface RangeToProcess {
  lowerBound: { timestamp: bigint; id: Uint8Array };
  upperBound: { timestamp: bigint; id: Uint8Array };
  serverFingerprint?: Uint8Array;
  ourFingerprint?: Uint8Array;
}

export class ClientHandler {
  private records: RecordItem[];
  private transport: Transport;
  private subscriptionId: string;
  private filter: any;
  private clientHasIds: Set<string> = new Set();
  private clientNeedsIds: Set<string> = new Set();
  private rangesToProcess: RangeToProcess[] = [];
  private lastTimestamp: bigint = BigInt(0);

  constructor(records: RecordItem[], transport: Transport, filter: any, subscriptionId: string) {
    this.records = records;
    this.transport = transport;
    this.filter = filter;
    this.subscriptionId = subscriptionId;

    // Sort records once
    this.records.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp < b.timestamp ? -1 : 1;
      }
      return compareUint8Arrays(a.id, b.id);
    });

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

  public getClientHasIds(): string[] {
    return Array.from(this.clientHasIds);
  }

  public getClientNeedsIds(): string[] {
    return Array.from(this.clientNeedsIds);
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

    try {
      const messageBuffer = hexToUint8Array(messageHex);
      const ranges = decodeMessage(messageBuffer);
      this.processServerRanges(ranges);

      const nextMessage = this.generateNextMessage();
      if (nextMessage) {
        const messageHex = uint8ArrayToHex(nextMessage);
        const negMsg = ["NEG-MSG", this.subscriptionId, messageHex];
        this.transport.send(JSON.stringify(negMsg));
      } else {
        this.sendNegClose();
      }
    } catch (error) {
      console.error('Error processing NEG-MSG:', error);
      // Don't propagate error, just stop processing
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
    this.lastTimestamp = BigInt(0);
    
    if (this.records.length === 0) {
      // Empty set - send skip range
      const ranges: Range[] = [{
        upperBound: {
          timestampOffset: BigInt(0), // Infinity
          idPrefix: new Uint8Array(),
        },
        mode: 0, // Skip
        payload: new Uint8Array()
      }];
      return encodeMessage(ranges);
    }

    // Send single fingerprint for entire set
    const fingerprint = computeFingerprint(this.records);
    const ranges: Range[] = [{
      upperBound: {
        timestampOffset: BigInt(0), // Infinity
        idPrefix: new Uint8Array(),
      },
      mode: 1, // Fingerprint
      payload: fingerprint,
    }];

    return encodeMessage(ranges);
  }

  private generateNextMessage(): Uint8Array | null {
    if (this.rangesToProcess.length === 0) {
      return null;
    }

    const ranges: Range[] = [];
    this.lastTimestamp = BigInt(0);

    while (this.rangesToProcess.length > 0 && ranges.length < 10) {
      const rangeToProcess = this.rangesToProcess.shift()!;
      
      const itemsInRange = findItemsInRange(
        this.records,
        rangeToProcess.lowerBound,
        rangeToProcess.upperBound
      );

      const bound = createBound(
        rangeToProcess.upperBound.timestamp,
        rangeToProcess.upperBound.id,
        this.lastTimestamp
      );

      if (itemsInRange.length === 0) {
        // We have no items in this range - skip it
        ranges.push({
          upperBound: bound,
          mode: 0, // Skip
          payload: new Uint8Array()
        });
      } else if (shouldUseIdList(itemsInRange.length)) {
        // Small range - send IDs directly
        ranges.push(createIdListRange(itemsInRange, bound));
      } else {
        // Large range - subdivide it
        const subdivisionResult = subdivideRange(
          itemsInRange,
          rangeToProcess.lowerBound,
          rangeToProcess.upperBound,
          this.lastTimestamp
        );
        ranges.push(...subdivisionResult.ranges);
        this.lastTimestamp = subdivisionResult.lastTimestamp;
        continue; // Skip the timestamp update below since subdivideRange already handled it
      }

      this.lastTimestamp = rangeToProcess.upperBound.timestamp;
    }

    return ranges.length > 0 ? encodeMessage(ranges) : null;
  }

  private processServerRanges(ranges: Range[]) {
    let currentLowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
    this.lastTimestamp = BigInt(0); // Reset for decoding

    for (const range of ranges) {
      const upperBound = this.decodeBoundToAbsolute(range.upperBound);

      if (range.mode === 0) {
        // Skip range - server says no differences in this range
        // This means either:
        // 1. Server has no items and acknowledges our fingerprint
        // 2. Server's fingerprint matches ours
        // In both cases, we don't mark any differences
      } else if (range.mode === 1) {
        // Fingerprint - compare with ours
        const ourItems = findItemsInRange(this.records, currentLowerBound, upperBound);
        const ourFingerprint = computeFingerprint(ourItems);
        
        if (compareUint8Arrays(ourFingerprint, range.payload) !== 0) {
          // Fingerprints differ - need to subdivide this range
          this.rangesToProcess.push({
            lowerBound: currentLowerBound,
            upperBound: upperBound,
            serverFingerprint: range.payload
          });
        }
      } else if (range.mode === 2) {
        // IdList - process the IDs
        let offset = 0;
        const lengthResult = decodeVarint(range.payload, offset);
        offset += lengthResult.bytesRead;
        const idCount = lengthResult.value;
        
        const serverIds = new Set<string>();
        for (let i = 0; i < idCount; i++) {
          const id = range.payload.subarray(offset, offset + 32);
          offset += 32;
          serverIds.add(uint8ArrayToHex(id));
        }

        // Find what we need from server
        for (const id of serverIds) {
          if (!this.hasId(hexToUint8Array(id))) {
            this.clientNeedsIds.add(id);
          }
        }

        // Find what we have that server doesn't
        // Only check items that are actually within the range the server is reporting for
        const ourItems = findItemsInRange(this.records, currentLowerBound, upperBound);
        for (const item of ourItems) {
          const idHex = uint8ArrayToHex(item.id);
          if (!serverIds.has(idHex)) {
            this.clientHasIds.add(idHex);
          }
        }
      }

      currentLowerBound = upperBound;
    }
  }

  private decodeBoundToAbsolute(bound: Bound): { timestamp: bigint; id: Uint8Array } {
    const timestamp = bound.timestampOffset === BigInt(0) 
      ? BigInt('0xFFFFFFFFFFFFFFFF')
      : this.lastTimestamp + bound.timestampOffset - BigInt(1);
    
    const id = new Uint8Array(32);
    if (bound.idPrefix.length > 0) {
      id.set(bound.idPrefix, 0);
    }
    
    this.lastTimestamp = timestamp;
    return { timestamp, id };
  }

  private hasId(id: Uint8Array): boolean {
    return this.records.some(record => compareUint8Arrays(record.id, id) === 0);
  }

  private sendNegClose() {
    const negCloseMessage = ["NEG-CLOSE", this.subscriptionId];
    this.transport.send(JSON.stringify(negCloseMessage));
  }
}