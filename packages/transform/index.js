import { RelayCheckDns as dns } from './src/dns.js'
import { RelayCheckGeo as geo } from './src/geo.js'
import { RelayCheckSsl as ssl } from './src/ssl.js'
import { RelayCheckInfo as info } from './src/info.js'
import { RelayCheckWebsocket as websocket } from './src/websocket.js'
import { RelayRecord } from './src/relay.js'

export default {
  dns,
  geo,
  info,
  ssl,
  websocket,
  RelayRecord
}