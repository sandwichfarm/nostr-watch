import { operators } from "lmdb-oql";
import { cacheTimeId, now } from "../utils.js"
import { CacheTime } from "../schemas.js"

const { $eq, $gte } = operators

export default class CacheTimeMixin {
  constructor(db) {
    this.db = db;
  }

  async get(key){
    return this.db.$.get(cacheTimeId(key))
  }

  async increment(key, amt=1){
    const current = await this.get(key)
    if(!current)
      return this.set(key, amt)
    return this.set(key, current.v + amt)
  }

  async decrement(key, amt=1){
    const current = await this.get(key)
    if(!current)
      return this.set(key, -amt)
    return this.set(key, current.v - amt)
  }

  async set(key, value=now()){
    return this.db.$.put(cacheTimeId(key), new CacheTime({k: key, v: value}))
  }
}