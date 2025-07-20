import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientHandler } from '../src/ClientHandler';
import { ServerHandler } from '../src/ServerHandler';
import { MockTransport, createMockRecords, createIdFromNumber } from './setup';
import { RecordItem } from '../src/types';
import { uint8ArrayToHex } from '../src/utils/hex';
import { waitForSync, waitUntil } from './wait-utils';

describe('Integration Tests', () => {
  let clientTransport: MockTransport;
  let serverTransport: MockTransport;

  beforeEach(() => {
    clientTransport = new MockTransport();
    serverTransport = new MockTransport();
    clientTransport.connectToPeer(serverTransport);
  });

  describe('full reconciliation scenarios', () => {
    describe('when client and server have identical sets', () => {
      it('should complete sync with no differences', async () => {
        const sharedRecords = createMockRecords(20);
        
        const client = new ClientHandler(
          sharedRecords,
          clientTransport,
          {},
          'sync-identical'
        );
        
        const server = new ServerHandler(
          sharedRecords,
          serverTransport
        );
        
        // Start sync
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')),
          500
        );
        
        // Check results
        expect(client.getClientHasIds()).toHaveLength(0);
        expect(client.getClientNeedsIds()).toHaveLength(0);
        
        // Verify NEG-CLOSE was sent
        const lastMessage = clientTransport.getSentMessages().pop();
        expect(lastMessage).toContain('NEG-CLOSE');
      });
    });

    describe('when client has subset of server records', () => {
      it('should identify records client needs', async () => {
        const clientRecords = createMockRecords(10, 0);
        const serverRecords = [...clientRecords, ...createMockRecords(10, 100)];
        
        const client = new ClientHandler(
          clientRecords,
          clientTransport,
          {},
          'sync-subset'
        );
        
        const server = new ServerHandler(
          serverRecords,
          serverTransport
        );
        
        client.startSync();
        
        // Wait for sync to complete
        const synced = await waitUntil(
          () => client.getClientNeedsIds().length > 0 || 
                clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')),
          500
        );
        
        expect(client.getClientHasIds()).toHaveLength(0);
        expect(client.getClientNeedsIds()).toHaveLength(10);
      });
    });

    describe('when server has subset of client records', () => {
      it('should identify records client has but server doesn\'t', async () => {
        const serverRecords = createMockRecords(5, 0);
        const clientRecords = [...serverRecords, ...createMockRecords(5, 100)];
        
        const client = new ClientHandler(
          clientRecords,
          clientTransport,
          {},
          'sync-superset'
        );
        
        const server = new ServerHandler(
          serverRecords,
          serverTransport
        );
        
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')) ||
                client.getClientHasIds().length > 0 || 
                client.getClientNeedsIds().length > 0,
          500
        );
        
        expect(client.getClientHasIds()).toHaveLength(5);
        expect(client.getClientNeedsIds()).toHaveLength(0);
      });
    });

    describe('when sets are disjoint', () => {
      it('should identify all differences', async () => {
        const clientRecords = createMockRecords(15, 0);
        const serverRecords = createMockRecords(20, 1000);
        
        const client = new ClientHandler(
          clientRecords,
          clientTransport,
          {},
          'sync-disjoint'
        );
        
        const server = new ServerHandler(
          serverRecords,
          serverTransport
        );
        
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')) ||
                client.getClientHasIds().length > 0 || 
                client.getClientNeedsIds().length > 0,
          500
        );
        
        expect(client.getClientHasIds()).toHaveLength(15);
        expect(client.getClientNeedsIds()).toHaveLength(20);
      });
    });

    describe('when sets partially overlap', () => {
      it('should correctly identify overlapping and unique records', async () => {
        const sharedRecords = createMockRecords(10, 500);
        const clientOnly = createMockRecords(5, 0);
        const serverOnly = createMockRecords(8, 1000);
        
        const clientRecords = [...sharedRecords, ...clientOnly];
        const serverRecords = [...sharedRecords, ...serverOnly];
        
        const client = new ClientHandler(
          clientRecords,
          clientTransport,
          {},
          'sync-overlap'
        );
        
        const server = new ServerHandler(
          serverRecords,
          serverTransport
        );
        
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')) ||
                client.getClientHasIds().length > 0 || 
                client.getClientNeedsIds().length > 0,
          500
        );
        
        expect(client.getClientHasIds()).toHaveLength(5);
        expect(client.getClientNeedsIds()).toHaveLength(8);
      });
    });
  });

  describe('large dataset reconciliation', () => {
    describe('when syncing large sets', () => {
      it('should handle thousands of records efficiently', async () => {
        const clientRecords: RecordItem[] = [];
        const serverRecords: RecordItem[] = [];
        
        // Create large datasets with some overlap
        for (let i = 0; i < 1000; i++) {
          const record = {
            timestamp: BigInt(i * 100),
            id: createIdFromNumber(i)
          };
          
          if (i % 3 !== 0) clientRecords.push(record);
          if (i % 3 !== 1) serverRecords.push(record);
        }
        
        const client = new ClientHandler(
          clientRecords,
          clientTransport,
          {},
          'sync-large'
        );
        
        const server = new ServerHandler(
          serverRecords,
          serverTransport
        );
        
        const startTime = performance.now();
        client.startSync();
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Verify correctness
        const clientHas = client.getClientHasIds();
        const clientNeeds = client.getClientNeedsIds();
        
        expect(clientHas.length).toBeGreaterThan(0);
        expect(clientNeeds.length).toBeGreaterThan(0);
        
        // Should complete reasonably quickly
        expect(duration).toBeLessThan(1000); // 1 second
      });
    });
  });

  describe('error scenarios', () => {
    describe('when server rejects query', () => {
      it('should handle blocked error gracefully', async () => {
        const filterFn = async (records: RecordItem[], filter: any) => {
          // Simulate creating a result set that's too large
          return new Array(100001).fill(null).map((_, i) => ({
            timestamp: BigInt(i),
            id: createIdFromNumber(i)
          }));
        };
        
        const client = new ClientHandler(
          [],
          clientTransport,
          { kinds: [1] },
          'sync-blocked'
        );
        
        const server = new ServerHandler(
          [],
          serverTransport,
          filterFn
        );
        
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')) ||
                client.getClientHasIds().length > 0 || 
                client.getClientNeedsIds().length > 0,
          500
        );
        
        expect(consoleError).toHaveBeenCalledWith(
          expect.stringContaining('blocked: this query is too big')
        );
        
        consoleError.mockRestore();
      });
    });

    describe('when messages are malformed', () => {
      it('should handle protocol errors', async () => {
        const client = new ClientHandler(
          createMockRecords(5),
          clientTransport,
          {},
          'sync-error'
        );
        
        // Manually send malformed message
        clientTransport.receiveMessage(JSON.stringify([
          'NEG-MSG',
          'sync-error',
          'invalid-hex-data'
        ]));
        
        // Client should handle error gracefully
        expect(client.getClientHasIds()).toHaveLength(0);
        expect(client.getClientNeedsIds()).toHaveLength(0);
      });
    });
  });

  describe('filter application', () => {
    describe('when server applies filters', () => {
      it('should only sync filtered records', async () => {
        const allRecords: RecordItem[] = [
          { timestamp: BigInt(1000), id: createIdFromNumber(1) },
          { timestamp: BigInt(2000), id: createIdFromNumber(2) },
          { timestamp: BigInt(3000), id: createIdFromNumber(3) },
          { timestamp: BigInt(4000), id: createIdFromNumber(4) },
          { timestamp: BigInt(5000), id: createIdFromNumber(5) },
        ];
        
        const filterFn = async (records: RecordItem[], filter: any) => {
          // Only return records with timestamp > 2500
          return records.filter(r => r.timestamp > BigInt(2500));
        };
        
        const client = new ClientHandler(
          allRecords.slice(0, 2), // Client has first 2 records
          clientTransport,
          { since: 2500 },
          'sync-filtered'
        );
        
        const server = new ServerHandler(
          allRecords,
          serverTransport,
          filterFn
        );
        
        client.startSync();
        
        // Wait for sync to complete
        await waitUntil(
          () => clientTransport.getSentMessages().some(msg => msg.includes('NEG-CLOSE')) ||
                client.getClientHasIds().length > 0 || 
                client.getClientNeedsIds().length > 0,
          500
        );
        
        // Client should only learn about filtered records
        const needsIds = client.getClientNeedsIds();
        expect(needsIds).toHaveLength(3); // Records 3, 4, 5
        
        // Verify these are the correct records
        const neededRecords = allRecords.slice(2);
        for (const record of neededRecords) {
          expect(needsIds).toContain(uint8ArrayToHex(record.id));
        }
      });
    });
  });
});