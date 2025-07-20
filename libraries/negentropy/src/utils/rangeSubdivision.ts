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
 * Find optimal subdivision boundaries that avoid splitting items with same timestamp
 */
function findSubdivisionBoundaries(items: RecordItem[], numSubdivisions: number): number[] {
  if (items.length === 0 || numSubdivisions <= 1) return [0, items.length];
  
  const boundaries = [0];
  const targetSize = Math.ceil(items.length / numSubdivisions);
  
  let currentIdx = 0;
  for (let i = 1; i < numSubdivisions && currentIdx < items.length; i++) {
    let targetIdx = Math.min(currentIdx + targetSize, items.length);
    
    // Adjust targetIdx to not split items with the same timestamp
    if (targetIdx < items.length && targetIdx > 0) {
      const boundaryTimestamp = items[targetIdx].timestamp;
      
      // Check if there are more items with the same timestamp after targetIdx
      let hasMoreWithSameTimestamp = false;
      for (let j = targetIdx + 1; j < items.length; j++) {
        if (items[j].timestamp === boundaryTimestamp) {
          hasMoreWithSameTimestamp = true;
          break;
        }
        if (items[j].timestamp > boundaryTimestamp) {
          break;
        }
      }
      
      if (hasMoreWithSameTimestamp) {
        // Move to after all items with this timestamp
        const originalTarget = targetIdx;
        while (targetIdx < items.length && items[targetIdx].timestamp === boundaryTimestamp) {
          targetIdx++;
        }
      }
    }
    
    if (targetIdx > currentIdx && targetIdx < items.length) {
      boundaries.push(targetIdx);
      currentIdx = targetIdx;
    }
  }
  
  if (boundaries[boundaries.length - 1] !== items.length) {
    boundaries.push(items.length);
  }
  
  return boundaries;
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

  // Calculate optimal number of subdivisions
  const numSubdivisions = Math.max(2, Math.ceil(Math.sqrt(items.length / targetSize)));
  
  // Find subdivision boundaries that respect timestamp groups
  const boundaries = findSubdivisionBoundaries(items, numSubdivisions);
  
  // Create ranges based on the boundaries
  for (let i = 0; i < boundaries.length - 1; i++) {
    const startIdx = boundaries[i];
    const endIdx = boundaries[i + 1];
    
    if (startIdx >= endIdx) continue;
    
    const subdivisionItems = items.slice(startIdx, endIdx);

    // Determine bounds for this subdivision
    const subdivLowerBound = i === 0 ? lowerBound : {
      timestamp: items[startIdx].timestamp,
      id: items[startIdx].id
    };

    // For the upper bound:
    // - If this is the last subdivision, use the original upperBound
    // - Otherwise, use the first item of the next subdivision as exclusive upper bound
    const subdivUpperBound = i === boundaries.length - 2 || endIdx >= items.length ? 
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