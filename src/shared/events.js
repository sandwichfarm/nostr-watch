import crypto from 'crypto',

import { validateEvent, verifySignature, signEvent, getEventHash, getPublicKey } from 'nostr-tools'
import { RelayPool } from 'nostr'

const events = {}

events.discoverRelays = async function(){
  return new Promise(resolve => {
    const subid = crypto.randomBytes(40).toString('hex')
    const pool = RelayPool(['wss://nostr.sandwich.farm'])
    pool
      .on('open', relay => {
        // //console.log('open')
        relay.subscribe(subid, {limit: 1000, kinds:[3]})
      })
      .on('close', () => {
        // //console.log('close')
      })
      .on('event', (relay, _subid, event) => {
        if(subid == _subid) {
          try { 
            relaysRemote = Object.assign(relaysRemote, JSON.parse(event.content))
            relay.close()
          } catch(e) {""}
        }
      })
    setTimeout( () => {
      pool.close()
      resolve(true) 
    }, 10*1000 )
  })
}

events.addRelay = async function(){
  
}

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

events.get = async function (){
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

events.publish = async function (){

}

export default Events