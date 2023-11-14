import { Relay, Info } from "../schemas.js"
import { operators, IDS } from "lmdb-oql";
import { relayId, now } from "../utils.js"

const { $eq, $gte, $isDefined } = operators

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb:relay')

import { ResultInterface as RelayRecord } from "@nostrwatch/nocap";

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
    this.batch = new RelayBatch(this.db)
  }

  async insert(RelayObj){
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
    return this.db.$.put(relayId(RelayObj.url), new Relay(RelayObj))
  }
  
  async insertIfNotExists(RelayObj) {
    if( await this.exists(RelayObj.url) )
      return null
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

  async exists(RelayObjOrUrl) {
    const url = RelayObjOrUrl?.url || RelayObjOrUrl
    const result = await this.get.one(url)
    if(result)
      return true
    return false
  } 

  retention(relayUrl) {
    return this.get.one(relayUrl)?.retention
  } 
}

class RelayBatch {
  
  constructor(db) {
    this.db = db;
  }

  async insert(RelayObjs) {
    if(!(RelayObjs instanceof Array))
      throw new Error("Relay.batch.insert: Must be an array")
    return Promise.all(RelayObjs.map(async (RelayObj) => {
      return this.db.relay.insert(RelayObj)  
    }))
  }

  async insertIfNotExists(RelayObjs) {
    if(!(RelayObjs instanceof Array))
      throw new Error("Relay.batch.insertIfNotExists: Must be an array")
    return Promise.all(RelayObjs.map(async (RelayObj) => {
      return this.db.relay.insertIfNotExists(RelayObj)
    }))
  }
  
  async upsert(RelayObjs) {
    if(!(RelayObjs instanceof Array))
      throw new Error("Relay.batch.upsert: Must be an array")
    return Promise.all(RelayObjs.map(async (RelayObj) => {
      return this.db.relay.upsert(RelayObj)
    }))
  }

  async update(RelayObjs) {
    return Promise.all(RelayObjs.map(async (RelayObj) => {
      return this.db.relay.update(RelayObj)
    }))
  }

  async delete(RelayObjsOrUrls) {
    return Promise.all(RelayObjsOrUrls.map(async (RelayObjOrUrl) => {
      return this.db.relay.delete(RelayObjOrUrl)
    }))
  }

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
    nip(nip){
      return this.db.relay.get.one(relayUrl)?.info?.supported_nips?.[nip]
    },
    nips(nips){
      const supports = {}
      nips.forEach(nip => response[nip] = this.nip(nip))
      return supports
    }
  }
  return handler(fn)
}

const relay_get = (db) => {
  const fns = {
    db,
    one(relayUrl) {
      return this.db.$.get(relayId(relayUrl)) || []
    },
    all(select=null, where=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from( Relay ).where({ Relay: { '#': 'Relay'  } })] || []
    },
    allIds(){
      const result = this.all(IDS).flat()
      return result || []
    },
    online(select=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from( Relay ).where({ Relay: { connect: true } })] || []
    },
    public() {
      return !this.paid() || []
    },
    paid() {
      return this.db.relay.limitation('payment_required') || []
    },
    dead(select=null) {
      select = parseSelect(select)
      const toBeAlive = now() - config?.global?.relayAliveThreshold || timestring('30d')
      return [...this.db.$.select(select).from(Relay).where({ Relay: { last_seen: $gte(toBeAlive) } })] || []
    },
    supportsNip(nip, select=null) {
      select = parseSelect(select)
      return [...this.db.$.select(select).from(Relay).where({ Relay: { supported_nips: $in(nip) } })] || []
    },
    doesNotSupportNip(nip, select=null) {
      return [...this.db.$.select(select).from(Relay).where({ Relay: { supported_nips: $nin(nip) } })] || []
    }
  }

  const parseSelect = (key) => {
    const $RelayRecord = new RelayRecord()
    if(!key)
      key = Object.keys($RelayRecord).filter(key => typeof key !== 'function' && key !== 'defaults')
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
    console.log(select)
    return select
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
      return 
    fns[fnkey] = (...args) => {
      console.log(args)
      db.relay.get[fnkey](...args)?.length || 0
    }
  })
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