export class TimeoutHelper {
  constructor($session){
    this.session = $session
    this.setup()
  }

  setup(){
    this.timeouts = {}
  }

  reset(){  
    this.setup()
  }

  get(key){
    return this.timeouts[this.session.get()][key]
  }

  has(key){
    return this.timeouts?.[this.session.get()]?.[key]? true : false
  }

  create(key, timeout=1000, timeoutCb=()=>{}){
    if(!this.timeouts?.[this.session.get()])
      this.timeouts[this.session.get()] = {}
    this.timeouts[this.session.get()][key] = setTimeout(() => { 
      if(timeoutCb instanceof Function) {
        try { 
          timeoutCb()
        }
        catch(e) { throw new Error(`error in timeout callback for ${key}: ${e.message}` )  }
      }
    }, timeout)
  }

  async delay(duration){
    return new Promise(resolve => setTimeout(resolve, duration))
  }

  clear(key){
    clearTimeout(this.timeouts[this.session.get()][key])
  }
}