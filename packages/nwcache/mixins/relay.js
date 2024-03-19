import { schemas } from "../schemas.js"
import { operators, IDS } from "lmdb-oql";
import { relayId, ParseSelect, helperHandler } from "../utils.js"

const { Relay, RelayCheckWebsocket, RelayCheckInfo } = schemas
const { $eq, $gte, $and, $isNuall, $isDefined, $type, $isUndefined, $includes, $in, $nin, $matches } = operators

import Logger from "@nostrwatch/logger" 

const logger = new Logger('lmdb:relay')

import { RelayRecord } from "../defaults.js"

const parseSelect = ParseSelect(RelayRecord, "Relay")

import { ResultInterface as ResultType } from "@nostrwatch/nocap";

export default class RelayMixin {
  constructor(db) {
    this.db = db;
  }

  init(){
    this.batch = relay_batch(this.db)
    this.get = relay_get(this.db)
    this.count = relay_count(this.db)
    this.is = relay_is(this.db)
    // this.has = relay_has(this.db)
    // this.requires = relay_requires(this.db)
    // this.supports = relay_supports(this.db)
    // this.limits = relay_limits(this.db)
  }

  async insert(RelayObj){
    this.validate(RelayObj)
    return this.db.$.put(relayId(RelayObj.url), new Relay(RelayObj))
  }
  
  async insertIfNotExists(RelayObj) {
    if( !(this.exists(RelayObj.url)) )
      return this.insert(RelayObj)
  }

  async update(RelayObj) {
    this.validate(RelayObj)
    const current = this.db.$.get(relayId(RelayObj.url))
    if(!current)
      throw new Error(`Cannot update because ${RelayObj.url} does not exist`)
    return this.insert({...RelayObj})
  }

  async patch(RelayFieldsObj) {
    this.validate(RelayFieldsObj)
    const current = await this.db.$.get(relayId(RelayFieldsObj.url))
    if(!current)
      throw new Error(`Cannot patch because ${RelayFieldsObj.url} does not exist`)
    RelayFieldsObj.url = new URL(RelayFieldsObj.url).toString()
    if(current?.['#']) delete current['#']
    return this.insert({...current, ...RelayFieldsObj})
  }
  
  async upsert(RelayObj) {
    this.validate(RelayObj)
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

  validate(RelayObj){
    if(!RelayObj?.url)
      throw new Error("Relay object must have a url property")
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

  id(relayUrl) {
    return relayId(relayUrl)
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
      for await (const RelayObj of RelayObjs) {
        try { 
          const id = await db.relay[key](RelayObj).catch()
          if(typeof id !== 'undefined')
            result.push(id)
        }
        catch(e) { logger.warn(e) }
      }
      return result
    }
  })
  return fns
}

const relay_limits = (db) => {
  // const fn = {
  //   country(relayUrl, country_code){
  //     if(!country_code)
  //       throw new Error(`Country code is required (example: US)`)
  //     return this.countries.includes(country_code)
  //   },
  //   countries(relayUrl){
  //     return db.relay.get.one(relayUrl)?.relay_countries
  //   },
  // }
  // return helperHandler(fn)
}

const relay_is = (db) => {
  const fn = {
    online(relayUrl) {
      return db.relay.get.one(relayUrl)?.online
    },
    // readable(relayUrl) {
    //   return db.relay.get.one(relayUrl)?.read
    // },
    // writable(relayUrl) {
    //   return db.relay.get.one(relayUrl)?.write
    // },
    // dead(relayUrl) {
    //   return db.relay.get.one(relayUrl)?.dead
    // },
    // public(relayUrl) {
    //   return !db.relay.requires.payment(relayUrl) && !db.relay.requires.auth(relayUrl)
    // }
  }
  return helperHandler(fn)
}

const relay_requires = (db) => {
  const fn = {
    auth(relayUrl) {
      return db.relay.get.one(relayUrl)?.auth
    },
    payment(relayUrl) {
      return db.relay.has.limitation(relayUrl, 'payment_required')
    },
  }
  return helperHandler(fn)
}

const relay_has = (db) => {
  const fn = {
    limitation(relayUrl, key) {
      const record = this.db.relay.get.info(relayUrl)?.limitation
      if(!key)
        return logger.warn(`Limitation key is required`)
      if(!record?.[key])
        return logger.warn(`Relay ${relayUrl} does not have limitation ${key} in its info document (NIP-11)`)
      return record?.[key]
    },
  }
  return helperHandler(fn)
}

const relay_supports = (db) => {
  const fn = {
    nip(relay, nip){
      if(relay instanceof String) 
        return db.relay.get.one(relayUrl)?.info?.supported_nips?.[nip]
      else 
        return db.relay.all(null, {Relay: { '#': relayId(relay), info: { supported_nips: $includes(nip) }}})
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
    nips_many(relay, nips, selectKeys, supportsAll=false){
      const supports = {}
      let select = null
      if(selectKeys)
        select = parseSelect(selectKeys)
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
      return supports
    }
  }
  return helperHandler(fn)
}

const relay_get = (db) => {
  const fns = {
    one(relay) {
      if(typeof relay !== 'string')
        throw new Error(`Relay.get.one(): Argument must be a string: [${relay}: ${typeof relay}] -> [${relay.toString()}: string]`)
      if(!relay.startsWith('Relay@'))
        relay = relayId(relay)
      return db.$.get(relay) || false
    },
    many(relayUrls) {
      return relayUrls.map(relayUrl => this.one(relayUrl))
    },
    all(select=null, where=null) {
      select = parseSelect(select)
      if(!where)
        where = { Relay: { '#': 'Relay@' } }  
      return [...db.$.select(select).from( Relay ).where(where)] || []
    },
    allIds(){
      const result = this.all(IDS).flat()
      return result || []
    },
    online(select=null) {
      select = parseSelect(select)
      return [...db.$.select(select).from( Relay, RelayCheckWebsocket ).where({ Relay: { online: true } })] || []
    },
    network(network, select=null) {
      select = parseSelect(select)
      return [...db.$.select(select).from( Relay ).where({ Relay: { network } })] || []
    },
    public(select=null) {
      select = parseSelect(select)
      return  db.check.info.get.all(select).filter( rci => !rci?.data?.limitation || !rci?.data?.limitation?.payment_required || rci.data.limitation.payment_required === false )
    },
    paid(select=null) {
      select = parseSelect(select)
      const paymentRequired = db.check.info.get.all().filter( rci => rci?.data?.limitation && rci?.data?.limitation?.payment_required && rci.data.limitation.payment_required === true ).map( res => [ res.relay_id, res['#'] ] ) 
      const relayIds = paymentRequired.map( r => r[0] )
      const relayInfoIds = paymentRequired.map( r => r[1] )
      let relays = this.many(relayIds)
      relays = relays.filter( relay => relay.info.ref )

      return this.many(relayIds)
    },
    dead(select=null) {
      select = parseSelect(select)
      
      // const toBeAlive = now() - config?.global?.relayAliveThreshold || timestring('30d')
      // return [...this.db.$.select(select).from(Relay).where({ Relay: { last_seen: $gte(toBeAlive) } })] || []
    },
    supportsNip(nip, select=null) {
      select = parseSelect(select)
      return [...db.$.select(select).from(Relay).where({ Relay: { supported_nips: (value) => value.includes(nip) } })] || []
    },
    doesNotSupportNip(nip, select=null) {
      return [...db.$.select(select).from(Relay).where({ Relay: { supported_nips: (value) => !value.includes(nip) } })] || []
    },
    null(key, select=null){
      if(typeof key !== 'string')
        throw new Error("Relay.get.null(): Argument must be a string")
      select = parseSelect(select)
      // return [...db.$.select(select).from(Relay).where({ Relay: { [key]: (k)=>k==null } })] || []
      return db.relay.get.all(select).filter((r)=>r[key]==null)
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

  return helperHandler(fns, validator)
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