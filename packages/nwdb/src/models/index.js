// export { default as AppMeta } from './AppMeta.js'
export { default as Checkmeta } from './CheckMeta.js'
export { default as Checkstatus } from './CheckStatus.js'
// export { default as ExecutionTimestamp } from './ExecutionTimestamp.js'
export { default as Ip } from './Ip.js'
export { default as Dns } from './MetaDns.js'
export { default as Geo } from './MetaGeo.js'
export { default as Info } from './MetaInfo.js'
export { default as Ssl } from './MetaSsl.js'
export { default as Publisher } from './Publisher.js'
export { default as Relay } from './Relay.js'
export { default as Relayip } from './RelayIp.js'
// export { default as User } from './User.js'
// export { default as UserRelayList } from './UserRelayList.js'

// import AppMeta from './AppMeta.js';
import Checkmeta from './CheckMeta.js';
import Checkstatus from './CheckStatus.js';
// import ExecutionTimestamp from './ExecutionTimestamp.js';
import Ip from './Ip.js';
import Dns from './MetaDns.js';
import Geo from './MetaGeo.js';
import Info from './MetaInfo.js';
import Ssl from './MetaSsl.js';
import Publisher from './Publisher.js';
import Relay from './Relay.js';
import Relayip from './RelayIp.js';

import associations from '../associations/index.js'
associations()

export default {
  Checkmeta,
  Checkstatus,
  Ip,
  Dns,
  Geo,
  Info,
  Ssl,
  Publisher,
  Relay,
  Relayip
};
