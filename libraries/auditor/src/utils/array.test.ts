import { describe, it, expect, vi } from 'vitest'
import { shuffleArray } from './array'

describe('array utils', () => {
  describe('shuffleArray', () => {
    it('should return an array of the same length', () => {
      const array = [1, 2, 3, 4, 5]
      const shuffled = shuffleArray([...array])
      expect(shuffled).toHaveLength(array.length)
    })

    it('should contain all the same elements', () => {
      const array = [1, 2, 3, 4, 5]
      const shuffled = shuffleArray([...array])
      expect(shuffled.sort()).toEqual(array.sort())
    })

    it('should modify the array in place', () => {
      const array = [1, 2, 3, 4, 5]
      const result = shuffleArray(array)
      expect(result).toBe(array) // Same reference
    })

    it('should work with empty array', () => {
      const array: number[] = []
      const shuffled = shuffleArray(array)
      expect(shuffled).toHaveLength(0)
    })

    it('should work with single element array', () => {
      const array = [1]
      const shuffled = shuffleArray(array)
      expect(shuffled).toEqual(array)
    })

    it('should randomize array elements', () => {
      // Mock Math.random to test shuffling logic
      const mockMath = Object.create(global.Math)
      mockMath.random = vi.fn()
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.1)
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.3)
      global.Math = mockMath

      const array = [1, 2, 3, 4]
      const shuffled = shuffleArray([...array])
      expect(shuffled).not.toEqual(array)
      expect(mockMath.random).toHaveBeenCalled()
    })
  })
}) 