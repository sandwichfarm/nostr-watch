import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Sampler } from './Sampler'
import { Ingestor } from './Ingestor'
import { Emitter } from './Emitter'

// Mock WebSocket
class MockWebSocket {
  private handlers: Record<string, Function[]> = {}
  public closed = vi.fn().mockResolvedValue(undefined)
  public close = vi.fn()
  public connect = vi.fn().mockResolvedValue(undefined)
  public send = vi.fn()
  public ready = vi.fn().mockResolvedValue(undefined)
  public off = vi.fn()
  public terminate = vi.fn()
  public readonly CONNECTED = true
  public readonly CLOSED = false

  on(event: string, handler: Function) {
    if (!this.handlers[event]) {
      this.handlers[event] = []
    }
    this.handlers[event].push(handler)
  }

  emit(event: string, data: any) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data))
    }
  }
}

describe('Sampler', () => {
  let sampler: Sampler
  let mockSocket: MockWebSocket
  let mockIngestor: Ingestor

  beforeEach(() => {
    mockSocket = new MockWebSocket()
    sampler = new Sampler(mockSocket as any, 10, 1000)
    mockIngestor = {
      feed: vi.fn(),
      completed: vi.fn().mockResolvedValue(undefined)
    } as any
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultSampler = new Sampler(mockSocket as any)
      expect(defaultSampler).toBeDefined()
    })

    it('should initialize with custom values', () => {
      const customSampler = new Sampler(mockSocket as any, 20, 2000)
      expect(customSampler).toBeDefined()
    })
  })

  describe('ingestors', () => {
    it('should start with empty ingestors array', () => {
      expect(sampler.ingestors).toHaveLength(0)
    })

    it('should register an ingestor', () => {
      sampler.registerIngestor(mockIngestor)
      expect(sampler.ingestors).toHaveLength(1)
    })

    it('should be samplable when ingestors exist', () => {
      expect(sampler.samplable).toBe(false)
      sampler.registerIngestor(mockIngestor)
      expect(sampler.samplable).toBe(true)
    })
  })

  describe('sample', () => {
    it('should connect to websocket when sampling', async () => {
      sampler.registerIngestor(mockIngestor)
      const samplePromise = sampler.sample()
      
      // Simulate EOSE message
      mockSocket.emit('message', { 
        data: JSON.stringify(['EOSE', 'test'])
      })

      await samplePromise
      expect(mockSocket.connect).toHaveBeenCalled()
    })

    it('should process EVENT messages', async () => {
      sampler.registerIngestor(mockIngestor)
      const samplePromise = sampler.sample()

      // Wait for the socket connection to be established
      await new Promise(resolve => setTimeout(resolve, 0))

      const mockNote = { id: '123', content: 'test' }
      mockSocket.emit('message', {
        data: JSON.stringify(['EVENT', 'test', mockNote])
      })

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 0))

      mockSocket.emit('message', {
        data: JSON.stringify(['EOSE', 'test'])
      })

      await samplePromise
      expect(mockIngestor.feed).toHaveBeenCalledWith(mockNote)
    })

    it('should abort on timeout', async () => {
      sampler.registerIngestor(mockIngestor)
      const shortTimeoutSampler = new Sampler(mockSocket as any, 10, 100)
      
      await shortTimeoutSampler.sample()
      expect(shortTimeoutSampler.aborted).toBe(true)
    })
  })

  describe('abort', () => {
    it('should set abort flag', () => {
      expect(sampler.aborted).toBe(false)
      sampler.abort()
      expect(sampler.aborted).toBe(true)
    })

    it('should abort on global abort event', () => {
      expect(sampler.aborted).toBe(false)
      Emitter.emit('all:abort')
      expect(sampler.aborted).toBe(true)
    })
  })
}) 