import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerHandler } from '../src/ServerHandler';
import { MockTransport, createMockRecords, parseMessage, createIdFromNumber } from './setup';
import { hexToUint8Array, uint8ArrayToHex } from '../src/utils/hex';
import { encodeMessage, decodeMessage, decodeVarint } from '../src/utils/encoding';
import { computeFingerprint } from '../src/utils/helpers';
import { RecordItem } from '../src/types';

describe('ServerHandler', () => {
  let serverTransport: MockTransport;
  let serverRecords: RecordItem[];
  let serverHandler: ServerHandler;

  beforeEach(() => {
    serverTransport = new MockTransport();
    serverRecords = createMockRecords(10);
    serverHandler = new ServerHandler(serverRecords, serverTransport);
  });

  describe('initialization', () => {
    describe('when creating a server handler', () => {
      it('should accept records and transport', () => {
        expect(serverHandler).toBeDefined();
      });

      it('should accept optional filter function', () => {
        const filterFn = async (records: RecordItem[], filter: any) => {
          return records.filter(r => r.timestamp > BigInt(1500));
        };
        
        const handlerWithFilter = new ServerHandler(
          serverRecords,
          serverTransport,
          filterFn
        );
        
        expect(handlerWithFilter).toBeDefined();
      });
    });
  });

  describe('NEG-OPEN handling', () => {
    describe('when receiving initial sync request', () => {
      it('should respond with NEG-MSG', async () => {
        const clientFingerprint = computeFingerprint(serverRecords.slice(0, 5));
        const clientRanges = [{
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array()
          },
          mode: 1,
          payload: clientFingerprint
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          { kinds: [1] },
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        expect(sentMessages).toHaveLength(1);
        
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-MSG');
        expect(response[1]).toBe('sub-123');
      });

      it('should apply filter if provided', async () => {
        const filterFn = vi.fn(async (records: RecordItem[], filter: any) => {
          return records.filter(r => r.timestamp < BigInt(1500));
        });
        
        const handlerWithFilter = new ServerHandler(
          serverRecords,
          serverTransport,
          filterFn
        );
        
        const clientMessage = encodeMessage([{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 1,
          payload: new Uint8Array(16)
        }]);
        
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          { kinds: [1] },
          uint8ArrayToHex(clientMessage)
        ]);
        
        await handlerWithFilter.handleMessage(negOpen);
        
        expect(filterFn).toHaveBeenCalledWith(serverRecords, { kinds: [1] });
      });

      it('should handle filter errors', async () => {
        const filterFn = async () => {
          throw new Error('Filter error');
        };
        
        const handlerWithFilter = new ServerHandler(
          serverRecords,
          serverTransport,
          filterFn
        );
        
        const clientMessage = encodeMessage([]);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await handlerWithFilter.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-ERR');
        expect(response[2]).toContain('filter application failed');
      });

      it('should reject queries that are too large', async () => {
        const largeRecords = createMockRecords(100001);
        const largeHandler = new ServerHandler(largeRecords, serverTransport);
        
        const clientMessage = encodeMessage([]);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await largeHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-ERR');
        expect(response[2]).toContain('blocked: this query is too big');
        expect(response[3]).toBe(100000); // Max records limit
      });

      it('should close existing subscription when opening new one with same ID', async () => {
        const clientMessage = encodeMessage([]);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        // Open first subscription
        await serverHandler.handleMessage(negOpen);
        serverTransport.clearSentMessages();
        
        // Open second subscription with same ID
        await serverHandler.handleMessage(negOpen);
        
        // Should still respond normally
        const sentMessages = serverTransport.getSentMessages();
        expect(sentMessages).toHaveLength(1);
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-MSG');
      });
    });

    describe('when decoding client message fails', () => {
      it('should send NEG-ERR for invalid message', async () => {
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          'invalid-hex'
        ]);
        
        await serverHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-ERR');
        expect(response[2]).toContain('invalid');
      });
    });
  });

  describe('NEG-MSG handling', () => {
    describe('when continuing reconciliation', () => {
      beforeEach(async () => {
        // Initialize subscription first
        const clientMessage = encodeMessage([{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 1,
          payload: new Uint8Array(16)
        }]);
        
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negOpen);
        serverTransport.clearSentMessages();
      });

      it('should respond to subsequent client messages', async () => {
        const clientRanges = [{
          upperBound: { timestampOffset: BigInt(2000), idPrefix: new Uint8Array() },
          mode: 2, // IdList
          payload: new Uint8Array([0]) // Empty list
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'sub-123',
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negMsg);
        
        const sentMessages = serverTransport.getSentMessages();
        expect(sentMessages).toHaveLength(1);
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-MSG');
      });

      it('should handle fingerprint mode correctly', async () => {
        const clientFingerprint = new Uint8Array(16).fill(0xAA);
        const clientRanges = [{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 1,
          payload: clientFingerprint
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'sub-123',
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negMsg);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        const responseBytes = hexToUint8Array(response[2]);
        const serverRanges = decodeMessage(responseBytes);
        
        // Server should respond with subdivided ranges when set is large
        // With 10 items, it should create 2 subdivisions
        expect(serverRanges.length).toBeGreaterThanOrEqual(1);
        // Each subdivision should be fingerprint or IdList
        serverRanges.forEach(range => {
          expect([1, 2]).toContain(range.mode);
        });
      });

      it('should error if subscription not found', async () => {
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'unknown-sub',
          uint8ArrayToHex(new Uint8Array([0x61]))
        ]);
        
        await serverHandler.handleMessage(negMsg);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        expect(response[0]).toBe('NEG-ERR');
        expect(response[2]).toContain('closed: subscription not found');
      });
    });
  });

  describe('NEG-CLOSE handling', () => {
    describe('when client closes subscription', () => {
      it('should clean up subscription state', async () => {
        // First open a subscription
        const clientMessage = encodeMessage([]);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negOpen);
        
        // Then close it
        const negClose = JSON.stringify(['NEG-CLOSE', 'sub-123']);
        serverHandler.handleMessage(negClose);
        
        // Try to send NEG-MSG to closed subscription
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'sub-123',
          uint8ArrayToHex(new Uint8Array([0x61]))
        ]);
        
        await serverHandler.handleMessage(negMsg);
        
        const sentMessages = serverTransport.getSentMessages();
        const lastMessage = parseMessage(sentMessages[sentMessages.length - 1]);
        expect(lastMessage[0]).toBe('NEG-ERR');
        expect(lastMessage[2]).toContain('closed');
      });

      it('should handle close for non-existent subscription gracefully', () => {
        const negClose = JSON.stringify(['NEG-CLOSE', 'unknown-sub']);
        
        // Should not throw
        expect(() => {
          serverHandler.handleMessage(negClose);
        }).not.toThrow();
      });
    });
  });

  describe('reconciliation logic', () => {
    describe('when server has items client doesn\'t', () => {
      it('should send IdList for small sets', async () => {
        const smallServerRecords = serverRecords.slice(0, 5);
        const smallHandler = new ServerHandler(smallServerRecords, serverTransport);
        
        // Client sends empty fingerprint (has no items)
        const clientRanges = [{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 1,
          payload: computeFingerprint([])
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await smallHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        const responseBytes = hexToUint8Array(response[2]);
        const serverRanges = decodeMessage(responseBytes);
        
        expect(serverRanges[0].mode).toBe(2); // IdList
      });

      it('should send fingerprint for large sets', async () => {
        // Client sends different fingerprint
        const clientRanges = [{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 1,
          payload: new Uint8Array(16).fill(0xFF)
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        const responseBytes = hexToUint8Array(response[2]);
        const serverRanges = decodeMessage(responseBytes);
        
        // Server subdivides large sets (10 items = 2 subdivisions of 5 each)
        expect(serverRanges.length).toBe(2);
        
        // Each subdivision should be IdList (5 items < 8 threshold)
        let totalItems = 0;
        serverRanges.forEach(range => {
          expect(range.mode).toBe(2); // IdList
          const lengthResult = decodeVarint(range.payload, 0);
          totalItems += lengthResult.value;
        });
        
        // Total items across all subdivisions should equal server records
        expect(totalItems).toBe(serverRecords.length);
      });
    });

    describe('when handling skip ranges', () => {
      it('should skip ranges client skipped', async () => {
        const clientRanges = [{
          upperBound: { timestampOffset: BigInt(0), idPrefix: new Uint8Array() },
          mode: 0, // Skip
          payload: new Uint8Array()
        }];
        
        const clientMessage = encodeMessage(clientRanges);
        const negOpen = JSON.stringify([
          'NEG-OPEN',
          'sub-123',
          {},
          uint8ArrayToHex(clientMessage)
        ]);
        
        await serverHandler.handleMessage(negOpen);
        
        const sentMessages = serverTransport.getSentMessages();
        const response = parseMessage(sentMessages[0]);
        const responseBytes = hexToUint8Array(response[2]);
        const serverRanges = decodeMessage(responseBytes);
        
        expect(serverRanges[0].mode).toBe(0); // Skip
      });
    });
  });
});