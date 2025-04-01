import Queue from "npm:p-queue";
import { getLogger } from "./logger.ts";

const logger = getLogger("QueueManager");

export class QueueManager {
  checkQueue: Queue;
  publishQueue: Queue;
  public sizeCompleted: number = 0;
  public sizeFailed: number = 0;
  public config: any; // Store config for status display
  
  // Keep track of enqueued relays across different runs
  public enqueuedRelays: Set<string> = new Set();

  constructor(checkConcurrency: number = 5, publishConcurrency: number = 2, config?: any) {
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
  
  // Log the current state of the queue
  logQueueState(): void {
    logger.info(`Queue state - Pending: ${this.checkQueue.pending}, Size: ${this.checkQueue.size}, Completed: ${this.sizeCompleted}, Failed: ${this.sizeFailed}, Enqueued: ${this.enqueuedRelays.size}`);
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

  addPublishJob(job: () => Promise<void>): void {
    const safeJob = async () => {
      try {
        return await job();
      } catch (error) {
        logger.error(`Publish job failed: ${error.message}`);
        throw error;
      }
    };
    this.publishQueue.add(safeJob);
  }

  async waitEmpty(queues: Queue[] = [this.checkQueue]): Promise<void> {
    const promises: Promise<void>[] = [];
    queues.forEach((queue) => {
      promises.push(new Promise<void>((resolve) => queue.on('empty', () => resolve())));
    });
    await Promise.all(promises);
    return;
  }

  pause(): void {
    this.checkQueue.pause();
    this.publishQueue.pause();
  }
  
  start(): void {
    this.checkQueue.start();
    this.publishQueue.start();
  }
}
