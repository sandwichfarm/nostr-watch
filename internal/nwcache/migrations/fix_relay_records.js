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


import  = db from '../index.js'
import {  = Record } from '../index.js'
import dotenv from 'dotenv'
dotenv.config()

const dbpath = process.env.NWCACHE_PATH

const  = db =  = db(dbpath? dbpath : './.lmdb')

console.log( = db.$.env.stat())

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

  const  = s = await  = db. = .get.all()
  
  const chunks = chunkArray( = s, 100)

  // console.log(chunks)
  // process.exit()
  

  let count = 0
  for(const chunk of chunks){
    console.log('CHUNKS', chunks.length)
    for await (const  =  of chunk){
      console.log('SETTING:',  = .url)
      const url = new URL( = .url).toString()
      try {
        const  = RECORD = {
          ... = Record,
          url: url,
          network:  = .network,
        }
        console.log( = RECORD)
        console.log('SET:', `#${count++}`, await  = db. = .insert( = RECORD))
      }
      catch(e){ console.log('ERROR:', `${ = }: ${e}`) }
    }
  }

// }


