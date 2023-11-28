import { Relay, Info } from "../schemas.js"
import { operators, IDS } from "lmdb-oql";
import { relayId, now } from "../utils.js"

const { $eq, $gte, $and, $isDefined, $type, $isUndefined, $includes, $in, $nin, $matches } = operators

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb:relay')

import { ResultInterface as ResultType } from "@nostrwatch/nocap";

export default class RelayMixin {
  constructor(db) {
    this.db = db;
  }

  init(){
    this.get = relay_get(this.db)
    this.count = relay_count(this.db)
    this.is = relay_is(this.db)
    this.has = relay_has(this.db)
    this.requires = relay_requires(this.db)
    this.supports = relay_supports(this.db)
    this.limits = relay_limits(this.db)
    this.batch = relay_batch(this.db)
  }

  async insert(RelayObj){
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
    return this.db.$.put(relayId(RelayObj.url), new Relay(RelayObj))
  }
  
  async insertIfNotExists(RelayObj) {
    if( !(this.exists(RelayObj.url)) )
      return this.insert(RelayObj)
  }

  async update(RelayObj) {
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
    const _old = this.$.get(relayId(RelayObj.url))
    if(!_old)
      throw new Error(`Cannot update because ${RelayObj.url} does not exist`)
    const new_ = {..._old, ...RelayObj}
    return this.insert(new_)
  }
  
  async upsert(RelayObj) {
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
    if( await this.exists(RelayObj.url) )
      return this.update(RelayObj)
    return this.insert(RelayObj)
  }

  async delete(RelayObjOrUrl) {
    const url = RelayObjOrUrl?.url || RelayObjOrUrl
    if(!this.exists(url))
      throw new Error(`Cannot delete because ${url} does not exist`)
    return this.db.$.remove(relayId(url))
  }

  async select(select=null, where=null) {
    return [...this.db.$.select(select).from(Relay).where(where)]
  }

  exists(RelayObjOrUrl) {
    const url = RelayObjOrUrl?.url || RelayObjOrUrl
    const exists = this.get.one(url)
    if(exists)
      return true
    return false
  } 

  retention(relayUrl) {
    return this.get.one(relayUrl)?.retention
  } 
}

const relay_batch = (db) => {
  const keys = ['insert', 'insertIfNotExists', 'upsert', 'update', 'delete'];
  const fns = {};
  keys.forEach( key => {
    fns[key] = async (RelayObjs) => {
      if(!(RelayObjs instanceof Array))
        throw new Error("Relay.batch: Must be an array")
      const result = []
      //process records in series. This is important for cache time and reduction/elimination of commit errors.
      for await (const RelayObj of RelayObjs) {
        try { 
          result.push(await db.relay[key](RelayObj))
        }
        catch(e) { logger.warn(e) }
      }
      return result
    }
  })
  return fns
}

const parseSelect = (key) => {
  const $ResultType = new ResultType()
  if(!key)
    key = Object.keys($ResultType).filter(key => typeof key !== 'function' && key !== 'defaults')
  if(key instanceof Object && !(key instanceof Array))
    return key
  if(key == 'id')
    key = '#'
  if(typeof key === 'string')
    key = [key]
  const select = { Relay: {} }
  for (const k of key) {
    select.Relay[k] = (value,{root}) => { root[k]=value; }
  }
  return select
}

const relay_limits = (db) => {
  const fn = {
    db,
    country(relayUrl, country_code){
      if(!country_code)
        return logger.warn(`Country code is required`)
      return this.countries.includes(country_code)
    },
    countries(relayUrl){
      return this.db.relay.get.one(relayUrl)?.relay_countries
    },
  }
  return handler(fn)
}

const relay_is = (db) => {
  const fn = {
    db,
    online(relayUrl) {
      return this.db.relay.get.one(relayUrl)?.connect
    },
    readable(relayUrl) {
      return this.db.relay.get.one(relayUrl)?.read
    },
    writable(relayUrl) {
      return this.db.relay.get.one(relayUrl)?.write
    },
    dead(relayUrl) {
      return this.db.relay.get.one(relayUrl)?.dead
    },
    public(relayUrl) {
      return !this.db.relay.requires.payment(relayUrl) && !this.db.relay.requires.auth(relayUrl)
    }
  }
  return handler(fn)
}

const relay_requires = (db) => {
  const fn = {
    db,
    auth(relayUrl) {
      return this.db.relay.get.one(relayUrl)?.auth
    },
    payment(relayUrl) {
      return this.db.relay.has.limitation(relayUrl, 'payment_required')
    },
  }
  return handler(fn)
}

const relay_has = (db) => {
  const fn = {
    db,
    limitation(relayUrl, key) {
      const record = this.db.relay.get.info(relayUrl)?.limitation
      if(!key)
        return logger.warn(`Limitation key is required`)
      if(!record?.[key])
        return logger.warn(`Relay ${relayUrl} does not have limitation ${key} in its info document (NIP-11)`)
      return record?.[key]
    },
  }
  return handler(fn)
}

const relay_supports = (db) => {
  const fn = {
    db,
    nip(relay, nip){
      if(relay instanceof String) 
        return this.db.relay.get.one(relayUrl)?.info?.supported_nips?.[nip]
      else 
        return this.db.relay.all(null, {Relay: { '#': relayId(relay), info: { supported_nips: $includes(nip) }}})
    },
    nips(relay=null, nips=[], supportsAll=false){
      if(!(nips instanceof Array))
        throw new Error("Relay.supports.nips(): Argument must be an array")
      if(relay instanceof String)
        return this.nipsSingle(relay, nips, supportsAll)
      else if(relay === null)
        return this.nipsMany(relay, nips, supportsAll)
      else 
        throw new Error("Relay.supports.nips(): Argument must be a relay url or null")
    },
    nips_single(relay, nips, supportsAll=false){
      const supports = {}
      nips.forEach(nip => supports[nip] = this.nip(relay, nip))
      if(supportsAll)
        return Object.values(supports).every(support => support)
      else 
        return supports
    },
    nips_many(relay, nips, supportsAll=false){
      const supports = {}
      let select = null
      if(selectKeys)
        select = parseSelect('url')
      nips.forEach(nip => {
        supports[nip]=this.db.relay.all(select, { Relay: { info: (value) => value?.supported_nips?.[nip] }})
      })
      if(supportsAll){
          const urlsFromEachKey = Object.values(supports).map(objects =>
            new Set(objects.map(obj => obj.url))
          );
          const commonUrls = urlsFromEachKey.reduce((a, b) => new Set([...a].filter(x => b.has(x))));
          return Array.from(commonUrls);
      }
    }
  }
  return handler(fn)
}

const relay_get = (db) => {
  const fns = {
    db,
    one(relayUrl) {
      return this.db.$.get(relayId(relayUrl)) || false
    },
    all(select=null, where=null) {
      select = parseSelect(select)
      // return [...this.db.$.select(select).from( Relay ).where({ Relay: { url: (value) => value?.length  } })] || []
      return [...this.db.$.select(select).from( Relay ).where({ Relay: { '#': 'Relay@' } })] || []
    },
    allIds(){
      const result = this.all(IDS).flat()
      return result || []
    },
    online(select=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from( Relay ).where({ Relay: { connect: $matches(true) } })] || []
    },
    network(network, select=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from( Relay ).where({ Relay: { network } })] || []
    },
    public(select=null) {
      select = parseSelect(select)
      return  [...this.db.$
                .select(select)
                .from( Relay )
                .where({ Relay: { info: (value) => !value?.payment_required || value.payment_required === false }})
              ] || []
    },
    paid(select=null) {
      select = parseSelect(select)
      return  [...this.db.$
                .select(select)
                .from( Relay )
                .where({ Relay: { info: (value) => value?.payment_required && value.payment_required === true }})
              ] || []
    },
    dead(select=null) {
      select = parseSelect(select)
      // const toBeAlive = now() - config?.global?.relayAliveThreshold || timestring('30d')
      // return [...this.db.$.select(select).from(Relay).where({ Relay: { last_seen: $gte(toBeAlive) } })] || []
    },
    supportsNip(nip, select=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from(Relay).where({ Relay: { supported_nips: (value) => value.includes(nip) } })] || []
    },
    doesNotSupportNip(nip, select=null) {
      return [...this.db.$.select(select).from(Relay).where({ Relay: { supported_nips: (value) => !value.includes(nip) } })] || []
    }
  }


  const validator = (...args) => {
    // const relayUrl = args[0]
    // const key = args[1]
    // const requiresCheckService = ['online','offline','free','paid','dead']
    // if(requiresCheckService.includes(key) && !this.db.service.is.on('Check'))
    //   return logger.warn("Check service is offline")
    // const requiresRelayUrl = ['one','online','offline','free','paid','dead','supportsNip','doesNotSupportNip']
    // if(!relayUrl)
    //   return logger.warn(`Relay url is required`)
    // return true
    return true
  }

  return handler(fns, validator)
}

const relay_count = (db) => {
  const fns = {}
  Object.keys(db.relay.get).forEach(fnkey => {
    if(!(db.relay.get[fnkey] instanceof Function))
      return 0
    fns[fnkey] = (...args) => {
      return db.relay.get[fnkey](...args)?.length? db.relay.get[fnkey](...args).length: 0
    }
  })
  delete fns.one // not a count
  fns.all = fns.allIds // alias
  return fns
}

const handler = (fn, validator=null) => {
  const _ = (..._args) => {
    const fnkey = _args[0]
    const args = Array.from(_args).slice(1)
    if(validator && !validator(...args))
      return
    return fn[fnkey](...args)
  }

  const $fns = {}
  Object.keys(fn).forEach(fnkey => {
    if(fn[fnkey] instanceof Function)
      $fns[fnkey] = (...args) => _(fnkey, ...args)
  })
  return $fns
}