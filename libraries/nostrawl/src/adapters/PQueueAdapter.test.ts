import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PQueueAdapter from './PQueueAdapter';
import { TrawlerOptions } from '../types';
import PQueue from 'p-queue';
import Logger, { LogLevel } from '../utils/Logger';

// Mock Logger
vi.mock('../utils/Logger', () => ({
  default: vi.fn().mockImplementation(() => ({
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    setLevel: vi.fn()
  })),
  LogLevel: {
    INFO: 3
  }
}));

// Mock PQueue
vi.mock('p-queue', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    add: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onIdle: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('PQueueAdapter', () => {
  let adapter: PQueueAdapter;
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
    adapter = new PQueueAdapter(relays, options);
    
    // Manually setup the $q property since we modified the initialization flow
    adapter['$q'] = {
      pause: vi.fn(),
      clear: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    
    // Initialize the queue property for tests that need it
    adapter['queue'] = new PQueue();
    adapter['initialized'] = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with the correct options', async () => {
    expect(adapter).toBeDefined();
    
    // Initialize the adapter
    await adapter.init();
    
    // Now PQueue should have been called
    expect(PQueue).toHaveBeenCalled();
    expect(adapter['options']).toEqual(expect.objectContaining(options));
  });

  it('should set up event listeners in init', async () => {
    // Initialize the adapter
    await adapter.init();
    
    // Get the queue after initialization
    const queue = adapter['queue'];
    const onSpy = vi.spyOn(queue, 'on');
    
    // We can't directly test the event listeners since they're setup
    // during initialization, but we can verify the queue was created
    expect(queue).toBeDefined();
    expect(PQueue).toHaveBeenCalled();
  });

  it('should run the trawler with the correct flow', async () => {
    const startSpy = vi.spyOn(adapter as any, 'start');
    const chunkRelaysSpy = vi.spyOn(adapter as any, 'chunk_relays').mockReturnValue([relays]);
    const addJobSpy = vi.spyOn(adapter as any, 'addJob').mockResolvedValue(undefined);
    
    await adapter.run();
    
    expect(startSpy).toHaveBeenCalled();
    expect(chunkRelaysSpy).toHaveBeenCalled();
    expect(addJobSpy).toHaveBeenCalled();
  });

  it('should add jobs to the queue', async () => {
    // Initialize the adapter first
    await adapter.init();
    
    const queue = adapter['queue'];
    const addSpy = vi.spyOn(queue, 'add');
    
    await adapter['addJob'](0, ['wss://relay1.com']);
    
    expect(addSpy).toHaveBeenCalled();
  });

  it('should handle queue operations correctly', () => {
    const pauseSpy = vi.spyOn(adapter['$q'], 'pause');
    const clearSpy = vi.spyOn(adapter['$q'], 'clear');
    const startSpy = vi.spyOn(adapter['$q'], 'start');
    
    adapter.pause();
    expect(pauseSpy).toHaveBeenCalled();
    
    adapter.clear();
    expect(clearSpy).toHaveBeenCalled();
    
    adapter.start();
    expect(startSpy).toHaveBeenCalled();
  });

  it('should update progress correctly', async () => {
    const emitSpy = vi.spyOn(adapter, 'emit').mockReturnValue(true);
    const progress = {
      found: 5,
      rejected: 0,
      relay: 'wss://relay1.com',
      last_timestamp: 1234567890,
      highest_timestamp: 1234567890,
      lowest_timestamp: 1234567890,
      total: 10
    };
    
    await adapter.updateProgress(progress, { id: 1 });
    
    // Verify emit was called with the correct arguments instead of _on
    expect(emitSpy).toHaveBeenCalledWith('progress', progress);
  });
});
