import relaycache from '@nostrwatch/nwcache'
import { capitalize, loadConfig } from "@nostrwatch/utils"

export class RetryManager {

  constructor(caller, config, rcache) {
    if(!caller) throw new Error('caller is required')
    this.caller = caller 
    this.config = config || {}
    this.retries = []
    this.rcache = rcache
  }

  cacheId(url){
    return `${capitalize(this.caller)}:${url}`
  }

  expiry(retries){
    if(retries === null) return 0
    let map
    if(this.config?.expiry && this.config.expiry instanceof Array )
      map = this.config.expiry.map( entry => { return { max: entry.max, delay: parseInt(eval(entry.delay)) } }  )
    else
      map = [
        { max: 3, delay: 1000 * 60 * 60 },
        { max: 6, delay: 1000 * 60 * 60 * 24 },
        { max: 13, delay: 1000 * 60 * 60 * 24 * 7 },
        { max: 17, delay: 1000 * 60 * 60 * 24 * 28 },
        { max: 29, delay: 1000 * 60 * 60 * 24 * 90 }
      ];
    const found = map.find(entry => retries <= entry.max);
    return found ? found.delay : map[map.length - 1].delay;
  }

  getRetries( url ){
    return this.rcache.retry.get(this.cacheId(url))
  }

  getExpiry( url ){
    return this.expiry( this.getRetries(url) )
  }

  async setRetries( url, success ){
    let id 
    if(success) {
      this.log?.debug(`${url} did not require a retry`)
      id = await this.rcache.retry.set(this.cacheId(url), 0)
    } else { 
      this.log?.debug(`${url} required a retry`)
      id = await this.rcache.retry.increment(this.cacheId(url))
    }
    return id
  }
}