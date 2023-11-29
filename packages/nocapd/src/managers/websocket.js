export default {
  id: 'Websocket',
  runner: async (job) => {
    const { relay, checks } = job.data
    const nocapd = new NocapdWrapper(relay)
    const result = await nocapd.check(['connect', 'read', 'write'], { connnect_timeout: this.timeout })
    return result 
  },
  populator: async () => {
    const relays = db.$.select(['url']).from( RelayRecord ).where( 
      { Relay: (R) => 
        {
          const hasBeenWelcome = R.last_checked > 0
          const wsUnchecked = R.read === null && R.write === null 
          const newRelay = hasBeenChecked && wsUnchecked
          const expired = R.last_checked < (new Date() - this.frequency)
          return newRelay || expired
        }
      }).flat()
      relays.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.addJob(job)
    })
  },
  eventHandlers: {
    complete: async (job, result) => {
      const { relay, checks } = job.data
      const relaydb_record = new RelayCheckWebsocket()
      const id = this.rdb.check.websocket.insert(relaydb_record.fromNocap(result).toJson())
    }
  }
}