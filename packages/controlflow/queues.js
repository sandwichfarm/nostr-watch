import dotenv from 'dotenv'
import { Queue } from 'bullmq';
import { RedisConnectionDetails } from '@nostrwatch/utils'

dotenv.config()

const Trawler = (qopts) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Trawler', qopts)
}

const Nocapd = (qopts) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Nocapd', qopts)
}

const RestApi = (qopts) => {
  qopts = { connection: RedisConnectionDetails(), ...qopts }
  return new Queue('Nocapd', qopts)
}

export {
  Trawler,
  Nocapd,
  RestApi
}