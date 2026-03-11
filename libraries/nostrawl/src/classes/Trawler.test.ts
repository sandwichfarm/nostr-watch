import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';

// Mock modules first (these are hoisted to the top)
vi.mock('lmdb', () => {
  return {
    open: vi.fn().mockReturnValue({
      get: vi.fn(),
      put: vi.fn(),
      getRange: vi.fn()
    })
  };
});

// Mock applesauce-relay
const mockSubscribe = vi.fn();
vi.mock('applesauce-relay', () => ({
  Relay: vi.fn().mockImplementation(() => ({
    request: vi.fn().mockReturnValue({ subscribe: mockSubscribe }),
    sync: vi.fn().mockReturnValue({ subscribe: mockSubscribe }),
    close: vi.fn()
  })),
  SyncDirection: { RECEIVE: 1, SEND: 2, BOTH: 3 }
}));

import NTTrawler from './Trawler';
import { TrawlerOptions } from '../types';
import * as lmdb from 'lmdb';

describe('NTTrawler', () => {
  let trawler: NTTrawler;
  const relays = ['wss://relay1.com', 'wss://relay2.com'];
  const options: TrawlerOptions = {
    queueName: 'testQueue',
    repeatWhenComplete: true,
    restDuration: 1000,
    cache: {
      enabled: true,
      path: './cache'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDb = vi.mocked(lmdb.open)();
    mockDb.get.mockReturnValue(1234567890);
    mockDb.put.mockResolvedValue(undefined);
    mockDb.getRange.mockReturnValue([
      { key: 'has:event1', value: true },
      { key: 'has:event2', value: true }
    ]);
    // Make subscribe call complete immediately by default
    mockSubscribe.mockImplementation(({ complete }) => {
      if (complete) complete();
      return { unsubscribe: vi.fn() };
    });
    trawler = new NTTrawler(relays, options);
    // Add the pause method to the instance
    trawler.pause = vi.fn();
    trawler.resume = vi.fn();
    // Mock the protected addJob method
    (trawler as any)['addJob'] = vi.fn().mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with the correct options', () => {
    expect(trawler).toBeDefined();
    expect(trawler['relays']).toEqual(relays);
    expect(trawler['options']).toEqual(expect.objectContaining(options));
  });

  it('should open the cache when run is called', async () => {
    await trawler.run();
    expect(trawler['cache']).toBeDefined();
    expect(trawler.pause).toHaveBeenCalled();
    expect(trawler.resume).toHaveBeenCalled();
  });

  it('should chunk relays correctly', () => {
    const chunks = trawler['chunk_relays']();
    expect(chunks).toEqual([relays]);
  });

  it('should get since timestamp correctly', async () => {
    await trawler.openCache();
    const timestamp = await trawler['getSince']('wss://relay1.com');
    const mockDb = vi.mocked(lmdb.open)();
    expect(mockDb.get).toHaveBeenCalledWith('lastUpdate:wss://relay1.com');
    expect(timestamp).toBe(1234567890);
  });

  it('should update since timestamp correctly', async () => {
    await trawler.openCache();
    await trawler['updateSince']('wss://relay1.com', 1234567890);
    const mockDb = vi.mocked(lmdb.open)();
    expect(mockDb.put).toHaveBeenCalledWith('lastUpdate:wss://relay1.com', 1234567890);
  });

  it('should count events correctly', async () => {
    await trawler.openCache();
    const count = await trawler.countEvents('wss://relay1.com');
    const mockDb = vi.mocked(lmdb.open)();
    expect(mockDb.getRange).toHaveBeenCalled();
    expect(count).toBe(2);
  });

  it('should count timestamps correctly', async () => {
    await trawler.openCache();
    const count = await trawler.countTimestamps('wss://relay1.com');
    const mockDb = vi.mocked(lmdb.open)();
    expect(mockDb.getRange).toHaveBeenCalled();
    expect(count).toBe(2);
  });

  it('should trawl relays correctly', async () => {
    await trawler.openCache();
    await trawler.trawl(relays, { id: 1 });
    const mockDb = vi.mocked(lmdb.open)();
    // With negentropy enabled (default), it attempts sync which calls subscribe
    expect(mockSubscribe).toHaveBeenCalled();
  });
});
