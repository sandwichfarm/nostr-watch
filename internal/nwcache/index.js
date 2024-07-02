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

let open;

if (typeof window !== 'undefined') {
  await import('lmdb-indexeddb').then(module => {
    open = module.open;
  });
} else {
  await import('lmdb').then(module => {
    open = module.open;
  });
}

class DbWrapper {
  constructor(dbPath, opts={}){
    this.$ = withExtensions(open(dbPath, opts));
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

export { RelayRecord } from './defaults.js'
export { ParseSelect } from "./utils.js";

export default (dbPath, opts={}) => {
  if(!db) {
    db = new DbWrapper(dbPath, opts)
    if(!db?.$)
      throw new Error("Failed to initialize LMDB database")
  }
  if(db.initialized) return db
  db.addHelpers(ServiceMixin)
  db.addHelpers(RelayMixin)
  db.addHelpers(RetryMixin)
  db.addHelpers(ChecksMixin)
  db.addHelpers(InfoMixin)
  db.addHelpers(CacheTimeMixin)
  db.addHelpers(StatMixin)
  db.addHelpers(NoteMixin)
  db.initialized = true
  return db
}

