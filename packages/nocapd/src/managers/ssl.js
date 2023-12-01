import transform from '@nostrwatch/transform'

export default class extends WorkerManager {
  constructor(config){
    super(config)
    this.id = 'info'
    this.frequency = 6*60*60*1000 //6 hours
  }
  async populator(){
    // Implementation to be provided later
  }
  async runner(job){
    const { relay, checks } = job.data;
    const nocapd = new NocapdWrapper(relay);
    const result = await nocapd.check(['ssl'], { ssl_timeout: this.timeout });
    return result;
  }
};