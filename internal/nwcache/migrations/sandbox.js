/**
 * Fix Note Indices (1):
 * -----------------------
 * Some notes were added without the schema being instantiated 
 * This just reinserts all notes as-is back into the db. 
 * 
 * @Additionally, some of the notes had additional fields 
 * that slipped through the nostr-fetch verifier
 * remove them.
 */

import lmdb from '../index.js'
const db = lmdb('/Users/sandwich/Develop/nostr-watch/.lmdb/TRAWLER9.mdb')

let relays = [...db.relay.get.all()]
relays = relays
  .filter( relay => {
    return relay.network === 'tor'
  })
  .map( relay => relay.url )  

// let arrayLiteral = `[`
// for(const relay of relays) {
//   arrayLiteral += `'${relay}',`
// }
// arrayLiteral = arrayLiteral.slice(0, -1)
// arrayLiteral += `]`

// console.log(arrayLiteral)

let res;

for(const relay of relays) {
  res  += `${relay}\n`
}

console.log(res)
