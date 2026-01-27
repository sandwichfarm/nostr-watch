import Queue from "npm:p-queue";
import { getLogger } from "./logger.ts";
import type { Config } from "../config/config.ts";

const logger = getLogger("QueueManager");

export class QueueManager {
  checkQueue: Queue;
  publishQueue: Queue;
  public sizeCompleted: number = 0;
  public sizeFailed: number = 0;
  public config: Config | undefined; // Store config for status display
  // Warmup status flag for status UI
  public warmupActive: boolean = false;

  // Keep track of enqueued relays across different runs
  public enqueuedRelays: Set<string> = new Set();

  // Track publish statistics
  public publishedEvents: number = 0;
  public failedPublishes: number = 0;
  public retryingPublishes: number = 0;

  // Breakdown counters by category
  public publishedByCategory: Record<
    'check' | 'delta' | 'deletion' | 'announce' | 'other',
    number
  > = { check: 0, delta: 0, deletion: 0, announce: 0, other: 0 };

  public failedByCategory: Record<
    'check' | 'delta' | 'deletion' | 'announce' | 'other',
    number
  > = { check: 0, delta: 0, deletion: 0, announce: 0, other: 0 };

  constructor(checkConcurrency: number = 5, publishConcurrency: number = 2, config?: Config) {
    this.checkQueue = new Queue({ 
      concurrency: checkConcurrency,
      autoStart: true
    });
    
    this.publishQueue = new Queue({ 
      concurrency: publishConcurrency,
      autoStart: true
    });
    
    // Store config for status display
    this.config = config;
    
    // Add listeners to track completions and failures
    this.checkQueue.on('completed', () => {
      this.sizeCompleted++;
    });
    
    this.checkQueue.on('error', (error) => {
      this.sizeFailed++;
      logger.error(`Job error: ${error.message}`);
    });
    
    // Log queue state every 10 seconds
    setInterval(() => {
      this.logQueueState();
    }, 10000);
  }
  
  // Update warmup status (used by daemon/status display)
  setWarmupActive(active: boolean): void {
    this.warmupActive = active;
  }

  // Log the current state of the queue
  logQueueState(): void {
    logger.debug(`Queue state - Check Queue: [Pending: ${this.checkQueue.pending}, Size: ${this.checkQueue.size}, Completed: ${this.sizeCompleted}, Failed: ${this.sizeFailed}], Enqueued: ${this.enqueuedRelays.size}, Publish Queue: [Size: ${this.publishQueue.size}, Published: ${this.publishedEvents}, Failed: ${this.failedPublishes}, Retrying: ${this.retryingPublishes}]`);
  }

  // Add a relay to enqueued set
  addEnqueuedRelay(relay: string): void {
    this.enqueuedRelays.add(relay);
  }
  
  // Remove a relay from enqueued set
  removeEnqueuedRelay(relay: string): void {
    this.enqueuedRelays.delete(relay);
  }
  
  // Check if a relay is already enqueued
  isRelayEnqueued(relay: string): boolean {
    return this.enqueuedRelays.has(relay);
  }
  
  // Get the number of currently enqueued relays
  getEnqueuedRelaysCount(): number {
    return this.enqueuedRelays.size;
  }

  addCheckJob(job: () => Promise<void>, relay?: string): void {
    // If relay is provided, record it as enqueued
    if (relay) {
      this.addEnqueuedRelay(relay);
    }
    
    // Add error handling wrapper to prevent unhandled promise rejections
    const safeJob = async () => {
      try {
        return await job();
      } catch (error) {
        logger.error(`Check job failed: ${error.message}`);
        // Remove relay from enqueued set if it exists
        if (relay) {
          this.removeEnqueuedRelay(relay);
        }
        // Re-throw to trigger the queue's error event
        throw error;
      } finally {
        // Always remove relay from enqueued set on completion
        if (relay) {
          this.removeEnqueuedRelay(relay);
        }
      }
    };
    
    this.checkQueue.add(safeJob);
  }

  addPublishJob(
    job: () => Promise<void>,
    options: { isRetry?: boolean; priority?: number; category?: 'check' | 'delta' | 'deletion' | 'announce' | 'other' } = {}
  ): void {
    // Default priority is 1, retry jobs get lower priority (higher number = lower priority)
    const priority = options.isRetry ? 2 : 1;
    const category = options.category ?? 'other';
    
    // Update retry counter if this is a retry job
    if (options.isRetry) {
      this.retryingPublishes++;
    }
    
    const safeJob = async () => {
      try {
        await job();
        this.publishedEvents++;
        // Increment breakdown counter
        this.publishedByCategory[category] = (this.publishedByCategory[category] || 0) + 1;
        
        // If it was a retry job and succeeded, decrement the retry counter
        if (options.isRetry) {
          this.retryingPublishes = Math.max(0, this.retryingPublishes - 1);
        }
      } catch (error) {
        // If it was a retry that failed, we don't increment failedPublishes again
        // as it was already counted on the first attempt
        if (!options.isRetry) {
          this.failedPublishes++;
          // Increment breakdown failure counter
          this.failedByCategory[category] = (this.failedByCategory[category] || 0) + 1;
        } else {
          // But we do need to decrement the retrying counter since the retry is complete
          this.retryingPublishes = Math.max(0, this.retryingPublishes - 1);
        }
        
        logger.error(`Publish job failed: ${error.message}`);
        // No need to rethrow as our Worker now handles retries internally
      }
    };
    
    // Add to queue with the appropriate priority
    this.publishQueue.add(safeJob, { priority });
  }

  async waitEmpty(queues: Queue[] = [this.checkQueue]): Promise<void> {
    const promises: Promise<void>[] = [];
    queues.forEach((queue) => {
      promises.push(queue.onIdle());
    });
    await Promise.all(promises);
  }

  pause(): void {
    this.checkQueue.pause();
    this.publishQueue.pause();
  }
  
  start(): void {
    this.checkQueue.start();
    this.publishQueue.start();
  }

  // Get detailed statistics about the publishing queue
  getPublishingStats(): {
    size: number;
    pending: number;
    published: number;
    failed: number;
    retrying: number;
    // Legacy, string formatted percentage (e.g., "95.00%" or "N/A")
    success_rate: string;
    // Numeric success rate in range [0,1]; NaN if not enough data
    successRate: number;
    // Breakdown
    publishedChecks: number;
    publishedDeltas: number;
    publishedDeletions: number;
    publishedAnnouncements: number;
    publishedOther: number;
  } {
    const attempts = this.publishedEvents + this.failedPublishes;
    const successRateNum = attempts > 0
      ? (this.publishedEvents / attempts)
      : NaN;
    const success_rate = attempts > 0
      ? (successRateNum * 100).toFixed(2) + '%'
      : 'N/A';
      
    return {
      size: this.publishQueue.size,
      pending: this.publishQueue.pending,
      published: this.publishedEvents,
      failed: this.failedPublishes,
      retrying: this.retryingPublishes,
      success_rate,
      successRate: successRateNum,
      publishedChecks: this.publishedByCategory.check || 0,
      publishedDeltas: this.publishedByCategory.delta || 0,
      publishedDeletions: this.publishedByCategory.deletion || 0,
      publishedAnnouncements: this.publishedByCategory.announce || 0,
      publishedOther: this.publishedByCategory.other || 0,
    };
  }
  
  // Keep this method for debugging purposes but don't use it in regular operation
  // as this info is now shown in the status display
  debugLogPublishingStats(): void {
    const stats = this.getPublishingStats();
    logger.debug(`Publishing Statistics:
  Queue Size: ${stats.size}
  Pending: ${stats.pending}
  Published: ${stats.published}
  Failed: ${stats.failed}
  Retrying: ${stats.retrying}
  Success Rate: ${stats.success_rate}`);
  }
}
