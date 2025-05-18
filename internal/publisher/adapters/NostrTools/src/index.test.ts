import { describe, it, expect, vi, beforeEach } from 'vitest'
import WsAdapter from './index'

// Mock the SimplePool from nostr-tools
vi.mock('nostr-tools', () => {
  return {
    SimplePool: vi.fn().mockImplementation(() => {
      return {
        publish: vi.fn().mockResolvedValue(['success'])
      }
    })
  }
})

describe('WsAdapter', () => {
  let adapter: WsAdapter
  const testRelays = ['wss://relay1.com', 'wss://relay2.com']
  
  beforeEach(() => {
    adapter = new WsAdapter(testRelays)
  })
  
  it('should initialize with the provided relays', () => {
    expect(adapter.relays).toEqual(testRelays)
    expect(adapter.pool).toBeDefined()
  })
  
  it('should publish events to the pool', async () => {
    const testEvent = { id: 'test-id', content: 'test-content' }
    
    const result = await adapter.publish(testEvent)
    
    expect(result).toEqual(['success'])
    expect(adapter.pool.publish).toHaveBeenCalledWith(testRelays, testEvent)
  })
}) 