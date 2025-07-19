import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BullMqAdapter from './BullMqAdapter.js';
import { Queue, QueueEvents, Worker } from 'bullmq';

// Mocking bullmq classes
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    close: vi.fn(),
    clean: vi.fn(),
    name: 'testQueue'
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn()
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  }))
}));

describe('BullMqAdapter', () => {
  let bullMqAdapter;
  let mockRelays, mockOptions;

  beforeEach(() => {
    mockRelays = []; // Replace with appropriate mock data
    mockOptions = {
      queueName: 'testQueue',
      queueOptions: {},
      adapterOptions: { connection: {} },
      workerOptions: {}
    }; // Replace with appropriate mock data
    bullMqAdapter = new BullMqAdapter(mockRelays, mockOptions);
  });

  it('should initialize correctly with given options', () => {
    expect(bullMqAdapter.options).toEqual(expect.objectContaining(mockOptions));
    expect(bullMqAdapter.relays).toEqual(mockRelays);
  });

  it('should initialize queue correctly in queue_init', () => {
    bullMqAdapter.queue_init();
    expect(Queue).toHaveBeenCalledWith('testQueue', {});
    expect(QueueEvents).toHaveBeenCalledWith('testQueue', { connection: {} });
    expect(bullMqAdapter.$q.queue).toBeInstanceOf(Queue);
  });

  it('should initialize worker correctly in worker_init', () => {
    bullMqAdapter.worker_init();
    expect(Worker).toHaveBeenCalledWith('testQueue', expect.any(Function), {});
    expect(bullMqAdapter.$q.worker).toBeInstanceOf(Worker);
  });

  it('should add a job to the queue', async () => {
    await bullMqAdapter.addJob(1, ['chunk']);
    expect(bullMqAdapter.$q.queue.add).toHaveBeenCalledWith('chunk #1', { chunk: ['chunk'] });
  });

  it('should pause the queue', async () => {
    await bullMqAdapter.pause();
    expect(bullMqAdapter.$q.queue.pause).toHaveBeenCalled();
  });

  it('should resume the queue', async () => {
    await bullMqAdapter.resume();
    expect(bullMqAdapter.$q.queue.resume).toHaveBeenCalled();
  });

  it('should clean the queue', async () => {
    await bullMqAdapter.clean();
    expect(bullMqAdapter.$q.queue.clean).toHaveBeenCalledWith(0, 0, 'completed');
  });

  it('should close the queue and worker', async () => {
    await bullMqAdapter.close();
    expect(bullMqAdapter.$q.queue.close).toHaveBeenCalled();
    expect(bullMqAdapter.$q.worker.close).toHaveBeenCalled();
  });

  afterEach(() => {
    // Resetting mocks
    vi.restoreAllMocks();
  });
});
