import crypto from 'crypto',

import { validateEvent, verifySignature, signEvent, getEventHash, getPublicKey } from 'nostr-tools'
import { RelayPool } from 'nostr'

const events = {}

events.signEvent = async function(event){
  let event = {
    kind: 10101,
    created_at: Math.floor(Date.now() / 1000),
    tags: ["online", "nostr-watch"],
    content: 'hello'
  }

  event.id = getEventHash(event.id)
  event.pubkey = getPublicKey(privateKey)
  event.sig = await signEvent(event, privateKey)

  let ok = validateEvent(event)
  let veryOk = await verifySignature(event)
}

events.get10101 = async function (){
  const pool = new RelayPool(this.relays),
        subid = crypto.randomBytes(40).toString('hex')

  pool
    .on('open', () => {
      relay.subscribe(subid, {limit: 10000, kinds:[10101]})
    })
    .on('event', () => {

    })

  setTimeout( () => {
    pool.close()
    resolve(true) 
  }, 10*1000 )
}

events.publish10101 = async function (){

}

export default events