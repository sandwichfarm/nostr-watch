import fastq from 'fastq';
import type { queueAsPromised } from 'fastq'

import { queueStore } from '$lib/stores/QueueStore';

import { Nocap } from "@nostrwatch/nocap"
import WebsocketAdapter from "@nostrwatch/nocap-websocket-browser-adapter-default"
import Nip11Adapter from "@nostrwatch/nocap-info-adapter-default"



type Task = (arg: any) => Promise<any>;

class QueueWrapper {
    private queue: queueAsPromised;

    constructor(worker: Task, concurrency: number) {
        this.queue = fastq.promise(worker, concurrency);
    }

    addTask(taskData: any): Promise<any> {
        return this.queue.push(taskData);
    }

    getQueue() {
        return this.queue;
    }
}

export default QueueWrapper;

export const initWorkers = async () => {
  await queueStore.registerWorker(nocapWorker, 20);
};

const nocapWorker = async (url: string) => {
  console.log('working.')
  const nocap = new Nocap(url);
  nocap.on('error', (err) => {
    console.error('error', err)
  })

  await nocap.useAdapter(WebsocketAdapter)
  await nocap.useAdapter(Nip11Adapter)

  console.log('adapter set', nocap.adapters.websocket)
  const check = await nocap.check(['open']);
  console.log('check complete')
  const { duration:result } = check.open;
  
  return { url, result };
}