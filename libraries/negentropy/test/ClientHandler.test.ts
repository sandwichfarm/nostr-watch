import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientHandler } from '../src/ClientHandler';
import { MockTransport, createMockRecords, parseMessage, createIdFromNumber } from './setup';
import { hexToUint8Array, uint8ArrayToHex } from '../src/utils/hex';
import { decodeMessage, encodeMessage, encodeVarint } from '../src/utils/encoding';
import { computeFingerprint } from '../src/utils/helpers';

describe('ClientHandler', () => {
  let clientTransport: MockTransport;
  let serverTransport: MockTransport;
  let clientRecords: any[];
  let clientHandler: ClientHandler;

  beforeEach(() => {
    clientTransport = new MockTransport();
    serverTransport = new MockTransport();
    clientTransport.connectToPeer(serverTransport);
    
    clientRecords = createMockRecords(5);
    clientHandler = new ClientHandler(
      clientRecords,
      clientTransport,
      { kinds: [1] },
      'test-sub'
    );
  });

  describe('initialization', () => {
    describe('when creating a new handler', () => {
      it('should sort records by timestamp and ID', () => {
        const unsortedRecords = [
          { timestamp: BigInt(3000), id: createIdFromNumber(3) },
          { timestamp: BigInt(1000), id: createIdFromNumber(1) },
          { timestamp: BigInt(2000), id: createIdFromNumber(2) },
        ];
        
        const handler = new ClientHandler(
          unsortedRecords,
          clientTransport,
          {},
          'test'
        );
        
        // Handler should have sorted the records internally
        handler.startSync();
        
        const sentMessage = clientTransport.getSentMessages()[0];
        const parsed = parseMessage(sentMessage);
        expect(parsed[0]).toBe('NEG-OPEN');
      });

      it('should set up message handling', () => {
        let messageReceived = false;
        clientTransport.onMessage(() => {
          messageReceived = true;
        });
        
        // Send a valid JSON message
        const validMessage = JSON.stringify(['NEG-CLOSE', 'test-sub']);
        clientTransport.receiveMessage(validMessage);
        expect(messageReceived).toBe(true);
      });
    });
  });

  describe('startSync', () => {
    describe('when initiating sync', () => {
      it('should send NEG-OPEN message', () => {
        clientHandler.startSync();
        
        const messages = clientTransport.getSentMessages();
        expect(messages).toHaveLength(1);
        
        const parsed = parseMessage(messages[0]);
        expect(parsed[0]).toBe('NEG-OPEN');
        expect(parsed[1]).toBe('test-sub');
        expect(parsed[2]).toEqual({ kinds: [1] });
        expect(parsed[3]).toMatch(/^[0-9a-f]+$/); // Hex message
      });

      it('should send fingerprint of all records', () => {
        clientHandler.startSync();
        
        const messages = clientTransport.getSentMessages();
        const parsed = parseMessage(messages[0]);
        const messageHex = parsed[3];
        const messageBytes = hexToUint8Array(messageHex);
        const ranges = decodeMessage(messageBytes);
        
        expect(ranges).toHaveLength(1);
        expect(ranges[0].mode).toBe(1); // Fingerprint mode
        expect(ranges[0].payload).toHaveLength(16); // Fingerprint size
        
        // Verify fingerprint matches expected
        const expectedFingerprint = computeFingerprint(clientRecords);
        expect(ranges[0].payload).toEqual(expectedFingerprint);
      });
    });

    describe('when records are empty', () => {
      it('should send skip range', () => {
        const emptyHandler = new ClientHandler(
          [],
          clientTransport,
          {},
          'empty-sub'
        );
        
        emptyHandler.startSync();
        
        const messages = clientTransport.getSentMessages();
        const parsed = parseMessage(messages[0]);
        const messageBytes = hexToUint8Array(parsed[3]);
        const ranges = decodeMessage(messageBytes);
        
        expect(ranges).toHaveLength(1);
        expect(ranges[0].mode).toBe(0); // Skip mode
      });
    });
  });

  describe('message handling', () => {
    describe('when receiving NEG-MSG', () => {
      it('should process server ranges and identify differences', () => {
        clientHandler.startSync();
        clientTransport.clearSentMessages();
        
        // Simulate server response with different fingerprint
        const serverRanges = [{
          upperBound: {
            timestampOffset: BigInt(0), // Infinity
            idPrefix: new Uint8Array()
          },
          mode: 1, // Fingerprint
          payload: new Uint8Array(16).fill(0xFF) // Different fingerprint
        }];
        
        const serverMessage = encodeMessage(serverRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'test-sub',
          uint8ArrayToHex(serverMessage)
        ]);
        
        clientTransport.receiveMessage(negMsg);
        
        // Client should send another message to continue reconciliation
        const sentMessages = clientTransport.getSentMessages();
        expect(sentMessages.length).toBeGreaterThan(0);
      });

      it('should handle IdList from server', () => {
        clientHandler.startSync();
        
        // Create server IdList with some overlapping IDs
        const serverId1 = createIdFromNumber(100);
        const serverId2 = createIdFromNumber(200);
        
        const idCount = new Uint8Array([2]); // Varint encoding of 2
        const payload = new Uint8Array(1 + 64);
        payload.set(idCount, 0);
        payload.set(serverId1, 1);
        payload.set(serverId2, 33);
        
        const serverRanges = [{
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array()
          },
          mode: 2, // IdList
          payload: payload
        }];
        
        const serverMessage = encodeMessage(serverRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'test-sub',
          uint8ArrayToHex(serverMessage)
        ]);
        
        clientTransport.receiveMessage(negMsg);
        
        // Check that client identified IDs it needs
        const needsIds = clientHandler.getClientNeedsIds();
        expect(needsIds).toHaveLength(2);
      });

      it('should close connection when reconciliation is complete', () => {
        clientHandler.startSync();
        clientTransport.clearSentMessages();
        
        // Send empty server response (matching fingerprint)
        const serverRanges = [{
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array()
          },
          mode: 1,
          payload: computeFingerprint(clientRecords)
        }];
        
        const serverMessage = encodeMessage(serverRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'test-sub',
          uint8ArrayToHex(serverMessage)
        ]);
        
        clientTransport.receiveMessage(negMsg);
        
        // Client should send NEG-CLOSE
        const sentMessages = clientTransport.getSentMessages();
        const lastMessage = parseMessage(sentMessages[sentMessages.length - 1]);
        expect(lastMessage[0]).toBe('NEG-CLOSE');
      });
    });

    describe('when receiving NEG-ERR', () => {
      it('should handle error messages', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const errMsg = JSON.stringify([
          'NEG-ERR',
          'test-sub',
          'blocked: query too large'
        ]);
        
        clientTransport.receiveMessage(errMsg);
        
        expect(consoleError).toHaveBeenCalledWith('NEG-ERR received: blocked: query too large');
        consoleError.mockRestore();
      });

      it('should ignore errors for different subscriptions', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const errMsg = JSON.stringify([
          'NEG-ERR',
          'different-sub',
          'some error'
        ]);
        
        clientTransport.receiveMessage(errMsg);
        
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
      });
    });

    describe('when receiving NEG-CLOSE', () => {
      it('should handle close messages', () => {
        const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const closeMsg = JSON.stringify([
          'NEG-CLOSE',
          'test-sub'
        ]);
        
        clientTransport.receiveMessage(closeMsg);
        
        expect(consoleLog).toHaveBeenCalledWith('NEG-CLOSE received for subscription test-sub');
        consoleLog.mockRestore();
      });
    });
  });

  describe('reconciliation results', () => {
    describe('when tracking IDs', () => {
      it('should identify IDs client has but server needs', () => {
        clientHandler.startSync();
        
        // Server sends empty IdList (has no items)
        const serverRanges = [{
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array()
          },
          mode: 2, // IdList
          payload: encodeVarint(0) // Empty list
        }];
        
        const serverMessage = encodeMessage(serverRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'test-sub',
          uint8ArrayToHex(serverMessage)
        ]);
        
        clientTransport.receiveMessage(negMsg);
        
        const hasIds = clientHandler.getClientHasIds();
        expect(hasIds).toHaveLength(clientRecords.length);
      });

      it('should identify IDs client needs from server', () => {
        clientHandler.startSync();
        
        // Server sends IDs client doesn't have
        const serverId = createIdFromNumber(999);
        const idCount = new Uint8Array([1]);
        const payload = new Uint8Array(33);
        payload.set(idCount, 0);
        payload.set(serverId, 1);
        
        const serverRanges = [{
          upperBound: {
            timestampOffset: BigInt(0),
            idPrefix: new Uint8Array()
          },
          mode: 2, // IdList
          payload: payload
        }];
        
        const serverMessage = encodeMessage(serverRanges);
        const negMsg = JSON.stringify([
          'NEG-MSG',
          'test-sub',
          uint8ArrayToHex(serverMessage)
        ]);
        
        clientTransport.receiveMessage(negMsg);
        
        const needsIds = clientHandler.getClientNeedsIds();
        expect(needsIds).toHaveLength(1);
        expect(needsIds[0]).toBe(uint8ArrayToHex(serverId));
      });
    });
  });
});