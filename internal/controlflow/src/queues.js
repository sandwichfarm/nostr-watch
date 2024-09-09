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

export const NocapdQueue = (name=null, qopts={}) => {
  name = name? name: 'NocapdQueue'
  return QueueInit(name, qopts)
}

export const PersistQueue = (name=null, qopts={}) => {
  name = name? name: 'PersistQueue'
  return QueueInit(name, qopts)
}

//not sure?
// export const LivenessQueue = (qopts={}) => {
//   return QueueInit('LivenessQueue', qopts)
// }

export const QueueInit = (key, qopts={}) => {
  if($?.[key]) return $[key]
  const connection = RedisConnectionDetails()
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
  TrawlQueue,
  NocapdQueue,
  PersistQueue,
  QueueInit,
  BullMQ
}