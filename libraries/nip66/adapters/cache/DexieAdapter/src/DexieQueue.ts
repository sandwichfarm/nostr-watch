'use strict'

import * as fastq from "fastq";
import type { queueAsPromised } from "fastq";
import { NostrEvent } from "@base/models/NostrEvent";
import { Queue, QueueTask, type QueueWorker } from "@base/core/Queue";  

const DEFAULT_CONCURRENCY = 1

export interface DexieTask extends QueueTask {
  goal: string;
  id?: string;
  count?: number;
  events: NostrEvent[];
}

export type DexieWorker = (arg: DexieTask) => Promise<void>

export class DexieQueue extends Queue {

  constructor( taskWorker: DexieWorker, concurrency: number = DEFAULT_CONCURRENCY) {
    super(taskWorker as QueueWorker, concurrency)
  }

  async add(task: DexieTask) {
    return this.queue.push(this.task(task))
  }

  task(task: DexieTask){
    if(!task?.count) {
      task.count = task.events.length
    }
    if(!task?.id) {
      if(task.count === 1){
        task.id = task.events[0].id
      }
      else {
        task.id = `${task.events[0].id}:${task.events[task.count-1].id}`
      }
    }
    return task
  }

  //called when last job assigned
  drain(){}

  //called when last job finished
  empty(){}

  //called when concurrency limit is reached
  saturated(){}

}
