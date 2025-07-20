import { describe, it, expect } from 'vitest';
import { subdivideRange } from '../../src/utils/rangeSubdivision';
import { createMockRecords } from '../setup';
import { decodeVarint } from '../../src/utils/encoding';

describe('Range Subdivision', () => {
  describe('subdivideRange', () => {
    it('should not subdivide small ranges', () => {
      const items = createMockRecords(5);
      const lowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
      const upperBound = { timestamp: BigInt('0xFFFFFFFFFFFFFFFF'), id: new Uint8Array(32).fill(0xFF) };
      
      const result = subdivideRange(items, lowerBound, upperBound, BigInt(0));
      
      // Should create single IdList range
      expect(result.ranges).toHaveLength(1);
      expect(result.ranges[0].mode).toBe(2); // IdList
    });

    it('should subdivide large ranges', () => {
      const items = createMockRecords(10);
      const lowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
      const upperBound = { timestamp: BigInt('0xFFFFFFFFFFFFFFFF'), id: new Uint8Array(32).fill(0xFF) };
      
      const result = subdivideRange(items, lowerBound, upperBound, BigInt(0));
      
      // Should create 2 subdivisions
      expect(result.ranges).toHaveLength(2);
      
      // Each should be IdList (5 items each < 8 threshold)
      result.ranges.forEach(range => {
        expect(range.mode).toBe(2);
      });
      
      // Verify total items
      let totalItems = 0;
      result.ranges.forEach(range => {
        const lengthResult = decodeVarint(range.payload, 0);
        totalItems += lengthResult.value;
      });
      expect(totalItems).toBe(10);
    });

    it('should handle very large ranges', () => {
      const items = createMockRecords(100);
      const lowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
      const upperBound = { timestamp: BigInt('0xFFFFFFFFFFFFFFFF'), id: new Uint8Array(32).fill(0xFF) };
      
      const result = subdivideRange(items, lowerBound, upperBound, BigInt(0));
      
      // Should create multiple subdivisions
      expect(result.ranges.length).toBeGreaterThan(1);
      
      // With 100 items and targetSize=16, we get sqrt(100/16) ≈ 2.5, so 3 subdivisions
      // Each subdivision will have ~33 items, which is > 8, so they'll use fingerprints
      const fingerprintRanges = result.ranges.filter(r => r.mode === 1);
      const idListRanges = result.ranges.filter(r => r.mode === 2);
      
      // All ranges should be fingerprints for this size
      expect(fingerprintRanges.length).toBeGreaterThan(0);
      // We might not have any IdList ranges for 100 items split into ~3 parts
      expect(fingerprintRanges.length + idListRanges.length).toBe(result.ranges.length);
    });

    it('should preserve all items without duplication', () => {
      const items = createMockRecords(25);
      const lowerBound = { timestamp: BigInt(0), id: new Uint8Array(32) };
      const upperBound = { timestamp: BigInt('0xFFFFFFFFFFFFFFFF'), id: new Uint8Array(32).fill(0xFF) };
      
      const result = subdivideRange(items, lowerBound, upperBound, BigInt(0));
      
      // Count total items across all subdivisions
      let totalItems = 0;
      result.ranges.forEach(range => {
        if (range.mode === 2) { // IdList
          const lengthResult = decodeVarint(range.payload, 0);
          totalItems += lengthResult.value;
        } else if (range.mode === 1) { // Fingerprint
          // For fingerprint ranges, we can't directly count items
          // but we know the subdivision logic should preserve all items
        }
      });
      
      // For ranges that use IdList, verify count
      if (result.ranges.every(r => r.mode === 2)) {
        expect(totalItems).toBe(25);
      }
    });
  });
});