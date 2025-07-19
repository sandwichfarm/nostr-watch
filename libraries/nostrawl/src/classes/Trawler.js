import "websocket-polyfill";
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'

import { NostrFetcher } from 'nostr-fetch';
import { SimplePool } from 'nostr-tools';
import { simplePoolAdapter } from '@nostr-fetch/adapter-nostr-tools'
import { open } from 'lmdb';

import { mergeDeepRight } from 'ramda';

TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

class NTTrawler {
  constructor(relays, options) {
    this.queue = null
    this.relays = relays
    this.promises = []
    this.defaults = {
      queueName: 'trawlerQueue',
      repeatWhenComplete: false,
      relaysPerBatch: 3,
      restDuration: 60*1000,
      progressEvery: 5000,
      parser: () => {},
      filters: {},
      since: 0,
      sinceStrict: true,
      adapter: 'pqueue',
      nostrFetcherOptions: { sort: true },
      adapterOptions: {},
      workerOptions: {},
      queueOptions: {},
      cache: {
        enabled: true,
        path: './cache',
      }
    }
    this.options = mergeDeepRight(this.defaults, options )
    this.cache = null
    if(this.relays.length < this.options.relaysPerBatch)
      this.options.relaysPerBatch = this.relays.length
  }

  async run(){
    //console.log('NTTrawler.run()')
    let i=0
    await this.openCache();
    this.pause()
    for (const chunk of this.chunk_relays()) {
      //console.log('iterating chunk', chunk)
      const $job = await this.addJob(i, chunk)
      //console.log('addJob', $job?.id)
      i++
    }
    const counts = await this.$q.queue.getJobCounts('completed', 'delayed', 'active', 'waiting-children', 'prioritized', 'paused', 'repeat', 'wait', 'completed', 'failed');
    //console.log('counts', counts)
    this.resume()
  }

  async countEvents(relay){
    //console.log('NTTrawler.countEvents()')
    let results = [...this.cache.getRange()]
    results = results.filter(({ key, value }) => typeof key === 'string' && key.startsWith(`has:`))
    return results.length
  }

  async countTimestamps(relay){
    //console.log('NTTrawler.countTimestamps()')
    let events = [...this.cache.getRange()]
    
    events = events.filter(({ key, value }) => typeof key === 'string' && key?.startsWith(`has:`))
    return events.length
  }

  async openCache(){
    console.log('NTTrawler.openCache()')
    if(!this.options.cache.enabled || !this.options.cache?.path) return
    this.cache = open({
      path: this.options.cache.path,
      compression: true
    });
    if(this?.options && this.options?.after_cacheOpen instanceof Function)
      this?.options?.after_cacheOpen(this.cache)
  }

  async trawl(chunk, $job){
    console.log(`starting job #${$job.id} with ${chunk.length} relays`)
    // process.exit()
    const pool = new SimplePool()
    const promises = chunk.map((relay, index) => new Promise(async (resolve, reject) => {
      try {
        const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool))
        const since = this.getSince(relay)
        const progress = {
          found: 0,
          rejected: 0,
          last_timestamp: 0,
          total: await this.countEvents(),
          relay: relay
        }

        let lastProgressUpdate = 0
        let highestTimestamp = parseInt(`${since}`)

        //console.log(`trawling ${relay} starting from ${timeAgo.format(new Date(since*1000))}`)
    
        const it = fetcher.allEventsIterator(
          [ relay ],
          this.options.filters,
          { since },
          this.options.nostrFetcherOptions
        )
    
        for await (const event of it){ 
          const passedValidation = this.options?.validator ? this.options.validator(this, event) : true
          const doUpdateProgress = () => Date.now() - lastProgressUpdate > this.options.progressEvery
          progress.last_timestamp = event.created_at
          if(!passedValidation) {
            progress.rejected++
            if(doUpdateProgress()) {
              lastProgressUpdate = Date.now()
              progress.total = await this.countEvents()
              this.updateProgress(progress, $job)
            }
            continue
          }
          
          await this.options.parser(this, event, $job)
          if(event.created_at > highestTimestamp) {
            highestTimestamp = event.created_at
          }
          progress.found++
          if(doUpdateProgress()){
            lastProgressUpdate = Date.now()
            progress.total = await this.countEvents()
            this.updateProgress(progress, $job)
          }
        }
        await this.updateSince(relay, highestTimestamp)
        resolve(this.getSince(relay))
      } catch (error) {
        console.error('Error', error);
        reject(error);  // Reject the promise on error
      }
    }))
    const results = await Promise.allSettled(promises);
  }

  chunk_relays(){
    //console.log('chunk_relays', this.relays.length)
    if (this.relays.length === 0) 
        return [];
    if(this.relays.length <= this.options.relaysPerBatch)
      return this.relays;
    const chunks = [];
    for(let i = 0; i < this.relays.length; i += this.options.relaysPerBatch){
      //console.log('chunk', i, i + this.options.relaysPerBatch)
      chunks.push(this.relays.slice(i, i + this.options.relaysPerBatch));
    }
    return chunks;
  }

  getSince(relay){
    //console.log('getSince', relay)
    const cached = this.cache.get(`lastUpdate:${relay}`)
    if(typeof cached === 'number')
      return cached
    if(typeof this.options.since === 'number')
      return this.options.since
    if(typeof this.options?.since === 'object')
      if(typeof this.options.since?.[relay] === 'number')
        return this.options.since[relay]
      else
        return 0
    if(typeof this.options?.since === 'undefined')
      return 0
  }

  async updateSince(key, timestamp){
    await this.cache.put(`lastUpdate:${key}`, timestamp)
  }
}

export default NTTrawler