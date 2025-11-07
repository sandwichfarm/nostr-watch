import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Queue, QueueEvents, Worker } from 'bullmq';
import BullMqAdapter from './BullMqAdapter';
import { TrawlerOptions, Progress } from '../types';

vi.mock('bullmq', () => {
  const mockQueue = vi.fn().mockImplementation(() => ({
    name: 'test-queue',
    obliterate: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({ id: 1 }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  }));

  const mockQueueEvents = vi.fn().mockImplementation(() => ({
    on: vi.fn()
  }));

  const mockWorker = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }));

  return {
    Queue: mockQueue,
    QueueEvents: mockQueueEvents,
    Worker: mockWorker
  };
});

describe('BullMqAdapter', () => {
  let adapter: BullMqAdapter;
  let options: TrawlerOptions;

  beforeEach(() => {
    options = {
      queueName: 'test-queue',
      repeatWhenComplete: true,
      restDuration: 1000,
      adapterOptions: {
        connection: {
          host: 'localhost',
          port: 6379
        }
      },
      queueOptions: {},
      workerOptions: {}
    };

    adapter = new BullMqAdapter(['wss://relay1.com', 'wss://relay2.com'], options);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize correctly with given options', () => {
    expect(adapter).toBeDefined();
    expect(adapter['options']).toEqual(expect.objectContaining({
      queueName: 'test-queue',
      repeatWhenComplete: true,
      restDuration: 1000,
      adapterOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'localhost',
          port: 6379
        })
      }),
      queueOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'localhost',
          port: 6379
        }),
        removeOnComplete: true,
        removeOnFail: true
      }),
      workerOptions: expect.objectContaining({
        connection: expect.objectContaining({
          host: 'localhost',
          port: 6379
        }),
        concurrency: 1
      })
    }));
  });

  it('should initialize queue correctly in queue_init', async () => {
    await adapter.init();
    expect(Queue).toHaveBeenCalledWith('test-queue', expect.objectContaining({
      connection: options.adapterOptions!.connection
    }));
    expect(adapter['$q'].queue.obliterate).toHaveBeenCalledWith({ force: true });
    expect(QueueEvents).toHaveBeenCalledWith('test-queue', {
      connection: options.adapterOptions!.connection
    });
  });

  it('should initialize worker correctly in worker_init', async () => {
    await adapter.init();
    expect(Worker).toHaveBeenCalledWith('test-queue', expect.any(Function), expect.objectContaining({
      connection: options.adapterOptions!.connection
    }));
  });

  it('should add a job to the queue', async () => {
    await adapter.init();
    const chunk = ['event1', 'event2'];
    await adapter.addJob(1, chunk);
    expect(adapter['$q'].queue.add).toHaveBeenCalledWith('chunk #1', { chunk });
  });

  it('should pause the queue', async () => {
    await adapter.init();
    await adapter.pause();
    expect(adapter['$q'].queue.pause).toHaveBeenCalled();
  });

  it('should resume the queue', async () => {
    await adapter.init();
    await adapter.resume();
    expect(adapter['$q'].queue.resume).toHaveBeenCalled();
  });

  it('should clean the queue', async () => {
    await adapter.init();
    await adapter.clean();
    expect(adapter['$q'].queue.clean).toHaveBeenCalledWith(0, 0, 'completed');
  });

  it('should close the queue and worker', async () => {
    await adapter.init();
    await adapter.close();
    expect(adapter['$q'].queue.close).toHaveBeenCalled();
    expect(adapter['$q'].worker.close).toHaveBeenCalled();
  });
});
