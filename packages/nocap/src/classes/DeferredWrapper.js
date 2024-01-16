import Deferred from 'promise-deferred'
import Logger from "@nostrwatch/logger"


export class DeferredWrapper {
  constructor($session, $timeout){
    this.promises = {}
    this.timeout = $timeout
    this.$session = $session
    this.logger = new Logger(this.$session.url)
  }

  add(key, timeout, timeoutCb){
    const deferred = this.create(key)
    if(timeout)
      this.timeout.create(key, timeout, () => {
        if(timeoutCb instanceof Function) {
          try { 
            timeoutCb(deferred.reject)
          }
          catch(e) { this.logger.error(`error in timeout callback for ${key}: ${e.message}` ) }
        }
        else {
          this.reject(key, { status: "error", message: `timeout of ${timeout}ms exceeded for ${key}` })
        }
      })
    return deferred
  }

  async resolve(key, result){ 
    this.logger.debug(`deferred:resolve("${key}")`, `has timeout: ${this.timeout.has(key)}`)
    if(this.timeout.has(key))
      this.timeout.clear(key)
    return this.get(key).resolve(result)
  }

  reject(key, error){
    if(this.timeout.has(key))
      this.timeout.clear(key)
    this.get(key).reject(error)
  }

  reflect(key) {
    const promise = this.get(key).promise;    
    if(!promise) 
      return false
    const state = { isFulfilled: false, isRejected: false, isPending: true };
    const reflectedPromise = promise
        .then(
            (value) => { state.isFulfilled = true; state.isPending = false; return value; },
            (error) => { state.isRejected = true; state.isPending = false; throw error; }
        );
    return { state, reflectedPromise };
  }

  clearSessionPromises(_session){
    const session = _session || this.session()
    if(this.promises?.[session])
      delete this.promises[session]
  }

  create(key){
    this.setup()
    this.promises[this.session()][key] = new Deferred()
    return this.get(key)
  }

  exists(key){
    this.logger.debug(`deferred:exists("${key}")`)
    return typeof this.promises?.[this.session()]?.[key] === 'object'
  }

  get(key){
    const deferred = this.promises[this.session()][key]
    this.logger.debug(`deferred:get("${key}"), exists: ${typeof deferred !== 'undefined'}`)
    return deferred
  }

  setup(){
    if(!this.promises?.[this.session()])
      this.promises[this.session()] = {}
  }

  session(){
    return this.$session.get()
  }

  reset(){
    this.promises = {}
  }
}