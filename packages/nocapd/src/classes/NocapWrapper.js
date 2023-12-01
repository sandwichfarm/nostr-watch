import { NocapdQueue } from '@nostrwatch/controlflow';
import { Nocap, DeferredWrapper } from '@nostrwatch/nocap';

export default class {
  constructor(relay){
    this.daemon_id = process.env?.NOCAPD_DAEMON_ID? process.env.NOCAPD_DAEMON_ID: 'unsetDaemonId'
    this.relay = relay
    this.$queue = new NocapdQueue()
    this.nocap = new Nocap(this.relay)
    this.nocap.checkOnline()
    this.retries = {}
    this.max_retries = 3
    this.retry_every = 5000
    this.deferreds = new DeferredWrapper()
  }

  async connect(){
    this.nocap.check('connect')
  }

  async run(keys){
    if(typeof keys === 'string')
      keys = [keys] 
    for(const key of keys){
      if(!this?.[`run_${key}_check`] && !(this?.[`run_${key}_check`] instanceof Function))
        throw new Error(`No check method for ${key}`)
      result = await this[`run_${key}_check`]()
    }
  }

  async run_full_check(){
    return this.nocap.check('all')
  }

  async run_websocket_check() {
    let results = {}
    ['connect', 'read', 'write'].forEach(key => {
      results = {...results, ...await this.nocap.check(key)}
    })
    return results
  }

  async run_online_check(){
    return this.nocap.results.getMany(['connect', 'connectLatency'])
  }

  async run_read_check(){
    return this.nocap.check('read')
  }

  async run_write_check(){
    return this.nocap.check('write')
  }

  async run_geo_check(concurrent=false){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('geo')
  }

  async run_info_check(concurrent=false){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('info')
  }

  async run_ssl_check(concurrent=false){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('ssl')
  }

  async run_dns_check(concurrent=false){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('dns')
  }

  async wait_for_inactive(){
    return new Promise((resolve, reject) => {
      if(this.nocap.isActive()){
        setTimeout(() => {
          this.wait_for_inactive().then(resolve)
        }, 100)
      } else {
        resolve()
      }
    })
  }
}

