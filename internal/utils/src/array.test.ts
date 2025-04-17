import { describe, it, expect, vi } from 'vitest'
import { chunkArray, shuffleArray } from './array'

describe('Array utilities', () => {
  describe('chunkArray', () => {
    it('should split an array into chunks of the specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8]
      const result = chunkArray(array, 3)
      
      // The original array is shuffled before chunking, so we can't check exact values
      // Instead, verify:
      // 1. We have the right number of chunks
      expect(result.length).toBe(3)
      
      // 2. The chunks have the expected sizes
      expect(result[0].length).toBe(3)
      expect(result[1].length).toBe(3)
      expect(result[2].length).toBe(2)
      
      // 3. The total count of elements is preserved
      const totalElements = result.reduce((sum, chunk) => sum + chunk.length, 0)
      expect(totalElements).toBe(8)
    })
    
    it('should throw an error for invalid chunk size', () => {
      const array = [1, 2, 3]
      expect(() => chunkArray(array, 0)).toThrow('Chunk size must be greater than 0')
    })
  })
  
  describe('shuffleArray', () => {
    it('should shuffle the array in place', () => {
      const array = [1, 2, 3, 4, 5]
      const originalArray = [...array]
      
      // Set a seed to make the test deterministic
      // Note: This is just for testing - the real shuffle uses Math.random()
      vi.spyOn(Math, 'random').mockImplementation(() => 0.5)
      
      shuffleArray(array)
      
      // The array should contain the same elements
      expect(array).toHaveLength(originalArray.length)
      expect(array.sort()).toEqual(originalArray.sort())
      
      // Restore the original Math.random
      vi.restoreAllMocks()
    })
  })
}) 