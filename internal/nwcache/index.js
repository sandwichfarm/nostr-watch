// import { open } from 'lmdb'
import { withExtensions } from "lmdb-oql";
import { defineSchemas, schemas } from "./schemas.js";

import RelayMixin from "./mixins/relay.js"
import RetryMixin from "./mixins/retry.js"
import ChecksMixin from "./mixins/checks.js"
import InfoMixin from "./mixins/info.js"
import CacheTimeMixin from "./mixins/cachetime.js"
import StatMixin from "./mixins/stat.js"
import ServiceMixin from "./mixins/service.js"
import NoteMixin from "./mixins/note.js";

import Logger from "@nostrwatch/logger" 

export const Schemas = schemas

let open;

if (typeof window === 'undefined') {
  await import('lmdb').then(module => {
    open = module.open;
  });
}

export class DbWrapper {
  constructor(db){
    this.$ = withExtensions(db);
    this.$ = defineSchemas(this.$);
    this.initialized = false
    this.schemas = schemas
    this.logger = new Logger('lmdb')
  }
  addHelpers(cl) {
    const key = cl.name.toLowerCase().replace("mixin","")
    if(!cl)
      throw new Error("Missing schema class")
    if(this?.[key])
      this.logger.warn(`Mixin already added: ${key}`)
      // throw new Error("Mixin already added")
    this[key] = new cl(this)
    if(this[key]?.init)
      this[key].init() 
  }
}

let db

// export { RelayRecord } from './defaults.js'
export { ParseSelect } from "./utils.js";

export const initializeDb = (_db) => {
  if(_db.initialized) return _db
  _db.addHelpers(ServiceMixin)
  _db.addHelpers(RelayMixin)
  _db.addHelpers(RetryMixin)
  _db.addHelpers(ChecksMixin)
  _db.addHelpers(InfoMixin)
  _db.addHelpers(CacheTimeMixin)
  _db.addHelpers(StatMixin)
  _db.addHelpers(NoteMixin)
  _db.initialized = true
  return _db
}

export const openDb = ( path, opts ) => {
  return open(path, opts)
} 

export default (_lmdb, opts={}) => {

  if(!db?.initialized && typeof _lmdb === 'string')
    _lmdb = openDb(_lmdb, opts)

  if(!db?.initialized) {
    db = new DbWrapper(_lmdb)
    if(!db?.$)
      throw new Error("Failed to initialize LMDB database")
  }

  db = initializeDb(db)
  
  return db
  
}

