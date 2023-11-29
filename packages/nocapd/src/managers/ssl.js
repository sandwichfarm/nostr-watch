import { RelayCheckWebsocket, RelayCheckResultInfo, RelayCheckResultDns, RelayCheckResultGeo, RelayCheckResultSsl } from '@nostrwatch/transform'

export default {
  id: 'Ssl',
  populator: async () => {
    // Implementation to be provided later
  },
  runner: async (job) => {
    const { relay, checks } = job.data;
    const nocapd = new NocapdWrapper(relay);
    const result = await nocapd.check(['ssl'], { ssl_timeout: this.timeout });
    return result;
  },
  eventHandlers: {
    on_complete: async (job, result) => {
      const { relay, checks } = job.data;
      const relaydb_record = new RelayCheckResultSsl();
      db.check.ssl.patch(relaydb_record.fromNocap(result).toJson());
    }
  }
};