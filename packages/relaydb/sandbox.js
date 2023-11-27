/**
 * used for ad-hoc testing. Will go away soon :)
 * 
 */

import { operators, IDS } from "lmdb-oql";
import lmdb from './index.js'
import { Relay } from "./schemas.js"
import { parseRelayNetwork } from "@nostrwatch/utils"
import { delay } from "../trawler/src/utils.js";

import Logger from "@nostrwatch/logger" 
const logger = new Logger('lmdb')

const { $notDefined, $isDefined, $isNull, $isFalsy, $isTruthy, $isUndefined } = operators

// const db = withExtensions(open('/Users/sandwich/Develop/nostr-watch/packages/trawler/lmdb/nw.mdb', {indexOptions:{fulltext:true}}))

await delay(1000)

const db = lmdb('/Users/sandwich/Develop/nostr-watch/packages/trawler/lmdb/nw.mdb') //{indexOptions:{fulltext:true}}
const start = new Date().getTime()
// console.log(db.$)

// console.log([...db.$.select(IDS).from(Relay).where( { Relay: { url: $isDefined } } )])
// console.log([...db.getRangeFromIndex({ network: "clearnet" },null,null,{fulltext:true})].length)

// for (txn of db.$.begin())
//   console.log(txn.stat()['entries'])

// process.exit()

// const getIds = async (table, where) => {
//   const ids = [...db.$.select(IDS).from(table).where(where)]
//   return ids
// }

// const updateRelays = async (ids) => {
//   for ( const id of ids ) {
//     const relay = await db.relays.get.one(id)
//       if(!relay.network)
//         await db.relays.set.one({...relay, network: parseRelayNetwork(relay) })
//   }
// }

// $type(typeName:string) - property value is of typeName type
// $isOdd() - property value is odd
// $isEven() - property value is even
// $isPrime() - property value is prime
// $isComposite() - property value is composite
// $isPositive() - property value is positive
// $isNegative() - property value is negative
// $isInteger() - property value is an integer
// $isFloat() - property value is a float
// $isNaN() - property value is not a number
// $isArray() - property value is an array
// $isObject() - property value is an object
// $isPrimitive() - property value is a primitive
// $isUndefined() - property value is undefined
// $isNull() - property value is null
// $isTruthy() - property value is truthy
// $isFalsy() - property value is falsy

// const connectIsNull = [...db.$.select(IDS).from(Relay).where({ Relay: {  connect: $isNull  } })]
// const connectIsFalse = [...db.$.select(IDS).from(Relay).where({ Relay: {  connect: false  } })]
// const connectIsTrue = [...db.$.select(IDS).from(Relay).where({ Relay: {  connect: true  } })]
// const connectIsDefined = [...db.$.select(IDS).from(Relay).where({ Relay: {  url: $isDefined  } })]
// const connectIsFalsy = [...db.$.select(IDS).from(Relay).where({ Relay: {  connect: $isFalsy  } })]
// const connectIsTruthy = [...db.$.select(IDS).from(Relay).where({ Relay: {  connect: $isTruthy  } })]
// const connectIsUndefined = [...db.$.select().from(Relay).where({ Relay: {  connect: $isUndefined  } })]
// const nokey = [...db.$.select().from(Relay).where({ Relay: {  $notDefined('nokey')  } })]
// const tor = [...db.$.select().from(Relay).where({ Relay: {  network: 'tor'  } })]
// console.log(nokey.length)


// const urls = db.relay.get.all()
// const urls = db.relay.get.all()

// process.exit()
// console.log(urls)
// const without = []
// urls.forEach(id => {
//   const relay = db.relay.get.one(id)
//   if(!relay?.network)
//     without.push(id)
// })


// console.log(connectIsDefined.length, connectIsTrue.length, connectIsNull.length, connectIsFalse.length,  connectIsFalsy.length, connectIsTruthy.length, connectIsUndefined.length) 

// console.log(tor.map( relay => { return { url: relay.Relay.url, connect: relay.Relay.connect } } ))
// console.log(connectIsUndefined.map( relay => { return { url: relay.Relay.url, connect: relay.Relay.connect } } ))



// console.log(db.note.get.one('Note@f90a551dfed65b3bbbf88b4cbe90d29d4510f79049a0b3e594991ebd45320ad6'))
// console.log(db.note.get.allIds())
// console.log(db.relay.get.allIds())
// console.log('real', db.note.exists('Note@1e3646f98b4daff6554b42abfe251600116da86a91a3e9a933d10289bde72f4c'))
// console.log('fake', db.note.exists('Note@1e3646f98b4daff6554b42abfe251600116da86a91a3e9a933d10289bde72f4cfdsfdsfds'))

// console.log(ids.length, '/', await db.relay.count.all())
// updateRelays(ids)

console.log('RELAYS')
console.log(db.relay.count.network('clearnet'), 'clearnet relays')
console.log(db.relay.count.network('tor'), 'tor relays')
console.log(db.relay.count.network('i2p'), 'i2p relays')
console.log(db.relay.count.network('cjdns'), 'cjdns relays')
console.log('NOTES')
console.log(db.note.count.all(), 'notes')
console.log('STAT')
const duration = new Date().getTime() - start
console.log(`${duration}ms`)