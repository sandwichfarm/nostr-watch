import { Retry } from "../schemas.js"

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
    let value = this.db.$.get(key)?.v
    return value? value: null
  }

  async set(key, value=0){
    key = this.inferKey(key)
    return this.db.$.put(key, new Retry({k: key, v: value}))
  }

  async increment(key, amt=1){
    key = this.inferKey(key)
    const current = this.get(key)
    return this.set(key, current? current + amt: amt)
  }

  async decrement(key, amt=1){
    key = this.inferKey(key)
    const current = this.get(key)
    return this.set(key, current? current - amt: -amt)
  }
}