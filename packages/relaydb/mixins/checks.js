import { schemas } from "../schemas.js"
import { operators, IDS } from "lmdb-oql";
import { relayId, now, parseSelect, helperHandler } from "../utils.js"

const { Relay, Info } = schemas
const { $eq, $gte, $and, $isDefined, $type, $isUndefined, $includes, $in, $nin, $matches } = operators

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb:relay')

import { ResultInterface as ResultType } from "@nostrwatch/nocap";

export default class RelayChecksMixin {
  constructor(db) {
    this.db = db;
  }

  init(){
    ['websocket', 'info', 'dns', 'geo', 'ssl'].forEach( key => {
      this[key] = {}
      this[key].insert = check_insert(this.db, key)
      this[key].insertIfNotExists = check_insertIfNotExists(this.db, key)
      this[key].update = check_update(this.db, key)
      this[key].patch = check_patch(this.db, key)
      this[key].delete = check_delete(this.db, key)
      this[key].exists = check_exists(this.db, key)
      this[key].get = check_get(this.db, key)
    })
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
    const current = this.$.get(relayId(RelayObj.url))
    if(!current)
      throw new Error(`Cannot update because ${RelayObj.url} does not exist`)
    return this.insert({...RelayObj})
  }

  async patch(RelayObj) {
    this.validate(RelayObj)
    const current = this.$.get(relayId(RelayObj.url))
    if(!current)
      throw new Error(`Cannot patch because ${RelayObj.url} does not exist`)
    delete RelayObj.url
    if(current?.['#']) delete current['#']
    return this.insert({...current, ...RelayObj})
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

const validate = (RelayObj) => {
  if(!RelayObj?.relay_id)
    throw new Error("Relay object must have a relay_id property")
}

const check_insert = (db, key) => async (result) => {
  const info = new Info()
  return db.$.put(null, info)
}