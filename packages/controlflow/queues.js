import dotenv from 'dotenv'
import { Queue, QueueEvents, Worker } from 'bullmq';
import { RedisConnectionDetails } from '@nostrwatch/utils'

dotenv.config()

const TrawlerQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Trawler', qopts)
}

const NocapdQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Nocapd', qopts)
}

const RestApiQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Nocapd', qopts)
}

export {
  TrawlerQueue,
  NocapdQueue,
  RestApiQueue,
  Queue as BullQueue,
  QueueEvents as BullQueueEvents,
  Worker as BullWorker, 
}