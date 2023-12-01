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

  async set(key, value=now()){
    return this.db.$.put(cacheTimeId(key), new CacheTime({k: key, v: value}))
  }
}