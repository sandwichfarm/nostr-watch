import { trawl } from './trawl.js'
import chalk from 'chalk'

const header = () => {
  console.log(chalk.bold(`

@nostrwatch/
 dMMMMMMP dMMMMb  .aMMMb  dMP dMP dMP dMP     dMMMMMP dMMMMb
   dMP   dMP.dMP dMP"dMP dMP dMP dMP dMP     dMP     dMP.dMP
  dMP   dMMMMK" dMMMMMP dMP dMP dMP dMP     dMMMP   dMMMMK" 
 dMP   dMP"AMF dMP dMP dMP.dMP.dMP dMP     dMP     dMP"AMF  
dMP   dMP dMP dMP dMP  VMMMPVMMP" dMMMMMP dMMMMMP dMP dMP   

`));
}

// const populateTrawler = async (relays) => {
//   await trawlWorker.pause()
//   const relaysPerChunk = config?.trawler?.trawl_concurrent_relays || 50;
//   const batches = chunkArray(relays, relaysPerChunk)
//   batches.forEach( (batch, index) => {
//     logger.debug(`adding batch ${index} to trawlQueue`)
//     trawlQueue.add(`trawlBatch${index}`, { relays: batch })
//   })
//   trawlWorker.resume()
// }

// const maybeCheckRelays = async () => {
//   const seeded = rdb.relay.count.all() > 0
//   const useCache = config?.trawler?.check?.enabled || false
//   if(!seeded || !useCache || busy === true) return
//   logger.info('maybeCheckRelays(): checking relays, pausing TrawlWorker')
//   busy = true
//   await checkCache()
//   busy = false
//   logger.info('maybeCheckRelays(): checked relays, resuming TrawlWorker')
// }

// const schedules = () => {
//   const checkEveryMs = config?.trawler?.check?.interval? parseInt(eval(config.trawler.check.interval)): 12*60*60*1000
//   schedule.scheduleJob( msToCronTime(checkEveryMs), maybeCheckRelays )
// }

export default async () => {
  return new Promise( async (resolve) => {
    header()
    trawl()
  })
}