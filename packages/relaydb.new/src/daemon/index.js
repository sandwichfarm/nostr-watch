import rdb from '../index.js'
import { SyncQueue } from '@nostrwatch/controlflow'
import { RedisConnectionDetails } from '@nostrwatch/utils'
import { Relay } from '../models/index.js'

const sync = SyncQueue();
sync.$Queue.drain()

await rdb.connect.sync()

export const generateModulePath = (jobData) => {
  const { action, condition, type, batch } = jobData
  if(!action || !type)  throw new Error("No action or type provided, absolutely necessary!!!")
  const batchStr = batch? "batch-": ""
  return `${process.env.PWD}/src/daemon/jobs/${type.toLowerCase()}-${batchStr.toLowerCase()}${action.toLowerCase()}-${condition.toLowerCase()}.js`
}

export default async () => {
  const handlers = {}; // Use an object instead of an array
  let result
  const worker = async (job) => {
    const { data } = job;
    let { roundtrip, payload } = data;
    try { 
      if (!handlers[data.type]){
         const { default: work } = await import(generateModulePath(data));
         handlers[data.type] = work
      }
      result = await handlers[data.type](payload);
    }
    catch(err) {
      console.log(err);
    }
    if(result.length > 0) console.log(`${await Relay.count()} total`)
    return { 
      roundtrip, 
      result
    };
  };
  return new sync.Worker(sync.$Queue.name, worker, { concurrency: 1, connection: RedisConnectionDetails() });
};