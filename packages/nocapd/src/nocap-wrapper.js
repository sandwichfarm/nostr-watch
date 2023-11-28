import { NocapdQueue } from '@nostrwatch/controlflow';

export class NocapWrapper {
  constructor(relay){
    this.daemon_id = process.env?.NOCAPD_DAEMON_ID? process.env.NOCAPD_DAEMON_ID: 'unsetDaemonId'
    this.relay = relay
    this.$queue = new NocapdQueue()
    this.nocap = new Nocap(this.relay)
    this.nocap.checkOnline()
    this.retries = {}
    this.max_retries = 3
    this.retry_every = 5000
    this.connect()
  }

  async connect(){
    this.nocap.check('connect')
  }

  async run_full_check(){
    await !this.nocap.isActive()
    return this.nocap.checkAll()
  }

  async run_full_websocket_check() {
    await !this.nocap.isActive()
    await this.nocap.check('read')
    await this.nocap.check('write')
    return this.nocap.results.dump() 
  }

  async run_online_check(){
    await this.wait_for_inactive()
    return this.nocap.results.getMany(['connect', 'connectLatency'])
  }

  async run_read_check(){
    await this.wait_for_inactive()
    return this.nocap.check('read')
  }

  async run_write_check(){
    await this.wait_for_inactive()
    return this.nocap.check('write')
  }

  async run_geo_check(concurrent=true){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('geo')
  }

  async run_info_check(concurrent=true){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('info')
  }

  async run_ssl_check(concurrent=true){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('ssl')
  }

  async run_dns_check(concurrent=true){
    if(!concurrent)
      await this.wait_for_inactive()
    return this.nocap.check('dns')
  }

  async wait_for_inactive(retries=0){
    return new Promise(resolve => {
      if(this.nocap.isActive()){
        setTimeout(() => {
          retries++
          if(retries > this.max_retries)
            resolve()
          else 
            this.wait_for_inactive(retries).then(resolve)
        }, 100)
      } else {
        resolve()
      }
    })
  }
}

