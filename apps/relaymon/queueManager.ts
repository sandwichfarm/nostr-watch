import PQueue from "npm:p-queue";

export class QueueManager {
  checkQueue: PQueue;
  publishQueue: PQueue;

  constructor(checkConcurrency: number = 5, publishConcurrency: number = 2) {
    this.checkQueue = new PQueue({ concurrency: checkConcurrency });
    this.publishQueue = new PQueue({ concurrency: publishConcurrency });
  }

  addCheckJob(job: () => Promise<void>): void {
    this.checkQueue.add(job);
  }

  addPublishJob(job: () => Promise<void>): void {
    this.publishQueue.add(job);
  }

  async onIdle(): Promise<void> {
    await this.checkQueue.onIdle();
    await this.publishQueue.onIdle();
  }
}
