import { serviceId, now } from "../utils.js"
import { Service } from "../schemas.js"

export default class ServiceMixin {
  constructor(db) {
    this.db = db;
    this.get = new ServiceGetters(db)
    this.set = new ServiceSetters(db)  
    this.is = new ServiceChecker(db)
  }

  async running(serviceSlug){

  }
}

class ServiceChecker {

  constructor(db) {
    this.db = db;
  }

  async is(service, status) {
    const result = await this.db.$.get(serviceId(service))
    if(result?.online === status)
      return true
  }

  async on(service) { 
    return this.is(service, true)
  }

  async off(service) { 
    return this.is(service, false)
  }

}

class ServiceGetters {

  one(service) {
    this.db.$.get(service)
  }

  all() {
    this.db.$.select().from(Service)
  }

  on(service) { 
    this.db.$
      .select(Service)
      .from(Service)
      .where({ Service: { online: true } })
  }

  off(service) {
    this.db.$
      .select(Service)
      .from(Service)
      .where({ Service: { online: false } })
  }

}

class ServiceSetters {
  async on(service) { 
    this._set(service, true)
  }

  async off(service) {
    this._set(service, false)
  }

  async _set(service, online) {
    if(!service)
      throw new Error("Service is required")
    
      let obj 

    if(!this.db.service.exists(service)) 
      obj = new Service({})
    else 
      obj = this.db.service.get.one(service)
    
    obj.online = online 
    obj.last_boot = online? now(): null
    
    await this.db.$.put(serviceId(service), data)
  }
}

