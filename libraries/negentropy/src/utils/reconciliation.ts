import { RecordItem, Range, Bound } from '../types';
import { compareUint8Arrays, computeFingerprint } from './helpers';
import { encodeVarint } from './encoding';

export interface ReconciliationRange {
  lowerBound: { timestamp: bigint; id: Uint8Array };
  upperBound: { timestamp: bigint; id: Uint8Array };
  items: RecordItem[];
}

export function splitIntoRanges(
  records: RecordItem[],
  targetRangeSize: number = 16
): ReconciliationRange[] {
  if (records.length === 0) return [];
  
  const ranges: ReconciliationRange[] = [];
  let currentRangeStart = 0;
  
  while (currentRangeStart < records.length) {
    const rangeSize = Math.min(targetRangeSize, records.length - currentRangeStart);
    const rangeEnd = currentRangeStart + rangeSize;
    
    const lowerBound = currentRangeStart === 0 
      ? { timestamp: BigInt(0), id: new Uint8Array(32) }
      : { timestamp: records[currentRangeStart].timestamp, id: records[currentRangeStart].id };
    
    const upperBound = rangeEnd === records.length
      ? { timestamp: BigInt('0xFFFFFFFFFFFFFFFF'), id: new Uint8Array(32).fill(0xFF) }
      : { timestamp: records[rangeEnd].timestamp, id: records[rangeEnd].id };
    
    ranges.push({
      lowerBound,
      upperBound,
      items: records.slice(currentRangeStart, rangeEnd)
    });
    
    currentRangeStart = rangeEnd;
  }
  
  return ranges;
}

export function findItemsInRange(
  records: RecordItem[],
  lowerBound: { timestamp: bigint; id: Uint8Array },
  upperBound: { timestamp: bigint; id: Uint8Array }
): RecordItem[] {
  return records.filter(record => {
    // Check if record is >= lowerBound
    if (record.timestamp < lowerBound.timestamp) return false;
    if (record.timestamp === lowerBound.timestamp && 
        compareUint8Arrays(record.id, lowerBound.id) < 0) return false;
    
    // Check if record is < upperBound
    if (record.timestamp > upperBound.timestamp) return false;
    if (record.timestamp === upperBound.timestamp && 
        compareUint8Arrays(record.id, upperBound.id) >= 0) return false;
    
    return true;
  });
}

export function createBound(
  timestamp: bigint,
  id: Uint8Array,
  prevTimestamp: bigint
): Bound {
  const timestampOffset = timestamp === BigInt('0xFFFFFFFFFFFFFFFF') 
    ? BigInt(0) // Infinity is encoded as 0
    : timestamp - prevTimestamp + BigInt(1);
  
  // Find common prefix length with previous bound if needed
  let idPrefixLength = 0;
  if (timestamp === prevTimestamp) {
    // Need to disambiguate with ID prefix
    for (let i = 0; i < id.length; i++) {
      if (id[i] !== 0) {
        idPrefixLength = i + 1;
        break;
      }
    }
  }
  
  return {
    timestampOffset,
    idPrefix: id.slice(0, idPrefixLength)
  };
}

export function createFingerprintRange(
  items: RecordItem[],
  upperBound: Bound
): Range {
  const fingerprint = computeFingerprint(items);
  return {
    upperBound,
    mode: 1, // Fingerprint mode
    payload: fingerprint
  };
}

export function createIdListRange(
  items: RecordItem[],
  upperBound: Bound
): Range {
  const idCount = items.length;
  const idCountVarint = encodeVarint(idCount);
  
  // Concatenate all IDs
  const idsBuffer = new Uint8Array(32 * idCount);
  for (let i = 0; i < idCount; i++) {
    idsBuffer.set(items[i].id, i * 32);
  }
  
  const payload = new Uint8Array(idCountVarint.length + idsBuffer.length);
  payload.set(idCountVarint, 0);
  payload.set(idsBuffer, idCountVarint.length);
  
  return {
    upperBound,
    mode: 2, // IdList mode
    payload
  };
}

export function shouldUseIdList(itemCount: number): boolean {
  // Use IdList for small sets, Fingerprint for larger ones
  // This threshold can be tuned based on performance testing
  return itemCount <= 8;
}