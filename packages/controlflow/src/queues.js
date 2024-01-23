import dotenv from 'dotenv'
import { Queue, QueueEvents, Worker } from 'bullmq';
import { RedisConnectionDetails } from '@nostrwatch/utils'
import Logger from '@nostrwatch/logger'

const log = new Logger('controlflow::queues')

dotenv.config()

const $ = {}

export const TrawlQueue = (qopts={}) => {
  return QueueInit('TrawlQueue', qopts)
}

export const NocapdQueue = (qopts={}) => {
  return QueueInit('NocapdQueue', qopts)
}

export const SyncQueue = (qopts={}) => {
  return QueueInit('SyncQueue', qopts)
}

export const RestApiQueue = (qopts={}) => {
  return QueueInit('RestApiQueue', qopts)
}

export const QueueInit = (key, qopts={}) => {
  if($?.[key]) return $[key]
  const connection = RedisConnectionDetails()
  log.debug(connection)
  log.debug(qopts)
  qopts = { connection, ...qopts }
  const $Queue = new Queue(key, qopts)
  const $QueueEvents = new QueueEvents($Queue.name, { connection } )
  $[key] = { $Queue, $QueueEvents, Worker }
  return $[key]
}

export const BullMQ = {
  Queue,
  QueueEvents,
  Worker
}

export default {
  SyncQueue,
  TrawlQueue,
  NocapdQueue,
  RestApiQueue,
  QueueInit,
  BullMQ
}