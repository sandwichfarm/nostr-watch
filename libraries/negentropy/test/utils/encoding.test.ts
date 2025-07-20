import { describe, it, expect } from 'vitest';
import { 
  encodeVarint, 
  decodeVarint, 
  encodeMessage, 
  decodeMessage 
} from '../../src/utils/encoding';
import { Range } from '../../src/types';

describe('Encoding Utils', () => {
  describe('Varint encoding', () => {
    describe('when encoding small numbers', () => {
      it('should encode single byte values correctly', () => {
        const encoded = encodeVarint(0);
        expect(encoded).toEqual(new Uint8Array([0]));
      });

      it('should encode 127 as single byte', () => {
        const encoded = encodeVarint(127);
        expect(encoded).toEqual(new Uint8Array([127]));
      });
    });

    describe('when encoding larger numbers', () => {
      it('should encode 128 as two bytes', () => {
        const encoded = encodeVarint(128);
        expect(encoded).toEqual(new Uint8Array([128 | 0x80, 1]));
      });

      it('should encode 16384 correctly', () => {
        const encoded = encodeVarint(16384);
        expect(encoded).toEqual(new Uint8Array([128 | 0x80, 128 | 0x80, 1]));
      });
    });

    describe('when decoding varints', () => {
      it('should decode single byte values', () => {
        const result = decodeVarint(new Uint8Array([42]), 0);
        expect(result.value).toBe(42);
        expect(result.bytesRead).toBe(1);
      });

      it('should decode multi-byte values', () => {
        const encoded = new Uint8Array([128 | 0x80, 1]);
        const result = decodeVarint(encoded, 0);
        expect(result.value).toBe(128);
        expect(result.bytesRead).toBe(2);
      });

      it('should handle offset correctly', () => {
        const buffer = new Uint8Array([0, 0, 42, 0]);
        const result = decodeVarint(buffer, 2);
        expect(result.value).toBe(42);
        expect(result.bytesRead).toBe(1);
      });
    });
  });

  describe('Message encoding', () => {
    describe('when encoding empty ranges', () => {
      it('should encode protocol version correctly', () => {
        const ranges: Range[] = [];
        const encoded = encodeMessage(ranges);
        expect(encoded[0]).toBe(0x61); // Protocol version
      });
    });

    describe('when encoding skip ranges', () => {
      it('should encode skip range with infinity bound', () => {
        const ranges: Range[] = [{
          upperBound: {
            timestampOffset: BigInt(0), // Infinity
            idPrefix: new Uint8Array()
          },
          mode: 0, // Skip
          payload: new Uint8Array()
        }];
        
        const encoded = encodeMessage(ranges);
        expect(encoded[0]).toBe(0x61); // Protocol version
        expect(encoded[1]).toBe(0); // Timestamp offset 0 for infinity
        expect(encoded[2]).toBe(0); // ID prefix length 0
        expect(encoded[3]).toBe(0); // Mode 0 (skip)
      });
    });

    describe('when encoding fingerprint ranges', () => {
      it('should encode fingerprint with 16-byte payload', () => {
        const fingerprint = new Uint8Array(16).fill(0xAB);
        const ranges: Range[] = [{
          upperBound: {
            timestampOffset: BigInt(100),
            idPrefix: new Uint8Array([0x12, 0x34])
          },
          mode: 1, // Fingerprint
          payload: fingerprint
        }];
        
        const encoded = encodeMessage(ranges);
        expect(encoded[0]).toBe(0x61); // Protocol version
        
        // Verify fingerprint payload
        const payloadStart = encoded.length - 16;
        const decodedFingerprint = encoded.slice(payloadStart);
        expect(decodedFingerprint).toEqual(fingerprint);
      });
    });

    describe('when encoding IdList ranges', () => {
      it('should encode IdList with multiple IDs', () => {
        const id1 = new Uint8Array(32).fill(1);
        const id2 = new Uint8Array(32).fill(2);
        
        // Create IdList payload
        const idCount = encodeVarint(2);
        const payload = new Uint8Array(idCount.length + 64);
        payload.set(idCount, 0);
        payload.set(id1, idCount.length);
        payload.set(id2, idCount.length + 32);
        
        const ranges: Range[] = [{
          upperBound: {
            timestampOffset: BigInt(50),
            idPrefix: new Uint8Array()
          },
          mode: 2, // IdList
          payload: payload
        }];
        
        const encoded = encodeMessage(ranges);
        const decoded = decodeMessage(encoded);
        
        expect(decoded).toHaveLength(1);
        expect(decoded[0].mode).toBe(2);
        expect(decoded[0].payload).toEqual(payload);
      });
    });
  });

  describe('Message decoding', () => {
    describe('when decoding valid messages', () => {
      it('should round-trip encode/decode correctly', () => {
        const ranges: Range[] = [
          {
            upperBound: {
              timestampOffset: BigInt(100),
              idPrefix: new Uint8Array([0xAA, 0xBB])
            },
            mode: 1,
            payload: new Uint8Array(16).fill(0x42)
          },
          {
            upperBound: {
              timestampOffset: BigInt(200),
              idPrefix: new Uint8Array()
            },
            mode: 0,
            payload: new Uint8Array()
          }
        ];
        
        const encoded = encodeMessage(ranges);
        const decoded = decodeMessage(encoded);
        
        expect(decoded).toHaveLength(2);
        expect(decoded[0].mode).toBe(1);
        expect(decoded[0].upperBound.timestampOffset).toBe(BigInt(100));
        expect(decoded[0].upperBound.idPrefix).toEqual(new Uint8Array([0xAA, 0xBB]));
        expect(decoded[0].payload).toEqual(new Uint8Array(16).fill(0x42));
        
        expect(decoded[1].mode).toBe(0);
        expect(decoded[1].upperBound.timestampOffset).toBe(BigInt(200));
      });
    });

    describe('when decoding invalid messages', () => {
      it('should throw on wrong protocol version', () => {
        const invalidMessage = new Uint8Array([0x99]); // Wrong version
        expect(() => decodeMessage(invalidMessage)).toThrow('Unsupported protocol version');
      });

      it('should throw on truncated message', () => {
        const truncated = new Uint8Array([0x61, 0x80]); // Incomplete varint
        expect(() => decodeMessage(truncated)).toThrow();
      });
    });
  });
});