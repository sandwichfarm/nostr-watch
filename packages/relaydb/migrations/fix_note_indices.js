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

import dotenv from 'dotenv'

import lmdb from '../index.js'
const db = lmdb('/Users/sandwich/Develop/nostr-watch/packages/trawler/lmdb/nw.mdb')

dotenv.config()

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

export default async () => {

  const notes = [...db.$.getRange().filter( ({ key }) => key.includes('Note@') )]

  const chunks = chunkArray(notes, 500)

  let count = 0
  for(const chunk of chunks){
    for await (const { key, value:note } of chunk){
      try {
        const NOTE = { id: note.id, created_at: note.created_at, kind: note.kind, pubkey: note.pubkey, content: note.content, sig: note.sig, tags: note.tags }
        await db.note.set.one(NOTE)
      }
      catch(e){ console.log('ERROR:', note.id) }
    }
  }

}


