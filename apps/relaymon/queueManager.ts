import Queue from "npm:p-queue";
import { getLogger, LogLevel } from "./logger.ts";
import { RetryManager } from "./retryManager.ts";

const logger = getLogger("QueueManager");

export class QueueManager {
  checkQueue: Queue;
  publishQueue: Queue;
  public sizeCompleted: number = 0;
  public sizeFailed: number = 0;

  constructor(checkConcurrency: number = 5, publishConcurrency: number = 2) {
    this.checkQueue = new Queue({ 
      concurrency: checkConcurrency,
      autoStart: true
    });
    
    this.publishQueue = new Queue({ 
      concurrency: publishConcurrency,
      autoStart: true
    });
    
    // Add listeners to track completions and failures
    this.checkQueue.on('completed', () => {
      this.sizeCompleted++;
    });
    
    this.checkQueue.on('error', (error) => {
      this.sizeFailed++;
      logger.error(`Job error: ${error.message}`);
    });
  }

  addCheckJob(job: () => Promise<void>): void {
    // Add error handling wrapper to prevent unhandled promise rejections
    const safeJob = async () => {
      try {
        return await job();
      } catch (error) {
        logger.error(`Check job failed: ${error.message}`);
        // Re-throw to trigger the queue's error event
        throw error;
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
