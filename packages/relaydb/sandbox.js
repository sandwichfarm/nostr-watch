/**
 * used for ad-hoc testing. Will go away soon :)
 * 
 */

import { operators, IDS } from "lmdb-oql";
import lmdb from './index.js'
import { Relay, RelayCheckInfo } from "./schemas.js"
import { parseRelayNetwork } from "@nostrwatch/utils"
import { delay } from "../trawler/src/utils.js";

import { inspect } from 'util'
const log = obj => console.log(inspect(obj, false, null, true))

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb')

import { ParseSelect } from '@nostrwatch/relaydb'


const { $and, $gt, $lt, $eq, $includes, $type, $notDefined, $isDefined, $isNull, $isFalsy, $isTruthy, $isUndefined } = operators

// const db = withExtensions(open('/Users/sandwich/Develop/nostr-watch/packages/trawler/lmdb/nw.mdb', {indexOptions:{fulltext:true}}))

await delay(1000)

const db = lmdb('/Users/sandwich/Develop/nostr-watch/.lmdb/nw.mdb') //{indexOptions:{fulltext:true}}
const start = new Date().getTime()

let $it = db.$.select( ).from( RelayCheckInfo ).where({ RelayCheckInfo: { data: $type('object') } } ) 

for await (const item of $it) {
  // Process each item
  log(item);
}

console.log(db.relay.count.online(), 'online')

console.log('RELAYS')
console.log(db.relay.count.network('clearnet'), 'clearnet relays')
console.log(db.relay.count.network('tor'), 'tor relays')
console.log(db.relay.count.network('i2p'), 'i2p relays')
console.log(db.relay.count.network('cjdns'), 'cjdns relays')
console.log(db.relay.count.online(), 'online relays')
console.log(db.relay.count.public(), 'public relays')
// console.log(db.relay.count.paid(), 'paid relays')
// console.log('NOTES')
// console.log(db.note.count.all(), 'notes')
// console.log('STAT')
const duration = new Date().getTime() - start
console.log(`${duration}ms`)