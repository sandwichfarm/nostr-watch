import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'

export default {
  id: 'Dns',
  frequency: 24*60*60*1000, //24 hours
  runner: async (job) => {
    const { relay, checks } = job.data;
    const nocapd = new NocapdWrapper(relay);
    if(!this.hasChanged(await nocapd.check('dns').data, db.relayInfo.get(db.relay.get(infoNow.url).dns))) 
      return { skip: true }
    return info
  },
  eventHandlers: {
    complete: async (job, result) => {
      const { relay, checks } = job.data;
      const check = new RelayCheckResultDns(result, 'nocap');
      const id = db.check.dns.insert(check.toJson());
    }
  }
};