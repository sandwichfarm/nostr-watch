import { SyncQueue, BullWorker } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from '@nostrwatch/utils'

const handlers = []

export const generateModulePath = (jobData) => {
  const { action, condition, type, batch } = jobData
  if(!action || !type)  throw new Error("No action or type provided, absolutely necessary!!!")
  const batchStr = batch? batch+"-": ""
  return `./jobs/${type.toLowerCase()}-${batchStr.toLowerCase()}${action.toLowerCase()}-${condition.toLowerCase()}.js`
}

export default () => {
  const $q = SyncQueue()
  const worker = async (job) => {
    console.log(job)
    const { data } = job
    const { roundtrip, payload } = job
    if(handlers?.[data.type])
      handlers[data.type] = await import(generateModulePath( data ))
    return { 
      roundtrip, 
      result: handlers[data.type]( payload ) 
    }
  }
  return new BullWorker($q.constructor.name, worker, { concurrency: 1, connection: RedisConnectionDetails() })
}