import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'

export default {
  id: 'Info',
  frequency: 6*60*60*1000, //6 hours
  runner: async (job) => {
    const { relay, checks } = job.data;
    const nocapd = new NocapdWrapper(relay);
    const infoOld = db.relayInfo.get(db.relay.get(infoNow.url).info)
    const infoNew = await nocapd.check('info').data
    if(!this.hasChanged(infoNew, infoOld))
      return { skip: true }
    return infoNew
  },
  eventHandlers: {
    complete: async (job, result) => {
      if(result?.skip && result.skip === true) return 
      const { relay, checks } = job.data;
      const check = new RelayCheckResultInfo(result, 'nocap');
      const infoId = await db.check.info.insert(check.toJson());
      await db.relay.patch({ info: infoId })
    }
  }
};