import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'

export default {
  id: 'Geo',
  frequency: 24*60*60*1000, //24 hours
  populator: async () => {
    const dnsNew = db.$.select(['url']).from( RelayRecord ).where( { Relay: { last_checked: (v) => v < 0 } } ).flat()
    const geoUnset = db.$.select(['url']).from( RelayRecord ).where( { Relay: { geo: null } } ).flat()
    relaysNew.forEach(relay => {
      const job = { relay: relay, checks: ['connect'] }
      this.$.queue.add(job)
    })
  },
  runner: async (job) => {
    const { relay, checks } = job.data;
    const nocapd = new NocapdWrapper(relay);
    const result = await nocapd.check(['geo'], { geo_timeout: this.timeout });
    return result;
  },
  eventHandlers: {
    complete: async (job, result) => {
      const { relay, checks } = job.data;
      const check = new RelayCheckResultGeo(result, 'nocap');
      const id = db.check.geo.insert(check.toJson());
      db.relay.patch({ geo: id })
    }
  }
};
