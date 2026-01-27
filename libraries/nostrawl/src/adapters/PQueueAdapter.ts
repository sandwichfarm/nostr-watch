import PQueue from 'p-queue';
import NTQueue from '../classes/Queue';
import { PQueueAdapterOptions, Progress } from '../types';
import { LogLevel } from '../utils/Logger';

export default class PQueueAdapter extends NTQueue {
  protected options: PQueueAdapterOptions;
  private initialized: boolean;
  private jobCount: number;

  constructor(relays: string[], options: PQueueAdapterOptions) {
    super(relays, options);
    this.options = options;
    this.initialized = false;
    this.jobCount = 0;

    // Create a child logger specific to this adapter
    this.logger = this.logger.child('pqueue');
    this.logger.debug('PQueueAdapter initialized', {
      concurrency: this.options.adapterOptions?.concurrency || 1,
      timeout: this.options.adapterOptions?.timeout === undefined ? 'disabled' : this.options.adapterOptions?.timeout,
      relays: relays.length
    });
  }

  async init(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('PQueueAdapter already initialized');
      return;
    }
    
    this.logger.info('Initializing PQueueAdapter');
    const queueOptions: any = {
      concurrency: 1,
      throwOnTimeout: true,
      ...this.options.adapterOptions
    };

    // Only set timeout if it's explicitly provided
    // undefined timeout means no timeout (for long running jobs)
    if (this.options.adapterOptions?.timeout !== undefined) {
      queueOptions.timeout = this.options.adapterOptions.timeout;
      this.logger.debug(`Setting timeout to ${queueOptions.timeout}ms`);
    } else {
      // Remove timeout entirely to disable it
      delete queueOptions.timeout;
      this.logger.debug('Timeout disabled for queue jobs');
    }

    // Ensure intervalCap is a valid number if provided
    if (queueOptions.intervalCap !== undefined && 
        (typeof queueOptions.intervalCap !== 'number' || queueOptions.intervalCap < 1)) {
      this.logger.warn('Invalid intervalCap, must be a number >= 1. Using default.');
      delete queueOptions.intervalCap;
    }

    this.logger.debug('Creating PQueue with options', queueOptions);
    this.queue = new PQueue(queueOptions);
    
    this.$q = {
      pause: () => {
        this.logger.info('Queue: Pausing');
        this.queue.pause();
      },
      clear: () => {
        this.logger.info('Queue: Clearing');
        this.queue.clear();
      },
      start: () => {
        this.logger.info('Queue: Starting');
        this.queue.start();
      },
      stop: async (forceStop = false) => {
        this.logger.info(`Queue: Stopping${forceStop ? ' (force)' : ''}`);
        
        if (forceStop) {
          // Immediate stop: pause and clear without waiting for idle
          this.queue.pause();
          this.queue.clear();
          return;
        }
        
        // Try graceful stop with timeout
        try {
          // Set a reasonable timeout for onIdle (5 seconds)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Queue onIdle timeout reached'));
            }, 5000);
          });
          
          // Race between normal idle and timeout
          await Promise.race([
            this.queue.onIdle(),
            timeoutPromise
          ]);
          
          // If we get here, onIdle completed before timeout
          this.logger.debug('Queue reached idle state gracefully');
        } catch (error) {
          // If timeout or error, force clear
          this.logger.warn('Queue did not reach idle state, forcing clear', error);
        } finally {
          // Always clear the queue
          this.queue.clear();
        }
      }
    };

    // Set up event listeners for queue events
    this.queue.on('active', () => {
      this.logger.debug('Queue: Job became active');
      (this as any).emit('queue_active');
    });

    this.queue.on('completed', async (result: any) => {
      this.logger.debug('Queue: Job completed');
      (this as any).emit('queue_completed', result);
    });

    this.queue.on('error', (error: Error) => {
      this.logger.error('Queue: Error occurred', error);
      (this as any).emit('queue_error', error);
    });

    this.queue.on('idle', () => {
      this.logger.info('Queue: Queue is idle');
      (this as any).emit('queue_idle');
      // Also emit drained event when queue becomes idle
      (this as any).emit('drained');
      this._on('queue_drained', null, null);
    });

    this.queue.on('add', () => {
      this.logger.debug('Queue: Job added');
      (this as any).emit('queue_add');
    });

    this.queue.on('next', () => {
      this.logger.trace('Queue: Processing next job');
      (this as any).emit('queue_next');
    });

    this.initialized = true;
    this.logger.info('PQueueAdapter initialization complete');
  }

  async run(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('PQueueAdapter not initialized, initializing now');
      await this.init();
    }

    this.logger.info('Starting PQueueAdapter run');
    await this.openCache();
    
    // Add all jobs to the queue
    this.logger.debug('Adding jobs for relay chunks');
    const chunks = this.chunk_relays();
    for (let i = 0; i < chunks.length; i++) {
      await this.addJob(i, chunks[i]);
    }
    
    // Start processing the queue
    this.logger.info('Starting queue processing');
    this.start();
  }

  async addJob(index: number, chunk: string[]): Promise<void> {
    this.logger.debug(`Adding job #${index} for ${chunk.length} relays: ${chunk.join(', ')}`);
    this.jobCount++;
    
    return this.queue.add(async () => {
      this.logger.debug(`Starting job #${index} for relays: ${chunk.join(', ')}`);
      try {
        await this.trawl(chunk, { id: index });
        this.logger.debug(`Completed job #${index}`);
        return index;
      } catch (error) {
        this.logger.error(`Job #${index} failed`, error);
        throw error;
      }
    });
  }

  pause(key?: string): void {
    this.logger.info('Pausing queue');
    this.$q?.pause(key);
  }

  clear(key?: string): void {
    this.logger.info('Clearing queue');
    this.$q?.clear(key);
  }

  start(key?: string): void {
    this.logger.info('Starting queue');
    this.$q?.start(key);
  }

  async stop(key?: string, force = false): Promise<void> {
    this.logger.info(`Stopping queue${force ? ' (forced)' : ''}`);
    try {
      await this.$q?.stop(force);
      this.logger.info('Queue stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping queue:', error);
      // Force clear even if error occurs
      if (!force) {
        this.logger.warn('Attempting forced stop after error');
        await this.stop(key, true);
      }
    }
  }

  public async updateProgress(progress: Progress, $job: any): Promise<void> {
    // Enhanced progress logging with more details and formatted values
    const jobInfo = `job #${$job.id}`;
    const relayInfo = progress.relay;
    const countInfo = `${progress.found} found, ${progress.rejected} rejected`;
    
    // Calculate percentage if total is available
    let percentageInfo = '';
    if (progress.total > 0) {
      const percentage = (progress.found / progress.total) * 100;
      percentageInfo = ` (${percentage.toFixed(1)}%)`;
    }
    
    // Format timestamp if available
    let timeInfo = '';
    if (progress.last_timestamp > 0) {
      const date = new Date(progress.last_timestamp * 1000);
      timeInfo = `, last event: ${date.toISOString()}`;
    }
    
    this.logger.info(`Progress update for ${jobInfo} - ${relayInfo}: ${countInfo}${percentageInfo}${timeInfo}`);
    
    // Log more detailed info at debug level
    this.logger.debug(`Detailed progress for ${jobInfo}`, {
      relay: progress.relay,
      found: progress.found,
      rejected: progress.rejected,
      total: progress.total,
      last_timestamp: progress.last_timestamp,
      percentage: progress.total > 0 ? `${((progress.found / progress.total) * 100).toFixed(1)}%` : 'N/A',
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    });

    // Emit the progress event
    (this as any).emit('progress', progress);
  }
}