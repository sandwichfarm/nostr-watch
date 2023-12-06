import dotenv from 'dotenv'
import { Queue as BullQueue, QueueEvents as BullQueueEvents, Worker as BullWorker } from 'bullmq';
import { RedisConnectionDetails } from '@nostrwatch/utils'

dotenv.config()

const TrawlerQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new BullQueue('Trawler', qopts)
}

const NocapdQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new BullQueue('Nocapd', qopts)
}

const RestApiQueue = (qopts={}) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new BullQueue('RestApi', qopts)
}

export {
  TrawlerQueue,
  NocapdQueue,
  RestApiQueue,
  BullQueue,
  BullQueueEvents,
  BullWorker
}