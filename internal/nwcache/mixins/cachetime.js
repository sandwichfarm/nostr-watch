import { operators as ops, IDS } from "lmdb-oql";
import { cacheTimeId, now, ParseSelect, helperHandler } from "../utils.js"
import { CacheTime } from "../schemas.js"

export default class CacheTimeMixin {
  constructor(db, schema) {
    this.db = db;
    this.get = this.__get()
    this.schema = CacheTime
    this.parseSelect = ParseSelect({k: null, v: null}, this.nameClean())
  }

  // get(key){
  //   return this.db.$.get(this.id(key))?.v
  // }

  async set(key, value=now()){
    const id = this.id(key)
    return this.db.$.put(id, new CacheTime({k: key, v: value}))
  }

  id(key){
    return key? `CacheTime@${key}`: `CacheTime@`
  }

  nameClean(){
    return this.constructor.name.replace('Mixin','')
  }

  __get(){
    const fns = {
      all: (select=null, where=null) => {
        select = this.parseSelect(select)
        if(!where)
          where = { [this.nameClean()]: { '#': this.id() } }  
        return [...this.db.$.select().from( this.schema ).where( where )] || []
      },
      allIds: () => {
        const where = { [this.nameClean()]: { '#': this.id() } }  
        return [...this.db.$.select(IDS).from( this.schema ).where( where )] || []
      },
      one: (key, select=null)  => {
        // select = this.parseSelect(select)
        if(!key.includes(this.id()))
          key = this.id(key)
        return this.db.$.get( key )?.v
      }
    }
    return helperHandler(fns)
  }
}