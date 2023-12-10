export { default as AppMeta } from './models/AppMeta.js'
export { default as CheckMeta } from './models/CheckMeta.js'
export { default as CheckStatus } from './models/CheckStatus.js'
export { default as ExecutionTimestamp } from './models/ExecutionTimestamp.js'
export { default as Ip } from './models/Ip.js'
export { default as Dns } from './models/MetaDns.js'
export { default as Geo } from './models/MetaGeo.js'
export { default as Info } from './models/MetaInfo.js'
export { default as Ssl } from './models/MetaSsl.js'
export { default as Publisher } from './models/Publisher.js'
export { default as Relay } from './models/Relay.js'
export { default as RelayIp } from './models/RelayIp.js'
export { default as User } from './models/User.js'
export { default as UserRelayList } from './models/UserRelayList.js'

import AppMeta from './models/AppMeta.js';
import CheckMeta from './models/CheckMeta.js';
import CheckStatus from './models/CheckStatus.js';
import ExecutionTimestamp from './models/ExecutionTimestamp.js';
import Ip from './models/Ip.js';
import Dns from './models/MetaDns.js';
import Geo from './models/MetaGeo.js';
import Info from './models/MetaInfo.js';
import Ssl from './models/MetaSsl.js';
import Publisher from './models/Publisher.js';
import Relay from './models/Relay.js';
import RelayIp from './models/RelayIp.js';
import User from './models/User.js';
import UserRelayList from './models/UserRelayList.js';

const models = {
  AppMeta,
  CheckMeta,
  CheckStatus,
  ExecutionTimestamp,
  Ip,
  Dns,
  Geo,
  Info,
  Ssl,
  Publisher,
  Relay,
  RelayIp,
  User,
  UserRelayList,
};

// Export the models object as the default export
export default models;
