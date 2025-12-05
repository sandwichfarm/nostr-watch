import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nostrawl } from './index';
import { TrawlerOptions } from './types';
import PQueueAdapter from './adapters/PQueueAdapter';
import BullMqAdapter from './adapters/BullMqAdapter';

// Mock the adapters
vi.mock('./adapters/PQueueAdapter');
vi.mock('./adapters/BullMqAdapter');

describe('nostrawl', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a PQueueAdapter instance by default', () => {
    nostrawl(relays, options);
    expect(PQueueAdapter).toHaveBeenCalledWith(relays, expect.objectContaining(options));
  });

  it('should create a BullMqAdapter instance when specified', () => {
    const bullMqOptions = { ...options, adapter: 'bullmq' as const };
    nostrawl(relays, bullMqOptions);
    expect(BullMqAdapter).toHaveBeenCalledWith(relays, expect.objectContaining(bullMqOptions));
  });

  it('should return the adapter instance', () => {
    const adapter = nostrawl(relays, options);
    expect(adapter).toBeInstanceOf(PQueueAdapter);
  });

  it('should use default options when none are provided', () => {
    nostrawl(relays);
    expect(PQueueAdapter).toHaveBeenCalledWith(relays, expect.objectContaining({
      queueName: 'nostr',
      repeatWhenComplete: true,
      restDuration: 1000,
      cache: {
        enabled: true,
        path: './cache'
      }
    }));
  });
}); 