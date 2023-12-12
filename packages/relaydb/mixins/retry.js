import { operators } from "lmdb-oql";
import { Retry } from "../schemas.js"

const { $eq, $gte } = operators

export default class RetryMixin {
  constructor(db) {
    this.db = db;
  }

  id(key){
    return `Retry@${key}`
  }

  inferKey(key){
    return key.includes('Retry@')? key: this.id(key)
  }

  get(key){
    key = this.inferKey(key)
    const value = this.db.$.get(key)?.v
    return value? value: null
  }

  async increment(key, amt=1){
    key = this.inferKey(key)
    const current = await this.get(key)
    return this.set(key, current? current.v + amt: amt)
  }

  async decrement(key, amt=1){
    key = this.inferKey(key)
    const current = await this.get(key)
    return this.set(key, current? current.v - amt: -amt)
  }

  async set(key, value=0){
    key = this.inferKey(key)
    return this.db.$.put(key, new Retry({k: key, v: value}))
  }
}