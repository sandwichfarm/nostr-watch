import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';

const mockDb = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  getKeysCount: vi.fn(),
  getRange: vi.fn(),
}));

vi.mock('lmdb', () => ({ open: vi.fn(() => mockDb) }));

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
    mockDb.get.mockReturnValue(1234567890);
    mockDb.put.mockResolvedValue(undefined);
    mockDb.getKeysCount.mockReturnValue(2);
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
    expect(mockDb.get).toHaveBeenCalledWith('lastUpdate:wss://relay1.com');
    expect(timestamp).toBe(1234567890);
  });

  it('should update since timestamp correctly', async () => {
    await trawler.openCache();
    await trawler['updateSince']('wss://relay1.com', 1234567890);
    expect(mockDb.put).toHaveBeenCalledWith('lastUpdate:wss://relay1.com', 1234567890);
  });

  it('should count events correctly', async () => {
    await trawler.openCache();
    const count = await trawler.countEvents('wss://relay1.com');
    expect(mockDb.getKeysCount).toHaveBeenCalledWith({ start: 'has:', end: 'has;' });
    expect(count).toBe(2);
  });

  it('should count timestamps correctly', async () => {
    await trawler.openCache();
    const count = await trawler.countTimestamps('wss://relay1.com');
    expect(mockDb.getKeysCount).toHaveBeenCalledWith({ start: 'has:', end: 'has;' });
    expect(count).toBe(2);
  });

  it.each(['countEvents', 'countTimestamps'] as const)(
    '%s counts the complete cache without loading cached values',
    async (method) => {
      await trawler.openCache();
      mockDb.getKeysCount.mockReturnValue(250_001);
      mockDb.getRange.mockImplementation(() => {
        throw new Error('Counting must not decode cached event payloads');
      });

      expect(await trawler[method]('wss://relay1.com')).toBe(250_001);
      expect(mockDb.getRange).not.toHaveBeenCalled();
      expect(mockDb.get).not.toHaveBeenCalled();
      expect(mockDb.put).not.toHaveBeenCalled();
    },
  );

  it.each(['countEvents', 'countTimestamps'] as const)(
    '%s returns zero while the cache is closed',
    async (method) => {
      expect(await trawler[method]('wss://relay1.com')).toBe(0);
    },
  );

  it('should trawl relays correctly', async () => {
    await trawler.openCache();
    await trawler.trawl(relays, { id: 1 });
    // With negentropy enabled (default), it attempts sync which calls subscribe
    expect(mockSubscribe).toHaveBeenCalled();
  });
});
