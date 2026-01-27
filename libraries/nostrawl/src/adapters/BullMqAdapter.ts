import { Queue, QueueEvents, Worker } from 'bullmq';
import NTQueue from '../classes/Queue.js'
import { TrawlerOptions, Progress } from '../types.js';
import { LogLevel } from '../utils/Logger';

interface BullMQInstance {
  queue: Queue;
  worker: Worker;
}

interface BullMQTrawlerOptions extends TrawlerOptions {
  $instance?: BullMQInstance;
}

interface QueueWithMethods extends Queue {
  [key: string]: any;
}

interface WorkerWithMethods extends Worker {
  [key: string]: any;
}

class BullMqAdapter extends NTQueue {
  private adapterDefaults: any;
  private queueDefaults: any;
  private workerDefaults: any;
  protected options: BullMQTrawlerOptions = {
    queueName: 'nostr',
    adapterOptions: {},
    queueOptions: {},
    workerOptions: {}
  };

  constructor(relays: string[], options: BullMQTrawlerOptions) {
    super(relays, options);
    // Create a child logger
    this.logger = this.logger.child('bullmq');
    this.logger.info('BullMqAdapter initialized');
    this.options = { ...this.options, ...options };
    this.opts(this.options);
  }

  async init(): Promise<void> {
    this.logger.info('Initializing BullMqAdapter');
    this.$q = {};
    await this.queue_init();
    this.worker_init();
  }

  private async queue_init(): Promise<void> {
    this.logger.debug('Initializing queue');
    if (this.options?.$instance) {
      this.$q.queue = this.options.$instance.queue;
    } else {
      this.$q.queue = new Queue(this.options.queueName || 'nostr', this.options.queueOptions);
    }

    this.logger.debug('Obliterating queue');
    await (this.$q.queue as Queue).obliterate({ force: true });
    this.logger.debug('Queue obliterated');
    
    const qEvents = new QueueEvents(this.$q.queue.name, { connection: this.options.adapterOptions?.connection });
    qEvents.on('active', (...args: any[]) => {
      this.logger.debug('Queue event: active');
      (this as any).emit('queue_active', ...args);
    });
    qEvents.on('completed', (...args: any[]) => {
      this.logger.debug('Queue event: completed');
      (this as any).emit('queue_completed', ...args);
    });
    qEvents.on('failed', (...args: any[]) => {
      this.logger.debug('Queue event: failed');
      (this as any).emit('queue_failed', ...args);
    });
    qEvents.on('progress', (...args: any[]) => {
      this.logger.debug('Queue event: progress');
      (this as any).emit('queue_progress', ...args);
    });
    qEvents.on('waiting', (...args: any[]) => {
      this.logger.debug('Queue event: waiting');
      (this as any).emit('queue_waiting', ...args);
    });
    qEvents.on('drained', (...args: any[]) => {
      this.logger.debug('Queue event: drained');
      (this as any).emit('queue_drained', ...args);
    });
    qEvents.on('cleaned', (...args: any[]) => {
      this.logger.debug('Queue event: cleaned');
      (this as any).emit('queue_cleaned', ...args);
    });
  }

  private worker_init(): void {
    this.logger.debug('Initializing worker');
    this.$q.worker = new Worker(this.$q.queue.name, async ($job: any) => await this.trawl($job.data.chunk, $job), this.options.workerOptions);
    this.$q.worker.on('active', (...args: any[]) => {
      this.logger.debug('Worker event: active');
      (this as any).emit('worker_active', ...args);
    });
    this.$q.worker.on('completed', (...args: any[]) => {
      this.logger.debug('Worker event: completed');
      (this as any).emit('worker_completed', ...args);
    });
    this.$q.worker.on('failed', (...args: any[]) => {
      this.logger.debug('Worker event: failed');
      (this as any).emit('worker_failed', ...args);
    });
    this.$q.worker.on('progress', (...args: any[]) => {
      this.logger.debug('Worker event: progress');
      (this as any).emit('worker_progress', ...args);
    });
    this.$q.worker.on('waiting', (...args: any[]) => {
      this.logger.debug('Worker event: waiting');
      (this as any).emit('worker_waiting', ...args);
    });
    this.$q.worker.on('drained', (...args: any[]) => {
      this.logger.debug('Worker event: drained');
      (this as any).emit('worker_drained', ...args);
    });
    this.$q.worker.on('cleaned', (...args: any[]) => {
      this.logger.debug('Worker event: cleaned');
      (this as any).emit('worker_cleaned', ...args);
    });
  }

  private opts(options: BullMQTrawlerOptions): void {
    this.adapterDefaults = {
      connection: {
        host: 'localhost',
        port: 6379,
        db: 0
      }
    };

    this.options.adapterOptions = this.options.adapterOptions || {};
    this.options.queueOptions = this.options.queueOptions || {};
    this.options.workerOptions = this.options.workerOptions || {};

    if (this.options.adapterOptions.redis) {
      this.options.adapterOptions.connection = this.options.adapterOptions.redis;
      delete this.options.adapterOptions.redis;
    }
    this.options.adapterOptions = { ...this.adapterDefaults, ...this.options.adapterOptions };

    const connection = this.options?.adapterOptions?.connection || this.adapterDefaults.connection;
    
    const typedConnection = connection as { host: string; port: number; db: number };

    this.queueDefaults = {
      removeOnComplete: true,
      removeOnFail: true,
      connection: typedConnection
    };
    this.options.queueOptions = { ...this.queueDefaults, ...this.options.queueOptions };

    this.workerDefaults = {
      connection: typedConnection,
      concurrency: 1
    };
    this.options.workerOptions = { ...this.workerDefaults, ...this.options.workerOptions };
  }

  async updateProgress(progress: Progress, $job: any): Promise<void> {
    // Calculate percentage for logging
    const percentage = progress.total > 0 ? (progress.found / progress.total) * 100 : 0;
    const percentageStr = percentage.toFixed(1) + '%';
    
    // Log comprehensive progress at INFO level
    this.logger.info(`Progress for job ${$job.id}: ${progress.found}/${progress.total} events (${percentageStr}) from ${progress.relay}`);
    
    // Log detailed progress at DEBUG level
    this.logger.debug('Detailed progress information', {
      jobId: $job.id,
      relay: progress.relay,
      found: progress.found,
      rejected: progress.rejected,
      total: progress.total,
      percentage: percentageStr,
      last_timestamp: progress.last_timestamp,
      last_event_time: progress.last_timestamp ? new Date(progress.last_timestamp * 1000).toISOString() : 'N/A'
    });
    
    // Update the job's progress in BullMQ
    await $job.updateProgress(percentage);
    
    // Emit the progress event
    (this as any).emit('progress', progress);
  }

  async addJob(index: number, chunk: any): Promise<any> {
    this.logger.debug(`Adding job #${index} with ${chunk.length} relays`);
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    return (this.$q.queue as Queue).add(`chunk #${index}`, { chunk });
  }

  async pause(): Promise<void> {
    this.logger.info('Pausing queue');
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    await (this.$q.queue as Queue).pause();
  }

  async resume(): Promise<void> {
    this.logger.info('Resuming queue');
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    await (this.$q.queue as Queue).resume();
  }

  async clean(): Promise<void> {
    this.logger.info('Cleaning queue');
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    await (this.$q.queue as Queue).clean(0, 0, 'completed');
  }

  async close(): Promise<void> {
    this.logger.info('Closing queue and worker');
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    if (!this.$q?.worker) throw new Error('Worker not initialized');
    await (this.$q.queue as Queue).close();
    await (this.$q.worker as Worker).close();
  }

  queueApi(key: string, ...args: any[]): any {
    this.logger.debug(`Calling queue API method: ${key}`);
    if (!this.$q?.queue) throw new Error('Queue not initialized');
    const queue = this.$q.queue as QueueWithMethods;
    if (!(queue[key] instanceof Function)) return;
    return queue[key](...args);
  }

  jobApi(key: string, ...args: any[]): any {
    this.logger.debug(`Calling worker API method: ${key}`);
    if (!this.$q?.worker) throw new Error('Worker not initialized');
    const worker = this.$q.worker as WorkerWithMethods;
    if (!(worker[key] instanceof Function)) return;
    return worker[key](...args);
  }
}

export default BullMqAdapter;
