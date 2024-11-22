import type { IEvent } from "@nostrwatch/nip66/models";
import { Queue, QueueTask, QueueWorker } from "@nostrwatch/nip66/core";  

const DEFAULT_CONCURRENCY = 1;

export interface DexieTask extends QueueTask {
  goal: string;
  id?: string;
  count?: number;
  events: IEvent[];
}

export type DexieWorker = (task: DexieTask) => Promise<void>;

export class DexieQueue extends Queue<DexieTask> {
  constructor(taskWorker: DexieWorker, concurrency: number = DEFAULT_CONCURRENCY) {
    super(taskWorker, concurrency);
  }

  /**
   * Overrides the add method to preprocess the task before adding it to the queue.
   * @param task The DexieTask to be added.
   */
  async add(task: DexieTask): Promise<void> {
    const processedTask = this.preprocessTask(task);
    return super.add(processedTask);
  }

  /**
   * Preprocesses the task by setting default values.
   * @param task The DexieTask to preprocess.
   * @returns The processed DexieTask.
   */
  private preprocessTask(task: DexieTask): DexieTask {
    if (!task.count) {
      task.count = task.events.length;
    }
    if (!task.id) {
      if (task.count === 1) {
        task.id = task.events[0].id;
      } else {
        task.id = `${task.events[0].id}:${task.events[task.count - 1].id}`;
      }
    }
    return task;
  }

  /**
   * Called when the queue reaches its concurrency limit.
   */
  protected saturated(): void {
    // Implement logic when concurrency limit is reached
    //console.log('Queue is saturated.');
  }

  /**
   * Called when the last job is assigned to the queue.
   */
  protected drain(): void {
    // Implement logic when the last job is assigned
    //console.log('All jobs have been assigned.');
  }

  /**
   * Called when the queue becomes empty.
   */
  protected empty(): void {
    // Implement logic when the queue becomes empty
    //console.log('Queue is empty.');
  }
}
