import Dexie, { Table, Transaction } from 'dexie';
import { IMonitor } from './tables'

export class MonitorDb extends Dexie {
  monitors!: Table<IMonitor, string>;

  constructor() {
    super('MonitorDb');
    this.version(1).stores({
      monitors: '&monitorPubkey, *checks, *kinds, geohash, *geocode, isActive, last_active',
    });
    this.hooks()
  }

  hooks(){
    // this.monitors.hook("deleting", async  (primKey: string | undefined, obj: IMonitor, transaction: Transaction) => {
    //   const { monitorPubkey } = obj;
    //   await Promise.all([
    //     RelayDb.relayChecks.where({monitorPubkey}).delete(),
    //     RelayDb.nip11s.where({monitorPubkey}).delete(),
    //     RelayDb.ssls.where({monitorPubkey}).delete(),
    //     RelayDb.dnses.where({monitorPubkey}).delete()
    //   ])
    // });
  }
}

const db: MonitorDb = new MonitorDb();

db.open()

export default db;
