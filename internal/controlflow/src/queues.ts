import dotenv from 'dotenv';
import { Queue, QueueEvents, Worker, QueueOptions, ConnectionOptions } from 'bullmq';
import { RedisConnectionDetails } from '@nostrwatch/utils';
import Logger from '@nostrwatch/logger';

const log = new Logger('controlflow::queues');
dotenv.config();

interface QueueInitOptions {
  [key: string]: { $Queue: Queue; $QueueEvents: QueueEvents; Worker: typeof Worker };
}

const $: QueueInitOptions = {};

export const TrawlQueue = (qopts: Partial<QueueOptions> = {}) => {
  return QueueInit('TrawlQueue', qopts);
};

export const NocapdQueue = (name: string | null = null, qopts: Partial<QueueOptions> = {}) => {
  name = name ? name : 'NocapdQueue';
  return QueueInit(name, qopts);
};

export const PersistQueue = (name: string | null = null, qopts: Partial<QueueOptions> = {}) => {
  name = name ? name : 'PersistQueue';
  return QueueInit(name, qopts);
};

export const QueueInit = (key: string, qopts: Partial<QueueOptions> = {}) => {
  if ($?.[key]) return $[key];

  const connection: ConnectionOptions = RedisConnectionDetails();
  
  // Ensure that connection is present in the qopts before passing it to Queue
  const queueOptions: QueueOptions = { connection, ...qopts };

  const $Queue = new Queue(key, queueOptions);
  const $QueueEvents = new QueueEvents($Queue.name, { connection: queueOptions.connection });
  $[key] = { $Queue, $QueueEvents, Worker };
  return $[key];
};

export const BullMQ = {
  Queue,
  QueueEvents,
  Worker,
};

export default {
  TrawlQueue,
  NocapdQueue,
  PersistQueue,
  QueueInit,
  BullMQ,
};
