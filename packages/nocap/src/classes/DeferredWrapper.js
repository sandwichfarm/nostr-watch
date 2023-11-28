import Deferred from 'promise-deferred'

export class DeferredWrapper {
  constructor($session, $timeout){
    this.promises = {}
    this.timeout = $timeout
    this.$session = $session
  }

  add(key, timeout, timeoutCb){
    const deferred = this.create(key)
    if(timeout)
      this.timeout.create(key, timeout, () => {
        this.reject(key, { timeout: true } )
        if(timeoutCb instanceof Function) {
          try { 
            timeoutCb()
          }
          catch(e) { this.logger.error(`error in timeout callback for ${key}: ${e.message}` ) }
        }
      })
    return deferred
  }

  resolve(key, result){ 
    if(this.timeout.has(key))
      clearTimeout(this.timeout.get(key))
    this.get(key).resolve(result)
  }

  reject(key, error){
    if(this.timeout.has(key))
      clearTimeout(this.timeout.get(key))
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
    return this.promises?.[this.session()]?.[key]
  }

  get(key){
    const deferred = this.promises[this.session()][key]
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