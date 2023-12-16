import { NocapRelayCheckInfo } from './NocapRelayCheckInfo';
import { RdbRelayCheckInfo } from './RdbRelayCheckInfo';

export function nocapToRdb(nocap: NocapRelayCheckInfo): RdbRelayCheckInfo {
    const rdbPlainObject = nocap.toRdb();
    return NocapRelayCheckInfo.plainToClass(RdbRelayCheckInfo, rdbPlainObject);
}

export function rdbToNocap(rdb: RdbRelayCheckInfo): NocapRelayCheckInfo {
    const nocapPlainObject = rdb.toNocap();
    return RdbRelayCheckInfo.plainToClass(NocapRelayCheckInfo, nocapPlainObject);
}