import PQueue from 'p-queue';

const DEFAULT_CONCURRENCY = 1;

export interface QueueTask {
  [key: string]: any;
}

export type QueueWorker<T extends QueueTask> = (task: T) => Promise<void>;

export class Queue<T extends QueueTask> {
  private _queue: PQueue;
  private _taskWorker: QueueWorker<T>;

  constructor(taskWorker: QueueWorker<T>, concurrency: number = DEFAULT_CONCURRENCY) {
    this._taskWorker = taskWorker;
    this._queue = new PQueue({ concurrency });

    this.queue.on('active', () => {
      this.saturated();
    });

    this.queue.on('idle', () => {
      this.drain();
    });

    this.queue.on('empty', () => {
      this.empty();
    });
  }

  get queue(): PQueue {
    return this._queue;
  }

  /**
   * Adds a task to the queue.
   * @param task The task to be added.
   */
  async add(task: T, options?: { priority?: number; signal?: AbortSignal }): Promise<void> {
    await this.queue.add(() => this._taskWorker(task), options);
  }

  /**
   * Called when the queue reaches its concurrency limit.
   */
  protected saturated(): void {
    // Implement logic for when concurrency limit is reached
    //console.log('Queue is saturated.');
  }

  /**
   * Called when the last job is assigned to the queue.
   */
  protected drain(): void {
    // Implement logic for when the last job is assigned
    //console.log('All jobs have been assigned.');
  }

  /**
   * Called when the queue becomes empty.
   */
  protected empty(): void {
    // Implement logic for when the queue is empty
    //console.log('Queue is empty.');
  }

  // Expose all PQueue methods to the wrapper
  public get size(): number {
    return this._queue.size;
  }

  public get pending(): number {
    return this._queue.pending;
  }

  public get isPaused(): boolean {
    return this._queue.isPaused;
  }

  public pause(): void {
    this._queue.pause();
  }

  public start(): void {
    this._queue.start();
  }

  public clear(): void {
    this._queue.clear();
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this._queue.on(event as unknown as any, listener);
  }


  public async onEmpty(): Promise<void> {
    return this._queue.onEmpty();
  }

  public async onIdle(): Promise<void> {
    return this._queue.onIdle();
  }

  public async waitUntilIdle(): Promise<void> {
    return this._queue.onIdle();
  }
}