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

function isDuplicatedURL(url) {
  // Use a regular expression to match URLs with protocol colon stripped
  const protocolStrippedRegex = /^([a-zA-Z0-9_-]+:\/\/)(.*)$/;
  const match = url.match(protocolStrippedRegex);

  if (match) {
    const strippedURL = match[2]; // Get the part after the protocol
    const regex = new RegExp(strippedURL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = url.match(regex);
    
    // Check if there are more than one match, indicating duplication
    return matches && matches.length > 1;
  }

  return false;
}

function hasForwardSlashInHostname(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;
    return hostname.includes('/');
  } catch (error) {
    // Handle invalid URLs or other errors
    console.error('Error:', error);
    return false;
  }
}

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
  console.log('before', relaydb.relay.count.all())
  const relays = await relaydb.relay.get.all()
  
  const chunks = chunkArray(relays, 100)

  // console.log(chunks)
  // process.exit()
  

  let count = 0
  const weirdUrls = new Set()
  for(const chunk of chunks){
    for await (const relay of chunk){
      const test = /^(ws:\/\/http|wss:\/\/http|wss:\/\/ws|wss:\/\/wss)/.test(relay.url) 
            || !relay.url.includes('.') 
            || relay.url.endsWith('.')
            || new URL(relay.url).hostname.endsWith('.')

      if(!test)
        continue 

      count++
      // const id = relaydb.relay.id(relay.url)
      const deleted = await relaydb.relay.delete(relay.url)
      console.log('deleted', deleted, relay.url)
    }
  }
  console.log('deleted', count)

  console.log('after', relaydb.relay.count.all())

// }







