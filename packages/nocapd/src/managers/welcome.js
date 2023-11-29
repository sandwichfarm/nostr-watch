export default {
  id: 'Welcome',
  runner: async (job) => {
    const { relay, checks } = job.data
    const relay = this.db.relay.get(relayId(relay))
    const nocapd = new NocapdWrapper(relay)
    const result = await nocapd.check('connect', { connnect_timeout: this.timeout })
    nocapd.close()
    this.persist(result)
  },
  populator: async () => {
    const relaysNew = db.$.select(['url']).from( RelayRecord ).where( { Relay: { last_checked: (v) => v < 0 } } ).flat()
    relaysNew.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  },
  eventHandlers: {
    complete: async (job, result) => {
      //transform data 
      //persist to relaydb
    }
  }
}