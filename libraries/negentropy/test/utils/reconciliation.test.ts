import { describe, it, expect } from 'vitest';
import {
  splitIntoRanges,
  findItemsInRange,
  createBound,
  createFingerprintRange,
  createIdListRange,
  shouldUseIdList
} from '../../src/utils/reconciliation';
import { createMockRecords, createIdFromNumber } from '../setup';

describe('Reconciliation Utils', () => {
  describe('splitIntoRanges', () => {
    describe('when splitting empty record set', () => {
      it('should return empty array', () => {
        const ranges = splitIntoRanges([]);
        expect(ranges).toEqual([]);
      });
    });

    describe('when splitting small record sets', () => {
      it('should create single range for records smaller than target size', () => {
        const records = createMockRecords(10);
        const ranges = splitIntoRanges(records, 16);
        
        expect(ranges).toHaveLength(1);
        expect(ranges[0].items).toHaveLength(10);
        expect(ranges[0].lowerBound.timestamp).toBe(BigInt(0));
        expect(ranges[0].upperBound.timestamp).toBe(BigInt('0xFFFFFFFFFFFFFFFF'));
      });
    });

    describe('when splitting large record sets', () => {
      it('should create multiple ranges', () => {
        const records = createMockRecords(50);
        const ranges = splitIntoRanges(records, 16);
        
        expect(ranges.length).toBeGreaterThan(1);
        
        // Verify ranges are contiguous
        for (let i = 1; i < ranges.length; i++) {
          const prevUpper = ranges[i - 1].upperBound;
          const currentLower = ranges[i].lowerBound;
          expect(currentLower.timestamp).toBe(prevUpper.timestamp);
        }
      });

      it('should respect target range size', () => {
        const records = createMockRecords(100);
        const targetSize = 20;
        const ranges = splitIntoRanges(records, targetSize);
        
        // All ranges except possibly the last should have targetSize items
        for (let i = 0; i < ranges.length - 1; i++) {
          expect(ranges[i].items).toHaveLength(targetSize);
        }
      });
    });
  });

  describe('findItemsInRange', () => {
    const records = [
      { timestamp: BigInt(1000), id: createIdFromNumber(1) },
      { timestamp: BigInt(2000), id: createIdFromNumber(2) },
      { timestamp: BigInt(3000), id: createIdFromNumber(3) },
      { timestamp: BigInt(4000), id: createIdFromNumber(4) },
    ];

    describe('when finding items in timestamp range', () => {
      it('should include items within bounds', () => {
        const items = findItemsInRange(
          records,
          { timestamp: BigInt(1500), id: new Uint8Array(32) },
          { timestamp: BigInt(3500), id: new Uint8Array(32).fill(0xFF) }
        );
        
        expect(items).toHaveLength(2);
        expect(items[0].timestamp).toBe(BigInt(2000));
        expect(items[1].timestamp).toBe(BigInt(3000));
      });

      it('should exclude items outside bounds', () => {
        const items = findItemsInRange(
          records,
          { timestamp: BigInt(2500), id: new Uint8Array(32) },
          { timestamp: BigInt(2800), id: new Uint8Array(32).fill(0xFF) }
        );
        
        expect(items).toHaveLength(0);
      });
    });

    describe('when items have same timestamp', () => {
      const sameTimeRecords = [
        { timestamp: BigInt(1000), id: createIdFromNumber(1) },
        { timestamp: BigInt(1000), id: createIdFromNumber(2) },
        { timestamp: BigInt(1000), id: createIdFromNumber(3) },
      ];

      it('should filter by ID when timestamps are equal', () => {
        const items = findItemsInRange(
          sameTimeRecords,
          { timestamp: BigInt(1000), id: createIdFromNumber(2) },
          { timestamp: BigInt(1000), id: createIdFromNumber(3) }
        );
        
        expect(items).toHaveLength(1);
        expect(items[0].id).toEqual(createIdFromNumber(2));
      });
    });
  });

  describe('createBound', () => {
    describe('when creating bounds with different timestamps', () => {
      it('should calculate offset correctly', () => {
        const bound = createBound(
          BigInt(5000),
          new Uint8Array(32),
          BigInt(3000)
        );
        
        expect(bound.timestampOffset).toBe(BigInt(2001)); // 5000 - 3000 + 1
        expect(bound.idPrefix).toHaveLength(0); // No prefix needed
      });

      it('should encode infinity timestamp as 0', () => {
        const bound = createBound(
          BigInt('0xFFFFFFFFFFFFFFFF'),
          new Uint8Array(32),
          BigInt(1000)
        );
        
        expect(bound.timestampOffset).toBe(BigInt(0));
      });
    });

    describe('when creating bounds with same timestamps', () => {
      it('should include ID prefix for disambiguation', () => {
        const id = new Uint8Array(32);
        id[0] = 0xAB;
        id[1] = 0xCD;
        
        const bound = createBound(
          BigInt(1000),
          id,
          BigInt(1000)
        );
        
        expect(bound.timestampOffset).toBe(BigInt(1)); // Same timestamp offset
        expect(bound.idPrefix.length).toBeGreaterThan(0);
        expect(bound.idPrefix[0]).toBe(0xAB);
      });
    });
  });

  describe('createFingerprintRange', () => {
    describe('when creating fingerprint range', () => {
      it('should create range with mode 1 and 16-byte fingerprint', () => {
        const items = createMockRecords(5);
        const bound = {
          timestampOffset: BigInt(100),
          idPrefix: new Uint8Array()
        };
        
        const range = createFingerprintRange(items, bound);
        
        expect(range.mode).toBe(1);
        expect(range.upperBound).toBe(bound);
        expect(range.payload).toHaveLength(16); // Fingerprint size
      });

      it('should create different fingerprints for different items', () => {
        const items1 = createMockRecords(5, 0);
        const items2 = createMockRecords(5, 100);
        const bound = {
          timestampOffset: BigInt(100),
          idPrefix: new Uint8Array()
        };
        
        const range1 = createFingerprintRange(items1, bound);
        const range2 = createFingerprintRange(items2, bound);
        
        expect(range1.payload).not.toEqual(range2.payload);
      });
    });
  });

  describe('createIdListRange', () => {
    describe('when creating IdList range', () => {
      it('should create range with mode 2 and encoded IDs', () => {
        const items = createMockRecords(3);
        const bound = {
          timestampOffset: BigInt(100),
          idPrefix: new Uint8Array()
        };
        
        const range = createIdListRange(items, bound);
        
        expect(range.mode).toBe(2);
        expect(range.upperBound).toBe(bound);
        
        // Payload should contain varint count + IDs
        expect(range.payload.length).toBeGreaterThan(3 * 32);
      });

      it('should encode correct number of IDs', () => {
        const items = createMockRecords(5);
        const bound = {
          timestampOffset: BigInt(100),
          idPrefix: new Uint8Array()
        };
        
        const range = createIdListRange(items, bound);
        
        // Decode the count from payload
        let offset = 0;
        let count = 0;
        const byte = range.payload[offset];
        if (byte < 128) {
          count = byte;
        }
        
        expect(count).toBe(5);
      });
    });
  });

  describe('shouldUseIdList', () => {
    describe('when deciding between fingerprint and IdList', () => {
      it('should use IdList for small item counts', () => {
        expect(shouldUseIdList(5)).toBe(true);
        expect(shouldUseIdList(8)).toBe(true);
      });

      it('should use fingerprint for large item counts', () => {
        expect(shouldUseIdList(10)).toBe(false);
        expect(shouldUseIdList(100)).toBe(false);
      });

      it('should have threshold at 8 items', () => {
        expect(shouldUseIdList(8)).toBe(true);
        expect(shouldUseIdList(9)).toBe(false);
      });
    });
  });
});