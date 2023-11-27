// import { open } from 'lmdb'
import { withExtensions } from "lmdb-oql";
import schemas from "./schemas.js";

import RelayMixin from "./mixins/relay.js"
import CheckMixin from "./mixins/check.js"
import InfoMixin from "./mixins/info.js"
import CacheTimeMixin from "./mixins/cachetime.js"
import StatMixin from "./mixins/stat.js"
import ServiceMixin from "./mixins/service.js"
import NoteMixin from "./mixins/note.js";

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb')

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
    this.$ = schemas(this.$);
  }
  addSchema(cl) {
    const key = cl.name.toLowerCase().replace("mixin","")
    if(!cl)
      throw new Error("Missing schema class")
    if(this?.[key])
      throw new Error("Mixin already added")
    this[key] = new cl(this)
    if(this[key]?.init)
      this[key].init()
  }
}

let db 

export default (dbPath, opts={}) => {
  if(!db) {
    db = new DbWrapper(dbPath, opts)
    if(!db?.$)
      throw new Error("Failed to initialize LMDB database")
  }
  db.addSchema(ServiceMixin)
  db.addSchema(RelayMixin)
  db.addSchema(CheckMixin)
  db.addSchema(InfoMixin)
  db.addSchema(CacheTimeMixin)
  db.addSchema(StatMixin)
  db.addSchema(NoteMixin)
  return db
}