import crypto from 'crypto';
import { RecordItem } from '../types';
import { encodeVarint } from './encoding';

export function compareUint8Arrays(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

export function computeFingerprint(rangeItems: RecordItem[]): Uint8Array {
  const sum = rangeItems.reduce((acc, item) => {
    const idBigInt = BigInt('0x' + Buffer.from(item.id).reverse().toString('hex'));
    return (acc + idBigInt) % (BigInt(1) << BigInt(256));
  }, BigInt(0));

  const sumBuffer = Buffer.alloc(32);
  sumBuffer.writeBigUInt64LE(sum & BigInt('0xffffffffffffffff'), 0);
  sumBuffer.writeBigUInt64LE((sum >> BigInt(64)) & BigInt('0xffffffffffffffff'), 8);
  sumBuffer.writeBigUInt64LE((sum >> BigInt(128)) & BigInt('0xffffffffffffffff'), 16);
  sumBuffer.writeBigUInt64LE((sum >> BigInt(192)) & BigInt('0xffffffffffffffff'), 24);

  const lengthVarint = encodeVarint(rangeItems.length);

  const concatBuffer = Buffer.concat([sumBuffer, lengthVarint]);

  const hash = crypto.createHash('sha256').update(concatBuffer).digest();
  return hash.subarray(0, 16);
}