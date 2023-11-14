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
  import('lmdb-indexeddb').then(module => {
    open = module.open;
  });
} else {
  import('lmdb').then(module => {
    open = module.open;
  });
}

class DbWrapper {
  constructor(dbPath, opts={}){
    this.$ = withExtensions(open(dbPath, opts));
    this.$ = schemas(this.$);
    // this.service = ServiceMixin(this)
    // this.relay = RelayMixin(this)
    // this.check = CheckMixin(this)
    // this.info = InfoMixin(this)
    // this.cachetime = CacheTimeMixin(this)
    // this.stat = StatMixin(this)
    // this.note = NoteMixin(this)
  }
  addMixin(cl) {
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
  db.addMixin(ServiceMixin)
  db.addMixin(RelayMixin)
  db.addMixin(CheckMixin)
  db.addMixin(InfoMixin)
  db.addMixin(CacheTimeMixin)
  db.addMixin(StatMixin)
  db.addMixin(NoteMixin)
  return db
}