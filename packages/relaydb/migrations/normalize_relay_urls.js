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


import Relaydb from '../index.js'
import dotenv from 'dotenv'
dotenv.config()

const dbpath = process.env.NWCACHE_PATH

const relaydb = Relaydb(dbpath? dbpath : './.lmdb')

console.log(relaydb.$.env.stat())

const chunkArray = function(arr, chunkSize) {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0.");
  }
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    result.push(chunk);
  }
  return result;
}

  // const relays = await relaydb.relay.get.allIds()
  console.log(relaydb.relay.count.all())
  const relays = await relaydb.relay.get.all()
  
  const chunks = chunkArray(relays, 100)

  // console.log(chunks)
  // process.exit()
  

  let count = 0
  for(const chunk of chunks){
    console.log('CHUNKS', chunks.length)
    for await (const relay of chunk){
      console.log('SETTING:', relay.url)
      const url = new URL(relay.url).toString()
      try {
        const RELAYRECORD = {
          url: new URL(url).toString()
        }
        console.log(RELAYRECORD)
        console.log('SET:', `#${count++}`, await relaydb.relay.patch(RELAYRECORD))
      }
      catch(e){ console.log('ERROR:', `${relay}: ${e}`) }
    }
  }

// }


