import { RecordItem, Range, Bound } from '../types';
import { 
  findItemsInRange, 
  createBound, 
  createFingerprintRange, 
  createIdListRange,
  shouldUseIdList 
} from './reconciliation';

export interface SubdivisionResult {
  ranges: Range[];
  lastTimestamp: bigint;
}

/**
 * Subdivide a range into smaller ranges for efficient reconciliation
 * @param items Items in the range to subdivide
 * @param lowerBound Lower bound of the range
 * @param upperBound Upper bound of the range
 * @param prevTimestamp Previous timestamp for encoding
 * @param targetSize Target size for each subdivision (default 16)
 * @returns Array of ranges representing the subdivision
 */
export function subdivideRange(
  items: RecordItem[],
  lowerBound: { timestamp: bigint; id: Uint8Array },
  upperBound: { timestamp: bigint; id: Uint8Array },
  prevTimestamp: bigint,
  targetSize: number = 16
): SubdivisionResult {
  const ranges: Range[] = [];
  let lastTimestamp = prevTimestamp;

  // If the range is small enough, just send as IdList
  if (shouldUseIdList(items.length)) {
    const bound = createBound(upperBound.timestamp, upperBound.id, lastTimestamp);
    ranges.push(createIdListRange(items, bound));
    return { ranges, lastTimestamp: upperBound.timestamp };
  }

  // Otherwise, subdivide into smaller ranges
  const numSubdivisions = Math.max(2, Math.ceil(Math.sqrt(items.length / targetSize)));
  const itemsPerSubdivision = Math.ceil(items.length / numSubdivisions);

  for (let i = 0; i < numSubdivisions; i++) {
    const startIdx = i * itemsPerSubdivision;
    const endIdx = Math.min((i + 1) * itemsPerSubdivision, items.length);
    
    if (startIdx >= items.length) break;
    
    const subdivisionItems = items.slice(startIdx, endIdx);
    if (subdivisionItems.length === 0) continue;

    // Determine bounds for this subdivision
    const subdivLowerBound = i === 0 ? lowerBound : {
      timestamp: items[startIdx].timestamp,
      id: items[startIdx].id
    };

    // For the upper bound:
    // - If this is the last subdivision, use the original upperBound
    // - Otherwise, use the first item of the next subdivision as exclusive upper bound
    const subdivUpperBound = i === numSubdivisions - 1 || endIdx >= items.length ? 
      upperBound : {
        timestamp: items[endIdx].timestamp,
        id: items[endIdx].id
      };

    const bound = createBound(
      subdivUpperBound.timestamp,
      subdivUpperBound.id,
      lastTimestamp
    );

    // Create appropriate range type
    if (shouldUseIdList(subdivisionItems.length)) {
      ranges.push(createIdListRange(subdivisionItems, bound));
    } else {
      ranges.push(createFingerprintRange(subdivisionItems, bound));
    }

    lastTimestamp = subdivUpperBound.timestamp;
  }

  return { ranges, lastTimestamp };
}

/**
 * Binary search to find the split point that best divides items
 */
export function findOptimalSplitPoint(
  items: RecordItem[],
  targetSplit: number = 0.5
): number {
  if (items.length <= 2) return 1;
  
  // Find the index that gets us closest to the target split ratio
  const idealIndex = Math.floor(items.length * targetSplit);
  
  // If items have the same timestamp, we need to find a good ID-based split
  const idealTimestamp = items[idealIndex].timestamp;
  
  // Find range of items with the same timestamp
  let firstSameTimestamp = idealIndex;
  let lastSameTimestamp = idealIndex;
  
  while (firstSameTimestamp > 0 && items[firstSameTimestamp - 1].timestamp === idealTimestamp) {
    firstSameTimestamp--;
  }
  
  while (lastSameTimestamp < items.length - 1 && items[lastSameTimestamp + 1].timestamp === idealTimestamp) {
    lastSameTimestamp++;
  }
  
  // If all items in the range have the same timestamp, split in the middle
  if (lastSameTimestamp - firstSameTimestamp > 0) {
    return firstSameTimestamp + Math.floor((lastSameTimestamp - firstSameTimestamp + 1) / 2);
  }
  
  return idealIndex;
}