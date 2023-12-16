import relaycache from '@nostrwatch/relaycache'
import { capitalize, loadConfig } from "@nostrwatch/utils"

const rcache = relaycache(process.env.NWCACHE_PATH)

const config = await loadConfig()

export class RetryManager {

  constructor(caller, action, relays) {
    if(!caller) throw new Error('caller is required')
    if(!action) throw new Error('action is required') 
    this.caller = caller 
    this.action = action
    this.relays = relays? relays : []
    this.retries = []
    this.config = config?.[caller]?.[action]
  }
  

  cacheId(url){
    return `${capitalize(this.caller)}:${url}`
  }

  async init(){
    const relays = this.relays.length? this.relays: await rcache.relays.get.all()
    const persisted = []
    for await(const relay of relays) {
      const url = relay.url
      const retries = rcache.retry.get( this.cacheId(url) )
      if(retries === null) 
        persisted.push(await rcache.retry.set(this.cacheId(url), 0))
    }
    return persisted
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
  };

  async getExpiredRelays(lastCheckedFn, relays=[]){
    relays = relays?.length? relays: this.relays?.length? this.relays: await rcache.relays.get.all()
    if(!(lastCheckedFn instanceof Function)) throw new Error('lastCheckedFn (arg[1]) must be a function')
    const relayStatuses = await Promise.all(relays.map(async relay => {
      const url = relay.url;
      const lastChecked = rcache.cachetime.get.one(lastCheckedFn(url))
      if (!lastChecked) return { relay, isExpired: true };
      const retries = await rcache.retry.get(this.cacheId(url));
      const isExpired = lastChecked < Date.now() - this.expiry(retries);
      return { relay, isExpired };
    }));
    return relayStatuses.filter(r => r.isExpired).map(r => r.relay);
  }

  async getRetries( url ){
    return await rcache.retry.get(this.cacheId(url))
  }

  async setRetries( url, success ){
    let id 
    if(success) {
      this.log?.debug(`${url} did not require a retry`)
      id = await rcache.retry.set(this.cacheId(url), 0)
    } else { 
      this.log?.debug(`${url} required a retry`)
      id = await rcache.retry.increment(this.cacheId(url))
    }
  }
}