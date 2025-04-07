import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Emitter } from './Emitter'

describe('Emitter', () => {
  const EVENT_NAME = 'test-event'
  
  beforeEach(() => {
    // Clean up all listeners before each test
    Emitter.removeAllListeners(EVENT_NAME)
  })

  describe('on/emit', () => {
    it('should register and trigger event listeners', () => {
      const listener = vi.fn()
      Emitter.on(EVENT_NAME, listener)
      
      Emitter.emit(EVENT_NAME)
      expect(listener).toHaveBeenCalledTimes(1)
      
      Emitter.emit(EVENT_NAME)
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('should pass arguments to listeners', () => {
      const listener = vi.fn()
      Emitter.on(EVENT_NAME, listener)
      
      const args = ['arg1', 2, { key: 'value' }]
      Emitter.emit(EVENT_NAME, ...args)
      
      // Check that the first call includes our expected arguments
      const firstCall = listener.mock.calls[0]
      expect(firstCall[0]).toBe(args[0])
      expect(firstCall[1]).toBe(args[1])
      expect(firstCall[2]).toEqual(args[2])
    })
  })

  describe('once', () => {
    it('should trigger listener only once', () => {
      const listener = vi.fn()
      Emitter.once(EVENT_NAME, listener)
      
      Emitter.emit(EVENT_NAME)
      Emitter.emit(EVENT_NAME)
      
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('off', () => {
    it('should remove specific listener', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      Emitter.on(EVENT_NAME, listener1)
      Emitter.on(EVENT_NAME, listener2)
      
      Emitter.emit(EVENT_NAME)
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
      
      Emitter.off(EVENT_NAME, listener1)
      Emitter.emit(EVENT_NAME)
      
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(2)
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all listeners for an event', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      Emitter.on(EVENT_NAME, listener1)
      Emitter.on(EVENT_NAME, listener2)
      
      Emitter.removeAllListeners(EVENT_NAME)
      Emitter.emit(EVENT_NAME)
      
      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).not.toHaveBeenCalled()
    })
  })

  describe('listeners', () => {
    it('should return array of listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      Emitter.on(EVENT_NAME, listener1)
      Emitter.on(EVENT_NAME, listener2)
      
      const listeners = Emitter.listeners(EVENT_NAME)
      expect(listeners).toHaveLength(2)
      expect(listeners).toContain(listener1)
      expect(listeners).toContain(listener2)
    })
  })

  describe('listenerCount', () => {
    it('should return correct number of listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      expect(Emitter.listenerCount(EVENT_NAME)).toBe(0)
      
      Emitter.on(EVENT_NAME, listener1)
      expect(Emitter.listenerCount(EVENT_NAME)).toBe(1)
      
      Emitter.on(EVENT_NAME, listener2)
      expect(Emitter.listenerCount(EVENT_NAME)).toBe(2)
      
      Emitter.off(EVENT_NAME, listener1)
      expect(Emitter.listenerCount(EVENT_NAME)).toBe(1)
      
      Emitter.removeAllListeners(EVENT_NAME)
      expect(Emitter.listenerCount(EVENT_NAME)).toBe(0)
    })
  })
}) 