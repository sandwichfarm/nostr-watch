'use strict'

import * as fastq from "fastq";
import type { queueAsPromised } from "fastq";
import { NostrEvent } from "../../../../src/models/NostrEvent";

const DEFAULT_CONCURRENCY = 1

export interface QueueTask {
  [key: string]: any;
}

export type QueueWorker = (arg: QueueTask) => Promise<void>

export class Queue {
  private _queue: queueAsPromised<QueueTask>

  constructor(taskWorker: (arg: QueueTask) => Promise<void>, concurrency: number = DEFAULT_CONCURRENCY) {
    this._queue = fastq.promise(taskWorker, concurrency)
  }

  get queue(): queueAsPromised<QueueTask> {
    return this._queue
  }

  async add(task: QueueTask) {
    return this.queue.push(task)
  }

  //called when last job assigned
  drain(){}

  //called when last job finished
  empty(){}

  //called when concurrency limit is reached
  saturated(){}
}
